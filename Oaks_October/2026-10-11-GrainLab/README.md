# GrainLab

An original dimensional analytics workbench for synthetic service-request telemetry. Inspect rollups, correct/retract individual records, explore exact cohort lineage and recover a browser-owned workspace without silently losing newer tab edits.

[Live workbench](https://grainlab-20261011.vercel.app/) · [Source](https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-11-GrainLab)

## Walkthrough

1. Inspect service × region cells and select a cell for exact record lineage.
2. Select a record, change latency or service and apply a correction. All eight dimension masks retract the old contribution before adding the new one. Change group/outcome filters to verify the old cohort disappeared.
3. Raise minimum cohort to suppress displayed small-group measures/lineage, then restore it to 1.
4. Retract a record; export the workspace; recover it and reload the page. Invalid imports leave the current state intact.
5. Open two tabs. Editing in the newer tab fences writes in the older one; reload that tab before continuing.

## Architecture and invariants

TypeScript implements a sparse cube in a dedicated Web Worker. Each record contributes to 2^3 rollups across service, region and outcome. A cell holds an ID set, integer latency/token sums and a multiset of latency values. The exact nearest-rank p95 comes from the sorted multiset, rather than an approximation. Updates retract all prior memberships; empty cells disappear. Queries select the precomputed mask corresponding to grouped/filtered dimensions. Original event IDs are idempotent; reused IDs with changed payloads conflict. Revisions fence edits. Up to 4,000 operations / 1,000,000 units per measure keeps integer sums within JavaScript's safe range.

A versioned event checkpoint is validated by replay before replacement. The Worker performs computation; localStorage owns durability for this single-browser lab. Cross-tab string comparison detects an intervening update before write, but is not an atomic cross-tab transaction or a server concurrency guarantee. Export files provide portable recovery. No shared backend, authentication or real tenant isolation is claimed.

Minimum cohort is a **presentation rule**, not differential privacy or a security boundary: sample inputs are available in the browser and overlapping queries can expose information. All data is synthetic.

## Data and license

`seed()` in `src/core.ts` reproducibly generates 72 records with LCG seed **10112026**. Schema: ID; service Search/Compose/Retrieve; region East/West/Europe; outcome ok/error; integer latency in milliseconds and integer synthetic workload tokens. Metrics have no real customer/latency accuracy interpretation. Code, generator and original `cover.svg` use MIT (`LICENSE`). No third-party dataset.

## Local commands

Node 24 / npm and TypeScript 5.9.2, pinned by package-lock.json:

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run dev
# http://localhost:8131
```

No environment variables or paid APIs. Vercel deploys `public/`; the build compiles the actual core/Worker and copies the interface. Source is not a static mock.

## Verification

Five test groups; 240 deterministic corrections/deletes × 8 rollups = **1,920 independent full-scan oracle comparisons** of counts, sums, p95 and exact lineage. Additional checks cover stale revisions, idempotency conflicts, invalid measures, suppression and checkpoint recovery. `VERIFICATION.json` records actual checks, runtime and browser workflows; 390px mobile viewport is simulated, not a physical device. The workbench has keyboard controls, live status, loading/error/empty states and no horizontal overflow in the tested viewport.

## Tradeoffs

Eight copies of membership are deliberate for only three dimensions; exponential dimension growth needs a different materialization plan. Event replay and sorting exact p95 are bounded educational workloads, not benchmarked production OLAP. No distributed consistency/performance claim. No live customer integration.
