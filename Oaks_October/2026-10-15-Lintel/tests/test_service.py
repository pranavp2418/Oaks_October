import unittest
from service import handle,ServiceError
from test_core import sample
from core import digest
class ServiceTest(unittest.TestCase):
 def journal(self):return [{'key':'seed','command':{'kind':'create','dossier':sample()},'role':'operator'}]
 def test_real_rehydration_agent_review_without_model_replay(self):
  j=self.journal();result=handle({'journal':j,'action':{'kind':'investigate','goal':'Find owner conflict','mode':'deterministic'}})
  inv=result['investigation'];self.assertEqual(inv['values']['status'],'awaiting_review')
  reviewed=handle({'journal':j,'investigation':inv,'action':{'kind':'review_investigation','review':{'decision':'accept','evidence_hash':digest(sample()),'note':'Reviewed synthetic sources'}}})
  self.assertEqual(reviewed['investigation']['values']['status'],'reviewed')
  self.assertEqual(handle({'journal':j})['export'],handle({'journal':j})['export'])
 def test_mutation_and_stale_review(self):
  j=self.journal();inv=handle({'journal':j,'action':{'kind':'investigate','goal':'Readiness','mode':'deterministic'}})['investigation']
  out=handle({'journal':j,'action':{'kind':'mutate','operation':{'key':'owner','role':'operator','command':{'kind':'evidence','expected_revision':0,'id':'owner','state':'valid','source':'Synthetic source'}}}})
  with self.assertRaises(ServiceError) as ctx:handle({'journal':out['journal'],'investigation':inv,'action':{'kind':'review_investigation','review':{}}})
  self.assertEqual(ctx.exception.status,409)
 def test_forged_report_and_deserialization_rejected(self):
  j=self.journal();inv=handle({'journal':j,'action':{'kind':'investigate','goal':'Readiness','mode':'deterministic'}})['investigation'];inv['values']['report']['ready']=True
  with self.assertRaises(ServiceError):handle({'journal':j,'investigation':inv,'action':{'kind':'review_investigation','review':{}}})
  for payload in ({'journal':[]},{'journal':j,'pickle':'bad'},{'journal':j,'action':{'kind':'submit'}}):
   with self.assertRaises(ServiceError):handle(payload)
if __name__=='__main__':unittest.main()
