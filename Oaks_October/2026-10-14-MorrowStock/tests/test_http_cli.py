import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import HTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from api.workspace import handler

ROOT = Path(__file__).resolve().parents[1]
DATA = {"lots": [{"id":"L1","sku":"APPLE","quantity":4,"arrival":0,"expiry":4,"location":0}],
        "orders": [{"id":"O1","sku":"APPLE","quantity":6,"due":2,"priority":3,"location":1}]}


class QuietHandler(handler):
    def log_message(self, *args):
        pass


class HTTPAndCLITest(unittest.TestCase):
    def test_http_real_server_roundtrip_failure_and_recovery(self):
        server = HTTPServer(("127.0.0.1", 0), QuietHandler)
        t = threading.Thread(target=server.serve_forever, daemon=True); t.start()
        url = f"http://127.0.0.1:{server.server_port}/api/workspace"
        def call(payload):
            with urlopen(Request(url, data=json.dumps(payload).encode(), headers={"Content-Type":"application/json"}), timeout=5) as r:
                self.assertEqual(r.headers["Cache-Control"], "no-store")
                return json.load(r)
        try:
            workspace = {"schema":1,"journal":[]}
            op = {"id":"import-1","kind":"import","args":{"data":DATA}}
            result = call({"workspace":workspace,"command":op})
            workspace = result["workspace"]
            repeated = call({"workspace":workspace,"command":op})
            self.assertTrue(repeated["receipt"]["idempotent"])
            self.assertEqual(repeated["state"]["audit_head"], result["state"]["audit_head"])
            with self.assertRaises(HTTPError) as failure:
                call({"workspace":workspace,"command":{"id":"plan-fail","kind":"plan","args":{"plan_id":"P1","expected_version":1},"fail_before_commit":True}})
            self.assertEqual(failure.exception.code, 400)
            self.assertTrue(json.load(failure.exception)["saved_workspace_unchanged"])
            self.assertEqual(len(call({"workspace":workspace})["state"]["plans"]), 0)
            with self.assertRaises(HTTPError) as invalid:
                call({"workspace":{"schema":2,"journal":[]}})
            self.assertEqual(invalid.exception.code, 400)
        finally:
            server.shutdown(); server.server_close(); t.join()

    def test_cli_durable_process_reopen_idempotency_review_pick_and_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = str(Path(tmp)/"stock.sqlite")
            def run(action, operation=None, success=True):
                p = subprocess.run([sys.executable,"cli.py","--db",db,*action],input=json.dumps(operation) if operation else None,text=True,capture_output=True,cwd=ROOT,timeout=10)
                self.assertEqual(p.returncode, 0 if success else 2, p.stderr)
                return json.loads(p.stdout if success else p.stderr)
            op = {"id":"import","kind":"import","args":{"data":DATA}}
            run(["apply","-"],op); run(["apply","-"],op)
            run(["apply","-"],{"id":"plan","kind":"plan","args":{"plan_id":"P","expected_version":1}})
            draft = run(["inspect"])["plans"][0]
            run(["apply","-"],{"id":"reserve-bad","kind":"reserve","args":{"plan_id":"P","plan_digest":draft["digest"]}},False)
            run(["apply","-"],{"id":"review","kind":"review","args":{"plan_id":"P","plan_digest":draft["digest"],"note":"Reviewed synthetic shortages"}})
            run(["apply","-"],{"id":"reserve","kind":"reserve","args":{"plan_id":"P","plan_digest":draft["digest"]}})
            pick = {"id":"pick","kind":"pick","args":{"plan_id":"P","line":0}}
            run(["apply","-"],pick); run(["apply","-"],pick)
            state = run(["export"])
            self.assertEqual(state["receipts"],5)
            self.assertEqual(state["lots"][0]["picked"],4)
            self.assertEqual(state["plans"][0]["status"],"COMPLETE")


if __name__ == "__main__": unittest.main()
