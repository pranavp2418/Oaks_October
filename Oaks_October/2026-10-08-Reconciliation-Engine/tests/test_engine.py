import copy,itertools,json,threading,unittest,urllib.error,urllib.request,random
from pathlib import Path
from http.server import ThreadingHTTPServer
from engine import evaluate,cents,solve_matching,parse_csv,export_csv,Conflict
from api.compute import handler,dispatch
SAMPLE=json.loads((Path(__file__).parents[1]/'data/sample.json').read_text())
def op(key,kind,p):return {'key':key,'type':kind,'payload':p}
def apply(events,c,**rest):return evaluate({'events':events,'command':c,'expectedRevision':len(events),**rest})
class CoreTests(unittest.TestCase):
 def test_exact_cents_strict_input(self):
  self.assertEqual(cents('999999999.99'),99999999999);self.assertEqual(cents('-0.02'),-2)
  for bad in [1.1,'1.001','NaN','1e4',True,' 1.00']:
   with self.assertRaises(ValueError):cents(bad)
 def test_cardinality_residual_reroute(self):self.assertEqual(solve_matching(2,2,[(0,0,1),(0,1,5),(1,0,2)])[:2],(2,7))
 def test_min_cost_against_exhaustive_oracle(self):
  rng=random.Random(8102026)
  for _ in range(80):
   edges=[(a,b,rng.randrange(10)) for a in range(3) for b in range(3) if rng.random()<.65];possible=[(0,0)]
   for size in range(1,4):
    for subset in itertools.combinations(edges,size):
     if len({x[0] for x in subset})==size and len({x[1] for x in subset})==size:possible.append((size,sum(x[2] for x in subset)))
   self.assertEqual(solve_matching(3,3,edges)[:2],min(possible,key=lambda x:(-x[0],x[1])))
 def test_sample_ambiguity_dedup_and_tolerance(self):
  x=evaluate({});self.assertEqual(x['metrics']['matched'],14);self.assertEqual(len(x['duplicates']),1);self.assertEqual(x['ambiguousPairs'],1);self.assertFalse(any(m['book']=='B016' for m in x['matches']))
  y=evaluate({'policy':{'toleranceCents':2,'windowDays':3}});self.assertEqual(y['metrics']['matched'],15);self.assertEqual(next(m for m in y['matches'] if m['book']=='B015')['deltaCents'],-2)
  for k in ['book','bank']:self.assertEqual(len({m[k] for m in y['matches']}),len(y['matches']))
 def test_dataset_order_independence(self):
  d=copy.deepcopy(SAMPLE)
  for k in ['books','bank','prices','movements']:d[k].reverse()
  x=evaluate({});y=evaluate({'dataset':d});self.assertEqual(x['matches'],y['matches']);self.assertEqual(x['inventory'],y['inventory'])
 def test_historical_price_no_lookahead(self):
  x=evaluate({});r=next(p for p in x['prices'] if p['id']=='R01');self.assertEqual(r['asOfCents'],4200);self.assertEqual(r['priceDate'],'2026-09-01')
  self.assertIsNone(next(p for p in x['prices'] if p['id']=='R04')['asOfCents']);self.assertTrue(any(e['id']=='price:R04' for e in x['exceptions']))
 def test_fifo_conservation_shortage_quarantine(self):
  x=evaluate({});self.assertEqual(x['metrics']['inventoryValueCents'],253850);self.assertEqual(x['metrics']['inventoryUnits'],31)
  issue=next(p for p in x['prices'] if p['id']=='I01');self.assertEqual(issue['fifoCostCents'],30*4200+7*4450);self.assertEqual(issue['fifoAllocations'][0]['lot'],'R01')
  self.assertTrue(any(e['id']=='inventory:I02' for e in x['exceptions']));self.assertTrue(all(l['quantity']>=0 for i in x['inventory'] for l in i['lots']))
 def test_review_retry_and_revision(self):
  c=op('review','resolve',{'id':'book:B017','owner':'Demo Analyst','status':'assigned','note':'Checking missing bank entry.'});x=apply([],c);y=apply(x['events'],c)
  self.assertTrue(y['replayed']);self.assertEqual(y['revision'],1);self.assertEqual(x['auditHead'],y['auditHead']);self.assertEqual(next(e for e in x['exceptions'] if e['id']=='book:B017')['status'],'assigned')
  with self.assertRaises(Conflict):apply(x['events'],{**c,'payload':{**c['payload'],'note':'Changed'}})
  with self.assertRaises(Conflict):evaluate({'events':x['events'],'command':{**c,'key':'new'},'expectedRevision':0})
 def test_reviewed_match_unmatch_and_replay(self):
  c=op('m','match',{'book':'B016','bank':'S021','note':'Verified duplicate reference against sample receipt.'});x=apply([],c);self.assertEqual(x['metrics']['matched'],15);self.assertEqual(evaluate({'events':x['events']})['matches'],x['matches'])
  with self.assertRaises(Conflict):apply(x['events'],op('m2','match',{'book':'B016','bank':'S022','note':'Cannot reuse.'}))
  y=apply(x['events'],op('u','unmatch',{'book':'B016','bank':'S021','note':'Exclude edge.'}));self.assertFalse(any(m['bank']=='S021' for m in y['matches']))
 def test_currency_and_account_boundaries(self):
  for field,value in [('currency','EUR'),('account','OTHER')]:
   d=copy.deepcopy(SAMPLE);d['bank'][0][field]=value;x=evaluate({'dataset':d});self.assertFalse(any(m['book']=='B001' for m in x['matches']))
   with self.assertRaises(Conflict):apply([],op('cross','match',{'book':'B001','bank':'S001','note':'Reject crossing.'}),dataset=d)
 def test_invalid_records_policy_and_future_inventory(self):
  d=copy.deepcopy(SAMPLE);d['books'].append({**d['books'][0],'amount':'0.01'})
  with self.assertRaises(ValueError):evaluate({'dataset':d})
  for p in [{'toleranceCents':-1,'windowDays':3},{'toleranceCents':0,'windowDays':31},{'toleranceCents':True,'windowDays':3}]:
   with self.assertRaises(ValueError):evaluate({'policy':p})
  d=copy.deepcopy(SAMPLE);d['movements'][0]['date']='2027-01-01'
  with self.assertRaises(ValueError):evaluate({'dataset':d})
  with self.assertRaises(ValueError):evaluate({'events':[op('bad','unknown',{'note':'Reject'})]})
 def test_csv_validation_and_formula_escape(self):
  source='id,reference,date,account,currency,amount\nB001,INV-1,2026-10-08,OPS,USD,10.01\n';self.assertEqual(parse_csv(source)[0]['amount'],'10.01')
  with self.assertRaises(ValueError):parse_csv('id,amount\n1,5\n')
  value=export_csv([{'book':'=SUM(A1)','bank':'S1','method':'reviewed','deltaCents':0,'dateGap':0,'reason':'@danger'}]);self.assertIn("'=SUM",value);self.assertIn("'@danger",value)
  self.assertEqual(dispatch({'dataset':{'prices':[],'movements':[]},'csv':{'books':source,'bank':source.replace('B001','S001')}})['metrics']['matched'],1)
class APITests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.server=ThreadingHTTPServer(('127.0.0.1',0),handler);threading.Thread(target=cls.server.serve_forever,daemon=True).start();cls.url=f'http://127.0.0.1:{cls.server.server_port}'
 @classmethod
 def tearDownClass(cls):cls.server.shutdown();cls.server.server_close()
 def request(self,body=None,method='POST'):
  req=urllib.request.Request(self.url,data=body,method=method,headers={'Content-Type':'application/json'})
  try:
   with urllib.request.urlopen(req,timeout=5) as r:return r.status,r.headers,r.read()
  except urllib.error.HTTPError as r:return r.code,r.headers,r.read()
 def test_http_success_invalid_input(self):
  status,headers,body=self.request(b'{}');self.assertEqual(status,200);self.assertEqual(headers['Cache-Control'],'no-store');self.assertEqual(json.loads(body)['data']['metrics']['matched'],14)
  self.assertEqual(self.request(b'{broken')[0],400);self.assertEqual(self.request(b'[]')[0],400);self.assertEqual(self.request(method='GET')[0],405)
 def test_http_conflict_and_replay(self):
  c=op('http','match',{'book':'B016','bank':'S021','note':'Reviewed sample receipt.'});x=json.loads(self.request(json.dumps({'command':c,'expectedRevision':0}).encode())[2])['data']
  status,_,body=self.request(json.dumps({'events':x['events'],'command':c,'expectedRevision':0}).encode());self.assertEqual(status,200);self.assertTrue(json.loads(body)['data']['replayed'])
  self.assertEqual(self.request(json.dumps({'events':x['events'],'command':{**c,'key':'fresh'},'expectedRevision':0}).encode())[0],409)
