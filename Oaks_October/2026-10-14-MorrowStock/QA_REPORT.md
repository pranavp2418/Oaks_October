# MorrowStock release verification

Status: applicable project delivery checks passed; portfolio integration awaits the complete trio. Final deployed source `7b9ae36cf7c10f789f823b9639308093c1f3aa40`, deployment `dpl_3R7tqoVSaW6sPPjedr5WpNGjxhqK`. Earlier observations below are retained as history, superseded by the final follow-up where stated.

## Boundaries and commands

The gstack QA/investigation/review methodology was applied to this project's Python core/API/CLI and operator UI. All writes used original synthetic case data and this run's browser workspace or disposable local databases. No real warehouse, purchasing, customer messaging or tenant system exists. The permitted cloud Chrome browser substituted for unavailable gstack Chromium; no cookies/credentials were copied. Existing documented unittest/Node test commands were retained, with one new meaningful regression added; no test framework was added or gate weakened.

Fresh clean Python venv installed every pin in requirements.lock; fresh npm ci --ignore-scripts passed. Commands: `python -m unittest discover -s tests -v` (20/20 groups), `npm test` (4/4), `npm run build` (passed), `python benchmark.py` (real measured output). CI at the consumed functional source succeeded: https://github.com/pranavp2418/Oaks_October/actions/runs/38777359033 . Existing tests include 400 exhaustive independent assignment cases, six-process receipt contention, killed SQLite writer recovery, 24 unsafe model choices, checkpoint reopen and actual HTTP/CLI processes. The deterministic provider fixtures are not counted as live inference.

## Real provider and browser evidence

The initial post-account-change probe still received customer_verification_required. The signed-in team Gateway then displayed $5 Free AI Credit; the next real request succeeded. No key creation, card entry, credit purchase, budget increase or paid fallback was performed by the agent.

`live_pilot.py` passed all three preregistered integration cases: shortage, replenishment and lot exposure. Eight real generations reported zero cost, chose relevant tools, stopped at review within four decisions, preserved stock and replayed without fresh inference. Recorded receipts are in `runs/2026-10-14-morrowstock-live-pilot.json` at the repository root. These are visible-development cases, not held-out model accuracy. One prose order identifier was mistyped; tool evidence is authoritative. The separate browser summary used “on hand” for original lot quantity, another reason the exact picked exposure and raw tool data stay visible and suggestions cannot authorize stock actions.

Desktop workflow: loaded seed141022 dataset; created draft; recorded review; injected precommit reservation failure at local revision3; observed unchanged revision/stock; retried successfully to revision4 with88 reserved; picked5; reloaded and observed the same receipt; recalled LOT-01; inspected PICKED5 and RESERVED6 exposure; plan became BLOCKED; released unpicked reservations to CLOSED while retaining picked5; created/reviewed/received8 LEAF cases. Original96 cases became104; shortage fell16→8 after replenishment. The conservation ribbon's “free” counts physically unreserved cases, including quarantined lots; recalled lots remain unusable by the solver and pick guard.

At 390px iframe width: a stale revision8 request was rejected rather than overwriting revision10. Reopen recovered the current journal without a model call. Started a real trace_lot investigation at inventoryv6; inspected E1 (picked5 on recalled LOT-01); injected a provider interruption and retained revision11/E1; continued to cited AWAITING_REVIEW, then explicitly closed REVIEWED_EVIDENCE at revision13. Actual additional generation IDs: gen_01M509ZCC1A536FXTRX5ETHF0K and gen_01M50A10NMJJCEPPCBQ7YA5H6D, both cost0. Browser-only local workspace is not shared hosted database persistence.

Actual browser verification DB: eight independent IndexedDB connections,1 successful compare-and-swap save,7 stale-write rejections; closing/reopening retained revision1. The isolated verification database was closed/deleted by its own page; product data were untouched.

Workspace download:10398bytes, SHA256 `02d03d12b0c9ba5dfede3f95d2e888cacef93420399f22722f0ed4644ab75696`, schema1,13 operations and2 real provider receipts. Malformed restore `{}` produced dialog-local “Workspace schema1 is required”; corrected export submitted by keyboard restored revision14, same stock and reviewed agent without model requests. Dossier:40385bytes, SHA256 `3117cfeab0386c2011d0e33015dfbb9f06c66a955e78b7c3fcb87d5c66fda4d9`,13 journal entries,10 stock receipts and reviewed agent evidence. The cloud download event timed out even though both files arrived and parsed correctly; no failed event was counted as file-transfer proof.

Keyboard: Shift+Tab reached previous section navigation, Enter activated it, Enter submitted corrected restore, and Escape dismissed the native modal without changing revision14. A focus-query probe after tabbing past Cancel timed out; a complete screen-reader/focus-cycle audit is not claimed. Main mobile document client/scroll widths both375px inside the390px frame; no whole-document horizontal overflow was observed. Native dropdowns rendered foreground rgb(37,43,27) on rgb(250,249,243). Reduced-motion behavior is implemented in the motion component/CSS but OS-level preference emulation was unavailable. Physical touch devices were not tested.

## Review finding and repair

An independent read-only native pass found the verification bench checked visibility only at sampling start. A background interruption could be included in “visible” timing. `tests/verification.regression-1.test.mjs` failed before repair at the intended assertion: a5000ms interval was emitted as valid. The fix retains any visibilitychange interruption and discards that sample; the regression and full JS suite passed. A separate fix-only reviewer reran it1/1 and verified listener cleanup. No further substantiated issue remained in that bounded pass; it did not independently verify hosting or the browser. Earlier four core/UI findings and fixes remain in ENGINEERING_REVIEW.md.

CSO static assessment remains partial: trusted Docker/scanner runtime unavailable; no security certification or full scanner clearance. No outside-model CLI was authenticated. Native review is not cross-model consensus.

## Performance and source identity

Fresh bounded solver benchmark: Linux6.18.44x86_64/glibc2.39, Python3.12.14, Clang22.1.3,9 logical/affinityCPUs, shared nonisolated container; seed141022,24 lots/104 cases,24 orders/114 demand,3 warmup/25 repetitions, sequential perf_counter_ns and nearest-rankp95. Exactflowp50=5.7226ms,p95=7.0833ms,served82,objective240430,tracedpeak37472bytes. Feasiblegreedyp50=.0732ms,p95=.0904ms,served77,objective257390,tracedpeak1680bytes. One small workload, no scale extrapolation and no optimality claim for greedy.

Cloud Chrome154 visible-frame wrapper sample:120 intervals,p50≈16.7ms,p95≈1016.4ms,max1016.5ms. This result has substantial gaps and does not establish fast physical-mobile rendering, production FPS or input latency; no claim of a performance pass is made from this number. Product motion is bounded panel transition, not a continuous animation loop. Production app JS347619bytes, shared journal2022bytes,CSS17189bytes; build-reported gzip app110.76kB. No hardware/kernel/GPU claim.

Public assets matched local build byte-for-byte: app-BI8X4iiI.js SHA256 abff40be2a0334184057b836fe2b2aa086f044330c7d4e0f869dbf12b900617e; journal-IymR7jYX.js d139b1b8bf831be605f457ac4ec7d5ad77be6a1baed8ba3c575f502f84ebae0f; app-CgjDG7Yq.css 8060c213115eca03c8da9bb8fe8bedce84d28c5b4700938fa07701d046ff0c12. Deployment metadata identifies the exact functional commit; READY was not used alone as completion evidence.

## Honest remaining limits

Public synthetic demo, not authenticated multiuser operations. Browser deletion loses saved work; export is backup. Portable records and their model metadata are user-editable, not signed attestations. Lost model responses can repeat a zero-price request before its journal save. No customer, production scale, prompt-injection immunity, compliance or bug-free claim. Portfolio/archive/country integration is intentionally withheld until all three agent products pass.

## Final input and keyboard follow-up

Final source CI passed: https://github.com/pranavp2418/Oaks_October/actions/runs/38789258130 . Six JS tests,20 Python groups, clean install/build. Existing stock/agent implementation was unchanged by these UI-only repairs; the full stock lifecycle, actual model pilot and390px recovery evidence above remain applicable.

Removed layout-width animation, added explicit Reduce motion control, isolated trusted-input diagnostics and repaired RAF/listener cleanup. Hidden interruption is discarded; slow visible events remain. Final public Chrome sample13 trusted clicks/keys: dispatch p50=2.8ms,p95/max=21ms; next callback p50=17.2ms,p95/max=94.3ms; zero hidden discards. Earlier14-event follow-up measured p95=21.8ms dispatch/35.5ms next frame. These are bounded product interaction samples, not INP, physical-mobile FPS, or a whole-site performance certification. The earlier120-frame one-second-tail result remains recorded and is not converted into a pass.

Final native modal keyboard cycle: Close→JSON textarea→Choose file→Cancel→Close; ShiftTab Close→Cancel; disabled Validate skipped; hidden file input excluded. Escape closed safely. Checked Reduce motion and Enter-driven section navigation. Malformed restore rejected in-dialog and actual exported journal restored without inference, retaining104 cases/5 picked and reviewed evidence at revision15.

Final public assets equal clean local build: app-CmtJonvW.js350332bytes SHA2562d60d1b74495cb64d9943c5f7cdbe1b5f395a4b2d95fe4fd5cc90c4e18d4b529; CSS17189bytes SHA2568060c213115eca03c8da9bb8fe8bedce84d28c5b4700938fa07701d046ff0c12; journal2022bytes SHA256d139b1b8bf831be605f457ac4ec7d5ad77be6a1baed8ba3c575f502f84ebae0f. Final app gzip111.69kB. Build completion and source SHA inspected. Representative keyboard/input follow-up is closed; full screen-reader/physical-device/scanner certification remains unclaimed.
