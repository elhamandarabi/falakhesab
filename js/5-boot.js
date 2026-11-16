/* ================= Falak Hesab — businesses, admin, reports, router, boot ================= */
async function vBusinesses(V){
  V.innerHTML='<div class="loading">Loading your businesses…</div>';
  let list=[];try{list=await API.listBusinesses()}catch(x){V.innerHTML=`<div class="note">Could not load businesses: ${esc(x.message)}</div>`;return}
  const mine=API.isSuper()&&CLOUD?list.filter(b=>b.member):list;
  V.innerHTML=`<div class="head"><h1>Businesses</h1><div class="tools"><label class="btn" for="impFile">Import backup</label><input type="file" id="impFile" accept=".json,application/json" hidden><button class="btn primary" id="addBiz" type="button">+ New business</button></div></div>
  <div id="newBiz" hidden class="card pad" style="margin-bottom:16px"><h2>New business</h2>
    <form id="nbForm" class="grid">${fld('Business name',inp('nbName','','required placeholder="e.g. Falak Travel"'))}${fld('Currency',inp('nbCur','USD','maxlength="5"'))}${fld('Start date of books',inp('nbStart',today().slice(0,4)+'-01-01','type="date"'))}
    <label class="c span2"><input type="checkbox" id="nbSample"> Add example customers, invoices and payments so I can explore</label>
    <div class="actions span2" style="margin-top:0"><div><button class="btn primary" type="submit" id="nbBtn">Create business</button><button class="btn" type="button" id="nbCancel">Cancel</button></div></div></form></div>
  <div class="tiles">${mine.map(b=>`<div class="card tile" data-id="${b.id}" tabindex="0" role="button"><b>${esc(b.name)}</b><span>${esc((b.settings||{}).currency||'')} · ${ROLE_LABEL[b.role]||''}</span><span class="small">Created ${fmtD(b.created_at)}</span></div>`).join('')||'<div class="card empty" style="grid-column:1/-1">You don\'t have a business yet. Create one to start, or ask your manager to add your email to theirs.</div>'}</div>
  ${API.isSuper()&&CLOUD&&list.length>mine.length?`<p class="muted small" style="margin-top:14px">As super admin you can also open every other business from <a href="#/admin">Admin</a>.</p>`:''}`;
  $('#addBiz').onclick=()=>{$('#newBiz').hidden=false;$('#nbName').focus()};$('#nbCancel').onclick=()=>$('#newBiz').hidden=true;
  $('#nbForm').onsubmit=async e=>{e.preventDefault();const name=val('nbName');if(!name){toast('Enter a business name');return}$('#nbBtn').disabled=true;
    try{const b=await API.createBusiness(name,{currency:val('nbCur').toUpperCase()||'USD',startDate:val('nbStart')||today().slice(0,4)+'-01-01'});
      await API.insertMany(b.id,seedRows($('#nbSample').checked));b.role='owner';b.tabs=[];await openBusiness(b);toast('Business created');go('#/summary')}
    catch(x){toast('Could not create: '+x.message);$('#nbBtn').disabled=false}};
  $$('.tile[data-id]').forEach(t=>{const o=async()=>{await openBusiness(list.find(b=>b.id===t.dataset.id));go('#/summary')};t.onclick=o;t.onkeydown=e=>{if(e.key==='Enter')o()}});
  $('#impFile').onchange=e=>importBackup(e.target.files[0]);
}
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('[data-back]');if(a){e.preventDefault();history.back()}});
function importBackup(file){
  if(!file)return;const fr=new FileReader();
  fr.onload=async()=>{try{
    let txt=fr.result;const d0=JSON.parse(txt);if(!d0||!Array.isArray(d0.records))throw new Error('not a Falak Hesab backup');
    d0.records.forEach(r=>{txt=txt.split(r.id).join(newId())});const d=JSON.parse(txt);
    const st=Object.assign({},d.settings||{}),lock=st.lockDate;delete st.lockDate;
    const b=await API.createBusiness((d.name||'Imported business')+' (imported)',st);await API.insertMany(b.id,d.records);
    if(lock){st.lockDate=lock;await API.updateBusiness(b.id,{name:b.name,settings:st});b.settings=st}
    b.role='owner';b.tabs=[];await openBusiness(b);toast(`Imported ${d.records.length} records`);go('#/summary')}
  catch(x){toast('Could not import: '+x.message)}};
  fr.readAsText(file);
}

async function vAdmin(V){
  if(!API.isSuper()){V.innerHTML='<div class="note">Only the super admin can open this page.</div>';return}
  V.innerHTML='<div class="loading">Loading…</div>';
  const {profiles,businesses,members}=await API.adminData();
  const owner=b=>(members.find(m=>m.business_id===b.id&&m.role==='owner')||{}).email||'';
  V.innerHTML=`<div class="head"><h1>Admin</h1><span class="muted">${profiles.length} users · ${businesses.length} businesses · ${businesses.filter(b=>b.slug).length} company addresses</span>${CLOUD?'<a class="btn" href="#/payments">Payment approvals</a>':''}</div><div class="stack">
  <div class="card scroll"><h2 style="padding:14px 18px 0">All businesses</h2><table><thead><tr><th>Business</th><th>Company address</th><th>Owner</th><th class="num">Users</th><th>Created</th><th></th></tr></thead><tbody>
  ${businesses.map(b=>`<tr><td>${esc(b.name)}</td><td>${b.slug?`<a class="mono" href="${esc(siteRoot()+'/'+b.slug)}" target="_blank" rel="noopener">/${esc(b.slug)}</a>`:'<span class="muted">—</span>'}</td><td>${esc(owner(b))}</td><td class="num">${members.filter(m=>m.business_id===b.id).length}</td><td class="mono muted">${fmtD(b.created_at)}</td><td><button class="btn sm" type="button" data-open="${b.id}">Open</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">No businesses yet</td></tr>'}</tbody></table></div>
  <div class="card scroll"><h2 style="padding:14px 18px 0">All registered users</h2><table><thead><tr><th>Email</th><th>Signed up</th><th>Businesses</th></tr></thead><tbody>
  ${profiles.map(p=>`<tr><td>${esc(p.email)}</td><td class="mono muted">${fmtD(p.created_at)}</td><td class="muted">${esc(members.filter(m=>m.email===p.email).map(m=>{const b=businesses.find(x=>x.id===m.business_id);return b?`${b.name} (${ROLE_LABEL[m.role]})`:''}).filter(Boolean).join(', '))}</td></tr>`).join('')}</tbody></table></div>
  <p class="muted small">To block a person completely, delete them in Supabase → Authentication → Users. To remove them from one business, open it and use Users & Access.</p></div>`;
  if(CLOUD){try{const pa=await adminPlansHtml(businesses,owner);V.querySelector('.stack').insertAdjacentHTML('afterbegin',pa.html);pa.bind()}catch(e){console.warn(e)}}
  if(CLOUD){try{V.querySelector('.stack').insertAdjacentHTML('beforeend',await adminChatHtml())}catch(e){console.warn(e)}}
  $$('[data-open]').forEach(bt=>bt.onclick=async()=>{const b=businesses.find(x=>x.id===bt.dataset.open);await openBusiness({...b,role:'owner',tabs:[]});go('#/summary')});
}

async function vProfile(V){
  V.innerHTML=`<div class="head"><h1>My account</h1></div><form class="card pad" id="pf" style="max-width:520px"><div class="grid">${fld('Email',inp('pEmail',API.user.email,'disabled'))}${fld('New password',inp('pPw','','type="password" minlength="8" autocomplete="new-password"'))}</div><div class="actions"><div><button class="btn primary" type="submit">Change password</button></div></div></form>`;
  $('#pf').onsubmit=async e=>{e.preventDefault();const pw=$('#pPw').value;if(!strongPw(pw)){toast(lookupOr('Use at least 8 characters with letters and numbers.'));return}try{await API.updatePassword(pw);$('#pPw').value='';toast('Password changed')}catch(x){toast(x.message)}};
  if(!CLOUD)return;
  V.insertAdjacentHTML('beforeend',`<div class="card pad" id="mfaBox" style="max-width:520px;margin-top:18px"><h2>Two-step login</h2><p class="muted">Loading…</p></div>`);
  const box=$('#mfaBox');
  const show=async()=>{let fs=[];try{fs=(await API.mfaFactors()).filter(f=>f.status==='verified')}catch(e){box.innerHTML=`<h2>Two-step login</h2><p class="neg small">${esc(e.message)}</p>`;return}
    if(fs.length){box.innerHTML=`<h2>Two-step login <span class="tag paid">On</span></h2><p class="muted" style="margin-top:0">When you sign in, Falak Hesab asks for a 6-digit code from your authenticator app. Even if someone learns your password, they cannot sign in without your phone.</p>
      <button class="btn danger" type="button" id="mfaOff">Turn off two-step login</button>`;
      $('#mfaOff').onclick=()=>confirmBox(lookupOr('Turn off two-step login? Your account will be protected by the password only.'),async()=>{try{for(const f of fs)await API.mfaRemove(f.id);toast(lookupOr('Two-step login turned off'));show()}catch(x){toast(x.message)}},lookupOr('Turn off'));return}
    box.innerHTML=`<h2>Two-step login <span class="tag">Off</span></h2><p class="muted" style="margin-top:0">Protect your account with a 6-digit code from an app on your phone (Google Authenticator, Microsoft Authenticator or similar). Strongly recommended for owners and administrators.</p>
      <button class="btn primary" type="button" id="mfaOn">Turn on two-step login</button>`;
    $('#mfaOn').onclick=async()=>{let en;try{en=await API.mfaEnroll()}catch(x){toast(x.message);return}
      box.innerHTML=`<h2>Turn on two-step login</h2><ol style="margin:0 0 12px;padding-inline-start:20px;line-height:1.7"><li>Install Google Authenticator or Microsoft Authenticator on your phone.</li><li>In the app, press + and scan this QR code.</li><li>Type the 6-digit code the app shows, then press Confirm.</li></ol>
        <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center"><img src="${esc(en.totp.qr_code)}" alt="QR code" style="width:180px;height:180px;background:#fff;border-radius:10px;padding:6px">
        <div><div class="muted small">Can't scan? Type this key in the app:</div><div class="mono" dir="ltr" style="word-break:break-all;font-size:13px;margin:4px 0 12px">${esc(en.totp.secret)}</div>
        <label class="f">Code<input id="mfaCode" inputmode="numeric" maxlength="6" style="font-size:20px;letter-spacing:.3em;width:170px"></label></div></div>
        <div class="actions" style="justify-content:flex-start"><div><button class="btn primary" type="button" id="mfaOk">Confirm</button><button class="btn" type="button" id="mfaCancel">Cancel</button></div></div><div class="err" id="mfaErr"></div>`;
      $('#mfaCancel').onclick=async()=>{try{await API.mfaRemove(en.id)}catch(e){}show()};
      $('#mfaOk').onclick=async()=>{try{await API.mfaVerify(en.id,val('mfaCode'));toast(lookupOr('Two-step login is on'));show()}catch(x){$('#mfaErr').textContent=lookupOr('Wrong code. Type the newest 6-digit code from your app.')}}}};
  show();
}

/* ---------- Help & Support ---------- */
function vSupport(V){
  const who=API.user?API.user.email:'',biz=S.biz?S.biz.name:'';
  const ctx=[who&&('Account: '+who),biz&&('Business: '+biz)].filter(Boolean).join('\n');
  const waMsg='Hello Falak Hesab support, I need help with: '+(ctx?'\n\n'+ctx:'');
  V.innerHTML=`<div class="head"><h1>Help & Support</h1></div><div class="stack" style="max-width:640px">
  <div class="card pad"><h2 style="margin-top:0">Contact us</h2><p class="muted" style="margin-top:0">Having a problem or a question about Falak Hesab? Write to us and we will help you.</p>
    <div class="actions" style="justify-content:flex-start;margin-top:0"><div>
      ${SUPPORT.wa?`<a class="btn primary" href="${supportWa(waMsg)}" target="_blank" rel="noopener">WhatsApp</a>`:''}
      ${SUPPORT.email?`<a class="btn" href="${supportMail('Falak Hesab support request',waMsg)}">Send email</a>`:''}</div></div>
    <table style="margin-top:14px"><tbody>
      ${SUPPORT.wa?`<tr><td class="muted">WhatsApp / phone</td><td class="mono" dir="ltr">${esc(SUPPORT.phone)}</td></tr>`:''}
      ${SUPPORT.email?`<tr><td class="muted">Email</td><td class="mono" dir="ltr">${esc(SUPPORT.email)}</td></tr>`:''}
    </tbody></table></div>
  <div class="card pad"><h2 style="margin-top:0">To help us answer faster</h2><ul style="margin:0;padding-inline-start:20px;line-height:1.7">
    <li>Tell us the email you sign in with and the business name.</li>
    <li>Say what you were doing and what went wrong.</li>
    <li>Send a screenshot of the problem if you can.</li>
    <li>Never send us your password.</li></ul></div></div>`;
}

/* ---------- report helpers ---------- */
function cashFlow(from,to){
  const P=postings(),isB=k=>k.startsWith('bank:');let open=0,close=0;
  P.forEach(p=>{if(!isB(p.key))return;if(p.date<=to)close+=p.amt;if(p.date<from||p.type==='bank')open+=p.amt});
  const docs={};P.forEach(p=>{if(p.type==='bank'||p.date<from||p.date>to)return;(docs[p.type+'|'+p.id]=docs[p.type+'|'+p.id]||[]).push(p)});
  const flow={};Object.values(docs).forEach(ps=>{if(!ps.some(p=>isB(p.key)))return;ps.forEach(p=>{if(!isB(p.key))flow[p.key]=(flow[p.key]||0)-p.amt})});
  const cls=k=>{const t=k.split(':')[0];if(t==='fa'||t==='fad')return 'inv';if(t==='acc'){const g=keyGroup(k);if(k==='acc:re'||g==='equity'||g==='liability')return 'fin';if(g==='asset')return 'inv'}return 'op'};
  const out={op:[],inv:[],fin:[]};Object.entries(flow).filter(([,v])=>r2(v)).sort((x,y)=>keyName(x[0]).localeCompare(keyName(y[0]))).forEach(([k,v])=>out[cls(k)].push([k,r2(v)]));
  const t=a=>r2(a.reduce((q,x)=>q+x[1],0));const r={...out,tOp:t(out.op),tInv:t(out.inv),tFin:t(out.fin),open:r2(open),close:r2(close)};r.net=r2(r.tOp+r.tInv+r.tFin);return r}
function equityChanges(from,to){
  const before=sums(null,addDays(from,-1)),mv=sums(from,to),rows=[];const tot={o:0,p:0,m:0,c:0};
  let reO=0,reM=0,np=0;accounts().forEach(x=>{const k='acc:'+x.id;if(x.group==='income'||x.group==='expense'){reO-=before[k]||0;np-=mv[k]||0}});reO-=before['acc:re']||0;reM-=mv['acc:re']||0;
  rows.push({k:'acc:re',name:'Retained earnings',o:r2(reO),p:r2(np),m:r2(reM),c:r2(reO+np+reM)});
  accounts().filter(x=>x.group==='equity'&&x.id!=='re').forEach(x=>{const k='acc:'+x.id,o=-(before[k]||0),m=-(mv[k]||0);if(r2(o)||r2(m))rows.push({k,name:x.name,o:r2(o),p:0,m:r2(m),c:r2(o+m)})});
  rows.forEach(x=>{tot.o+=x.o;tot.p+=x.p;tot.m+=x.m;tot.c+=x.c});return {rows,t:tot}}
function bsLines(to){
  const m=sums(null,to),rows=[],t={asset:0,liability:0,equity:0};let re=0;
  Object.keys(m).forEach(k=>{const g=keyGroup(k);if(g==='income'||g==='expense'||k==='acc:re'){re-=m[k];return}if(!r2(m[k]))return;const v=g==='asset'?m[k]:-m[k];rows.push({k,g,v:r2(v)});t[g]+=v});
  rows.push({k:'acc:re',g:'equity',v:r2(re)});t.equity+=re;rows.sort((x,y)=>keyName(x.k).localeCompare(keyName(y.k)));return {rows,t}}
function salesByCustomer(from,to){const m={},inP=d=>d>=from&&d<=to,E=id=>m[id]=m[id]||{s:0,r:0,c:0};
  L('salesinvoice').filter(x=>inP(x.date)&&x.customer).forEach(x=>E(x.customer).s+=docTotals(x).total*docRate(x));
  L('creditnote').filter(x=>inP(x.date)&&x.customer).forEach(x=>E(x.customer).r+=docTotals(x).total*docRate(x));
  L('ticket').filter(x=>x.customer).forEach(x=>{const k=ticketCalc(x),r=docRate(x);if(inP(x.date))E(x.customer).s+=k.sell*r;if(x.refunded&&k.rc&&inP(x.refundDate||x.date))E(x.customer).r+=k.rc*r});
  L('receipt').filter(x=>inP(x.date)).forEach(x=>(x.lines||[]).forEach(l=>{if(l.account&&l.account.startsWith('ar:'))E(l.account.slice(3)).c+=r2(l.amount)*docRate(x)}));
  L('payment').filter(x=>inP(x.date)).forEach(x=>(x.lines||[]).forEach(l=>{if(l.account&&l.account.startsWith('ar:'))E(l.account.slice(3)).c-=r2(l.amount)*docRate(x)}));
  return Object.entries(m).map(([id,v])=>({id,name:nm(R('customer',id)),s:r2(v.s),r:r2(v.r),c:r2(v.c)})).filter(x=>x.s||x.r||x.c).sort((x,y)=>(y.s-y.r)-(x.s-x.r))}

/* ---------- customer statement (unpaid items) — print or send by WhatsApp ---------- */
function vStatement(V,id,pt='customer'){
  const isC=pt==='customer',back=isC?'#/reports/statements':'#/reports/supplier-statements',c=R(pt,id);if(!c)return go(back);const b=S.biz,cu=recCur(c),cur=curLabel(cu),key=(isC?'ar:':'ap:')+id,{from,to}=App.period,t=today(),sg=isC?1:-1;
  const v=p=>sg*(cu?p.fx:p.amt),P=postings().filter(p=>p.key===key).sort((x,y)=>x.date.localeCompare(y.date));
  const open=r2(P.filter(p=>p.date<from).reduce((q,p)=>q+v(p),0));let run=open;
  const tx=P.filter(p=>p.date>=from&&p.date<=to).map(p=>{run=r2(run+v(p));return {...p,v:v(p),run}});
  const close=run,bal=r2(P.filter(p=>p.date<=t).reduce((q,p)=>q+v(p),0));
  const st=Object.values(invoiceStatus(isC?'sales':'purchase')).filter(s=>s.party===id&&s.due>0.004).sort((x,y)=>(x.dueDate||'').localeCompare(y.dueDate||''));
  const what=s=>{if(s.opening)return['Starting balance','',fmtD(s.date)];if(s.ticket){const k=R('ticket',s.id);return['Ticket',k?k.ref+(k.passenger?' · '+k.passenger:''):'',fmtD(s.date)]}const i=R(isC?'salesinvoice':'purchaseinvoice',s.id);return[isC?'Sales invoice':'Purchase invoice',i?i.ref:'',fmtD(s.date)]};
  const bizBlock=`<div>${setting('logo')?`<img class="doclogo" src="${esc(setting('logo'))}" alt="">`:''}<b style="font:700 18px var(--body)">${esc(b.name)}</b><div class="muted" style="white-space:pre-line">${esc(setting('address')||'')}</div><div class="muted">${esc([setting('phone'),setting('email')].filter(Boolean).join(' · '))}</div></div>`;
  const phone=String(c.phone||'').replace(/[^\d]/g,''),T=lookupOr;
  const lastTx=tx.slice(-10).map(p=>`${fmtD(p.date)} ${T(SRC_LABEL[p.type]||p.type)}${p.ref?' #'+p.ref:''}: ${p.v>0?'+':''}${fmt(p.v)}`);
  const msg=[b.name,T('Statement')+' – '+c.name,fmtD(from)+' – '+fmtD(to),'',T('Opening balance')+': '+fmt(open)+' '+cur,...lastTx,'',(bal>=0?T(isC?'Balance due':'Amount we owe'):T(isC?'Credit balance':'Advance paid'))+': '+fmt(Math.abs(bal))+' '+cur,setting('phone')?'☎ '+setting('phone'):''].join('\n');
  V.innerHTML=`<div class="head noprint"><a href="${back}" class="small">${isC?'← Customer statements':'← Supplier statements'}</a><div class="tools"><a class="btn" target="_blank" rel="noopener" href="https://wa.me/${phone}?text=${encodeURIComponent(msg)}">WhatsApp</a><a class="btn" href="${ledgerHref(key)}">All transactions</a>${periodBar()}${IN_FRAME?'':'<button class="btn" type="button" id="prt">Print / PDF</button>'}</div></div>
  <div class="card doc"><div class="dh">${bizBlock}<div class="dt">STATEMENT</div></div>
   <div class="parties"><div><div class="muted small">${isC?'Customer':'Supplier'}</div><b>${esc(c.name)}</b><div style="white-space:pre-line">${esc(c.address||'')}</div></div><dl class="kv"><dt>Period</dt><dd>${fmtD(from)} – ${fmtD(to)}</dd><dt>Date</dt><dd>${fmtD(t)}</dd><dt>Currency</dt><dd>${esc(cur)}</dd></dl></div>
   <div class="scroll"><table><thead><tr><th>Date</th><th>Transaction</th><th>Reference</th><th>Details</th><th class="num">${isC?'Charges':'Bills'}</th><th class="num">${isC?'Payments':'Payments made'}</th><th class="num">Balance</th></tr></thead><tbody>
   <tr><td>${fmtD(from)}</td><td colspan="5" class="muted">Opening balance</td><td class="num">${fmt(open)}</td></tr>
   ${tx.map(p=>`<tr><td>${fmtD(p.date)}</td><td>${SRC_LABEL[p.type]||p.type}</td><td class="mono">${esc(p.ref)}</td><td class="muted">${esc(p.desc)}</td><td class="num">${p.v>0?fmt(p.v):''}</td><td class="num">${p.v<0?fmt(-p.v):''}</td><td class="num">${fmt(p.run)}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">No transactions in this period</td></tr>'}
   <tr class="tot"><td colspan="6">Closing balance</td><td class="num">${fmt(close)}</td></tr></tbody></table></div>
   ${st.length?`<h2 style="margin-top:22px">Unpaid invoices</h2><div class="scroll"><table><thead><tr><th>Date</th><th>Transaction</th><th>Reference</th><th>Due date</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance due</th><th></th></tr></thead><tbody>
   ${st.map(s=>{const [k,ref,d]=what(s);return `<tr><td>${d}</td><td>${k}</td><td class="mono">${esc(ref)}</td><td>${fmtD(s.dueDate)}</td><td class="num">${fmt(s.total)}</td><td class="num">${fmt(s.paid)}</td><td class="num">${fmt(s.due)}</td><td>${s.cls==='overdue'?statusTag(s):''}</td></tr>`}).join('')}</tbody></table></div>`:''}
   <div class="totals"><span><b style="font-family:var(--body)">${bal>=0?(isC?'Balance due':'Amount we owe'):(isC?'Credit balance':'Advance paid')} ${esc(cur)}</b></span><b>${fmt(Math.abs(bal))}</b></div>${isC?docFooters('salesinvoice'):''}</div>`;
  bindPeriod();const pr=$('#prt');if(pr){pr.onclick=()=>window.print();if(!$('#csvRep')){pr.insertAdjacentHTML('afterend','<button class="btn noprint" type="button" id="csvRep">Export</button>');$('#csvRep').onclick=()=>exportCsv($('#view'),(location.hash.split('/')[2]||'report'))}}
}

/* ---------- Reports ---------- */
const REPORTS=[['trial','Trial balance','Debit and credit balance of every account'],['gl','General ledger summary','Opening, movement and closing for each account'],['pl-month','Profit and loss by month','Income and expenses month by month'],
  ['project','Profit and loss by project','Income, expenses and profit for each project'],['aged-ar','Aged receivables','Unpaid sales invoices by age'],['aged-ap','Aged payables','Unpaid purchase invoices by age'],['inventory','Inventory value','Quantity on hand and value per item'],['tax','Tax summary','Tax collected and paid per tax code'],
  ['cashflow','Cash flow statement','Money in and out of bank and cash accounts'],['equity','Statement of changes in equity','How owners\' equity changed in the period'],
  ['bs-compare','Balance sheet – comparison','This date compared with one year earlier'],['pl-compare','Profit and loss – comparison','This period compared with the same period last year'],
  ['sales-customer','Sales by customer','Sales, returns and money received per customer'],['rp-summary','Receipts and payments summary','Money received and paid per account'],
  ['statements','Customer statements','What each customer owes, to print or send by WhatsApp'],['supplier-statements','Supplier statements','What we owe each supplier, airline or partner']];
function vReports(V,r,a,id){
  if(a==='statement')return vStatement(V,id);
  if(a==='sstatement')return vStatement(V,id,'supplier');
  if(!a){V.innerHTML=`<div class="head"><h1>Reports</h1></div><div class="tiles"><a class="card tile" href="#/summary"><b>Balance sheet & profit and loss</b><span>On the Summary page</span></a>${REPORTS.map(([k,t,d])=>`<a class="card tile" href="#/reports/${k}"><b>${t}</b><span>${d}</span></a>`).join('')}</div>`;return}
  const {from,to}=App.period,title=(REPORTS.find(x=>x[0]===a)||[])[1]||'Report';
  let body='',sub='';
  const allKeys=()=>{const m=sums(null,to);return Object.keys(m).filter(k=>r2(m[k])!==0).sort((x,y)=>{const o=Object.keys(GROUPS);return o.indexOf(keyGroup(x))-o.indexOf(keyGroup(y))||keyName(x).localeCompare(keyName(y))})};
  if(a==='trial'){const m=sums(null,to);let D=0,C=0;sub=`as at ${fmtD(to)}`;
    body=`<thead><tr><th>Account</th><th>Group</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead><tbody>${allKeys().map(k=>{const v=r2(m[k]);if(v>0)D+=v;else C-=v;return `<tr class="click" data-h="${ledgerHref(k)}"><td>${esc(keyName(k))}</td><td class="muted">${GROUPS[keyGroup(k)]}</td><td class="num">${v>0?fmt(v):''}</td><td class="num">${v<0?fmt(-v):''}</td></tr>`}).join('')}<tr class="tot"><td colspan="2">Total</td><td class="num">${fmt(D)}</td><td class="num">${fmt(C)}</td></tr></tbody>`}
  else if(a==='gl'){const o=sums(null,addDays(from,-1)),mv=sums(from,to),c=sums(null,to);sub=`${fmtD(from)} – ${fmtD(to)}`;
    const keys=[...new Set(Object.keys(c).concat(Object.keys(mv)))].filter(k=>r2(c[k]||0)||r2(mv[k]||0)).sort((x,y)=>keyName(x).localeCompare(keyName(y)));
    body=`<thead><tr><th>Account</th><th class="num">Opening</th><th class="num">Debits</th><th class="num">Credits</th><th class="num">Closing</th></tr></thead><tbody>${keys.map(k=>{const P=postings().filter(p=>p.key===k&&p.date>=from&&p.date<=to);const d=P.filter(p=>p.amt>0).reduce((s,p)=>s+p.amt,0),cr=-P.filter(p=>p.amt<0).reduce((s,p)=>s+p.amt,0);
      return `<tr class="click" data-h="${ledgerHref(k)}"><td>${esc(keyName(k))}</td><td class="num">${fmt(o[k]||0)}</td><td class="num">${fmt(d)}</td><td class="num">${fmt(cr)}</td><td class="num">${fmt(c[k]||0)}</td></tr>`}).join('')}</tbody><caption class="muted small" style="caption-side:bottom;text-align:left;padding:10px 12px">Debit balances are positive, credit balances negative.</caption>`}
  else if(a==='pl-month'){const months=[];let d=from.slice(0,7);while(d<=to.slice(0,7)&&months.length<24){months.push(d);const [y,m]=d.split('-').map(Number);d=m===12?`${y+1}-01`:`${y}-${String(m+1).padStart(2,'0')}`}
    const ms=months.map(m=>sums(m+'-01',m+'-31'));sub=`${fmtD(from)} – ${fmtD(to)}`;
    const rowFor=(a,s)=>`<tr class="click" data-h="${ledgerHref('acc:'+a.id)}"><td>${esc(a.name)}</td>${ms.map(m=>`<td class="num">${fmt(s*(m['acc:'+a.id]||0))}</td>`).join('')}</tr>`;
    const used=g=>accounts().filter(a=>a.group===g&&ms.some(m=>r2(m['acc:'+a.id]||0)));
    const netRow=ms.map(m=>{let n=0;accounts().filter(a=>a.group==='income'||a.group==='expense').forEach(a=>n-=m['acc:'+a.id]||0);return `<td class="num">${fmt(n)}</td>`}).join('');
    body=`<thead><tr><th>Account</th>${months.map(m=>`<th class="num">${m.slice(5)}/${m.slice(2,4)}</th>`).join('')}</tr></thead><tbody><tr><td colspan="${months.length+1}" class="sec">Income</td></tr>${used('income').map(a=>rowFor(a,-1)).join('')}<tr><td colspan="${months.length+1}" class="sec">Expenses</td></tr>${used('expense').map(a=>rowFor(a,1)).join('')}<tr class="tot"><td>Net profit</td>${netRow}</tr></tbody>`}
  else if(a==='aged-ar'||a==='aged-ap'){const side=a==='aged-ar'?'sales':'purchase',pt=side==='sales'?'customer':'supplier',pre=side==='sales'?'ar:':'ap:',sg=side==='sales'?1:-1,st=Object.values(invoiceStatus(side)).filter(s=>s.due>0.004),t=today(),fxb=fxSums(null),bs=sums(null,null);sub=`as at ${fmtD(t)}`;
    const B=[['Current',-1e9,0],['1–30 days',1,30],['31–60 days',31,60],['61–90 days',61,90],['Over 90 days',91,1e9]];
    const tot=B.map(()=>0);let totO=0,totT=0;const rows=L(pt).sort((x,y)=>x.name.localeCompare(y.name)).map(p=>{const mine=st.filter(s=>s.party===p.id),cu=recCur(p),bal=r2(sg*(cu?fxb[pre+p.id]||0:bs[pre+p.id]||0));if(!mine.length&&!bal)return'';
      const inB=(s,lo,hi)=>{const d=daysBetween(s.dueDate,t);return d>=lo&&d<=hi};const v=B.map(([,lo,hi],i)=>{const m=mine.filter(s=>inB(s,lo,hi));tot[i]+=m.reduce((q,s)=>q+s.due*s.rate,0);return m.reduce((q,s)=>q+s.due,0)});
      const inv=v.reduce((a,b)=>a+b,0),oth=r2(bal-inv),balB=r2(sg*(bs[pre+p.id]||0));totO+=balB-mine.reduce((q,s)=>q+s.due*s.rate,0);totT+=balB;
      return `<tr class="click" data-h="${ledgerHref(pre+p.id)}"><td>${esc(p.name)}${cu?` <span class="muted small">${esc(cu)}</span>`:''}</td>${v.map(x=>`<td class="num">${x?fmt(x):''}</td>`).join('')}<td class="num">${oth?fmt(oth):''}</td><td class="num">${fmt(bal)}</td></tr>`}).join('');
    body=`<thead><tr><th>${pt==='customer'?'Customer':'Supplier'}</th>${B.map(b=>`<th class="num">${b[0]}</th>`).join('')}<th class="num">Other / advances</th><th class="num">Balance</th></tr></thead><tbody>${rows||`<tr><td colspan="8" class="empty">Nothing outstanding</td></tr>`}<tr class="tot"><td>Total ${esc(BASE())}</td>${tot.map(x=>`<td class="num">${fmt(x)}</td>`).join('')}<td class="num">${fmt(totO)}</td><td class="num">${fmt(totT)}</td></tr></tbody>
      <caption class="muted small" style="caption-side:bottom;text-align:start;padding:10px 12px">Age columns are unpaid invoices and tickets by days overdue. "Other / advances" is the rest of the balance (payments, deposits or journal entries not linked to an invoice). Each party's amounts are in its own currency; the total row is in the base currency.</caption>`}
  else if(a==='project'){const pl=projectPL(from,to);sub=`${fmtD(from)} – ${fmtD(to)}`;const ps=[...L('project')].sort(byCode);
    const keys=[...new Set(ps.flatMap(p=>Object.keys(pl[p.id].acc)))].sort((x,y)=>keyGroup(y).localeCompare(keyGroup(x))||keyName(x).localeCompare(keyName(y)));
    body=`<thead><tr><th>Account</th>${ps.map(p=>`<th class="num">${esc(p.name)}</th>`).join('')}</tr></thead><tbody>${keys.map(k=>{const s=keyGroup(k)==='income'?-1:1;return `<tr><td>${esc(keyName(k))}</td>${ps.map(p=>`<td class="num">${pl[p.id].acc[k]?fmt(s*pl[p.id].acc[k]):''}</td>`).join('')}</tr>`}).join('')||`<tr><td colspan="${ps.length+1}" class="empty">No project transactions in this period</td></tr>`}
      <tr class="tot"><td>Profit</td>${ps.map(p=>`<td class="num">${fmt(pl[p.id].inc-pl[p.id].exp)}</td>`).join('')}</tr></tbody>`}
  else if(a==='inventory'){const inv=inventory();let T=0;sub='today';
    body=`<thead><tr><th>Code</th><th>Item</th><th class="num">Qty on hand</th><th class="num">Average cost</th><th class="num">Value</th></tr></thead><tbody>${L('item').filter(i=>i.track).sort(byCode).map(i=>{T+=inv[i.id].value;return `<tr class="click" data-h="${ledgerHref('inv:'+i.id)}"><td class="mono muted">${esc(i.code||'')}</td><td>${esc(i.name)}</td><td class="num">${fmtQ(inv[i.id].qty)}</td><td class="num">${fmt(inv[i.id].avg)}</td><td class="num">${fmt(inv[i.id].value)}</td></tr>`}).join('')}<tr class="tot"><td colspan="4">Total</td><td class="num">${fmt(T)}</td></tr></tbody>`}
  else if(a==='tax'){sub=`${fmtD(from)} – ${fmtD(to)}`;const P=postings().filter(p=>p.key.startsWith('tax:')&&p.date>=from&&p.date<=to);
    body=`<thead><tr><th>Tax code</th><th class="num">Tax on sales</th><th class="num">Tax on purchases</th><th class="num">Net payable</th></tr></thead><tbody>${L('taxcode').map(t=>{const mine=P.filter(p=>p.key==='tax:'+t.id);const out=-mine.filter(p=>p.amt<0).reduce((s,p)=>s+p.amt,0),inp_=mine.filter(p=>p.amt>0).reduce((s,p)=>s+p.amt,0);
      return `<tr class="click" data-h="${ledgerHref('tax:'+t.id)}"><td>${esc(t.name)}</td><td class="num">${fmt(out)}</td><td class="num">${fmt(inp_)}</td><td class="num">${fmt(out-inp_)}</td></tr>`}).join('')}</tbody>`}
  else if(a==='cashflow'){sub=`${fmtD(from)} – ${fmtD(to)}`;const cf=cashFlow(from,to);
    const sec=(t,rows,total)=>`<tr><td colspan="2" class="sec">${t}</td></tr>${rows.map(([k,v])=>`<tr class="click" data-h="${ledgerHref(k)}"><td>${esc(keyName(k))}</td><td class="num">${fmt(v)}</td></tr>`).join('')||'<tr><td colspan="2" class="muted">—</td></tr>'}<tr class="tot"><td>${t==='Operating activities'?'Net cash from operating activities':t==='Investing activities'?'Net cash from investing activities':'Net cash from financing activities'}</td><td class="num">${fmt(total)}</td></tr>`;
    body=`<thead><tr><th>Description</th><th class="num">${esc(BASE())}</th></tr></thead><tbody>${sec('Operating activities',cf.op,cf.tOp)}${sec('Investing activities',cf.inv,cf.tInv)}${sec('Financing activities',cf.fin,cf.tFin)}
      <tr><td>Net change in cash</td><td class="num">${fmt(cf.net)}</td></tr><tr><td>Cash at the beginning of the period</td><td class="num">${fmt(cf.open)}</td></tr><tr class="tot"><td>Cash at the end of the period</td><td class="num">${fmt(cf.close)}</td></tr></tbody>`}
  else if(a==='equity'){sub=`${fmtD(from)} – ${fmtD(to)}`;const E=equityChanges(from,to);
    body=`<thead><tr><th>Account</th><th class="num">Opening</th><th class="num">Net profit</th><th class="num">Other changes</th><th class="num">Closing</th></tr></thead><tbody>${E.rows.map(x=>`<tr class="click" data-h="${ledgerHref(x.k)}"><td>${esc(x.name)}</td><td class="num">${fmt(x.o)}</td><td class="num">${x.p?fmt(x.p):''}</td><td class="num">${x.m?fmt(x.m):''}</td><td class="num">${fmt(x.c)}</td></tr>`).join('')}
      <tr class="tot"><td>Total equity</td><td class="num">${fmt(E.t.o)}</td><td class="num">${fmt(E.t.p)}</td><td class="num">${fmt(E.t.m)}</td><td class="num">${fmt(E.t.c)}</td></tr></tbody>`}
  else if(a==='bs-compare'){const d2=addDays(to,-365).slice(0,4)+to.slice(4),A=bsLines(to),B=bsLines(d2);sub=`${fmtD(to)} · ${fmtD(d2)}`;
    const keys=[...new Set(A.rows.concat(B.rows).map(x=>x.k))];const val=(S_,k)=>(S_.rows.find(x=>x.k===k)||{}).v||0;
    const part=g=>keys.filter(k=>(A.rows.concat(B.rows).find(x=>x.k===k)||{}).g===g).map(k=>`<tr class="click" data-h="${ledgerHref(k)}"><td>${esc(k==='acc:re'?'Retained earnings':keyName(k))}</td><td class="num">${fmt(val(A,k))}</td><td class="num">${fmt(val(B,k))}</td><td class="num">${fmt(val(A,k)-val(B,k))}</td></tr>`).join('');
    const tot=(l,g)=>`<tr class="tot"><td>${l}</td><td class="num">${fmt(A.t[g])}</td><td class="num">${fmt(B.t[g])}</td><td class="num">${fmt(A.t[g]-B.t[g])}</td></tr>`;
    body=`<thead><tr><th>Account</th><th class="num">${fmtD(to)}</th><th class="num">${fmtD(d2)}</th><th class="num">Change</th></tr></thead><tbody><tr><td colspan="4" class="sec">Assets</td></tr>${part('asset')}${tot('Total assets','asset')}<tr><td colspan="4" class="sec">Liabilities</td></tr>${part('liability')}${tot('Total liabilities','liability')}<tr><td colspan="4" class="sec">Equity</td></tr>${part('equity')}${tot('Total equity','equity')}</tbody>`}
  else if(a==='pl-compare'){const f2=addDays(from,-365).slice(0,4)+from.slice(4),t2=addDays(to,-365).slice(0,4)+to.slice(4),m1=sums(from,to),m2=sums(f2,t2);sub=`${fmtD(from)} – ${fmtD(to)} · ${fmtD(f2)} – ${fmtD(t2)}`;
    const used=g=>accounts().filter(x=>x.group===g&&(r2(m1['acc:'+x.id]||0)||r2(m2['acc:'+x.id]||0)));const s=g=>g==='income'?-1:1;
    const tg=(m,g)=>accounts().filter(x=>x.group===g).reduce((q,x)=>q+s(g)*(m['acc:'+x.id]||0),0);
    const rows=g=>used(g).map(x=>{const v1=s(g)*(m1['acc:'+x.id]||0),v2=s(g)*(m2['acc:'+x.id]||0);return `<tr class="click" data-h="${ledgerHref('acc:'+x.id)}"><td>${esc(x.name)}</td><td class="num">${fmt(v1)}</td><td class="num">${fmt(v2)}</td><td class="num">${fmt(v1-v2)}</td></tr>`}).join('');
    const I1=tg(m1,'income'),I2=tg(m2,'income'),X1=tg(m1,'expense'),X2=tg(m2,'expense');
    body=`<thead><tr><th>Account</th><th class="num">This period</th><th class="num">Last year</th><th class="num">Change</th></tr></thead><tbody><tr><td colspan="4" class="sec">Income</td></tr>${rows('income')}<tr class="tot"><td>Total income</td><td class="num">${fmt(I1)}</td><td class="num">${fmt(I2)}</td><td class="num">${fmt(I1-I2)}</td></tr>
      <tr><td colspan="4" class="sec">Expenses</td></tr>${rows('expense')}<tr class="tot"><td>Total expenses</td><td class="num">${fmt(X1)}</td><td class="num">${fmt(X2)}</td><td class="num">${fmt(X1-X2)}</td></tr><tr class="tot"><td>Net profit</td><td class="num">${fmt(I1-X1)}</td><td class="num">${fmt(I2-X2)}</td><td class="num">${fmt(I1-X1-(I2-X2))}</td></tr></tbody>`}
  else if(a==='sales-customer'){sub=`${fmtD(from)} – ${fmtD(to)}`;const S_=salesByCustomer(from,to),T={s:0,r:0,n:0,c:0};
    body=`<thead><tr><th>Customer</th><th class="num">Sales</th><th class="num">Returns</th><th class="num">Net sales</th><th class="num">Received</th></tr></thead><tbody>${S_.map(x=>{T.s+=x.s;T.r+=x.r;T.n+=x.s-x.r;T.c+=x.c;return `<tr class="click" data-h="${ledgerHref('ar:'+x.id)}"><td>${esc(x.name)}</td><td class="num">${fmt(x.s)}</td><td class="num">${x.r?fmt(x.r):''}</td><td class="num">${fmt(x.s-x.r)}</td><td class="num">${fmt(x.c)}</td></tr>`}).join('')||'<tr><td colspan="5" class="empty">No sales in this period</td></tr>'}
      <tr class="tot"><td>Total</td><td class="num">${fmt(T.s)}</td><td class="num">${fmt(T.r)}</td><td class="num">${fmt(T.n)}</td><td class="num">${fmt(T.c)}</td></tr></tbody><caption class="muted small" style="caption-side:bottom;text-align:start;padding:10px 12px"><span>Amounts in</span> ${esc(BASE())}. <span>Sales include sales invoices and tickets; returns are credit notes and ticket refunds.</span></caption>`}
  else if(a==='rp-summary'){sub=`${fmtD(from)} – ${fmtD(to)}`;const m={};let R_=0,P_=0;
    [['receipt',1],['payment',-1]].forEach(([t,s])=>L(t).filter(x=>x.date>=from&&x.date<=to).forEach(x=>(x.lines||[]).forEach(l=>{if(!l.account)return;const v=r2(l.amount*docRate(x));const e=m[l.account]=m[l.account]||{r:0,p:0};if(s>0){e.r+=v;R_+=v}else{e.p+=v;P_+=v}})));
    const keys=Object.keys(m).sort((x,y)=>keyName(x).localeCompare(keyName(y)));
    body=`<thead><tr><th>Account</th><th class="num">Received</th><th class="num">Paid</th><th class="num">Net</th></tr></thead><tbody>${keys.map(k=>`<tr class="click" data-h="${ledgerHref(k)}"><td>${esc(keyName(k))}</td><td class="num">${m[k].r?fmt(m[k].r):''}</td><td class="num">${m[k].p?fmt(m[k].p):''}</td><td class="num">${fmt(m[k].r-m[k].p)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">No receipts or payments in this period</td></tr>'}
      <tr class="tot"><td>Total</td><td class="num">${fmt(R_)}</td><td class="num">${fmt(P_)}</td><td class="num">${fmt(R_-P_)}</td></tr></tbody>`}
  else if(a==='supplier-statements'){sub=`as at ${fmtD(today())}`;const st=Object.values(invoiceStatus('purchase')).filter(s=>s.due>0.004),fxb=fxSums(null),bs=sums(null,null);
    const rows=[...L('supplier')].sort((x,y)=>x.name.localeCompare(y.name)).map(c=>{const cu=recCur(c),bal=-r2(cu?fxb['ap:'+c.id]||0:bs['ap:'+c.id]||0),mine=st.filter(s=>s.party===c.id);if(!bal&&!mine.length)return'';const over=mine.filter(s=>s.cls==='overdue').reduce((q,s)=>q+s.due,0);
      return `<tr class="click" data-h="#/reports/sstatement/${c.id}"><td>${esc(c.name)}${c.kind==='airline'?' <span class="tag">Airline</span>':c.kind==='saraf'?' <span class="tag">Partner saraf</span>':''}</td><td class="num">${mine.length||''}</td><td class="num">${over?`<span class="neg">${fmt(over)}</span>`:''}</td><td class="num">${bal<0?`<span class="muted">${money(bal,cu)}</span>`:money(bal,cu)}</td><td class="noprint"><a href="#/reports/sstatement/${c.id}">View statement</a></td></tr>`}).join('');
    body=`<thead><tr><th>Supplier</th><th class="num">Unpaid invoices</th><th class="num">Overdue</th><th class="num">We owe</th><th class="noprint"></th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="empty">Nothing outstanding</td></tr>'}</tbody><caption class="muted small" style="caption-side:bottom;text-align:start;padding:10px 12px">A minus amount means we paid in advance or have a deposit with them.</caption>`}
  else if(a==='statements'){sub=`as at ${fmtD(today())}`;const st=Object.values(invoiceStatus('sales')).filter(s=>s.due>0.004),fxb=fxSums(null),bs=sums(null,null);
    const rows=[...L('customer')].sort((x,y)=>x.name.localeCompare(y.name)).map(c=>{const cu=recCur(c),bal=r2(cu?fxb['ar:'+c.id]||0:bs['ar:'+c.id]||0),mine=st.filter(s=>s.party===c.id);if(!bal&&!mine.length)return'';const over=mine.filter(s=>s.cls==='overdue').reduce((q,s)=>q+s.due,0);
      return `<tr class="click" data-h="#/reports/statement/${c.id}"><td>${esc(c.name)}${c.kind==='agent'?' <span class="tag">Sub-agent</span>':''}</td><td class="num">${mine.length||''}</td><td class="num">${over?`<span class="neg">${fmt(over)}</span>`:''}</td><td class="num">${bal<0?`<span class="muted">${money(bal,cu)}</span>`:money(bal,cu)}</td><td class="noprint"><a href="#/reports/statement/${c.id}">View statement</a></td></tr>`}).join('');
    body=`<thead><tr><th>Customer</th><th class="num">Unpaid invoices</th><th class="num">Overdue</th><th class="num">Balance</th><th class="noprint"></th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="empty">Nothing outstanding</td></tr>'}</tbody><caption class="muted small" style="caption-side:bottom;text-align:start;padding:10px 12px">A minus balance means the customer has paid in advance (credit).</caption>`}
  V.innerHTML=`<div class="head"><div><a href="#/reports" class="small noprint">← Reports</a><h1>${title} <span class="muted small" style="font-family:var(--body);font-weight:400">${sub}</span></h1></div><div class="tools">${['trial','gl','pl-month','tax','project','cashflow','equity','pl-compare','sales-customer','rp-summary'].includes(a)?periodBar():a==='bs-compare'?periodBar():''}${IN_FRAME?'':'<button class="btn noprint" type="button" id="prt">Print / PDF</button>'}</div></div><div class="card scroll"><table>${body}</table></div>`;
  bindPeriod();$$('tr.click').forEach(tr=>tr.onclick=()=>go(tr.dataset.h));const pr=$('#prt');if(pr){pr.onclick=()=>window.print();if(!$('#csvRep')){pr.insertAdjacentHTML('afterend','<button class="btn noprint" type="button" id="csvRep">Export</button>');$('#csvRep').onclick=()=>exportCsv($('#view'),(location.hash.split('/')[2]||'report'))}}
}

/* ---------- router ---------- */
const VIEWS={summary:vSummary,reports:vReports,ledger:vLedger,bank:vBank,receipt:vRP,payment:vRP,transfer:vTransfer,customer:vParty,supplier:vParty,
  quote:vDoc,salesorder:vDoc,salesinvoice:vDoc,recurringinvoice:vDoc,creditnote:vDoc,purchaseorder:vDoc,purchaseinvoice:vDoc,debitnote:vDoc,item:vItem,
  deliverynote:vDelivery,goodsreceipt:vDelivery,writeoff:vWriteoff,project:vProject,currency:vCurrency,history:vHistory,employee:vEmployee,payslip:vPayslip,expenseclaim:vExpenseClaim,
  fixedasset:vFixedAsset,depreciation:vDepreciation,journal:vJournal,account:vAccount,taxcode:vTaxcode,settings:vSettings,users:vUsers,businesses:vBusinesses,admin:vAdmin,profile:vProfile,support:vSupport,payments:vPayments,ticket:vTicket,travel:vTravel,customize:vCustomize,sarafi:vSarafi,billing:vBilling,exchange:vExchange,hawala:vHawala,fxrate:vFxrate,cashcount:vCashcount};
let routing=false;
async function router(opt={}){
  if(CLOUD&&API.user&&App.billing===undefined){App.billing=null;API.billingCfg().then(c=>{App.billing=c;if(c&&c.is_admin)router({keepScroll:true})}).catch(()=>{})}
  const h=location.hash.replace(/^#\/?/,'');
  if(/access_token=|error_description=|type=recovery/.test(h))return;
  let [r,a,idRaw]=h.split('/');r=r||'summary';const id=idRaw?decodeURIComponent(idRaw):'';
  if(r==='share'&&a)return vShared(a);
  if($('#authView').classList.contains('sharedwrap')){$('#authView').className='';$('#authView').innerHTML='';closeBusiness();router.tried=false}
  if(App.page)return vPublic(App.page);
  if(!EXCHANGE_ON&&EXCHANGE_TABS.includes(r)){history.replaceState(null,'','#/summary');r='summary';a=undefined}
  if(['home','privacy','terms'].includes(r))return vPublic(r);
  if(CLOUD&&!API.user&&!App.ws&&!h)return vPublic('home');
  if(App.ws&&App.ws.missing)return authView('wsmissing');
  if(CLOUD&&!API.user)return authView(['signup','forgot'].includes(r)?r:'login');
  if(CLOUD&&r!=='reset'&&!App.recovery&&await API.needMfa().catch(()=>false))return authView('mfa');
  if(r==='reset'||App.recovery)return authView('reset');
  if(['login','signup','forgot'].includes(r))r='businesses';
  if(App.ws&&!App.ws.missing&&!S.biz&&!['admin','profile','support','payments'].includes(r)){
    if(!router.wsP)router.wsP=(async()=>{let list=[];try{list=await API.listBusinesses()}catch(e){}const b=list.find(x=>x.slug===App.ws.slug);return b&&(b.member||API.isSuper())?b:null})();
    const wb=await router.wsP;
    if(!wb)return authView('noaccess');
    if(!router.wsOpened&&!S.biz){router.wsOpened=true;router.tried=true;await openBusiness(wb);if(r==='businesses')history.replaceState(null,'','#/summary');return router(opt)}
  }
  if(!S.biz&&!['businesses','admin','profile','support','payments'].includes(r)){
    const last=ls.get('falak_last');
    if(last&&!router.tried){router.tried=true;try{const list=await API.listBusinesses();const b=list.find(x=>x.id===last);if(b){await openBusiness(b);return router()}}catch(e){}}
    r='businesses';
  }
  if(S.biz&&!canSee(r)&&!['businesses','admin','profile','support','payments'].includes(r)){const first=RECORD_TABS.find(t=>canSee(t));r=first||'businesses';a=undefined}
  $('#side').classList.remove('open');
  renderShell(r);
  const V=$('#view'),y=window.scrollY;
  try{await (VIEWS[r]||vSummary)(V,r,a,id)}catch(e){console.error(e);V.innerHTML=`<div class="note">Something went wrong: ${esc(e.message)}</div>`}
  if(opt.keepScroll)window.scrollTo(0,y);else if(!opt.noScroll)window.scrollTo(0,0);
}

/* ---------- boot ---------- */
/* ---------- auto sign-out after 60 minutes without activity (shared office computers) ---------- */
const IDLE_MIN=60;let lastAct=Date.now();
['mousedown','keydown','touchstart','scroll'].forEach(ev=>document.addEventListener(ev,()=>{lastAct=Date.now()},{passive:true}));
setInterval(async()=>{if(CLOUD&&API.user&&Date.now()-lastAct>IDLE_MIN*60000){lastAct=Date.now();try{await API.signOut()}catch(e){}toast(lookupOr('You were signed out after 60 minutes without activity.'))}},60000);

(async function boot(){
  $('#menuBtn').onclick=()=>$('#side').classList.toggle('open');
  window.addEventListener('hashchange',()=>router());
  App.period={from:today().slice(0,4)+'-01-01',to:today()};applyLang();
  {const pre=$('#authView.pre');if(pre&&document.documentElement.classList.contains('nopre')){pre.innerHTML='';pre.classList.remove('pre')}}  // built-in home copy not needed here
  try{await API.init()}catch(e){document.body.innerHTML=`<div class="loading">Falak Hesab could not connect to its database. Check your internet connection and the settings in config.js.<br><small>${esc(e.message)}</small></div>`;return}
  const ps=pathSlug();
  if(['privacy','terms'].includes(ps))App.page=ps;
  else if(ps){try{App.ws=(await API.workspace(ps))||{slug:ps,missing:true}}catch(e){console.warn('Company address lookup failed:',e.message);App.ws=null}
    if(App.ws&&!App.ws.missing)document.title=App.ws.name+' · Falak Hesab'}
  if(PUBLIC_DEMO)await demoSetup();
  else if(!CLOUD&&!Demo.d.businesses.length){const b=await API.createBusiness('Example Travel & Trading (sample)',{currency:'USD',startDate:today().slice(0,4)+'-01-01',address:'Sample business to explore Falak Hesab.\nDelete it any time from Settings.'});await API.insertMany(b.id,seedRows(true));ls.set('falak_last',b.id)}
  await router();
  chatInit();
  if(PUBLIC_DEMO){if(App.demoChoose)demoChooser();else if(App.tourAuto){let seen=false;try{seen=!!sessionStorage.getItem('falak_tour_'+App.tourAuto)}catch(e){}if(!seen)setTimeout(()=>tourStart(App.tourAuto),600)}}
})();
