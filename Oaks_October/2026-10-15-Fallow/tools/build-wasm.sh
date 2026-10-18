#!/usr/bin/env bash
set -euo pipefail
cargo build --manifest-path engine/Cargo.toml --locked --target wasm32-unknown-unknown --release
cp engine/target/wasm32-unknown-unknown/release/fallow_core.wasm public/fallow-core.wasm
chmod 644 public/fallow-core.wasm
