import sys,json,uuid;sys.path.insert(0,'/home/claude/mgr')
from pb2 import *
c=sqlite3.connect('file:in/ft.manager?mode=ro',uri=True)
rows=c.execute("select Key,ContentType,Content from Objects").fetchall()
D={k:(t,dec(bytes(b)) or {}) for k,t,b in rows}
T=lambda guid:[(k,d) for k,(t,d) in D.items() if t==guid]
g=lambda x:x[1] if isinstance(x,tuple) and x[0]=='G' else None
L=lambda v:[] if v is None else (v if isinstance(v,list) else [v])
amt=lambda x:decimal(x) if isinstance(x,dict) else 0.0
recs=[];add=lambda t,data,id=None:(recs.append({'id':id or str(uuid.uuid4()),'type':t,'data':data}),recs[-1]['id'])[1]
# chart of accounts
acc={}
groups={'95713fac-30d3-42e4-b536-dd7bc4f7a80e':'income','fd003045-876e-439e-b923-1904453f5c30':'expense'}
n=0
for k,d in sorted(T('26b9e4a5-ce10-4f30-94c7-23a1ca4428f9'),key=lambda x:x[1].get(1,'')):
    grp=groups.get(g(d.get(3)),'expense');n+=1
    code=('4' if grp=='income' else '6')+str(100+n)
    acc[k]=add('account',{'name':d[1],'code':code,'group':grp},k)
for nm_,code in [('Funds contributed','3000'),('Drawings','3100'),('Share of profit','3200')]:
    add('account',{'name':nm_,'code':code,'group':'equity'})
# banks
banks={}
for k,d in T('1408c33b-6284-4f50-9e31-48cbea21f3cf'):
    banks[k]=add('bank',{'name':d[1],'type':'cash','number':'','opening':0,'currency':''},k)
SUSP=add('bank',{'name':'Not assigned (from Manager.io)','type':'cash','number':'','opening':0,'currency':''})
# customers
cust={}
for i,(k,d) in enumerate(sorted(T('ec37c11e-2b67-49c6-8a58-6eccb7dd75ee'),key=lambda x:x[1][1].lower())):
    cust[k]=add('customer',{'name':d[1].strip(),'code':'','email':'','phone':'','address':'','terms':0,'taxNumber':'','currency':''},k)
emp={}
for k,d in T('dadb7f95-a5dd-45c0-945d-6ad4ee28776e'):
    emp[k]=add('employee',{'name':d[1],'code':'','email':'','phone':'','address':'','position':''},k)
names={**{k:d[1] for k,d in T('ec37c11e-2b67-49c6-8a58-6eccb7dd75ee')},**{k:d[1] for k,d in T('dadb7f95-a5dd-45c0-945d-6ad4ee28776e')}}
AR_G='d1489e95-bb28-4f5d-b42e-67d3291b3893'
problems=[]
for typ,guid in [('receipt','7662b887-c8d8-486e-98fd-f9dbcd41c6dc'),('payment','79f99d26-e43a-4ecb-a9c9-0774601a9b2e')]:
    for k,d in T(guid):
        cu=g(d.get(4));em=g(d.get(6));bk=g(d.get(7))
        lines=[]
        for l in L(d.get(11)):
            a=g(l.get(2));v=amt(l.get(18))
            if a==AR_G and cu in cust: key='ar:'+cust[cu]
            elif a in acc: key='acc:'+acc[a]
            elif g(l.get(9)) in emp: key='emp:'+emp[g(l.get(9))]
            else: key=None;problems.append((typ,d.get(2),a))
            lines.append({'account':key,'desc':l.get(10) if isinstance(l.get(10),str) else '','amount':v})
        add(typ,{'date':date(d[1]),'ref':d.get(2) if isinstance(d.get(2),str) else '','bank':banks.get(bk,SUSP),'currency':'','rate':'',
                 'contact':names.get(cu) or names.get(em) or '','desc':d.get(10) if isinstance(d.get(10),str) else '','cleared':'','lines':lines},k)
# payslips
wages=acc.get('01a12f80-e8c5-72ba-8a0f-20509fa23558')
items={k:d for k,d in T('ab02f6ab-c91c-4fc2-b979-66a6682c200e')}
for k,d in T('1d103fa7-6fc1-4951-811e-972968b842cc'):
    earn=[]
    for l in L(d.get(3)):
        it=items.get(g(l.get(4)),{});ac=acc.get(g(it.get(3)),wages)
        q=amt(l.get(7)) or 1;earn.append({'desc':l.get(6) if isinstance(l.get(6),str) else (it.get(1) or 'Salary'),'account':'acc:'+ac,'amount':round(amt(l.get(3))*q,2)})
    add('payslip',{'date':date(d[1]),'ref':d.get(12) if isinstance(d.get(12),str) else '','employee':emp[g(d.get(2))],'desc':d.get(11) if isinstance(d.get(11),str) else '','earnings':earn,'deductions':[]},k)
dates=sorted(r['data']['date'] for r in recs if 'date' in r['data'])
out={'app':'falak.io','version':2,'name':'Falak Travel','settings':{'currency':'USD','startDate':dates[0][:8]+'01','address':'Istanbul, Türkiye · Kabul, Afghanistan','phone':'+93 79 104 4260','email':'falaktravelagency11@gmail.com','taxNumber':'','invoiceFooter':''},'exported':'2026-10-18','records':recs}
json.dump(out,open('out/falak-travel-from-manager.json','w'),ensure_ascii=False)
from collections import Counter
print(Counter(r['type'] for r in recs),'problems',problems,'dates',dates[0],dates[-1])
# Manager-side balances for check
bal={};susp=0
for r in recs:
    if r['type'] in('receipt','payment'):
        s=-1 if r['type']=='receipt' else 1
        for l in r['data']['lines']:
            bal[l['account']]=bal.get(l['account'],0)+s*l['amount']
json.dump({k:round(v,2) for k,v in bal.items()},open('out/expected.json','w'))
