window.supabase={createClient(){
 const PERSIST=(()=>{try{return sessionStorage.getItem('mockpersist')==='1'}catch(e){return false}})();
 const saved=PERSIST?JSON.parse(sessionStorage.getItem('mockdb')||'null'):null;
 const db=saved?saved.db:{businesses:[],members:[],records:[],profiles:[],history:[],chat_log:[]};db.chat_log=db.chat_log||[];let session=null;const cbs=[];
 ['app_config','subscriptions','payments','trial_log'].forEach(k=>{db[k]=db[k]||[]});
 if(!db.app_config.length&&!(typeof window!=='undefined'&&window.MOCK_NO_PLANS))db.app_config.push({key:'plans',value:{free:{users:1,usd:0,try:0},basic:{users:3,usd:9,try:299},pro:{users:0,usd:19,try:649},trialDays:30}},{key:'billing',value:{instructions:'Bank: Example Bank, IBAN TR00 0000 0000 0000\nThen send the receipt on WhatsApp.'}});
 const NOPLANS=typeof window!=='undefined'&&window.MOCK_NO_PLANS;
 const isSuper=()=>session&&session.user.email==='falaktravelagency11@gmail.com';
 // ---- Step 11 bank transfer payments (mirrors database/step11-bank-payments.sql) ----
 db.payment_requests=db.payment_requests||[];db.billing_config=db.billing_config||[{id:1,value:{mode:'off',currencies:[],prices:{},durations:[1,3,6,12],countries:{},banks:[],company:{},policies:{},tax:{confirmed:false,prices_include_tax:false,rules:{},default:null},approvers:[],ref_prefix:'FH'}}];
 const bcfg=()=>db.billing_config[0].value;
 const mrole=bid=>{if(isSuper())return 'owner';const m=db.members.find(x=>x.business_id===bid&&session&&x.email===session.user.email);return m?m.role:null};
 const isBA=()=>!!session&&(isSuper()||(bcfg().approvers||[]).map(x=>x.toLowerCase()).includes(session.user.email));
 const ptxt=j=>typeof j==='string'?j.trim():j&&typeof j==='object'?String(j.en||'').trim():'';
 const r2=n=>Math.round(n*100)/100;
 const addM=(d,m)=>{const t=new Date(d+'T00:00:00Z');t.setUTCMonth(t.getUTCMonth()+m);t.setUTCDate(t.getUTCDate()-1);return t.toISOString().slice(0,10)};
 const dayAfter=d=>{const t=new Date(d+'T00:00:00Z');t.setUTCDate(t.getUTCDate()+1);return t.toISOString().slice(0,10)};
 const billing=(fn,a)=>{const E=m=>({data:null,error:{message:m}}),ok=d=>{persist();return {data:d,error:null}};const c=bcfg(),me=session&&session.user.email;
  const OPEN=['awaiting_payment','awaiting_verification','partially_paid'];
  if(fn==='falak_billing_public'){const v=JSON.parse(JSON.stringify(c));delete v.approvers;if(c.mode==='live')v.banks=(v.banks||[]).filter(b=>!b.test);v.is_admin=isBA();return {data:v,error:null}}
  if(fn==='falak_billing_save'){if(!isSuper())return E('BILLING_AUTH: Only the super admin can change payment settings.');const v=a.v,miss=[];
    if(v.mode==='live'){const co=v.company||{};if(!co.legal_name)miss.push('company legal name');if(!co.address)miss.push('company address');if(!co.tax_no)miss.push('company tax number');
      if(!(v.banks||[]).some(b=>!b.test&&(b.iban||b.account_no)))miss.push('a real bank account');if((v.banks||[]).some(b=>b.test))miss.push('remove sample (test) bank accounts');
      if(!(v.currencies||[]).length)miss.push('currencies');if(!Object.keys(v.prices||{}).length)miss.push('prices');if(!Object.values(v.countries||{}).some(x=>x.status==='supported'))miss.push('at least one supported country');
      const po=v.policies||{};if(!ptxt(po.fees))miss.push('transfer fee policy');if(!ptxt(po.processing))miss.push('processing time policy');if(!ptxt(po.amount_rule))miss.push('amount-that-must-arrive policy');
      if(!(v.tax||{}).confirmed)miss.push('tax setting confirmed by the accountant');if(miss.length)return E('BILLING_INCOMPLETE: Live payments need: '+miss.join(', '))}
    db.billing_config[0].value=v;return ok(billing('falak_billing_public').data)}
  if(fn==='falak_billing_create'){const bid=a.bid;if(!['owner','admin'].includes(mrole(bid)))return E('BILLING_AUTH: Only the owner or an administrator can pay for the plan.');
    if(c.mode==='off'&&!isBA())return E('BILLING_OFF: Bank transfer payments are not open yet. Please contact support.');
    const test=c.mode!=='live',cty=(c.countries||{})[String(a.p_country).toUpperCase()],cur=String(a.p_currency).toUpperCase(),co=String(a.p_country).toUpperCase();
    if(!['basic','pro'].includes(a.p_plan))return E('BILLING_INPUT: Choose Basic or Pro.');if(!(c.durations||[]).includes(a.p_months))return E('BILLING_INPUT: This payment period is not offered.');
    if(!cty||cty.status!=='supported')return E('BILLING_COUNTRY: Payments from this country are not set up yet. Please contact support.');
    if(!(cty.currencies||[]).includes(cur)||!(c.currencies||[]).includes(cur))return E('BILLING_CURRENCY: This currency is not accepted for this country.');
    const price=+((c.prices||{})[a.p_plan]||{})[cur];if(!(price>0))return E('BILLING_CURRENCY: No price is set in this currency.');
    const bank=(c.banks||[]).find(b=>b.currency===cur&&(test||!b.test));if(!bank)return E('BILLING_BANK: No bank account is set up for this currency yet. Please contact support.');
    const bi=a.p_billing||{};if(!String(bi.company||'').trim()||!String(bi.address||'').trim())return E('BILLING_INPUT: Company name and address are needed for the invoice.');
    if(db.payment_requests.some(r=>r.business_id===bid&&OPEN.includes(r.status)))return E('BILLING_OPEN: This business already has an open payment. Finish or cancel it first.');
    const sub=r2(price*a.p_months),rule=((c.tax||{}).rules||{})[co]||(c.tax||{}).default||null,rate=rule&&rule.rate!=null&&rule.rate!==''?+rule.rate:null,incl=!!(c.tax||{}).prices_include_tax;
    const tax=rate==null?null:incl?r2(sub-sub/(1+rate/100)):r2(sub*rate/100),tot=rate==null||incl?sub:r2(sub+tax);
    const AL='23456789ABCDEFGHJKMNPQRSTUVWXYZ';let ref;do{ref=(c.ref_prefix||'FH')+'-'+Array.from({length:8},()=>AL[Math.floor(Math.random()*AL.length)]).join('')}while(db.payment_requests.some(r=>r.ref===ref));
    const b=db.businesses.find(x=>x.id===bid);
    const r={id:'pr'+Math.random().toString(36).slice(2),ref,business_id:bid,business_name:b&&b.name,test,plan:a.p_plan,months:a.p_months,country:co,currency:cur,unit_price:price,subtotal:sub,tax_label:rule&&rule.label||null,tax_rate:rate,tax_amount:tax,total:tot,
      bank:{...bank,test:!!bank.test},billing:{company:bi.company,contact:bi.contact||undefined,address:bi.address,city:bi.city||undefined,postal:bi.postal||undefined,country:co,tax_id:bi.tax_id||undefined,tax_office:bi.tax_office||undefined,email:bi.email||undefined},
      status:'awaiting_payment',report:null,receipt_path:null,received:[],received_total:0,created_at:new Date().toISOString(),created_by:me};
    db.payment_requests.unshift(r);const sx=db.subscriptions.find(x=>x.business_id===bid);if(sx)Object.assign(sx,{requested_plan:a.p_plan,requested_at:new Date().toISOString()});return ok(r)}
  const r=db.payment_requests.find(x=>x.id===a.rid);if(!r)return E('BILLING_INPUT: Payment not found.');
  if(fn==='falak_billing_report'){if(!['owner','admin'].includes(mrole(r.business_id)))return E('BILLING_AUTH: Not allowed.');if(!OPEN.includes(r.status))return E('BILLING_DONE: This payment is already '+r.status+'.');
    if(a.p_receipt&&!a.p_receipt.startsWith(r.business_id+'/'+r.id+'/'))return E('BILLING_INPUT: Wrong receipt file.');
    Object.assign(r,{status:'awaiting_verification',report:a.p_report,receipt_path:a.p_receipt||r.receipt_path,reported_at:new Date().toISOString(),reported_by:me});return ok(r)}
  if(fn==='falak_billing_cancel'){if(!(isBA()||['owner','admin'].includes(mrole(r.business_id))))return E('BILLING_AUTH: Not allowed.');if(!['awaiting_payment','awaiting_verification'].includes(r.status)||r.received_total>0)return E('BILLING_DONE: This payment can no longer be cancelled.');
    Object.assign(r,{status:'cancelled',decided_by:me,decided_at:new Date().toISOString()});return ok(null)}
  if(fn==='falak_billing_invoice'){if(!isBA())return E('BILLING_AUTH: Only a payment approver can do this.');if(r.status!=='approved')return E('BILLING_INPUT: Only approved payments get an invoice number.');Object.assign(r,{invoice_no:a.p_no||null,invoice_date:a.p_date||null,invoice_by:me});return ok(r)}
  if(fn==='falak_billing_decide'){if(!isBA())return E('BILLING_AUTH: Only a payment approver can do this.');
    if(['approved','rejected','cancelled'].includes(r.status))return E('BILLING_DONE: This payment was already '+r.status+' by '+r.decided_by+' at '+r.decided_at+'.');
    if(String(a.p_ref||'').trim().toUpperCase()!==r.ref)return E('BILLING_REF: The reference does not match this payment ('+r.ref+'). Check you opened the right business.');
    let note=String(a.p_note||'').trim()||null;
    if(a.act==='reject'){if(!note)return E('BILLING_INPUT: Write the reason for rejecting.');Object.assign(r,{status:'rejected',decided_by:me,decided_at:new Date().toISOString(),decision_note:note});return ok(r)}
    const recv=[...r.received];let tot=r.received_total;
    if(+a.p_amount>0){const cu=String(a.p_currency||'').toUpperCase();if(cu!==r.currency)return E('BILLING_CURRENCY: The money arrived in '+cu+' but this payment is in '+r.currency+'. Do not approve: follow the wrong-currency policy.');
      if(!String(a.p_bank_ref||'').trim()||!a.p_date)return E('BILLING_INPUT: Enter the bank reference and the date the money arrived.');
      if(db.payment_requests.some(x=>x.received.some(e=>e.currency===r.currency&&e.bank_ref.toLowerCase()===String(a.p_bank_ref).trim().toLowerCase())))return E('BILLING_DUPLICATE: Bank reference '+String(a.p_bank_ref).trim()+' was already used for a payment.');
      recv.push({amount:r2(+a.p_amount),currency:r.currency,bank_ref:String(a.p_bank_ref).trim(),date:a.p_date,by:me,at:new Date().toISOString()});tot=r2(tot+ +a.p_amount)}
    else if(a.act==='receive')return E('BILLING_INPUT: Enter the amount that arrived.');
    if(a.act==='receive'||tot<r.total){if(a.act==='approve')return E('BILLING_PARTIAL: Only '+tot.toFixed(2)+' '+r.currency+' of '+(+r.total).toFixed(2)+' '+r.currency+' has arrived. Record it as a part payment and wait for the rest.');
      Object.assign(r,{received:recv,received_total:tot,status:tot>=r.total?'awaiting_verification':'partially_paid',decision_note:note||r.decision_note});return ok(r)}
    const sx=db.subscriptions.find(x=>x.business_id===r.business_id),td=today();let f;
    if(sx&&sx.plan===r.plan&&sx.paid_until&&sx.paid_until>=td)f=dayAfter(sx.paid_until);
    else if(sx&&sx.plan===r.plan&&sx.trial_ends&&new Date(sx.trial_ends)>new Date())f=String(sx.trial_ends).slice(0,10);
    else{f=td;if(sx&&sx.plan!==r.plan&&sx.paid_until&&sx.paid_until>=td)note=(note?note+' · ':'')+'Plan changed from '+sx.plan+'; earlier paid time until '+sx.paid_until+' replaced (handle any credit by hand).'}
    const u=addM(f,r.months);let pid=null;
    if(!r.test){Object.assign(sx,{plan:r.plan,paid_until:u,complimentary:false,requested_plan:null,requested_at:null});pid='p'+Math.random();
      db.payments.unshift({id:pid,business_id:r.business_id,plan:r.plan,months:r.months,amount:tot,currency:r.currency,note:'Bank transfer '+r.ref,paid_from:f,paid_until:u,created_at:new Date().toISOString(),created_by:me,request_id:r.id})}
    else note=(note?note+' · ':'')+'TEST: subscription not changed.';
    Object.assign(r,{received:recv,received_total:tot,overpaid:tot>r.total?r2(tot-r.total):null,status:'approved',decided_by:me,decided_at:new Date().toISOString(),decision_note:note,paid_from:f,paid_until:u,payment_id:pid});return ok(r)}
  return E('unknown function '+fn)};
 const today=()=>new Date().toISOString().slice(0,10);
 const cfg=()=>((db.app_config.find(r=>r.key==='plans')||{}).value)||{};
 const pstate=bid=>{const s=db.subscriptions.find(x=>x.business_id===bid);if(!s)return {st:'active',eff:'pro',s};
   if(s.complimentary||s.plan==='free'||(s.paid_until&&s.paid_until>=today()))return {st:'active',eff:s.plan,s};
   if(s.trial_ends&&new Date(s.trial_ends)>new Date())return {st:'trial',eff:s.plan,s};return {st:'expired',eff:s.plan,s}};
 const allows=(bid,w)=>{if(NOPLANS||isSuper())return true;const {st,eff}=pstate(bid);if(w==='write')return st!=='expired';if(w==='pro')return st!=='expired'&&eff==='pro';if(w==='address')return st!=='expired'&&(eff==='basic'||eff==='pro')};
 const guard=(table,op,rows,payload)=>{if(NOPLANS)return;
   if(table==='records')rows.forEach(r=>{if(!allows(r.business_id,'write'))throw new Error('PLAN_EXPIRED: Your plan has ended. The books are read-only until the owner chooses a plan.');
     if(op!=='delete'&&['ticket','exchange','hawala','fxrate','cashcount'].includes(r.type)&&!allows(r.business_id,'pro'))throw new Error('PLAN_PRO: This part (Travel / Exchange & Transfers) is included in the Pro plan.')});
   if(table==='members'&&op==='insert'&&!isSuper())rows.forEach(r=>{if(!allows(r.business_id,'write'))throw new Error('PLAN_EXPIRED: Your plan has ended. Choose a plan before adding users.');
     const {eff}=pstate(r.business_id);const lim=+((cfg()[eff]||{}).users)||0;const n=db.members.filter(m=>m.business_id===r.business_id).length;if(lim>0&&n+1>lim)throw new Error('PLAN_USERS: Your plan allows '+lim+' user(s). Upgrade to add more.')});
   if(table==='businesses'&&op==='update'&&payload&&payload.slug)rows.forEach(r=>{if(r.slug!==payload.slug&&!allows(r.id,'address'))throw new Error('PLAN_ADDRESS: A company address is included in the Basic and Pro plans.')})};
 const onNewBiz=b=>{if(NOPLANS)return;if(isSuper()){db.subscriptions.push({business_id:b.id,plan:'pro',complimentary:true});return}
   const chosen=((users.find(u=>u.id===b.owner)||{}).plan)||'pro';
   if(chosen==='free'){db.subscriptions.push({business_id:b.id,plan:'free',complimentary:false});return}
   if(db.trial_log.some(t=>t.owner===b.owner)){db.subscriptions.push({business_id:b.id,plan:'free',complimentary:false,requested_plan:chosen});return}
   db.subscriptions.push({business_id:b.id,plan:chosen,complimentary:false,trial_ends:new Date(Date.now()+(cfg().trialDays||30)*864e5).toISOString()});db.trial_log.push({owner:b.owner,business_id:b.id})};
 const users=saved?saved.users:[];
 const persist=()=>{if(PERSIST)sessionStorage.setItem('mockdb',JSON.stringify({db,users}))};
 function builder(table){let rows=null,op='select',payload=null,filters=[],rangeA=null,wantSel=false;
  const api={select(){if(op!=='select')wantSel=true;return api},eq(k,v){filters.push(r=>r[k]===v);return api},order(){return api},limit(){return api},gte(k,v){filters.push(r=>r[k]>=v);return api},range(a,b){rangeA=[a,b];return api},
   insert(p){op='insert';payload=Array.isArray(p)?p:[p];return api},update(p){op='update';payload=p;return api},delete(){op='delete';return api},
   then(res,rej){try{let data=null;let t=db[table];
    if(table==='payment_requests'||table==='billing_config'){if(op!=='select')throw new Error('permission denied for table '+table);t=table==='billing_config'?(isSuper()?t:[]):t.filter(r=>isBA()||['owner','admin'].includes(mrole(r.business_id)))}const hist=(r,a)=>{if(table!=='records')return;db.history=db.history||[];db.history.push({id:db.history.length+1,business_id:r.business_id,record_id:r.id,type:r.type,action:a,data:r.data,changed_by:session&&session.user.email,changed_at:new Date().toISOString()})};
    if(op==='select'){data=t.filter(r=>filters.every(f=>f(r)));if(rangeA)data=data.slice(rangeA[0],rangeA[1]+1);data=JSON.parse(JSON.stringify(data))}
    if(op==='insert'){guard(table,'insert',payload);payload.forEach(p=>{const r=Object.assign({id:p.id||Math.random().toString(36).slice(2),created_at:new Date().toISOString()},p);if(table==='businesses'){r.owner=session.user.id;db.members.push({id:'m'+Math.random(),business_id:r.id,email:session.user.email,role:'owner',tabs:[],created_at:r.created_at});onNewBiz(r)}t.push(r);hist(r,'created')})}
    if(op==='update'||op==='delete')guard(table,op,t.filter(r=>filters.every(f=>f(r))).map(r=>table==='records'&&op==='update'?Object.assign({},r,payload):r),payload);
    if(op==='update'&&table==='businesses'&&payload.slug&&t.some(r=>r.slug===payload.slug&&!filters.every(f=>f(r))))throw new Error('duplicate key value violates unique constraint "businesses_slug_key"');
    if(op==='update'){const m=t.filter(r=>filters.every(f=>f(r)));m.forEach(r=>{Object.assign(r,payload);hist(r,'changed')});data=m.map(r=>({id:r.id}))}
    if(op==='delete'){t.filter(r=>filters.every(f=>f(r))).forEach(r=>hist(r,'deleted'));db[table]=t.filter(r=>!filters.every(f=>f(r)))}
    if(op!=='select')persist();res({data,error:null})}catch(e){res({data:null,error:{message:e.message}})}}};return api}
 const fire=(ev)=>cbs.forEach(c=>c(ev,session));
 const __api={from:builder,
  auth:{async getSession(){return {data:{session}}},onAuthStateChange(c){cbs.push(c)},
   async signUp({email,password,options}){users.push({email,password,id:'u'+users.length,plan:((options||{}).data||{}).plan});db.profiles.push({id:'u'+(users.length-1),email,created_at:new Date().toISOString()});persist();return {data:{session:null},error:null}},
   async signInWithPassword({email,password}){const u=users.find(x=>x.email===email&&x.password===password);if(!u)return {data:null,error:{message:'Invalid login credentials'}};session={user:{id:u.id,email},aal:'aal1',access_token:'tok-'+u.id};setTimeout(()=>fire('SIGNED_IN'));return {data:{session},error:null}},
   async signOut(){session=null;fire('SIGNED_OUT')},async resetPasswordForEmail(){return {error:null}},async updateUser(){return {data:{},error:null}},
   mfa:{async listFactors(){const u=users.find(x=>x.id===session.user.id);const all=(u.factors||[]);return {data:{all,totp:all},error:null}},
    async enroll(){const u=users.find(x=>x.id===session.user.id);const f={id:'f'+Math.random().toString(36).slice(2),factor_type:'totp',status:'unverified',totp:{qr_code:'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22/>',secret:'JBSWY3DPEHPK3PXP'}};(u.factors=u.factors||[]).push(f);return {data:f,error:null}},
    async unenroll({factorId}){const u=users.find(x=>x.id===session.user.id);u.factors=(u.factors||[]).filter(f=>f.id!==factorId);return {data:{},error:null}},
    async challengeAndVerify({factorId,code}){if(code!=='123456')return {data:null,error:{message:'Invalid TOTP code entered'}};const u=users.find(x=>x.id===session.user.id);const f=(u.factors||[]).find(x=>x.id===factorId);if(f)f.status='verified';session.aal='aal2';return {data:{},error:null}},
    async getAuthenticatorAssuranceLevel(){const u=users.find(x=>x.id===session.user.id);const v=(u.factors||[]).some(f=>f.status==='verified');return {data:{currentLevel:session.aal||'aal1',nextLevel:v?'aal2':'aal1'},error:null}}}},
  channel(){const ch={on(){return ch},subscribe(cb){cb&&cb('SUBSCRIBED');return ch},presenceState(){return {[session.user.email]:[{}]}},async track(){}};return ch},
  storage:{from(bucket){const files=db.files=db.files||{};
    const role=bid=>{if(isSuper())return 'owner';const m=db.members.find(x=>x.business_id===bid&&x.email===session.user.email);return m?m.role:null};
    const canW=(bid,rid)=>{if(bucket==='payment-receipts'){const pr=db.payment_requests.find(x=>x.id===rid&&x.business_id===bid);return !!pr&&['owner','admin'].includes(role(bid))&&['awaiting_payment','awaiting_verification','partially_paid'].includes(pr.status)}const r=db.records.find(x=>x.id===rid&&x.business_id===bid);const ro=role(bid);if(!r||!ro)return false;const m=db.members.find(x=>x.business_id===bid&&x.email===session.user.email);return ro==='owner'||ro==='admin'||(ro==='user'&&m&&(m.tabs||[]).includes(r.type))};
    return {
     async list(prefix){const [bid,rid]=prefix.split('/');if(!role(bid))return {data:[],error:null};
       if(!rid){const rids=[...new Set(Object.keys(files).filter(k=>k.startsWith(bid+'/')).map(k=>k.split('/')[1]))];return {data:rids.map(n=>({name:n,id:null})),error:null}}
       return {data:Object.keys(files).filter(k=>k.startsWith(prefix+'/')).sort().map(k=>({name:k.split('/')[2],id:k,created_at:files[k].at,metadata:{size:files[k].size,mimetype:files[k].type}})),error:null}},
     async upload(path,file,o){const [bid,rid]=path.split('/');if(window.MOCK_NO_STORAGE)return {data:null,error:{message:'Bucket not found'}};if(!canW(bid,rid))return {data:null,error:{message:'new row violates row-level security policy'}};
       if(file.size>10485760)return {data:null,error:{message:'The object exceeded the maximum allowed size'}};
       const buf=await file.arrayBuffer();files[path]={size:file.size,type:(o&&o.contentType)||file.type,b64:btoa(String.fromCharCode(...new Uint8Array(buf))),at:new Date().toISOString()};persist();return {data:{path},error:null}},
     async download(path){const f=files[path];const [bid,rid]=path.split('/');const okR=bucket==='payment-receipts'?(isBA()||['owner','admin'].includes(role(bid)))&&db.payment_requests.some(x=>x.id===rid&&x.business_id===bid):!!role(bid);if(!f||!okR)return {data:null,error:{message:'Object not found'}};const bin=atob(f.b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return {data:new Blob([u],{type:f.type}),error:null}},
     async remove(paths){paths.forEach(pth=>{const [bid,rid]=pth.split('/');const exists=db.records.some(r=>r.id===rid);if(exists?canW(bid,rid):['owner','admin'].includes(role(bid)))delete files[pth]});persist();return {data:[],error:null}}}}},
  removeChannel(){},rpc:async(fn,a)=>{if(String(fn).startsWith('falak_billing'))return billing(fn,a||{});const s=String((a&&a.s)||'').trim().toLowerCase();
   const bid=a&&a.bid;const sub=()=>{let x=db.subscriptions.find(r=>r.business_id===bid);if(!x){x={business_id:bid,plan:'pro'};db.subscriptions.push(x)}return x};
   const done=(d)=>{persist();return {data:d===undefined?null:d,error:null}};const err=m=>({data:null,error:{message:m}});
   if(fn==='falak_plan_state'){if(NOPLANS)return err('function falak_plan_state does not exist');const {st,eff,s}=pstate(bid);const lim=+((cfg()[eff]||{}).users)||0;
     return {data:{plan:s?s.plan:'pro',effective:eff,state:st,trial_ends:s&&s.trial_ends||null,paid_until:s&&s.paid_until||null,complimentary:!!(s&&s.complimentary),requested_plan:s&&s.requested_plan||null,requested_at:s&&s.requested_at||null,users_limit:lim,users:db.members.filter(m=>m.business_id===bid).length,super:isSuper()},error:null}}
   if(fn==='falak_choose_free'){const lim=+((cfg().free||{}).users)||1;if(db.members.filter(m=>m.business_id===bid).length>lim)return err('PLAN_USERS: The Free plan allows '+lim+' user(s). Remove the other users first.');
     Object.assign(sub(),{plan:'free',complimentary:false,requested_plan:null,requested_at:null});const b=db.businesses.find(x=>x.id===bid);if(b)b.slug=null;return done()}
   if(fn==='falak_request_plan'){Object.assign(sub(),{requested_plan:a.p,requested_at:new Date().toISOString()});return done()}
   if(fn==='falak_mark_paid'){if(!isSuper())return err('Only the super admin can record payments.');const x=sub();const nx=d=>{const t=new Date(d+'T00:00:00Z');t.setUTCDate(t.getUTCDate()+1);return t.toISOString().slice(0,10)};
     const f=x.paid_until&&x.paid_until>=today()?nx(x.paid_until):today();const t=new Date(f+'T00:00:00Z');t.setUTCMonth(t.getUTCMonth()+a.m);t.setUTCDate(t.getUTCDate()-1);const u=t.toISOString().slice(0,10);
     Object.assign(x,{plan:a.p,paid_until:u,complimentary:false,requested_plan:null,requested_at:null});db.payments.unshift({id:'p'+Math.random(),business_id:bid,plan:a.p,months:a.m,amount:a.amt,currency:(a.cur||'').toUpperCase(),note:a.nt,paid_from:f,paid_until:u,created_at:new Date().toISOString(),created_by:session.user.email});return done({paid_from:f,paid_until:u})}
   if(fn==='falak_admin_set'){if(!isSuper())return err('Only the super admin can change plans.');const x=sub();
     if(a.action==='extend_trial')x.trial_ends=new Date(Math.max(Date.now(),x.trial_ends?new Date(x.trial_ends).getTime():0)+(+a.val)*864e5).toISOString();
     if(a.action==='complimentary')x.complimentary=a.val==='true';if(a.action==='plan')x.plan=a.val;
     if(a.action==='end'){x.complimentary=false;x.trial_ends=new Date(Date.now()-1000).toISOString();const y=new Date(Date.now()-864e5);x.paid_until=y.toISOString().slice(0,10)}return done()}
   if(fn==='falak_workspace'){const x=db.businesses.find(r=>r.slug&&r.slug===s);return {data:x?{slug:x.slug,name:x.name,logo:(x.settings||{}).logo||''}:null,error:null}}
   if(fn==='falak_slug_free'){if(!session)return {data:null,error:{message:'permission denied for function falak_slug_free'}};return {data:!db.businesses.some(r=>r.slug===s&&r.id!==a.bid),error:null}}
   return {data:null,error:null}},_db:db};
 window.__sb=__api;return __api;
}};
