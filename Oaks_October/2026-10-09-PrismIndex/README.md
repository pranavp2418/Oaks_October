# PrismIndex
An exact numeric-descriptor search studio with a custom Go vantage-point tree, deterministic tie order, radius-component suggestions, reviewed duplicate decisions, canonical asset export, index maintenance and journal recovery. The actual core is Go/WebAssembly in the browser; there is no imitation JavaScript search API.

## Workflow
Search a 2D synthetic descriptor, inspect nearest assets and visited-node count. Adjust the radius to find connected candidate groups. Review a pair as duplicate/distinct with a note. Only duplicate reviews affect the canonical export. Upsert/delete assets rebuild the index and invalidate reviews; reload recovers the journal. Export the workspace or canonical assets and validate recovery through the JSON panel.

## Algorithm/invariants
Euclidean metric and deterministic median radial partition. Triangle-inequality pruning uses conservative floating-point tolerance on radius boundaries; nearest hits are sorted by distance then ID. Native tree owns coordinate copies. Journal revisions and operation IDs fence stale/conflicting retries. Pair decisions are explicit; radius suggestions never automatically delete assets. Canonical representative is the lexicographically first ID per reviewed duplicate component. Radius suggestions use pairwise union-find; search uses the VP-tree. The transitive radius group is not a guarantee every pair is within the radius. A duplicate chain can connect assets indirectly; reviewer is responsible for group meaning.

## Reproduction
Go 1.25.2 and Node 24: `go test ./...`; `sh build-wasm.sh`; `npm ci --ignore-scripts && npm test && npm run build`. Deploy `public/` to Vercel. Checked-in WASM is checksum-verified during every deployment. Go standard library only, no external modules, thus no go.sum. WASM support runtime from official Go distribution retains its license header. No environment variables or paid services.

## Evidence
400 native query cases across 1/2/6/16 dimensions compare with a brute-force oracle; ties, structural partition, mutation ownership, schema rejection, replay and reviewed export tests. 100 additional actual-WASM queries compare with an independent JavaScript exhaustive oracle. Run `go run ./cmd/bench` for a native query benchmark; `BENCHMARK.json` contains only measured values with runtime/OS/workload/warmup/repetitions. Native timing is not browser WASM timing and no production-throughput claims are made.

## Data and limits
82 deterministic synthetic descriptor vectors, formula x=(i*17)%101, y=(i*31)%97 plus two nearby variants. No real images, embeddings, recognition model or customers. Euclidean descriptor proximity is not semantic similarity. Points limited to 2000, 1–16 dimensions and 500 journal events; exact VP-tree worst case is linear. In-memory core and browser-local persistence only; no shared authenticated database. Plot illustrates two dimensions only. Source/assets MIT licensed; Go WASM runtime carries BSD license.

Source: https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-09-PrismIndex
Demo: https://prismindex-20261009.vercel.app/
