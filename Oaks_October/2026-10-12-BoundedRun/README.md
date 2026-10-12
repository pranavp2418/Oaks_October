# BoundedRun

A deterministic, capability-limited workflow runner for rehearsing agent plans without autonomous external actions. The actual TypeScript scheduler powers the browser workbench.

## Walkthrough

Run or single-step a four-node dependency graph. The synthetic scoring tool fails once and retries within its ceiling. Remove the notify capability to observe fail-closed behavior. Export, reload and recover a validated checkpoint; trace sequence, attempts and spend remain exact.

## Core, invariants and failure model

The scheduler validates unique bounded IDs, dependency existence and acyclicity before execution. A ready node can run only when all dependencies succeeded, its tool is in the explicit capability set and its cost fits the remaining integer budget. Every attempt is charged, retry count is bounded and descendants of a terminal failure become blocked. An idempotency key binds step, tool and input to its output. Checkpoints are versioned and validated before replacement.

Invariants: no step precedes a dependency; spend never exceeds budget; denied/missing tools never execute; retry attempts never exceed their ceiling; a failure blocks dependent work; identical checkpoints and deterministic tools produce identical continuation.

This is a single-browser laboratory, not a distributed scheduler, sandbox or security boundary. Tool functions are synthetic and perform no network actions. localStorage is browser-owned; export is the portable recovery path.

## Data and license

The fixed sample plan and results are synthetic. No customer data or third-party dataset. Code and original cover are MIT licensed.

## Run and verify

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run dev
```

No environment variables or paid services. Vercel serves the compiled static TypeScript output. Seven test groups cover ordering, retries, permissions, budget exhaustion, dependency blocking, checkpoint tampering, cycles/duplicates and deterministic recovery.

## Limits

At most 24 steps, five attempts per step and 1,000 budget units. The demonstration is intentionally sequential; it makes no concurrency, isolation, production reliability or unrestricted-agent claim.

[Live demo](https://boundedrun-20261012.vercel.app/) · [Source and verification](https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-12-BoundedRun)
