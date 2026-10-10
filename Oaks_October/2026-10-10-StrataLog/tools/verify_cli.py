import subprocess,tempfile,pathlib,os,json,hashlib,shutil
root=pathlib.Path(__file__).resolve().parents[1]
def command(store,*args,env=None,expected=0):
 r=subprocess.run([str(root/'bin/stratalog'),args[0],str(store),*map(str,args[1:])],text=True,capture_output=True,env=env)
 assert r.returncode==expected,(r.returncode,r.stdout,r.stderr)
 return r.stdout
with tempfile.TemporaryDirectory() as tmp:
 t=pathlib.Path(tmp);store=t/'store';source=root/'data/sample.tsv';export=t/'snapshot.tsv'
 first=command(store,'ingest',source);assert 'applied=5' in first
 again=command(store,'ingest',source);assert 'applied=0 duplicates=5' in again
 command(store,'export',export);before=export.read_bytes();assert before==b'locations\tRACK-A\tready\nparts\tP-101\tbracket-revC\n'
 command(store,'checkpoint');command(store,'ingest',source);command(store,'export',export);assert export.read_bytes()==before
 bad=t/'bad.tsv';bad.write_text('x\tparts\t5\tput\tbad\tbad\ny\tparts\t7\tput\tbad\tbad\n')
 command(store,'ingest',bad,expected=2);assert command(store,'get','parts','bad').strip()=='<absent>'
 crash=t/'crash.tsv';crash.write_text('c\tparts\t5\tput\tnew\tdurable\n')
 env=os.environ.copy();env['STRATALOG_FAULT']='after_sync';command(store,'ingest',crash,env=env,expected=86)
 assert command(store,'get','parts','new').strip()=='durable'
 assert 'applied=0 duplicates=1' in command(store,'ingest',crash)
 wal=store/'changes.wal';wal.write_bytes(wal.read_bytes()+b'SLG1\x00\x00\x00\x64\x00\x00\x00\x00half')
 assert 'recovered tail bytes 16' in command(store,'verify')
 assert command(store,'get','parts','new').strip()=='durable'
 lock=subprocess.Popen(['flock',str(store/'.writer-lock'),'sleep','30'],start_new_session=True)
 try:
  import time
  time.sleep(.2);command(store,'inspect',expected=1)
 finally:
  import signal
  os.killpg(lock.pid,signal.SIGTERM);lock.wait()
 corrupt=bytearray(wal.read_bytes());corrupt[12]^=1;wal.write_bytes(corrupt);digest=hashlib.sha256(wal.read_bytes()).hexdigest()
 command(store,'inspect',expected=2);assert hashlib.sha256(wal.read_bytes()).hexdigest()==digest
print(json.dumps({'cli_scenarios':9,'passed':True,'flows':['import/export','duplicate replay','checkpoint restart','invalid atomic batch','after-fsync process halt/recovery','torn tail','exclusive CLI writer','corruption fail closed','persisted source-to-output']},indent=2))
