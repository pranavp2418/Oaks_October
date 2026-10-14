"""Bounded incident evidence retrieval and real checkpointed review.

The hosted trust boundary is validated JSON. Opaque checkpoint/database uploads
are deliberately unsupported. Server-local SQLite is materialized from the
browser journal; it is not a hosted shared database.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import sqlite3
import time
from collections import Counter, deque
from typing import TypedDict

from langchain_core.runnables import RunnableLambda
from langgraph.graph import END, START, StateGraph
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.types import Command, interrupt

MAX_DOCS = 96
MAX_OPS = 48
MAX_BYTES = 131072


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def identifier(value, size=64):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1," + str(size) + r"}", value):
        raise ValueError("Use a bounded alphanumeric identifier.")
    return value


def text(value, size=2000):
    if not isinstance(value, str) or not value.strip() or len(value) > size:
        raise ValueError(f"Text must contain 1–{size} characters.")
    return value.strip()


def validate_evidence(bundle):
    if not isinstance(bundle, dict) or bundle.get("schema") != 1:
        raise ValueError("Evidence schema 1 is required.")
    docs = bundle.get("documents")
    if not isinstance(docs, list) or not 1 <= len(docs) <= MAX_DOCS:
        raise ValueError("Import 1–96 evidence documents.")
    result = []
    ids = set()
    for doc in docs:
        if not isinstance(doc, dict):
            raise ValueError("Each document must be an object.")
        did = identifier(doc.get("id"))
        if did in ids:
            raise ValueError("Duplicate document ID.")
        ids.add(did)
        entities, links = doc.get("entities", []), doc.get("links", [])
        if not isinstance(entities, list) or len(entities) > 8:
            raise ValueError("Use at most eight entities per source.")
        if not isinstance(links, list) or len(links) > 12:
            raise ValueError("Use at most twelve links per source.")
        supersedes = doc.get("supersedes")
        if supersedes is not None:
            identifier(supersedes)
        claim = doc.get("claim")
        if claim is not None:
            if not isinstance(claim, dict) or set(claim) != {"key", "value"}:
                raise ValueError("Claims need a key and value.")
            claim = {"key": text(claim["key"], 80), "value": text(claim["value"], 160)}
        result.append({"id": did, "title": text(doc.get("title"), 120),
                       "body": text(doc.get("body")), "entities": sorted(set(text(e, 64).lower() for e in entities)),
                       "links": sorted(set(identifier(link) for link in links)),
                       "supersedes": supersedes, "claim": claim})
    by_id = {d["id"]: d for d in result}
    for doc in result:
        if any(link not in ids for link in doc["links"]) or (doc["supersedes"] and doc["supersedes"] not in ids):
            raise ValueError("Every link and superseded ID must exist in the import.")
        chain = set()
        cursor = doc["id"]
        while cursor:
            if cursor in chain:
                raise ValueError("Supersession cycle rejected.")
            chain.add(cursor)
            cursor = by_id[cursor]["supersedes"]
    return {"schema": 1, "documents": sorted(result, key=lambda d: d["id"])}


def tokens(value):
    return re.findall(r"[a-z0-9]+", value.lower())


def retrieve(payload):
    """BM25 seed ranking + two-hop deterministic evidence/explicit entity graph.

    An entity match is only a discovery edge, never causal evidence. Returned
    paths retain the actual edge type so the dossier cannot imply causality.
    """
    docs, query = payload["documents"], payload["query"]
    if payload.get("fail"):
        raise RuntimeError("Injected retrieval interruption; checkpoint retained.")
    superseded = {d["supersedes"] for d in docs if d["supersedes"]}
    active = [d for d in docs if d["id"] not in superseded]
    by_id = {d["id"]: d for d in active}
    terms = set(tokens(query))
    bags = {d["id"]: Counter(tokens(d["title"] + " " + d["body"] + " " + " ".join(d["entities"]))) for d in active}
    average = sum(sum(b.values()) for b in bags.values()) / max(1, len(active))
    frequency = {term: sum(term in bag for bag in bags.values()) for term in terms}
    ranked = []
    for doc in active:
        bag = bags[doc["id"]]
        length = sum(bag.values())
        score = 0.0
        for term in terms:
            count = bag[term]
            if count:
                idf = math.log(1 + (len(active) - frequency[term] + .5) / (frequency[term] + .5))
                score += idf * count * 2.2 / (count + 1.2 * (.25 + .75 * length / max(1, average)))
        if score > 0:
            ranked.append((score, doc["id"]))
    ranked.sort(key=lambda item: (-item[0], item[1]))
    seeds = [did for _, did in ranked[:3]]
    adjacency = {d["id"]: [] for d in active}
    for doc in active:
        for link in doc["links"]:
            if link in by_id:
                adjacency[doc["id"]].append((link, "explicit link"))
                adjacency[link].append((doc["id"], "reverse link"))
        for other in active:
            if doc["id"] != other["id"] and set(doc["entities"]) & set(other["entities"]):
                adjacency[doc["id"]].append((other["id"], "shared entity"))
    paths = {did: [{"id": did, "via": "lexical seed"}] for did in seeds}
    queue = deque(seeds)
    while queue and len(paths) < 24:
        current = queue.popleft()
        if len(paths[current]) >= 3:
            continue
        for nxt, edge in sorted(set(adjacency[current])):
            if nxt not in paths and len(paths) < 24:
                paths[nxt] = paths[current] + [{"id": nxt, "via": edge}]
                queue.append(nxt)
    hits = [{"id": did, "title": by_id[did]["title"], "quote": by_id[did]["body"],
             "path": paths[did], "claim": by_id[did]["claim"], "score": round(dict((did, score) for score, did in ranked).get(did, 0), 4)}
            for did in sorted(paths, key=lambda did: (len(paths[did]), did))]
    return {"hits": hits, "lexical_ids": seeds, "excluded_superseded": sorted(superseded),
            "active_sources": len(active), "graph_edges": sum(len(a) for a in adjacency.values())}


def synthesise(result):
    claims = {}
    for hit in result["hits"]:
        if hit["claim"]:
            claims.setdefault(hit["claim"]["key"], []).append({"id": hit["id"], "value": hit["claim"]["value"]})
    contradictions = [{"key": key, "sources": values} for key, values in sorted(claims.items())
                      if len({v["value"] for v in values}) > 1]
    return {**result, "contradictions": contradictions,
            "sentences": [{"citation": h["id"], "quote": h["quote"]} for h in result["hits"]],
            "mode": "Extractive evidence dossier; no LLM or causal inference", "publishable": bool(result["hits"])}


def check_citations(dossier, docs):
    by_id = {d["id"]: d for d in docs}
    superseded = {d["supersedes"] for d in docs if d["supersedes"]}
    for sentence in dossier["sentences"]:
        source = by_id.get(sentence["citation"])
        if not source or source["id"] in superseded or sentence["quote"] != source["body"]:
            raise ValueError("Citation check failed: current exact source required.")
    return True


PIPELINE = RunnableLambda(retrieve, name="bounded_evidence_retrieval") | RunnableLambda(synthesise, name="exact_quote_dossier")


class Investigation(TypedDict, total=False):
    query: str
    documents: list
    digest: str
    fail: bool
    dossier: dict
    status: str
    decision: dict


def build_graph(connection):
    def search(state):
        dossier = PIPELINE.invoke(state)
        check_citations(dossier, state["documents"])
        return {"dossier": dossier, "status": "awaiting_review" if dossier["publishable"] else "no_evidence"}

    def review(state):
        answer = interrupt({"kind": "evidence_review", "digest": state["digest"],
                            "citations": len(state["dossier"]["sentences"]),
                            "contradictions": len(state["dossier"]["contradictions"])})
        if not isinstance(answer, dict):
            raise ValueError("A structured review is required.")
        reviewer = identifier(answer.get("reviewer"))
        note = text(answer.get("note"), 500)
        if answer.get("action") not in {"approve", "reject"}:
            raise ValueError("Approve or reject the dossier.")
        if answer["action"] == "approve" and state["dossier"]["contradictions"] and answer.get("acknowledge") is not True:
            raise ValueError("Acknowledge unresolved contradictions before publishing.")
        return {"decision": {"action": answer["action"], "reviewer": reviewer, "note": note},
                "status": "approved" if answer["action"] == "approve" else "rejected"}

    def publish(state):
        check_citations(state["dossier"], state["documents"])
        return {"status": "published"}

    graph = StateGraph(Investigation)
    graph.add_node("retrieve", search)
    graph.add_node("review", review)
    graph.add_node("publish", publish)
    graph.add_edge(START, "retrieve")
    graph.add_conditional_edges("retrieve", lambda state: "review" if state["dossier"]["publishable"] else END)
    graph.add_conditional_edges("review", lambda state: "publish" if state["decision"]["action"] == "approve" else "review")
    graph.add_edge("publish", END)
    return graph.compile(checkpointer=SqliteSaver(connection))


class Workspace:
    """A local single-writer engine; public requests reconstruct from a journal."""
    def __init__(self, path=":memory:"):
        self.connection = sqlite3.connect(path, check_same_thread=False)
        self.connection.execute("PRAGMA foreign_keys=ON")
        self.connection.execute("PRAGMA synchronous=FULL")
        self.connection.executescript("""
            CREATE TABLE IF NOT EXISTS evidence(id TEXT PRIMARY KEY, body TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS metadata(id INTEGER PRIMARY KEY,revision INTEGER NOT NULL,digest TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS investigations(id TEXT PRIMARY KEY,digest TEXT NOT NULL,query TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,request TEXT NOT NULL,response TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY,id TEXT NOT NULL,operation TEXT NOT NULL,previous TEXT NOT NULL,hash TEXT NOT NULL);
            PRAGMA user_version=1;
        """)
        self.graph = build_graph(self.connection)

    def close(self):
        self.connection.close()

    def evidence(self):
        return [json.loads(row[0]) for row in self.connection.execute("SELECT body FROM evidence ORDER BY id")]

    def snapshot(self):
        meta = self.connection.execute("SELECT revision,digest FROM metadata WHERE id=1").fetchone()
        runs = []
        for rid, source_digest, query in self.connection.execute("SELECT id,digest,query FROM investigations ORDER BY rowid DESC"):
            state = self.graph.get_state({"configurable": {"thread_id": rid}})
            values = state.values
            status = values.get("status", "failed")
            if any(task.error for task in state.tasks):
                status = "failed"
            if source_digest != (meta[1] if meta else None):
                status = "stale"
            runs.append({"id": rid, "query": query, "digest": source_digest, "status": status,
                         "dossier": values.get("dossier"), "decision": values.get("decision"),
                         "pending_nodes": list(state.next), "checkpoint": state.config.get("configurable", {}).get("checkpoint_id")})
        audit = [{"sequence": row[0], "id": row[1], "operation": row[2], "hash": row[4]} for row in self.connection.execute("SELECT * FROM audit ORDER BY seq")]
        return {"schema": 1, "revision": meta[0] if meta else 0, "digest": meta[1] if meta else None,
                "documents": self.evidence(), "runs": runs, "audit": audit,
                "limits": {"documents": MAX_DOCS, "operations": MAX_OPS, "request_bytes": MAX_BYTES},
                "persistence": "Browser-owned journal → real request-local SQLite/LangGraph checkpoints"}

    def execute(self, operation):
        if not isinstance(operation, dict):
            raise ValueError("Operation must be an object.")
        oid = identifier(operation.get("id"))
        request = canonical(operation)
        receipt = self.connection.execute("SELECT request,response FROM receipts WHERE id=?", (oid,)).fetchone()
        if receipt:
            if receipt[0] != request:
                raise ValueError("Conflicting operation ID.")
            return json.loads(receipt[1])
        count = self.connection.execute("SELECT count(*) FROM receipts").fetchone()[0]
        if count >= MAX_OPS:
            raise ValueError("Workspace operation limit reached. Export and start a new workspace.")
        kind = operation.get("type")
        before = self.snapshot()
        if operation.get("expected") != before["revision"]:
            raise ValueError("Workspace revision changed. Reload before retrying.")
        revision = before["revision"] + 1
        if kind == "import":
            bundle = validate_evidence(operation.get("bundle"))
            self.connection.execute("DELETE FROM evidence")
            self.connection.executemany("INSERT INTO evidence VALUES(?,?)", [(d["id"], canonical(d)) for d in bundle["documents"]])
            self.connection.execute("INSERT OR REPLACE INTO metadata VALUES(1,?,?)", (revision, digest(bundle)))
        elif kind == "investigate":
            query = text(operation.get("query"), 240)
            if not before["digest"]:
                raise ValueError("Import evidence first.")
            rid = "run-" + oid
            self.connection.execute("INSERT INTO investigations VALUES(?,?,?)", (rid, before["digest"], query))
            self.connection.commit()
            try:
                self.graph.invoke({"query": query, "documents": before["documents"], "digest": before["digest"],
                                   "fail": operation.get("fail") is True}, {"configurable": {"thread_id": rid}})
            except RuntimeError as error:
                if "Injected retrieval" not in str(error):
                    raise
        elif kind in {"retry", "review"}:
            rid = identifier(operation.get("run"), 68)
            run = next((r for r in before["runs"] if r["id"] == rid), None)
            if not run or run["status"] == "stale":
                raise ValueError("A current investigation is required; evidence changed.")
            config = {"configurable": {"thread_id": rid}}
            if kind == "retry":
                if run["status"] != "failed":
                    raise ValueError("Only a failed retrieval can be retried.")
                self.graph.update_state(config, {"fail": False})
                self.graph.invoke(None, config)
            else:
                if run["status"] not in {"awaiting_review", "rejected"}:
                    raise ValueError("This investigation is not awaiting review.")
                answer = {key: operation.get(key) for key in ("action", "reviewer", "note", "acknowledge")}
                # Validate before invoking so a rejected command cannot poison a checkpoint.
                identifier(answer["reviewer"])
                text(answer["note"], 500)
                if answer["action"] not in {"approve", "reject"}:
                    raise ValueError("Choose approve or reject.")
                if answer["action"] == "approve" and run["dossier"]["contradictions"] and answer["acknowledge"] is not True:
                    raise ValueError("Acknowledge unresolved contradictions before publishing.")
                self.graph.invoke(Command(resume=answer), config)
        else:
            raise ValueError("Unknown operation.")
        if kind != "import":
            self.connection.execute("UPDATE metadata SET revision=? WHERE id=1", (revision,))
        previous = self.connection.execute("SELECT hash FROM audit ORDER BY seq DESC LIMIT 1").fetchone()
        prior = previous[0] if previous else "0" * 64
        head = digest({"previous": prior, "request": operation, "revision": revision})
        self.connection.execute("INSERT INTO audit(id,operation,previous,hash) VALUES(?,?,?,?)", (oid, kind, prior, head))
        response = {"id": oid, "revision": revision, "audit_hash": head}
        self.connection.execute("INSERT INTO receipts VALUES(?,?,?)", (oid, request, canonical(response)))
        self.connection.commit()
        return response


def materialize(payload):
    started = time.perf_counter()
    if len(canonical(payload).encode()) > MAX_BYTES:
        raise ValueError("Request exceeds 128 KiB.")
    if not isinstance(payload, dict) or payload.get("schema") != 1:
        raise ValueError("Workspace schema 1 is required.")
    journal = payload.get("journal", [])
    if not isinstance(journal, list) or len(journal) > MAX_OPS:
        raise ValueError("Use at most 48 journal operations.")
    workspace = Workspace()
    try:
        for operation in journal:
            workspace.execute(operation)
        response = None
        if payload.get("operation") is not None:
            response = workspace.execute(payload["operation"])
        result = workspace.snapshot()
        result["receipt"] = response
        result["elapsed_ms"] = round((time.perf_counter() - started) * 1000, 2)
        return result
    finally:
        workspace.close()
