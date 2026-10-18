# Portwise — implementation in progress

A synthetic connector-support repair engine. The TypeScript core finds the exact least-risk typed configuration patch under fixed-field authorization and explicit constraints. A SQLite case workflow connects diagnosis, proposal, human review, replay staging, apply and rollback, with expected-revision fencing, payload-aware idempotency and hash-linked evidence export.

```sh
npm ci --ignore-scripts
npm test
```

Current verified slice: seven Node test groups, including 300 independent exhaustive Boolean constraint cases, immutable credential-reference preservation, infeasible configurations, stale/unauthorized patches, persisted reviewed apply/rollback and database reopening. Node24 `node:sqlite` is used locally. Sample connectors and references are synthetic (seed151028); no external endpoint, secret or customer system is accessed. The exact search is capped at 100,000 assignments. Hashes detect tested consistency faults, not an administrator rewriting all state.

The local store's role argument requires an authenticated transport before treating it as an identity boundary. No shared hosted storage, independent reviewer login, external connector delivery or model integration is claimed. Read-only tools, checkpointed agent, React operator UI, stronger failure/concurrency tests, live deployment, launch film and portfolio integration remain pending. This slice is not a completed daily project. See ACCEPTANCE.md.
