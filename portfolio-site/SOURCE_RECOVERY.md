# Source recovery and preservation

Recovered the complete editable source and public assets from Pranav-Patel-Portfolio-Source.zip. On October 7, 2026, each of the 46 non-dist files present in the latest source deployment dpl_HDgd3pbKDWQVgB6QuhziGuDV4oix matched its Vercel SHA1 digest exactly. Generated dist output was excluded from source tracking; original archive remains unchanged.

Initial source preserves index.html, outside-tech.html, src/, public/assets/, package.json, lockfile, vite.config.js and vercel.json. New archive code is isolated in src/archive.js and src/archive.css, with projects.json and original SVG covers. Existing CraftsmanAI, navigation, guide, motion controls, and personal page remain present.

The original 11.6 MB film is tracked as lossless binary parts in source-assets/film/ to fit connector payload limits. restore-assets.js concatenates and verifies SHA256 before every build. Other assets remain normal source files. No external download is required to build the recovered site.
