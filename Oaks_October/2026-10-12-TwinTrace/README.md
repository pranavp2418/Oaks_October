# TwinTrace

An inspectable two-tower retrieval laboratory whose actual training and inference core runs in the browser with **TensorFlow.js**. Train separate profile/item towers, project learned item embeddings, measure recall@5, surface hard negatives and run a counterfactual category exclusion.

## Core workflow

The reproducible sample contains 12 profiles, 18 artifacts and 36 positive pairs. Each tower maps six numeric inputs through an eight-unit hidden layer to a four-dimensional embedding. Pairwise logistic loss compares positive dot products against deterministic negatives. After bounded training, the UI calculates exact rankings, recall@5, hard negatives and a digest over learned weights.

Counterfactual mode removes every item in the selected profile's group before ranking. It demonstrates how a policy constraint changes candidates; it is not a fairness certification.

## Invariants and verification

All IDs and pairs are in range; embeddings have fixed shape; rankings use deterministic score/ID tie-breaking; counterfactual results never contain the excluded group; recall is bounded [0,1]; seeded untrained towers have identical weight digests. Seven test groups include an independent loop-based brute-force ranking oracle for **12 users × 7 positions = 84 comparisons**.

## Run

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run dev
```

No environment variables or paid APIs. The production bundle contains the real TensorFlow.js runtime and models, not static precomputed rankings.

## Synthetic data and limits

`sample()` uses fixed arithmetic under seed label **10122026**. Profiles, artifacts, groups and interactions are invented. No user/customer data. This tiny CPU/browser experiment does not establish recommendation quality, fairness, convergence, production latency or scaling. Refresh/reset discards weights; no server storage. Code and original cover are MIT licensed.

[Live demo](https://twintrace-20261012.vercel.app/) · [Source and verification](https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-12-TwinTrace)
