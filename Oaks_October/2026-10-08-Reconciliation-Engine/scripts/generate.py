import json,random
from datetime import date,timedelta
from pathlib import Path

seed=8102026; rng=random.Random(seed); base=date(2026,9,15); books=[];bank=[]
for i in range(18):
    amount=f'{rng.randrange(12000,85000)/100:.2f}';day=base+timedelta(days=i)
    books.append({'id':f'B{i+1:03}','reference':f'INV-{i+1:04}','date':day.isoformat(),'account':'OPERATING','currency':'USD','amount':amount})
    if i<15:
        bank.append({'id':f'S{i+1:03}','reference':f'inv {i+1:04}','date':(day+timedelta(days=i%3)).isoformat(),'account':'OPERATING','currency':'USD','amount':amount if i!=14 else f'{float(amount)-.02:.2f}'})
bank.extend([{'id':'S020','reference':'UNALLOCATED-1','date':'2026-10-01','account':'OPERATING','currency':'USD','amount':'175.00'},{'id':'S021','reference':'INV-0016','date':'2026-10-01','account':'OPERATING','currency':'USD','amount':books[15]['amount']},{'id':'S022','reference':'INV-0016','date':'2026-10-01','account':'OPERATING','currency':'USD','amount':books[15]['amount']}])
books.append(dict(books[0]))
prices=[{'sku':'GOLD-14K','date':'2026-09-01','price':'42.00'},{'sku':'GOLD-14K','date':'2026-09-20','price':'44.50'},{'sku':'GOLD-14K','date':'2026-10-10','price':'48.00'},{'sku':'STONE-OVAL','date':'2026-09-01','price':'125.00'}]
movements=[{'id':'R01','sku':'GOLD-14K','date':'2026-09-16','type':'receipt','quantity':30,'unitCost':'42.00'},{'id':'R02','sku':'GOLD-14K','date':'2026-09-22','type':'receipt','quantity':20,'unitCost':'44.50'},{'id':'I01','sku':'GOLD-14K','date':'2026-09-25','type':'issue','quantity':37,'unitCost':'43.00'},{'id':'R03','sku':'STONE-OVAL','date':'2026-09-20','type':'receipt','quantity':10,'unitCost':'124.00'},{'id':'I02','sku':'STONE-OVAL','date':'2026-09-27','type':'issue','quantity':14,'unitCost':'125.00'},{'id':'R04','sku':'CHAIN-NEW','date':'2026-09-26','type':'receipt','quantity':8,'unitCost':'90.00'}]
target=Path(__file__).parents[1]/'data';target.mkdir(exist_ok=True)
(target/'sample.json').write_text(json.dumps({'seed':seed,'synthetic':True,'asOf':'2026-10-08','books':books,'bank':bank,'prices':prices,'movements':movements},indent=2)+'\n')
print('Reproducible synthetic reconciliation sample generated, seed',seed)
