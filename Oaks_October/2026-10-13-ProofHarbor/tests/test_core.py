import copy
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core import Workspace, materialize, retrieve, validate_evidence, check_citations

ROOT = Path(__file__).resolve().parents[1]
SAMPLE = json.loads((ROOT / "data/sample.json").read_text())


class EvidenceTests(unittest.TestCase):
    def test_import_validation_and_supersession_cycles(self):
        validate_evidence(SAMPLE)
        for field, value in [("body", ""), ("links", ["missing"]), ("id", "bad id")]:
            bad = copy.deepcopy(SAMPLE)
            bad["documents"][0][field] = value
            with self.assertRaises(ValueError):
                validate_evidence(bad)
        bad = copy.deepcopy(SAMPLE)
        bad["documents"][0]["supersedes"] = bad["documents"][1]["id"]
        bad["documents"][1]["supersedes"] = bad["documents"][0]["id"]
        with self.assertRaisesRegex(ValueError, "cycle"):
            validate_evidence(bad)

    def test_multihop_path_and_no_evidence(self):
        docs = validate_evidence(SAMPLE)["documents"]
        result = retrieve({"query": "gateway release routing", "documents": docs})
        worker = next(hit for hit in result["hits"] if hit["id"] == "worker-b-log")
        self.assertEqual([node["id"] for node in worker["path"]], ["gateway-release", "queue-metrics", "worker-b-log"])
        self.assertEqual(result["excluded_superseded"], ["cache-old"])
        self.assertEqual(retrieve({"query": "quasarxylophone", "documents": docs})["hits"], [])

    def test_50_graphs_against_independent_shortest_path_oracle(self):
        # Floyd–Warshall expected distances; production uses bounded BFS paths.
        import random
        rng = random.Random(13102026)
        for case in range(50):
            docs = [{"id": f"d{i}", "title": f"Source {i}", "body": "uniqueseed" if i == 0 else "unrelated observation",
                     "entities": [], "links": [], "supersedes": None, "claim": None} for i in range(12)]
            distance = [[0 if i == j else 99 for j in range(12)] for i in range(12)]
            for i in range(12):
                for j in range(i + 1, 12):
                    if rng.random() < .2:
                        docs[i]["links"].append(f"d{j}")
                        distance[i][j] = distance[j][i] = 1
            for k in range(12):
                for i in range(12):
                    for j in range(12):
                        distance[i][j] = min(distance[i][j], distance[i][k] + distance[k][j])
            result = retrieve({"query": "uniqueseed", "documents": docs})
            self.assertEqual({hit["id"] for hit in result["hits"]}, {f"d{i}" for i in range(12) if distance[0][i] <= 2})
            for hit in result["hits"]:
                self.assertEqual(len(hit["path"]) - 1, distance[0][int(hit["id"][1:])])

    def test_citation_exactness_and_superseded_rejection(self):
        docs = validate_evidence(SAMPLE)["documents"]
        check_citations({"sentences": [{"citation": "gateway-release", "quote": next(d["body"] for d in docs if d["id"] == "gateway-release")}]}, docs)
        for citation, quote in [("missing", "invented"), ("gateway-release", "invented"), ("cache-old", next(d["body"] for d in docs if d["id"] == "cache-old"))]:
            with self.assertRaises(ValueError):
                check_citations({"sentences": [{"citation": citation, "quote": quote}]}, docs)

    def test_checkpoint_failure_process_restart_and_review(self):
        with tempfile.TemporaryDirectory() as folder:
            path = str(Path(folder) / "workspace.db")
            workspace = Workspace(path)
            workspace.execute({"id": "import", "type": "import", "expected": 0, "bundle": SAMPLE})
            operation = {"id": "case", "type": "investigate", "expected": 1, "query": "gateway release routing", "fail": True}
            receipt = workspace.execute(operation)
            self.assertEqual(workspace.execute(operation), receipt)
            self.assertEqual(workspace.snapshot()["runs"][0]["status"], "failed")
            workspace.close()
            script = "from core import Workspace;import json,sys;w=Workspace(sys.argv[1]);w.execute({'id':'retry','type':'retry','expected':2,'run':'run-case'});print(json.dumps(w.snapshot()));w.close()"
            result = json.loads(subprocess.check_output([sys.executable, "-c", script, path], cwd=ROOT, text=True))
            self.assertEqual(result["runs"][0]["status"], "awaiting_review")
            self.assertEqual(result["runs"][0]["pending_nodes"], ["review"])
            workspace = Workspace(path)
            before = workspace.snapshot()
            with self.assertRaisesRegex(ValueError, "Acknowledge"):
                workspace.execute({"id": "bad-review", "type": "review", "expected": 3, "run": "run-case", "action": "approve", "reviewer": "operator", "note": "Checked."})
            self.assertEqual(workspace.snapshot(), before)
            workspace.execute({"id": "reject", "type": "review", "expected": 3, "run": "run-case", "action": "reject", "reviewer": "operator", "note": "Check conflicting probes first."})
            self.assertEqual(workspace.snapshot()["runs"][0]["status"], "rejected")
            workspace.execute({"id": "approve", "type": "review", "expected": 4, "run": "run-case", "action": "approve", "reviewer": "operator", "note": "Conflict preserved in dossier.", "acknowledge": True})
            self.assertEqual(workspace.snapshot()["runs"][0]["status"], "published")
            self.assertGreater(workspace.connection.execute("SELECT count(*) FROM checkpoints").fetchone()[0], 0)
            workspace.close()

    def test_stale_review_conflicting_ids_and_empty_dossier(self):
        workspace = Workspace()
        workspace.execute({"id": "i", "type": "import", "expected": 0, "bundle": SAMPLE})
        with self.assertRaisesRegex(ValueError, "Conflicting"):
            workspace.execute({"id": "i", "type": "import", "expected": 0, "bundle": {"schema": 1, "documents": []}})
        workspace.execute({"id": "a", "type": "investigate", "expected": 1, "query": "gateway"})
        revised = copy.deepcopy(SAMPLE)
        revised["documents"][0]["body"] += " Corrected evidence."
        workspace.execute({"id": "i2", "type": "import", "expected": 2, "bundle": revised})
        with self.assertRaisesRegex(ValueError, "current"):
            workspace.execute({"id": "stale", "type": "review", "expected": 3, "run": "run-a", "action": "approve", "reviewer": "op", "note": "Reviewed.", "acknowledge": True})
        workspace.execute({"id": "empty", "type": "investigate", "expected": 3, "query": "quasarxylophone"})
        self.assertEqual(workspace.snapshot()["runs"][0]["status"], "no_evidence")
        with self.assertRaisesRegex(ValueError, "awaiting"):
            workspace.execute({"id": "empty-review", "type": "review", "expected": 4, "run": "run-empty", "action": "approve", "reviewer": "op", "note": "Review."})
        workspace.close()

    def test_maximum_operation_id_remains_reviewable_and_recoverable(self):
        workspace=Workspace()
        workspace.execute({'id':'i','type':'import','expected':0,'bundle':SAMPLE})
        oid='a'*64
        workspace.execute({'id':oid,'type':'investigate','expected':1,'query':'gateway','fail':True})
        workspace.execute({'id':'retry','type':'retry','expected':2,'run':'run-'+oid})
        workspace.execute({'id':'review','type':'review','expected':3,'run':'run-'+oid,'action':'approve','reviewer':'op','note':'Conflicts preserved.','acknowledge':True})
        self.assertEqual(workspace.snapshot()['runs'][0]['status'],'published')
        workspace.close()

    def test_portable_journal_and_bounds(self):
        journal = [{"id": "i", "type": "import", "expected": 0, "bundle": SAMPLE},
                   {"id": "a", "type": "investigate", "expected": 1, "query": "gateway", "fail": True},
                   {"id": "r", "type": "retry", "expected": 2, "run": "run-a"}]
        result = materialize({"schema": 1, "journal": journal})
        self.assertEqual(result["revision"], 3)
        self.assertEqual(result["runs"][0]["status"], "awaiting_review")
        self.assertEqual(result["audit"], materialize({"schema": 1, "journal": journal})["audit"])
        for payload in [{"schema": 2}, {"schema": 1, "journal": journal * 17}, {"schema": 1, "journal": [], "extra": "x" * 131072}]:
            with self.assertRaises(ValueError):
                materialize(payload)


if __name__ == "__main__":
    unittest.main(verbosity=2)
