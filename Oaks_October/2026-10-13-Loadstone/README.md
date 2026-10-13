# Loadstone

An original energy-dispatch workbench for a bounded microgrid model. Import an energy profile, optimize storage/generator/grid use, compare disruption scenarios, record a review, approve a plan, rehearse slot-by-slot dispatch, recover from an interruption and export its evidence.

## Workflow

1. **Inputs:** edit or import a schema-1 JSON profile. `src/engine.mjs` includes the reproducible synthetic generator/fixture, seed **13102026**. Saving inputs invalidates the old plan.
2. **Dispatch:** solve the actual C++ core in WebAssembly. Battery charge/discharge, generator ramp, grid limits and terminal reserve are jointly optimized by backward dynamic programming. Inspect state of charge, cost, unserved energy and transition counts.
3. Compare current, peak-outage and doubled-tariff profiles. These are new optimizations, not hardcoded scores; they leave the saved plan alone.
4. **Review & run:** enter a review note, record it, approve, and dispatch each slot. Inject an interruption before applying a slot, reload, then resume at the same cursor. Completion is only recorded after every slot is applied.
5. **Evidence:** export the profile, plan, input SHA-256 and operation receipts as JSON.

## Architecture and invariants

C++20's Bellman state is `(slot, state-of-charge, previous-generator-output)`. Transitions enumerate bounded integer battery changes and ramp-feasible generator outputs. Grid import covers residual demand to its capacity; remaining demand is penalized shortage, and surplus is curtailed. Backpointers reconstruct the optimal feasible plan. Energy conservation, bounds and terminal reserve are checked against a separate exhaustive JavaScript oracle.

The React/TypeScript interface uses a real IndexedDB read/write transaction for every operation. A revision compare occurs within that same transaction; conflicting tabs reject stale writes. Exact receipt replay is idempotent; reuse with a different payload rejects. Review is a local workflow gate, **not authenticated identity or RBAC**. There is no server or shared multiuser database. State stays on this browser/origin; clearing browser data removes it. Profile JSON is the portable input; evidence is an inspectable export, not an authenticated proof.

The core is compiled using Zig 0.14.1's C++ compiler, **not implemented in Zig**. `core/dispatch.wasm.b64` is the exact executable asset produced from the included C++ source so Vercel builds need no downloaded native toolchain. To recompile, set `LOADSTONE_ZIG` to your Zig 0.14.1 executable. `build.mjs` regenerates this base64 asset when that compiler is available.

## Local commands

```sh
npm ci --ignore-scripts
LOADSTONE_ZIG=/path/to/zig npm run build
npm test
npm run benchmark
npm run dev
```

Without `LOADSTONE_ZIG`, the build decodes the tracked compiled core. No API credentials or paid resources are required. Node 24 is used in recorded verification. `npm run dev` uses port 8151.

## Verification

- Five core/state test groups: **240 seeded independent exhaustive comparisons**, conservation, ramp/reserve constraints, invalid bounds/infeasible reserve, stale revisions/conflicting IDs, review/approval and interrupt/replay/completion.
- Clean `npm ci --ignore-scripts` and production build passed.
- Reproducible benchmark: `tests/benchmark-results.json` records hardware, OS, compiler flags, workload, three warmups and twenty full instantiate/solve repetitions. This machine measured median **10.81 ms**, p95 **12.56 ms** for 48 slots, 32 kWh capacity and 1,837,698 transitions. The generator-first/no-storage feasible baseline cost was 12,864 cents; optimum 8,664 cents. These are this synthetic workload's results, not device or fleet performance claims.
- Browser and public-release evidence is recorded separately in `VERIFICATION.json`; a missing/pending entry is not a passed check.

## Links and limits

[Source](https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-13-Loadstone) · [Demo](https://loadstone-20261013.vercel.app/)

Synthetic fixture and original code are MIT licensed. No third-party energy dataset, device integration, measured battery efficiency, real tariff or reliability guarantee. Model limits: 48 slots, capacity 32, generator output 12; lossless storage, no minimum-run-time or start-up cost, no export revenue and no uncertainty forecast. Integer prices are cents/kWh; unserved energy costs 10,000 cents/kWh. The optimum applies only to these assumptions. Inputs with an unattainable reserve reject rather than claim a feasible plan. Operational times inside the app are measured workflow data; the portfolio displays no project dates.
