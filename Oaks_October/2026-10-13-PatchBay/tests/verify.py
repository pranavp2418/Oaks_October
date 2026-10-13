import pathlib,subprocess,tempfile,json,shutil,os,concurrent.futures,sqlite3
root=pathlib.Path(__file__).resolve().parents[1]
cp=(root/'build/classpath.txt').read_text();deps=cp.split(os.pathsep)[1:]
subprocess.run(['java','-cp',os.pathsep.join(deps),'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler','-no-stdlib','-no-reflect','-jvm-target','17','-classpath',cp,'-d',str(root/'build/oracle.jar'),str(root/'tests/Oracle.kt')],check=True)
subprocess.run(['java','-cp',str(root/'build/oracle.jar')+os.pathsep+cp,'OracleKt'],check=True)
with tempfile.TemporaryDirectory(prefix='patchbay-e2e-') as d:
 db=pathlib.Path(d)/'state.db'
 def run(*args,fail=False):
  p=subprocess.run([str(root/'patchbay'),str(db),*map(str,args)],text=True,capture_output=True)
  assert p.returncode==(2 if fail else 0),(p.stdout,p.stderr,args)
  if fail:assert not p.stdout;return p.stderr
  return json.loads(p.stdout)
 imp=run('import',root/'data/sample.json','import-1');assert imp['revision']==1
 assert run('import',root/'data/sample.json','import-1')==imp
 a=run('analyze');assert len(a['exposures'])==3 and a['excludedDevEdges']==1
 plan=run('plan',9,'solve-1');assert plan['plan']['actions']==['combined-upgrade'] and plan['plan']['cost']==9
 run('apply','plan-solve-1','early',fail=True)
 run('approve','plan-solve-1','reviewer-2','Reviewed runtime-only exposure.','approval')
 before=run('status');run('apply','plan-solve-1','failure','--fail',fail=True);assert run('status')==before
 applied=run('apply','plan-solve-1','apply-1');assert applied['remaining_exposures']==0
 assert run('apply','plan-solve-1','apply-1')==applied
 run('rollback','plan-solve-1','undo');assert len(run('analyze')['exposures'])==3
 out=pathlib.Path(d)/'evidence.json';run('export',out);doc=json.loads(out.read_text());assert doc['integrity']['sqlite']=='ok' and doc['integrity']['audit_events']==5
 # Stale approval, repeated receipt collision, invalid input, revision integrity.
 run('plan',7,'stale');run('import',root/'data/sample.json','new-import');run('approve','plan-stale','reviewer','must reject stale','stale-ap',fail=True)
 run('plan',8,'solve-1',fail=True)
 broken=pathlib.Path(d)/'invalid.json';bad=json.loads((root/'data/sample.json').read_text());bad['edges'][0]['to']='unknown';broken.write_text(json.dumps(bad));before=run('status');run('import',broken,'invalid',fail=True);assert run('status')==before
 # Six actual independent JVM processes race on one SQLite receipt. Exactly one mutation.
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:results=list(pool.map(lambda _:run('plan',6,'concurrent'),range(6)))
 assert all(x==results[0] for x in results);assert run('status')['integrity']['audit_events']==8
 # A process terminated with an open SQLite writer transaction leaves no visible mutation.
 script='import sqlite3,time; c=sqlite3.connect('+repr(str(db))+');c.execute("BEGIN IMMEDIATE");c.execute("UPDATE meta SET revision=999");print("staged",flush=True);time.sleep(60)'
 p=subprocess.Popen(['python3','-c',script],stdout=subprocess.PIPE,text=True);assert p.stdout.readline().strip()=='staged';p.kill();p.wait();assert run('status')['revision']!=999
 with sqlite3.connect(db)as c:c.execute("UPDATE audit SET hash='corrupted' WHERE seq=1")
 run('status',fail=True)
print('CLI integration passed: import/replay/analyze/plan/review/apply/rollback/export; stale/conflict/invalid/6-process race/crash rollback/corruption checks passed.')
