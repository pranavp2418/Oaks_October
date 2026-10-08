# DockProof

A typed shipping-rule compiler and audited dispatch workbench. Warehouse operators can check six synthetic cartons, repair data, compare a candidate policy with the active policy, activate rules, and approve passing cartons with a review note.

## Core contribution
A bounded lexer/Pratt parser builds a typed AST, folds constant subexpressions, emits stack bytecode, and runs a capability-free VM. Requirements are boolean; field and operator types are checked before activation. Rules support parentheses, `not`, `and`, `or`, equality, and numeric comparisons. There is no JavaScript `eval` or external action. Complexity is linear in policy tokens plus shipments × instructions. Expressions and payloads are bounded.

The state machine is a revisioned operation journal. Exact duplicate operation IDs replay once; reused IDs with different bodies and stale revisions fail. Approvals require all current checks to pass and a note. A policy activation invalidates all approvals; carton edits invalidate that carton's approval. The API rebuilds the journal atomically on every request. It is NOT a shared concurrent database: separate browser workspaces are isolated, and revision checks apply within one submitted journal.

## Walkthrough
1. Open the dock queue; initially two cartons pass and four are held.
2. Fix labels on DP-103 or seal DP-104 and save the carton. Numeric values, booleans and quantities validate before mutation.
3. Enter a review note on a passing carton and approve dispatch. Failing cartons cannot be approved.
4. Change `weight <= 25` to `weight <= 17` in the policy studio; Preview impact shows changed outcomes without mutation.
5. Activate policy to replace rules and invalidate old approvals. Invalid syntax retains saved work.
6. Export the workspace JSON or recover it with the file picker. Imports validate and replay before replacing browser storage. Reset restores the original synthetic fixture.

## Stack and architecture
TypeScript 5.9.3 compiler/VM and Node.js serverless API; HTML/CSS/JavaScript responsive UI. The backend is `/api/workspace`, not a frontend imitation. Local HTTP server calls the same handler. Browser `localStorage` saves input plus operation journal; no authentication, shared backend persistence, carrier network or automatic dispatch. No paid APIs or env variables required. Vercel's Node runtime executes the compiled TypeScript.

## Reproduce
Node.js 24 and npm:
```
npm ci --ignore-scripts
npm test
npm run build
npm start
```
Local URL: http://localhost:3101. Set `PORT` only to change the local port. `tsconfig.json` uses strict checks. Lockfile included. POST the `data/seed.json` body to `/api/workspace` for the JSON workflow.

## Verification
8 tests: 500 seeded shipments compare VM with separate AST interpreter; precedence/folding; strict diagnostics/depth limits; invalid quantities and duplicate records; approval gates; idempotency/revision conflicts; policy impact and approval invalidation; actual API 200/400/405/409 and repeat equality. This is differential semantics evidence, not proof for every possible program. Clean install and build commands are recorded in RELEASE.json. Desktop/mobile live checks are recorded there after deployment.

## Data and limitations
`data/seed.json` is original hand-authored synthetic Harbor data, deterministic fixture version 81026; no real customer or carrier records. No external dataset license needed. Project code/sample data: MIT (see LICENSE). Units: kg, degrees C, integer unit/label counts. Rules are illustrative, not legal or shipping certifications. No real operator identity. Approved status is a local demonstration, not physical shipment execution. No performance claims or production scale claims.

[Source](https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-08-DockProof) · Demo URL is recorded after live verification in RELEASE.json.
