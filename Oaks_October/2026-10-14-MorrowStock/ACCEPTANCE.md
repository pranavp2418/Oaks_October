# MorrowStock acceptance contract — implementation target

An inventory operator needs to turn expiring lots and dated demand into a reviewed, explainable allocation, then safely carry it through picking and exception handling. Synthetic units represent sealed generic grocery cases, not medical products. No purchasing, messaging or physical stock movement is performed.

## Product challenge

The rejected shortlist included another incident-evidence agent (duplicates ProofHarbor), generic workflow/chat orchestration (duplicates BoundedRun), a packing agent (duplicates DockProof), and financial reconciliation (already represented and requires additional domain scope). This product instead joins perishability-aware minimum-cost flow to real inventory reservation, picking, recall and replenishment state. It must remain useful when the model is unavailable; model-generated prose cannot approve stock mutations.

## Connected capabilities

1. Validate and import bounded lots/orders into SQLite, with schema version, constraints and atomic rollback.
2. Compute exact integral minimum-cost allocations with expiry/arrival compatibility, transport/holding cost and priority-weighted shortage penalties. Compare against an independent exhaustive oracle on small instances.
3. Inspect shortage and cost scenarios before creating a snapshot-bound plan; record review and approval against its digest.
4. Reserve inventory atomically, pick allocations through idempotent receipts, inject precommit failure, resume and release unpicked reservations.
5. Trace recalls through reserved/shipped lots; block affected unpicked work and inspect exposure evidence.
6. Create a shortage-based replenishment proposal, review it and receive a validated new lot through an idempotent receipt.
7. Run a bounded inventory agent through actual LangChain tools and LangGraph SQLite checkpoints; capture tool observations, human-review stops, failure recovery and citations. A model-backed path requires a real successful provider request, not a mocked test.
8. Export a hash-linked audit dossier and inspect conserved quantities, shortage priorities, expiry exposure, operation receipts and measured solver timings.

## Architecture and invariants

Python owns the optimizer and SQLite transactions. React is the operator desk. The deployed edition is explicitly single-user: its browser persists the portable operation journal using IndexedDB compare-and-swap; Python reconstructs a request-local database. It is not a multiuser shared database. A local CLI uses a durable SQLite WAL file and supports actual concurrent-process checks. Replayed model outputs are observations only, never authorization. Agent observations and decisions must be inspectable.

Invariant: original lot quantity equals free + reserved-unpicked + picked quantity; no negative quantity. Arrival <= due <= expiry for every allocation. An order is never allocated beyond demand. A reviewed plan is bound to its source inventory version and digest. Duplicate operation identifiers with identical bodies are idempotent; conflicting bodies fail. Human approval is required before reservations. Picking recalled lots fails. A failed transaction changes neither stock nor receipt nor audit head. Model instructions and source text are untrusted data.

## Delivery and release gates

Web-deployed, planned collection ordinal 22; resume-grounded Python/SQL/LangGraph/LangChain/React. Dedicated Vercel Python API and frontend; no persistent-server assumption. No paid resource provision. Model access must fail closed if zero-priced model availability/pricing or existing authentication cannot be verified; no paid fallback. Unavailable model access remains an explicit incomplete gate, not claimed LLM coverage.

Core/unit, exhaustive differential, SQLite recovery/concurrency, API invalid/repeat/failure, clean install/build, actual provider evaluation, and desktop/mobile main workflows must all pass before completion. Each scorecard axis is pending until its concrete implementation/test evidence exists. Performance output records environment, workload seed/size, warmup/repetitions and a baseline; no speedup claim before measurement.

## Art direction (before UI implementation)

Audience: grocery inventory operators. A produce-market dispatch ledger: warm limestone paper, deep olive ink, tomato-red exceptions and crate-yellow selection. Use a wide allocation ribbon and compact lot/order rows, not a dashboard card-grid hero. System serif editorial headings and system sans operational labels; 16px body, 12px uppercase labels, 24/40/64px heading scale; 8px spacing base, 12-column desktop grid and one-column mobile. Native controls remain high contrast. Motion: 180ms opacity/8px transform between workbench panels, 240ms reservation-route emphasis, immediate error feedback; reduced-motion removes transforms. Motion Primitives provenance, actual palette exploration/export, applicable Haikei use, screenshots and performance evidence are release requirements, still pending.

## Engineering review findings and dispositions

Scope fixed by the user's build brief and six-capability standard; no feature cuts. Keep optimizer, storage, agent and API boundaries separate; no cross-project extraction with incompatible state contracts. Architecture concern: serverless ephemeral disk cannot be described as hosted durability — use the honest portable single-user contract above and a real local SQLite mode. Safety concern: model tool selection must never bypass plan review; reserve/pick/receive are explicit operator actions. Test concern: an optimizer can look plausible while consuming expired stock — independent enumeration must include arrival/expiry, reservation and shortage cases. Performance concern: cap graph/input/journal sizes and model steps before execution. All are necessary implementation of the authorized contract, not newly expanded permissions.

## Verification scorecard

| Axis | Status | Required receipt |
| --- | --- | --- |
| Custom core | Pending | Exhaustive allocation oracle and conservation tests |
| Persistence | Pending | SQLite reopen, rollback and concurrent receipt race |
| Integrations | Pending | Real API, LangChain tools, LangGraph checkpoints, provider request |
| Recovery/security | Pending | Stale approval, conflicting receipt, precommit fault, recall guards |
| Evaluation/performance | Pending | Independent oracle and reproducible benchmark |
| Operator workflow/UI | Pending | Main desktop/mobile flow, keyboard/reduced-motion, export |
| Release | Pending | Clean build, sequential source push, source-matched live checks |
