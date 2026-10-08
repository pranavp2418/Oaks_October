# FolioTrace

A document retrieval workbench where every result preserves a source page, normalized region, block identity and document version. Search twelve original technical notes, inspect regions, correct extracted text, review, and publish a revision. Search indexes only published documents.

## Engineering core
Python inverted postings and a BM25 implementation (`k1=1.2`, `b=.75`) provide bounded, explainable lexical ranking with per-term score contributions. Candidate enumeration visits term postings, not all documents. `Index.upsert` removes old postings and updates token totals before inserting a replacement; incremental results are compared with a clean rebuild. The public stateless API rebuilds an index from the journal to avoid stale search data.

Two-column reading order uses explicit geometric heuristics: page, full-width headings, left column, right column, vertical position. It preserves supplied normalized source boxes. This is NOT general layout detection, OCR, semantic embeddings or LLM answer generation. Multi-column/table/rotated reading order is outside the model. Search is ASCII lexical tokenization, no stemming or phrases. Any/all term modes are supported. At most 10 results; candidates may be larger.

State is a document review machine: published → corrected draft → reviewed → published. A further correction returns any version to draft. Draft/reviewed documents leave retrieval; publication requires a meaningful review note. Immutable baseline documents plus revisioned operations reconstruct current text and audit history. IDs deduplicate exact retries, conflicting bodies fail, stale revisions fail. SQLite enforces audit identity and revision constraints and supplies a separate token-membership oracle. SHA256 chains identify accidental journal changes; they are NOT authenticated signatures. Browser saves the input journal. Each API call creates an in-memory SQLite database; no shared durable server storage or authentication.

## Walkthrough
- Search `pump bearing vibration`: F04 is the top result; inspect each term contribution and source-region citation.
- Open the Source desk, select F04/B1, correct its text and save. F04 is now a draft and absent from search.
- Enter a review note, mark reviewed, then publish. Search results now cite the new version.
- Review the revision journal and export the collection. Restore through the file picker; validation/replay completes before replacement.
- Expand the six-query evaluation. The synthetic fixture's MRR and recall@3 are both 1.0; these are toy relevance labels, NOT real-world retrieval accuracy.

## Reproduce
Node.js 24, Python 3.12+; all Python dependencies are standard library. Lockfile included; requirements.txt documents no external packages.
```
npm ci --ignore-scripts
npm test
npm run build
npm start
```
Local http://localhost:3102; `PORT` optional for local server only. POST data/seed.json to /api/workspace. Vercel executes the actual Python core via api/workspace.py and serves static UI from public/. No secrets or paid APIs.

## Verification
11 tests: independent BM25 score calculation, SQLite candidate oracle, incremental vs full rebuild, all-term filtering, source citation fidelity/reading order, correction-review-publication and replay recovery, illegal transitions, duplicate/conflict IDs, invalid schema preservation, six-query synthetic evaluation, actual HTTP 200/400/405/409. Clean build/install and desktop/mobile/public API evidence are recorded in RELEASE.json. 390px harness is a viewport simulation, not physical mobile testing.

## Data and license
Hand-authored original synthetic fixture version 81026; 12 docs, 36 blocks, normalized boxes and six query relevance labels. No real vendor or customer documents. All project code and samples use the MIT license. No dataset attribution required. Limited to 80 docs × 100 blocks and bounded journal/body sizes. No data ingestion integrations, collaborative review or authorization claims.

[Source](https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-08-FolioTrace). Demo/release details recorded in RELEASE.json after live checks.
