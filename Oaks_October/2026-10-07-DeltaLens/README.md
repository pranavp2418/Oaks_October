# DeltaLens

Explore deployment-associated latency changes using reproducible telemetry snapshots. Import samples, choose an analysis window, compare service signals, inspect uncertainty and concurrent changes, and export the saved snapshot.

## Architecture and tradeoffs
Stateless Node.js serverless analysis API; HTML/CSS/JavaScript dashboard with interactive SVG timeline. Deduplicates telemetry by ID and content hash, rejecting conflicting retries. Groups one-minute means/P95/error rates. Ranks release windows by service before/after mean difference after subtracting pooled other-service differences when enough samples exist. Displays exploratory normal confidence intervals and explicitly flags overlapping releases. This is association, not causal identification. Controls require parallel trends, stable traffic mix and independent samples; pooling different services is a simplifying assumption. No production monitor integrations or automated rollback.

## Reproduce
```sh
npm ci
node generate.js
npm test
npm run build
npm start # 127.0.0.1:8102
```
No environment variables. Node 24. Vercel root: this folder, api/analyze.js. Browser localStorage holds imported snapshots; no shared database. Repeated identical requests produce the same result fingerprint; API is stateless.

## Synthetic data
Original LCG generator seed 7102026, 3 fictional services, 75 minutes, 1 sample/minute/service: 225 samples. One injected checkout shift and one common-mode shift. Data is MIT licensed and contains no scraped records. Samples: {id, service, minute, latency, error}; changes: {id, service, minute, label}; window in minutes. Latency is milliseconds.

## Verification
Four meaningful core tests cover common-mode subtraction, signal direction, deduplication/id conflicts, deterministic replay, absent controls, cold start, invalid telemetry/window and overlapping releases. Clean build and browser/live evidence are tracked in the root ledger as performed. Limits: 10,000 samples, 100 releases, 2 MB body. Browser storage has no cross-tab concurrency protection.

[Source](https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-07-DeltaLens) · [Demo](https://deltalens-20261007.vercel.app)
