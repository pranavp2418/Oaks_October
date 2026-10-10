# Cutline

A finite-stock fabrication planner. Edit the synthetic cut list and kerf, solve an exact small-workload stock assignment, review the cut strips, reserve physical bars, then confirm cuts or cancel before production. Completed jobs return reusable remnants to inventory and generate a material-conservation audit.

## Core contribution
Python branch-and-bound assigns every piece to one compatible stock bar. Each piece consumes `length + kerf`, including the final cut. Objective is lexicographic: minimize bars used, then total stock length. Pieces are ordered longest-first; equivalent-capacity branches are pruned; remaining material demand supplies an admissible additional-bar lower bound. Exhaustive completion proves optimality/infeasibility within this one-dimensional model. A node-limit result says unproven; absence of an incumbent at the limit is not proof of infeasibility. No multi-dimensional nesting, machine scheduling, orientation, defects or supplier pricing.

Preview hash covers sorted pieces, available stocks, kerf, budget and placement. Reservation recomputes the real core and rejects stale previews/revisions. SQLite transactions reserve all assigned bars together, fence duplicate/conflicting operation IDs, and enforce unique stock/job/product identifiers. `reserved → completed` consumes bars, records produced pieces, returns remnants of at least50mm, and proves `input = products + kerf + retained + discarded`. `reserved → cancelled` releases bars. Completed jobs cannot cancel or complete twice. The independent oracle checks 100 random small workloads using full Cartesian enumeration; this is a different algorithm from the branch-and-bound implementation.

## Architecture/persistence
Standard-library Python Vercel function (`api/workspace.py`), real in-memory SQLite tables rebuilt from baseline + verified event journal, JavaScript/SVG responsive UI. The browser persists the complete journal in localStorage; reload reconstructs it server-side. Export/recover and audit export are usable workflows. Web Locks, where supported, serialize local tab mutations, and a storage snapshot fence rejects a newer tab's workspace. Without Web Locks there remains a check/write race. Revision checks apply to the supplied journal, not shared multiuser data. Vercel process/disk is not used for persistent storage. No hosted database, authentication, shared accounts or factory connection.

## Local usage
Python 3.12+ and Node 24. No application secrets or Python third-party dependencies. `requirements.txt` deliberately has no dependencies. npm lockfile pins the dependency-free packaging.

```sh
npm ci --ignore-scripts
npm test
npm run build
python3 local.py # http://localhost:8111
```

Walkthrough: inspect the initial sample optimum → edit Rail-A length → solve again → enter unique job reference/review note → Reserve plan → Confirm cuts → inspect returned remnants and conservation audit → export workspace → reload/recover. Solve another small cut against a returned remnant. Cancel is available before cuts. Invalid recovery files and stale plans preserve the saved workspace; sample reset is explicit. Initial requests and mutations disable controls while loading.

## Data/verification
`data/sample.json`: original deterministic fixture, label synthetic, seed10102026, five physical bars and eight requested cuts across Aluminium/Steel. Units are exact integer mm. At most14 pieces,12 available stocks,10 seed stocks,20mm kerf,200,000 search nodes and80 journal operations. Long journal histories may cost more replay work; these are bounded demonstrations, not performance or production-scale claims. Inventory can eventually exceed the planner bound after many remnant-producing jobs; export the evidence and start a fresh bounded workspace.

Nine behavioral tests cover exhaustive-oracle correctness, material/length conservation, truthful limited-search status, input-order invariance, exact retries, conflicting IDs, stale previews, reserve/cancel/complete transitions, remnant reuse and invalid input. Public HTTP/browser/source correspondence evidence is recorded in the collection run after deployment. Mobile verification is a viewport test, not a physical machine operator/device test. Original code, synthetic data and SVG artwork: MIT.

Source: https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-10-Cutline
Demo: https://cutline-20261010.vercel.app/
