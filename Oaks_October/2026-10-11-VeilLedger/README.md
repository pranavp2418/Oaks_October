# VeilLedger

A complete **synthetic disclosure rehearsal**: minimize a case's record/field scope, prepare an exact projection, bind two independent reviewer identities to its digest, issue a checksum receipt, withdraw it and recover the entire audit history.

[Live workbench](https://veilledger-20261011.vercel.app/) · [Source](https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-11-VeilLedger)

## Walkthrough

1. As synthetic analyst Avery, choose user-1, activity/subject and sequence range 0..19. Create case-001 and prepare it: **4 included / 36 excluded** sample activity records.
2. Switch to Blair and approve the exact digest. Switch to Casey and approve independently. Neither reviewer can approve twice. The analyst cannot review their own case; the operator cannot release before both approvals.
3. Switch to Devon, release, download the receipt and verify it using the file control. Reload: workspace and receipt remain.
4. Revoke with a reason: receipt contents remain immutable, while the audit records withdrawal. A downloaded artifact cannot be remotely erased by this rehearsal.
5. Create a second case, prepare it, return it for revision as a reviewer, then narrow its fields as the analyst and reprocess. Any scope change discards the previous projection/approvals. Old digest reviews conflict.
6. Export/recover workspace. Invalid imports and tampered receipts are rejected without replacing current workspace.

## Architecture

The Python REST function replays a bounded, versioned operation log into an in-memory SQLite database for every request. Tables model cases, independent approvals, idempotent operations and hash-linked audit entries. Actions run under `BEGIN IMMEDIATE`: validation, projection, approvals, receipt, audit and operation result commit atomically. The test fault injector aborts after all writes and verifies no table changes survive. A projection is exact subject + inclusive sequence filtering plus a sorted field allowlist; it never exports omitted record IDs, sequence or undeclared fields.

Case states: draft → prepared → approved (two reviewers) → released → revoked. Review rejection returns to draft; narrowing before release also returns to draft and invalidates every approval. Case versions and global revisions fence stale actions. Operation IDs replay identical results or reject differing content. A released receipt binds scope, data, dataset digest, both reviews and case version. The audit chain ties every transition to the previous hash.

**Persistence boundary:** the browser owns the durable localStorage operation log and exports; the Python/SQLite database is reconstructed per request, never assumed persistent in Vercel `/tmp`. Inputs are reproducible samples. Synthetic actor selection rehearses role and separation rules, **not authentication**: a client can choose any actor or rewrite its own log. Revisions detect conflicting snapshots; browser string checks detect another tab before replacement but are not atomic multi-client isolation. The API has bounded request/log sizes and returns 400/409/405 paths. Do not upload real personal or request information.

## Integrity and limits

SHA256 and the hash-linked journal detect accidental changes relative to saved values; receipts are **not signed or independently attested**. A caller capable of rewriting an entire log can recompute hashes. No encrypted transfer, verified requestor, shared tenant access control, retention policy, legal compliance or production certification is claimed. The project is a useful end-to-end local simulation of minimization/review mechanics, not a legal decision engine.

## Synthetic data / license

`dataset()` deterministically produces 40 original sample activity records (seed label **10112026**, fixed arithmetic construction). Five synthetic subjects, login/export/view, east/west, desktop/mobile and `.invalid` email addresses. Sequences are synthetic ordinal positions, not external timestamps. All code, sample generator and cover are MIT (`LICENSE`); no third-party dataset or credentials.

## Local setup

Python 3.12+ (standard library SQLite), Node 24 / npm; no external runtime Python dependency:

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run dev
# http://127.0.0.1:8132
```

`api/workspace.py` is the Vercel Python `BaseHTTPRequestHandler` function. `local.py` serves the same actual dispatch logic for local browser checks. Frontend is accessible HTML/CSS/JavaScript with role-dependent actions, pending/error/empty states. No environment variable or paid service required.

## Verification

Nine test groups include 100 independent projection oracle scopes, independent review/digest binding, idempotent replay, stale version/revision, scope invalidation, rejection/reprocessing, immutable release, revocation, receipt tamper detection, hash-chain recovery and injected transactional rollback. `VERIFICATION.json` records actual desktop and 390px mobile browser flows, including real HTTP 409/405 responses. Mobile is a viewport simulation, not a physical device. No performance or real-world legal suitability claim.
