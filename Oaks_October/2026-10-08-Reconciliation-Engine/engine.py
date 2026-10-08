"""Bounded reconciliation, as-of pricing and FIFO inventory with exact cents.
No accounts or real money are moved; persistence belongs to the browser journal.
"""
import csv
import hashlib
import io
import json
import re
import sqlite3
from collections import deque
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path


class Conflict(ValueError):
    pass


def cents(value):
    if not isinstance(value, str) or not re.fullmatch(r"-?\d{1,9}(\.\d{1,2})?", value):
        raise ValueError("Money must be a decimal string with at most two fractional digits.")
    try:
        n = Decimal(value) * 100
        if not n.is_finite() or n != n.to_integral_value():
            raise ValueError("Invalid money value.")
        return int(n)
    except InvalidOperation as e:
        raise ValueError("Invalid money value.") from e


def day(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Dates must use YYYY-MM-DD.")
    return date.fromisoformat(value).toordinal()


def text(value, name, limit=120):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError(f"{name} requires 1–{limit} characters.")
    return value.strip()


def reference(s):
    return re.sub(r"[^A-Z0-9]", "", s.upper())


def records(values, side):
    if not isinstance(values, list) or len(values) > 60:
        raise ValueError(f"{side} must contain at most 60 records.")
    seen, result, duplicates = {}, [], []
    for raw in values:
        if not isinstance(raw, dict):
            raise ValueError("Each record must be an object.")
        r = {"id": text(raw.get("id"), "id", 50), "reference": text(raw.get("reference"), "reference"), "date": raw.get("date"), "account": text(raw.get("account"), "account", 60), "currency": text(raw.get("currency"), "currency", 3), "amount": raw.get("amount")}
        r["day"], r["cents"], r["normalized"] = day(r["date"]), cents(r["amount"]), reference(r["reference"])
        if not re.fullmatch(r"[A-Z]{3}", r["currency"]) or not r["normalized"]:
            raise ValueError("Currency must be three uppercase letters and reference must contain alphanumeric characters.")
        if r["id"] in seen:
            if seen[r["id"]] != r:
                raise ValueError("Conflicting duplicate record ID: " + r["id"])
            duplicates.append({"side": side, "id": r["id"]})
        else:
            seen[r["id"]] = r
            result.append(r)
    return sorted(result, key=lambda x: x["id"]), duplicates


def solve_matching(n, m, candidates, forbidden=None):
    """Successive shortest augmenting paths with residual reverse edges.
    Bellman-Ford handles negative residual costs; flow maximizes cardinality first.
    Costs then minimize date distance and exact cent differences.
    """
    size, source, sink = n + m + 2, n + m, n + m + 1
    graph = [[] for _ in range(size)]
    def add(a, b, cost):
        graph[a].append([b, 1, cost, len(graph[b])])
        graph[b].append([a, 0, -cost, len(graph[a])-1])
    for a in range(n): add(source, a, 0)
    for b in range(m): add(n+b, sink, 0)
    links = []
    for a, b, cost in sorted(candidates):
        if (a, b) == forbidden: continue
        links.append((a, b, len(graph[a])))
        add(a, n+b, cost)
    flow = total = 0
    while True:
        distance, parent = [10**30]*size, [None]*size
        distance[source] = 0
        for _ in range(size-1):
            changed = False
            for a in range(size):
                if distance[a] == 10**30: continue
                for k, (b, capacity, cost, _) in enumerate(graph[a]):
                    if capacity and distance[a]+cost < distance[b]:
                        distance[b], parent[b], changed = distance[a]+cost, (a, k), True
            if not changed: break
        if parent[sink] is None: break
        node = sink
        while node != source:
            a, k = parent[node]; edge = graph[a][k]
            edge[1] -= 1; graph[node][edge[3]][1] += 1; node = a
        flow += 1; total += distance[sink]
    matches = [(a,b) for a,b,k in links if graph[a][k][1] == 0]
    return flow, total, matches


def reconciliation(books, bank, policy, manual, blocked):
    used_a, used_b = {a for a,b in manual}, {b for a,b in manual}
    left = [x for x in books if x["id"] not in used_a]
    right = [x for x in bank if x["id"] not in used_b]
    candidates = []
    for a,x in enumerate(left):
        for b,y in enumerate(right):
            delta, gap = abs(x["cents"]-y["cents"]), abs(x["day"]-y["day"])
            if x["account"] == y["account"] and x["currency"] == y["currency"] and x["normalized"] == y["normalized"] and delta <= policy["toleranceCents"] and gap <= policy["windowDays"] and (x["id"],y["id"]) not in blocked:
                candidates.append((a,b,gap*10001+delta))
    flow, cost, proposed = solve_matching(len(left),len(right),candidates)
    ambiguous = set()
    for pair in proposed:
        alternative = solve_matching(len(left),len(right),candidates,forbidden=pair)
        if alternative[:2] == (flow,cost): ambiguous.add(pair)
    matches = []
    for a,b in proposed:
        if (a,b) in ambiguous: continue
        x,y=left[a],right[b]
        matches.append({"book":x["id"],"bank":y["id"],"deltaCents":y["cents"]-x["cents"],"dateGap":abs(x["day"]-y["day"]),"method":"automatic","reason":"Same normalized reference/account/currency; globally optimal unique pairing."})
    for (a,b),note in manual.items():
        x=next(x for x in books if x["id"]==a);y=next(y for y in bank if y["id"]==b)
        matches.append({"book":a,"bank":b,"deltaCents":y["cents"]-x["cents"],"dateGap":abs(x["day"]-y["day"]),"method":"reviewed","reason":note})
    used_a,used_b={x["book"] for x in matches},{x["bank"] for x in matches}
    exceptions=[]
    for side,rs,used,others in [("book",books,used_a,bank),("bank",bank,used_b,books)]:
        for x in rs:
            if x["id"] in used: continue
            peers=[y for y in others if y["normalized"]==x["normalized"] and y["account"]==x["account"] and y["currency"]==x["currency"]]
            reason="ambiguous optimal pairing" if any((left[a]["id"] if side=="book" else right[b]["id"])==x["id"] for a,b in ambiguous) else "reference found; amount/date mismatch" if peers else "no matching reference"
            exceptions.append({"id":side+":"+x["id"],"side":side,"record":x["id"],"reason":reason,"amountCents":x["cents"],"currency":x["currency"],"candidates":[y["id"] for y in peers]})
    return {"matches":sorted(matches,key=lambda x:x["book"]),"exceptions":exceptions,"optimalCardinality":flow+len(manual),"ambiguousPairs":len(ambiguous),"candidateEdges":len(candidates)}


def pricing_and_fifo(dataset):
    prices, lots, alignments, exceptions = [], {}, [], []
    price_keys=set()
    for p in dataset.get("prices",[]):
        sku=text(p.get("sku"),"sku",50);d=day(p.get("date"));value=cents(p.get("price"))
        if value<0 or (sku,d) in price_keys: raise ValueError("Price entries require nonnegative values and unique SKU/date keys.")
        price_keys.add((sku,d));prices.append((sku,d,value))
    with sqlite3.connect(":memory:") as db:
        db.execute("CREATE TABLE prices(sku TEXT, effective_day INTEGER, cents INTEGER, PRIMARY KEY(sku,effective_day))")
        db.executemany("INSERT INTO prices VALUES(?,?,?)",prices)
        movements=[];ids=set()
        for raw in dataset.get("movements",[]):
            r={k:raw.get(k) for k in ["id","sku","date","type","quantity","unitCost"]};r["id"]=text(r["id"],"movement id",50);r["sku"]=text(r["sku"],"sku",50);r["day"]=day(r["date"])
            if r["id"] in ids: raise ValueError("Duplicate movement ID.")
            ids.add(r["id"])
            if r["type"] not in ["receipt","issue"] or type(r["quantity"]) is not int or not 1<=r["quantity"]<=10000: raise ValueError("Movement needs receipt/issue type and 1–10000 integer units.")
            r["unitCents"]=cents(r["unitCost"])
            if r["unitCents"]<0: raise ValueError("Unit cost cannot be negative.")
            movements.append(r)
        for r in sorted(movements,key=lambda x:(x["day"],x["id"])):
            historical=db.execute("SELECT effective_day,cents FROM prices WHERE sku=? AND effective_day<=? ORDER BY effective_day DESC LIMIT 1",(r["sku"],r["day"])).fetchone()
            alignments.append({"id":r["id"],"sku":r["sku"],"date":r["date"],"recordedCents":r["unitCents"],"asOfCents":historical[1] if historical else None,"priceDate":date.fromordinal(historical[0]).isoformat() if historical else None,"varianceCents":r["unitCents"]-historical[1] if historical else None})
            if not historical: exceptions.append({"id":"price:"+r["id"],"reason":"No historical price effective on or before movement date.","record":r["id"]})
            queue=lots.setdefault(r["sku"],deque())
            if r["type"]=="receipt": queue.append({"id":r["id"],"date":r["date"],"quantity":r["quantity"],"unitCents":r["unitCents"],"day":r["day"]})
            else:
                if sum(l["quantity"] for l in queue)<r["quantity"]:
                    exceptions.append({"id":"inventory:"+r["id"],"reason":"Insufficient inventory at this point in time; issue was quarantined without consuming lots.","record":r["id"]});continue
                remaining=r["quantity"];allocations=[]
                while remaining:
                    lot=queue[0];n=min(remaining,lot["quantity"]);allocations.append({"lot":lot["id"],"quantity":n,"costCents":n*lot["unitCents"]});lot["quantity"]-=n;remaining-=n
                    if lot["quantity"]==0: queue.popleft()
                alignments[-1]["fifoAllocations"]=allocations;alignments[-1]["fifoCostCents"]=sum(a["costCents"] for a in allocations)
    as_of=day(dataset.get("asOf","2026-10-08"))
    if any(r["day"]>as_of for r in movements): raise ValueError("Movement date exceeds inventory valuation date.")
    inventory=[{"sku":sku,"quantity":sum(x["quantity"] for x in ls),"valueCents":sum(x["quantity"]*x["unitCents"] for x in ls),"lots":[{**{k:v for k,v in x.items() if k!="day"},"ageDays":as_of-x["day"]} for x in ls]} for sku,ls in sorted(lots.items())]
    return alignments,inventory,exceptions


def evaluate(request):
    if not isinstance(request,dict): raise ValueError("JSON object required.")
    dataset=request.get("dataset") or json.loads((Path(__file__).parent/"data/sample.json").read_text())
    if not isinstance(dataset,dict): raise ValueError("Dataset must be an object.")
    for field in ["prices","movements"]:
        if not isinstance(dataset.get(field,[]),list) or len(dataset.get(field,[]))>120: raise ValueError(field+" must contain at most 120 rows.")
    books,dupa=records(dataset.get("books"),"book");bank,dupb=records(dataset.get("bank"),"bank")
    policy=request.get("policy",{"toleranceCents":0,"windowDays":3})
    if not isinstance(policy,dict) or type(policy.get("toleranceCents")) is not int or not 0<=policy["toleranceCents"]<=10000 or type(policy.get("windowDays")) is not int or not 0<=policy["windowDays"]<=30: raise ValueError("Policy requires 0–10000 tolerance cents and 0–30 window days.")
    events=request.get("events",[])
    if not isinstance(events,list) or len(events)>300: raise ValueError("Journal supports at most 300 operations.")
    manual,blocked,resolutions,seen,audit={},{},{},{},[]
    blocked=set();chain="0"*64
    def apply(command):
        nonlocal chain
        if not isinstance(command,dict): raise ValueError("Operation object required.")
        key=text(command.get("key"),"operation key",80);kind=command.get("type");p=command.get("payload")
        if not isinstance(p,dict): raise ValueError("Operation payload must be an object.")
        fingerprint=json.dumps({"type":kind,"payload":p},sort_keys=True,separators=(",",":"))
        if key in seen:
            if seen[key]!=fingerprint: raise Conflict("Operation key reused with different content.")
            return False
        note=text(p.get("note"),"review note",500)
        if kind=="match":
            a,b=p.get("book"),p.get("bank");x=next((x for x in books if x["id"]==a),None);y=next((y for y in bank if y["id"]==b),None)
            if not x or not y: raise ValueError("Both match records must exist.")
            if x["currency"]!=y["currency"] or x["account"]!=y["account"]: raise Conflict("Cross-currency or cross-account matching is forbidden.")
            if any(pair[0]==a or pair[1]==b for pair in manual): raise Conflict("A reviewed record is already used. Unmatch first.")
            manual[(a,b)]=note;blocked.discard((a,b))
        elif kind=="unmatch":
            pair=(p.get("book"),p.get("bank"))
            current=reconciliation(books,bank,policy,manual,blocked)
            if not any((m["book"],m["bank"])==pair for m in current["matches"]): raise Conflict("Pair is not currently matched.")
            manual.pop(pair,None);blocked.add(pair)
        elif kind=="resolve":
            ident=text(p.get("id"),"exception id",100);status=p.get("status")
            available=reconciliation(books,bank,policy,manual,blocked)["exceptions"]+pricing_and_fifo(dataset)[2]
            if not any(x["id"]==ident for x in available): raise Conflict("Exception no longer exists.")
            if status not in ["assigned","reviewed","open"]: raise ValueError("Exception status must be open, assigned or reviewed.")
            resolutions[ident]={"status":status,"owner":text(p.get("owner"),"reviewer",60),"note":note}
        else: raise ValueError("Unknown operation type.")
        seen[key]=fingerprint;chain=hashlib.sha256((chain+json.dumps(command,sort_keys=True,separators=(",",":"))).encode()).hexdigest()
        audit.append({"revision":len(audit)+1,"key":key,"type":kind,"note":note,"hash":chain})
        return True
    for command in events:
        if not apply(command): raise ValueError("Journal contains duplicate operation keys.")
    command=request.get("command");replayed=False
    if command is not None:
        if len(events)>=300: raise ValueError("Export and start a new workspace at 300 operations.")
        if not isinstance(command,dict): raise ValueError("Operation object required.")
        if command.get("key") not in seen and request.get("expectedRevision")!=len(events): raise Conflict("Workspace revision changed. Refresh and retry.")
        if apply(command): events=events+[command]
        else: replayed=True
    recon=reconciliation(books,bank,policy,manual,blocked);prices,inventory,extra=pricing_and_fifo(dataset)
    exceptions=recon["exceptions"]+extra
    for e in exceptions: e.update(resolutions.get(e["id"],{"status":"open","owner":"unassigned","note":""}))
    totals={currency:{"bookCents":sum(r["cents"] for r in books if r["currency"]==currency),"bankCents":sum(r["cents"] for r in bank if r["currency"]==currency)} for currency in sorted({r["currency"] for r in books+bank})}
    return {"dataset":dataset,"policy":policy,"events":events,"revision":len(events),"replayed":replayed,"audit":audit,"auditHead":chain,"books":books,"bank":bank,**recon,"exceptions":exceptions,"prices":prices,"inventory":inventory,"duplicates":dupa+dupb,"totals":totals,"metrics":{"matched":len(recon["matches"]),"exceptions":len(exceptions),"open":sum(e["status"]!="reviewed" for e in exceptions),"inventoryUnits":sum(i["quantity"] for i in inventory),"inventoryValueCents":sum(i["valueCents"] for i in inventory),"reviewedDeltaCents":sum(m["deltaCents"] for m in recon["matches"])}}


def parse_csv(source):
    if not isinstance(source,str) or len(source)>300000: raise ValueError("CSV text must be under 300 KB.")
    reader=csv.DictReader(io.StringIO(source))
    if not reader.fieldnames or set(reader.fieldnames)!={"id","reference","date","account","currency","amount"}: raise ValueError("CSV headers must be id,reference,date,account,currency,amount.")
    rows=list(reader);records(rows,"CSV");return rows


def export_csv(rows):
    stream=io.StringIO();writer=csv.writer(stream);writer.writerow(["book","bank","method","deltaCents","dateGap","reason"])
    for r in rows:
        writer.writerow([("'"+str(r[k])) if str(r[k]).startswith(("=","+","-","@","\t","\r")) else r[k] for k in ["book","bank","method","deltaCents","dateGap","reason"]])
    return stream.getvalue()
