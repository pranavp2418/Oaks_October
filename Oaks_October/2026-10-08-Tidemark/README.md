# Tidemark

An event-time telemetry engine written in Rust and executed as WebAssembly in the browser. Process synthetic sensor packets, inspect open/finalized tumbling windows, quarantine late data, review alerts, and recover an exact checksummed checkpoint. The novel technology is the actual Rust algorithm/state/codec core, not a UI dependency.

## Core and invariants
- Configurable fixed-width event-time windows, automatic watermark `max(previous, max_timestamp - lag)`, explicit monotone advancement, exact integer aggregates. A packet with timestamp below the existing watermark is rejected; one at the watermark is accepted. Finalized windows cannot gain new records under this policy.
- Event identity checks: same ID/body is a retry, changed body is a conflict. Unique rejected IDs remain seen. Operation identity/revision fencing supports exact retries. A batch is computed on a fresh state and installed only after all commands pass.
- A custom signed delta-ID, delta-of-delta timestamp and delta-value varint record codec preserves arrival order, sensor identity and accepted/late flags. The snapshot stores watermarks, seen events, review notes, audit and operation IDs alongside compact records. CRC32 and schema/invariant checks detect corruption and truncation. CRC32 is NOT authentication, encryption or protection from a malicious author who can re-sign a changed snapshot.
- Alerts arise only from finalized windows whose max reaches a configurable threshold. Acknowledgement requires a review note. These are toy sensor thresholds, not physical diagnostics or safety controls.

The implementation retains bounded events and computes views from accepted records: at most 10000 records and 500 operations. It is an in-process model, NOT a distributed stream processor or persistent network server. No exactly-once guarantee across independent browsers. `localStorage` holds the input/checkpoint in the current browser; exported JSON allows recovery. Integer milliunits avoid floating monetary-style drift; averages in the UI are formatted floats only.

## Walkthrough
1. The seed stream has 36 accepted events, one quarantined late event, one ignored retry, and automatic watermark 150s.
2. Ingest ID 901 at 190s with value 5400; inspect the new aggregate and watermark 160s.
3. Finalize to 240s. Closed high-valued windows become alerts; enter a note and acknowledge a window.
4. Checkpoint & resume verifies identical window views and retains all identity fencing. New operations continue at the recovered revision.
5. Test corrupt snapshot deliberately flips a byte; the engine rejects it and leaves saved work intact. Download/restore JSON checkpoints via the file picker.

## Reproduce
Node.js 24, Rust 1.90.0 with wasm32-unknown-unknown (rust-toolchain.toml pins it), Python 3 for benchmark reporting. Cargo.lock and package-lock.json included; serde dependencies are pinned. No remote API, GPU or physical device required.
```
npm ci --ignore-scripts
cargo test --locked
npm run wasm:build
npm test
npm run build
npm start
python3 benchmark.py
```
`npm run wasm:build` compiles the actual Rust core and records a SHA256; build.mjs verifies that digest before copying the module. Vercel serves the committed verified module, original Rust source remains alongside it; Vercel does not need an arbitrary persistent Rust runtime. The loader instantiates this WASM and passes JSON through a minimal allocation/run ABI. Node's tests instantiate the same module. ABI pointers are used only by the trusted loader; this is not a security API for arbitrary host callers. `PORT` is optional for local HTTP server at http://localhost:3103; no deployment env vars/secrets.

## Verification and evaluation
12 native Rust tests: independent aggregate oracle; event ordering/watermark boundaries; finalization immutability; duplicate/conflict IDs; operation replay/fencing; 1000 seeded mixed signed codec roundtrips; resume equals uninterrupted execution; every truncated/single-byte-corrupted empty checkpoint rejected; standard CRC32 reference; malformed varints/schema; alert gate; JSON ABI boundary. Five real WASM tests cover a separate JavaScript grouping oracle, resumed/exact-retry equivalence, corruption recovery, invalid input/fencing, finalization/review. Release evidence records clean install/build and public desktop/mobile workflow checks.

`benchmark.py` compares the custom record encoding with a fixed 15-byte little-endian record baseline (5000 events, seed 81026, 10 warmups, 100 repetitions, single-thread release, allocation included). BENCHMARK.json records actual OS/CPU/compiler and p50/p95 encoding timings. Compression size excludes checkpoint metadata; total snapshot bytes are shown separately in the UI. It does not establish network throughput, embedded energy use or production latency.

## Data and limits
Original deterministic synthetic fixture version/seed 81026; three fictional sensors with generated milliunit values and controlled reordered/late/duplicate arrivals. MIT code and sample license. No customer telemetry. Maximum event time 1e9 seconds; not current Unix timestamps. ASCII operation notes/audit semantics, no identity/authentication, no physical device connection, no durable server writes or distributed fault tolerance claims.

[Source](https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-08-Tidemark). Live verified release metadata is recorded in RELEASE.json.
