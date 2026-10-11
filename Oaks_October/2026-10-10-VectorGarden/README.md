# VectorGarden

A working small-model training lab: initialize two seeded neural towers, train with contrastive pairs, inspect the real loss curve and embedding projection, check analytical gradients, evaluate held-out retrieval, export a complete checkpoint, pause, reload and resume. Actual TypeScript neural-network mathematics runs in a Web Worker; React presents the results. No external model API, precomputed training playback or GPU.

## Technical contribution
Two independent 8→12→3 networks (294 total parameters), tanh hidden activation and normalized output. Each training step selects one query from each of eight synthetic classes and aligns it with its item feature vector. Symmetric row/column InfoNCE uses stable log-sum-exp and cosine scores/temperature. `src/engine.ts` implements the forward pass, normalization derivative, full manual backpropagation, global gradient-norm clipping, Adam bias correction and deterministic XORShift32 sampling.

Checkpoint version/dataset ID, weights, Adam first/second moments, RNG state, step, rate, temperature and complete loss history are validated before recovery/training. A JSON-roundtripped checkpoint resumes bit-identically to uninterrupted120-step training in the verified runtime. Nonfinite values, shape errors, negative variance, inconsistent histories and unsupported dataset/version are rejected. Failed core requests do not mutate the input checkpoint.

## Workflow
Plant a seeded model (active rate/temperature shown explicitly) → Train120 or Step10 → inspect holdout recall@1/MRR and per-class outcomes → select a held-out query and inspect ranked cosine results → Check the gradients → Export checkpoint/evaluation → Pause/reload/recover → resume with the same moments and RNG. Controls are keyboard operable, loading states disable overlapping actions, and a request generation fences messages from obsolete workers. Cancellation retains the last successfully saved10-step chunk. Browser-local storage snapshot checks reject a newer other-tab model; there is still a check/write race across tabs, so simultaneous shared training is not promised.

A 2D plot displays only the first two coordinates of three-dimensional normalized embeddings. Actual ranking uses all three coordinates. Loss history is the pre-update training loss; evaluation is recalculated from the resulting weights. Cosmetic orbit art is not a neural-network diagram.

## Data and boundaries
`dataset()` reproducibly generates original synthetic numeric vectors with seed10102026: eight unique item classes,64 training queries,32 disjoint held-out queries. Query feature coordinates use a fixed permutation and bounded noise; train/holdout share that generative distribution. There are no language embeddings, real products/customer data, real semantic search, generalization-to-new-class claims or foundation-model training. Every batch has one pair per class, avoiding false-negative duplicated classes. The dataset is generated locally from the original source (MIT); no third-party dataset/license.

The lab supports up to5000 training steps; each core call handles at most500; browser worker updates/persists in10-step chunks. Rate0.0001..0.1, temperature0.05..1, seeds1..2^32−1. Checkpoint imports cap750KB. Persistence is browser localStorage only, no account/cross-device service. Storage loss loses unsaved history; exports support recovery. Resource/quality results apply to this bounded synthetic task; no hardware throughput or production-readiness claim.

## Verification/local commands
Node24; pinned React19.1.1, Vite7.3.7, TypeScript5.9.2 and type packages in lockfile. No environment variables/secrets.

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run dev
```

Eight core tests: analytical versus finite-difference gradients at42 sampled parameters across three seeds (126 derivative comparisons, both towers); an independent loop-based forward/softmax loss oracle; exact checkpoint resume including moments/RNG; actual held-out improvement; disjoint deterministic split; schema/nonfinite/resource rejection; output normalization and seed reproducibility. `EVALUATION.json` records actual before/after120-step quality and gradient error on the original dataset. These are measured task results, not success claims copied from a target. Browser/live verification is recorded in the collection run after deployment. Mobile viewport testing does not establish physical-device performance.

Source: https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-10-VectorGarden
Demo: https://vectorgarden-20261010.vercel.app/
