#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
fallow_cargo_root="${CARGO_HOME:-$HOME/.cargo}"
export RUSTFLAGS="--remap-path-prefix=$fallow_cargo_root=/cargo --remap-path-prefix=$PWD=/fallow"
cargo build --manifest-path engine/Cargo.toml --locked --target wasm32-unknown-unknown --release
if [[ "${1:-}" == "--check" ]]; then
  cmp engine/target/wasm32-unknown-unknown/release/fallow_core.wasm public/fallow-core.wasm
  exit 0
fi
cp engine/target/wasm32-unknown-unknown/release/fallow_core.wasm public/fallow-core.wasm
chmod 644 public/fallow-core.wasm
