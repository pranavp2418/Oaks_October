#!/bin/sh
set -eu
mkdir -p wasm
GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w" -o wasm/prism.wasm ./cmd/wasm
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" wasm/wasm_exec.js
sha256sum wasm/prism.wasm > wasm/SHA256
gzip -n -9 -c wasm/prism.wasm > wasm/prism.wasm.gz
