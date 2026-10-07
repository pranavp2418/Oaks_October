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
