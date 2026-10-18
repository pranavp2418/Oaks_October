import copy,itertools,json,pathlib,random,unittest
from core import compile_dossier,ContractError
ROOT=pathlib.Path(__file__).resolve().parents[1]
def sample():return json.loads((ROOT/'data/sample.json').read_text())
class CoreTest(unittest.TestCase):
 def test_known_connected_paths(self):
  r=compile_dossier(sample());self.assertFalse(r['ready']);self.assertEqual(r['earliest_day'],10)
  self.assertEqual({tuple(x['missing']) for x in r['alternatives']},{('energy','flood','owner','structural'),('energy','exemption','owner','structural')})
  self.assertTrue(all(x['review_required'] for x in r['alternatives']))
 def test_frontiers_independent_truth_table(self):
  rng=random.Random(151026)
  for trial in range(400):
   n=rng.randrange(2,8);e=[dict(id=f'e{i}',title=f'Evidence {i}',state=rng.choice(['valid','missing','expired']),days=rng.randrange(1,8),cost=rng.randrange(100),source='Synthetic fixture',version=1) for i in range(n)]
   rs=[];known=[x['id'] for x in e]
   for j in range(rng.randrange(1,7)):
    rs.append(dict(id=f'r{j}',title='Synthetic requirement',op=rng.choice(['all','any']),inputs=rng.sample(known,rng.randrange(1,min(len(known),4)+1)),days=rng.randrange(4)));known.append(f'r{j}')
   data=dict(evidence=e,requirements=rs,root=rs[-1]['id'],deadline=30,revision=0)
   # Independent direct evaluation; no production solver helper used.
   by={x['id']:x for x in rs};es={x['id']:x for x in e}
   def valid(k,chosen):
    if k in es:return es[k]['state']=='valid' or k in chosen
    vals=[valid(v,chosen) for v in by[k]['inputs']];return all(vals) if by[k]['op']=='all' else any(vals)
   missing=[x['id'] for x in e if x['state']!='valid'];expected=[]
   for mask in range(1<<len(missing)):
    chosen=frozenset(x for i,x in enumerate(missing) if mask&(1<<i))
    if valid(data['root'],chosen):expected.append(chosen)
   minimal={x for x in expected if not any(y<x for y in expected)}
   actual=compile_dossier(data)
   self.assertEqual({frozenset(x['missing']) for x in actual['alternatives']},minimal,trial)
 def test_ready_and_revisions(self):
  d=sample()
  for e in d['evidence']:e['state']='valid'
  d['revision']=9;r=compile_dossier(d);self.assertTrue(r['ready']);self.assertEqual(r['revision'],9);self.assertEqual(r['alternatives'][0]['missing'],[])
 def test_reject_cycles_unknown_duplicate_bad_numeric(self):
  for mutate in [lambda d:d['requirements'][0]['inputs'].append('dossier'),lambda d:d['requirements'][0]['inputs'].append('missing-id'),lambda d:d['evidence'].append(d['evidence'][0]),lambda d:d['evidence'][0].update(days=True),lambda d:d.update(extra='x')]:
   d=sample();mutate(d)
   with self.assertRaises(ContractError):compile_dossier(d)
 def test_cost_and_fastest_path_are_distinct(self):
  d=sample();d['evidence'][1]['days']=30;r=compile_dossier(d)
  cheapest=r['alternatives'][0];self.assertLess(cheapest['slack_days'],0);self.assertGreater(r['slack_days'],0)
if __name__=='__main__':unittest.main()
