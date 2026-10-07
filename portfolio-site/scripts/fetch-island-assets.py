"""Rebuild self-hosted CC0 island maps. Requires Python 3 and Pillow."""
import hashlib
import io
import json
from pathlib import Path
import urllib.request
from PIL import Image

root = Path(__file__).resolve().parents[1] / "public/assets/island"
manifest = json.loads((root / "manifest.json").read_text())
for entry in manifest:
    request = urllib.request.Request(entry["source_url"], headers={
        "User-Agent": "PranavPortfolio-AssetDownload/1.0 (https://pranav-patel.vercel.app)"
    })
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read()
    if hashlib.md5(data).hexdigest() != entry["source_md5"]:
        raise ValueError(f"Source checksum mismatch: {entry['file']}")
    picture = Image.open(io.BytesIO(data)).convert("L" if "alpha" in entry["file"] else "RGB")
    if picture.size != (entry["width"], entry["height"]):
        raise ValueError(f"Source dimensions mismatch: {entry['file']}")
    target = root / entry["file"]
    picture.save(target, "WEBP", quality=88, method=6)
    print(entry["file"], "sha256=" + hashlib.sha256(target.read_bytes()).hexdigest())
