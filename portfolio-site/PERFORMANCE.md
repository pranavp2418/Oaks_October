# Island rendering and project presentation

Independent project cards, details and the island directory show purpose, stack and delivery links without creation dates or development timelines. Technology filters replace month filters. CraftsmanAI's existing timeline, Houston's atmosphere clock, career dates, internal manifest metadata and working source/demo URLs are preserved.

The island uses native antialiasing/tone mapping rather than the multisampled offscreen bloom chain. Scanned-tree materials warm up asynchronously before admission; near-camera detail is capped at 16 desktop / 8 mobile instances, with the procedural forest retained. Static shadows are reused, resolution adapts to sustained frame cost, hover picking is throttled and label layout reads are batched. Zoom buttons sit side by side so an open project panel does not block the lower button. Rendering pauses while a full live-preview modal covers the map and resumes on close; visible ocean motion remains enabled. Project lot coordinates, geometry, scenery palettes and coastline are unchanged. The declined scenery redesign is excluded.

## Measured observation

See [`../runs/2026-10-11-island-performance.json`](../runs/2026-10-11-island-performance.json). Same Chromium 153 software SwiftShader, 1100×760 viewport, 12-second warmup, six-second observation and six real directory-search fills per version. The original renderer is the reference at `5ab8a7405634d85c1ff6e0b59209d506caa2e97f`; directory/date changes are held constant to isolate rendering.

In one observed sample each, median search interaction time was 44 ms before and 16 ms after. No long tasks occurred in the final measured interval. This is not a physical-device FPS guarantee or statistical population estimate. Initial loading, GPU drivers, browser scheduling, hardware and network conditions vary. Scanned detail uses distance-based admission; bloom halos were removed to reduce rendering work. Core buildings, camera navigation and other scene content remain.

## Reproduce

Run `npm ci --ignore-scripts`, `node --test tests/*.test.js`, and `npm run build` first. The optional profiler requires Playwright and Chromium; they are not production dependencies. Install Playwright into a separate temporary directory, set `PLAYWRIGHT_MODULE` to its absolute `playwright/index.mjs`, and set `CHROMIUM_EXECUTABLE` to your test Chromium binary. Without the executable override, Playwright uses its installed browser. The profiler intentionally forces software SwiftShader for comparison and serves the portfolio locally; it stubs unavailable weather with HTTP503.

```sh
node tools/profile-island.mjs /tmp/island-after.json
git show 5ab8a7405634d85c1ff6e0b59209d506caa2e97f:portfolio-site/src/city-world.js > /tmp/island-reference.js
BASELINE_RENDERER=/tmp/island-reference.js node tools/profile-island.mjs /tmp/island-before.json
```

The tool records raw callback/long-task durations and real input timings. Capture hardware/OS/runtime with each experiment, repeat samples and use actual device measurements before making broader performance claims. The production evidence records desktop and 390px navigation, date-free cards, technology filters, Pip, preserved CraftsmanAI flow and actual live previews.
