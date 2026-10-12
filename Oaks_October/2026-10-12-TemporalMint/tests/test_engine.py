import json,random,sys,unittest
sys.path.insert(0,'api');from engine import dataset,materialize,response,corrected
class EngineTests(unittest.TestCase):
 def test_seed_is_reproducible(self):self.assertEqual(dataset(),dataset())
 def test_point_in_time_oracle_120(self):
  anchors,events=dataset();rng=random.Random(10122026)
  for _ in range(120):
   a=rng.choice(anchors);row=next(x for x in materialize()['rows'] if x['shipment_id']==a['shipment_id']);oracle=[e for e in events if e['carrier']==a['carrier'] and e['event_time']<=a['cutoff']];self.assertEqual(row['event_count'],len(oracle));self.assertEqual(row['mean_delay'],round(sum(e['delay'] for e in oracle)/len(oracle),2))
 def test_no_future_lineage(self):
  _,events=dataset();times={e['event_id']:e['event_time'] for e in events}
  for row in materialize()['rows']:self.assertTrue(all(times[x.split(':')[0]]<=row['cutoff'] for x in row['lineage']))
 def test_leakage_audit_detects_future(self):self.assertGreater(materialize(allow_leakage=True)['leakage_count'],0);self.assertEqual(materialize()['leakage_count'],0)
 def test_correction_backfill_is_bounded(self):
  out=response({'action':'backfill','correction':{'event_id':'e-0-4','delay':333,'ingested_at':999}});self.assertNotEqual(out['before_digest'],out['after_digest']);self.assertGreater(len(out['changed']),0);self.assertTrue(all(x['shipment_id'].startswith('ship-') for x in out['changed']))
 def test_latest_revision_wins(self):
  rows=corrected([{'event_id':'e','carrier':'c','event_time':1,'ingested_at':1,'delay':1,'revision':1}],{'event_id':'e','delay':8});self.assertEqual(rows[0]['delay'],8);self.assertEqual(rows[0]['revision'],2)
 def test_invalid_correction_and_action(self):
  with self.assertRaises(ValueError):materialize({'event_id':'missing','delay':2})
  with self.assertRaises(ValueError):response({'action':'erase'})
 def test_digest_deterministic(self):self.assertEqual(materialize()['digest'],materialize()['digest'])
if __name__=='__main__':unittest.main()
