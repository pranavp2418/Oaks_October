# Lintel — implementation in progress

A synthetic permit-readiness investigator. It compiles AND/OR prerequisite graphs into exact minimal missing-evidence frontiers, compares cost and critical-path deadline impact, traces conflicting sources and supports a reviewed readiness dossier. It does not file permits, contact authorities or provide legal advice.

Current verified slice: Python compiler, SQLite optimistic transactions/idempotency and hash-linked audit export, real LangGraph/SQLite checkpoint interruption and restart, real LangChain read-only tools, deterministic bounded investigation policy, and exact evidence-bound human review. The Gateway adapter checks current zero model prices before inference; no live Lintel model call has been verified yet. No UI or deployment is claimed by this checkpoint.

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m unittest discover -s tests -v
```

`data/sample.json` is entirely synthetic, fixture seed 151026. Rules, costs and durations are illustrative and are not real jurisdiction requirements. The test generator uses the same recorded seed for 400 independently enumerated Boolean truth-table comparisons. All amounts are illustrative integer cost units.

Local SQLite persists project revisions, operations and audit receipts. `Workspace.mutate` uses `BEGIN IMMEDIATE`, expected revisions and request hashes. An identical key/payload returns its original result; changed payloads conflict. Evidence changes invalidate proposals and prepared dossiers. Local callers must provide authenticated transport before treating the `role` argument as an identity boundary: the module alone is not a login system. Agent tools are read-only; human mutations are separate operations. Audit hashes detect tested corruption; they are not digital signatures or protection from a database administrator rewriting the entire chain.

`Investigation` persists real LangGraph checkpoints in SQLite and interrupts for review. Reopening the database resumes that checkpoint. Four tool decisions bound execution. Invalid tools, arguments, unsupported evidence and empty unsupported conclusions fail closed. Deterministic mode is explicitly identified; live mode uses `AI_GATEWAY_API_KEY`, request-scoped Vercel OIDC, or `VERCEL_OIDC_TOKEN` by name only. No paid fallback is permitted. Provider data is synthetic only.

Remaining release gates: HTTP authorization/session model, hosted persistence semantics, Angular UI, broader recovery/adversarial tests and benchmarks, clean-environment verification, desktop/mobile accessibility QA, real hosted model/workflow verification, sequential source release, launch film and portfolio integration. See `ACCEPTANCE.md`. This slice is not a completed daily product.
