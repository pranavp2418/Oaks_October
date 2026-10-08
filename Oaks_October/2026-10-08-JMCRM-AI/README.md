# JMCRM-AI Revenue Copilot

An explainable jewelry-sales CRM demonstration: rank inventory-backed signals, review customer context, edit an outreach draft, progress a conversation, inspect stock, and replay the journal. No outreach is sent and no real customer records are included.

This completes the previously described prototype for a public portfolio demo. Its scoring, message templates, domain models and EF Core schema were recovered from the owner's original JMCRM source. The original repository remains unchanged. The public snapshot replaces the MVC host with a deployable function adapter and fixes draft overwrites, name-dependent selection, skipped workflow stages and repeated-operation handling.

## Walkthrough

1. The actual C# backend opens an in-memory SQLite database, applies the relational schema, seeds 18 fictional customers and 12 products, and scores six opportunity categories.
2. Filter and search the ranked queue. Select a recommendation to read why it was ranked and the suggested next action.
3. Edit and save a draft. Refreshing opportunities preserves edited drafts and workflow status and creates no duplicate recommendation keys.
4. Move New → Contacted → Replied → Appointment booked → Won. Dismissal is supported before a win; dismissed entries can return to New. Closing a sale decrements stock once. Out-of-stock wins and skipped stages are rejected.
5. Open Customers, Inventory and Audit trail. Export a workspace journal and import it to replay the same model and compare its hash.

## Architecture and persistence

The browser sends its operation journal → a Node.js 24 Vercel function runs a self-contained .NET 10 executable → C# reconstructs EF Core/SQLite, validates the next operation inside a transaction, and returns canonical records and receipts. Node is an HTTP/IPC adapter, not a replacement scoring engine. The same real native executable runs locally and on Vercel; no persistent arbitrary .NET server is assumed. Standard Vercel Functions support native child processes and the bundle is below the standard size limit; live compatibility must be verified at deployment.

The hosted workspace is **browser-local**. Its journal is persisted in localStorage; SQLite is reconstructed for every request and discarded afterward. No shared cloud database, login, production CRM installation or server-side durability is claimed. Web Locks serialize writes across tabs where supported; storage events reload the latest journal. The fallback without Web Locks is one active tab. Revisions and operation-key receipts detect repeats and conflicts within the supplied journal. They are not account authentication or cross-device locking. Hash chains support export comparisons, not tamper-proof identity.

The original `(CustomerId, ProductId, OpportunityType)` database uniqueness constraint remains. C# validates stock, legal transitions, draft lengths and operation keys. Journal limit: 500 operations; request limit: 1 MB. All six category eligibility checks are original rule-based recommendations. Templates are deterministic assistance; no remote LLM is called.

## Stack and local commands

C#, .NET 10, EF Core 10.0.0, SQLite, Node.js 24, plain JavaScript/CSS and SVG. Dependencies are pinned in the NuGet and npm lockfiles. Build downloads official SDK 10.0.401 and verifies its SHA512 from Microsoft's release metadata. No Docker, paid database or AI API is required.

```sh
npm ci --ignore-scripts
npm run build
npm test
npm start
```

Open http://localhost:3108. `JMCRM_SDK_PATH` optionally points to an already installed .NET SDK directory; `JMCRM_PORT` optionally changes the local server port. Neither contains credentials. No deployment secrets are required. Runtime and build output are ignored; Vercel builds them from source. Deployment config includes the published native runtime in `api/workspace.js`.

## Data and limitations

Synthetic deterministic seed `8102026`, model date `2026-10-08`; `WorkspaceEngine.Seed` is the generator. Emails use example.test and names explicitly say Demo Customer. Currency is USD with decimal values; inventory units are integers. Model dates are fixed for reproducible demonstrations, rather than moving birthdays and history every day. Potential revenue sums overlapping recommendations and is **not a forecast**. Synthetic activity labels and sequence timestamps are replay markers, not records of real communications.

## Verification

`npm test` runs the real compiled core: six tests cover deterministic six-category creation, relational uniqueness, refresh preserving drafts and status, repeated keys and revision conflicts, full state progression/stock decrement, illegal transitions, missing records, stock/draft bounds and HTTP failure paths. Clean restore/build and public browser/API evidence are recorded in the root ledger after release. The test suite has no mocked scoring implementation. Do not infer production scale or performance guarantees from this bounded demo.

Source: https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-08-JMCRM-AI

The verified live link and deployment commit are recorded in `RELEASE.json` after publication.
