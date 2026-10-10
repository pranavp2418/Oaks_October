import unittest,json,itertools,random,copy
from core import solve,dispatch,Conflict
SAMPLE=json.load(open('data/sample.json'))
def oracle(parts,stocks,kerf):
 best=None
 for assignment in itertools.product(range(len(stocks)),repeat=len(parts)):
  amounts=[0]*len(stocks);valid=True
  for p,i in zip(parts,assignment):
   if p['material']!=stocks[i]['material']:valid=False;break
   amounts[i]+=p['length']+kerf
  if not valid or any(v>s['length'] for v,s in zip(amounts,stocks)):continue
  used=[i for i,v in enumerate(amounts) if v]
  score=(len(used),sum(stocks[i]['length'] for i in used))
  if best is None or score<best:best=score
 return best
class Tests(unittest.TestCase):
 def test_exact_independent_oracle(self):
  rng=random.Random(10102026)
  for _ in range(100):
   stocks=[{'id':f's{i}','material':'M','length':rng.randint(5,18)} for i in range(4)]
   parts=[{'id':f'p{i}','material':'M','length':rng.randint(1,8)} for i in range(rng.randint(1,6))]
   kerf=rng.randint(0,2);s=solve(parts,stocks,kerf);o=oracle(parts,stocks,kerf)
   self.assertTrue(s['optimal'] or s['infeasible_proven'])
   self.assertEqual((s['bar_count'],s['total_stock']) if s['feasible'] else None,o)
 def test_material_and_conservation(self):
  s=solve(SAMPLE['pieces'],SAMPLE['stocks']);self.assertTrue(s['optimal'])
  self.assertEqual(s['total_stock'],s['total_pieces']+s['saw_loss']+s['remnant_total'])
  self.assertEqual(len({p['id'] for b in s['bars'] for p in b['pieces']}),8)
  self.assertTrue(all(p['material']==b['stock']['material'] for b in s['bars'] for p in b['pieces']))
 def test_budget_labels_not_false_infeasible(self):
  s=solve(SAMPLE['pieces'],SAMPLE['stocks'],budget=1)
  self.assertFalse(s['infeasible_proven']);self.assertFalse(s['optimal'])
 def test_input_permutation_objective(self):
  a=solve(SAMPLE['pieces'],SAMPLE['stocks']);b=solve(SAMPLE['pieces'][::-1],SAMPLE['stocks'][::-1])
  self.assertEqual(a['plan_hash'],b['plan_hash'])
 def reserve(self):
  req={'seed':copy.deepcopy(SAMPLE),'operations':[]};p=dispatch(req|{'action':{'kind':'solve'}})['plan']
  a={'kind':'reserve','id':'op1','job':'Job-1','note':'Reviewed cut list','expected_revision':0,'pieces':SAMPLE['pieces'],'kerf':3,'budget':150000,'plan_hash':p['plan_hash']}
  return req,a
 def test_reservation_replay_and_cancel(self):
  req,a=self.reserve();r=dispatch(req|{'action':a});self.assertEqual(r['view']['revision'],1)
  same=dispatch(r['workspace']|{'action':a});self.assertEqual(same,r)
  self.assertTrue(any(s['status']=='reserved' for s in r['view']['stocks']))
  c={'kind':'cancel','id':'op2','job':'Job-1','note':'Cancel before cutting','expected_revision':1}
  end=dispatch(r['workspace']|{'action':c});self.assertTrue(all(s['status']=='available' for s in end['view']['stocks']))
 def test_complete_remnants_and_audit(self):
  req,a=self.reserve();r=dispatch(req|{'action':a})
  c={'kind':'complete','id':'op2','job':'Job-1','note':'Cut inspected','expected_revision':1}
  end=dispatch(r['workspace']|{'action':c});self.assertEqual(len(end['view']['produced']),8)
  d=end['view']['audit'][-1]['details'];self.assertEqual(d['input'],d['products']+d['kerf']+d['retained']+d['discarded'])
  self.assertTrue(any('remnant' in s['id'] for s in end['view']['stocks']))
  with self.assertRaises(ValueError):dispatch(end['workspace']|{'action':c|{'id':'op3','expected_revision':2}})
 def test_stale_fences_conflicting_ids_and_preview(self):
  req,a=self.reserve();r=dispatch(req|{'action':a})
  with self.assertRaises(Conflict):dispatch(r['workspace']|{'action':a|{'id':'other'}})
  with self.assertRaises(Conflict):dispatch(r['workspace']|{'action':a|{'note':'Changed'}})
  with self.assertRaises(Conflict):dispatch(req|{'action':a|{'plan_hash':'bad'}})
 def test_invalid_input_and_failed_batch_no_partial_workspace(self):
  for value in [0,-1,True,1.5,25000]:
   parts=copy.deepcopy(SAMPLE['pieces']);parts[0]['length']=value
   with self.assertRaises(ValueError):solve(parts,SAMPLE['stocks'])
  req,a=self.reserve();broken=copy.deepcopy(SAMPLE);broken['stocks'][1]['id']=broken['stocks'][0]['id']
  with self.assertRaises(Exception):dispatch({'seed':broken})
  self.assertEqual(dispatch(req)['view']['revision'],0)
 def test_remnant_is_usable_in_next_job(self):
  req,a=self.reserve();r=dispatch(req|{'action':a});r=dispatch(r['workspace']|{'action':{'kind':'complete','id':'op2','job':'Job-1','note':'Done','expected_revision':1}})
  rem=next(s for s in r['view']['stocks'] if 'remnant' in s['id'] and s['length']>100)
  parts=[{'id':'Small','material':rem['material'],'length':rem['length']-3}]
  p=dispatch(r['workspace']|{'action':{'kind':'solve','pieces':parts}})['plan']
  self.assertEqual(p['bars'][0]['stock']['id'],rem['id'])
if __name__=='__main__':unittest.main()
