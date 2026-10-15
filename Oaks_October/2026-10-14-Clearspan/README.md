# Clearspan

An inspection-mission workbench that turns weighted checkpoints, exclusion cells and a finite energy budget into an exact reviewed route, recoverable mission and inspectable planning-agent evidence. Original synthetic software simulation: no robot, drone, computer-vision device or physical control is connected.

Source: https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-14-Clearspan

Publication and browser/provider acceptance are pending until recorded in QA_REPORT.md. A passing local suite is not a public release claim.

## Useful workflow

Load the synthetic field or import a bounded map. Compute coverage, inspect missed checkpoints and exact route, write an operator review, then start the mission. Travel stops at the next inspection; record PASS or ISSUE explicitly. Pause before changing exclusions, then replan from the actual position and remaining energy. Review again before resuming. Resolve every inspection finding and return to base before closure. Export the portable workspace and full dossier.

The planning agent uses real read-only typed LangChain tools in a LangGraph decision/observation/human-interrupt graph. It can inspect the map, solve a route and compare budgets. It cannot start, travel, inspect a physical object, change exclusions or approve a mission. Continue one decision at a time and close cited evidence explicitly. Saved decisions reconstruct checkpoints without calling the provider. Maximum4 decisions/investigation and4 investigations/workspace.

## Core and state architecture

The original C++20 core uses grid BFS for obstacle-respecting distances, subset dynamic programming for exact maximum-priority checkpoint coverage under travel+inspection+return cost, and BFS parent reconstruction for executable cell paths. At most16×16 cells,10 checkpoints and512 energy units. Each move or inspection consumes one unit. No optimality or safety claim extends beyond those discrete assumptions.

The actual core is WebAssembly inside the Node API, not a substituted JavaScript planner. It can also be imported as a standalone WASM engine. React presents its results; Express serves bounded commands. Current official Express deployment guidance: https://vercel.com/docs/frameworks/backend/express . Vercel serves a stateless Function, not an assumed persistent C++ daemon.

Durability is honestly **single-user/browser-local**. IndexedDB saves complete portable operation journals with an atomic expected revision, rejecting stale tabs. SHA256-linked commands replay in order through the same state engine; same ID/body is idempotent and conflicts fail. Serverless process memory/disk is not durable storage and no hosted multiuser database, authentication, tenant isolation or physical integration is claimed. Export before clearing browser data. The API's request-local LangGraph MemorySaver is reconstructed from validated saved decisions and actual tool replay; it is not presented as remote durable storage.

Review binds map version, position, inspected checkpoints and remaining budget. Exclusions invalidate approval. A failed command changes no saved state; an interrupted model call retains the checkpoint. Lost responses before the journal save can repeat an inference request: no remote exactly-once inference ledger. Saved duplicate requests are checked before the provider. A user can edit/re-hash exports; hashes and provider metadata are not signed attestations.

## Run and reproduce

Node24 and npm. The checked compiler manifest binds source and binary SHA256; Vercel reconstructs the verified WASM from its tracked base64 representation. To rebuild that binary yourself, install Zig0.14.1 from its official distribution or the ziglang0.14.1 package and set CLEARSPAN_ZIG to the executable.

```sh
npm ci
CLEARSPAN_ZIG=/path/to/zig node build.mjs --core-only
npm test
npm run build
npm run benchmark
npm run api
# second terminal: npx vite --host 127.0.0.1
```

Vite proxies `/api` to local port8788. Deploy this folder as the Vercel root with Node24; api/workspace.mjs invokes the actual core. Optional existing credential variable names: AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN. Hosted Vercel Function identity is read from its injected x-vercel-oidc-token header and sent only to the fixed Gateway origin, never to the browser or saved journal. No secret values belong in source.

`server/provider.mjs` checks the live catalog before every inference and allows only nvidia/nemotron-3.5-lightning-free while both price strings are exactly zero. No paid fallback, credit purchase or credential creation. Free provider may retain prompts: original synthetic cases only. Missing auth, changed prices, malformed output and provider failures fail closed. Model prose is untrusted; valid citation IDs do not establish factual accuracy.

Eight local groups currently pass, including360 independent exhaustive route comparisons, reconstructed path/budget invariants, transaction rollback/idempotency/replay, exclusion replanning,24 unsafe/malformed tool decisions, real LangGraph checkpoint reconstruction and actual HTTP mission/recovery/issue-closure flows. A malformed array tool name was observed failing its intended regression before repair. Saved duplicate HTTP agent requests bypass inference/failure injection. Browser, actual provider and deployment checks are recorded separately, not inferred from those fixtures. No bug-free claim.

Optional real hosted pilot: `node tests/live-pilot.mjs https://your-reviewed-deployment.example`. Explicitly follows EVAL_PREREG.md; three visible synthetic cases, real generation receipts, reviewed evidence, provider interruption, saved duplicate and replay checks. No fixture response counts as live inference.

`npm run benchmark` records actual OS/Node/compiler, fixed synthetic workload,5 warmups/50 repetitions,p50/p95/min/max and a feasible JavaScript greedy baseline. Languages/algorithms differ; no isolated speedup or production-scale extrapolation. Native browser verification at `/verify.html` exercises an isolated eight-connection IndexedDB race and the actual product at390px/wide widths without making a model request.

## Data, presentation and limits

All sample data are original deterministic synthetic fixtures in src/workspace.mjs: a10×8 grid, six generic checkpoint IDs,11 exclusion cells and42 energy units. No external dataset, customer/person data or real asset inspection is used. Geometry is orthogonal; no turning cost, robot dynamics, sensing uncertainty, moving obstacles or physical battery model. Inspections are operator-labelled synthetic outcomes, not predictions.

See ACCEPTANCE.md, EVAL_PREREG.md, UI_PROVENANCE.md and QA_REPORT.md for the pre-code contract, evaluation boundary, component/asset provenance and release evidence. Public APIs are bounded demonstration surfaces. No affiliation, certification, real customer, physical safety or production-scale claim.
