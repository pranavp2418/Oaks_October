import unittest,copy,itertools
from core import allocate,replay,Conflict
A={'id':'a','member':'m','service':'s','start':'2026-10-01','end':'2026-10-10','units':1}
V={'id':'v','member':'m','service':'s','date':'2026-10-05'}
class Tests(unittest.TestCase):
 def setUp(self): self.data={'authorizations':[copy.deepcopy(A)],'visits':[copy.deepcopy(V)]}
 def test_capacity_and_interval(self):
  self.data['visits'] += [dict(V,id='w'),dict(V,id='x',date='2026-10-11')]
  r=allocate(self.data);self.assertEqual((r['covered'],r['uncovered']),(1,2));self.assertEqual(r['assignments'][-1]['reason'],'no_matching_interval')
 def test_earliest_expiry_preserves_future(self):
  self.data['authorizations']+=[dict(A,id='b',end='2026-10-20')];self.data['visits']+=[dict(V,id='w',date='2026-10-15')]
  self.assertEqual(allocate(self.data)['covered'],2)
 def test_replay_idempotency_conflict_audit(self):
  e={'key':'x','type':'capacity','authorization':'a','units':2,'expected_revision':0}
  r=replay(self.data,[e,e]);self.assertEqual(r['revision'],1);self.assertEqual(r['allocation']['remaining']['a'],1)
  self.assertEqual(replay(self.data,[e])['audit'],r['audit'])
  with self.assertRaises(Conflict): replay(self.data,[e,dict(e,units=3)])
  with self.assertRaises(Conflict): replay(self.data,[dict(e,expected_revision=1)])
 def test_validation(self):
  for bad in [dict(A,units=-1),dict(A,units=True),dict(A,end='2026-09-01')]:
   with self.assertRaises(ValueError): allocate({'authorizations':[bad],'visits':[]})
  with self.assertRaises(ValueError): allocate({'authorizations':[A,A],'visits':[]})
 def test_order_invariance(self):
  self.data['visits']+=[dict(V,id='w',date='2026-10-06')]
  for perm in itertools.permutations(self.data['visits']): self.assertEqual(allocate(dict(self.data,visits=list(perm)))['assignments'],allocate(self.data)['assignments'])
if __name__=='__main__': unittest.main()
