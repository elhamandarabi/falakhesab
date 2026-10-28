/* ================= Falak Hesab — plans & billing (owner page + super admin tools) ================= */
const PLAN_NAME={free:'Free',basic:'Basic',pro:'Pro'};
const planFeatures=(k,pl)=>{const u=+((pl[k]||{}).users)||0;
  const users=u===0?'Unlimited users':u===1?'1 user':`Up to ${u} users`;
  return {
    free:[users,'All accounting: sales, purchases, bank, reports','Invoices, receipts and statements','Backups and history'],
    basic:[users,'Everything in Free','Company address with your logo (falakhesab.com/your-company)'],
    pro:[users,'Everything in Basic','Travel: tickets, airlines, sub-agents',...(EXCHANGE_ON?['Exchange & Transfers: exchange, hawala, daily rates']:[])]
  }[k]};
const fmtPrice=(pl,k)=>{const x=pl[k]||{};return +x.usd||+x.try?`<b class="price">$${fmtQ(+x.usd||0)}</b> <span class="muted">/ month</span><div class="muted small"><span class="num">₺${fmtQ(+x.try||0)}</span> <span>/ month</span></div>`:'<b class="price">$0</b> <div class="muted small">₺0</div>'};
function planStatusText(p){
  if(!p)return'';if(p.complimentary)return `<span class="tag paid">Complimentary</span>`;
  if(p.state==='trial')return `<span class="tag">Free trial</span> <span class="muted small">until ${fmtD(p.trial_ends)}</span>`;
  if(p.state==='expired')return `<span class="tag overdue">Ended</span>`;
  if(p.plan==='free')return `<span class="tag">Free</span>`;
  return `<span class="tag paid">Active</span> <span class="muted small">paid until ${fmtD(p.paid_until)}</span>`}

async function vBilling(V){
  if(!canAdmin()){V.innerHTML='<div class="note">Only the owner or an administrator can open this page.</div>';return}
  V.innerHTML='<div class="loading">Loading…</div>';
  await reloadPlan();const p=S.plan;
  if(!p){V.innerHTML='<div class="head"><h1>Plan & billing</h1></div><div class="card pad"><p class="muted">Plans are not switched on for this business.</p></div>';return}
  const [cfg,pays]=await Promise.all([API.planConfig(),API.payments(S.biz.id)]);const pl=cfg.plans,owner=S.role==='owner';
  const cur=p.plan;
  const lim=p.users_limit?`${p.users} / ${p.users_limit}`:`${p.users}`;
  V.innerHTML=`<div class="head"><h1>Plan & billing</h1></div><div class="stack">
  <div class="card pad"><div class="planhead"><div><div class="muted small">Current plan</div><h2 style="margin:2px 0 6px">${esc(PLAN_NAME[cur]||cur)}${p.state==='trial'?' <span class="muted small">(trial)</span>':''}</h2>${planStatusText(p)}</div>
    <div class="kv2"><span class="muted small">Users</span><b>${lim}</b></div></div>
    ${p.state==='trial'?`<p class="muted" style="margin-bottom:0"><span>Your free trial is running.</span> <b>${daysLeft(p.trial_ends)===1?'1 day left':daysLeft(p.trial_ends)+' days left'}</b><br><span>Choose a plan before the trial ends to keep working without a break.</span></p>`:''}
    ${p.state==='expired'?`<p class="neg" style="margin-bottom:0">Your plan has ended. The books are read-only. Nothing is deleted. Choose a plan below to continue.</p>`:''}
    ${p.requested_plan?`<div class="note" style="margin:12px 0 0"><b>Waiting for payment: ${esc(PLAN_NAME[p.requested_plan])}</b><br><span>We switch it on as soon as your payment arrives.</span></div>`:''}</div>
  <div class="plans">${['free','basic','pro'].map(k=>{const isCur=k===cur&&p.state!=='trial'&&p.state!=='expired';
    return `<div class="card pad plancard ${k==='pro'?'best':''} ${isCur?'cur':''}"><div class="plantop"><h2>${PLAN_NAME[k]}</h2>${k==='pro'?(EXCHANGE_ON?'<span class="tag">For travel & exchange</span>':'<span class="tag">For travel agencies</span>'):''}</div>
    <div class="planprice">${fmtPrice(pl,k)}</div><ul class="planlist">${planFeatures(k,pl).map(f=>`<li>${esc(f)}</li>`).join('')}</ul>
    ${isCur?'<button class="btn" type="button" disabled>Your plan</button>':k==='free'?(owner?'<button class="btn" type="button" id="goFree">Choose Free</button>':'<p class="muted small">Only the owner can choose Free.</p>'):`<button class="btn ${k==='pro'?'primary':''}" type="button" data-req="${k}">Choose ${PLAN_NAME[k]}</button>`}</div>`}).join('')}</div>
  <div class="card pad" id="payBox" ${p.requested_plan?'':'hidden'}><h2>How to pay</h2><p style="white-space:pre-line">${esc((cfg.billing&&cfg.billing.instructions)||'Pay by bank transfer or in cash, then send the receipt on WhatsApp. We switch on your plan the same day.')}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${SUPPORT.wa?`<a class="btn primary" id="payWa" target="_blank" rel="noopener" href="#">Send on WhatsApp</a>`:''}${SUPPORT.email?`<a class="btn" id="payMail" href="#">Email</a>`:''}</div></div>
  <div class="card scroll"><h2 style="padding:14px 18px 0">Payments</h2><table><thead><tr><th>Date</th><th>Plan</th><th>Period</th><th class="num">Amount</th></tr></thead><tbody>
    ${pays.map(x=>`<tr><td class="mono">${fmtD(x.created_at)}</td><td>${esc(PLAN_NAME[x.plan]||x.plan)} · ${x.months} ${x.months===1?'month':'months'}</td><td class="mono muted">${fmtD(x.paid_from)} – ${fmtD(x.paid_until)}</td><td class="num">${x.amount!=null?fmtQ(+x.amount)+' '+esc(x.currency||''):''}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">No payments yet</td></tr>'}</tbody></table></div>
  <p class="muted small">Prices are per business per month. Questions? Contact Falak Hesab support from Help & Support.</p></div>`;
  const msg=k=>`Hello Falak Hesab, I want the ${PLAN_NAME[k]} plan for "${S.biz.name}" (${String(S.biz.id).slice(0,8)}). My email: ${API.user.email}`;
  const showPay=k=>{const b=$('#payBox');b.hidden=false;const w=$('#payWa');if(w)w.href=supportWa(msg(k));const m=$('#payMail');if(m)m.href=supportMail('Falak Hesab – '+PLAN_NAME[k]+' plan',msg(k));b.scrollIntoView({behavior:'smooth',block:'nearest'})};
  if(p.requested_plan)showPay(p.requested_plan);
  $$('[data-req]').forEach(bt=>bt.onclick=async()=>{const k=bt.dataset.req;bt.disabled=true;
    try{await API.requestPlan(S.biz.id,k);await reloadPlan();toast(lookupOr('Request sent. Now pay and send us the receipt.'));await vBilling(V);showPay(k)}catch(x){toast(x.message);bt.disabled=false}});
  const gf=$('#goFree');if(gf)gf.onclick=()=>confirmBox(lookupOr('Switch to the Free plan? Free allows 1 user and no company address. Travel becomes read-only.'),async()=>{
    try{await API.chooseFree(S.biz.id);await reloadPlan();S.biz.slug=null;toast(lookupOr('You are now on the Free plan'));router()}catch(x){toast(x.message)}},lookupOr('Choose Free'));
}

/* ---------- super admin: plans & payments ---------- */
async function adminPlansHtml(businesses,owner){
  const [{subs,payments},cfg]=await Promise.all([API.adminPlans(),API.planConfig()]);
  if(!subs)return {html:`<div class="card pad"><h2>Plans & payments</h2><p class="muted" style="margin:0">Plans are not switched on yet. Run step 7 in Supabase (project falak-io), then <span class="mono">notify pgrst, 'reload schema';</span></p></div>`,bind(){}};
  const pl=cfg.plans,sub=id=>subs.find(s=>s.business_id===id),now=Date.now();
  const stateOf=s=>!s?'active':s.complimentary||s.plan==='free'||(s.paid_until&&s.paid_until>=today())?'active':(s.trial_ends&&new Date(s.trial_ends)>now)?'trial':'expired';
  const label=s=>{if(!s)return'<span class="muted">—</span>';const st=stateOf(s);
    return `<b>${esc(PLAN_NAME[s.plan])}</b> ${s.complimentary?'<span class="tag paid">Complimentary</span>':st==='trial'?`<span class="tag">Trial · ${daysLeft(s.trial_ends)}d</span>`:st==='expired'?'<span class="tag overdue">Ended</span>':s.plan==='free'?'':`<span class="muted small">to ${fmtD(s.paid_until)}</span>`}${s.requested_plan?` <span class="tag warn">Wants ${esc(PLAN_NAME[s.requested_plan])}</span>`:''}`};
  const income={};payments.forEach(x=>{if(x.amount!=null){const c=x.currency||'';income[c]=(income[c]||0)+(+x.amount)}});
  const counts={trial:0,active:0,expired:0,paid:0};subs.forEach(s=>{counts[stateOf(s)]++;if(!s.complimentary&&s.paid_until&&s.paid_until>=today())counts.paid++});
  const reqs=subs.filter(s=>s.requested_plan);
  const html=`<div class="card pad" id="plansAdmin"><h2>Plans & payments</h2>
    <div class="kpis" style="margin-bottom:14px">${[['Paying',counts.paid],['On trial',counts.trial],['Ended',counts.expired],['Received',Object.entries(income).map(([c,v])=>fmtQ(v)+' '+esc(c)).join(' · ')||'0']].map(([l,v])=>`<div class="card pad kpi"><div class="muted small">${l}</div><span class="num">${v}</span></div>`).join('')}</div>
    ${reqs.length?`<div class="note" style="margin:0 0 14px"><b>Waiting for payment:</b> ${reqs.map(s=>{const b=businesses.find(x=>x.id===s.business_id);return b?`${esc(b.name)} → ${esc(PLAN_NAME[s.requested_plan])}`:''}).filter(Boolean).join(' · ')}</div>`:''}
    <div class="scroll"><table><thead><tr><th>Business</th><th>Plan</th><th>Owner</th><th></th></tr></thead><tbody>
    ${businesses.map(b=>`<tr><td>${esc(b.name)}</td><td>${label(sub(b.id))}</td><td class="muted">${esc(owner(b))}</td><td><button class="btn sm" type="button" data-plan="${b.id}">Manage</button></td></tr>`).join('')}</tbody></table></div>
    <div id="planPanel"></div>
    <details style="margin-top:16px"><summary><b>Prices and payment instructions</b></summary>
      <form id="priceForm" style="margin-top:12px"><div class="scroll"><table><thead><tr><th>Plan</th><th>Users (0 = unlimited)</th><th>USD / month</th><th>TRY / month</th></tr></thead><tbody>
      ${['free','basic','pro'].map(k=>`<tr><td><b>${PLAN_NAME[k]}</b></td><td>${inp('pu_'+k,(pl[k]||{}).users,'type="number" min="0" step="1"')}</td><td>${k==='free'?'0':inp('pd_'+k,(pl[k]||{}).usd,'type="number" min="0" step="0.01"')}</td><td>${k==='free'?'0':inp('pt_'+k,(pl[k]||{}).try,'type="number" min="0" step="0.01"')}</td></tr>`).join('')}</tbody></table></div>
      <div class="grid" style="margin-top:12px">${fld('Free trial days for new businesses',inp('pTrial',pl.trialDays||30,'type="number" min="0" max="365"'))}</div>
      ${fld('Payment instructions shown to customers (bank, IBAN, cash office…)',`<textarea id="pInstr">${esc((cfg.billing||{}).instructions||'')}</textarea>`)}
      <div class="actions" style="justify-content:flex-start"><div><button class="btn primary" type="submit">Save prices</button></div></div></form></details></div>`;
  const bind=()=>{
    $$('[data-plan]').forEach(bt=>bt.onclick=()=>{const b=businesses.find(x=>x.id===bt.dataset.plan),s=sub(b.id),bp=payments.filter(x=>x.business_id===b.id);
      $('#planPanel').innerHTML=`<div class="card pad planpanel"><h2>${esc(b.name)}</h2><div style="margin-bottom:10px">${label(s)}</div>
        <form id="mpForm"><div class="grid">${fld('Plan',`<select id="mpPlan"><option value="basic" ${s&&s.requested_plan==='basic'?'selected':''}>Basic</option><option value="pro" ${!s||s.requested_plan!=='basic'?'selected':''}>Pro</option></select>`)}
          ${fld('Months',`<select id="mpMonths">${[1,3,6,12].map(m=>`<option value="${m}">${m}</option>`).join('')}</select>`)}
          ${fld('Amount received',inp('mpAmt','','type="number" min="0" step="0.01"'))}${fld('Currency',`<select id="mpCur"><option>USD</option><option>TRY</option></select>`)}
          ${fld('Note (e.g. bank transfer, cash)',inp('mpNote',''),'span2')}</div>
          <div class="actions" style="justify-content:flex-start"><div><button class="btn primary" type="submit">Mark as paid</button></div></div></form>
        <div class="muted small" style="margin:6px 0">Other actions</div><div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn sm" type="button" data-act="extend_trial" data-val="7">+7 days trial</button><button class="btn sm" type="button" data-act="extend_trial" data-val="30">+30 days trial</button>
          <button class="btn sm" type="button" data-act="complimentary" data-val="${s&&s.complimentary?'false':'true'}">${s&&s.complimentary?'Stop complimentary':'Make complimentary'}</button>
          <button class="btn sm" type="button" data-act="plan" data-val="free">Set Free</button><button class="btn sm danger" type="button" data-act="end" data-val="1">End now</button></div>
        ${bp.length?`<div class="scroll" style="margin-top:12px"><table><thead><tr><th>Date</th><th>Plan</th><th>Period</th><th class="num">Amount</th><th>Note</th></tr></thead><tbody>${bp.map(x=>`<tr><td class="mono">${fmtD(x.created_at)}</td><td>${esc(PLAN_NAME[x.plan])} · ${x.months}</td><td class="mono muted">${fmtD(x.paid_from)} – ${fmtD(x.paid_until)}</td><td class="num">${x.amount!=null?fmtQ(+x.amount)+' '+esc(x.currency||''):''}</td><td class="muted">${esc(x.note||'')}</td></tr>`).join('')}</tbody></table></div>`:''}</div>`;
      const pp=$('#planPanel');pp.scrollIntoView({behavior:'smooth',block:'nearest'});
      const pr=(pl[val('mpPlan')]||{});$('#mpAmt').value=+pr.usd||'';$('#mpPlan').onchange=$('#mpMonths').onchange=$('#mpCur').onchange=()=>{const x=pl[val('mpPlan')]||{};$('#mpAmt').value=((val('mpCur')==='TRY'?+x.try:+x.usd)||0)*(+val('mpMonths'))||''};
      const done=async m=>{toast(m);if(S.biz&&S.biz.id===b.id)await reloadPlan();router()};
      $('#mpForm').onsubmit=async e=>{e.preventDefault();try{const r=await API.markPaid(b.id,val('mpPlan'),+val('mpMonths'),val('mpAmt')===''?null:+val('mpAmt'),val('mpCur'),val('mpNote'));done(lookupOr('Payment saved. Paid until')+' '+fmtD(r.paid_until))}catch(x){toast(x.message)}};
      $$('#planPanel [data-act]').forEach(x=>x.onclick=()=>{const go2=async()=>{try{await API.adminSet(b.id,x.dataset.act,x.dataset.val);done(lookupOr('Saved'))}catch(err){toast(err.message)}};
        x.dataset.act==='end'?confirmBox(lookupOr('End the plan now? The books of this business become read-only.'),go2,lookupOr('End now')):go2()})});
    $('#priceForm').onsubmit=async e=>{e.preventDefault();const n=id=>Math.max(0,+val(id)||0);
      const plans={free:{users:n('pu_free'),usd:0,try:0},basic:{users:n('pu_basic'),usd:n('pd_basic'),try:n('pt_basic')},pro:{users:n('pu_pro'),usd:n('pd_pro'),try:n('pt_pro')},trialDays:Math.min(365,n('pTrial'))};
      try{await API.saveConfig('plans',plans);await API.saveConfig('billing',{instructions:$('#pInstr').value});toast(lookupOr('Prices saved'))}catch(x){toast(x.message)}};
  };
  return {html,bind};
}
