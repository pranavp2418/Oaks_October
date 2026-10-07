import json,random
from pathlib import Path
r=random.Random(7102026)
a=[];v=[]
for i in range(8):
 for j in range(2): a.append(dict(id=f'A{i}-{j}',member=f'M{i}',service='therapy',start='2026-10-01' if j==0 else '2026-10-12',end='2026-10-18' if j==0 else '2026-10-31',units=r.randint(2,6)))
 for j in range(10): v.append(dict(id=f'V{i}-{j}',member=f'M{i}',service='therapy',date=f'2026-10-{2+j*3:02}'))
Path('data/seed.json').write_text(json.dumps(dict(authorizations=a,visits=v),indent=2))
