# Design studio QA and release

## Verified scope
New homepage with four direct paths: concise resume; 20 original interface concept studies; three existing-product case studies; searchable 30-project catalog. All visual study artifacts are intentionally labeled concept/sample/unvalidated. No testimonials, research interviews, customer approval, usability improvement or additional revenue is invented.

The release is based on the actual production commit `26dd648d71e21d6bf847aa14c37e42f6f2d789a3`. GitHub backup branch `portfolio-backup-before-design-revamp` preserves that exact state. `/classic.html` is byte-for-byte the original homepage source, included as a Vite build entry. The island, scenery, renderer, original project manifests, personal page and resume PDF remain unchanged. Unrelated pending film-room work on main is not deployed.

## Actual checks
- `node --test tests/*.test.js`: 32 passed, 0 failed, 0 skipped. Existing 29 tests preserved; three new artifact/recovery checks cover missing references, standalone SVG safety/labeling and build inclusion of the preserved homepage.
- `npm run build`: passes. The new homepage JS is approximately 29 kB raw / 11 kB gzip. The existing Three.js chunk remains for the original island/classic page; the new homepage imports no Three.js or GSAP.
- 20 unique 1200×800 SVGs parse correctly, have concept/sample-data labels and no scripts/external image dependencies. All twenty were rendered and visually inspected in contact sheets.
- Six main foreground/background token pairs measured between 5.49:1 and 16.92:1, passing AA normal-text contrast. This is a token check, not an assertion that every SVG pixel or every screenshot has been audited by an accessibility scanner.

## Browser workflow evidence
Permitted Cloud Browser substituted for gstack browser; desktop viewport 1363×936. Mobile CSS tested inside a real 390×844 iframe viewport (375px content width after native scrollbar), not a physical device.

Verified desktop:
- Twenty design entries; Care category yields four, Interaction yields five; text search and zero-match reset work.
- Design detail includes actual SVG, rationale, decisions and proposed test. Next/previous advances the shareable URL, final next is disabled, Escape closes, and focus returns to the launching card.
- Direct entry to study 20 opens correctly. Browser Back closes and Forward reopens a study. Direct-entry close removes query instead of navigating away.
- All three case studies have six substantive sections and resolve their companion concept illustrations. CareThread exposes no source links. Finance links to its implemented core and documented limitations.
- Thirty existing projects are present; Kotlin search yields PatchBay. Source-only filter yields PatchBay, StrataLog and Market Analysis. PatchBay has source/walkthrough actions and no invented demo. Pagination advances to page 2 with Loadstone first.
- Both catalog failure paths were exercised by temporarily removing the actual local manifest. The page presents retry/fallback; restoring files and clicking Retry recovers 20 studies/30 projects. No mocked endpoint was used, and files were restored.
- Email copy produces confirmation. Manual motion-off disables continuous canvas animation and native smooth scrolling. Shared native dialog receives close-button focus and locks/restores body scrolling.
- No horizontal overflow or broken completed images seen. Intentional 404 console messages from failure tests are not application defects; unrelated browser-extension metadata errors were excluded.

Verified mobile:
- No horizontal overflow; header collapses to a working menu.
- Menu opens, section links navigate and menu closes.
- Category filtering and design detail work. Dialog content width equals scroll width (335px), Close receives focus and Escape closes.
- Hero, catalog and detail reviewed visually. Screenshots retained in `evidence/`.

## Findings repaired
1. Native width/height attributes initially made SVG thumbnails vertically letterboxed. Added `height:auto` to the common image rule; images now keep their 3:2 ratio.
2. Manual motion-off originally disabled descendants' transitions but left the root's smooth scrolling active. Added an explicit `html.no-motion` rule and rechecked settled anchor navigation.
3. Vite initially rejected the managed preview hostname. Added only `terminal.local` to the development allowlist.
4. Legacy `#craft-explorer` and `#project-archive` entry points now reach the matching product case study/project section. The original interactive explorer remains on `/classic.html`.

## Review and limitations
Applied the user-selected gstack product/scope, architecture, design and pre-landing checklist methodology. Retrieved official upstream checklists because configured launchers point to an expired workspace; Bun is absent. Automated gstack executables, CSO scanner and external-model review were not run. No auth, data-access, billing or application backend changes require a new CSO scan for this presentation-only release. This is not full gstack-suite certification.

Physical-device performance, screen-reader testing and real usability research were not performed. Continuous particles are bounded to 1120 desktop / 560 mobile points, max 30fps, and pause offscreen/hidden/when motion is disabled; no hardware benchmark claim is made. No prior project backend was modified or re-certified by this portfolio release.

Durable learnings: production is on a release commit distinct from main; always compare Vercel metadata before editing. Preserve original source as a built entry, not just a saved HTML file. Explicitly set image height:auto when SVG previews have width/height attributes. Root smooth scrolling needs its own manual reduced-motion rule.
