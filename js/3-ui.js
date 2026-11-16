/* ================= Falak Hesab — UI building blocks, shell, auth, businesses ================= */
const go=h=>{if(location.hash===h)router();else location.hash=h};
const fld=(label,inner,cls='')=>`<label class="f ${cls}">${label}${inner}</label>`;
const inp=(id,v,attrs='')=>`<input id="${id}" value="${esc(v??'')}" ${attrs}>`;
const val=id=>{const e=document.getElementById(id);return e?String(e.value).trim():''};
const optList=(list,sel,blank)=>(blank!==undefined?`<option value="">${esc(blank)}</option>`:'')+list.map(x=>`<option value="${x.id}" ${sel===x.id?'selected':''}>${x.code?esc(x.code)+' – ':''}${esc(nm(x))}</option>`).join('');

function acctOptions(sel,o={}){
  const {banks=false,sub=false,inv=false,blank='Select account…',groups}=o;
  let h=`<option value="">${esc(blank)}</option>`;
  const grp=(label,list,pre)=>!list.length?'':`<optgroup label="${esc(label)}">`+list.map(x=>{const v=pre+x.id;return `<option value="${v}" ${sel===v?'selected':''}>${x.code?esc(x.code)+' – ':''}${esc(nm(x))}</option>`}).join('')+'</optgroup>';
  if(banks)h+=grp('Bank and cash accounts',L('bank'),'bank:');
  if(sub){h+=grp('Accounts receivable',[...L('customer')].sort(byCode),'ar:');h+=grp('Accounts payable',[...L('supplier')].sort(byCode),'ap:');
    h+=grp('Employee clearing accounts',[...L('employee')].sort(byCode),'emp:');h+=grp('Fixed assets, at cost',[...L('fixedasset')].sort(byCode),'fa:');h+=grp('Tax payable',L('taxcode'),'tax:')}
  if(inv)h+=grp('Inventory on hand',[...L('item')].filter(i=>i.track).sort(byCode),'inv:');
  Object.keys(GROUPS).filter(g=>!groups||groups.includes(g)).forEach(g=>h+=grp(GROUPS[g],accounts().filter(a=>a.group===g),'acc:'));
  if(sel&&!h.includes(`value="${sel}"`))h+=`<option value="${esc(sel)}" selected>${esc(keyName(sel))}</option>`;
  return h;
}
const curOptions=sel=>`<option value="">${esc(BASE())} (base currency)</option>`+L('currency').map(c=>`<option value="${esc(c.code)}" ${sel===c.code?'selected':''}>${esc(c.code)} – ${esc(c.name||'')}</option>`).join('');
const projectCol=()=>L('project').length?[{k:'project',h:'Project',t:'select',w:'130px',ignoreEmpty:true,opts:v=>optList([...L('project')].sort(byCode),v,'—')}]:[];
const projectField=v=>L('project').length?fld('Project',`<select id="fProject">${optList([...L('project')].sort(byCode),v,'—')}</select>`):'';
const taxOptions=sel=>`<option value="">No tax</option>`+L('taxcode').map(t=>`<option value="${t.id}" ${sel===t.id?'selected':''}>${esc(t.name)}</option>`).join('');

/* ---------- line editor ---------- */
function LineEditor(el,cols,lines,o={}){
  const min=o.min||1;
  el.innerHTML=`<div class="lines scroll"><table><thead><tr>${cols.map(c=>`<th class="${c.t==='num'||c.calc?'num':''}" ${c.w?`style="width:${c.w}"`:''}>${c.h}</th>`).join('')}<th style="width:34px"></th></tr></thead><tbody></tbody><tfoot><tr><td colspan="${cols.length+1}" style="border:0"><button type="button" class="btn ghost sm addl">+ Add line</button></td></tr></tfoot></table></div>`;
  const tb=el.querySelector('tbody');
  const cell=(c,l)=>{const v=l[c.k]??'';
    if(c.calc)return `<td class="num calc" data-c="${c.k}"></td>`;
    if(c.t==='select')return `<td><select data-k="${c.k}" aria-label="${esc(c.h)}">${c.opts(v,l)}</select></td>`;
    if(c.t==='num')return `<td><input data-k="${c.k}" class="num" type="number" step="any" value="${esc(v)}" aria-label="${esc(c.h)}" ${c.ph?`placeholder="${c.ph}"`:''}></td>`;
    return `<td><input data-k="${c.k}" value="${esc(v)}" aria-label="${esc(c.h)}"></td>`};
  const readRow=tr=>{const r={};$$('[data-k]',tr).forEach(i=>r[i.dataset.k]=i.value);return r};
  const refresh=()=>{[...tb.rows].forEach(tr=>{const l=readRow(tr);cols.filter(c=>c.calc).forEach(c=>tr.querySelector(`[data-c="${c.k}"]`).textContent=fmt(c.calc(l)))});o.onChange&&o.onChange(api.read())};
  const add=l=>{tb.insertAdjacentHTML('beforeend',`<tr>${cols.map(c=>cell(c,l)).join('')}<td><button type="button" class="x" aria-label="Remove line">×</button></td></tr>`);const tr=tb.lastElementChild;cols.forEach(c=>c.init&&c.init(tr,l))};
  (lines&&lines.length?lines:[{}]).forEach(add);while(tb.rows.length<min)add({});
  el.querySelector('.addl').onclick=()=>{add({});refresh()};
  tb.addEventListener('input',refresh);
  tb.addEventListener('change',e=>{const k=e.target.dataset.k,c=cols.find(c=>c.k===k);if(c&&c.on)c.on(e.target.closest('tr'),e.target.value);refresh()});
  tb.addEventListener('click',e=>{if(e.target.classList.contains('x')){if(tb.rows.length>min)e.target.closest('tr').remove();else $$('input',e.target.closest('tr')).forEach(i=>i.value='');refresh()}});
  const api={read:()=>[...tb.rows].map(readRow).filter(r=>Object.entries(r).some(([k,v])=>v!==''&&!(cols.find(c=>c.k===k)||{}).ignoreEmpty)).map(r=>{cols.forEach(c=>{if(c.t==='num')r[c.k]=r[c.k]===''?'':+r[c.k]});return r}),refresh};
  refresh();return api;
}

/* ---------- generic form page ---------- */
function formPage(V,o){
  const {title,type,isNew,rec,body,read,deleteCheck,extraBtns='',onRender,back}=o;
  const ro=!canWrite(type)||(!isNew&&rec&&locked(rec.date));ATT_QUEUE=[];const hasAtt=!NO_ATT.includes(type);
  V.innerHTML=`<div class="head"><div><a href="${back||'#/'+type}" class="noprint small">← ${esc(TITLES[type]||'Back')}</a><h1>${title}</h1></div></div>
  <form class="card pad" id="f" novalidate>${body}${cfInputs(type,rec)}
   <div class="actions noprint"><div>${ro?'':`<button class="btn primary" type="submit" id="saveBtn">${isNew?'Create':'Update'}</button>`}<a class="btn" href="${back||'#/'+type}">${ro?'Back':'Cancel'}</a>${extraBtns}</div>${!isNew&&!ro?'<div><button class="btn danger" type="button" id="del">Delete</button></div>':''}</div>
   ${ro?'<div class="meta">You can view this record but not change it.</div>':''}
   ${rec&&rec._u?`<div class="meta">Last changed ${fmtDT(rec._u)}${rec._by?' by '+esc(rec._by):''}${canAdmin()?` · <a href="#/history/record/${rec.id}">History</a>`:''}</div>`:''}
   ${!isNew&&rec&&locked(rec.date)?'<div class="meta neg">This transaction is on or before the lock date and cannot be changed.</div>':''}</form>${hasAtt?attachCardHtml():''}`;
  if(onRender)onRender();
  if(hasAtt)attachMount(type,isNew?null:rec&&rec.id);
  if(ro)$$('#f input,#f select,#f textarea,#f .lines button').forEach(x=>x.disabled=true);
  $('#f').onsubmit=async e=>{e.preventDefault();if(ro)return;let obj;try{obj=read()}catch(err){toast(err.message);return}if(!obj)return;{const cf=cfRead(type,isNew?null:rec);if(cf)obj.cf=cf;else delete obj.cf}if(obj.date&&locked(obj.date)){toast(`Books are locked up to ${fmtD(setting('lockDate'))}. Choose a later date or change the lock date in Settings.`);return}
    const b=$('#saveBtn');b.disabled=true;
    try{const row=await saveRec(type,Object.assign(isNew?{}:{id:rec.id,_u:rec._u},obj),isNew);if(ATT_QUEUE.length){b.textContent=lookupOr('Uploading…');await attachFlushQueue(row.id)}toast(isNew?'Created':'Updated');go(typeof o.after==='function'?o.after(row):(o.after||back||'#/'+type))}catch(err){}finally{b.disabled=false}};
  const d=$('#del');if(d)d.onclick=()=>{const why=deleteCheck&&deleteCheck();if(why){toast(why);return}confirmBox('Delete this record? This cannot be undone.',async()=>{try{await deleteRec(rec.id);toast('Deleted');go(back||'#/'+type)}catch(e){}})};
}
const need=(cond,msg)=>{if(!cond)throw new Error(msg)};

/* ---------- generic list page ---------- */
function listPage(V,o){
  const {title,type,rows,newLabel,onRow,tools=''}=o;const cols=o.cols.concat(cfListCols(type));
  const totals=cols.some(c=>c.sum);
  V.innerHTML=`<div class="head"><h1>${title}</h1><div class="tools noprint">${tools}<input class="search" id="q" type="search" placeholder="Search…" aria-label="Search"><button class="btn" type="button" id="csvBtn" title="Download this list for Excel">Export</button>${newLabel&&canWrite(type)?`<a class="btn primary" href="#/${type}/new">+ ${newLabel}</a>`:''}</div></div>
  <div class="card scroll"><table><thead><tr>${cols.map(c=>`<th class="${c.num?'num':''}">${c.h}</th>`).join('')}</tr></thead><tbody>
  ${rows.map(r=>`<tr class="click" data-id="${r.id}">${cols.map(c=>`<td class="${c.num?'num':''} ${c.cls||''}">${c.f(r)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${cols.length}" class="empty">Nothing here yet${newLabel&&canWrite(type)?` — <a href="#/${type}/new">${newLabel.toLowerCase()}</a>`:''}</td></tr>`}
  ${totals&&rows.length?`<tr class="tot" id="totRow">${cols.map((c,i)=>`<td class="${c.num?'num':''}">${c.sum?fmt(rows.reduce((s,r)=>s+(+c.sum(r)||0),0)):(i===0?'Total':'')}</td>`).join('')}</tr>`:''}</tbody></table></div>`;
  $$('tbody tr.click').forEach(tr=>{tr.dataset.s=tr.textContent.toLowerCase();tr.onclick=e=>{if(e.target.closest('a'))return;onRow?onRow(tr.dataset.id):go(`#/${type}/edit/${tr.dataset.id}`)}});
  $('#csvBtn').onclick=()=>exportCsv($('#view .card.scroll'),type||title);
  $('#q').oninput=()=>{const s=$('#q').value.toLowerCase();$$('tbody tr.click').forEach(tr=>tr.hidden=!!s&&!tr.dataset.s.includes(s));const t=$('#totRow');if(t)t.hidden=!!s};
}

/* ---------- navigation ---------- */
const NAV=[
  ['Overview',[['summary','Summary'],['reports','Reports']]],
  ['Travel',[['travel','Travel overview'],['ticket','Tickets']]],
  ...(EXCHANGE_ON?[['Exchange & Transfers',[['sarafi','Overview'],['exchange','Currency Exchange'],['hawala','Hawala Transfers'],['fxrate','Daily Rates'],['cashcount','Cash Counts']]]]:[]),
  ['Money',[['bank','Bank & Cash Accounts'],['receipt','Receipts'],['payment','Payments'],['transfer','Inter Account Transfers']]],
  ['Sales',[['customer','Customers'],['quote','Sales Quotes'],['salesorder','Sales Orders'],['salesinvoice','Sales Invoices'],['recurringinvoice','Recurring Invoices'],['creditnote','Credit Notes'],['deliverynote','Delivery Notes']]],
  ['Purchases',[['supplier','Suppliers'],['purchaseorder','Purchase Orders'],['purchaseinvoice','Purchase Invoices'],['debitnote','Debit Notes'],['goodsreceipt','Goods Receipts']]],
  ['Inventory',[['item','Inventory Items'],['writeoff','Inventory Write-offs']]],
  ['Payroll',[['employee','Employees'],['payslip','Payslips'],['expenseclaim','Expense Claims']]],
  ['Assets',[['fixedasset','Fixed Assets'],['depreciation','Depreciation Entries']]],
  ['Accounting',[['journal','Journal Entries'],['project','Projects'],['account','Chart of Accounts'],['taxcode','Tax Codes'],['currency','Currencies']]],
  ['Business',[['settings','Settings'],['users','Users & Access'],['billing','Plan & billing'],['history','History']]]
];
const TITLES=Object.fromEntries(NAV.flatMap(g=>g[1]));
const RECORD_TABS=NAV.flatMap(g=>g[1]).map(x=>x[0]).filter(k=>!['settings','users','history','billing'].includes(k));
const ROLE_LABEL={owner:'Owner',admin:'Administrator',user:'Limited user',viewer:'View only'};

function renderShell(route){
  $('#authView').hidden=true;{const av=$('#authView');if(av.classList.contains('pre')){av.innerHTML='';av.classList.remove('pre')}}$('#appView').hidden=false;
  const b=S.biz;
  $('#nav').innerHTML=b?NAV.map(([g,items])=>{const vis=items.filter(([k])=>tabShown(k)&&((k==='users'||k==='history'||k==='billing')?canAdmin()&&(k!=='billing'||!!S.plan):canSee(k)));if(!vis.length)return'';
    return `<div class="navgroup">${g}</div>`+vis.map(([k,l])=>{const n=GROUPS&&!['summary','reports','settings','users','history','billing','travel','sarafi'].includes(k)?L(k).length:null;return `<a href="#/${k}" class="${route===k?'on':''}">${l}${n!=null?`<span class="n">${n}</span>`:''}</a>`}).join('')}).join('')+(canAdmin()?`<a href="#/customize" class="custom ${route==='customize'?'on':''}">Customize</a>`:''):
    `<div class="navgroup">Start</div><a href="#/businesses" class="${route==='businesses'?'on':''}">Businesses</a>`;
  $('#bizName').innerHTML=b?`${esc(b.name)}<small>${esc(setting('currency')||'')} · ${ROLE_LABEL[S.role]||''}</small>`:'Falak Hesab<small>Choose or create a business</small>';
  $('#who').textContent=API.user?API.user.email:'';
  $('#sideFoot').innerHTML=(API.isSuper()&&CLOUD?'<a href="#/admin">Admin: all users & businesses</a>':'')+(CLOUD&&App.billing&&App.billing.is_admin?'<a href="#/payments" class="'+(route==='payments'?'on':'')+'">Payment approvals</a>':'')+'<a href="#/support" class="'+(route==='support'?'on':'')+'">Help & Support</a>'+(CLOUD?'<a href="#/profile">My account</a><a href="#" id="signOut">Sign out</a>':'<span>Demo mode — data stays in this browser.</span>')+'<span>Falak Hesab · online accounting</span>'+langPicker('langSide');
  bindLangPicker('langSide');const so=$('#signOut');if(so)so.onclick=async e=>{e.preventDefault();await API.signOut()};
  const bn=$('#banner');bn.hidden=CLOUD;bn.classList.remove('planban','planend');if(CLOUD)bn.innerHTML='';
  const pm=CLOUD&&b?planBanner():'';if(pm){bn.hidden=false;bn.classList.add('planban');if(S.plan.state==='expired')bn.classList.add('planend');bn.innerHTML=pm}
  if(!CLOUD&&PUBLIC_DEMO){bn.innerHTML='<b>Demo with sample data.</b> <span>Everything stays in this browser. Nothing is sent or saved online.</span> <a href="'+siteRoot()+'/#/signup">Create your account</a> · '+(demoKind()?'<button type="button" class="linkbtn" id="tourBtn">Take the tour</button> · ':'')+'<a href="#" id="demoReset">Start over</a>';
    const tb=$('#tourBtn');if(tb)tb.onclick=()=>tourStart()
    const dr=$('#demoReset');if(dr)dr.onclick=e=>{e.preventDefault();try{localStorage.removeItem(Demo.KEY);localStorage.removeItem('falak_last')}catch(x){}location.reload()}}
  else if(!CLOUD)bn.innerHTML='<b>Demo mode.</b> Nothing is shared and there are no logins yet. When Falak Hesab is connected to its online database, each person signs in with their own email and password and everyone works on the same books at the same time.';
  const on=$('#online');on.hidden=!(CLOUD&&b&&S.online.length);on.innerHTML=`<i></i>${S.online.length} online`;on.title=S.online.join('\n');
}

/* ---------- plan banner (trial days left, plan ended, renew soon) ---------- */
function planBanner(){const p=S.plan;if(!p||p.super&&p.complimentary)return'';const ad=canAdmin(),link=t=>ad?` <a href="#/billing">${t}</a>`:'';
  if(p.state==='expired')return `<b>Your plan has ended.</b> <span>The books are read-only. Nothing is deleted.</span>${ad?link('Choose a plan'):' <span>Ask the owner to choose a plan.</span>'}`;
  if(p.state==='trial'){const n=daysLeft(p.trial_ends);return `<b>Free trial</b> · <span>${n===1?'1 day left':n+' days left'}</span>${link('See plans')}`}
  if(p.paid_until&&!p.complimentary){const n=daysLeft(p.paid_until+'T23:59:59');if(n<=7)return `<b>Your plan ends on ${fmtD(p.paid_until)}.</b>${link('Renew')}`}
  return''}

/* ---------- auth screens ---------- */
const legalHref=k=>location.protocol==='file:'?'#/'+k:siteRoot()+'/'+k;
const strongPw=pw=>String(pw).length>=8&&/[A-Za-z\u0600-\u06FF]/.test(pw)&&/\d/.test(pw);
function authView(mode){
  $('#appView').hidden=true;const A=$('#authView');A.hidden=false;A.className='';
  const W=App.ws&&!App.ws.missing?App.ws:null,wl=W&&safeImg(W.logo);
  const pre=(/^#\/signup\/(free|basic|pro)/.exec(location.hash)||[])[1]||'pro';
  const head=W?`<div class="brand wsbrand">${wl?`<img class="wslogo" src="${wl}" alt="">`:`<span class="wsinit">${esc((W.name||'?').trim().charAt(0).toUpperCase())}</span>`}<b class="wsname">${esc(W.name)}</b><span class="wsaddr mono">${esc(wsUrl(W.slug))}</span></div>`
    :`<div class="brand"><span class="lg"><span class="mark"><img src="logo-mark.png" alt="" width="240" height="179"></span><span>Falak Hesab<small>Online accounting</small></span></span></div>`;
  const home=siteRoot()+'/';
  const forms={
    login:`<h1>Sign in</h1><form id="af"><label class="f">Email<input id="aEmail" type="email" autocomplete="email" required></label><label class="f">Password<input id="aPw" type="password" autocomplete="current-password" required></label><div class="err" id="aErr"></div><button class="btn primary" type="submit">Sign in</button></form><div class="links"><a href="#/signup">Create an account</a><a href="#/forgot">Forgot password?</a></div>`,
    signup:`<h1>Create your account</h1>${W?'':`<div class="muted small" style="margin:-4px 0 8px">Choose a plan. No card needed.</div><div class="planpick" id="planPick">${['free','basic','pro'].map(k=>`<label class="pp"><input type="radio" name="sPlan" value="${k}" ${k===pre?'checked':''}><span class="ppb"><b>${PLAN_NAME[k]}</b><span class="ppp" data-pp="${k}"></span><span class="ppt">${k==='free'?'Free forever':'30-day free trial'}</span></span></label>`).join('')}</div><ul class="ppf" id="ppFeat"></ul>`}<form id="af"><label class="f">Email<input id="aEmail" type="email" autocomplete="email" required></label><label class="f">Password (at least 8 characters, letters and numbers)<input id="aPw" type="password" autocomplete="new-password" minlength="8" required></label><div class="err" id="aErr"></div><button class="btn primary" type="submit">Create account</button><p class="legalnote small" id="legalNote"><span>Please read before you create an account:</span> <a href="${legalHref('terms')}" target="_blank" rel="noopener">Terms of Service</a> <span aria-hidden="true">·</span> <a href="${legalHref('privacy')}" target="_blank" rel="noopener">Privacy Policy</a></p></form><p class="muted small">Employees: use the same email your manager added in Falak Hesab, so you see their business after you sign in.</p><div class="links"><a href="#/login">I already have an account</a></div>`,
    forgot:`<h1>Reset password</h1><form id="af"><label class="f">Email<input id="aEmail" type="email" required></label><div class="err" id="aErr"></div><button class="btn primary" type="submit">Send reset link</button></form><div class="links"><a href="#/login">Back to sign in</a></div>`,
    mfa:`<h1>Two-step login</h1><p class="muted" style="margin-top:0">Open your authenticator app and type the 6-digit code for Falak Hesab.</p><form id="af"><label class="f">Code<input id="aCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required style="font-size:22px;letter-spacing:.3em;text-align:center"></label><div class="err" id="aErr"></div><button class="btn primary" type="submit">Verify</button></form><div class="links"><a href="#" id="aOut">Sign out</a></div>`,
    wsmissing:`<h1>Company not found</h1><p>There is no company at this address:</p><p><b class="mono">${esc(App.ws?wsUrl(App.ws.slug):'')}</b></p><p class="muted">Check the address with your manager. It may have been changed.</p><div class="links"><a href="${home}">Go to Falak Hesab</a></div>`,
    noaccess:`<h1>No access yet</h1><p class="muted" style="margin-bottom:4px">Signed in as</p><p style="margin-top:0"><b>${esc(API.user?API.user.email:'')}</b></p><p class="muted">Ask the owner of this company to add your email in Users & Access, then press Try again.</p><div class="actions" style="justify-content:flex-start"><div><button class="btn primary" type="button" id="aRetry">Try again</button><button class="btn" type="button" id="aOut2">Sign out</button></div></div><div class="links"><a href="${home}#/businesses">Open my other businesses</a></div>`,
    reset:`<h1>Choose a new password</h1><form id="af"><label class="f">New password<input id="aPw" type="password" minlength="8" autocomplete="new-password" required></label><div class="err" id="aErr"></div><button class="btn primary" type="submit">Save password</button></form>`
  };
  A.innerHTML=`<div class="authwrap authsky"><svg class="moon" viewBox="0 0 100 100" aria-hidden="true"><path d="M62 8a42 42 0 1 0 30 62A36 36 0 1 1 62 8z" fill="#d6a84a"/></svg><p class="tagline">${W?`<b>${esc(W.name)}</b><span>Accounting powered by Falak Hesab</span>`:`<b>Simple accounting for your business</b><span>Start free. In English, Dari, Pashto and Turkish.</span>`}</p><div class="card authcard">${head}${forms[mode]}<div style="margin-top:18px">${langPicker('langAuth')}</div>${W?'<p class="muted small wspow">Powered by <b>Falak Hesab</b></p>':''}${SUPPORT.wa||SUPPORT.email?`<p class="muted small authhelp"><span>Need help?</span> ${SUPPORT.wa?`<a href="${supportWa('Hello Falak Hesab support, I need help with signing in.')}" target="_blank" rel="noopener">WhatsApp</a>`:''}${SUPPORT.wa&&SUPPORT.email?' · ':''}${SUPPORT.email?`<a href="${supportMail('Falak Hesab – help with signing in')}">Email</a>`:''}</p>`:''}</div></div>`;bindLangPicker('langAuth');
  const err=m=>{$('#aErr').textContent=m};
  const ao=$('#aOut');if(ao)ao.onclick=async e=>{e.preventDefault();await API.signOut()};
  const ao2=$('#aOut2');if(ao2)ao2.onclick=async()=>{await API.signOut()};
  const ar=$('#aRetry');if(ar)ar.onclick=()=>{router.wsP=null;router()};
  const pp=$('#planPick');if(pp){let pl=DEFAULT_PLANS;const paint=()=>{const k=(pp.querySelector('input:checked')||{}).value||'pro';
      $$('[data-pp]').forEach(e=>{const x=pl[e.dataset.pp]||{};e.innerHTML=+x.usd?`<span class="num">$${fmtQ(+x.usd)}</span> <span>/ month</span>`:'<span class="num">$0</span>'});
      $('#ppFeat').innerHTML=planFeatures(k,pl).map(f=>`<li>${esc(f)}</li>`).join('');};
    pp.onchange=paint;paint();API.planConfig().then(c=>{pl=c.plans||pl;paint()}).catch(()=>{})}
  if(!$('#af'))return;
  $('#af').onsubmit=async e=>{e.preventDefault();const btn=$('#af button');btn.disabled=true;err('');
    try{const email=(val('aEmail')||'').toLowerCase(),pw=$('#aPw')?$('#aPw').value:'';
      if((mode==='signup'||mode==='reset')&&!strongPw(pw)){err(lookupOr('Use at least 8 characters with letters and numbers.'));return}
      if(mode==='mfa'){await API.mfaLogin(val('aCode'));go('#/businesses');router();return}
      if(mode==='login'){await API.signIn(email,pw);go('#/businesses')}
      else if(mode==='signup'){const plan=W?'free':((pp&&pp.querySelector('input:checked'))||{}).value||'pro';const d=await API.signUp(email,pw,plan);if(d&&d.session){go('#/businesses')}else{A.querySelector('.authcard').innerHTML=head+`<h1>Check your email</h1><p>We sent a confirmation link to <b>${esc(email)}</b>. Open it, then come back and sign in.</p><a class="btn primary" href="#/login">Go to sign in</a>`}}
      else if(mode==='forgot'){await API.resetPassword(email);A.querySelector('.authcard').innerHTML=head+`<h1>Check your email</h1><p>If an account exists for <b>${esc(email)}</b>, a reset link is on its way.</p><a class="btn" href="#/login">Back to sign in</a>`}
      else if(mode==='reset'){await API.updatePassword(pw);App.recovery=false;toast('Password changed');go('#/businesses')}
    }catch(x){err(x.message==='Invalid login credentials'?'Wrong email or password.':/totp|code|challenge/i.test(x.message)?'Wrong code. Type the newest 6-digit code from your app.':x.message)}finally{btn.disabled=false}};
  const f=$('#aEmail')||$('#aPw');if(f)f.focus();
}

/* ---------- opening a business ---------- */
let rerenderTimer=null,remoteNotice=0;
async function openBusiness(b){
  closeBusiness();
  S.biz=b;S.role=b.role;S.tabs=b.tabs||[];
  $('#view').innerHTML='<div class="loading">Loading books…</div>';
  const [rows,plan]=await Promise.all([API.loadRecords(b.id),API.planState(b.id).catch(()=>null)]);rows.forEach(r=>S.rows.set(r.id,r));S.plan=plan;S.ver++;
  const p=App.period||{};App.period={from:b.settings&&b.settings.startDate||today().slice(0,4)+'-01-01',to:today()};
  ls.set('falak_last',b.id);
  API.subscribe(b.id,(kind,row)=>{
    if(!S.biz)return;
    if(kind==='upsert'){if(row.business_id!==S.biz.id)return;const cur=S.rows.get(row.id);if(cur&&cur.updated_at&&new Date(cur.updated_at)>=new Date(row.updated_at))return;setRow(row);if(row.updated_by&&row.updated_by!==API.user.email&&Date.now()-remoteNotice>4000){remoteNotice=Date.now();toast(`${row.updated_by} saved a change`)}}
    else{if(!row||!S.rows.has(row.id))return;delRow(row.id)}
    const editing=/\/(new|edit)\b/.test(location.hash);
    if(!editing){clearTimeout(rerenderTimer);rerenderTimer=setTimeout(()=>router({keepScroll:true}),350)}
  },list=>{S.online=list;const on=$('#online');if(on){on.hidden=!list.length;on.innerHTML=`<i></i>${list.length} online`;on.title=list.join('\n')}});
}
async function reloadPlan(){if(S.biz){S.plan=await API.planState(S.biz.id).catch(()=>null);S.ver++}}
function closeBusiness(){API.unsubscribe();S.biz=null;S.role=null;S.tabs=[];S.plan=null;S.rows.clear();S.ver++;S.online=[]}
async function reloadBiz(){if(!S.biz)return;S.rows.clear();(await API.loadRecords(S.biz.id)).forEach(r=>S.rows.set(r.id,r));S.ver++;router()}

/* ---------- default chart + sample data for new businesses ---------- */
function seedRows(sample,o={}){
  const rows=[],A={},T={};
  const add=(type,data,id=newId())=>{rows.push({id,type,data});return id};
  [['Furniture & equipment','1500','asset'],['Prepayments','1400','asset'],['Loans payable','2200','liability'],['Other payables','2300','liability'],
   ["Owner's capital",'3000','equity'],["Owner's drawings",'3100','equity'],
   ['Sales','4000','income'],['Service income','4100','income'],['Commission income','4200','income'],['Other income','4900','income'],
   ['Purchases','5100','expense'],['Rent','6000','expense'],['Salaries & wages','6100','expense'],['Utilities','6200','expense'],['Telephone & internet','6300','expense'],['Office supplies','6400','expense'],
   ['Transport & travel','6500','expense'],['Advertising','6600','expense'],['Bank charges','6700','expense'],['Repairs & maintenance','6800','expense'],['Other expenses','6900','expense']
  ].forEach(([name,code,group])=>A[name]='acc:'+add('account',{name,code,group}));
  T.k20=add('taxcode',{name:'KDV 20%',rate:20});T.k10=add('taxcode',{name:'KDV 10%',rate:10});
  if(!sample)return rows;
  const y=today().slice(0,4),d=(m,dd)=>`${y}-${m}-${dd}`;
  const bank=add('bank',{name:'Main bank account',type:'bank',number:'TR00 0000 0000 0000',opening:8000});
  const cash=add('bank',{name:'Cash on hand',type:'cash',number:'',opening:600});
  const c1=add('customer',{name:'Noor Imports',code:'C001',email:'accounts@noor.example',phone:'',address:'Kabul, Afghanistan',terms:15});
  const c2=add('customer',{name:'Ahmad Karimi',code:'C002',email:'',phone:'',address:'Istanbul, Türkiye',terms:7});
  const s1=add('supplier',{name:'Office Depot (example)',code:'S001',email:'',phone:'',address:'Istanbul',terms:30});
  const s2=add('supplier',{name:'Paper Wholesale Ltd',code:'S002',email:'',phone:'',address:'Ankara',terms:30});
  const i1=add('item',{name:'A4 paper box',code:'P-A4',unit:'box',price:12,cost:8,track:true,incomeAccount:A['Sales'],expenseAccount:A['Purchases']});
  const i2=add('item',{name:'Consulting hour',code:'S-CON',unit:'hour',price:40,cost:0,track:false,incomeAccount:A['Service income'],expenseAccount:A['Other expenses']});
  const e1=add('employee',{name:'Ali Rahimi',code:'E001',email:'',phone:'',address:''});
  const fa=add('fixedasset',{name:'Laptop – office',code:'FA001',desc:'Bought for the front desk'});
  const pi=add('purchaseinvoice',{date:d('07','02'),dueDate:d('08','01'),ref:'1',supplier:s2,desc:'Paper stock',lines:[{item:i1,desc:'A4 paper box',account:A['Purchases'],qty:100,price:8,disc:'',tax:T.k20}]});
  const si1=add('salesinvoice',{date:d('07','10'),dueDate:d('07','25'),ref:'1',customer:c1,desc:'July order',lines:[{item:i1,desc:'A4 paper box',account:A['Sales'],qty:40,price:12,disc:'',tax:T.k20},{item:i2,desc:'Setup consulting',account:A['Service income'],qty:5,price:40,disc:10,tax:''}],notes:'Thank you for your business.'});
  add('salesinvoice',{date:d('09','05'),dueDate:d('09','20'),ref:'2',customer:c2,desc:'Consulting',lines:[{item:i2,desc:'Consulting – September',account:A['Service income'],qty:12,price:40,disc:'',tax:T.k20}]});
  add('salesinvoice',{date:today(),dueDate:addDays(today(),15),ref:'3',customer:c1,desc:'Paper',lines:[{item:i1,desc:'A4 paper box',account:A['Sales'],qty:20,price:12,disc:'',tax:T.k20}]});
  add('quote',{date:today(),dueDate:addDays(today(),30),ref:'1',customer:c2,desc:'Office supplies proposal',lines:[{item:i1,desc:'A4 paper box',account:A['Sales'],qty:10,price:11.5,disc:'',tax:T.k20}]});
  add('receipt',{date:d('07','24'),ref:'1',bank,contact:'Noor Imports',desc:'Payment for invoice 1',lines:[{account:'ar:'+c1,invoice:si1,desc:'',amount:756}]});
  add('receipt',{date:d('08','12'),ref:'2',bank:cash,contact:'Walk-in customer',desc:'Counter sale',lines:[{account:A['Other income'],desc:'',amount:85}]});
  add('payment',{date:d('07','01'),ref:'1',bank,contact:'Office landlord',desc:'Rent – July',lines:[{account:A['Rent'],desc:'',amount:900}]});
  add('payment',{date:d('07','30'),ref:'2',bank,contact:'Paper Wholesale Ltd',desc:'Invoice 1',lines:[{account:'ap:'+s2,invoice:pi,desc:'',amount:960}]});
  add('payment',{date:d('08','03'),ref:'3',bank,contact:'Tech Store',desc:'Laptop',lines:[{account:'fa:'+fa,desc:'',amount:1200}]});
  add('payment',{date:d('08','31'),ref:'4',bank,contact:'Ali Rahimi',desc:'August salary',lines:[{account:'emp:'+e1,desc:'',amount:950}]});
  add('purchaseinvoice',{date:d('09','10'),dueDate:d('10','10'),ref:'2',supplier:s1,desc:'Printer toner',lines:[{item:'',desc:'Printer toner',account:A['Office supplies'],qty:2,price:45,disc:'',tax:T.k20}]});
  add('transfer',{date:d('08','15'),ref:'1',from:bank,to:cash,amount:400,desc:'Petty cash'});
  add('payslip',{date:d('08','31'),ref:'1',employee:e1,desc:'August',earnings:[{desc:'Basic salary',account:A['Salaries & wages'],amount:1000}],deductions:[{desc:'Advance repayment',account:A['Other payables'],amount:50}]});
  add('expenseclaim',{date:d('09','14'),ref:'1',payer:e1,desc:'Taxi to client',lines:[{account:A['Transport & travel'],desc:'Taxi',amount:35}]});
  add('depreciation',{date:d('09','30'),ref:'1',desc:'Monthly depreciation',lines:[{asset:fa,amount:33.33}]});
  add('currency',{code:'EUR',name:'Euro',rate:1.08});
  const pj=add('project',{name:'Kabul office fit-out',code:'P01',desc:'Example project'});
  const c3=add('customer',{name:'Berlin Tours GmbH',code:'C003',email:'',phone:'',address:'Berlin, Germany',terms:30,currency:'EUR'});
  add('salesinvoice',{date:d('09','18'),dueDate:d('10','18'),ref:'4',customer:c3,currency:'EUR',rate:1.08,project:pj,desc:'Consulting for Berlin Tours',lines:[{item:i2,desc:'Consulting – September',account:A['Service income'],qty:10,price:37,disc:'',tax:'',project:pj}]});
  add('salesorder',{date:today(),dueDate:addDays(today(),10),ref:'1',customer:c1,desc:'Monthly paper order',lines:[{item:i1,desc:'A4 paper box',account:A['Sales'],qty:15,price:12,disc:'',tax:T.k20}]});
  const si5=add('salesinvoice',{date:d('10','02'),dueDate:d('10','17'),ref:'5',customer:c2,desc:'Office set-up project',lines:[{item:i2,desc:'Office set-up and training',account:A['Service income'],qty:40,price:40,disc:'',tax:T.k20}]});
  add('receipt',{date:d('10','15'),ref:'3',bank,contact:'Ahmad Karimi',desc:'Payment for invoice 5',lines:[{account:'ar:'+c2,invoice:si5,desc:'',amount:1920}]});
  // travel agency example (demo only: online, travel needs the Pro plan): airlines, a sub-agent and three tickets
  if(!CLOUD&&o.travel!==false){
  const al1=add('supplier',{name:'Kam Air (example)',code:'S003',kind:'airline',email:'',phone:'',address:'Kabul',terms:0});
  const al2=add('supplier',{name:'Turkish Airlines (example)',code:'S004',kind:'airline',email:'',phone:'',address:'Istanbul',terms:0});
  const ag=add('customer',{name:'Herat Travel (sub-agent)',code:'C004',kind:'agent',email:'',phone:'',address:'Herat, Afghanistan',terms:7});
  add('ticket',{date:d('08','05'),ref:'1',service:'ticket',passenger:'Omid Noori',pnr:'Q4MZ7T',ticketNo:'2351234500011',airline:al2,route:'IST – DXB – KBL',flightDate:d('08','20'),returnDate:'',customer:c1,sell:610,cost:540,paxPhone:'',notes:'',refunded:false});
  add('ticket',{date:d('09','20'),ref:'2',service:'ticket',passenger:'Ahmad Karimi',pnr:'K7XQ2A',ticketNo:'0001234567890',airline:al1,route:'IST – KBL',flightDate:addDays(today(),3),returnDate:'',customer:c2,sell:520,cost:455,paxPhone:'',notes:'',refunded:false});
  add('ticket',{date:today(),ref:'3',service:'ticket',passenger:'Mariam Sultani',pnr:'T9PL3D',ticketNo:'2351234500012',airline:al2,route:'KBL – IST',flightDate:addDays(today(),12),returnDate:'',customer:ag,sell:480,cost:440,paxPhone:'',notes:'',refunded:false});
  }
  add('recurringinvoice',{customer:c2,desc:'Monthly support',nextDate:d('11','01'),freq:'month',every:1,dueDays:7,active:true,lines:[{item:i2,desc:'Monthly support package',account:A['Service income'],qty:4,price:40,disc:'',tax:T.k20}]});
  return rows;
}
