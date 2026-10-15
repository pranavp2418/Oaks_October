import copy
import itertools
import json
import multiprocessing as mp
from pathlib import Path
import random
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core import Store, allocate, digest, validate


def fixture():
    return {"lots": [
        {"id": "early", "sku": "greens", "quantity": 3, "arrival": 0, "expiry": 2, "location": 0},
        {"id": "later", "sku": "greens", "quantity": 4, "arrival": 1, "expiry": 5, "location": 2},
        {"id": "fruit", "sku": "fruit", "quantity": 3, "arrival": 0, "expiry": 4, "location": 1}],
        "orders": [
        {"id": "cafe", "sku": "greens", "quantity": 2, "due": 1, "priority": 4, "location": 0},
        {"id": "market", "sku": "greens", "quantity": 5, "due": 4, "priority": 8, "location": 2},
        {"id": "bakery", "sku": "fruit", "quantity": 4, "due": 3, "priority": 6, "location": 1}]}


def oracle(lots, orders):
    # Independent exhaustive unit assignment. No production graph/cost helpers.
    demand = [o for o in orders for _ in range(o["quantity"])]
    best = float("inf")

    def visit(i, stock, value):
        nonlocal best
        if value >= best:
            return
        if i == len(demand):
            best = value
            return
        o = demand[i]
        visit(i + 1, stock, value + o["priority"] * 1000)
        for j, l in enumerate(lots):
            if stock[j] and l["sku"] == o["sku"] and l["arrival"] <= o["due"] <= l["expiry"]:
                stock[j] -= 1
                visit(i + 1, stock, value + abs(l["location"] - o["location"]) * 3 + l["expiry"] - o["due"])
                stock[j] += 1

    visit(0, [l["quantity"] for l in lots], 0)
    return best


def competing_receipt(path, barrier, queue):
    s = Store(path)
    barrier.wait()
    try:
        queue.put(s.execute({"id": "race", "kind": "plan", "args": {"plan_id": "race-plan", "expected_version": 1}}))
    except Exception as e:
        queue.put({"error": str(e)})
    finally:
        s.close()


def killed_writer(path, ready):
    db = sqlite3.connect(path, isolation_level=None)
    db.execute("BEGIN IMMEDIATE")
    db.execute("UPDATE lots SET quantity=999 WHERE id='early'")
    ready.set()
    # Wait until parent terminates this process; no database commit is issued.
    mp.Event().wait(30)


class CoreTests(unittest.TestCase):
    def setUp(self):
        self.s = Store()
        self.runop("import", data=fixture())

    def tearDown(self):
        self.s.close()

    def runop(self, kind, **args):
        return self.s.execute({"id": f"op-{self.s.snapshot()['receipts']}", "kind": kind, "args": args})

    def reviewed(self, name="p1"):
        plan = self.runop("plan", plan_id=name, expected_version=self.s.version)
        self.runop("review", plan_id=name, plan_digest=plan["digest"], note="Checked dates and shortage priorities")
        return plan

    def test_400_exhaustive_oracles_and_structural_invariants(self):
        rng = random.Random(141022)
        for case in range(400):
            lots = [{"id": f"l{i}", "sku": rng.choice(["a", "b"]), "quantity": rng.randint(1, 2),
                     "arrival": rng.randint(0, 1), "expiry": rng.randint(2, 4), "location": rng.randint(0, 3)} for i in range(rng.randint(1, 3))]
            orders = [{"id": f"o{i}", "sku": rng.choice(["a", "b"]), "quantity": rng.randint(1, 2),
                       "due": rng.randint(0, 5), "priority": rng.randint(1, 4), "location": rng.randint(0, 3)} for i in range(rng.randint(1, 3))]
            result = allocate(lots, orders)
            self.assertEqual(result["objective"], oracle(lots, orders), case)
            used_lots, used_orders = {}, {}
            for a in result["allocations"]:
                l = next(x for x in lots if x["id"] == a["lot"])
                o = next(x for x in orders if x["id"] == a["order"])
                self.assertEqual(l["sku"], o["sku"])
                self.assertLessEqual(l["arrival"], o["due"])
                self.assertGreaterEqual(l["expiry"], o["due"])
                used_lots[l["id"]] = used_lots.get(l["id"], 0) + a["quantity"]
                used_orders[o["id"]] = used_orders.get(o["id"], 0) + a["quantity"]
            for l in lots:
                self.assertLessEqual(used_lots.get(l["id"], 0), l["quantity"])
            for o in orders:
                short = sum(x["quantity"] for x in result["shortages"] if x["order"] == o["id"])
                self.assertEqual(used_orders.get(o["id"], 0) + short, o["quantity"])

    def test_review_reserve_fault_replay_pick_recall_release(self):
        p = self.reviewed()
        with self.assertRaises(ValueError):
            self.runop("reserve", plan_id="p1", plan_digest="wrong")
        self.runop("reserve", plan_id="p1", plan_digest=p["digest"])
        before = self.s.snapshot()
        operation = {"id": "pick-0", "kind": "pick", "args": {"plan_id": "p1", "line": 0}}
        with self.assertRaisesRegex(ValueError, "rolled back"):
            self.s.execute({**operation, "fail_before_commit": True})
        self.assertEqual(self.s.snapshot(), before)
        receipt = self.s.execute(operation)
        self.assertEqual(receipt, self.s.execute(operation))
        with self.assertRaisesRegex(ValueError, "different content"):
            self.s.execute({**operation, "args": {"plan_id": "p1", "line": 1}})
        active = next(a for a in self.s.snapshot()["allocations"] if a["status"] == "RESERVED")
        exposure = self.runop("recall", lot_id=active["lot"], reason="Synthetic supplier quality hold")
        self.assertTrue(exposure["exposure"])
        with self.assertRaises(ValueError):
            self.runop("pick", plan_id="p1", line=active["line"])
        self.runop("release", plan_id="p1", note="Release all unpicked stock for replanning")
        snapshot = self.s.snapshot()
        self.assertEqual(sum(a["status"] == "PICKED" for a in snapshot["allocations"]), 1)
        self.assertFalse(any(a["status"] == "RESERVED" for a in snapshot["allocations"]))
        for l in snapshot["lots"]:
            self.assertEqual(l["quantity"], l["free"] + l["reserved"] + l["picked"])

    def test_stale_draft_and_unreviewed_mutation_refused(self):
        p = self.runop("plan", plan_id="p1", expected_version=1)
        with self.assertRaises(ValueError):
            self.runop("reserve", plan_id="p1", plan_digest=p["digest"])
        self.runop("recall", lot_id="early", reason="Synthetic test hold")
        with self.assertRaisesRegex(ValueError, "current draft"):
            self.runop("review", plan_id="p1", plan_digest=p["digest"], note="Stale approval must fail")
        with self.assertRaises(ValueError):
            self.runop("plan", plan_id="p2", expected_version=1)

    def test_replenish_review_receive_and_shortage_reduction(self):
        before = self.s.solve()
        p = self.runop("purchase", purchase_id="po-1", sku="greens", quantity=2, arrival=2, expiry=6, location=2)
        with self.assertRaises(ValueError):
            self.runop("receive", purchase_id="po-1", lot_id="new")
        self.runop("review_purchase", purchase_id="po-1", purchase_digest=p["digest"], note="Reviewed arrival and shelf life")
        op = {"id": "receive", "kind": "receive", "args": {"purchase_id": "po-1", "lot_id": "new"}}
        self.s.execute(op); self.s.execute(op)
        after = self.s.solve()
        self.assertGreater(after["served"], before["served"])
        self.assertEqual(len(self.s.snapshot()["lots"]), 4)
        with self.assertRaises(ValueError):
            self.runop("receive", purchase_id="po-1", lot_id="duplicate")

    def test_invalid_import_atomicity_and_scenarios(self):
        for mutate in [lambda d: d["lots"][0].update(quantity=True),
                       lambda d: d["lots"][0].update(expiry=-1),
                       lambda d: d["orders"][0].update(priority=0),
                       lambda d: d["lots"].append(d["lots"][0]),
                       lambda d: d["orders"][0].update(extra="ignore me")]:
            data = fixture(); mutate(data)
            with self.assertRaises(ValueError):
                validate(data)
        snap = self.s.snapshot()
        self.assertLessEqual(self.s.solve(exclude_lot="later")["served"], self.s.solve()["served"])
        self.s.solve(demand_percent=150)
        self.assertEqual(self.s.snapshot(), snap)
        with self.assertRaises(ValueError):
            self.runop("import", data=fixture())

    def test_replanning_does_not_overallocate_reserved_or_picked_stock(self):
        p = self.reviewed(); self.runop("reserve", plan_id="p1", plan_digest=p["digest"])
        self.assertEqual(self.s.solve()["served"], 0)
        for a in self.s.snapshot()["allocations"]:
            self.runop("pick", plan_id="p1", line=a["line"])
        self.assertEqual(self.s.one("plans", "p1")["status"], "COMPLETE")
        self.assertEqual(self.s.solve()["served"], 0)

    def test_audit_corruption_fails_closed(self):
        self.s.db.execute("UPDATE audit SET body='{}' WHERE seq=1")
        with self.assertRaisesRegex(ValueError, "integrity"):
            self.s.snapshot()
        with self.assertRaisesRegex(ValueError, "integrity"):
            self.runop("plan", plan_id="corrupt", expected_version=1)

    def test_sqlite_reopen_six_process_race_and_killed_writer(self):
        with tempfile.TemporaryDirectory() as temp:
            path = str(Path(temp) / "inventory.sqlite")
            s = Store(path); s.execute({"id": "seed", "kind": "import", "args": {"data": fixture()}}); s.close()
            barrier, queue = mp.Barrier(6), mp.Queue()
            processes = [mp.Process(target=competing_receipt, args=(path, barrier, queue)) for _ in range(6)]
            for p in processes:
                p.start()
            results = [queue.get(timeout=15) for _ in processes]
            for p in processes:
                p.join(15); self.assertEqual(p.exitcode, 0)
            self.assertTrue(all(r == results[0] for r in results), results)
            self.assertNotIn("error", results[0])
            s = Store(path); before = s.snapshot(); s.close()
            self.assertEqual(before["receipts"], 2)
            ready = mp.Event(); p = mp.Process(target=killed_writer, args=(path, ready)); p.start()
            self.assertTrue(ready.wait(5)); p.terminate(); p.join(5)
            s = Store(path); self.assertEqual(before, s.snapshot()); s.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
