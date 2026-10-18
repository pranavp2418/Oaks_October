# Fallow acceptance contract — pending implementation

An environmental sampling agent turns synthetic water-monitoring observations, sampling costs and capacity into an explainable reviewed sampling plan. Decision support only; no physical device, safety or scientific-certification claim.

Substantive new Rust core: beta-binomial exceedance posterior, exact bounded budget/capacity selection using expected posterior uncertainty reduction with site-diversity constraints, and evidence-linked plan reconstruction. Independent Python enumeration and posterior calculations establish bounded correctness. Rust compiled to WASM is required in the delivered web workflow; a JS replacement does not satisfy the stack split.

Connected capabilities: schema-validated seeded observations import; persisted site/measurement/calibration revisions; bounded goal-to-tools investigation with inspectable inputs/results and checkpoints; review/fencing before plan commitment; failed sampling and replanning/recovery; evidence export; posterior/uncertainty/budget inspection. Distinct from route planning: no travel-route optimization or robot control.

Single-user web runtime with explicit persisted journal boundaries; Rust/WASM worker and typed web UI. Exactly one substantive new core in the trio; other two resume-grounded. Seven engineering axes remain PENDING. Verify posterior calculations, exhaustive plan oracle, invalid/overflow inputs, review races, restart/replay, failed jobs, actual model/tool claims, WASM/native parity, clean build, desktop/mobile/keyboard/reduced motion, live source identity and actual launch film.

Art direction: field notebook, botanical white, algae green, copper; contour-map/spatial sample lattice with rich uncertainty visualizations and calm progressive mark-making. Film reveals uncertainty, allocates sampling effort, reviews the plan and incorporates a measured synthetic result.
