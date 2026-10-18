# Fallow film source — draft

Read BRAG_PLAN.md. The45-second3840×2160 composition includes a continuous actual local workflow, native4K video and inspectable tool evidence. No production deployment is implied. Fonts/OFL files are retained; local synthesized score source and GSAP provenance are in ../../2026-10-15-Lintel/launch/. No outside footage, paid resources or private references are included.

From the product directory, npm ci --ignore-scripts installs the pinned Playwright capture dependency. Start the documented app/API, then run MEDIA_ROOT=/path/to/output node launch/capture-workflows.mjs fallow. The code uses a fresh browser context and synthetic fixtures. Copy capture assets into launch/composition/assets/. From that directory run npx --yes hyperframes@0.8.169 check, then HYPERFRAMES_BROWSER_PATH=/path/to/chrome-headless-shell npx --yes hyperframes@0.8.169 render --workers 1 --fps 30 --quality high --output /path/to/draft-4k.mp4. One render at a time on this8GiB host.

DRAFT: final editorial/pacing/audio differentiation, poster bake, compressed derivative, public delivery and portfolio actions remain pending. A passing technical check is not premium-film signoff. Large renderedMP4s remain outside Git. Native recordedWEBM is retained as an editable source asset.
