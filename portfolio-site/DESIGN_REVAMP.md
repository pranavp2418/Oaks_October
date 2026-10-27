# Portfolio design studio

## Problem and acceptance
Sebastian Scott's review says the existing portfolio reads as a software/founder site and gives design teams no design work to inspect. The user authorizes a complete redesign, four clear paths (resume, design catalog, case studies, projects), approximately twenty designs, smooth modern visuals and a recoverable original.

The design must show actual interface artifacts, explain decisions and constraints, distinguish a shipped product from a new concept, and make existing engineering work searchable without overwhelming a design reviewer. New concept illustrations must never be presented as historic shipped screens or validated user research.

## Product / engineering / design plan
- Audience: a hiring manager with a minute to skim, and a designer who wants to inspect reasoning.
- Structure: cinematic intro; three linked case studies; twenty filterable interface studies; searchable complete engineering catalog; concise experience, capabilities and education; contact.
- Case studies: CraftsmanAI (live founder product), CareThread (independent healthcare demo), and Reconciliation Engine (independent finance demo). Source-backed scope and honest qualitative outcomes only. Reconstructed interface concepts are labeled at point of use. No invented research, client approval, usability results or new metrics.
- Architecture: retain Vite/native JS, existing fonts, existing data manifests and island modules. Separate new studio entry from classic entry. Native dialog handles focus and escape; URL search parameters identify case/design/project so links can be shared directly. Static content is local; only existing public manifests are fetched. Catalog failure shows a useful retry and original directory link.
- Reuse: shared project source manifest, bundled fonts, existing source/demo links, native HTML controls and dialog. No React migration solely for motion. Equivalent native motion inspired by Motion Primitives, which is MIT licensed; no copied React code. Original local SVGs rather than mislabeling them as Haikei exports. Realtime Colors role structure informs local tokens; no copied site code.
- Art direction: midnight ink, soft chalk, restrained periwinkle and sage; typographic editorial grid, unusually large headlines, quiet borders, a silver particle sculpture and generous space. No stock dashboard hero. DM Sans and Space Grotesk already bundled. Serif accent uses local system Georgia.
- Motion: 500ms reveal, 220ms panel/filter transitions, 160ms controls with cubic-bezier(.22,1,.36,1). Particle canvas capped at 1120 desktop / 560 mobile points, max 30fps, pauses offscreen/hidden. Reduced motion and persistent manual toggle disable ongoing effects, reveals remain visible without JS. No scroll hijack or forced loader.
- Accessibility: normal body text contrast >=4.5:1; focus indicators; semantic headings, real links, labeled inputs; dialog focus return; filters announce counts; Escape closes; mobile menu and touch targets.

## Recovery and release
Starting production: 26dd648d71e21d6bf847aa14c37e42f6f2d789a3; deployment dpl_HQezozZuER3kZUcJVj8Qu8odZjcq. Exact source preserved in remote branch `portfolio-backup-before-design-revamp`. Original homepage retained as `/classic.html`; existing `/projects.html` island and scenery sources remain byte-for-byte unchanged. Build the new release from production, not the unrelated pending film work on main. Preserve existing canonical domain and redirects. Release branch `portfolio-design-studio`.

## Review / verification plan
Apply gstack product, architecture, design and pre-landing checklists with actual findings. Installed gstack launchers point at an expired workspace and Bun is absent; official upstream checklists were retrieved, but automated gstack executables and external model review are unavailable. Use the permitted cloud browser for desktop/mobile QA; do not claim full gstack suite execution.

Verify build, existing tests, navigation, 20 unique rendered previews, category/search/empty states, 3 case-study paths, project links, native dialog and back/forward routing, copy fallback, reduced motion, mobile menu/overflow, original-page recovery and manifest source identity. Record actual results in the release report. No changes to auth, billing, customer data or application backends; CSO scanner not applicable.

## GSTACK REVIEW REPORT
Initial scope challenge resolved from the current user request. Preserve the working stack and project data; put new visual exploration in a separate concept catalog rather than inventing shipped design evidence. Primary risks: misleading case-study claims, stale source links, route collisions, responsive overflow and decorative performance. Each has a defined content or QA check above.
