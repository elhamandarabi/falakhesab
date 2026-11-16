#!/usr/bin/env python3
"""SEC-1 regression tests: plan and billing functions must refuse callers with no role in the target business.
Usage: python3 sec1_test.py <database> [--billing]
Each call runs inside its own transaction that is rolled back, so tests never affect each other.
The target's subscription row, company address (slug) and payment requests are read before and after every call."""
import psycopg2, json, uuid, sys, re
DB=sys.argv[1]; BILLING='--billing' in sys.argv
DSN=f"host=/home/claude/pg port=5544 user=postgres dbname={DB}"
su=psycopg2.connect(DSN); su.autocommit=True; q=su.cursor()
U={}
def user(k,email): i=str(uuid.uuid4()); U[k]=(i,email); q.execute("insert into auth.users(id,email) values(%s,%s)",(i,email))
for k in ['super','a_owner','a_admin','a_user','a_viewer','a_removed','b_owner','s_owner','stranger','approver']:
    user(k,{'super':'falaktravelagency11@gmail.com','approver':'approver@pay.test'}.get(k,k.replace('_','.')+'@test.local'))
def as_actor(cur,actor):
    if actor=='anon': cur.execute("set local role anon")
    else:
        i,e=U[actor]
        cur.execute("select set_config('request.jwt.claim.sub',%s,true), set_config('request.jwt.claims',%s,true)",(i,json.dumps({'sub':i,'email':e,'aal':'aal1','role':'authenticated'})))
        cur.execute("set local role authenticated")
def setup_call(actor,sql,args):
    c=psycopg2.connect(DSN); cur=c.cursor(); as_actor(cur,actor); cur.execute(sql,args); r=cur.fetchall() if cur.description else None; c.commit(); c.close(); return r
A,B,S=[str(uuid.uuid4()) for _ in range(3)]
setup_call('a_owner',"insert into businesses(id,name,owner) values(%s,'Company A',%s)",(A,U['a_owner'][0]))
setup_call('b_owner',"insert into businesses(id,name,owner) values(%s,'Company B (one user, paid Pro)',%s)",(B,U['b_owner'][0]))
setup_call('s_owner',"insert into businesses(id,name,owner) values(%s,'Company S (one user)',%s)",(S,U['s_owner'][0]))
for k,role,tabs in [('a_admin','admin','{}'),('a_user','user','{receipt}'),('a_viewer','viewer','{}'),('a_removed','viewer','{}')]:
    setup_call('a_owner',"insert into members(business_id,email,role,tabs) values(%s,%s,%s,%s)",(A,U[k][1],role,tabs))
setup_call('a_owner',"delete from members where business_id=%s and email=%s",(A,U['a_removed'][1]))
q.execute("update subscriptions set plan='pro', paid_until=current_date+200, trial_ends=null, complimentary=false, note='paid' where business_id=%s",(B,))
q.execute("update businesses set slug='company-b' where id=%s",(B,)); q.execute("update businesses set slug='company-a' where id=%s",(A,))
REQ={}
if BILLING:
    cfg={"mode":"test","currencies":["USD"],"durations":[1,12],"prices":{"basic":{"USD":9},"pro":{"USD":19}},
         "countries":{"TR":{"status":"supported","currencies":["USD"]}},"banks":[{"currency":"USD","bank":"Sample Bank (TEST)","iban":"TEST","test":True}],
         "tax":{"confirmed":False},"approvers":["approver@pay.test"]}
    q.execute("update billing_config set value=%s where id=1",(json.dumps(cfg),))
    for biz,own in [(A,'a_owner'),(B,'b_owner')]:
        REQ[biz]=setup_call(own,"select (falak_billing_create(%s,'pro',1,'TR','USD','{\"company\":\"X Ltd\",\"address\":\"Istanbul\"}')).id",(biz,))[0][0]
def snap(cur,biz):
    cur.execute("""select json_build_object('subscription',(select row_to_json(s) from subscriptions s where business_id=%s),
       'slug',(select slug from businesses where id=%s),
       'payment_requests',(select coalesce(json_agg(r order by r.id),'[]') from payment_requests r where business_id=%s))::text""" if BILLING else
       """select json_build_object('subscription',(select row_to_json(s) from subscriptions s where business_id=%s),
       'slug',(select slug from businesses where id=%s),'payment_requests',(select count(*) from subscriptions where business_id=%s and false))::text""",(biz,biz,biz)); return cur.fetchone()[0]
rows=[]
AUTH=re.compile(r'Only the owner|BILLING_AUTH|permission denied')
def t(fn,actor,target,sql,args,expect,why=''):
    c=psycopg2.connect(DSN); cur=c.cursor()
    before=snap(cur,target); cur.execute("savepoint s"); as_actor(cur,actor)
    try: cur.execute(sql,args); ok,msg=True,'returned'
    except Exception as e: cur.execute("rollback to savepoint s"); ok,msg=False,str(e).split('\n')[0]
    cur.execute("reset role"); after=snap(cur,target); c.rollback(); c.close()
    changed=before!=after
    if expect=='allow': passed=ok
    elif expect=='deny': passed=(not ok) and bool(AUTH.search(msg)) and not changed
    else: passed=(not ok) and expect in msg and not changed      # refused by a business rule after the role check passed
    rows.append((fn,actor,{A:'A',B:'B',S:'S'}[target],expect if expect in('allow','deny') else 'rule:'+expect,'PASS' if passed else 'FAIL',
                 'ok' if ok else msg[:70],'CHANGED' if changed else 'unchanged'))
names={'a_owner':'A owner','a_admin':'A admin','a_user':'A limited user','a_viewer':'A viewer','a_removed':'removed from A','b_owner':'B owner','s_owner':'S owner','stranger':'signed-in stranger','anon':'signed-out (anon)','super':'super admin','approver':'payment approver (not a member)'}
CF="select falak_choose_free(%s)"; RP="select falak_request_plan(%s,'basic')"
# ---- falak_choose_free: owner only ----
for a in ['stranger','anon','a_owner','a_admin','a_removed']: t('choose_free',a,B,CF,(B,),'deny')          # outsiders and cross-company (A members → B)
for a in ['a_admin','a_user','a_viewer','a_removed','b_owner','stranger','anon']: t('choose_free',a,A,CF,(A,),'deny')
t('choose_free','a_owner',A,CF,(A,),'PLAN_USERS')     # right role, but A has 4 users: Free fits 1
t('choose_free','s_owner',S,CF,(S,),'allow'); t('choose_free','b_owner',B,CF,(B,),'allow'); t('choose_free','super',B,CF,(B,),'allow')
# ---- falak_request_plan: owner or admin ----
for a in ['stranger','anon','a_owner','a_admin','a_removed']: t('request_plan',a,B,RP,(B,),'deny')
for a in ['a_user','a_viewer','a_removed','b_owner','stranger','anon']: t('request_plan',a,A,RP,(A,),'deny')
for a in ['a_owner','a_admin','super']: t('request_plan',a,A,RP,(A,),'allow')
if BILLING:
    BC="select (falak_billing_create(%s,'basic',12,'TR','USD','{\"company\":\"Y\",\"address\":\"Z\"}')).ref"
    BR="select (falak_billing_report(%s,'{\"payer\":\"x\"}',null)).status"; BX="select falak_billing_cancel(%s)"
    # create: a target with no open request is needed for the positive test → cancel A's request inside the same rolled-back call
    for a in ['stranger','anon','a_owner','a_admin','a_removed']: t('billing_create',a,B,BC,(B,),'deny')
    for a in ['a_user','a_viewer','a_removed','b_owner','stranger','anon']: t('billing_create',a,A,BC,(A,),'deny')
    for a in ['stranger','anon','a_owner','a_admin','a_removed']: t('billing_create',a,S,BC,(S,),'deny')   # S has no open request, so nothing else stops the call
    for a in ['a_owner','a_admin']:
        t('billing_create',a,A,"select falak_billing_cancel(%s); "+BC,(REQ[A],A),'allow')
    for a in ['stranger','anon','a_owner','a_admin','a_removed']: t('billing_report',a,B,BR,(REQ[B],),'deny')
    for a in ['a_user','a_viewer','a_removed','b_owner','stranger','anon']: t('billing_report',a,A,BR,(REQ[A],),'deny')
    for a in ['a_owner','a_admin']: t('billing_report',a,A,BR,(REQ[A],),'allow')
    for a in ['stranger','anon','a_owner','a_admin','a_removed']: t('billing_cancel',a,B,BX,(REQ[B],),'deny')
    for a in ['a_user','a_viewer','a_removed','b_owner','stranger','anon']: t('billing_cancel',a,A,BX,(REQ[A],),'deny')
    for a in ['a_owner','a_admin','approver','super']: t('billing_cancel',a,A,BX,(REQ[A],),'allow')
w=[max(len(str(r[i])) for r in rows) for i in range(4)]
print(f"database {DB}: {len(rows)} calls")
for r in rows: print(f"{r[4]}  {r[0]:<15} {names[r[1]]:<33} → {r[2]}  expect {r[3]:<16} got: {r[5]:<70} target {r[6]}")
f=[r for r in rows if r[4]=='FAIL']; print(f"RESULT {DB}: {len(rows)-len(f)} pass, {len(f)} fail")
