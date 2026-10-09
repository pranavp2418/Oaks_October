# RelayLab
Delivery failure rehearsal with a custom typed state machine, logical clock, tenant concurrency caps, monotonic worker fencing tokens, exponential retry budget, endpoint circuit cooldown and reviewed dead-letter redrive.

## Walkthrough
Queue a synthetic inventory fixture, claim it and return its first 500 response. Advance time, reclaim and return 429; the endpoint circuit now blocks claims. Advance through cooldown and complete the 200 attempt. Export the journal, reload or restore it. Expired leases are recovered without allowing stale workers to acknowledge them.

## Architecture and invariants
TypeScript core and Node serverless replay API. Browser localStorage persists the journal; server independently reconstructs it on every request. No external webhooks are sent. Only one active worker per tenant; at most four attempts before dead letter; terminal delivery cannot be acknowledged twice. Exact operation retries are idempotent, conflicting IDs and stale revisions fail without modifying state. Circuit failures are endpoint-scoped. Logical clock and fixture responses are deliberate simulation boundaries, not real network delivery guarantees or authenticated tenant isolation.

## Run
`npm ci --ignore-scripts && npm test && npm run build`. Use `npx vercel dev` for the API and static UI. No environment variables or paid services needed. Vercel deploys `public/` and `api/workspace.js`; complete core is included in the function.

## Verification
Node tests cover circuit/retry timing, expired leases, retry idempotency, tenant cap, redrive, invalid inputs, and 150 deterministic fault schedules with exact replay checks. Browser/live evidence is in the collection dated run record. No performance claims.

Synthetic fixture: deterministic sequence [500,429,200], no random generator, job fields id/tenant/endpoint/payload/outcomes. No real endpoints/customer data. Source and assets are original; MIT licensed. The browser journal is limited to 100 jobs and 1000 operations; clearing browser data loses work. No cross-device database, authentication or shared queue.

Source: https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-09-RelayLab
Demo: https://relaylab-20261009.vercel.app/
