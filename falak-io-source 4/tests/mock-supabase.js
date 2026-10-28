window.supabase={createClient(){
 const PERSIST=(()=>{try{return sessionStorage.getItem('mockpersist')==='1'}catch(e){return false}})();
 const saved=PERSIST?JSON.parse(sessionStorage.getItem('mockdb')||'null'):null;
 const db=saved?saved.db:{businesses:[],members:[],records:[],profiles:[],history:[]};let session=null;const cbs=[];
 ['app_config','subscriptions','payments','trial_log'].forEach(k=>{db[k]=db[k]||[]});
 if(!db.app_config.length&&!(typeof window!=='undefined'&&window.MOCK_NO_PLANS))db.app_config.push({key:'plans',value:{free:{users:1,usd:0,try:0},basic:{users:3,usd:9,try:299},pro:{users:0,usd:19,try:649},trialDays:30}},{key:'billing',value:{instructions:'Bank: Example Bank, IBAN TR00 0000 0000 0000\nThen send the receipt on WhatsApp.'}});
 const NOPLANS=typeof window!=='undefined'&&window.MOCK_NO_PLANS;
 const isSuper=()=>session&&session.user.email==='falaktravelagency11@gmail.com';
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
   then(res,rej){try{let data=null;const t=db[table];
    if(op==='select'){data=t.filter(r=>filters.every(f=>f(r)));if(rangeA)data=data.slice(rangeA[0],rangeA[1]+1);data=JSON.parse(JSON.stringify(data))}
    if(op==='insert'){guard(table,'insert',payload);payload.forEach(p=>{const r=Object.assign({id:p.id||Math.random().toString(36).slice(2),created_at:new Date().toISOString()},p);if(table==='businesses'){r.owner=session.user.id;db.members.push({id:'m'+Math.random(),business_id:r.id,email:session.user.email,role:'owner',tabs:[],created_at:r.created_at});onNewBiz(r)}t.push(r)})}
    if(op==='update'||op==='delete')guard(table,op,t.filter(r=>filters.every(f=>f(r))).map(r=>table==='records'&&op==='update'?Object.assign({},r,payload):r),payload);
    if(op==='update'&&table==='businesses'&&payload.slug&&t.some(r=>r.slug===payload.slug&&!filters.every(f=>f(r))))throw new Error('duplicate key value violates unique constraint "businesses_slug_key"');
    if(op==='update'){const m=t.filter(r=>filters.every(f=>f(r)));m.forEach(r=>Object.assign(r,payload));data=m.map(r=>({id:r.id}))}
    if(op==='delete'){db[table]=t.filter(r=>!filters.every(f=>f(r)))}
    if(op!=='select')persist();res({data,error:null})}catch(e){res({data:null,error:{message:e.message}})}}};return api}
 const fire=(ev)=>cbs.forEach(c=>c(ev,session));
 return {from:builder,
  auth:{async getSession(){return {data:{session}}},onAuthStateChange(c){cbs.push(c)},
   async signUp({email,password,options}){users.push({email,password,id:'u'+users.length,plan:((options||{}).data||{}).plan});db.profiles.push({id:'u'+(users.length-1),email,created_at:new Date().toISOString()});persist();return {data:{session:null},error:null}},
   async signInWithPassword({email,password}){const u=users.find(x=>x.email===email&&x.password===password);if(!u)return {data:null,error:{message:'Invalid login credentials'}};session={user:{id:u.id,email},aal:'aal1'};setTimeout(()=>fire('SIGNED_IN'));return {data:{session},error:null}},
   async signOut(){session=null;fire('SIGNED_OUT')},async resetPasswordForEmail(){return {error:null}},async updateUser(){return {data:{},error:null}},
   mfa:{async listFactors(){const u=users.find(x=>x.id===session.user.id);const all=(u.factors||[]);return {data:{all,totp:all},error:null}},
    async enroll(){const u=users.find(x=>x.id===session.user.id);const f={id:'f'+Math.random().toString(36).slice(2),factor_type:'totp',status:'unverified',totp:{qr_code:'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22/>',secret:'JBSWY3DPEHPK3PXP'}};(u.factors=u.factors||[]).push(f);return {data:f,error:null}},
    async unenroll({factorId}){const u=users.find(x=>x.id===session.user.id);u.factors=(u.factors||[]).filter(f=>f.id!==factorId);return {data:{},error:null}},
    async challengeAndVerify({factorId,code}){if(code!=='123456')return {data:null,error:{message:'Invalid TOTP code entered'}};const u=users.find(x=>x.id===session.user.id);const f=(u.factors||[]).find(x=>x.id===factorId);if(f)f.status='verified';session.aal='aal2';return {data:{},error:null}},
    async getAuthenticatorAssuranceLevel(){const u=users.find(x=>x.id===session.user.id);const v=(u.factors||[]).some(f=>f.status==='verified');return {data:{currentLevel:session.aal||'aal1',nextLevel:v?'aal2':'aal1'},error:null}}}},
  channel(){const ch={on(){return ch},subscribe(cb){cb&&cb('SUBSCRIBED');return ch},presenceState(){return {[session.user.email]:[{}]}},async track(){}};return ch},
  storage:{from(bucket){const files=db.files=db.files||{};
    const role=bid=>{if(isSuper())return 'owner';const m=db.members.find(x=>x.business_id===bid&&x.email===session.user.email);return m?m.role:null};
    const canW=(bid,rid)=>{const r=db.records.find(x=>x.id===rid&&x.business_id===bid);const ro=role(bid);if(!r||!ro)return false;const m=db.members.find(x=>x.business_id===bid&&x.email===session.user.email);return ro==='owner'||ro==='admin'||(ro==='user'&&m&&(m.tabs||[]).includes(r.type))};
    return {
     async list(prefix){const [bid,rid]=prefix.split('/');if(!role(bid))return {data:[],error:null};
       if(!rid){const rids=[...new Set(Object.keys(files).filter(k=>k.startsWith(bid+'/')).map(k=>k.split('/')[1]))];return {data:rids.map(n=>({name:n,id:null})),error:null}}
       return {data:Object.keys(files).filter(k=>k.startsWith(prefix+'/')).sort().map(k=>({name:k.split('/')[2],id:k,created_at:files[k].at,metadata:{size:files[k].size,mimetype:files[k].type}})),error:null}},
     async upload(path,file,o){const [bid,rid]=path.split('/');if(window.MOCK_NO_STORAGE)return {data:null,error:{message:'Bucket not found'}};if(!canW(bid,rid))return {data:null,error:{message:'new row violates row-level security policy'}};
       if(file.size>10485760)return {data:null,error:{message:'The object exceeded the maximum allowed size'}};
       const buf=await file.arrayBuffer();files[path]={size:file.size,type:(o&&o.contentType)||file.type,b64:btoa(String.fromCharCode(...new Uint8Array(buf))),at:new Date().toISOString()};persist();return {data:{path},error:null}},
     async download(path){const f=files[path];const [bid]=path.split('/');if(!f||!role(bid))return {data:null,error:{message:'Object not found'}};const bin=atob(f.b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return {data:new Blob([u],{type:f.type}),error:null}},
     async remove(paths){paths.forEach(pth=>{const [bid,rid]=pth.split('/');const exists=db.records.some(r=>r.id===rid);if(exists?canW(bid,rid):['owner','admin'].includes(role(bid)))delete files[pth]});persist();return {data:[],error:null}}}}},
  removeChannel(){},rpc:async(fn,a)=>{const s=String((a&&a.s)||'').trim().toLowerCase();
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
}};
