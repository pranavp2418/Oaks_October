# TemporalMint

A correction-aware point-in-time feature foundry for synthetic logistics telemetry. It reconstructs what was knowable at each shipment cutoff, exposes exact lineage, audits future-data leakage and previews correction backfills.

## Workflow

Materialize 30 shipment rows from 120 carrier events. Select a row to inspect the five latest contributing revisions. Run the deliberately unsafe mode to count future references. Apply a late correction and compare the baseline/new digests, affected shipments, values and lineage.

## Architecture and invariants

The Python core loads reproducible data into SQLite and materializes each anchor using `event_time <= cutoff`. Latest revisions win by event ID; deterministic ordering precedes window selection. SHA-256 binds the exact ordered output. Backfills compute both versions and return only changed anchors.

Invariants: no safe row contains a future event; every lineage reference resolves to the latest event revision; identical inputs produce identical digests; a correction changes only eligible rows for the same entity after its event time; invalid corrections never replace an output.

The Vercel function reconstructs bounded in-memory SQLite state per request. It does not claim durable server storage. The browser displays returned results but does not implement a substitute feature engine.

## Synthetic data

`dataset()` generates 30 shipments and 120 carrier events from fixed arithmetic seed label **10122026**. Delay values are arbitrary rehearsal minutes. No customer, courier or shipment record is real. Code and original cover use MIT.

## Verify

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run dev
```

Eight test groups include **120 independently recomputed point-in-time oracle comparisons**, future-lineage checks, deliberate leakage detection, correction/backfill bounds, revision precedence, invalid inputs and digest determinism. No environment variables or paid service.

## Limits

This bounded single-process demonstration is not an online feature store, stream processor or production MLOps system. It uses event time only; real deployments also need watermarking, source contracts, access control and durable transactional storage.

[Live demo](https://temporalmint-20261012.vercel.app/) · [Source and verification](https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-12-TemporalMint)
