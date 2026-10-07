# Island surface credits

Photographic surface maps are supplied by [Poly Haven](https://polyhaven.com) under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/):

- [Coast Sand 01](https://polyhaven.com/a/coast_sand_01): beach colour and OpenGL normal map.
- [Coast Sand Rocks 02](https://polyhaven.com/a/coast_sand_rocks_02): limestone colour and OpenGL normal map.
- [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock): upland surface colour.
- [Island Tree 02](https://polyhaven.com/a/island_tree_02): photographed foliage, leaf mask and bark, plus a simplified scanned coastal tree. The original million-triangle model is reduced to 42,691 triangles, with explicit leaf masking, tangent data and Meshopt compression. The 2.25 MB model uses 1K surface maps and is instanced 42 times on desktop or 12 on mobile GPU views. `tree-manifest.json` records source downloads, checksums and transformations; `scripts/build-coastal-tree.py` reproduces the pipeline. The validator reported no errors or warnings; its unsupported Meshopt extension is checked separately with the decoder shipped in the application.

Colour and foliage maps are 2048 × 2048; normal and bark maps are 1024 × 1024. The maps were converted from verified source JPG files to WebP with Pillow, quality 88, method 6. `manifest.json` records exact download URLs, source MD5 checksums, output SHA-256 checksums, dimensions and sizes. `scripts/fetch-island-assets.py` reproduces the download and conversion. Conversion bytes can differ between Pillow versions.

Terrain, coastline, coral, palms, clouds, roads and architecture are original procedural geometry. They form a fictional portfolio island, not a survey of a real country. The glass skyline is inspired by contemporary curved coastal towers; no uploaded reference photo is redistributed. Real-time rendering quality depends on graphics hardware; this is not an 8K photographic reconstruction. Software rendering retains interactive geometry and surf while omitting photographic materials, physical reflections, shadows and bloom.

Solar position and sunrise/sunset calculations use SunCalc 2.1.1, © Vladimir Agafonkin, BSD-2-Clause. See the installed package license. Houston weather uses public National Weather Service observations from KIAH: https://api.weather.gov/stations/KIAH/observations/latest. Observations describe the reporting station and may be delayed; the interface shows their timestamp and freshness. Solar times use Houston city coordinates and America/Chicago, including daylight saving time.
