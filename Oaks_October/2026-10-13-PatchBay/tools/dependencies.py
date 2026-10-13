"""Pinned dependencies with checked-in SHA-256 values."""
import urllib.request,pathlib,hashlib,json,sys
root=pathlib.Path(__file__).resolve().parents[1]
cache=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'.deps'
cache.mkdir(parents=True,exist_ok=True)
lock=json.loads((root/'dependencies.lock.json').read_text())
for item in lock:
 target=cache/item['file']
 if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest()!=item['sha256']:
  with urllib.request.urlopen(item['url'],timeout=120) as r:data=r.read()
  if hashlib.sha256(data).hexdigest()!=item['sha256']:raise RuntimeError('Checksum failed: '+item['file'])
  target.write_bytes(data)
print('Verified',len(lock),'pinned JARs')
