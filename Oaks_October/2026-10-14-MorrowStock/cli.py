"""Local durable SQLite mode. No hosted/shared database is implied."""
import argparse
from contextlib import closing
import json
import sqlite3
import sys

from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.types import Command
from agent import initial_state, make_agent
from core import Store


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--db", required=True, help="Local SQLite WAL path")
    sub = p.add_subparsers(dest="action", required=True)
    op = sub.add_parser("apply", help="Apply one idempotent JSON operation")
    op.add_argument("file", help="JSON operation path, or - for stdin")
    sub.add_parser("inspect"); sub.add_parser("solve"); sub.add_parser("export")
    agent = sub.add_parser("agent", help="Run one model decision, continue a checkpoint or close review")
    agent.add_argument("run_id"); agent.add_argument("--goal")
    agent.add_argument("--review", action="store_true")
    args = p.parse_args()
    with closing(Store(args.db)) as store:
        if args.action == "apply":
            if args.file == "-":
                data = sys.stdin.read(65537)
            else:
                with open(args.file, encoding="utf-8") as f:
                    data = f.read(65537)
            if len(data) > 65536:
                raise ValueError("Operation exceeds 64 KiB")
            result = store.execute(json.loads(data))
        elif args.action in {"inspect", "export"}:
            result = store.snapshot()
        elif args.action == "solve":
            result = store.solve()
        else:
            with closing(sqlite3.connect(args.db + ".checkpoints", check_same_thread=False)) as checkpoints:
                graph = make_agent(store, SqliteSaver(checkpoints))
                config = {"configurable": {"thread_id": args.run_id}}
                if args.goal:
                    if graph.get_state(config).values:
                        raise ValueError("Investigation already exists")
                    graph.invoke(initial_state(args.goal, store.version), config)
                elif graph.get_state(config).next:
                    graph.invoke(Command(resume="review" if args.review else "continue"), config)
                else:
                    raise ValueError("No open checkpoint; provide --goal for a new investigation")
                result = graph.get_state(config).values
        print(json.dumps(result, indent=2, allow_nan=False))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, TypeError, KeyError, sqlite3.Error) as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(2)
