# PermitWeave

A synthetic authorization capacity planning workspace. Upload a workspace, allocate unit-demand visits against member/service/date windows, edit capacity, inspect uncovered visits, and export a replayable event history. No clinical or payer eligibility decisions are made.

## Architecture
Python serverless API validates data and replays revision-checked, idempotent events, then allocates visits chronologically against earliest-expiring matching capacity. For identical unit demand and interval eligibility within each member/service group, earliest deadline allocation preserves future options. Arbitrary multi-unit visits are intentionally unsupported. Hash-chained audit events detect accidental modification; they are not signed or tamper-proof.

Client stores the baseline and events in localStorage. Refresh replays the same snapshot through the API. No shared database, authentication or cross-device synchronization. Concurrent tabs can overwrite browser storage; revision protection applies to one submitted snapshot, not global shared state. Import/export supports recovery. API holds no persistent state and receives no real patient data.

## Stack and commands
Python standard library API, JavaScript ES modules, HTML/CSS; Node 24 build tooling.

```sh
npm ci
python generate.py
npm test
npm run build
npm start # http://127.0.0.1:8101
```

No environment variables required. Vercel discovers api/compute.py. Deployment root is this directory.

## Data
Original synthetic generator seed 7102026; 8 fictional members, overlapping intervals and 80 visits. No licensed external dataset. Schema: authorizations {id, member, service, start, end, units}; visits {id, member, service, date}; events {key, type, authorization, units, expected_revision}. Dates must use YYYY-MM-DD; intervals inclusive. This repository's generated data is available under MIT.

## Verification
Five core tests pass: capacity/window boundaries, earliest expiry preservation, replay/idempotency/stale revisions/hash determinism, invalid inputs, visit order invariance. Clean npm install and static build pass. Browser/live verification is recorded separately in the root ledger; do not infer it from this README.

## Links
[Source](https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-07-PermitWeave) · [Demo](https://permitweave-20261007.vercel.app)

## Limits
Illustrative authorization scheduling only; no billing integrations, multi-unit optimization, authentication, durable shared state or production compliance claims. API input limits: 200 authorizations, 500 visits, 100 events and 200 KB. Browser storage failure is surfaced.
