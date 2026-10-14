"""Reproduce the preserved-original/current synthetic benchmark."""
import pathlib,subprocess,os,tempfile,json
root=pathlib.Path(__file__).resolve().parents[1]
cp=(root/'build/classpath.txt').read_text()
out=root/'build/review-probe.jar'
subprocess.run(['java','-cp',cp,'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler','-no-stdlib','-no-reflect','-jvm-target','17','-classpath',cp,'-d',str(out),str(root/'tests/ReviewProbe.kt')],check=True)
with tempfile.TemporaryDirectory() as folder:
 result=pathlib.Path(folder)/'result.json'
 subprocess.run(['java','-Xmx1536m','-cp',str(out)+os.pathsep+cp,'ReviewProbeKt',str(result)],check=True,timeout=180)
 print(json.dumps(json.loads(result.read_text()),indent=2))
