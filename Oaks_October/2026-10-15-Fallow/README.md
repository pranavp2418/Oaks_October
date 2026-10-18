# Fallow — implementation in progress

Synthetic environmental sampling allocation. The substantive Rust core computes beta-Bernoulli exceedance posteriors and exact budget/capacity/region-constrained sampling plans. The objective is expected posterior-variance reduction, rounded once to integer nano-units; deterministic tie breaks prefer lower cost, fewer samples and lexicographic allocations.

```sh
cargo test --manifest-path engine/Cargo.toml
cargo build --manifest-path engine/Cargo.toml --release
python3 tests/oracle.py
rustup target add wasm32-unknown-unknown
cargo build --manifest-path engine/Cargo.toml --target wasm32-unknown-unknown --release
cp engine/target/wasm32-unknown-unknown/release/fallow_core.wasm public/fallow-core.wasm
node tests/wasm-parity.mjs
```

Verified core only: five Rust groups, 300 independent Python Fraction/exhaustive oracle cases, 100 actual native/WASM parity cases. The WASM has no host imports or network/filesystem tools. Source toolchain Rust 1.99.1; dependency versions retained in Cargo.lock. Bounds: at most 18 sites, 24 samples, six regions, 128 prior observations/site and explicit exact-search state limits. Invalid/infeasible/over-budget input returns an error, never an invented approximate success. Data and tests are synthetic, seed 151027. Independent-site beta(1,1) priors and binary exceedance observations are illustrative and are not scientific validation or safety certification.

A vanilla web UI now connects the Rust worker to persisted observations and calibration versions, exact reviewed sampling proposals, failed/retried/collected jobs, a three-tool deterministic checkpointed investigator, replayable evidence export and a posterior/budget operating view. Five workspace groups and local desktop/mobile browser flows pass (QA_REPORT.md).

Remaining: full live verification, broader keyboard/restore/race and review gates, final launch film and portfolio integration. No model/LLM, shared database, physical instrument or scientifically validated real-world result is claimed. This core is not a completed daily project or agent product. See ACCEPTANCE.md.


## Launch film

[Watch the launch film](https://github.com/pranavp2418/Oaks_October/releases/download/agent-product-films-v1/fallow-launch.mp4) · [Native4K master](https://github.com/pranavp2418/Oaks_October/releases/download/agent-product-films-v1/fallow-launch-4k.mp4) · [Sources, provenance and final QA](launch/FINAL_QA.md). Actual synthetic workflow, edited for time. Application release gates remain separately recorded.
