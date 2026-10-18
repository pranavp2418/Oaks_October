import concurrent.futures,json,pathlib,sqlite3,tempfile,unittest
from workspace import Workspace,Conflict,Forbidden
from test_core import sample
class WorkspaceTest(unittest.TestCase):
 def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.path=pathlib.Path(self.tmp.name)/'workspace.sqlite';self.w=Workspace(self.path);self.created=self.w.mutate('site','import',{'kind':'create','dossier':sample()})
 def tearDown(self):self.tmp.cleanup()
 def test_restart_idempotency_conflict_atomicity(self):
  self.assertEqual(Workspace(self.path).load('site'),self.created['state'])
  self.assertEqual(self.w.mutate('site','import',{'kind':'create','dossier':sample()}),self.created)
  changed=sample();changed['deadline']=2
  with self.assertRaises(Conflict):self.w.mutate('site','import',{'kind':'create','dossier':changed})
  before=self.w.export('site')
  with self.assertRaises(Conflict):self.w.mutate('site','bad',{'kind':'evidence','expected_revision':9,'id':'owner','state':'valid','source':'Synthetic'})
  self.assertEqual(before,self.w.export('site'))
 def test_review_fencing_and_complete_workflow(self):
  revision=0
  for item in sample()['evidence']:
   r=self.w.mutate('site',f"e-{item['id']}",{'kind':'evidence','expected_revision':revision,'id':item['id'],'state':'valid','source':'Synthetic reviewed source'});revision=r['revision']
  r=self.w.mutate('site','p',{'kind':'propose','expected_revision':revision,'alternative':0});h=r['state']['proposal']['hash'];revision=r['revision']
  review={'kind':'review','expected_revision':revision,'proposal_hash':h,'decision':'approve','note':'Sources independently checked in synthetic fixture'}
  with self.assertRaises(Forbidden):self.w.mutate('site','review',review)
  r=self.w.mutate('site','review',review,'reviewer');revision=r['revision']
  r=self.w.mutate('site','prepare',{'kind':'prepare','expected_revision':revision,'proposal_hash':h},'reviewer')
  self.assertIsNotNone(r['state']['prepared_dossier']);self.assertTrue(Workspace(self.path).export('site')['compiler']['ready'])
  self.w.mutate('site','invalidate',{'kind':'evidence','expected_revision':r['revision'],'id':'owner','state':'expired','source':'Synthetic expiry'})
  self.assertIsNone(self.w.load('site')['proposal']);self.assertIsNone(self.w.load('site')['prepared_dossier'])
 def test_racing_writers_only_one_commits(self):
  def race(i):
   try:return Workspace(self.path).mutate('site',f'race-{i}',{'kind':'evidence','expected_revision':0,'id':'owner','state':'valid','source':f'Synthetic {i}'})['revision']
   except Conflict:return 'conflict'
  with concurrent.futures.ThreadPoolExecutor(8) as pool:results=list(pool.map(race,range(8)))
  self.assertEqual(results.count(1),1);self.assertEqual(results.count('conflict'),7);self.assertEqual(len(self.w.export('site')['events']),2)
 def test_corruption_is_not_silent(self):
  with sqlite3.connect(self.path) as db:db.execute("UPDATE audit SET hash='tampered'")
  with self.assertRaises(Conflict):self.w.export('site')
 def test_unready_dossier_cannot_be_prepared(self):
  r=self.w.mutate('site','p',{'kind':'propose','expected_revision':0,'alternative':0});h=r['state']['proposal']['hash']
  r=self.w.mutate('site','r',{'kind':'review','expected_revision':1,'proposal_hash':h,'decision':'approve','note':'Plan only'},'reviewer')
  with self.assertRaises(Conflict):self.w.mutate('site','prepare',{'kind':'prepare','expected_revision':2,'proposal_hash':h},'reviewer')
if __name__=='__main__':unittest.main()
