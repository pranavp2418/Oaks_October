import unittest,sys,copy,random,itertools
sys.path.insert(0,'.')
from core import plan,validate,replay,digest,materialize
B=[{'id':'site','parent':None,'name':'Site A','capacity':0},{'id':'lift','parent':'site','name':'Lift','capacity':2}]
class Tests(unittest.TestCase):
 def test_independent_field_merge(self):
  c=copy.deepcopy(B);n=copy.deepcopy(B);c[1]['name']='Lift west';n[1]['capacity']=4;p=plan(B,c,n);self.assertTrue(p['ready']);self.assertEqual(p['records'][1]['name'],'Lift west');self.assertEqual(p['records'][1]['capacity'],4)
 def test_conflict_review(self):
  c=copy.deepcopy(B);n=copy.deepcopy(B);c[1]['capacity']=3;n[1]['capacity']=4;p=plan(B,c,n);self.assertFalse(p['ready']);self.assertEqual(p['conflicts'][0]['key'],'lift.capacity');p=plan(B,c,n,{'lift.capacity':'incoming'});self.assertTrue(p['ready']);self.assertEqual(p['records'][1]['capacity'],4)
 def test_delete_modify(self):
  n=copy.deepcopy(B);n[1]['name']='Changed';p=plan(B,B[:1],n);self.assertFalse(p['ready']);self.assertTrue(plan(B,B[:1],n,{'lift.record':'current'})['ready'])
 def test_merged_dependencies_fail(self):
  base=[{'id':'a','parent':None,'name':'A','capacity':0},{'id':'b','parent':None,'name':'B','capacity':0}];c=copy.deepcopy(base);n=copy.deepcopy(base);c[0]['parent']='b';n[1]['parent']='a';p=plan(base,c,n);self.assertFalse(p['ready']);self.assertIn('cycle',p['errors'][0])
 def test_orphan_after_merge(self):
  c=B[:1];n=copy.deepcopy(B);n.append({'id':'child','parent':'lift','name':'Child','capacity':1});p=plan(B,c,n);self.assertFalse(p['ready']);self.assertTrue(p['errors'])
 def test_transaction_cas_undo_and_replay(self):
  n=copy.deepcopy(B);n[1]['capacity']=8;p=plan(B,B,n);e={'id':'op1','revision':0,'kind':'merge','note':'Checked capacity','base':B,'incoming':n,'resolutions':{},'expected_hash':p['expected_hash']};s=replay(B,[e]);self.assertEqual(s['revision'],1);self.assertEqual(s['records'][0]['capacity'],8);self.assertEqual(replay(B,[e,e]),s);u={'id':'op2','revision':1,'kind':'undo','note':'Undo approved'};self.assertEqual(replay(B,[e,u])['records'],materialize(B));self.assertRaises(ValueError,replay,B,[dict(e,expected_hash='bad')]);self.assertRaises(ValueError,replay,B,[e,dict(u,revision=0)])
 def test_invalid_inputs(self):
  self.assertRaises(ValueError,validate,B+[B[0]]);self.assertRaises(ValueError,plan,B,B,B,{'bad':'current'});bad=copy.deepcopy(B);bad[1]['capacity']=True;self.assertRaises(ValueError,validate,bad)
 def test_seeded_field_oracle(self):
  rng=random.Random(109)
  for _ in range(400):
   b=copy.deepcopy(B);c=copy.deepcopy(B);n=copy.deepcopy(B);x,y=rng.randrange(10),rng.randrange(10);c[1]['capacity']=x;n[1]['capacity']=y
   p=plan(b,c,n);expected=x if y==2 or x==y else y if x==2 else None
   if expected is None:self.assertFalse(p['ready'])
   else:self.assertTrue(p['ready']);self.assertEqual(next(r for r in p['records'] if r['id']=='lift')['capacity'],expected)
 def test_topological_order_independent_sql_oracle(self):
  for rows in itertools.permutations(B):self.assertEqual(materialize(list(rows)),materialize(B))
if __name__=='__main__':unittest.main()
