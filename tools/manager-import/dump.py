import sys;sys.path.insert(0,'/home/claude/mgr')
from pb2 import *
from collections import Counter
c=sqlite3.connect('file:in/ft.manager?mode=ro',uri=True)
rows=c.execute("select Key,ContentType,Content from Objects").fetchall()
names={};D={}
for k,t,b in rows:
    d=dec(bytes(b)) or {};D[k]=(t,d)
    if isinstance(d.get(1),str): names[k]=d[1]
def ref(x): return names.get(x[1],x[1][:8]) if isinstance(x,tuple) else x
def lines(v):
    if v is None: return []
    return v if isinstance(v,list) else [v]
def num(x):
    if isinstance(x,dict): return decimal(x)
    return x
TY={'7662b887-c8d8-486e-98fd-f9dbcd41c6dc':'R','79f99d26-e43a-4ecb-a9c9-0774601a9b2e':'P'}
accs=Counter();keys=Counter()
for k,(t,d) in D.items():
    if t not in TY: continue
    keys.update(d.keys())
    ls=[]
    for l in lines(d.get(11)):
        if isinstance(l,dict):
            accs[ref(l.get(2))]+=1
            ls.append((ref(l.get(2)),num(l.get(18)),{kk:(ref(vv) if isinstance(vv,tuple) else vv) for kk,vv in l.items() if kk not in(2,18,29)}))
    extra={kk:(ref(vv) if isinstance(vv,tuple) else vv) for kk,vv in d.items() if kk not in (1,2,3,4,10,11,44,45)}
    print(TY[t],date(d.get(1)),d.get(2),'|',ref(d.get(4)),'|',d.get(10) if isinstance(d.get(10),str) else '','|',ls,extra if extra else '')
print(accs);print(keys)
