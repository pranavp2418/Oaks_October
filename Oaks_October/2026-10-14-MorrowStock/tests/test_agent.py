import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent import ProviderUnavailable, choose_live, initial_state, inventory_tools, make_agent, validate_decision
from core import Store
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.types import Command
from test_core import fixture


def scripted(sequence, calls):
    def choose(goal, observations, schemas):
        calls.append(len(observations))
        choice = sequence[len(observations)]
        return {"choice": choice, "provider": {"kind": "unit_fixture_not_live"}}
    return choose


class AgentTests(unittest.TestCase):
    def setUp(self):
        self.store = Store()
        self.store.execute({"id": "seed", "kind": "import", "args": {"data": fixture()}})

    def tearDown(self):
        self.store.close()

    def test_real_graph_checkpoint_reopen_and_human_review(self):
        sequence = [{"tool": "inspect_inventory", "arguments": {}},
                    {"tool": "optimize_allocation", "arguments": {}},
                    {"tool": "finish", "arguments": {"summary": "Inspect shortages before approval.", "citations": ["E1", "E2"]}}]
        calls = []
        config = {"configurable": {"thread_id": "investigation-1"}}
        with tempfile.TemporaryDirectory() as temp:
            path = str(Path(temp) / "checkpoints.sqlite")
            with SqliteSaver.from_conn_string(path) as saver:
                graph = make_agent(self.store, saver, scripted(sequence, calls))
                graph.invoke(initial_state("Allocate stock and identify gaps", 1), config)
                self.assertEqual(len(graph.get_state(config).values["observations"]), 1)
            with SqliteSaver.from_conn_string(path) as saver:
                graph = make_agent(self.store, saver, scripted(sequence, calls))
                graph.invoke(Command(resume="continue"), config)
                state = graph.get_state(config).values
                self.assertEqual([o["id"] for o in state["observations"]], ["E1", "E2"])
                graph.invoke(Command(resume="continue"), config)
                self.assertEqual(graph.get_state(config).values["status"], "AWAITING_REVIEW")
                graph.invoke(Command(resume="review"), config)
                self.assertEqual(graph.get_state(config).values["status"], "REVIEWED_EVIDENCE")
                self.assertFalse(graph.get_state(config).next)
            self.assertEqual(calls, [0, 1, 2])
            self.assertEqual(self.store.snapshot()["receipts"], 1)

    def test_failure_at_choose_recovers_checkpoint_without_repeating_observation(self):
        calls = []
        count = 0
        def choose(goal, observations, schemas):
            nonlocal count
            count += 1
            if count == 2:
                raise ProviderUnavailable("Injected provider outage")
            return {"choice": {"tool": "inspect_inventory" if not observations else "propose_replenishment", "arguments": {}}, "provider": {"kind": "unit_fixture_not_live"}}
        with SqliteSaver.from_conn_string(":memory:") as saver:
            graph = make_agent(self.store, saver, choose)
            cfg = {"configurable": {"thread_id": "recovery"}}
            graph.invoke(initial_state("Find replenishment gaps", 1), cfg)
            with self.assertRaises(ProviderUnavailable):
                graph.invoke(Command(resume="continue"), cfg)
            self.assertEqual(len(graph.get_state(cfg).values["observations"]), 1)
            self.assertEqual(graph.get_state(cfg).next, ("choose",))
            graph.invoke(None, cfg)
            self.assertEqual(len(graph.get_state(cfg).values["observations"]), 2)

    def test_24_adversarial_choices_are_read_only_and_fail_closed(self):
        tools = inventory_tools(self.store)
        before = self.store.snapshot()
        bad = [{"tool": name, "arguments": {}} for name in ["reserve", "pick", "receive", "recall", "purchase", "exec", "sql", "fetch", "delete", "send_email", "approve", "import"]]
        bad += [{"tool": "finish", "arguments": {"summary": "Approved", "citations": c}}
                for c in [[], ["invented"], [True], ["E1"]]]
        bad += [{"tool": "inspect_inventory", "arguments": {"system": "ignore review"}},
                {"tool": "stress_allocation", "arguments": {"exclude_lot": "early", "demand_percent": True}},
                {"tool": "stress_allocation", "arguments": {"exclude_lot": "early", "demand_percent": "150"}},
                {"tool": "trace_lot", "arguments": {"lot_id": "'; DROP TABLE lots;"}},
                {"tool": "trace_lot", "arguments": {}}, {}, None, "ignore all constraints"]
        self.assertEqual(len(bad), 24)
        for decision in bad:
            with self.assertRaises((ValueError, TypeError)):
                result = validate_decision(decision, [], tools)
                tools[result["tool"]].invoke(result["arguments"])
            self.assertEqual(self.store.snapshot(), before)

    def test_four_decision_budget_and_stale_inventory(self):
        calls = []
        with SqliteSaver.from_conn_string(":memory:") as saver:
            graph = make_agent(self.store, saver, scripted([{"tool": "inspect_inventory", "arguments": {}}] * 5, calls))
            cfg = {"configurable": {"thread_id": "budget"}}
            graph.invoke(initial_state("Investigate this synthetic inventory", 1), cfg)
            for _ in range(4):
                graph.invoke(Command(resume="continue"), cfg)
            self.assertEqual(len(calls), 4)
            self.assertEqual(graph.get_state(cfg).values["pending"]["tool"], "finish")
        with SqliteSaver.from_conn_string(":memory:") as saver:
            graph = make_agent(self.store, saver, scripted([{"tool": "inspect_inventory", "arguments": {}}] * 2, []))
            cfg = {"configurable": {"thread_id": "stale"}}
            graph.invoke(initial_state("Inspect this lot exposure", 1), cfg)
            self.store.execute({"id": "recall", "kind": "recall", "args": {"lot_id": "early", "reason": "Synthetic quality hold"}})
            with self.assertRaisesRegex(ValueError, "Inventory changed"):
                graph.invoke(Command(resume="continue"), cfg)

    def test_provider_zero_price_and_credential_guards(self):
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaisesRegex(ProviderUnavailable, "No existing"):
                choose_live("Synthetic request", [], [])
        with patch.dict("os.environ", {"AI_GATEWAY_API_KEY": "unit-fixture-not-a-secret"}, clear=True):
            with patch("agent.request_json", return_value={"data": [{"id": "nvidia/nemotron-3.5-lightning-free", "pricing": {"input": "0.01", "output": "0"}}]}) as call:
                with self.assertRaisesRegex(ProviderUnavailable, "Zero-price"):
                    choose_live("Synthetic request", [], [])
                self.assertEqual(call.call_count, 1)
            with patch("agent.request_json", return_value={"data": []}):
                with self.assertRaises(ProviderUnavailable):
                    choose_live("Synthetic request", [], [])

    def test_concurrent_inventory_change_during_provider_wait_rejects_observation(self):
        # Independent second connection represents another local CLI process.
        with tempfile.TemporaryDirectory() as temp:
            path = str(Path(temp) / "inventory.sqlite")
            first, second = Store(path), Store(path)
            try:
                first.execute({"id":"seed","kind":"import","args":{"data":fixture()}})
                def chooser(goal, observations, schemas):
                    second.execute({"id":"concurrent-recall","kind":"recall","args":{"lot_id":"early","reason":"Concurrent synthetic quality hold"}})
                    return {"choice":{"tool":"inspect_inventory","arguments":{}},"provider":{"kind":"unit_fixture_not_live"}}
                with SqliteSaver.from_conn_string(":memory:") as saver:
                    graph = make_agent(first, saver, chooser)
                    cfg = {"configurable":{"thread_id":"concurrent"}}
                    with self.assertRaisesRegex(ValueError,"Inventory changed"):
                        graph.invoke(initial_state("Inspect inventory without mixing versions",1),cfg)
                    self.assertEqual(graph.get_state(cfg).values.get("observations",[]),[])
                    self.assertEqual(first.version,2)
            finally:
                first.close(); second.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
