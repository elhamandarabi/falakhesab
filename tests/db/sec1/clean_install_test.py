#!/usr/bin/env python3
"""Clean install of the UPDATED Step 11 on a production-like database (Steps 3-10 + Step 12), billing left OFF."""
import psycopg2, json, uuid, subprocess
R=lambda *a: subprocess.run(['./mk.sh',*a],capture_output=True,text=True).stdout.strip()
print(R('clean_s11','prod_like.sql','step12-sec1-fix.sql','step11-bank-payments.sql'))
DSN="host=/home/claude/pg port=5544 user=postgres dbname=clean_s11"
su=psycopg2.connect(DSN); su.autocommit=True; q=su.cursor()
res=[]
def chk(name,cond,detail=''): res.append(('PASS' if cond else 'FAIL',name,detail))
q.execute("select value->>'mode' from billing_config where id=1"); mode=q.fetchone()[0]; chk('billing mode after install is off',mode=='off',mode)
q.execute("select count(*) from pg_proc where proname in ('falak_billing_create','falak_billing_report','falak_billing_cancel','falak_billing_decide','falak_billing_save','falak_billing_public','falak_billing_invoice','falak_receipt_ok','falak_is_billing_admin')"); chk('9 Step 11 functions installed',q.fetchone()[0]==9)
q.execute("select bool_and(prosecdef) and bool_and(proconfig=array['search_path=public']) from pg_proc where proname like 'falak_billing_%'"); chk('billing functions keep SECURITY DEFINER + search_path=public',q.fetchone()[0])
q.execute("select bool_and(position('is null then raise' in prosrc)>0 or position('coalesce(public.falak_role' in prosrc)>0) from pg_proc where proname in ('falak_billing_create','falak_billing_report','falak_billing_cancel')"); chk('SEC-1 protection present in create/report/cancel',q.fetchone()[0])
U={}
for k,e in [('owner','owner@clean.test'),('stranger','stranger@clean.test')]:
    i=str(uuid.uuid4()); U[k]=(i,e); q.execute("insert into auth.users(id,email) values(%s,%s)",(i,e))
def call(actor,sql,args=()):
    c=psycopg2.connect(DSN); cur=c.cursor()
    if actor=='anon': cur.execute("set role anon")
    else:
        i,e=U[actor]; cur.execute("select set_config('request.jwt.claim.sub',%s,false),set_config('request.jwt.claims',%s,false)",(i,json.dumps({'sub':i,'email':e,'aal':'aal1'}))); cur.execute("set role authenticated")
    try: cur.execute(sql,args); r=cur.fetchall() if cur.description else None; c.commit(); return True,r
    except Exception as ex: c.rollback(); return False,str(ex).split('\n')[0]
    finally: c.close()
B=str(uuid.uuid4()); ok,_=call('owner',"insert into businesses(id,name,owner) values(%s,'Clean Co',%s)",(B,U['owner'][0])); chk('owner creates a business',ok)
BC="select (falak_billing_create(%s,'pro',1,'TR','USD','{\"company\":\"C\",\"address\":\"D\"}')).ref"
ok,m=call('owner',BC,(B,)); chk('owner: billing is off → BILLING_OFF',(not ok) and 'BILLING_OFF' in m,m)
ok,m=call('stranger',BC,(B,)); chk('signed-in stranger → BILLING_AUTH (refused before the mode check)',(not ok) and 'BILLING_AUTH' in m,m)
ok,m=call('anon',BC,(B,)); chk('signed-out (anon) → refused',(not ok) and ('BILLING_AUTH' in m or 'permission denied' in m),m)
q.execute("select count(*) from payment_requests"); chk('no payment request was created',q.fetchone()[0]==0)
q.execute("select requested_plan from subscriptions where business_id=%s",(B,)); chk('target subscription not touched (requested_plan still empty)',q.fetchone()[0] is None)
ok,m=call('owner',"select falak_billing_public()"); chk('owner can read public billing info (mode off)',ok and json.loads(json.dumps(m[0][0]))['mode']=='off' if ok else False,str(m)[:80])
# undo + reinstall
p=lambda f: subprocess.run(['psql','-h','/home/claude/pg','-p','5544','-U','postgres','-q','-v','ON_ERROR_STOP=1','-d','clean_s11','-f',f],capture_output=True,text=True)
r=p('../work/database/step11-undo.sql'); chk('step11-undo.sql runs',r.returncode==0,r.stderr[:120])
q.execute("select count(*) from pg_proc where proname like 'falak_billing_%'"); chk('undo removed billing functions',q.fetchone()[0]==0)
q.execute("select count(*) from pg_proc where proname in ('falak_choose_free','falak_request_plan') and position('is null then raise' in prosrc)>0"); chk('undo of Step 11 keeps the Step 12 fix on the plan functions',q.fetchone()[0]==2)
r=p('step11-bank-payments.sql'); chk('updated Step 11 reinstalls after undo',r.returncode==0,r.stderr[:120])
r=p('step11-bank-payments.sql'); chk('updated Step 11 runs a second time (safe to run again)',r.returncode==0,r.stderr[:120])
q.execute("select value->>'mode' from billing_config where id=1"); chk('mode still off after reinstall',q.fetchone()[0]=='off')
for r in res: print(f"{r[0]}  {r[1]}" + (f"   [{r[2]}]" if r[2] else ''))
print(f"RESULT clean_s11: {sum(r[0]=='PASS' for r in res)} pass, {sum(r[0]=='FAIL' for r in res)} fail")
