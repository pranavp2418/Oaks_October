# Verification checkpoint

Local checks passed:400 independent finite-trace fixtures; shortest witness/equivalence, shrinking and mutation cases; full native/WASM journal/repair parity; eight actual CLI writers; killed prepared-writer recovery; idempotent agent replay before provider; malformed/tampered input and precommit failure. Fresh pinned Go/WASM/TypeScript/Vite build passed. No provider calls occurred in those fixture tests.

Native review found and repaired a compact-vs-indented snapshot size mismatch, overlapping browser restore fencing, case-alias JSON ambiguity and raw editor duplicate keys. Regression tests are retained. Native files now use one bounded compact representation before atomic replacement. Browser operations capture their starting revision; overlapping restores are guarded. Raw editor keys are validated before JSON.parse can discard duplicates.

Hosted deployment, actual provider evaluation and desktop/mobile browser workflows remain pending at this checkpoint. No completion claim is made. Full external scanner suite, outside-model CLI, physical touchscreen and assistive-technology certification are unavailable/not claimed. Actual gstack planning, engineering/security review, test-value audit and native adversarial review informed these checks; the workflows do not guarantee correctness.

## Measured native benchmark

```json
{"architecture":"amd64","bounded_trace_enumeration":{"allocated_bytes_per_call":32807795,"max_ms":127.961121,"min_ms":28.065621,"p50_ms":55.430501,"p95_ms":92.909069},"limits":"One finite synthetic model; not network throughput or external implementation verification","logical_cpus":9,"method":"sequential wall-clock; nearest-rank p95; TotalAlloc delta, not peak memory; shared container","os":"linux","product_bfs":{"allocated_bytes_per_call":13579,"max_ms":145.419835,"min_ms":0.010447,"p50_ms":0.040287,"p95_ms":1.696177},"repetitions":35,"runtime":"go1.27.2","shortest_witness_length":12,"warmup":5,"workload":"fixed12-state cycle;2 symbols; single output fault at S11/probe"}
```

Compiled/run using Go1.27.2, Linux6.18.44 x86_64,9 logical CPUs; go run -trimpath. Wide timing tails are retained; no universal speedup or production latency claim.

Follow-up review reproduced Go's Unicode simple-fold long-s field alias. The decoder now rejects non-ASCII property names before struct decoding, and the raw browser parser applies the same boundary; string values still support Unicode. Long-s/ASCII-case/escaped duplicate regressions passed with the full8 native groups,400 oracles and native/WASM integration. Runtime source changed after the initial source push; a follow-up source commit is required before release. Current Vercel deployment attempt was rejected HTTP402 api-deployments-free-per-day, retry_after86400. No deployment ID/live URL or hosted/provider/browser pass exists for Wirewake. This is a web-planned project; it is not reclassified as code-only.

CI follow-up: initial source76d72a89 CI38789659163 passed. Updated sourcecb12f3b5 CI38791600889 failed because a native eight-writer test assumed every first attempt would finish within the documented bounded lock wait. The busy result is intentionally recoverable. The test now performs bounded same-ID retries only for that exact busy error, preserving one receipt; other errors fail. A new forced-held-lock test proves busy rejection leaves state unchanged, then release/retry succeeds exactly once. Full local suite now9native groups plus raw-editor test and400oracle cases, native/WASM parity,8CLI writers and killed-writer recovery. New CI must pass; earlier failure is retained. Vite7.3.7/esbuild0.28.1 clean build passed and npm audit reported0known dependency vulnerabilities. No hosted UI/model claim follows from those checks.
