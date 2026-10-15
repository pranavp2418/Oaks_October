# Wirewake

A protocol conformance laboratory with a bounded investigating agent. Compile supplied deterministic Mealy contracts, find a shortest observable disagreement, reduce a longer failing trace, run a mutation campaign, then propose, review and apply a contract-derived repair. Synthetic handshake data is included; no connection to external systems is made.

## Complete workflow

1. Import the synthetic handshake or edit both strict JSON contracts (12 states,8 symbols,96 edges maximum).
2. Run exact product-graph BFS. Inspect the shortest counterexample and text/SVG state evidence. Missing transitions emit REJECT and retain state.
3. Replay supplied traces, minimize failures with ddmin and a one-deletion-minimal check, and inspect output/next-state mutation witnesses.
4. Propose a single-edge repair. Human review binds the exact spec/candidate digest and requires exhaustive finite-model equivalence. Apply rechecks that proof; stale reviews fail atomically.
5. Ask the read-only agent to inspect, check, minimize or suggest. Each actual model decision is stored; continue after interruption, inspect citations, and explicitly review. The agent cannot approve or apply repairs.
6. Inspect the proof dossier, regression corpus, journal and operation costs. Export/restore the workspace; malformed or tampered journals fail. Reopen stale browser tabs instead of overwriting newer state.

## Architecture and limits

Go1.27.2 implements contract compilation, product BFS, trace shrinking, mutation analysis, patch review, bounded agent transitions and hash-linked replay. The same real Go code runs in a browser WASM worker and in the Node API. Native Linux CLI persistence uses advisory flock, fsync and atomic rename. The hosted app is a single-user IndexedDB journal with compare-and-swap revisions; no shared database, tenant isolation or multiuser service is claimed. Restored decisions are replayed without inference. SHA256 journal links detect alteration but do not authenticate a user or establish legal audit provenance.

The Node API calls only the existing Vercel AI Gateway, only while the chosen free model's catalog input/output prices are exactly zero. There is no paid fallback. OIDC is supplied by the deployed request. A provider outage leaves the last checkpoint unchanged. Model prose is untrusted; Go tool results and human review control repairs. Four decisions/run and four saved runs bound the journal. This proves only the supplied finite models: it does not prove an external executable, physical network or protocol implementation. Shrinking guarantees one-deletion minimality, not global shortest length; BFS supplies a shortest witness separately.

## Local commands

Node24 and Go1.27.2, Linux for the durable CLI:

```sh
npm ci
export WIREWAKE_GO=/absolute/path/to/go
npm run build
npm test
node --test tests/strict-json.test.mjs
npm run benchmark
npm run api
# another terminal: npx vite --host 127.0.0.1
```

Without WIREWAKE_GO, build downloads the official pinned Linux/amd64 archive and verifies its recorded SHA256 before extraction. The binary is compiled from this folder; Vercel hosts Node Functions and static WASM, not a persistent Go server. Go's BSD license is retained and shipped at /GO_RUNTIME_LICENSE.txt.

```sh
go build -o /tmp/wirewake ./cmd/wirewake
/tmp/wirewake -workspace /tmp/proof.json
# Save commands as JSON files; import a spec/candidate first.
printf '%s' '{"id":"check1","kind":"check","args":{}}' > /tmp/check.json
/tmp/wirewake -workspace /tmp/proof.json /tmp/check.json
```

Import a spec/candidate first; an empty workspace cannot be checked. CLI command-file and -workspace / -expected-head options are documented by -h. Native commands never call a model themselves. API environment names: VERCEL_OIDC_TOKEN (normally request-scoped), AI_GATEWAY_API_KEY (optional existing local credential; never commit), WIREWAKE_GO (build only). No credential is required for core/local tests. Dataset is original synthetic code in src/sample.mjs; no scraped personal data.

## Verification and delivery

See ACCEPTANCE.md, QA_REPORT.md and EVAL_PREREG.md. Tests include400 independent trace-enumeration fixtures, native/WASM state parity, full repair lifecycle, invalid inputs, replay/tamper, eight real concurrent CLI processes, killed-writer recovery, large-snapshot reopen and ambiguous JSON regressions. Runnable benchmarks report environment/workload/warmup/repetitions and a bounded enumeration baseline; no production-scale claim. Hosted/browser verification is recorded separately after publication.

[Complete source](https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-14-Wirewake). Verified demo and release IDs are added only after actual delivery checks. Native UI uses semantic controls, keyboard navigation, SVG with text tables, reduced motion, explicit loading/error/recovery states and narrow-screen layouts. Physical-device and full assistive-technology certification are not claimed.
