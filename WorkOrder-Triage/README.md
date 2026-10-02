# WorkOrder Triage

Deployment dry run for Oaks_October by Pranav Patel. A property-maintenance queue with a real Node.js API that scores requests using transparent, deterministic rules. No AI model or external API key is required.

## Features
- Validated server-side scoring, trade routing, and demo response targets.
- Add tickets, inspect scoring reasons, filter by priority, resolve/reopen, and export CSV.
- Browser-local persistence. No shared database, user accounts, or cross-device sync.
- Sample tickets are fictional and clearly marked. This is an operational demo, not an emergency-reporting service. Response targets are illustrative, not commitments.

## Run and deploy
Node.js 24. Run `npm test` for policy and handler tests. Deploy this directory to Vercel using framework preset **Other**, project root **WorkOrder-Triage**, no build command, and output directory `.`. Vercel runs `api/triage.js` as a Node.js function and serves `index.html`.

## HTTP API
`GET /api/triage` returns health. `POST /api/triage` accepts `{ "title":"Kitchen tap leak", "unit":"A-204", "category":"plumbing", "impact":"routine", "ageHours":0 }` and returns score, reasons, priority, trade, and targetHours. Invalid inputs return HTTP 400; unsupported methods return 405.

## Scope
This checks the source → GitHub → Vercel → public app pipeline. It is not counted as one of the planned intermediate/advanced daily projects. Supabase and scheduled builds are not part of this dry run.
