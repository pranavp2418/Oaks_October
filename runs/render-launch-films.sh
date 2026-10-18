#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
film_output="${FILM_OUTPUT:-/workspace/media/final}"
mkdir -p "$film_output"
: "${HYPERFRAMES_BROWSER_PATH:?Set this to a verified Chrome/headless-shell executable}"
for product in Lintel Portwise Fallow; do
  project="$repo_root/Oaks_October/2026-10-15-$product/launch"
  name="${product,,}"
  cd "$project/composition"
  npx --yes hyperframes@0.8.169 check --json > "$film_output/$name-check.json"
  npx --yes hyperframes@0.8.169 render --workers 1 --fps 30 --quality delivery --output "$film_output/$name-render.mp4" > "$film_output/$name-render.log" 2>&1
  # Poster selection is verified against the final decoded frames before postprocess-film.py.
done
