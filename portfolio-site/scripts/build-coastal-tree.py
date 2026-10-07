"""Reproduce the CC0 tree asset. Requires Pillow and gltf-transform CLI 4.5.0."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.request
from PIL import Image

root = Path(__file__).resolve().parents[1]
assets = root / "public/assets/island"
source = json.loads((assets / "tree-manifest.json").read_text())["source"]
cli = shutil.which("gltf-transform")
if not cli:
    raise SystemExit("Install with: npm install --global @gltf-transform/cli@4.5.0")

def fetch(entry, target):
    request = urllib.request.Request(entry["url"], headers={
        "User-Agent": "PranavPortfolio-AssetDownload/1.0 (https://pranav-patel.vercel.app)"
    })
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read()
    if hashlib.md5(data).hexdigest() != entry["md5"]:
        raise ValueError(f"Source checksum mismatch: {target.name}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)

with tempfile.TemporaryDirectory(prefix="coastal-tree-") as directory:
    temporary = Path(directory)
    fetch(source, temporary / "tree.gltf")
    for name, entry in source["include"].items():
        fetch(entry, temporary / name)
    document = json.loads((temporary / "tree.gltf").read_text())
    leaf = Image.open(temporary / "textures/island_tree_02_leaves_diff_1k.jpg").convert("RGBA")
    leaf.putalpha(Image.open(assets / "foliage-alpha.webp").convert("L").resize((1024, 1024)))
    leaf.save(temporary / "textures/leaves-rgba.png")
    document["images"][4].update(uri="textures/leaves-rgba.png", mimeType="image/png")
    document["materials"][1].update(alphaMode="MASK", alphaCutoff=0.5)
    (temporary / "tree.gltf").write_text(json.dumps(document))
    steps = [
        ("weld", "tree.gltf", "welded.glb", []),
        ("simplify", "welded.glb", "detail.glb", ["--ratio", "0.04", "--error", "0.007"]),
        ("tangents", "detail.glb", "tangents.glb", []),
        ("webp", "tangents.glb", "textured.glb", ["--quality", "82"]),
        ("meshopt", "textured.glb", "coastal-tree.glb", []),
    ]
    for command, input_name, output_name, options in steps:
        subprocess.run([cli, command, str(temporary / input_name), str(temporary / output_name), *options], check=True)
    shutil.copyfile(temporary / "coastal-tree.glb", assets / "coastal-tree.glb")
    subprocess.run([cli, "validate", str(assets / "coastal-tree.glb")], check=True)
    print("Output SHA256:", hashlib.sha256((assets / "coastal-tree.glb").read_bytes()).hexdigest())
