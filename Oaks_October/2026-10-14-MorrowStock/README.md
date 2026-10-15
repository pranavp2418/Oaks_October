# MorrowStock

A synthetic perishable-stock workbench: exact allocation, operator review, reservation and picking, recall containment, reviewed replenishment, and a bounded read-only investigation agent. This is an independently built portfolio product, not a real warehouse integration.

Source: https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-14-MorrowStock

Release status: **incomplete, live agent blocked**. The verification build at https://morrowstock-20261014.vercel.app/ serves the real stock core, but the actual model request returned `Gateway HTTP403: customer_verification_required; no paid fallback was attempted`. No billing method, credits or paid fallback was added. Full desktop/mobile/live-agent acceptance is unfinished. This is not a completed project or portfolio entry; see runs/2026-10-14-report.md at the repository root.

## Walkthrough

1. Load the synthetic workspace or import schema-validated lots/orders JSON. Inspect the conservation ribbon and priority-weighted shortages.
2. Compare excluded-lot / demand scenarios. Scenario evaluation never reserves inventory.
3. Create a baseline draft, write a review note and reserve its exact digest. Test a precommit interruption, then retry with the original inventory unchanged.
4. Pick individual lines. Recall an unpicked lot in Stock & exceptions: affected plans become blocked. Release unpicked reservations without erasing picked history.
5. Propose additional stock, review that proposal, then receive a synthetic lot. Inspect the changed allocation/shortage result.
6. Start a read-only agent investigation, inspect its tool observations, continue one decision at a time and close as reviewed evidence. Reloading a saved journal replays recorded decisions without a provider request. Maximum four decisions and eight investigations per workspace.
7. Export the portable operation journal and the evidence dossier. Inspect hash-linked stock receipts and exact model/tool observations. Restore only validated JSON, never uploaded SQLite files.

## Core and architecture

Python implements integral minimum-cost flow using successive shortest augmenting paths with reverse arcs and Bellman–Ford. Feasible edges require matching SKU and `arrival <= due <= expiry`. Cost is integer `3 * abs(location difference) + expiry - due`; explicit shortage arcs cost `1000 * priority` per case. Those are synthetic planning units, not a monetary valuation or an economic forecast.

SQLite WAL, foreign keys, `BEGIN IMMEDIATE`, receipt fingerprints and transaction-time invariants protect the local durable edition. Identical operation IDs are idempotent; conflicting bodies fail. Review requires a current inventory version and matching digest. No lot/order is overallocated; failed transactions change neither receipts, audit head nor stock. Recall blocks unpicked stock movement. Picked history is retained.

The web edition is explicitly **single-user and browser-persisted**, not a hosted multiuser database. IndexedDB compare-and-swap prevents a stale tab from overwriting a newer saved response. A Python serverless request reconstructs request-local SQLite and LangGraph state from a bounded journal. This makes deployable behavior honest without claiming ephemeral serverless files are durable. Browser clearing loses local data; export is your backup. Up to 32 lots/orders, 400 imported cases per collection, 80 journal operations and 256 KiB request/workspace. These intentional bounds are not scale claims.

LangChain tools perform real inventory/optimizer queries. LangGraph uses SQLite checkpoints, an interrupt after each tool observation and explicit human continuation/review. Tools cannot reserve, pick, recall, purchase or receive. Every decision is schema-validated and restricted to an allowlist. Model prose is untrusted and cannot authorize stock changes. Citation validation proves IDs exist, not that a model's summary is true. Hash chains are not signed or externally anchored; a user-edited restored journal is not a provider attestation.

## Model boundary

The hosted model path uses the existing Vercel AI Gateway credential or deployment OIDC token. `agent.py` checks the live model catalog **before every inference** and sends only to `nvidia/nemotron-3.5-lightning-free` while its input and output prices are exactly zero. Missing auth, missing/priced model, malformed output or provider failure fails closed. There is no paid fallback and no model key in the frontend. Free-provider prompts/responses may be retained; use synthetic data only.

An operation whose response is lost may cause another zero-price model request on retry: there is no remote exactly-once provider ledger. Saved decisions never call the model during replay. The API is a public synthetic demo, not an authenticated tenant service. No real customer data, secrets, confidential inventory or personally identifying data should be imported. See `EVAL_PREREG.md` for the acceptance/evaluation boundary. Fixture tests are not live provider evidence.

## Run locally

Requires Python 3.12+ and Node 22+; no container or paid service is required.

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm ci
.venv/bin/python dev_server.py
# In another terminal:
npm run dev
```

Vite proxies `/api` to the loopback API server. On Vercel, root this project folder; Vite emits `dist/` and `api/workspace.py` runs the actual Python core. `vercel.json` sets the bounded function duration and response security headers. No arbitrary persistent Python daemon is assumed.

Optional environment variable names, never values: `AI_GATEWAY_API_KEY` or Vercel-managed `VERCEL_OIDC_TOKEN`. Deterministic stock workflows need neither. A failed authentication/billing prerequisite is a release blocker for the agent, not permission to add a payment method or purchase credits.

Local durable operations:

```sh
.venv/bin/python cli.py --db /tmp/morrow-stock.sqlite apply operation.json
.venv/bin/python cli.py --db /tmp/morrow-stock.sqlite inspect
.venv/bin/python cli.py --db /tmp/morrow-stock.sqlite solve
.venv/bin/python cli.py --db /tmp/morrow-stock.sqlite export
# Optional real provider path, existing auth required:
.venv/bin/python cli.py --db /tmp/morrow-stock.sqlite agent investigation-1 --goal 'Inspect inventory and explain the highest priority shortage'
.venv/bin/python cli.py --db /tmp/morrow-stock.sqlite agent investigation-1
.venv/bin/python cli.py --db /tmp/morrow-stock.sqlite agent investigation-1 --review
```

An import operation has `{ "id":"import-1", "kind":"import", "args":{"data":{"lots":[{"id":"L1","sku":"APPLE","quantity":4,"arrival":0,"expiry":4,"location":0}],"orders":[{"id":"O1","sku":"APPLE","quantity":6,"due":2,"priority":3,"location":1}]}}}`. Other exact operation shapes are exercised in `tests/test_core.py` and `tests/test_http_cli.py`. The CLI uses a durable SQLite stock file and a separate `.checkpoints` SQLite file for the agent.

## Verify

```sh
.venv/bin/python -m unittest discover -s tests -v
npm test
npm run build
.venv/bin/python benchmark.py
```

Local evidence so far: 20 Python test groups, including 400 independently enumerated allocation cases, SQLite reopen, six-process duplicate receipt race, killed uncommitted writer recovery, stale approvals, recall/release, replenishment, real LangGraph checkpoint reopen, 24 unsafe/malformed tool decisions, fixture provider failure recovery, real HTTP requests and repeated multi-process CLI execution. Three JavaScript tests verify journal CAS/envelope logic and custom SKU display/submission coherence. Current CI passed at https://github.com/pranavp2418/Oaks_October/actions/runs/38766943221 . Hosted import/allocation returned HTTP200; actual provider acceptance is blocked as described above. Browser-level IndexedDB races, desktop/mobile operator flows, hosted API/model evaluation remain pending until separately recorded. Clean Python/Node installs and the TypeScript/Vite build passed. Tests are not a bug-free guarantee.

`benchmark.py` records OS/runtime/compiler, workload seed/size, warmup/repetitions, wall-clock latency distributions and separately measured traced memory. A feasible priority/nearest-cost heuristic is a quality/latency baseline, not an optimal oracle. Report only actual benchmark output, not extrapolated throughput or production scale. No SQL optimization speedup is claimed from merely adding indexes.

## Data and presentation provenance

All data are original reproducible synthetic cases. `src/sample.ts` uses LCG seed `141022`; IDs, SKUs, quantities, planning offsets, locations and priorities are generated without customer/person data. Assumptions: sealed interchangeable cases within each SKU; integer quantities; synthetic location cost; no routing traffic, refrigeration physics, supplier lead-time prediction or real purchase integration. Sample code/data are included with this project; external datasets are not used.

React, TypeScript, Motion Primitives, Motion, Python, LangChain, LangGraph and SQLite. `UI_PROVENANCE.md` records component/asset/palette/font provenance and honest tool-access limits. The art direction is a produce-market dispatch ledger, not a generic AI chat dashboard. The agent and operational paths share one inspectable inventory model.


Runtime identity note: Vercel Function OIDC is request-scoped in `x-vercel-oidc-token`, passed only to the fixed Gateway origin; `VERCEL_OIDC_TOKEN` is the build/local fallback. No token is returned to the browser or journal. Current primary documentation: https://vercel.com/docs/oidc . A successful build or fixture response does not establish provider account verification.
