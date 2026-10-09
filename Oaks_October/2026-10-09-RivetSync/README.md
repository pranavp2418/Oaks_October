# RivetSync
A construction master-data merge workshop: merge field edits against a common ancestor, resolve divergent modifications and delete/modify conflicts, validate parent dependencies, preview changes, commit atomically and undo the latest accepted merge.

## Core and architecture
Python three-way merge plus SQLite foreign-key transaction. Field rule: same edits agree; one unchanged side takes the changed side; competing changes need explicit current/incoming review. Record insertion/deletion uses record-level conflicts. Kahn-style dependency ordering detects cycles and dangling references, including those created only by combining individually valid snapshots. A preview hash fences changed current snapshots. Revisioned operation IDs reject stale/conflicting retries; exact retries replay once. Each transaction produces before/after hashes and note.

The browser persists seed + operation journal; serverless Python reconstructs a fresh in-memory SQLite database per request, executes real transactions and returns verified state. No shared hosted database or authenticated users are claimed. Cross-tab conflict control is local to submitted journal, not a multiuser concurrency service.

## Walkthrough
Load conflicting sample. Preview highlights `lift.capacity`; choose current or incoming. Commit with review note, inspect changed records/audit, reload and undo latest merge. Export/recover full workspace; audit can be exported separately. Invalid input leaves saved records intact. Changing input invalidates the current preview.

## Local commands
Python 3.12+, Node 24: `npm ci --ignore-scripts && npm test && npm run build`. `npx vercel dev` serves the Python function and static UI. No environment variables, third-party Python packages or paid resources required. Standard-library dependencies are pinned by the documented runtime; npm lockfile included.

## Tests and limits
Tests cover field conflicts, deletion versus modification, merge-only cycles/orphans, SQLite materialization, preview CAS, replay/idempotency/undo and schema failures. 400 seed-109 field cases compare against an independent scalar oracle; input permutations check dependency-order independence. Browser/live evidence recorded in collection run. Maximum 100 records and 100 operations; parent hierarchy only, no real vendor adapters or financial records. UI localStorage loss loses history. No production-scale/performance claims.

Synthetic dataset `data/sample.json`: fixed deterministic fixture, schema id,parent,name,capacity, with three imaginary construction records; no random generator needed. Original source/assets MIT licensed.

Source: https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-09-RivetSync
Demo: https://rivetsync-20261009.vercel.app/
