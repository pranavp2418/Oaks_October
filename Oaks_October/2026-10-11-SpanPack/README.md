# SpanPack

An original lossless telemetry codec and failure-recovery workbench. Its substantive core is **Zig 0.14.1**, compiled to `wasm32-freestanding` with `ReleaseSafe`. The web UI calls the actual encoder, strict decoder, salvage parser and random-seek engine; there is no fake API or JavaScript replacement codec in the product.

[Live workbench](https://spanpack-20261011.vercel.app/) · [Source](https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-11-SpanPack)

## Walkthrough

1. Generate a stepped sensor signal. Encode & verify asserts exact equality for all inputs. Compare raw and archive byte counts.
2. Select a block: inspect its byte range and raw/delta-RLE choice. Read an arbitrary sample index; the engine decodes only the containing block.
3. Download the binary `.spk` archive. Flip a payload byte in a selected block; strict decode rejects it without committing partial output.
4. Salvage intact blocks. Only damaged block positions become `null` and their indices remain fixed. Export preserves the damaged original bytes rather than silently filling the gaps.
5. Enable the explicit quarantine-on-import option to recover damaged archives; unknown input samples stay `?` until deliberately replaced. Recover the original archive, reload the page and change block size/pattern. Noisy data can be **larger** than raw storage; the interface reports actual overhead instead of assuming compression.
6. Run the in-browser benchmark for the current input. Timing includes JS/WASM transfer overhead, warmup/repetitions and the raw-copy baseline. Invalid samples, archives and seek indices have clear errors.

## Core and invariants

The codec accepts 1..4096 signed i32 values and independent blocks of 16..256 samples. It chooses the smaller of raw i32 encoding or first-value + zigzag delta varints with zero-run encoding. All delta math uses i64 so transitions between i32 extrema are lossless. Canonical varints, positive bounded runs, bounded arithmetic and exact payload consumption prevent malformed encodings from escaping their block.

Each block has CRC32. Metadata has its own CRC32; the directory must be contiguous, in-bounds and cover exactly the archive. A bad metadata/directory checksum rejects salvage, because sample boundaries cannot be trusted. Intact metadata + damaged payload allows explicit block quarantine. Strict decoding writes a staging buffer and commits only if every block validates. Random seek validates the directory and the requested block, rather than claiming every unvisited payload was verified.

Buffers are fixed and bounded (4096 samples / 65536 archive bytes). No allocator, persistent server, hardware device or production reliability claim. Browser-local persistence stores the original archive; compare-before-write detects intervening tab edits but is not an atomic distributed transaction. CRC32 is for accidental corruption **not adversarial authenticity**, encryption or attestation.

## Binary format (little endian)

| Region | Layout |
| --- | --- |
| Header, 16 bytes | `SPK1` magic; u32 sample count; u16 block size; u16 block count; u32 metadata CRC32 |
| Directory, 12 bytes/block | u32 absolute payload offset; u32 byte length; u32 payload CRC32 |
| Payload header, 4 bytes | u16 sample count; u8 mode (0 raw / 1 delta); u8 reserved=0 |
| Raw body | sample count × little-endian signed i32 |
| Delta body | signed i32 first sample; tag 0 + positive uvarint zero-run length, or tag 1 + nonzero zigzag uvarint delta |

Metadata checksum includes header with checksum bytes zeroed plus the directory. Payload CRC includes its four-byte header. There is no implicit recovery from corrupted metadata and no silent repaired sample values.

## Reproducible build

Node 24, Python3.12 and Zig0.14.1. Install a pinned compiler (build dependency only):

```sh
python3 -m pip install -r requirements-build.txt
python3 compile.py
npm ci --ignore-scripts
npm test
npm run build
node benchmark.mjs
npm run dev
# http://localhost:8133
```

Alternatively set `ZIG=/path/to/zig` for `compile.py`. No environment secrets or paid services. Native `zig test` and the freestanding WASM build run from the same source. `codec.wasm.b64` is the checked-in compiled artifact for Vercel's static build; `codec-artifact.json` binds source and WASM SHA256 and compiler/target. The build refuses stale hashes. Recompile the core after any source change; never hand-edit the artifact. Vercel does not need an unsupported persistent Zig server.

## Verification and measured tradeoffs

Two native Zig tests plus five WASM test groups. **180 seeded workloads** compare exact roundtrip, independent JavaScript reference decoder (test-only) and three seek positions each. Boundary values include both i32 extrema. Tests corrupt every block, metadata bytes, truncations and trailing bytes, re-checksum malformed semantic payloads, and verify strict output stays unchanged. UI tests exercise real WASM on desktop/390px mobile, import/export/reload, salvage and invalid inputs.

`node benchmark.mjs` reproduces `BENCHMARK.json`: AMD EPYC 9V74 shared Linux x64 container, Node24.19.0, Zig0.14.1 ReleaseSafe WASM, 4096 samples, 64-sample blocks, seed10112026, 30 warmups / 200 repetitions, median and p95 with an uncompressed raw-copy baseline. Actual measured sizes: stepped 1676 vs raw16384 bytes; ramp9360; noise17141 (overhead). Timings are evidence for this workload/runtime only; no native throughput, disk IOPS or real sensor compression claim. `VERIFICATION.json` contains commands and browser evidence.

## Data / license

`synthetic()` in `bridge.js` generates reproducible stepped/ramp/noise channels with LCG seed **10112026**. Integers represent arbitrary telemetry units, not measured equipment readings. Code, synthetic generator and original instrument cover are MIT (`LICENSE`). Zig compiler/standard-library usage retains its upstream license in the build environment; no third-party dataset.
