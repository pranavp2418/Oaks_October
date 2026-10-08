"""Deterministic layout-aware retrieval with revisioned document review."""
import collections,copy,hashlib,json,math,re,sqlite3

def terms(text):
    return re.findall(r'[a-z0-9]+',text.lower())

def validate_docs(docs):
    if not isinstance(docs,list) or not 1<=len(docs)<=80: raise ValueError('Provide 1–80 documents')
    ids=set()
    for d in docs:
        if not isinstance(d,dict) or not isinstance(d.get('id'),str) or not d['id'] or len(d['id'])>80 or d['id'] in ids: raise ValueError('Invalid/duplicate document identity')
        ids.add(d['id'])
        if not isinstance(d.get('title'),str) or not 1<=len(d['title'])<=200:raise ValueError('Document title required')
        blocks=d.get('blocks')
        if not isinstance(blocks,list) or not 1<=len(blocks)<=100:raise ValueError('Provide 1–100 blocks')
        bids=set()
        for b in blocks:
            if not isinstance(b,dict) or not isinstance(b.get('id'),str) or not b['id'] or b['id'] in bids or len(b['id'])>80:raise ValueError('Invalid/duplicate block identity')
            bids.add(b['id'])
            if not isinstance(b.get('text'),str) or not 1<=len(b['text'])<=4000:raise ValueError('Block text required (max 4000)')
            if not isinstance(b.get('page'),int) or isinstance(b['page'],bool) or not 1<=b['page']<=100:raise ValueError('Invalid page')
            box=b.get('box')
            if not isinstance(box,list) or len(box)!=4 or any(type(x) not in (int,float) or not math.isfinite(x) for x in box) or not(0<=box[0]<box[2]<=1 and 0<=box[1]<box[3]<=1):raise ValueError('Box must be normalized [x0,y0,x1,y1]')

def reading_order(blocks):
    # Explicit two-column mode: full-width headings first, then left/right columns.
    return sorted(blocks,key=lambda b:(b['page'],0 if b['box'][2]-b['box'][0]>.7 else 1 if b['box'][0]<.5 else 2,b['box'][1],b['box'][0],b['id']))

class Index:
    def __init__(self,docs):
        self.docs={};self.postings=collections.defaultdict(dict);self.lengths={};self.total=0
        for d in docs:self.upsert(d)
    def upsert(self,d):
        id=d['id']
        if id in self.docs:
            for t in self.docs[id]['tf']:self.postings[t].pop(id,None)
            self.total-=self.lengths[id]
        text=' '.join(b['text'] for b in reading_order(d['blocks']));tf=collections.Counter(terms(text));self.docs[id]={'doc':d,'tf':tf,'text':text};self.lengths[id]=sum(tf.values());self.total+=self.lengths[id]
        for t,n in tf.items():self.postings[t][id]=n
    def search(self,query,mode='any',limit=10):
        if not isinstance(query,str) or len(query)>300:raise ValueError('Query max 300 characters')
        if mode not in ['any','all']:raise ValueError('Mode must be any or all')
        tokens=list(dict.fromkeys(terms(query)))
        if not tokens:return []
        candidates=set().union(*(self.postings[t].keys() for t in tokens))
        if mode=='all':
            for t in tokens:candidates.intersection_update(self.postings[t])
        n=len(self.docs);avg=self.total/max(n,1);scores={}
        for id in candidates:
            contributions=[]
            for t in tokens:
                tf=self.postings[t].get(id,0);df=len(self.postings[t]);idf=math.log(1+(n-df+.5)/(df+.5));score=idf*tf*2.2/(tf+1.2*(.25+.75*self.lengths[id]/max(avg,1))) if tf else 0
                if tf:contributions.append({'term':t,'tf':tf,'df':df,'score':round(score,6)})
            scores[id]=(sum(c['score'] for c in contributions),contributions)
        results=[]
        for id in sorted(scores,key=lambda id:(-scores[id][0],id))[:limit]:
            d=self.docs[id]['doc'];citations=[]
            for b in reading_order(d['blocks']):
                matched=[t for t in tokens if t in terms(b['text'])]
                if matched:citations.append({'block':b['id'],'page':b['page'],'box':b['box'],'text':b['text'],'matched':matched,'document_version':d.get('version',0)})
            results.append({'id':id,'title':d['title'],'score':round(scores[id][0],6),'contributions':scores[id][1],'citations':citations})
        return results

def evaluate(index,qrels):
    if not isinstance(qrels,list) or len(qrels)>40:raise ValueError('Invalid evaluation')
    rows=[]
    for q in qrels:
        if not isinstance(q,dict) or not isinstance(q.get('relevant'),list) or not q['relevant']:raise ValueError('Evaluation needs relevant IDs')
        found=[r['id'] for r in index.search(q.get('query',''))];relevant=set(q['relevant']);rr=next((1/(i+1) for i,id in enumerate(found) if id in relevant),0)
        rows.append({'query':q['query'],'top':found[:3],'recall_at_3':len(set(found[:3])&relevant)/len(relevant),'reciprocal_rank':rr})
    return {'queries':rows,'mean_reciprocal_rank':sum(r['reciprocal_rank'] for r in rows)/max(1,len(rows)),'mean_recall_at_3':sum(r['recall_at_3'] for r in rows)/max(1,len(rows))}

def workspace(body):
    if not isinstance(body,dict):raise ValueError('Object required')
    docs=copy.deepcopy(body.get('documents'));validate_docs(docs)
    for d in docs:d.update(version=0,status='published',review_note='Synthetic baseline')
    events=body.get('events',[])
    if not isinstance(events,list) or len(events)>300:raise ValueError('Event journal exceeds bound')
    seen={};revision=0;history=[];db=sqlite3.connect(':memory:');db.execute('CREATE TABLE audit(revision INTEGER PRIMARY KEY,id TEXT UNIQUE,kind TEXT,document TEXT,digest TEXT)')
    try:
        for e in events:
            if not isinstance(e,dict) or not isinstance(e.get('id'),str) or not 1<=len(e['id'])<=80 or type(e.get('revision'))!=int:raise ValueError('Invalid operation identity')
            serial=json.dumps(e,sort_keys=True);id=e['id']
            if id in seen:
                if seen[id]!=serial:raise ValueError('Idempotency key conflict')
                continue
            if e['revision']!=revision:raise ValueError('Revision conflict')
            p=e.get('payload',{});d=next((d for d in docs if d['id']==p.get('document')),None)
            if not d:raise ValueError('Document not found')
            if e.get('type')=='correct':
                b=next((b for b in d['blocks'] if b['id']==p.get('block')),None)
                if not b or not isinstance(p.get('text'),str) or not 1<=len(p['text'])<=4000:raise ValueError('Correction needs a valid block and text')
                b['text']=p['text'];d['version']+=1;d['status']='draft';d['review_note']=''
            elif e.get('type')=='review':
                if d['status']!='draft':raise ValueError('Only a draft can be reviewed')
                if not isinstance(p.get('note'),str) or not 4<=len(p['note'].strip())<=300:raise ValueError('Meaningful review note required')
                d['status']='reviewed';d['review_note']=p['note']
            elif e.get('type')=='publish':
                if d['status']!='reviewed':raise ValueError('Review document before publication')
                d['status']='published'
            else:raise ValueError('Unknown operation')
            revision+=1;seen[id]=serial
            digest=hashlib.sha256((history[-1]['digest'] if history else '') .encode()+serial.encode()).hexdigest()
            db.execute('INSERT INTO audit VALUES(?,?,?,?,?)',(revision,id,e['type'],d['id'],digest));history.append(dict(revision=revision,id=id,type=e['type'],document=d['id'],digest=digest))
        db.commit();idx=Index([d for d in docs if d['status']=='published']);results=idx.search(body.get('query',''),body.get('mode','any'))
        # Exact lexical membership oracle using SQLite token rows, independent of postings.
        db.execute('CREATE TABLE tokens(document TEXT,term TEXT,PRIMARY KEY(document,term))')
        for d in idx.docs.values():db.executemany('INSERT INTO tokens VALUES(?,?)',[(d['doc']['id'],t) for t in set(terms(d['text']))])
        query=terms(body.get('query',''));oracle=sorted({r[0] for t in query for r in db.execute('SELECT document FROM tokens WHERE term=?',(t,))})
        stats={'published':len(idx.docs),'documents':len(docs),'terms':sum(bool(v) for v in idx.postings.values()),'tokens':idx.total,'posting_pairs':sum(len(v) for v in idx.postings.values())}
        return dict(revision=revision,documents=docs,results=results,history=history,stats=stats,evaluation=evaluate(idx,body.get('qrels',[])),oracle_candidates=oracle,index_digest=hashlib.sha256(json.dumps([(d['id'],d['version'],d['blocks']) for d in docs if d['status']=='published'],sort_keys=True).encode()).hexdigest())
    finally:db.close()
