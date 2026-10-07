# Pranav Patel — Portfolio

Production: https://pranav-patel.vercel.app/

A navy and electric-blue portfolio featuring a real-time Three.js hero, GSAP scroll motion, CraftsmanAI case study, accessible project dialogs, work history, and contact actions.

## Local development

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

## Build and deploy

```bash
npm run build
npx vercel login
npx vercel link
npx vercel deploy --prod
```

Vercel configuration is included. Build command: `npm run build`. Output directory: `dist`. No environment variables or database are required.

## Content and assets

- `index.html`: biography, experience, projects, metadata, and links.
- `src/main.js`: 3D scene, interactions, workflow copy, and project details.
- `src/style.css`: responsive layout and design.
- `public/assets`: supplied CraftsmanAI logo, film, resume, and locally hosted fonts.

Resume content is sourced from the PDF supplied October 2, 2026. LinkedIn is linked, but its content was not accessible for automated reading. The project visuals for JMCRM-AI and the reconciliation engine are conceptual graphics, not screenshots of those products. External product links lead to their own services.

The portfolio has no contact form or fabricated backend: its email button opens the visitor's email application and Copy email uses the Clipboard API with a visible text fallback.

Motion respects the operating-system preference and can be switched off in the footer. The 3D enhancement has a visual fallback when WebGL is unavailable. Browser checks cover desktop and mobile layouts, dialog behavior, workflow tabs, keyboard controls, video, and motion settings.

## October 2 update

The supplied video plays only inside the CraftsmanAI logo panel when that panel first enters view. It never covers or delays the whole site, remains skippable, and respects reduced motion. The CraftsmanAI wordmark is static. An eleven-facet gemstone explorer uses the supplied icon as its texture, with feature flips, pointer/keyboard rearranging constrained to the gold boundary, and reset. The hero's Systems Core connects AI products, systems, and interfaces to portfolio sections.

Pip is a local, curated portfolio guide with topic matching and guided tours; it is not an external LLM chatbot and stores no questions. `outside-tech.html` includes the supplied hobbies, Chess.com profile, Instagram, Riot ID, and dated rank. No live rank integration is implied. Asset provenance is in `public/asset-sources.txt`.

## Project country

`projects.html` is a separate, interactive Three.js project atlas. The existing landing page, CraftsmanAI gemstone, workflow and archive remain available. The header links to the new page.

The country includes deterministic coastal terrain and mountain heights, physically based facades, shadows, reflective animated water, forests, connected district roads, a supporting skyline, distinct project buildings, day/night lighting, orbit/pan/pinch/scroll zoom, top-down and country views, a clickable minimap and keyboard controls. The scenery is an original procedural visualization, not a geographic survey or a photogrammetry asset. Buildings represent projects, not real offices or customers.

Select a building or a directory item to fly to it, inspect its purpose and stack, read its code/verification, or open an explicitly embedded live workspace. Daily deployed projects load their actual external apps on request; nothing is eagerly embedded. Legacy projects without verified live/source links use the existing portfolio walkthrough and do not invent deployments. GitHub-only projects omit live-demo actions.

Pip is a local data-aware city guide. It matches project names, domains, technologies and purposes, offers comparisons and a guided tour, and moves a visible 3D guide along the shortest connected district route. It uses the current manifest and curated matching, not a remote language model. Unsupported questions get a useful portfolio-scoped response. Questions are neither transmitted nor stored. Motion follows the existing portfolio preference and OS reduced-motion setting.

### Adding projects without changing the current flow

Append verified daily entries to `public/projects.json`; the original archive and project country consume that same file. Preserve existing slugs. Include `classification`, `delivery_mode`, date/month, purpose, stack, verified source/live links and cover. Optional `city: { district, archetype }` overrides the deterministic domain mapping. `public/featured-projects.json` contains the existing flagship/legacy projects and historical dry run. Do not duplicate those in the daily manifest.

Districts group care, finance/CRM, creative products, infrastructure, industry, education and civic/property work. Collision resolution keeps lots unique, and appending entries preserves previous project positions. Directory pagination and capped visible map labels support a growing collection; supporting scenery uses instancing. The city renderer is loaded only on this page. A directory fallback remains usable if WebGL cannot start. Large terrain models, textures and live demos are not loaded on the home page for this feature.

```bash
node --test tests/city-model.test.js
npm run build
```

Tests cover all catalog entries, honest legacy links, Pip purpose/language matching, shortest paths checked against an independent exhaustive oracle, 456-item collision handling and position preservation, unsafe URLs and code-only semantics. Browser verification must additionally cover rendered terrain, map controls, selection, Pip navigation, actual iframe workflow, mobile layout and original CraftsmanAI/archive interactions. `public/mobile-city.html` provides a 390px viewport harness; this is viewport simulation, not physical-device testing.

No new service, credential, paid dependency or database is required. WebGL and touch performance depend on the visitor's graphics hardware. If WebGL is unavailable, Three.js SVGRenderer renders the same real 3D scene with a lighter mesh: camera controls, terrain, buildings, picking and Pip navigation still work. That software mode omits physical textures, reflective water, GPU shadows and bloom. If both renderers fail, the project directory remains usable. Some external websites forbid iframe embedding; new-tab links remain available. The map is a portfolio enhancement, not an additional counted daily project.
