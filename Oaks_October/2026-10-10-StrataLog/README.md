# StrataLog

A complete local staging store for ordered change streams. Import a bounded TSV batch, enforce contiguous source offsets, materialize keys and tombstones, inspect the recovered state, compact to a checksummed checkpoint, and export a reproducible destination snapshot. This is intentionally a **GitHub-only CLI/library**, not a hosted service.

## Walkthrough
Requirements: Linux, Elixir 1.14+, Erlang/OTP 25+, `flock` (util-linux), Python 3.12+ for the independent CLI verification. No third-party Elixir dependencies or environment secrets.

```sh
mix deps.get
mix test
mix escript.build
bin/stratalog ingest demo-store data/sample.tsv
bin/stratalog ingest demo-store data/sample.tsv # applied=0, duplicate replay
bin/stratalog inspect demo-store
bin/stratalog checkpoint demo-store
bin/stratalog get demo-store parts P-101
bin/stratalog export demo-store demo-output.tsv
python3 tools/verify_cli.py
```

`data/sample.tsv` is an original deterministic synthetic fixture: five events across two streams, no random generator required. Schema (six TAB-separated columns): `id`, `stream`, positive contiguous `offset`, `put|delete`, `key`, `value`. For delete, the value column is ignored. Empty values are valid for put; tabs/newlines/NUL are prohibited in tokens/values. Lines beginning `#` are comments. At most 1,000 events per imported atomic batch, 200 bytes per identifier, 10KB per value, 4MB per frame and 100,000 retained dedup IDs. IDs are global to the store. Each stream begins at offset1; exact retries do not advance offsets. A repeated ID with different content fails the whole batch.

Example exported snapshot:

```tsv
locations	RACK-A	ready
parts	P-101	bracket-revC
```

## Core and invariants
The actual core is **Elixir/OTP GenServer**. Calls serialize in one actor, which validates the complete batch against a copy of state before writing. Every nonempty accepted batch is one `SLG1 | length:u32 | CRC32:u32 | Erlang term` WAL frame; file sync completes before acknowledgement. Revision increases once per new batch. Duplicate IDs retain SHA256 event signatures across checkpoints. Tombstones remove materialized rows without removing replay fences. Imports are bounded and safe term decoding never loads arbitrary code.

Startup scans framed records, checking CRC, revision and event semantics. A truncated final header/payload is discarded as a whole, and the file is truncated to the last valid boundary before any new append. A complete checksum mismatch or invalid record fails closed without modifying that file. After a process stops between fsync and acknowledgement, the next invocation recovers the committed batch; the caller can safely retry. Storage write/sync or checkpoint failures stop the actor so it cannot continue with uncertain state.

Checkpoint writes/syncs a complete replacement, then atomically renames it over the WAL. It retains offsets, rows and all dedup IDs. This reduces frame/replay overhead, **not** dedup-memory growth. The CLI wrapper takes a Linux `flock` on a stable lock-file inode for the entire invocation, excluding concurrent CLI writers across OS processes. Library registration only excludes actors in the same Erlang node; direct multi-process library clients must add the same external lock. No distributed consensus or multi-node durability guarantee.

## Verification and failure semantics
`mix test`: 10 independent behavioral tests, 400 seeded changes versus a separate map oracle, every incomplete-prefix length of a second frame, exact/conflicting retries, delete/checkpoint/restart, recovery and 40 concurrent actor calls. `tools/verify_cli.py` executes nine clean-store command-line scenarios, including a real VM exit86 after fsync, stale retry, exclusive process lock, partial-tail repair and corruption preservation. `VERIFICATION.json` records actual commands/runtime/results. No unmeasured performance claims.

`STRATALOG_FAULT=after_sync` is a deliberate crash-injection variable used only by the verification tool; ordinary usage leaves it unset. No other application variables are required. Error exits: 2 for invalid data/store, 1 for a busy CLI lock, 86 for the injected crash. Standard output contains explicit commit/recovery/export results; errors go to standard error. A crash leaves the OS lock automatically released.

Boundaries: local disk only; all rows/signatures in memory; no live database/Kafka connector or remote replication. CRC detects accidental corruption, not adversarial tampering. Checkpoints sync file contents but do not fsync the parent directory: OS/power-loss durability of rename is outside the verified contract. Only process-interruption behavior was tested. TSV export uses temporary-file rename but is not a cross-file transaction with the WAL. The bounded staging store is useful for sample/controlled pipelines and is not certified production infrastructure.

Original code, synthetic fixtures and SVG cover are MIT licensed. Source and reproducible walkthrough: https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-10-StrataLog . No live demo exists by design.
