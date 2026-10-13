import pathlib,subprocess,sys,os
root=pathlib.Path(__file__).resolve().parents[1]
deps=pathlib.Path(os.getenv('PATCHBAY_DEPS',str(root/'.deps')))
if not deps.exists():subprocess.run([sys.executable,str(root/'tools/dependencies.py'),str(deps)],check=True)
out=root/'build';out.mkdir(exist_ok=True)
cp=os.pathsep.join(str(p) for p in sorted(deps.glob('*.jar')))
subprocess.run(['java','-cp',cp,'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler','-no-stdlib','-no-reflect','-jvm-target','17','-classpath',cp,'-d',str(out/'patchbay.jar')]+[str(p) for p in sorted((root/'src').glob('*.kt'))],check=True)
(out/'classpath.txt').write_text(str(out/'patchbay.jar')+os.pathsep+cp)
print('Built Kotlin/JVM engine')
