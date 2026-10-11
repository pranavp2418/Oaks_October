"""Reproducible core build. Install ziglang==0.14.1 or provide ZIG executable."""
import os,subprocess,pathlib,hashlib,json,base64
try:
 import ziglang
 default=str(pathlib.Path(ziglang.__file__).parent/'zig')
except ImportError:default='zig'
zig=os.environ.get('ZIG',default)
subprocess.run([zig,'test','src/codec.zig'],check=True)
subprocess.run([zig,'build-exe','src/codec.zig','-target','wasm32-freestanding','-fno-entry','-rdynamic','-O','ReleaseSafe','-fstrip','-femit-bin=codec.wasm'],check=True)
b=pathlib.Path('codec.wasm').read_bytes();pathlib.Path('codec.wasm.b64').write_text(base64.b64encode(b).decode()+'\n');pathlib.Path('codec-artifact.json').write_text(json.dumps({'compiler':subprocess.check_output([zig,'version'],text=True).strip(),'target':'wasm32-freestanding','optimization':'ReleaseSafe','source_sha256':hashlib.sha256(pathlib.Path('src/codec.zig').read_bytes()).hexdigest(),'wasm_sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)},indent=2)+'\n')
