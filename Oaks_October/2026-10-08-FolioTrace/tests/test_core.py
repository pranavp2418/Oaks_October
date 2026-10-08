import unittest,json,copy,math,collections,threading,urllib.request,urllib.error
from pathlib import Path
from http.server import HTTPServer
from core import Index,workspace,reading_order,terms
from api.workspace import handler
seed=json.loads(Path('data/seed.json').read_text())
def op(kind,payload,id='x',rev=0):return dict(id=id,revision=rev,type=kind,payload=payload)
class Tests(unittest.TestCase):
 def test_oracle_scores(self):
  idx=Index(seed['documents']);query='pump bearing vibration';docs=seed['documents'];n=len(docs);lens=[len(terms(' '.join(b['text'] for b in d['blocks']))) for d in docs];avg=sum(lens)/n;scores={}
  for d,dl in zip(docs,lens):
   tf=collections.Counter(terms(' '.join(b['text'] for b in d['blocks'])));score=0
   for t in terms(query):
    df=sum(t in terms(' '.join(b['text'] for b in x['blocks'])) for x in docs);f=tf[t]
    if f:score+=round(math.log(1+(n-df+.5)/(df+.5))*f*2.2/(f+1.2*(.25+.75*dl/avg)),6)
   if score:scores[d['id']]=round(score,6)
  actual=idx.search(query);self.assertEqual([r['id'] for r in actual],sorted(scores,key=lambda id:(-scores[id],id)))
  for r in actual:self.assertAlmostEqual(r['score'],scores[r['id']],places=5)
 def test_postings_candidates_match_sql_oracle(self):
  for query in ['pump','temperature vibration','noSuchWord','battery moisture','']:
   r=workspace({**seed,'query':query});self.assertEqual(sorted(x['id'] for x in r['results']),r['oracle_candidates'])
 def test_incremental_update_equals_rebuild(self):
  idx=Index(seed['documents']);docs=copy.deepcopy(seed['documents']);docs[0]['blocks'][0]['text']='unique replacement sensor';idx.upsert(docs[0]);self.assertEqual(idx.search('unique sensor'),Index(docs).search('unique sensor'));self.assertNotIn('F01',idx.postings['mount'])
 def test_and_filter_and_empty(self):
  i=Index(seed['documents']);self.assertEqual(i.search('pump neverword','all'),[]);self.assertEqual(i.search('!!!'),[]);self.assertEqual([r['id'] for r in i.search('pump bearing','all')],['F04'])
 def test_citations_and_order(self):
  r=workspace(seed);self.assertEqual(r['results'][0]['id'],'F04')
  for x in r['results']:
   for c in x['citations']:
    source=next(b for d in seed['documents'] if d['id']==x['id'] for b in d['blocks'] if b['id']==c['block']);self.assertEqual(c['text'],source['text']);self.assertEqual(c['box'],source['box'])
  blocks=seed['documents'][0]['blocks'];self.assertEqual(reading_order(list(reversed(blocks))),blocks)
 def test_review_publication_and_recovery(self):
  events=[op('correct',{'document':'F04','block':'B1','text':'Corrected impeller vibration'},'a'),op('review',{'document':'F04','note':'Checked source region'},'b',1),op('publish',{'document':'F04'},'c',2)]
  draft=workspace({**seed,'events':events[:1]});self.assertEqual(draft['stats']['published'],11);self.assertNotIn('F04',[x['id'] for x in draft['results']]);r=workspace({**seed,'events':events});self.assertEqual(r['revision'],3);self.assertEqual(r,workspace(json.loads(json.dumps({**seed,'events':events}))))
  self.assertEqual(r['documents'][3]['version'],1);self.assertNotEqual(r['index_digest'],workspace(seed)['index_digest'])
 def test_illegal_transitions(self):
  for e in [op('publish',{'document':'F01'}),op('review',{'document':'F01','note':'ok'}),op('wrong',{'document':'F01'})]:self.assertRaises(ValueError,workspace,{**seed,'events':[e]})
 def test_identity_conflicts(self):
  e=op('correct',{'document':'F01','block':'B1','text':'new correction'});self.assertEqual(workspace({**seed,'events':[e,e]})['revision'],1)
  self.assertRaisesRegex(ValueError,'conflict',workspace,{**seed,'events':[e,{**e,'payload':{**e['payload'],'text':'other'}}]});self.assertRaisesRegex(ValueError,'conflict',workspace,{**seed,'events':[{**e,'revision':2}]})
 def test_invalid_schema_preserves_original(self):
  d=copy.deepcopy(seed);d['documents'][0]['blocks'][0]['box']=[0,0,-1,1];self.assertRaises(ValueError,workspace,d);self.assertEqual(workspace(seed)['revision'],0);self.assertRaises(ValueError,workspace,{**seed,'mode':'nonsense'});self.assertRaises(ValueError,workspace,{**seed,'query':'x'*301})
 def test_held_out_evaluation(self):
  r=workspace(seed)['evaluation'];self.assertEqual(len(r['queries']),6);self.assertEqual(r['mean_reciprocal_rank'],1);self.assertEqual(r['mean_recall_at_3'],1)
 def test_actual_http(self):
  server=HTTPServer(('127.0.0.1',0),handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();url='http://127.0.0.1:'+str(server.server_port)
  try:
   for method,body,expected in [('POST',json.dumps(seed).encode(),200),('GET',None,405),('POST',b'{',400),('POST',json.dumps({**seed,'events':[op('correct',{},rev=2)]}).encode(),409)]:
    try:r=urllib.request.urlopen(urllib.request.Request(url,data=body,method=method));status=r.status;data=json.load(r)
    except urllib.error.HTTPError as e:status=e.code;data=json.load(e)
    self.assertEqual(status,expected)
   self.assertEqual(workspace(seed),workspace(seed))
  finally:server.shutdown();server.server_close()
if __name__=='__main__':unittest.main()
