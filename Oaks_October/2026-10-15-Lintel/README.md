# Lintel — implementation in progress

A synthetic permit-readiness investigator. It compiles AND/OR prerequisite graphs into exact minimal missing-evidence frontiers, compares cost and critical-path deadline impact, traces conflicting sources and supports a reviewed readiness dossier. It does not file permits, contact authorities or provide legal advice.

Current verified slice: Python compiler, SQLite optimistic transactions/idempotency and hash-linked audit export, real LangGraph/SQLite checkpoint interruption and restart, real LangChain read-only tools, deterministic bounded investigation policy, and exact evidence-bound human review. The Gateway adapter checks current zero model prices before inference. One live synthetic hosted development case selected actual readiness/comparison tools and paused for review; no broad or held-out model accuracy claim. An Angular operator UI and request-local hosted API are implemented. The first hosted API development case passed real zero-price tool selection, but the initial JIT production UI failed; the replacement AOT build is awaiting deployed browser verification. No complete product or launch-film delivery is claimed.

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m unittest discover -s tests -v
```

`data/sample.json` is entirely synthetic, fixture seed 151026. Rules, costs and durations are illustrative and are not real jurisdiction requirements. The test generator uses the same recorded seed for 400 independently enumerated Boolean truth-table comparisons. All amounts are illustrative integer cost units.

Local SQLite persists project revisions, operations and audit receipts. `Workspace.mutate` uses `BEGIN IMMEDIATE`, expected revisions and request hashes. An identical key/payload returns its original result; changed payloads conflict. Evidence changes invalidate proposals and prepared dossiers. Local callers must provide authenticated transport before treating the `role` argument as an identity boundary: the module alone is not a login system. Agent tools are read-only; human mutations are separate operations. Audit hashes detect tested corruption; they are not digital signatures or protection from a database administrator rewriting the entire chain.

`Investigation` persists real LangGraph checkpoints in SQLite and interrupts for review. Reopening the database resumes that checkpoint. Four tool decisions bound execution. Invalid tools, arguments, unsupported evidence and empty unsupported conclusions fail closed. Deterministic mode is explicitly identified; live mode uses `AI_GATEWAY_API_KEY`, request-scoped Vercel OIDC, or `VERCEL_OIDC_TOKEN` by name only. No paid fallback is permitted. Provider data is synthetic only.

Hosted persistence is a visitor-owned IndexedDB journal, transactionally fenced against stale tabs, replayed into request-local SQLite. It is not a shared database or separate reviewer identity. Human review explicitly approves only the visitor’s own synthetic notebook. Agent checkpoint restoration reruns allowlisted read-only tools and recomputes the report, without deserializing client code/database files or rerunning model inference.

Remaining release gates: verify replacement AOT UI live, expand desktop/mobile keyboard/reduced-motion and cross-tab checks, complete formal reviews, clean-environment verification, additional live model/adversarial cases, launch film and portfolio integration. See `ACCEPTANCE.md`. This slice is not a completed daily product.


## Launch film

[Watch the launch film](https://github.com/pranavp2418/Oaks_October/releases/download/agent-product-films-v1/lintel-launch.mp4) · [Native4K master](https://github.com/pranavp2418/Oaks_October/releases/download/agent-product-films-v1/lintel-launch-4k.mp4) · [Sources, provenance and final QA](launch/FINAL_QA.md). Actual synthetic workflow, edited for time. Application release gates remain separately recorded.
