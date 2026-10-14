# ProofHarbor acceptance contract

Actor: one incident investigator on one browser. Original synthetic evidence, no external tools or paid model. Custom contribution: bounded lexical/entity graph retrieval with provenance paths, current-claim contradiction inspection and quote-exact synthesis. Six connected capabilities: validated evidence import, durable portable workspace, multi-hop retrieval, real LangGraph review interrupts, failed-node restart/reprocessing, export plus retrieval evaluation and traces.

Persistence: hosted API replays a capped browser journal into actual SQLite and LangGraph SQLite checkpoints. The native engine supports a persisted SQLite checkpoint database and reconnect/resume testing. No opaque database uploads, arbitrary queries, external URLs or checkpoint object deserialization. No hosted multiuser/authentication claim.

Invariants: schema and bounds enforced before mutation; imports invalidate old review; superseded citations cannot support current claims; contradictory claims stay visible; every sentence is an exact source quote; no-evidence dossiers cannot publish; review rejects return to review; identical operation IDs replay once and conflicting IDs fail; injected retrieval failure preserves resumable checkpoint; rejected request leaves browser log untouched.

Release gates: independent relevance/path fixtures and exact-quote negatives; process restart, retries, stale input, duplicate collisions, import cycles and request limits; clean Python and Angular builds; real Python API HTTP error/success; desktop/mobile full workflow, keyboard/reduced motion and readable dropdowns; production source identity; one manifest entry in both portfolio views.
