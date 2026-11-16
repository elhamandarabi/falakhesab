/* ================= Falak Hesab — subscription payments by bank transfer (Step 11) =================
   The customer chooses country, plan and period, gets a unique reference and the company bank details,
   pays at their own bank and reports it. A payment approver checks the money in the company bank
   account OUTSIDE Falak Hesab and approves or rejects it here. Only an approval changes a subscription,
   and only in live mode (test requests never do). Prices, tax and the new dates are worked out by the
   database, never by the browser. */

const ISO_COUNTRIES='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');
const LANG_LOCALE={en:'en',fa:'fa-AF',ps:'ps-AF',tr:'tr'};           // add a language here and in LANGS to support it
function countryName(code){try{return new Intl.DisplayNames([LANG_LOCALE[LANG]||LANG,'en'],{type:'region'}).of(code)||code}catch(e){return code}}
const ptxt=p=>!p?'':typeof p==='string'?p:(p[LANG]||p.en||'');     // policy text in the reader's language, else English
const amt=(n,c)=>`<span class="num" dir="ltr">${fmt(+n||0)} ${esc(c||'')}</span>`;
const PAY_OPEN=['awaiting_payment','awaiting_verification','partially_paid'];
const PAY_STATUS={awaiting_payment:['Waiting for your transfer',''],awaiting_verification:['Awaiting verification',''],partially_paid:['Part payment received','overdue'],
  approved:['Approved','paid'],rejected:['Rejected','overdue'],cancelled:['Cancelled','']};
const payTag=st=>{const [l,c]=PAY_STATUS[st]||[st,''];return `<span class="tag ${c}">${l}</span>`};
const monthsTxt=m=>m===1?'1 month':`${m} months`;
const POLICIES=[['fees','Transfer fees'],['processing','Processing time'],['amount_rule','The amount that must arrive'],['partial','If you pay less'],['overpay','If you pay more'],['wrong_currency','If you pay in another currency'],['refund','Refunds']];

/* ---------- customer: the bank transfer part of Plan & billing ---------- */
// returns null when Step 11 is not installed or payments are switched off (then the page keeps its older "contact us" flow)
async function bankPayHtml(){
  const cfg=await API.billingCfg();if(!cfg||(cfg.mode==='off'&&!cfg.is_admin))return null;
  let reqs=[];try{reqs=await API.billingRequests(S.biz.id)}catch(e){return null}
  App.billing=cfg;const open=reqs.find(r=>PAY_OPEN.includes(r.status));
  const test=cfg.mode!=='live';
  const banner=test?`<div class="note paytest" role="note"><b>TEST</b> · <span>Sample bank details. Do not send money. Test payments never change your plan.</span></div>`:'';
  const hist=reqs.filter(r=>r!==open);
  return {cfg,reqs,open,html:`<section class="card pad bankpay" id="bankPay" aria-labelledby="bpT"><h2 id="bpT">Pay by bank transfer</h2>${banner}
    ${open?bankReqHtml(open,cfg):bankFormHtml(cfg,reqs)}</section>
    ${hist.length?`<div class="card scroll"><h2 style="padding:14px 18px 0">Bank transfer payments</h2><table><thead><tr><th>Date</th><th>Reference</th><th>Plan</th><th class="num">Amount</th><th>Status</th><th>Plan dates</th><th>Invoice</th><th class="noprint"></th></tr></thead><tbody>
      ${hist.map(r=>`<tr><td class="mono">${fmtD(r.created_at)}</td><td class="mono" dir="ltr">${esc(r.ref)}${r.test?' <span class="tag">Test</span>':''}</td><td>${esc(PLAN_NAME[r.plan])} · ${monthsTxt(r.months)}</td><td class="num">${amt(r.total,r.currency)}</td><td>${payTag(r.status)}</td>
        <td class="mono">${r.paid_from?fmtD(r.paid_from)+' – '+fmtD(r.paid_until):'—'}</td><td class="mono">${esc(r.invoice_no||'—')}</td><td class="noprint">${r.status==='approved'?`<a class="btn sm" href="#/billing/confirm/${r.id}">Payment confirmation</a>`:''}</td></tr>`).join('')}</tbody></table></div>`:''}`};
}
function bankFormHtml(cfg,reqs){
  const last=(reqs[0]&&reqs[0].billing)||{},st=S.biz.settings||{};
  const plan=(S.plan&&S.plan.requested_plan)||(S.plan&&S.plan.plan!=='free'&&S.plan.plan)||'pro';
  const countries=ISO_COUNTRIES.map(c=>[c,countryName(c)]).sort((a,b)=>a[1].localeCompare(b[1],LANG_LOCALE[LANG]||'en'));
  const sel=last.country||'';
  return `<p class="muted" style="margin-top:0">Choose your plan and how long to pay for. You get a payment reference and our bank details. We switch on your plan after we see the money in our bank account.</p>
  <form id="bpForm" class="grid bpgrid" novalidate>
    ${fld('Plan',`<select id="bpPlan">${['basic','pro'].filter(k=>cfg.prices&&cfg.prices[k]).map(k=>`<option value="${k}" ${k===plan?'selected':''}>${PLAN_NAME[k]}</option>`).join('')}</select>`)}
    ${fld('Pay for',`<select id="bpMonths">${(cfg.durations||[]).map(m=>`<option value="${m}">${monthsTxt(m)}</option>`).join('')}</select>`)}
    ${fld('Billing country',`<select id="bpCountry" required><option value="">—</option>${countries.map(([c,n])=>`<option value="${c}" ${c===sel?'selected':''}>${esc(n)}</option>`).join('')}</select>`)}
    ${fld('Currency',`<select id="bpCur"></select>`)}
    <div id="bpCountryMsg" class="full" aria-live="polite"></div>
    <fieldset class="full bpbill" id="bpBill"><legend>Billing details for the invoice</legend><div class="grid">
      ${fld('Company or business name',inp('bpCompany',last.company||S.biz.name||'','required maxlength="200" autocomplete="organization"'))}
      ${fld('Contact person',inp('bpContact',last.contact||'','maxlength="120" autocomplete="name"'))}
      ${fld('Address',inp('bpAddress',last.address||st.address||'','required maxlength="500" autocomplete="street-address"'))}
      ${fld('City',inp('bpCity',last.city||'','maxlength="120" autocomplete="address-level2"'))}
      ${fld('Postal code',inp('bpPostal',last.postal||'','maxlength="30" autocomplete="postal-code"'))}
      ${fld('Tax number (if your business has one)',inp('bpTaxId',last.tax_id||st.taxNo||'','maxlength="60"'))}
      <div id="bpTaxOfficeBox">${fld('Tax office',inp('bpTaxOffice',last.tax_office||'','maxlength="120"'))}</div>
      ${fld('Email for the invoice',inp('bpEmail',last.email||API.user.email||'','type="email" maxlength="200" autocomplete="email"'))}</div></fieldset>
    <div id="bpSum" class="full bpsum" aria-live="polite"></div>
    <div class="full"><div class="err" id="bpErr" role="alert"></div><button class="btn primary" type="submit" id="bpGo">Continue</button></div>
  </form>`;
}
function bankReqHtml(r,cfg){
  const b=r.bank||{},left=Math.max(0,(+r.total||0)-(+r.received_total||0)),pol=cfg.policies||{};
  const row=(l,v,copy)=>v?`<tr><th scope="row">${l}</th><td><span class="mono" dir="ltr">${esc(v)}</span>${copy?` <button type="button" class="btn sm" data-copy="${esc(v)}">Copy</button>`:''}</td></tr>`:'';
  const canReport=['awaiting_payment','partially_paid','awaiting_verification'].includes(r.status);
  const rep=r.report||{};
  return `<div class="payhead"><div><div class="muted small">Payment reference</div><div class="payref mono" dir="ltr">${esc(r.ref)}</div></div><div>${payTag(r.status)}${r.test?' <span class="tag">Test</span>':''}</div></div>
  <p class="payrefnote"><b>Write this reference in the transfer description</b> <span>so we can find your payment.</span></p>
  <table class="paysum"><tbody>
    <tr><th scope="row">Plan</th><td>${esc(PLAN_NAME[r.plan])}</td></tr>
    <tr><th scope="row">Subscription period</th><td>${monthsTxt(r.months)}</td></tr>
    <tr><th scope="row">Billing country</th><td>${esc(countryName(r.country))}</td></tr>
    <tr><th scope="row">Price</th><td>${amt(r.unit_price,r.currency)} <span class="muted">/ month</span> × ${r.months} = ${amt(r.subtotal,r.currency)}</td></tr>
    <tr><th scope="row">${esc(r.tax_label||lookupOr('Tax'))}</th><td>${r.tax_rate!=null?`${fmtQ(+r.tax_rate)}% · ${amt(r.tax_amount,r.currency)}`:'<span class="muted">Not added. Tax is set by our accountant; we will tell you if anything changes before you pay.</span>'}</td></tr>
    <tr class="paytotal"><th scope="row">Amount that must arrive</th><td>${amt(r.total,r.currency)}</td></tr>
    ${+r.received_total>0?`<tr><th scope="row">Received so far</th><td>${amt(r.received_total,r.currency)}${left>0?` · <b>Still to pay</b> ${amt(left,r.currency)}`:''}</td></tr>`:''}
    <tr><th scope="row">Payment currency</th><td class="mono">${esc(r.currency)}</td></tr></tbody></table>
  <h3><span>Our bank account</span> <span dir="ltr">(${esc(r.currency)})</span></h3>
  ${b.test?`<p class="neg small"><b>Sample bank details for testing. Do not send money to this account.</b></p>`:''}
  <table class="paysum bankbox"><tbody>${row(lookupOr('Account holder'),b.account_holder)}${row(lookupOr('Bank'),b.bank_name)}${row('IBAN',b.iban,true)}${row('SWIFT / BIC',b.swift,true)}${row(lookupOr('Account number'),b.account_no,true)}${row(lookupOr('Bank address'),b.bank_address)}${row(lookupOr('Description / reference'),r.ref,true)}</tbody></table>
  ${b.note?`<p class="muted small">${esc(b.note)}</p>`:''}
  <div class="paypol">${POLICIES.map(([k,l])=>ptxt(pol[k])?`<details ${['fees','processing','amount_rule'].includes(k)?'open':''}><summary>${l}</summary><p dir="auto">${esc(ptxt(pol[k]))}</p></details>`:'').join('')}</div>
  ${r.status==='awaiting_verification'?`<div class="note"><b>Awaiting verification.</b> <span>We are checking our bank account. Your plan changes only after we see the money.</span>${rep.date?` <span class="muted small">(<span>You reported a payment on</span> <span class="mono">${esc(fmtD(rep.date))}</span>)</span>`:''}</div>`:''}
  ${canReport?`<details class="payreport" ${r.status==='awaiting_verification'?'':'open'}><summary>${r.status==='awaiting_verification'?lookupOr('Update the payment details or add a receipt'):lookupOr('I have paid')}</summary>
    <form id="prForm" class="grid" novalidate>
      ${fld('Name of the person or company that paid',inp('prPayer',rep.payer||'','maxlength="200"'))}
      ${fld('Transfer date',inp('prDate',rep.date||today(),'type="date"'))}
      ${fld('Amount sent',inp('prAmt',rep.amount||String(left||r.total),'inputmode="decimal" maxlength="20"'))}
      ${fld('Currency sent',inp('prCur',rep.currency||r.currency,'maxlength="3"'))}
      ${fld('Your bank',inp('prBank',rep.sender_bank||'','maxlength="200"'))}
      ${fld('Receipt (optional, photo or PDF, up to 10 MB)','<input id="prFile" type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf">')}
      <label class="f full">Note<textarea id="prNote" maxlength="1000" rows="2">${esc(rep.note||'')}</textarea></label>
      <p class="muted small full">Sending this does not switch on your plan. We switch it on only after we see the money in our bank account.</p>
      <div class="full"><div class="err" id="prErr" role="alert"></div><button class="btn primary" type="submit" id="prGo">Send payment details</button>
        ${r.status==='awaiting_payment'?'<button class="btn" type="button" id="prCancel">Cancel this payment</button>':''}</div></form></details>`:''}`;
}
function bindBankPay(info){
  if(!info)return;const {cfg,open}=info,box=$('#bankPay');if(!box)return;
  box.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>copyText(b.dataset.copy,'Copied'));
  if(open){
    const f=$('#prForm');if(f)f.onsubmit=async e=>{e.preventDefault();const bt=$('#prGo');bt.disabled=true;$('#prErr').textContent='';
      try{let path=null;const file=$('#prFile').files[0];if(file)path=await API.receiptUpload(S.biz.id,open.id,file);
        await API.billingReport(open.id,{payer:val('prPayer'),date:val('prDate'),amount:val('prAmt'),currency:val('prCur').toUpperCase(),sender_bank:val('prBank'),note:val('prNote')},path);
        toast(lookupOr('Thank you. Your payment is awaiting verification.'));router({keepScroll:true})}catch(x){$('#prErr').textContent=x.message;bt.disabled=false}};
    const c=$('#prCancel');if(c)c.onclick=()=>confirmBox(lookupOr('Cancel this payment? Do not cancel if you already sent the money.'),async()=>{try{await API.billingCancel(open.id);router()}catch(x){toast(x.message)}},lookupOr('Cancel payment'));
    return}
  const ctry=()=>(cfg.countries||{})[val('bpCountry')];
  const paint=()=>{
    const code=val('bpCountry'),c=ctry(),msg=$('#bpCountryMsg'),cur=$('#bpCur'),plan=val('bpPlan'),m=+val('bpMonths');
    $('#bpTaxOfficeBox').hidden=code!=='TR';
    const ok=!!(c&&c.status==='supported');const curs=ok?(c.currencies||[]).filter(x=>(cfg.currencies||[]).includes(x)&&(cfg.prices[plan]||{})[x]&&(cfg.banks||[]).some(b=>b.currency===x)):[];
    const keep=cur.value;cur.innerHTML=curs.map(x=>`<option ${x===keep?'selected':''}>${x}</option>`).join('');cur.disabled=!curs.length;
    $('#bpBill').hidden=$('#bpGo').hidden=!(ok&&curs.length);
    if(!code){msg.innerHTML='';$('#bpSum').innerHTML='';return}
    if(!ok||!curs.length){msg.innerHTML=`<div class="note"><b>${esc(countryName(code))}:</b> <span>Bank transfer payments from this country are not set up yet. Please contact support and we will help you.</span>
      <div style="margin-top:8px">${SUPPORT.wa?`<a class="btn primary sm" target="_blank" rel="noopener" href="${supportWa('Hello Falak Hesab, I want to pay for '+PLAN_NAME[plan]+' for "'+S.biz.name+'" from '+countryName(code)+'.')}">Contact support on WhatsApp</a>`:''} ${SUPPORT.email?`<a class="btn sm" href="${supportMail('Falak Hesab – payment from '+countryName(code))}">Email</a>`:''}</div></div>`;$('#bpSum').innerHTML='';return}
    msg.innerHTML='';
    const p=+cfg.prices[plan][cur.value],sub=Math.round(p*m*100)/100,rule=((cfg.tax||{}).rules||{})[code]||(cfg.tax||{}).default||null,rate=rule&&rule.rate!=null&&rule.rate!==''?+rule.rate:null;
    const incl=!!(cfg.tax||{}).prices_include_tax,tax=rate==null?null:incl?Math.round((sub-sub/(1+rate/100))*100)/100:Math.round(sub*rate)/100,tot=rate==null||incl?sub:Math.round((sub+tax)*100)/100;
    $('#bpSum').innerHTML=`<table class="paysum"><tbody><tr><th scope="row">${PLAN_NAME[plan]} · ${monthsTxt(m)}</th><td>${amt(p,cur.value)} <span class="muted">/ month</span> × ${m} = ${amt(sub,cur.value)}</td></tr>
      <tr><th scope="row">${esc((rule&&rule.label)||lookupOr('Tax'))}</th><td>${rate==null?'<span class="muted">Not added. Tax is set by our accountant.</span>':`${fmtQ(rate)}%${incl?' <span class="muted">(included)</span>':''} · ${amt(tax,cur.value)}`}</td></tr>
      <tr class="paytotal"><th scope="row">Total to pay</th><td>${amt(tot,cur.value)}</td></tr></tbody></table>
      <p class="muted small">Your bank and other banks may charge fees. The exact amount, bank details and reference are shown on the next step.</p>`};
  ['bpCountry','bpPlan','bpMonths','bpCur'].forEach(id=>$('#'+id).onchange=paint);paint();
  $('#bpForm').onsubmit=async e=>{e.preventDefault();const bt=$('#bpGo');$('#bpErr').textContent='';
    if(!val('bpCompany').trim()||!val('bpAddress').trim()){$('#bpErr').textContent=lookupOr('Company name and address are needed for the invoice.');return}
    bt.disabled=true;
    try{await API.billingCreate(S.biz.id,val('bpPlan'),+val('bpMonths'),val('bpCountry'),val('bpCur'),{company:val('bpCompany'),contact:val('bpContact'),address:val('bpAddress'),city:val('bpCity'),postal:val('bpPostal'),tax_id:val('bpTaxId'),tax_office:val('bpCountry')==='TR'?val('bpTaxOffice'):'',email:val('bpEmail')});
      await reloadPlan();router()}catch(x){$('#bpErr').textContent=x.message;bt.disabled=false}};
}

/* ---------- payment confirmation (NOT a tax invoice) ---------- */
async function vPayConfirm(V,id){
  const reqs=await API.billingRequests(S.biz.id).catch(()=>[]),r=reqs.find(x=>x.id===id);const cfg=App.billing||await API.billingCfg()||{};
  if(!r||r.status!=='approved'){V.innerHTML='<div class="note">This payment confirmation is not available.</div>';return}
  const co=cfg.company||{},bi=r.billing||{};
  V.innerHTML=`<div class="head noprint"><a href="#/billing" class="small">← Plan & billing</a><div class="tools"><button class="btn" type="button" id="prt">Print / PDF</button></div></div>
  <div class="card pad doc payconf"><div class="dochead"><div><b>${esc(co.legal_name||'Falak Hesab')}</b><div class="muted small" style="white-space:pre-line">${esc([co.address,co.tax_office&&co.tax_no?co.tax_office+' · '+co.tax_no:co.tax_no,co.email].filter(Boolean).join('\n'))}</div></div>
    <div style="text-align:end"><h1 class="doctitle">Payment confirmation</h1><div class="neg small"><b>This is not a tax invoice.</b></div></div></div>
    ${r.test?'<p class="neg"><b>TEST — no real payment.</b></p>':''}
    <table class="paysum"><tbody>
      <tr><th scope="row">Received from</th><td dir="auto">${esc(bi.company||'')}<div class="muted small">${esc([bi.address,bi.city,bi.postal,countryName(bi.country||r.country)].filter(Boolean).join(', '))}${bi.tax_id?' · '+esc(bi.tax_id):''}</div></td></tr>
      <tr><th scope="row">Payment reference</th><td class="mono" dir="ltr">${esc(r.ref)}</td></tr>
      <tr><th scope="row">For</th><td>Falak Hesab ${esc(PLAN_NAME[r.plan])} · ${monthsTxt(r.months)} · ${esc(r.business_name||S.biz.name)}</td></tr>
      <tr><th scope="row">Subscription dates</th><td class="mono">${fmtD(r.paid_from)} – ${fmtD(r.paid_until)}</td></tr>
      <tr><th scope="row">Amount due</th><td>${amt(r.total,r.currency)}</td></tr>
      <tr><th scope="row">Amount received</th><td>${amt(r.received_total,r.currency)}${r.overpaid?` <span class="muted small">(<span>overpaid</span> ${amt(r.overpaid,r.currency)})</span>`:''}</td></tr>
      <tr><th scope="row">Received on</th><td class="mono">${(r.received||[]).map(x=>fmtD(x.date)).join(', ')}</td></tr>
      <tr><th scope="row">Approved</th><td class="mono">${fmtD(r.decided_at)}</td></tr>
      <tr><th scope="row">Official invoice</th><td class="mono">${r.invoice_no?esc(r.invoice_no)+(r.invoice_date?' · '+fmtD(r.invoice_date):''):`<span class="muted">${lookupOr('Will be sent separately.')}</span>`}</td></tr></tbody></table></div>`;
  $('#prt').onclick=()=>window.print();
}

/* ---------- payment approvals (super admin + approvers): #/payments ---------- */
async function vPayments(V,r,a,id){
  V.innerHTML='<div class="loading">Loading…</div>';
  const cfg=await API.billingCfg();if(!cfg){V.innerHTML='<div class="note">Bank transfer payments are not installed yet. Run Step 11 in Supabase first.</div>';return}
  if(!cfg.is_admin){V.innerHTML='<div class="note">Only payment approvers can open this page.</div>';return}
  App.billing=cfg;
  if(a==='settings')return vPaySettings(V,cfg);
  let all=[];try{all=await API.billingAll()}catch(x){V.innerHTML=`<div class="note">${esc(x.message)}</div>`;return}
  const f=App.payFilter||'check',groups={check:['awaiting_verification','partially_paid'],waiting:['awaiting_payment'],approved:['approved'],closed:['rejected','cancelled'],all:null};
  const list=all.filter(x=>!groups[f]||groups[f].includes(x.status)),cnt=k=>all.filter(x=>!groups[k]||groups[k].includes(x.status)).length;
  const sel=id&&all.find(x=>x.id===id);
  V.innerHTML=`<div class="head"><h1>Payment approvals</h1><div class="tools">${API.isSuper()?'<a class="btn" href="#/payments/settings">Payment settings</a>':''}</div></div>
  <p class="muted" style="margin-top:0"><span>Mode:</span> <b class="paymode ${cfg.mode}">${esc(cfg.mode)}</b>. <span>Check the money in the company bank account first, then approve. Customer messages and receipts never switch on a plan by themselves.</span></p>
  <div class="stabs" role="tablist" aria-label="Payment lists">${[['check','Needs checking'],['waiting','Waiting for transfer'],['approved','Approved'],['closed','Rejected or cancelled'],['all','All']].map(([k,l])=>`<button type="button" role="tab" class="stab ${k===f?'on':''}" aria-selected="${k===f}" data-pf="${k}">${l} <span class="num">${cnt(k)}</span></button>`).join('')}</div>
  <div class="card scroll"><table><thead><tr><th>Date</th><th>Reference</th><th>Business</th><th>Plan</th><th>Country</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>
    ${list.map(x=>`<tr class="click ${sel&&sel.id===x.id?'sel':''}" data-h="#/payments/view/${x.id}"><td class="mono">${fmtD(x.created_at)}</td><td class="mono" dir="ltr">${esc(x.ref)}${x.test?' <span class="tag">Test</span>':''}</td><td dir="auto">${esc(x.business_name||'')}</td><td>${esc(PLAN_NAME[x.plan])} · ${monthsTxt(x.months)}</td><td>${esc(x.country)}</td><td class="num">${amt(x.total,x.currency)}</td><td>${payTag(x.status)}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">Nothing here</td></tr>'}</tbody></table></div>
  <div id="payDetail">${sel?payDetailHtml(sel):''}</div>`;
  $$('[data-pf]').forEach(b=>b.onclick=()=>{App.payFilter=b.dataset.pf;go('#/payments')});
  $$('tr.click').forEach(tr=>tr.onclick=()=>go(tr.dataset.h));
  if(sel){bindPayDetail(sel);$('#payDetail').scrollIntoView({block:'start'})}
}
function payDetailHtml(r){
  const bi=r.billing||{},rep=r.report||{},open=PAY_OPEN.includes(r.status),left=Math.max(0,(+r.total)-(+r.received_total));
  const kv=(l,v)=>`<tr><th scope="row">${l}</th><td>${v}</td></tr>`;
  return `<section class="card pad paydet" aria-labelledby="pdT"><div class="payhead"><div><div class="muted small">Payment reference</div><h2 id="pdT" class="payref mono" dir="ltr">${esc(r.ref)}</h2></div><div>${payTag(r.status)}${r.test?' <span class="tag">Test · will not change the plan</span>':''}</div></div>
  <div class="paycols"><table class="paysum"><tbody>
    ${kv(lookupOr('Business'),`<b dir="auto">${esc(r.business_name||'')}</b><div class="muted small mono">${esc(r.business_id)}</div>`)}
    ${kv(lookupOr('Requested by'),esc(r.created_by||''))}
    ${kv(lookupOr('Plan'),esc(PLAN_NAME[r.plan])+' · '+monthsTxt(r.months))}
    ${kv(lookupOr('Amount that must arrive'),amt(r.total,r.currency)+(r.tax_rate!=null?` <span class="muted small">(${esc(r.tax_label||'Tax')} ${fmtQ(+r.tax_rate)}%: ${amt(r.tax_amount,r.currency)})</span>`:` <span class="muted small">${lookupOr('(no tax added)')}</span>`))}
    ${kv(lookupOr('Received so far'),amt(r.received_total,r.currency)+(left>0&&open?` · <b>${lookupOr('Still to pay')}</b> ${amt(left,r.currency)}`:'')+(r.overpaid?` · <b class="neg">${lookupOr('Overpaid')}</b> ${amt(r.overpaid,r.currency)}`:''))}
    ${kv(lookupOr('Paid into'),esc([r.bank.bank_name,r.bank.iban||r.bank.account_no].filter(Boolean).join(' · '))+(r.bank.test?' <span class="tag">Sample</span>':''))}
  </tbody></table><table class="paysum"><tbody>
    ${kv(lookupOr('Billing'),`<span dir="auto">${esc(bi.company||'')}</span><div class="muted small" dir="auto">${esc([bi.contact,bi.address,bi.city,bi.postal,countryName(bi.country||r.country)].filter(Boolean).join(', '))}</div>`)}
    ${kv(lookupOr('Tax number'),esc([bi.tax_id,bi.tax_office].filter(Boolean).join(' · ')||'—'))}
    ${kv(lookupOr('Invoice email'),esc(bi.email||'—'))}
    ${kv(lookupOr('Customer says'),rep.date?`<span>${esc(rep.payer||'')}</span> · <span class="mono">${esc(fmtD(rep.date))}</span> · ${amt(rep.amount,rep.currency)}${rep.sender_bank?' · '+esc(rep.sender_bank):''}${rep.note?`<div class="muted small" dir="auto">${esc(rep.note)}</div>`:''}`:'<span class="muted">Not reported yet</span>')}
    ${kv(lookupOr('Receipt'),r.receipt_path?`<button class="btn sm" type="button" id="pdRcpt">Open receipt</button> <span class="muted small">${lookupOr('A receipt is not proof: check the bank account.')}</span>`:'—')}
  </tbody></table></div>
  ${(r.received||[]).length?`<h3>Money recorded</h3><table class="paysum"><thead><tr><th>Date</th><th class="num">Amount</th><th>Bank reference</th><th>By</th></tr></thead><tbody>${r.received.map(x=>`<tr><td class="mono">${fmtD(x.date)}</td><td class="num">${amt(x.amount,x.currency)}</td><td class="mono" dir="ltr">${esc(x.bank_ref)}</td><td class="small">${esc(x.by)} · ${fmtD(x.at)}</td></tr>`).join('')}</tbody></table>`:''}
  ${r.status==='approved'?`<p><b>Approved</b> <span>by</span> ${esc(r.decided_by)} <span>on</span> <span class="mono">${fmtD(r.decided_at)}</span> · <span>Subscription</span> <span class="mono">${fmtD(r.paid_from)} – ${fmtD(r.paid_until)}</span></p>${r.decision_note?`<p class="muted small" dir="auto">${esc(r.decision_note)}</p>`:''}
    <form id="pdInv" class="grid"><div class="full muted small">The official tax invoice is made outside Falak Hesab. Record its number here.</div>${fld('Official invoice number',inp('pdInvNo',r.invoice_no||'','maxlength="60"'))}${fld('Invoice date',inp('pdInvDate',r.invoice_date||'','type="date"'))}<div class="full"><button class="btn" type="submit">Save invoice number</button></div></form>`:''}
  ${['rejected','cancelled'].includes(r.status)?`<p>${payTag(r.status)} <span>by</span> ${esc(r.decided_by||'')} <span>on</span> <span class="mono">${fmtD(r.decided_at)}</span></p>${r.decision_note?`<p dir="auto">${esc(r.decision_note)}</p>`:''}`:''}
  ${open?`<form id="pdForm" class="grid paydecide" novalidate><h3 class="full">Verify in the company bank account</h3>
      <p class="full muted small">Open the company bank account outside Falak Hesab. Find a payment with reference <b class="mono" dir="ltr">${esc(r.ref)}</b> for ${amt(left||r.total,r.currency)}. Record only money you can see there.</p>
      ${fld('Amount that arrived',inp('pdAmt','','inputmode="decimal"'))}
      ${fld('Currency that arrived',inp('pdCur',r.currency,'maxlength="3"'))}
      ${fld('Bank transaction reference',inp('pdBankRef','','maxlength="80"'))}
      ${fld('Date it arrived',inp('pdDate',today(),'type="date"'))}
      ${fld('Type the payment reference to confirm',inp('pdRef','','maxlength="20" autocomplete="off" placeholder="'+esc(r.ref)+'"'))}
      <label class="f full">Note (required when rejecting)<textarea id="pdNote" rows="2" maxlength="1000"></textarea></label>
      <div class="full"><div class="err" id="pdErr" role="alert"></div>
        <button class="btn primary" type="button" data-act="approve">Approve</button>
        <button class="btn" type="button" data-act="receive">Record part payment</button>
        <button class="btn danger" type="button" data-act="reject">Reject</button></div>
      <p class="full muted small">Approve switches on or extends the plan of <b dir="auto">${esc(r.business_name||'')}</b> (${r.test?lookupOr('test: no change'):lookupOr('live')}). Wrong currency: do not approve; reject or follow your wrong-currency policy.</p></form>`:''}
  </section>`;
}
function bindPayDetail(r){
  const rc=$('#pdRcpt');if(rc)rc.onclick=async()=>{try{const b=await API.receiptGet(r.receipt_path);const u=URL.createObjectURL(b);window.open(u,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(u),60000)}catch(x){toast(x.message)}};
  const inv=$('#pdInv');if(inv)inv.onsubmit=async e=>{e.preventDefault();try{await API.billingInvoice(r.id,val('pdInvNo'),val('pdInvDate'));toast(lookupOr('Saved'));router({keepScroll:true})}catch(x){toast(x.message)}};
  $$('#pdForm [data-act]').forEach(b=>b.onclick=async()=>{const act=b.dataset.act;$('#pdErr').textContent='';
    const o={ref:val('pdRef').trim().toUpperCase(),amount:val('pdAmt').replace(',','.'),currency:val('pdCur').toUpperCase(),bank_ref:val('pdBankRef'),date:val('pdDate'),note:val('pdNote')};
    if(act==='reject')o.amount='';
    const go2=async()=>{$$('#pdForm [data-act]').forEach(x=>x.disabled=true);
      try{const res=await API.billingDecide(r.id,act,o);toast(lookupOr(act==='approve'?'Payment approved':act==='reject'?'Payment rejected':'Part payment recorded'));go('#/payments/view/'+res.id);router({keepScroll:true})}
      catch(x){$('#pdErr').textContent=x.message;$$('#pdForm [data-act]').forEach(x=>x.disabled=false)}};
    if(act==='approve')confirmBox(lookupOr('Approve this payment? Only approve if you have seen the money in the company bank account.')+' '+r.ref+' · '+(r.business_name||''),go2,lookupOr('Approve'));else go2()});
}

/* ---------- payment settings (super admin only) ---------- */
async function vPaySettings(V,pub){
  if(!API.isSuper()){V.innerHTML='<div class="note">Only the super admin can change payment settings.</div>';return}
  let c={};try{c=await API.billingAdminCfg()}catch(x){V.innerHTML=`<div class="note">${esc(x.message)}</div>`;return}
  const co=c.company||{},pol=c.policies||{},tax=c.tax||{},cur=(c.currencies||[]).join(', ');
  const L4=['en','fa','ps','tr'];
  const polIn=(k,l)=>`<fieldset class="full"><legend>${l}</legend><div class="grid">${L4.map(lg=>`<label class="f"><span>${LANGS[lg]}</span><textarea data-pol="${k}" data-lg="${lg}" rows="2" dir="${lg==='fa'||lg==='ps'?'rtl':'ltr'}">${esc(typeof pol[k]==='string'?(lg==='en'?pol[k]:''):((pol[k]||{})[lg]||''))}</textarea></label>`).join('')}</div></fieldset>`;
  const bankRow=(b={})=>`<div class="card pad bankrow">${b.test?'<p class="neg small"><b>SAMPLE / TEST bank. Not allowed in live mode.</b></p>':''}<div class="grid">${[['currency','Currency'],['label','Label'],['bank_name','Bank name'],['account_holder','Account holder'],['iban','IBAN'],['swift','SWIFT / BIC'],['account_no','Account number'],['bank_address','Bank address'],['note','Note for customers']].map(([k,l])=>`<label class="f">${l}<input data-bk="${k}" value="${esc(b[k]||'')}"></label>`).join('')}
    <label class="f"><span>Test / sample</span><input type="checkbox" data-bk="test" ${b.test?'checked':''}></label></div><button class="btn sm danger" type="button" data-rmrow>Remove</button></div>`;
  const ctryRow=(code='',x={})=>`<div class="ctyrow"><select data-cc>${'<option value="">—</option>'+ISO_COUNTRIES.map(k=>`<option value="${k}" ${k===code?'selected':''}>${k} · ${esc(countryName(k))}</option>`).join('')}</select>
    <select data-cs><option value="supported" ${x.status==='supported'?'selected':''}>Supported</option><option value="contact" ${x.status!=='supported'?'selected':''}>Contact support</option></select>
    <input data-ccur placeholder="USD, TRY" value="${esc((x.currencies||[]).join(', '))}"><button class="btn sm" type="button" data-rmrow>Remove</button></div>`;
  const taxRow=(code='',x={})=>`<div class="ctyrow"><select data-tc>${'<option value="">—</option>'+ISO_COUNTRIES.map(k=>`<option value="${k}" ${k===code?'selected':''}>${k} · ${esc(countryName(k))}</option>`).join('')}</select><input data-tl placeholder="KDV / VAT" value="${esc(x.label||'')}"><input data-tr placeholder="%" inputmode="decimal" value="${x.rate==null?'':esc(x.rate)}"><button class="btn sm" type="button" data-rmrow>Remove</button></div>`;
  V.innerHTML=`<div class="head"><div><a href="#/payments" class="small">← Payment approvals</a><h1>Payment settings</h1></div></div>
  <form id="psForm" class="stack" novalidate>
   <div class="card pad"><h2>Mode</h2>${[['off','Off: customers cannot start a bank payment (you can still make test requests)'],['test','Test: everyone can try; approvals never change a plan; sample banks allowed'],['live','Live: real payments; approvals switch on plans. Needs everything below, real bank accounts and confirmed tax.']].map(([k,l])=>`<label class="radio"><input type="radio" name="psMode" value="${k}" ${c.mode===k?'checked':''}> <b>${k}</b> · <span>${l}</span></label>`).join('')}</div>
   <div class="card pad"><h2>Company (shown on payment confirmations)</h2><div class="grid">${[['legal_name','Legal name'],['address','Address'],['tax_office','Tax office'],['tax_no','Tax number'],['mersis','MERSIS number'],['tursab','TÜRSAB number'],['email','Email'],['phone','Phone']].map(([k,l])=>`<label class="f">${l}<input data-co="${k}" value="${esc(co[k]||'')}"></label>`).join('')}</div></div>
   <div class="card pad"><h2>Currencies and prices</h2><div class="grid"><label class="f">Accepted currencies<input id="psCur" value="${esc(cur)}" placeholder="USD, TRY"></label><label class="f">Months a customer can pay for<input id="psDur" value="${esc((c.durations||[1,3,6,12]).join(', '))}"></label><label class="f">Reference prefix<input id="psPre" value="${esc(c.ref_prefix||'FH')}" maxlength="6"></label></div>
     <div id="psPrices"></div><p class="muted small">Price per month. Leave empty where you do not sell in that currency. No exchange rates are used: each currency has its own price.</p></div>
   <div class="card pad"><h2>Countries</h2><p class="muted small" style="margin-top:0">Customers from countries not listed here are asked to contact support.</p><div id="psCty">${Object.entries(c.countries||{}).map(([k,x])=>ctryRow(k,x)).join('')}</div><button class="btn sm" type="button" id="psAddCty">+ Add country</button></div>
   <div class="card pad"><h2>Bank accounts</h2><div id="psBanks" class="stack">${(c.banks||[]).map(bankRow).join('')}</div><button class="btn sm" type="button" id="psAddBank">+ Add bank account</button> <button class="btn sm" type="button" id="psAddSample">+ Add SAMPLE bank (test only)</button></div>
   <div class="card pad"><h2>Policies shown to customers</h2><p class="muted small" style="margin-top:0">Your own texts. English is required for live mode; other languages are optional (English is shown when empty).</p><div class="grid">${POLICIES.map(([k,l])=>polIn(k,l)).join('')}</div></div>
   <div class="card pad"><h2>Tax (ask your accountant)</h2><label class="radio"><input type="checkbox" id="psTaxOk" ${tax.confirmed?'checked':''}> <span>The accountant has confirmed these tax settings</span></label>
     <label class="radio"><input type="checkbox" id="psIncl" ${tax.prices_include_tax?'checked':''}> <span>Prices already include tax</span></label>
     <p class="muted small">Leave the rate empty where it is not decided: then no tax is added and the customer sees "Tax is set by our accountant". Foreign customers are not treated as tax-free unless you set that here.</p>
     <div class="grid"><label class="f">Default tax name<input id="psTdL" value="${esc((tax.default||{}).label||'')}"></label><label class="f">Default rate %<input id="psTdR" inputmode="decimal" value="${tax.default&&tax.default.rate!=null?esc(tax.default.rate):''}"></label></div>
     <div id="psTax">${Object.entries(tax.rules||{}).map(([k,x])=>taxRow(k,x)).join('')}</div><button class="btn sm" type="button" id="psAddTax">+ Add country rule</button></div>
   <div class="card pad"><h2>Payment approvers</h2><label class="f">Emails (one per line). The super admin is always an approver.<textarea id="psAppr" rows="3">${esc((c.approvers||[]).join('\n'))}</textarea></label></div>
   <div><div class="err" id="psErr" role="alert"></div><button class="btn primary" type="submit">Save payment settings</button></div></form>`;
  const prices=()=>{const curs=val('psCur').toUpperCase().split(/[\s,]+/).filter(x=>/^[A-Z]{3}$/.test(x));const pr=c.prices||{};
    $('#psPrices').innerHTML=curs.length?`<table class="paysum"><thead><tr><th></th>${curs.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${['basic','pro'].map(k=>`<tr><th scope="row">${PLAN_NAME[k]}</th>${curs.map(x=>`<td><input data-pp="${k}" data-pc="${x}" inputmode="decimal" style="width:100px" value="${esc(((pr[k]||{})[x])??'')}"></td>`).join('')}</tr>`).join('')}</tbody></table>`:''};
  prices();$('#psCur').onchange=()=>{const pr=c.prices=c.prices||{};$$('[data-pp]').forEach(i=>{(pr[i.dataset.pp]=pr[i.dataset.pp]||{})[i.dataset.pc]=i.value});prices()};
  const rm=()=>$$('[data-rmrow]').forEach(b=>b.onclick=()=>b.parentElement.remove());rm();
  $('#psAddCty').onclick=()=>{$('#psCty').insertAdjacentHTML('beforeend',ctryRow());rm()};
  $('#psAddTax').onclick=()=>{$('#psTax').insertAdjacentHTML('beforeend',taxRow());rm()};
  $('#psAddBank').onclick=()=>{$('#psBanks').insertAdjacentHTML('beforeend',bankRow());rm()};
  $('#psAddSample').onclick=()=>{$('#psBanks').insertAdjacentHTML('beforeend',bankRow({currency:'USD',label:'SAMPLE – do not pay',bank_name:'Sample Bank (TEST ONLY)',account_holder:'Sample Company (TEST)',iban:'TR00 0000 0000 0000 0000 0000 00',swift:'SAMPLE00',note:'Test data. Do not send money.',test:true}));rm()};
  $('#psForm').onsubmit=async e=>{e.preventDefault();$('#psErr').textContent='';
    const num=v=>v===''||v==null?null:+String(v).replace(',','.');
    const v={mode:($('input[name=psMode]:checked')||{}).value||'off',ref_prefix:val('psPre').toUpperCase().replace(/[^A-Z0-9]/g,'')||'FH',
      currencies:val('psCur').toUpperCase().split(/[\s,]+/).filter(x=>/^[A-Z]{3}$/.test(x)),
      durations:val('psDur').split(/[\s,]+/).map(Number).filter(n=>n>=1&&n<=36),
      prices:{},countries:{},banks:[],company:{},policies:{},approvers:val('psAppr').split(/\s+/).map(x=>x.trim().toLowerCase()).filter(x=>/@/.test(x)),
      tax:{confirmed:$('#psTaxOk').checked,prices_include_tax:$('#psIncl').checked,default:{label:val('psTdL'),rate:num(val('psTdR'))},rules:{}}};
    $$('[data-pp]').forEach(i=>{const n=num(i.value);if(n!=null&&n>0)(v.prices[i.dataset.pp]=v.prices[i.dataset.pp]||{})[i.dataset.pc]=n});
    $$('#psCty .ctyrow').forEach(r=>{const k=r.querySelector('[data-cc]').value;if(k)v.countries[k]={status:r.querySelector('[data-cs]').value,currencies:r.querySelector('[data-ccur]').value.toUpperCase().split(/[\s,]+/).filter(x=>/^[A-Z]{3}$/.test(x))}});
    $$('#psTax .ctyrow').forEach(r=>{const k=r.querySelector('[data-tc]').value;if(k)v.tax.rules[k]={label:r.querySelector('[data-tl]').value,rate:num(r.querySelector('[data-tr]').value)}});
    $$('#psBanks .bankrow').forEach((r,i)=>{const b={id:'b'+(i+1)};r.querySelectorAll('[data-bk]').forEach(x=>{b[x.dataset.bk]=x.type==='checkbox'?x.checked:x.value.trim()});b.currency=(b.currency||'').toUpperCase();if(b.currency)v.banks.push(b)});
    $$('[data-co]').forEach(x=>v.company[x.dataset.co]=x.value.trim());
    $$('[data-pol]').forEach(x=>{const o=v.policies[x.dataset.pol]=v.policies[x.dataset.pol]||{};if(x.value.trim())o[x.dataset.lg]=x.value.trim()});
    try{await API.billingSave(v);App.billing=await API.billingCfg();toast(lookupOr('Payment settings saved'));go('#/payments')}catch(x){$('#psErr').textContent=x.message}};
}
