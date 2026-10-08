# Island atmosphere and scenery update — October 7, 2026

Published portfolio page: https://pranav-patel.vercel.app/projects.html

Source: https://github.com/pranavp2418/Oaks_October/tree/3c62d64ad499b2ef59ad0790abbe3dbb76d335b3/portfolio-site

Production deployment: `dpl_GX9nTmxff8DpLkikabQRVuxRwRxf`. Final-source preview: `dpl_FtP5J17SyGAxHFbDpMf3y8ycoJmN`. Production metadata and public alias match source `3c62d64ad499b2ef59ad0790abbe3dbb76d335b3`. Build logs show completion. Released at 2026-10-08T00:06:21.777171+00:00. This is a portfolio correction, not a newly counted daily project. Existing projects and historical dry run are preserved.

## Changes

- Explicit Houston DAY/NIGHT phase and date/clock, automatic physical solar direction and sunrise/sunset, America/Chicago including CST/CDT. No manual time or weather selector.
- Real Node.js `/api/island-weather` endpoint reads KIAH National Weather Service observations. Five-minute caching and refresh, request coalescing, observation timestamps, marked delayed/unavailable responses, and three-hour expiry of scene weather effects. No invented current conditions on failure.
- Animated coastal surf, clearer shallow ocean, underwater caustics/reefs, limestone crags, eroded mountain detail and photographed CC0 surface textures.
- Curved glass towers with actual floor joints/mullions, detailed palm fronds, leaf/bark photography, plus an optimized scanned coastal tree. The model is 42,691 triangles and 2,246,804 bytes; 42 desktop or 12 mobile instances in GPU mode. Its separate alpha mask is restored, tangent data generated and geometry Meshopt-compressed. Source MD5s and model SHA256 are recorded in the asset manifests, with reproducible scripts and credits.
- Visible-page motion is always enabled. Background tabs pause rendering. The original home page retains its existing motion preference.
- Project covers use contained framing on desktop and mobile. Expanded mobile directory avoids the floating atmosphere/controls overlap. Software drawing leaves input-processing gaps.

## Verification

- Clean `npm ci --ignore-scripts --offline`, production build and whitespace/source comparison: pass. Staged source exactly matches the pushed release tree.
- `node --test tests/city-model.test.js tests/island-environment.test.js`: 13 tests pass. These include independent shortest-route/collision invariants, UTC rollover and DST, solar boundaries, observed weather mapping, caching/coalescence/invalid methods/upstream failures/expiry, terrain-contour surf, preserved tower dimensions, actual Meshopt decoding and safe deterministic scanned-tree placement.
- glTF validator: no errors or warnings. Meshopt is unsupported by this validator; the shipped decoder successfully expands the real compressed buffers in a separate test.
- Final-source desktop browser: actual software 3D scene, controls/keyboard, directory, Pip, three daily cover images and real project embed verified. Original CraftsmanAI Design workflow and three-entry archive remain functional.
- Final-source mobile: 390×844 viewport simulation; search/select, fully visible PermitWeave cover in a 310×150 contained frame, no horizontal overflow (clientWidth = scrollWidth = 390), and real PermitWeave workspace (66 covered visits, 14 gaps) verified.
- Public alias: actual Houston clock, sunrise/sunset, latest observed weather and Pip Lua navigation verified. Natural golden-hour → sunset phase change was observed, without forcing the clock.
- Live API GET / POST / GET: 200 / 405 with Allow GET / 200. Repeated GET returned the same cached observation and servedAt. Report: Clear, KIAH, observed 2026-10-07T23:40:00Z, served 2026-10-08T00:02:20.721Z, temperature30C/86F, wind14.832km/h. Browser readout matched these values.

## Limits

The checking browser disables WebGL. The GPU textures, scanned tree appearance, reflections, shadows, scattering sky and canopy movement cannot be visually verified here. Software rendering is verified and deliberately has lighter geometry without photographic materials. The screenshots show that software view. Assets are 1K/2K with no claim of an 8K photographic reconstruction. Mobile checks are viewport simulation, not device/performance benchmarks. The known shared Three.js build chunk warning remains (555.27kB; 141.09kB gzip). Weather is a timestamped station observation, not guaranteed instantaneous city-wide conditions. Pip is local catalog matching, not an unrestricted remote AI system.

## Evidence

- `2026-10-07-island-atmosphere.jpg`: public island and automatic atmosphere.
- `2026-10-07-island-covers-mobile.jpg`: final-source preview with mobile full-cover framing.
- Root `PROJECT_LEDGER.json`: release metadata and test evidence; previous city release preserved in history.
