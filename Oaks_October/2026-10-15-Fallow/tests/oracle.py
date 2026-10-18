"""Independent exact rational posterior-utility and exhaustive plan oracle."""
import fractions,itertools,json,pathlib,random,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1];binary=ROOT/'engine/target/release/fallow-core';rng=random.Random(151027)
def utility(s,n):
 a=s['successes']+1;b=s['failures']+1;t=a+b
 x=fractions.Fraction(a*b*n*10**9,t*t*(t+1)*(t+n))
 # Positive round-half-up; Rust float rounding may differ only at a tie, checked explicitly.
 return (x.numerator*2+x.denominator)//(2*x.denominator)
for trial in range(300):
 sites=[{'id':f's{i}','region':rng.randrange(3),'cost':rng.randrange(1,8),'successes':rng.randrange(10),'failures':rng.randrange(10),'max_samples':rng.randrange(1,4)} for i in range(rng.randrange(1,6))]
 r={'sites':sites,'budget':rng.randrange(0,30),'capacity':rng.randrange(0,9),'minimum_regions':rng.randrange(0,4)};candidates=[]
 for picks in itertools.product(*(range(s['max_samples']+1) for s in sites)):
  cost=sum(s['cost']*n for s,n in zip(sites,picks));count=sum(picks);regions=len({s['region'] for s,n in zip(sites,picks) if n})
  if cost<=r['budget'] and count<=r['capacity'] and regions>=r['minimum_regions']:candidates.append((-sum(utility(s,n) for s,n in zip(sites,picks)),cost,count,picks))
 out=json.loads(subprocess.run([str(binary)],input=json.dumps(r),text=True,capture_output=True,check=True).stdout)
 assert out['ok']==bool(candidates),(trial,r,out)
 if candidates:
  best=min(candidates);p=out['plan'];actual=dict(p['selected']);picks=tuple(actual.get(s['id'],0) for s in sites)
  assert (-p['utility_nano'],p['cost'],p['samples'],picks)==best,(trial,r,best,out)
print('300 independent Fraction/exhaustive allocation cases passed; seed151027')
