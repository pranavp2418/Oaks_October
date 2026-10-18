"""Reproducible bounded compiler workload; runtime observations, not a scale claim."""
import json,pathlib,platform,random,statistics,time
from core import compile_dossier
rng=random.Random(151026);base=json.loads(pathlib.Path('data/sample.json').read_text());work=[]
for i in range(100):
 d=json.loads(json.dumps(base))
 for e in d['evidence']:e['state']=rng.choice(['valid','missing','expired','conflicting']);e['days']=rng.randrange(1,31)
 work.append(d)
for d in work[:10]:compile_dossier(d)
samples=[]
for repeat in range(5):
 for d in work:
  t=time.perf_counter_ns();compile_dossier(d);samples.append((time.perf_counter_ns()-t)/1e6)
samples.sort();out={'seed':151026,'workloads':100,'repetitions':5,'warmup':10,'observations':len(samples),'runtime':platform.python_version(),'platform':platform.platform(),'cpu':platform.processor(),'compiler_ms':{'min':min(samples),'p50':statistics.median(samples),'p95':samples[int(len(samples)*.95)-1],'max':max(samples)},'correctness':'400 independent truth-table cases in tests/test_core.py','limits':'Small synthetic graph evaluation, not service load, mobile performance or production throughput.'}
pathlib.Path('qa/benchmark.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
