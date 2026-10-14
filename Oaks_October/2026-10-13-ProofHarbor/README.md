# ProofHarbor

An original incident-investigation workbench: import evidence, inspect its links, ask a bounded question, review exact quotations and conflicting claims, recover a failed investigation and export the portable dossier. Original synthetic fixture seed 13102026. No external model, device or remediation tool is called.

## Complete workflow

1. Import synthetic evidence or a schema-1 JSON bundle. Sources have IDs, titles, text, entities, explicit links, optional supersession and optional key/value claims. Every reference must exist; supersession cycles reject. Saving different evidence makes old investigations stale.
2. Ask about gateway release routing. A real LangChain Runnable pipeline performs BM25 lexical ranking, then bounded two-hop traversal over explicit/reverse links and shared-entity discovery edges. Inspect every returned path and its edge type. Shared entities and timing are discovery context, not proof of causality.
3. The dossier quotes each current source exactly. Superseded documents cannot support current conclusions. Contradictory current claims remain visible; no model selects a winner. No-evidence questions cannot publish.
4. Real LangGraph retrieves and stops at a human-review interrupt backed by SqliteSaver. Record a reviewer/note; approve to publish or reject to leave another review interrupt. Approval must acknowledge unresolved contradictions. Reviewer labels are recorded local workflow data, not authenticated identities or RBAC.
5. Inject a retrieval failure, reload the browser and resume its checkpoint. The actual failed graph node is rerun with the failure injection cleared. Successful publication has citation validation before and after review. It does not execute a mitigation.
6. Inspect SHA-256 evidence binding, accepted-operation audit hashes and checkpoint status. Export a compact portable journal and a separate evidence dossier. Restore the compact workspace file to reconstruct the same review state; dossier exports may be larger and are for inspection.

## Architecture and storage boundary

Angular 22 uses ahead-of-time compilation, signals and a real IndexedDB transaction for the browser journal. Atomic compare-before-write rejects a response if another tab changed the saved journal while its API request was running. Network errors, timeouts and rejected commands never append to that journal. BroadcastChannel notifications trigger a fresh reconstruction. Clearing browser storage removes this origin's workspace; exports are the portable backup.

Python `api/workspace.py` receives only bounded schema-validated JSON. `core.py` replays that journal into real request-local SQLite evidence/investigation/receipt tables and real LangGraph SQLite checkpoints, then performs one additional command. Hosted state is browser-owned, **not a persistent shared remote database**. The native Workspace engine also supports a local database file; tests close it and use a separate process to resume the same persisted checkpoint. Native engine is single-writer; it makes no multiprocess database-service claim. Arbitrary SQLite/pickle/checkpoint uploads are unsupported.

The custom retrieval core normalizes tokens, computes BM25 seed scores, discovers evidence through at most two graph hops, caps results at 24 and records provenance. A real LangChain Runnable composition joins retrieval and quote-only synthesis. LangGraph's review interrupt and Command resume implement the actual workflow. This is lexical/graph retrieval-augmented extractive synthesis, **not vector search, embeddings or an LLM integration**. No OpenAI/API or model proficiency is inferred from these dependencies.

Safety bounds: 96 documents, 2,000 characters per body, eight entities/twelve explicit links per document, 240-character query, 48 accepted operations, 128 KiB API request and a 45-second browser timeout. API reconstructs requests independently; no account authentication is required for the synthetic single-user demonstration. Do not import private production incident logs into the public demo. Audit hashes are unkeyed integrity evidence, not authenticated or tamper-proof attestations.

## Run and verify

Requires Node 24, Python 3.12+ and pinned dependencies:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm ci --ignore-scripts
.venv/bin/python -m unittest discover -s tests -v
npm run build
```

`npm run build` uses Angular's official AOT application builder with strict template checking and a 650 kB initial-size error budget. Production output is `dist/`. Vercel serves that output and the actual Python function in `api/workspace.py`. No API secrets or paid services are required. `tests/benchmark.json` contains 3 warmups/20 repeated journal reconstructions: median 37.13 ms, p95 43.18 ms for 9 source documents and 8 investigations on the recorded container. These are local measurements, not hosted latency claims.

## Evidence and limits

Eight Python test groups: 50 independent Floyd–Warshall graph comparisons; invalid/cyclic imports; multi-hop discovery; missing/superseded/invented citation refusal; real failed-node checkpoint, process restart and recovery; maximum-length identifiers; rejected/repeated review; evidence revision invalidation; duplicate ID conflict; no-evidence refusal; deterministic audit replay and request bounds.

`tests/retrieval-evaluation.json` records five independently specified synthetic questions. Four supported queries reach every listed relevant source after graph expansion; lexical top-3 alone misses two linked paths. Expansion also returns unrelated connected sources: these data are not a general retrieval-quality benchmark or statistical claim. Future work includes larger held-out corpora, stricter topic reranking and authenticated shared operations, but these are not claimed as implemented.

Browser/public-release evidence is recorded separately in VERIFICATION.json; pending entries are not passes. UI provenance in UI_PROVENANCE.md names actual Realtime Colors exploration, exported Haikei asset and Angular-native reduced-motion transitions.

[Source](https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-13-ProofHarbor) · [Demo](https://proofharbor-20261013.vercel.app/)

Original code, cover and synthetic data: MIT. Third-party packages retain their own licenses; no hiring-company branding, data or affiliation.
