/* ================= Falak Hesab — core: helpers, backend, state ================= */
const CFG=Object.assign({supabaseUrl:'',supabaseAnonKey:'',superAdmin:'falaktravelagency11@gmail.com',supportWhatsApp:'+93 79 104 4260',supportEmail:'falaktravelagency11@gmail.com'},window.FALAK_CONFIG||{});
/* support contact (can be changed in config.js) */
const SUPPORT={wa:String(CFG.supportWhatsApp||'').replace(/[^0-9]/g,''),phone:String(CFG.supportWhatsApp||''),email:String(CFG.supportEmail||'')};
const supportWa=msg=>'https://wa.me/'+SUPPORT.wa+'?text='+encodeURIComponent(msg);
const supportMail=(subj,body)=>'mailto:'+SUPPORT.email+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(body||'');
const SUPER=String(CFG.superAdmin||'').toLowerCase();
/* falakhesab.com/?demo → a public demo with sample data that lives only in this browser (no account, nothing online) */
const PUBLIC_DEMO=/[?&]demo(=|&|$)/.test(location.search);
const CLOUD=!!(CFG.supabaseUrl&&CFG.supabaseAnonKey)&&!PUBLIC_DEMO;
const IN_FRAME=(()=>{try{return window.self!==window.top}catch(e){return true}})();

const $=s=>document.querySelector(s), $$=(s,el=document)=>[...el.querySelectorAll(s)];
const r2=n=>Math.round((+n||0)*100+Number.EPSILON*100)/100;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const addDays=(d,n)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+(+n||0));return x.toISOString().slice(0,10)};
const daysBetween=(a,b)=>Math.round((new Date(b+'T00:00:00Z')-new Date(a+'T00:00:00Z'))/864e5);
const NF=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt=n=>{n=r2(n);return n<0?'-'+NF.format(-n):NF.format(n)};
const fmtQ=n=>{n=Math.round((+n||0)*1000)/1000;return String(n)};
const fmtD=d=>{if(!d)return'';const [y,m,dd]=String(d).slice(0,10).split('-');return `${dd}/${m}/${y}`};
const fmtDT=d=>{if(!d)return'';const x=new Date(d);return isNaN(x)?'':x.toLocaleString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})};
const num=(n)=>`<span class="num ${r2(n)<0?'neg':''}">${fmt(n)}</span>`;
const newId=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)});
const nowIso=()=>new Date().toISOString();
const ls={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,3200)}
function confirmBox(msg,yes,label='Delete'){const m=$('#modal');m.innerHTML=`<div class="card" role="dialog" aria-modal="true"><p style="margin-top:0">${esc(msg)}</p><div class="actions" style="justify-content:flex-end"><div><button class="btn" id="mNo" type="button">Cancel</button><button class="btn primary" id="mYes" type="button">${esc(label)}</button></div></div></div>`;m.hidden=false;$('#mNo').onclick=()=>m.hidden=true;$('#mYes').onclick=()=>{m.hidden=true;yes()};$('#mNo').focus()}
/* ---------- export visible tables to CSV (opens in Excel, Google Sheets, LibreOffice) ---------- */
function tablesToCsv(root){const out=[];const q=v=>{v=String(v==null?'':v).replace(/\s+/g,' ').trim();return /[",;\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
  root.querySelectorAll('table').forEach((t,ti)=>{if(ti)out.push('');const h=t.closest('.card');const title=h&&h.querySelector('h2');if(title&&root.querySelectorAll('table').length>1)out.push(q(title.textContent));
    t.querySelectorAll('tr').forEach(tr=>{if(tr.hidden||tr.closest('[hidden]'))return;const cells=[...tr.children].filter(c=>!c.classList.contains('noprint'));if(!cells.length)return;out.push(cells.map(c=>q(c.textContent)).join(','))})});
  return out.join('\r\n')}
function exportCsv(root,name){const csv=tablesToCsv(root);if(!csv.trim()){toast(lookupOr('Nothing to export'));return}
  try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download=String(name||'export').replace(/[^\w\-]+/g,'-')+'-'+today()+'.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}catch(e){toast(e.message)}}
function download(name,text){try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800)}catch(e){}}
/* ---------- company address helpers ---------- */
const RESERVED_SLUGS=['admin','api','app','www','mail','login','signup','sign-in','register','reset','share','support','help','assets','vendor','static','index','falak','falakhesab','falak-io','settings','dashboard','billing','pricing','terms','privacy','about','contact','blog','docs','status'];
const slugOk=s=>/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(s)&&!RESERVED_SLUGS.includes(s);
const slugify=t=>String(t||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40).replace(/-+$/,'');
function pathSlug(){
  if(location.protocol==='file:'){const m=/[?&]ws=([^&#]+)/.exec(location.search);return m?decodeURIComponent(m[1]).toLowerCase():''}
  const p=decodeURIComponent(location.pathname.split('/')[1]||'').toLowerCase();return p&&!/\.(html?|js|png|ico|txt|xml|json)$/.test(p)?p:''}
const siteRoot=()=>location.protocol==='file:'?'https://falakhesab.com':location.origin;
const wsUrl=slug=>siteRoot().replace(/^https?:\/\//,'')+'/'+slug;
const copyText=(t,msg)=>{const ok=()=>toast(lookupOr(msg||'Link copied'));if(navigator.clipboard)navigator.clipboard.writeText(t).then(ok,()=>toast(t));else toast(t)};
const safeImg=u=>/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(String(u||''))?u:'';
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('Could not load '+src));document.head.appendChild(s)})}
const chk=({data,error})=>{if(error){const m=String(error.message||''),e=new Error(m.replace(/^(PLAN|BILLING)_[A-Z]+:\s*/,''));e.code=(m.match(/^(?:PLAN|BILLING)_([A-Z]+)/)||[])[1]||'';throw e}return data};

/* ---------------- Backend: Supabase (cloud) or this browser (demo) ---------------- */
const Demo={KEY:PUBLIC_DEMO?'falak_public_demo_v2':'falak_io_demo_v2',d:null,
  load(){try{this.d=JSON.parse(localStorage.getItem(this.KEY))}catch(e){}if(!this.d||!this.d.businesses)this.d={businesses:[],members:[],records:[]};this.d.history=this.d.history||[]},
  log(row,action){this.d.history.push({id:this.d.history.length+1,business_id:row.business_id,record_id:row.id,type:row.type,action,data:row.data,changed_by:API.user.email,changed_at:nowIso()});if(this.d.history.length>3000)this.d.history.splice(0,this.d.history.length-3000)},
  save(){try{localStorage.setItem(this.KEY,JSON.stringify(this.d))}catch(e){}}};

const API={
  user:null,sb:null,channel:null,
  async init(){
    if(!CLOUD){Demo.load();this.user={id:'demo',email:'demo@falakhesab.com'};return}
    await loadScript('vendor/supabase-2.45.4.js');
    this.sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey);
    const {data}=await this.sb.auth.getSession();
    this.setUser(data.session);
    this.sb.auth.onAuthStateChange((ev,session)=>{
      const before=this.user&&this.user.id;this.setUser(session);
      if(ev==='PASSWORD_RECOVERY'){App.recovery=true;go('#/reset');return}
      if(ev==='SIGNED_OUT'){this._mfa=null;App.billing=undefined;closeBusiness();router.tried=false;router.wsP=null;router.wsOpened=false;router();return}
      if(ev==='SIGNED_IN'&&!before){router()}
    });
  },
  setUser(s){this.user=s?{id:s.user.id,email:String(s.user.email||'').toLowerCase()}:null},
  isSuper(){return !CLOUD||(!!this.user&&this.user.email===SUPER)},
  async signIn(email,pw){chk(await this.sb.auth.signInWithPassword({email,password:pw}))},
  async signUp(email,pw,plan){return chk(await this.sb.auth.signUp({email,password:pw,options:{emailRedirectTo:location.origin+location.pathname,data:plan?{plan}:{}}}))},
  async signOut(){if(CLOUD)await this.sb.auth.signOut()},
  async resetPassword(email){chk(await this.sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname}))},
  async updatePassword(pw){chk(await this.sb.auth.updateUser({password:pw}))},
  /* two-step login (TOTP authenticator app) */
  _mfa:null,
  async needMfa(){if(!CLOUD||!this.user)return false;if(this._mfa&&this._mfa.uid===this.user.id)return this._mfa.need;
    const {data,error}=await this.sb.auth.mfa.getAuthenticatorAssuranceLevel();const need=!error&&data&&data.nextLevel==='aal2'&&data.currentLevel!=='aal2';this._mfa={uid:this.user.id,need};return need},
  async mfaFactors(){const {data,error}=await this.sb.auth.mfa.listFactors();if(error)throw new Error(error.message);return (data&&data.totp)||[]},
  async mfaEnroll(){const old=(await this.sb.auth.mfa.listFactors()).data;for(const f of ((old&&old.all)||[]).filter(f=>f.status!=='verified'))await this.sb.auth.mfa.unenroll({factorId:f.id});
    return chk(await this.sb.auth.mfa.enroll({factorType:'totp',friendlyName:'Falak Hesab '+new Date().toISOString().slice(0,16)}))},
  async mfaVerify(factorId,code){chk(await this.sb.auth.mfa.challengeAndVerify({factorId,code}));this._mfa={uid:this.user.id,need:false}},
  async mfaLogin(code){const f=(await this.mfaFactors()).find(x=>x.status==='verified');if(!f)throw new Error('No authenticator found');await this.mfaVerify(f.id,code)},
  async mfaRemove(factorId){chk(await this.sb.auth.mfa.unenroll({factorId}));this._mfa=null},

  /* company addresses: falakhesab.com/<slug> */
  async workspace(slug){
    if(!CLOUD){const b=Demo.d.businesses.find(x=>x.slug===slug);return b?{slug,name:b.name,logo:(b.settings||{}).logo||''}:null}
    const {data,error}=await this.sb.rpc('falak_workspace',{s:slug});if(error)throw new Error(error.message);return data||null},
  async slugFree(s,bid){
    if(!CLOUD)return !Demo.d.businesses.some(b=>b.slug===s&&b.id!==bid);
    return !!chk(await this.sb.rpc('falak_slug_free',{s,bid}))},
  /* plans & payments (Step 7). Missing tables → null → nothing is limited */
  async planState(bid){if(!CLOUD)return null;const {data,error}=await this.sb.rpc('falak_plan_state',{bid});if(error){console.warn('Plans not available:',error.message);return null}return data||null},
  async planConfig(){const d={plans:DEFAULT_PLANS,billing:{instructions:''}};if(!CLOUD)return d;
    const {data,error}=await this.sb.from('app_config').select('key,value');if(error||!data)return d;
    data.forEach(r=>{if(r.key==='plans')d.plans=Object.assign({},DEFAULT_PLANS,r.value);if(r.key==='billing')d.billing=r.value||{}});return d},
  async saveConfig(key,value){if(!CLOUD)return;const {data,error}=await this.sb.from('app_config').update({value,updated_at:nowIso()}).eq('key',key).select('key');if(error)throw new Error(error.message);
    if(!data||!data.length)chk(await this.sb.from('app_config').insert({key,value}))},
  async chooseFree(bid){chk(await this.sb.rpc('falak_choose_free',{bid}))},
  async requestPlan(bid,p){chk(await this.sb.rpc('falak_request_plan',{bid,p}))},
  async payments(bid){if(!CLOUD)return [];const {data,error}=await this.sb.from('payments').select('*').eq('business_id',bid).order('created_at',{ascending:false});return error?[]:data||[]},
  async adminPlans(){if(!CLOUD)return {subs:[],payments:[]};const [a,b]=await Promise.all([this.sb.from('subscriptions').select('*'),this.sb.from('payments').select('*').order('created_at',{ascending:false})]);
    return {subs:a.error?null:a.data||[],payments:b.error?[]:b.data||[]}},
  async markPaid(bid,p,m,amt,cur,nt){return chk(await this.sb.rpc('falak_mark_paid',{bid,p,m,amt,cur,nt}))},
  async adminSet(bid,action,val){chk(await this.sb.rpc('falak_admin_set',{bid,action,val:String(val)}))},
  /* attachments (Step 9): private Supabase Storage bucket "attachments", path <business>/<record>/<rand>_<name> */
  /* ---------- bank transfer payments (Step 11). Nothing here moves money: people verify the bank account outside Falak Hesab ---------- */
  async billingCfg(){if(!CLOUD)return null;const {data,error}=await this.sb.rpc('falak_billing_public');if(error)return null;return data},
  async billingAdminCfg(){const {data,error}=await this.sb.from('billing_config').select('value').eq('id',1);if(error)throw new Error(error.message);return (data&&data[0]&&data[0].value)||{}},
  async billingSave(v){return chk(await this.sb.rpc('falak_billing_save',{v}))},
  async billingRequests(bid){const {data,error}=await this.sb.from('payment_requests').select('*').eq('business_id',bid).order('created_at',{ascending:false});if(error)throw new Error(error.message);return data||[]},
  async billingAll(){const {data,error}=await this.sb.from('payment_requests').select('*').order('created_at',{ascending:false}).limit(500);if(error)throw new Error(error.message);return data||[]},
  async billingCreate(bid,plan,months,country,currency,billing){return chk(await this.sb.rpc('falak_billing_create',{bid,p_plan:plan,p_months:months,p_country:country,p_currency:currency,p_billing:billing}))},
  async billingReport(rid,report,receipt){return chk(await this.sb.rpc('falak_billing_report',{rid,p_report:report,p_receipt:receipt||null}))},
  async billingCancel(rid){return chk(await this.sb.rpc('falak_billing_cancel',{rid}))},
  async billingDecide(rid,act,o){return chk(await this.sb.rpc('falak_billing_decide',{rid,act,p_ref:o.ref,p_amount:o.amount==null||o.amount===''?null:+o.amount,p_currency:o.currency||null,p_bank_ref:o.bank_ref||null,p_date:o.date||null,p_note:o.note||null}))},
  async billingInvoice(rid,no,date){return chk(await this.sb.rpc('falak_billing_invoice',{rid,p_no:no,p_date:date||null}))},
  async receiptUpload(bid,rid,file){
    if(file.size>10485760)throw new Error(lookupOr('That file is too large. The limit is 10 MB.'));
    if(!/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(file.type||''))throw new Error(lookupOr('Use a photo (JPG, PNG) or a PDF file.'));
    const path=bid+'/'+rid+'/'+Math.random().toString(36).slice(2,8)+'_'+attSafeName(file.name);
    const {error}=await this.sb.storage.from('payment-receipts').upload(path,file,{contentType:file.type,upsert:false});
    if(error)throw new Error(/row-level|policy|403/i.test(error.message)?lookupOr('You can’t add a receipt to this payment.'):error.message);return path},
  async receiptGet(path){const {data,error}=await this.sb.storage.from('payment-receipts').download(path);if(error)throw new Error(error.message);return data},
  async attList(bid,rid){
    if(!CLOUD)return ((Demo.d.att||{})[rid]||[]).map(f=>({name:f.name,size:f.size,type:f.type,created_at:f.at}));
    const {data,error}=await this.sb.storage.from('attachments').list(bid+'/'+rid,{limit:100,sortBy:{column:'name',order:'asc'}});
    if(error)throw new Error(error.message);return (data||[]).filter(f=>f.id).map(f=>({name:f.name,size:(f.metadata||{}).size||0,type:(f.metadata||{}).mimetype||'',created_at:f.created_at}))},
  async attUpload(bid,rid,file){
    const name=Math.random().toString(36).slice(2,8)+'_'+attSafeName(file.name);
    if(!CLOUD){if(file.size>1048576)throw new Error(lookupOr('In the demo, files can be at most 1 MB.'));const data=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=()=>rej(new Error('Could not read the file'));fr.readAsDataURL(file)});
      const d=Demo.d;d.att=d.att||{};(d.att[rid]=d.att[rid]||[]).push({name,size:file.size,type:file.type,data,at:nowIso()});Demo.save();return name}
    const {error}=await this.sb.storage.from('attachments').upload(bid+'/'+rid+'/'+name,file,{contentType:file.type||'application/octet-stream',upsert:false});
    if(error)throw new Error(/row-level|policy|403|Unauthorized/i.test(error.message)?lookupOr('You can’t add files to this record.'):/size|too large|413/i.test(error.message)?lookupOr('That file is too large. The limit is 10 MB.'):/mime|type/i.test(error.message)?lookupOr('This kind of file is not allowed.'):/bucket/i.test(error.message)?lookupOr('Attachments are not switched on yet. Run step 9 in Supabase first.'):error.message);return name},
  async attGet(bid,rid,name){
    if(!CLOUD){const f=((Demo.d.att||{})[rid]||[]).find(x=>x.name===name);if(!f)throw new Error('File not found');return await (await fetch(f.data)).blob()}
    const {data,error}=await this.sb.storage.from('attachments').download(bid+'/'+rid+'/'+name);if(error)throw new Error(error.message);return data},
  async attRemove(bid,rid,names){
    if(!CLOUD){const d=Demo.d;if(d.att&&d.att[rid]){d.att[rid]=d.att[rid].filter(f=>!names.includes(f.name));if(!d.att[rid].length)delete d.att[rid];Demo.save()}return}
    if(!names.length)return;const {error}=await this.sb.storage.from('attachments').remove(names.map(n=>bid+'/'+rid+'/'+n));if(error)throw new Error(error.message)},
  async attRemoveAll(bid,rid){const fs=await this.attList(bid,rid).catch(()=>[]);if(fs.length)await this.attRemove(bid,rid,fs.map(f=>f.name))},
  async attRemoveBusiness(bid){
    if(!CLOUD){return}
    const {data}=await this.sb.storage.from('attachments').list(bid,{limit:1000});for(const d of (data||[]).filter(x=>!x.id))await this.attRemoveAll(bid,d.name).catch(()=>{})},
  async listBusinesses(){
    if(!CLOUD)return Demo.d.businesses.map(b=>({...b,role:'owner',tabs:[],member:true}));
    const bs=chk(await this.sb.from('businesses').select('*').order('created_at'));
    const ms=chk(await this.sb.from('members').select('business_id,role,tabs').eq('email',this.user.email));
    return bs.map(b=>{const m=ms.find(x=>x.business_id===b.id);return {...b,member:!!m,role:this.isSuper()?'owner':(m?m.role:'viewer'),tabs:m?m.tabs||[]:[]}});
  },
  async createBusiness(name,settings){
    const b={id:newId(),name,settings,owner:this.user.id,created_at:nowIso()};
    if(!CLOUD){Demo.d.businesses.push(b);Demo.d.members.push({id:newId(),business_id:b.id,email:this.user.email,role:'owner',tabs:[],created_at:nowIso()});Demo.save();return b}
    chk(await this.sb.from('businesses').insert({id:b.id,name,settings}));return b;
  },
  async updateBusiness(id,patch){
    if(!CLOUD){Object.assign(Demo.d.businesses.find(b=>b.id===id),patch);Demo.save();return}
    chk(await this.sb.from('businesses').update(patch).eq('id',id));
  },
  async deleteBusiness(id){
    if(CLOUD)await this.attRemoveBusiness(id).catch(()=>{});
    if(!CLOUD){const d=Demo.d;d.businesses=d.businesses.filter(b=>b.id!==id);d.members=d.members.filter(m=>m.business_id!==id);d.records=d.records.filter(r=>r.business_id!==id);Demo.save();return}
    chk(await this.sb.from('businesses').delete().eq('id',id));
  },
  async loadRecords(bid){
    if(!CLOUD)return Demo.d.records.filter(r=>r.business_id===bid);
    let all=[],from=0;
    for(;;){const rows=chk(await this.sb.from('records').select('id,type,data,updated_at,updated_by').eq('business_id',bid).order('id').range(from,from+999));all=all.concat(rows);if(rows.length<1000)break;from+=1000}
    return all;
  },
  async saveRecord(bid,type,id,data,prev){
    const row={id:id||newId(),business_id:bid,type,data,updated_at:nowIso(),updated_by:this.user.email};
    if(!CLOUD){const i=Demo.d.records.findIndex(r=>r.id===row.id);if(i>=0)Demo.d.records[i]=row;else Demo.d.records.push(row);Demo.log(row,i>=0?'changed':'created');Demo.save();return row}
    if(!id){chk(await this.sb.from('records').insert(row));return row}
    let q=this.sb.from('records').update({data,updated_at:row.updated_at,updated_by:row.updated_by}).eq('id',id);
    if(prev)q=q.eq('updated_at',prev);
    const res=chk(await q.select('id'));
    if(!res.length)throw new Error('CONFLICT');
    return row;
  },
  async insertMany(bid,rows){
    const full=rows.map(r=>({id:r.id||newId(),business_id:bid,type:r.type,data:r.data,updated_at:nowIso(),updated_by:this.user.email}));
    if(!CLOUD){Demo.d.records.push(...full);full.forEach(r=>Demo.log(r,'created'));Demo.save();return full}
    for(let i=0;i<full.length;i+=500)chk(await this.sb.from('records').insert(full.slice(i,i+500)));
    return full;
  },
  async deleteRecord(id){
    if(!CLOUD){const r=Demo.d.records.find(x=>x.id===id);if(r)Demo.log(r,'deleted');Demo.d.records=Demo.d.records.filter(r=>r.id!==id);Demo.save();return}
    chk(await this.sb.from('records').delete().eq('id',id));
  },
  async deletedItems(bid){const since=new Date(Date.now()-30*864e5).toISOString();
    if(!CLOUD)return Demo.d.history.filter(h=>h.business_id===bid&&h.action==='deleted'&&h.changed_at>=since).reverse();
    return chk(await this.sb.from('history').select('*').eq('business_id',bid).eq('action','deleted').gte('changed_at',since).order('changed_at',{ascending:false}).limit(500))},
  async history(bid,recordId){
    if(!CLOUD)return Demo.d.history.filter(h=>h.business_id===bid&&(!recordId||h.record_id===recordId)).slice(-300).reverse();
    let q=this.sb.from('history').select('*').eq('business_id',bid).order('changed_at',{ascending:false}).limit(300);
    if(recordId)q=q.eq('record_id',recordId);
    return chk(await q);
  },
  async sharedDoc(tok){
    if(!CLOUD){const r=Demo.d.records.find(x=>x.data&&x.data.shareToken===tok);if(!r)return null;const b=Demo.d.businesses.find(x=>x.id===r.business_id);const pid=r.data.customer||r.data.supplier;const p=Demo.d.records.find(x=>x.id===pid);
      return {id:r.id,type:r.type,doc:r.data,business:{name:b.name,settings:b.settings},party:p?{id:p.id,type:p.type,data:p.data}:null,taxcodes:Demo.d.records.filter(x=>x.business_id===r.business_id&&x.type==='taxcode').map(t=>({id:t.id,type:t.type,data:t.data}))}}
    return chk(await this.sb.rpc('falak_shared_doc',{tok}));
  },
  async listMembers(bid){
    if(!CLOUD)return Demo.d.members.filter(m=>m.business_id===bid);
    return chk(await this.sb.from('members').select('*').eq('business_id',bid).order('created_at'));
  },
  async saveMember(bid,m){
    const row={business_id:bid,email:m.email.toLowerCase().trim(),role:m.role,tabs:m.tabs||[]};
    if(!CLOUD){const x=Demo.d.members.find(y=>y.id===m.id);if(x)Object.assign(x,row);else Demo.d.members.push({id:newId(),created_at:nowIso(),...row});Demo.save();return}
    if(m.id)chk(await this.sb.from('members').update(row).eq('id',m.id));else chk(await this.sb.from('members').insert(row));
  },
  async removeMember(id){
    if(!CLOUD){Demo.d.members=Demo.d.members.filter(m=>m.id!==id);Demo.save();return}
    chk(await this.sb.from('members').delete().eq('id',id));
  },
  async adminData(){
    if(!CLOUD)return {profiles:[{id:'demo',email:'demo@falakhesab.com',created_at:nowIso()}],businesses:Demo.d.businesses,members:Demo.d.members};
    const [p,b,m]=await Promise.all([this.sb.from('profiles').select('*').order('created_at',{ascending:false}),this.sb.from('businesses').select('*').order('created_at'),this.sb.from('members').select('*')]);
    return {profiles:chk(p),businesses:chk(b),members:chk(m)};
  },
  subscribe(bid,onChange,onPresence){
    if(!CLOUD)return;this.unsubscribe();
    const ch=this.sb.channel('biz-'+bid,{config:{presence:{key:this.user.email}}});
    ch.on('postgres_changes',{event:'INSERT',schema:'public',table:'records',filter:'business_id=eq.'+bid},p=>onChange('upsert',p.new));
    ch.on('postgres_changes',{event:'UPDATE',schema:'public',table:'records',filter:'business_id=eq.'+bid},p=>onChange('upsert',p.new));
    ch.on('postgres_changes',{event:'DELETE',schema:'public',table:'records'},p=>onChange('delete',p.old));
    ch.on('presence',{event:'sync'},()=>onPresence(Object.keys(ch.presenceState())));
    ch.subscribe(async st=>{if(st==='SUBSCRIBED'){try{await ch.track({at:nowIso()})}catch(e){}}});
    this.channel=ch;
  },
  unsubscribe(){if(this.channel&&this.sb){this.sb.removeChannel(this.channel);this.channel=null}}
};

/* ---------------- In-memory state of the open business ---------------- */
const App={recovery:false,prefill:null,period:null};
const S={biz:null,role:null,tabs:[],rows:new Map(),ver:0,online:[],plan:null};
let _cache={},_map={},_cacheVer=-1;
function L(type){if(_cacheVer!==S.ver){_cache={};_map={};_cacheVer=S.ver}
  return _cache[type]||(_cache[type]=[...S.rows.values()].filter(r=>r.type===type).map(r=>Object.assign({},r.data,{id:r.id,_u:r.updated_at,_by:r.updated_by})))}
function R(type,id){if(!id)return null;L(type);const m=_map[type]||(_map[type]=new Map(L(type).map(x=>[x.id,x])));return m.get(id)||null}
function setRow(row){S.rows.set(row.id,{id:row.id,type:row.type,data:row.data,updated_at:row.updated_at,updated_by:row.updated_by});S.ver++}
function delRow(id){if(S.rows.delete(id))S.ver++}
const setting=k=>(S.biz&&S.biz.settings||{})[k];
/* tabs the business chose to hide from the menu (Customize). Old "travel:false" setting also hides the travel tabs. */
const ALWAYS_TABS=['summary','reports','settings','users','history','billing'];
/* optional modules (e.g. Sarafi) are hidden until switched on in Customize */
const OPTIONAL_TABS=['sarafi','exchange','hawala','fxrate','cashcount'];
/* Exchange & Transfers is switched off for now (user's choice, 28 Oct). Turn it back on with exchange:true in config.js. */
const EXCHANGE_ON=!!(CFG.exchange||window.FALAK_EXCHANGE);
const EXCHANGE_TABS=['sarafi','exchange','hawala','fxrate','cashcount'];
function hiddenTabs(){const h=new Set(setting('hiddenTabs')||[]);if(setting('travel')===false){h.add('travel');h.add('ticket')}const on=setting('shownTabs')||[];OPTIONAL_TABS.forEach(k=>{if(!on.includes(k))h.add(k)});return h}
const proTabHasData=k=>k==='travel'?L('ticket').length>0:k==='sarafi'?(L('exchange').length+L('hawala').length)>0:L(k).length>0;
const tabShown=k=>ALWAYS_TABS.includes(k)||(!hiddenTabs().has(k)&&(!PRO_TABS.includes(k)||planOk('pro')||(S.plan&&S.plan.state==='expired')||proTabHasData(k)));

const canAdmin=()=>S.role==='owner'||S.role==='admin';
/* plans: S.plan comes from the database (falak_plan_state); null = no limits (demo or Step 7 not installed) */
const DEFAULT_PLANS={free:{users:1,usd:0,try:0},basic:{users:3,usd:9,try:299},pro:{users:0,usd:19,try:649},trialDays:30};
const PRO_TYPES=['ticket','exchange','hawala','fxrate','cashcount'];
const PRO_TABS=['travel','ticket','sarafi','exchange','hawala','fxrate','cashcount'];
function planOk(what){const p=S.plan;if(!p||p.super)return true;if(p.state==='expired')return false;
  if(what==='pro')return p.effective==='pro';if(what==='address')return p.effective==='basic'||p.effective==='pro';return true}
const daysLeft=d=>Math.max(0,Math.ceil((new Date(d)-Date.now())/864e5));
const canWrite=t=>planOk(PRO_TYPES.includes(t)?'pro':'write')&&(canAdmin()||(S.role==='user'&&(S.tabs||[]).includes(t)));
const canSee=t=>S.role!=='user'||(S.tabs||[]).includes(t)||['businesses','ledger','profile'].includes(t);

async function saveRec(type,obj,isNew){
  const data={...obj};delete data.id;delete data._u;delete data._by;
  try{const row=await API.saveRecord(S.biz.id,type,isNew?null:obj.id,data,isNew?null:obj._u);setRow(row);return row}
  catch(e){if(e.message==='CONFLICT'){toast('Someone else changed this record while you were editing. The latest version has been loaded.');await reloadBiz()}else toast('Could not save: '+e.message);throw e}
}
async function deleteRec(id){try{await API.deleteRecord(id);delRow(id)}catch(e){toast('Could not delete: '+e.message);throw e}if(S.biz)API.attRemoveAll(S.biz.id,id).catch(()=>{})}
const NO_ATT=['account','taxcode','currency','bank','fxrate','recurringinvoice'];
const attSafeName=n=>{const m=String(n||'file').match(/^(.*?)(\.[A-Za-z0-9]{1,6})?$/);const base=(m[1]||'file').normalize('NFKD').replace(/[^\w.-]+/g,'-').replace(/-+/g,'-').replace(/^[-.]+|[-.]+$/g,'').slice(0,60)||'file';return base+(m[2]||'').toLowerCase()};
