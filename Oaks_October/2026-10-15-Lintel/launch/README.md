# Lintel launch film

Read brag-plan.md, composition-brief.md, PROVENANCE.md and FINAL_QA.md. Final delivery status and public assets are recorded in FINAL_QA.md; the earlier drafts remain in Git history and outside-Git media directories.

Install the real upstream brag plugin in the execution environment:

```sh
codex plugin marketplace add latent-spaces/brag
codex plugin add brag@brag
codex plugin list
npx --yes hyperframes@0.8.169 doctor
```

From the product directory, npm ci --ignore-scripts installs the pinned Playwright capture dependency. Start the documented actual app/API. Set CHROMIUM_PATH when system Chromium is elsewhere. Capture with `node launch/capture-motion.mjs /path/to/captures`; for the latter use MEDIA_ROOT to choose the parent output directory. Capture uses an isolated synthetic notebook, native3840×2160 pixels and visible real cursor/actions. Source ranges and retiming are declared explicitly in composition/index.html and capture-provenance.json.

From repository root:

```sh
python3 runs/generate-film-audio.py
# Re-extract audio bands with the installed Hyperframes creative helper if the score changes.
export HYPERFRAMES_BROWSER_PATH=/path/to/chrome-headless-shell
FILM_OUTPUT=/path/to/renders bash runs/render-launch-films.sh
python3 runs/postprocess-film.py lintel /path/to/renders
python3 runs/build-film-contact-sheets.py lintel
```

The full composition renders at native4K/30fps. The postprocessor selects a settled product-specific poster, bakes only frame0, derives a high-quality1080p MP4, probes/hashes and fully decodes both. Run one render at a time on this8GiB host. Software screenshot fallback is recorded honestly. Large final MP4s belong in the authorized GitHub release artifact mechanism, not Git blobs. No autoplaying portfolio media.

Real capture and original licensed fonts/score are retained. No paid assets, services, campaign-brand content, private inspirations/profile inputs or invented customer/results. See PROVENANCE.md for bounded runtime and synthetic-data claims.
