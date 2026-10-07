# Kiln

A single-machine industrial sequencing lab with a real Lua branch-and-bound core. Edit jobs, release times, due dates, penalty weights, families and precedence. Solve, inspect the Gantt timeline and constraint audit, then export/import a reproducible plan.

## New core technology
Lua is absent from the supplied resume and pasted profile skills. core/solver.lua contains the optimization algorithm, not a cosmetic helper. Fengari runs it inside a supported Node serverless function; Node validates input and marshals safe identifiers and bounded numeric data into Lua. Vercel does not need an unsupported persistent Lua server.

## Algorithm
Nonpreemptive, serial, one-machine scheduling minimizes sum(weight × max(0, finish−due)). Family changes add fixed setup; first job has none. Release dates and precedence constrain starts. Earliest-due-date topological order initializes a feasible incumbent; DFS searches available jobs, using accrued cost plus each remaining job's optimistic earliest completion penalty as an admissible lower bound. When search is exhausted, the optimum is proven within this stated model. When the node budget is reached, report a feasible incumbent and unproven optimality. Does not optimize makespan or model parallel machines, batch merging, maintenance windows or variable setup matrices.

## Reproduce
```sh
npm ci
node generate.js
npm test
npm run build
npm start # 127.0.0.1:8103
```
Node 24, Fengari 0.1.5, Lua core, JavaScript adapter/UI. No environment variables. Vercel root: this folder; api/solve.js. Plans persist in browser localStorage, with JSON export/import. API stateless; duplicate requests produce the same schedule/certificate except measured elapsed time. No shared database or authentication.

## Data and limits
Original deterministic fixture seed 7102026, six fictional jobs, available under MIT. Generator writes explicit fixture rather than drawing random values. Schema jobs {id, family, duration, release, due, weight, predecessors}; setup; budget. Integer minute time units. Maximum nine jobs and 100,000 search nodes. Validate acyclic precedence, bounded times and safe identifiers before Lua execution. No user Lua source is executed. No real factory records or claimed production use.

## Verification
Five tests: Lua solution compared against independent JavaScript exhaustive oracle, release/setup/resource/precedence invariants, honest budget cutoff, invalid/cyclic/missing predecessors, deterministic repeated solves. Actual browser/live and clean build evidence lives in root PROJECT_LEDGER.json. Measured example results are fixture-specific and are not industrial benchmarks.

[Source](https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-07-Kiln) · [Demo](https://kiln-20261007.vercel.app)
