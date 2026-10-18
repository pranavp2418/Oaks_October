"""Verify frozen user instruction exports without touching operational ledgers."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'handoff/export-checksums.json').read_text())
errors = []
for record in manifest['files']:
    path = root / record['path']
    if not path.is_file():
        errors.append(f"Missing {record['path']}")
        continue
    data = path.read_bytes()
    if len(data) != record['bytes'] or hashlib.sha256(data).hexdigest() != record['sha256']:
        errors.append(f"Changed {record['path']}")
if errors:
    raise SystemExit('\n'.join(errors))
print(f"Verified {len(manifest['files'])} unchanged instruction/config exports.")
