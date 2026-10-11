import unittest,copy,json
from core import Engine,Conflict,dataset,project,dispatch,verify_receipt,digest
SCOPE={'subjects':['user-1'],'fields':['subject','activity'],'start':0,'end':19}
class Tests(unittest.TestCase):
 def setUp(self):self.e=Engine();self.i=0
 def op(self,kind,actor='Avery',**kw):
  self.i+=1;a={'id':f'op-{self.i}','kind':kind,'actor':actor,'case':'case-1','expected_revision':self.e.revision,**kw}
  if kind!='create':a['expected_version']=self.e.case('case-1')['version']
  self.e.apply(a);return a
 def prepared(self):self.op('create',scope=copy.deepcopy(SCOPE));self.op('prepare');return json.loads(self.e.case('case-1')['plan'])['hash']
 def released(self):
  h=self.prepared();self.op('approve','Blair',plan_hash=h);self.op('approve','Casey',plan_hash=h);self.op('release','Devon');return json.loads(self.e.case('case-1')['receipt'])
 def test_end_to_end_scope_review_release_revoke(self):
  r=self.released();self.assertTrue(verify_receipt(r));self.assertEqual(r['records'],[{k:v for k,v in x.items() if k in SCOPE['fields']} for x in dataset() if x['subject']=='user-1' and x['sequence']<=19]);self.op('revoke','Devon',note='Synthetic receipt withdrawn');self.assertEqual(self.e.case('case-1')['state'],'revoked');self.assertEqual(json.loads(self.e.case('case-1')['receipt']),r)
 def test_independent_approvals_and_digest_binding(self):
  h=self.prepared()
  with self.assertRaises(ValueError):self.op('approve','Avery',plan_hash=h)
  with self.assertRaises(Conflict):self.op('approve','Blair',plan_hash='wrong')
  self.op('approve','Blair',plan_hash=h)
  with self.assertRaises(Conflict):self.op('approve','Blair',plan_hash=h)
  with self.assertRaises(ValueError):self.op('release','Devon')
  self.assertEqual(len(self.e.view()['cases'][0]['approvals']),1)
 def test_scope_edit_invalidates_old_review(self):
  h=self.prepared();self.op('approve','Blair',plan_hash=h);self.op('scope',scope={**SCOPE,'fields':['activity']});self.assertEqual(self.e.case('case-1')['state'],'draft');self.assertEqual(self.e.view()['cases'][0]['approvals'],[]);self.op('prepare')
  with self.assertRaises(Conflict):self.op('approve','Casey',plan_hash=h)
 def test_reject_reprocess_and_release_immutable(self):
  self.prepared();self.op('reject','Blair',note='Narrow scope');self.assertEqual(self.e.case('case-1')['state'],'draft');self.op('prepare');h=json.loads(self.e.case('case-1')['plan'])['hash'];self.op('approve','Blair',plan_hash=h);self.op('approve','Casey',plan_hash=h);self.op('release','Devon')
  with self.assertRaises(ValueError):self.op('scope',scope=SCOPE)
 def test_rerun_recovery_and_audit_chain(self):
  self.released();view=self.e.view();events=[a['entry']['operation'] for a in view['audit']];result=dispatch({'schema':1,'events':events,'revision':len(events)});self.assertEqual(result['view'],view);prev='0'*64
  for a in view['audit']:self.assertEqual(a['entry']['previous'],prev);self.assertEqual(digest(a['entry']),a['hash']);prev=a['hash']
  a=events[-1];self.assertEqual(self.e.apply(a)['state'],'released');self.assertEqual(self.e.revision,5)
  with self.assertRaises(Conflict):self.e.apply({**a,'actor':'Avery'})
 def test_transaction_fault_rolls_back_all_tables(self):
  self.op('create',scope=SCOPE);before=self.e.view();a={'id':'fault','kind':'prepare','actor':'Avery','case':'case-1','expected_revision':1,'expected_version':0}
  with self.assertRaises(RuntimeError):self.e.apply(a,fail_after=True)
  self.assertEqual(self.e.view(),before);self.e.apply(a);self.assertEqual(self.e.revision,2)
 def test_invalid_scope_snapshot_and_tampered_receipt(self):
  for s in [{**SCOPE,'fields':['password']},{**SCOPE,'end':40},{**SCOPE,'subjects':['user-99']},{**SCOPE,'start':True},{**SCOPE,'fields':[]}]:
   with self.assertRaises(ValueError):project(s)
  with self.assertRaises(ValueError):dispatch({'schema':1,'revision':2,'events':[]})
  r=self.released();r['records'][0]['activity']='tampered'
  with self.assertRaises(ValueError):verify_receipt(r)
 def test_stale_version_and_workspace_race(self):
  self.op('create',scope=SCOPE);a={'id':'stale','kind':'prepare','actor':'Avery','case':'case-1','expected_revision':0,'expected_version':0}
  with self.assertRaises(Conflict):self.e.apply(a)
  a['expected_revision']=1;a['expected_version']=9
  with self.assertRaises(Conflict):self.e.apply(a)
  self.assertEqual(self.e.revision,1)
 def test_projection_oracle_100_scopes(self):
  for i in range(100):
   s={'subjects':[f'user-{i%5+1}'],'fields':['region','activity'] if i%2 else ['email'],'start':i%20,'end':20+i%20};actual=project(s);oracle=[]
   for r in dataset():
    if r['subject'] in s['subjects'] and s['start']<=r['sequence']<=s['end']:oracle.append({k:r[k] for k in sorted(s['fields'])})
   self.assertEqual(actual,oracle)
if __name__=='__main__':unittest.main()
