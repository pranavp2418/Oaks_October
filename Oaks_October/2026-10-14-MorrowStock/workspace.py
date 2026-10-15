"""Validated JSON journal boundary; opaque SQLite/checkpoint uploads are forbidden."""
from copy import deepcopy
import sqlite3

from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.types import Command
from agent import ProviderUnavailable, choose_live, initial_state, make_agent
from core import Store, digest, ident, packed

MAX_BYTES = 262144
MAX_OPS = 80
STOCK_KINDS = {"import", "plan", "review", "reserve", "pick", "release", "recall", "purchase", "review_purchase", "receive"}
AGENT_KINDS = {"agent_start", "agent_continue", "agent_review"}


def envelope(entry, restored=False):
    if not isinstance(entry, dict) or not {"id", "kind", "args"} <= set(entry):
        raise ValueError("Journal entries require id, kind and args")
    extra = {"decision"} if restored else {"inject_failure", "fail_before_commit"}
    if set(entry) - {"id", "kind", "args"} - extra:
        raise ValueError("Unexpected journal entry fields")
    ident(entry["id"])
    if entry["kind"] not in STOCK_KINDS | AGENT_KINDS or not isinstance(entry["args"], dict):
        raise ValueError("Unknown operation or invalid arguments")
    if len(packed(entry)) > 65536:
        raise ValueError("Operation exceeds bounded size")
    return entry


def materialize(payload, live_chooser=choose_live):
    if not isinstance(payload, dict) or set(payload) - {"workspace", "command", "view", "scenario"}:
        raise ValueError("Invalid request fields")
    workspace = deepcopy(payload.get("workspace", {"schema": 1, "journal": []}))
    if not isinstance(workspace, dict) or set(workspace) != {"schema", "journal"} or type(workspace["schema"]) is not int or workspace["schema"] != 1:
        raise ValueError("Workspace schema 1 is required")
    journal = workspace["journal"]
    if not isinstance(journal, list) or len(journal) > MAX_OPS or len(packed(payload).encode()) > MAX_BYTES:
        raise ValueError("Workspace exceeds 80 operations or 256 KiB")
    store = Store()
    checkpoint_db = sqlite3.connect(":memory:", check_same_thread=False)
    saver = SqliteSaver(checkpoint_db)
    graphs, seen, current_choice = {}, {}, []

    def replay_choice(goal, observations, schemas):
        if not current_choice:
            raise ValueError("Missing recorded decision; replay never calls a model")
        return current_choice.pop(0)

    def execute(entry, live=False):
        envelope(entry, restored=not live)
        kind, args = entry["kind"], entry["args"]
        if kind in STOCK_KINDS:
            return store.execute(entry)
        if set(args) != ({"run_id", "goal"} if kind == "agent_start" else {"run_id"}):
            raise ValueError("Invalid agent operation arguments")
        run_id = ident(args["run_id"])
        if kind == "agent_start":
            initial_state(args["goal"], store.version)
            if run_id in graphs or len(graphs) >= 8:
                raise ValueError("Duplicate investigation or eight-run limit reached")
            graphs[run_id] = make_agent(store, saver, replay_choice)
        elif run_id not in graphs:
            raise ValueError("Investigation not found")
        graph, config = graphs[run_id], {"configurable": {"thread_id": run_id}}
        prior = graph.get_state(config)
        if kind != "agent_start" and not prior.next:
            raise ValueError("Investigation is already closed")
        needs_decision = kind == "agent_start" or (kind == "agent_continue" and prior.values.get("pending", {}).get("tool") != "finish" and len(prior.values["decisions"]) < 4)
        if needs_decision:
            if live:
                if entry.get("inject_failure") is True:
                    raise ProviderUnavailable("Injected provider interruption; the saved checkpoint is unchanged")
                if kind != "agent_start" and prior.values["inventory_version"] != store.version:
                    raise ValueError("Inventory changed during investigation; start a new run")
                tools = make_agent_tools_schema(store)
                decision = live_chooser(args.get("goal", prior.values.get("goal", "")), prior.values.get("observations", []), tools)
                entry["decision"] = decision
            else:
                decision = entry.get("decision")
            if not isinstance(decision, dict) or set(decision) != {"choice", "provider"} or not isinstance(decision["provider"], dict):
                raise ValueError("Invalid recorded model decision")
            current_choice.append(decision)
        elif "decision" in entry:
            raise ValueError("Unexpected model decision for a review-only transition")
        if kind == "agent_start":
            graph.invoke(initial_state(args["goal"], store.version), config)
        else:
            graph.invoke(Command(resume="continue" if kind == "agent_continue" else "review"), config)
        if current_choice:
            raise ValueError("Unused recorded model decision")
        entry.pop("inject_failure", None)
        return {"run_id": run_id, "status": graph.get_state(config).values["status"]}

    try:
        for entry in journal:
            envelope(entry, restored=True)
            if entry["id"] in seen:
                raise ValueError("Duplicate journal operation ID")
            seen[entry["id"]] = entry
            execute(entry)
        command, receipt = payload.get("command"), None
        if command is not None:
            envelope(command)
            if command["id"] in seen:
                previous = seen[command["id"]]
                if digest({k: previous[k] for k in ("kind", "args")}) != digest({k: command[k] for k in ("kind", "args")}):
                    raise ValueError("Operation ID reused with different content")
                receipt = {"idempotent": True, "operation": command["id"]}
            else:
                if len(journal) == MAX_OPS:
                    raise ValueError("Journal operation limit reached; export and start another workspace")
                command = deepcopy(command)
                receipt = execute(command, live=True)
                command.pop("fail_before_commit", None)
                journal.append(command)
        agents = []
        for run_id, graph in graphs.items():
            state = graph.get_state({"configurable": {"thread_id": run_id}})
            agents.append({"id": run_id, **state.values, "checkpoint_pending": list(state.next),
                           "provenance_boundary": "Restored journal metadata is user-editable; provider identity is not a signed attestation"})
        scenario = payload.get("scenario", {})
        if not isinstance(scenario, dict) or set(scenario) - {"exclude_lot", "demand_percent"}:
            raise ValueError("Invalid scenario")
        result = {"workspace": workspace, "state": store.snapshot(), "agents": agents, "receipt": receipt,
                  "solution": store.solve(**scenario),
                  "boundary": "Single-user browser journal; request-local SQLite, no shared hosted database"}
        if len(packed(workspace).encode()) > MAX_BYTES:
            raise ValueError("Updated journal exceeds portable workspace bound; no save performed")
        return result
    finally:
        checkpoint_db.close(); store.close()


def make_agent_tools_schema(store):
    from agent import inventory_tools
    return [{"name": t.name, "description": t.description, "parameters": t.args_schema.model_json_schema()}
            for t in inventory_tools(store).values()]
