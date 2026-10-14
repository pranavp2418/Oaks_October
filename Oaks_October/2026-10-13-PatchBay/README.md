# PatchBay

A useful offline dependency-remediation workbench, written in Kotlin/JVM with a transactional SQLite database. It answers which runtime applications are exposed, how each exposure is reachable, and which compatible remediation bundles maximize covered severity within a budget. It persists proposals, explicit reviews, application rehearsals, rollback and audit evidence.

**Code-only native tool.** No hosted demo or external scanning service is required. No real package installation, vulnerability certification or automatic security fix is claimed.

## Walkthrough

Requires Java 17+ and Python 3 for the reproducible build/helper and independent integration checks.

```sh
python3 tools/dependencies.py
python3 tools/build.py
./patchbay --help
./patchbay workspace.db import data/sample.json import-one
./patchbay workspace.db analyze
./patchbay workspace.db plan 9 proposal-one
./patchbay workspace.db approve plan-proposal-one reviewer-two "Runtime exposure and constraints checked." review-one
./patchbay workspace.db apply plan-proposal-one fail-one --fail
# The injected pre-commit failure exits 2; no mutation or receipt is committed.
./patchbay workspace.db apply plan-proposal-one apply-one
./patchbay workspace.db status
./patchbay workspace.db export evidence.json
./patchbay workspace.db rollback plan-proposal-one rollback-one
python3 tests/verify.py
```

The synthetic fixture has two application roots, a cyclic dependency component, three advisories and four proposed action bundles. A development-only advisory is excluded from runtime exposure. Budget 9 selects `combined-upgrade` at cost 9 and covers all three runtime root/advisory exposures. Costs are synthetic effort units, **not financial prices**. Re-run a command with the same receipt ID and identical arguments to obtain the same stored response without another mutation. Reusing it for a different request rejects.

`export` writes the real persisted snapshot, path analysis, plan status/review, integrity results and a SHA-256 receipt to the requested file through an atomic rename. All SQLite mutations are real; package remediation is explicitly a rehearsal over supplied advisory data.

## Custom core

`src/Graph.kt` builds the runtime-only dependency graph. Tarjan's algorithm identifies strongly connected components; per-root BFS finds deterministic shortest exposure paths, including through cycles. Development edges are counted but omitted from this analysis.

Remediation is a weighted set-cover problem over reachable `(root, advisory)` pairs. Supplied action bundles declare which advisories they fix, effort cost and pairwise incompatibilities. A bounded branch-and-bound search enumerates compatible subsets; its upper bound includes every remaining bundle's possible coverage. The objective first maximizes covered severity within budget, then minimizes cost, then chooses a deterministic lexicographic tie break. It never claims an arbitrary budget covers every finding. Twenty actions cap the exact exponential search; the input graph supports 500 nodes, 5,000 edges and 100 advisories.

## Persistence and failure semantics

`src/Store.kt` uses SQLite JDBC: WAL, FULL synchronous writes, foreign keys, a five-second writer lock timeout and `BEGIN IMMEDIATE` around each mutation. Snapshot revision/hash bind plans to graph inputs. A different import makes old drafts stale. Approval is a **recorded local review**, not authenticated identity; operating-system file access is the security boundary.

Apply updates the synthetic advisory model only after an approved current plan. It stores the prior graph in the same database transaction. Failure before commit rolls back the graph, plan, audit and receipt together. Rollback is allowed only for the immediate applied revision, preventing it from discarding newer imports. A SHA-256 predecessor chain detects audit changes, but is unkeyed and is **not tamper-proof against someone who can rewrite the whole database**. `PRAGMA integrity_check` and snapshot hashes supplement it. Schema version 1 is explicit; future schema migrations are not implemented.

## Build and dependencies

`dependencies.lock.json` pins the compiler and every runtime JAR with SHA-256 values. `tools/dependencies.py` downloads from the official Maven Central registry and verifies those values. No secrets or cloud resources. `PATCHBAY_DEPS` may point to an already verified JAR directory. Kotlin compiler 2.2.20 targets JVM 17. Source, dependency locks and complete workflows are included; generated JARs and workspaces are ignored.

## Verification

`tests/Oracle.kt` performs **300 independent comparisons** against Floyd–Warshall reachability and exhaustive remediation subsets, plus path validity and cycle structure checks. The independent algorithms do not call the production traversal/search for their expected results.

`tests/verify.py` runs actual separate CLI processes against persisted SQLite: import, exact replay, exposure analysis, proposal, review, rejected early apply, injected pre-commit failure, apply, repeated apply, immediate rollback, evidence export, stale-plan refusal, receipt collisions and malformed graph input. Six JVM processes racing on one receipt commit exactly one mutation. Killing an independent SQLite writer with an open staged transaction leaves no visible change. Corrupted audit data is rejected. See `VERIFICATION.json` for the actual clean-environment evidence.

## Scope and provenance

[Source and this walkthrough](https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-13-PatchBay#walkthrough)

`data/sample.json` is original synthetic data, seed **13102026**, MIT licensed with the original code. Advisory IDs are fictional. This is neither an SBOM standard implementation nor a package manager, CVE feed, scanner, authenticated multiuser service or security certification. Supplied bundles' effectiveness is assumed by the model; verify real package updates independently. Local network downloads are limited to build dependencies. No telemetry leaves the CLI.

## Release review and performance

Approval receipts now use JSON tuples, preventing ambiguous reviewer/note delimiters. Status and evidence export run inside a consistent SQLite read transaction; four witnessed concurrent imports returned four consistent snapshots. Coverage is compacted by advisory with exact exposed-root counts and severity weights; precomputed suffix sets and admissible equal-weight cost pruning preserve the exact objective. The oracle now verifies the complete SCC partition and shortest distances as well as reachability and subset optima.

`tests/review-benchmark.json` and `tests/benchmark-environment.json` record one warmup and three timed repetitions, preserved original source and current source hashes, an independent known optimum, and limits. The repeated-bundle 1-root/100-advisory/20-action workload moved from median 11,859 ms and 2,097,151 states to 3.50 ms and 41 states. Maximum supported exposure fanout (500 roots × 100 advisories) returned the same known optimal bundle in median 270.58 ms; the original was censored at 20 seconds. These are bounded synthetic workloads, not general complexity or performance guarantees. Exact planning remains exponential in the worst case.
