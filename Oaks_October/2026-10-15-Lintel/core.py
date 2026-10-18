"""Bounded prerequisite frontier compiler. All datasets are synthetic decision support."""
from __future__ import annotations
from dataclasses import dataclass
from hashlib import sha256
import json

class ContractError(ValueError):
    pass

class ComplexityLimit(ContractError):
    pass

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True, allow_nan=False)

def digest(value):
    return sha256(canonical(value).encode()).hexdigest()

def integer(value, lo, hi, label):
    if type(value) is not int or not lo <= value <= hi:
        raise ContractError(f'{label}: integer {lo}..{hi} required')
    return value

def text(value, label, limit=160):
    if not isinstance(value, str) or not value.strip() or len(value)>limit:
        raise ContractError(f'{label}: nonempty text up to {limit} characters required')
    return value

@dataclass(frozen=True)
class Dossier:
    evidence: dict
    requirements: dict
    root: str
    deadline: int
    revision: int

    @staticmethod
    def parse(data):
        if not isinstance(data,dict) or set(data)!={'evidence','requirements','root','deadline','revision'}:
            raise ContractError('Expected evidence, requirements, root, deadline and revision only')
        es,rs=data['evidence'],data['requirements']
        if not isinstance(es,list) or not 1<=len(es)<=20 or not isinstance(rs,list) or not 1<=len(rs)<=40:
            raise ContractError('Expected 1..20 evidence items and 1..40 requirements')
        evidence={}
        for e in es:
            if not isinstance(e,dict) or set(e)!={'id','title','state','days','cost','source','version'}:
                raise ContractError('Invalid evidence fields')
            key=text(e['id'],'evidence id',48)
            if key in evidence:raise ContractError('Duplicate evidence id')
            text(e['title'],'title');text(e['source'],'source',400)
            if e['state'] not in ('missing','valid','expired','rejected','conflicting'):raise ContractError('Invalid evidence state')
            integer(e['days'],0,365,'days');integer(e['cost'],0,1000000,'cost');integer(e['version'],1,1000000,'version')
            evidence[key]=dict(e)
        requirements={}
        for r in rs:
            if not isinstance(r,dict) or set(r)!={'id','title','op','inputs','days'}:raise ContractError('Invalid requirement fields')
            key=text(r['id'],'requirement id',48);text(r['title'],'title')
            if key in evidence or key in requirements:raise ContractError('Duplicate node id')
            if r['op'] not in ('all','any'):raise ContractError('Requirement op must be all or any')
            if not isinstance(r['inputs'],list) or not 1<=len(r['inputs'])<=12:raise ContractError('Expected 1..12 distinct input ids')
            for x in r['inputs']:text(x,'input id',48)
            if len(set(r['inputs']))!=len(r['inputs']):raise ContractError('Expected distinct input ids')
            integer(r['days'],0,365,'requirement days');requirements[key]=dict(r)
        root=text(data['root'],'root',48)
        if root not in requirements:raise ContractError('Root must identify a requirement')
        known=set(evidence)|set(requirements)
        for r in requirements.values():
            if any(x not in known for x in r['inputs']):raise ContractError('Unknown dependency')
        visiting=set();visited=set()
        def visit(k):
            if k in visiting:raise ContractError('Cyclic prerequisites')
            if k in visited or k in evidence:return
            visiting.add(k)
            for child in requirements[k]['inputs']:visit(child)
            visiting.remove(k);visited.add(k)
        for k in requirements:visit(k)
        return Dossier(evidence,requirements,root,integer(data['deadline'],0,730,'deadline'),integer(data['revision'],0,1000000,'revision'))


def minimal(sets, limit=2048):
    """An antichain of inclusion-minimal missing evidence sets; no truncated success."""
    unique=set(sets)
    if len(unique)>limit:raise ComplexityLimit('Frontier exceeds bounded exact-search capacity')
    result=[]
    for item in sorted(unique,key=lambda s:(len(s),tuple(sorted(s)))):
        if not any(x<=item for x in result):result.append(item)
    return tuple(result)


def compile_dossier(data):
    d=Dossier.parse(data);cache={};timing={};rows={};visits=0
    def solve(k):
        nonlocal visits
        if k in cache:return cache[k]
        visits+=1
        if k in d.evidence:
            e=d.evidence[k];front=(frozenset(),) if e['state']=='valid' else (frozenset([k]),)
            timing[k]=0 if e['state']=='valid' else e['days']
            rows[k]={'id':k,'ready':e['state']=='valid','earliest_day':timing[k],'kind':'evidence','state':e['state']}
        else:
            r=d.requirements[k];children=[solve(x) for x in r['inputs']]
            if r['op']=='any':front=minimal(x for c in children for x in c)
            else:
                front=(frozenset(),)
                for c in children:
                    # Bound intermediate work before constructing a potentially huge product.
                    if len(front)*len(c)>65536:raise ComplexityLimit('Prerequisite cross-product exceeds exact-search capacity')
                    front=minimal(a|b for a in front for b in c)
            values=[timing[x] for x in r['inputs']]
            timing[k]=(max(values) if r['op']=='all' else min(values))+r['days']
            rows[k]={'id':k,'ready':frozenset() in front,'earliest_day':timing[k],'kind':r['op'],'inputs':r['inputs']}
        cache[k]=front;return front
    frontier=solve(d.root)
    for k in sorted(d.requirements):solve(k)
    choices=[]
    for missing in frontier:
        contradictions=[k for k in sorted(missing) if d.evidence[k]['state']=='conflicting']
        choices.append({'missing':sorted(missing),'cost':sum(d.evidence[k]['cost'] for k in missing),'conflicts':contradictions,'review_required':bool(contradictions)})
    choices.sort(key=lambda c:(bool(c['conflicts']),c['cost'],len(c['missing']),c['missing']))
    # Each alternative gets its own critical path. A globally earliest path need not be cheapest.
    for choice in choices:
        acquired=set(choice['missing']);memo={}
        def path(k):
            if k in memo:return memo[k]
            if k in d.evidence:
                e=d.evidence[k];v=0 if e['state']=='valid' else e['days'] if k in acquired else None
            else:
                r=d.requirements[k];vs=[path(x) for x in r['inputs']]
                if r['op']=='all':v=None if None in vs else max(vs)+r['days']
                else:
                    ok=[v for v in vs if v is not None];v=min(ok)+r['days'] if ok else None
            memo[k]=v;return v
        choice['earliest_day']=path(d.root)
        choice['slack_days']=d.deadline-choice['earliest_day']
    return {'schema_version':1,'revision':d.revision,'input_hash':digest(data),'root':d.root,'ready':frozenset() in frontier,'earliest_day':timing[d.root],'deadline':d.deadline,'slack_days':d.deadline-timing[d.root],'alternatives':choices,'nodes':[rows[k] for k in sorted(rows)],'metrics':{'evaluated_nodes':visits,'minimal_frontiers':len(frontier),'evidence_count':len(d.evidence)},'limits':'Bounded exact prerequisites on synthetic rules; not legal or authority approval.'}


def evaluate_assignment(data, acquired):
    """Simple Boolean reference evaluation, useful for external independent enumeration."""
    d=Dossier.parse(data)
    def value(k):
        if k in d.evidence:return d.evidence[k]['state']=='valid' or k in acquired
        r=d.requirements[k];xs=[value(x) for x in r['inputs']]
        return all(xs) if r['op']=='all' else any(xs)
    return value(d.root)
