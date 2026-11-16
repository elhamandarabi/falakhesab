/* ================= Falak Hesab — help chatbot ================= */
/* Common questions are answered here in the browser (free, instant, English).
   Everything else goes to the "falak-chat" server function, which asks the AI (Claude) with the Falak Hesab knowledge base. */
const CHAT_KEY='falak_chat_v1';
const CHAT_FN=CLOUD?CFG.supabaseUrl.replace(/\/$/,'')+'/functions/v1/falak-chat':'';
const CHAT_SUGGEST=['How do I create an invoice?','How do I add a staff member?','What do the plans cost?','I forgot my password','How do I back up my books?'];
// [patterns that must ALL appear, answer, [[button, page]]]
const CHAT_FAQ=[
  [[/\b(price|prices|cost|costs|how much|pricing|plans?)\b/],'**Free**: $0, 1 user, all accounting.\n**Basic**: $9 (299 TL) per month, up to 3 users, plus your own company address with your logo.\n**Pro**: $19 (649 TL) per month, unlimited users, plus Travel (tickets, airlines, sub-agents).\nBasic and Pro can be tried free for 30 days. No bank card is needed.',[['Plan & billing','#/billing']]],
  [[/\b(pay|payment|paying)\b/,/\b(plan|subscription|basic|pro|upgrade|falak hesab)\b/],'You pay by bank transfer or in cash, for 1, 3, 6 or 12 months. There are no automatic charges.\n1. Open Business → **Plan & billing**.\n2. Choose Basic or Pro and follow the payment instructions.\n3. Send us the receipt on WhatsApp. We switch your plan on when we receive it.',[['Plan & billing','#/billing']]],
  [[/\b(trial|free)\b/,/\b(end|ends|ended|expire|expired|over|stop|after)\b/],'Nothing is deleted. When a trial or paid plan ends, the books become read-only for everyone: you can still open and print everything, run reports, export and download a backup. Users you added keep view-only access, and the company address keeps working.\nPay in **Plan & billing** to continue. Or the owner can switch to Free (1 user) after removing the other users; then the company address is removed and travel tickets stay read-only.',[['Plan & billing','#/billing']]],
  [[/\b(forgot|forget|reset|lost|change)\b/,/\bpassword\b/],'On the sign-in page press **Forgot password?**, type your email and open the email we send you to set a new password.\nTo change it while signed in: **My account** (bottom of the left menu) → new password → **Change password**.',[['My account','#/profile']]],
  [[/\b(confirm|confirmation|verification|verify)\b/,/\b(email|mail|link)\b/],'After you create an account we send a confirmation email. Wait a few minutes and check your spam or junk folder. Make sure the email address was typed correctly. If it still does not arrive, contact us with "Talk to a person".'],
  [[/\b(can.?t|cannot|unable|not able|problem|error|fail\w*)\b/,/\b(log ?in|sign ?in)\b/],'Check that:\n- the email and password are right (and Caps Lock is off),\n- you confirmed your email with the link we sent,\n- if two-step login is on, you type the 6-digit code from your authenticator app.\nForgot the password? Press **Forgot password?** on the sign-in page. Still stuck? Use "Talk to a person".'],
  [[/\b(two.?step|2fa|two.?factor|authenticator|mfa)\b/],'Open **My account** (bottom of the left menu) → **Turn on two-step login**. Scan the QR code with Google Authenticator or Microsoft Authenticator and type the 6-digit code. After that you type a code from the app each time you sign in.',[['My account','#/profile']]],
  [[/\b(invoice|invoices|bill a customer)\b/,/\b(create|make|new|add|issue|write|send|how)\b/],'1. Open Sales → **Sales Invoices** → **+ New sales invoice**.\n2. Choose the customer. The date, due date and number are filled in.\n3. On each line choose an item or type a description, then quantity and price. Tax and totals are calculated.\n4. Press **Create**. Then you can **Print / PDF** or **Share** a link with the customer.',[['Sales Invoices','#/salesinvoice']]],
  [[/\b(customer|customers|client)\b/,/\b(add|create|new|make)\b/],'Open Sales → **Customers** → **+ New customer**. Fill in the name, email, phone/WhatsApp, address and payment terms (days to pay), then press **Create**.',[['Customers','#/customer']]],
  [[/\b(supplier|suppliers|vendor)\b/,/\b(add|create|new|make)\b/],'Open Purchases → **Suppliers** → **+ New supplier**, fill in the details and press **Create**. Airlines are suppliers too.',[['Suppliers','#/supplier']]],
  [[/\b(receive|received|record|got)\b/,/\b(payment|paid|money)\b/],'Open the sales invoice and press **Receive payment**. The receipt is filled in for you (bank account, customer and invoice). Check the amount and press **Create**. The invoice then shows as Paid.',[['Sales Invoices','#/salesinvoice']]],
  [[/\b(purchase|bill|expense|expenses)\b/,/\b(record|add|enter|create|new)\b/],'For a supplier bill: Purchases → **Purchase Invoices** → **+ New purchase invoice**, choose the supplier and add the lines.\nFor money you paid straight away (rent, fuel, etc.): Money → **Payments** → **+ New payment**, choose the bank or cash account and on the line choose what it was for.',[['Purchase Invoices','#/purchaseinvoice'],['Payments','#/payment']]],
  [[/\b(transfer|move)\b/,/\b(bank|cash|account|accounts)\b/],'Use Money → **Inter Account Transfers** → **+ New transfer**. Choose where the money comes from, where it goes and the amount, then press **Create**.',[['Inter Account Transfers','#/transfer']]],
  [[/\b(staff|user|users|employee access|team|accountant)\b/,/\b(add|invite|give|access|new)\b/],'Open Business → **Users & Access** → **+ Add user**. Type their email and choose the access: Administrator (everything), Limited user (only the tabs you tick) or View only. Then send them the sign-in link. They create a free account with the same email.\nFree allows 1 user, Basic up to 3, Pro unlimited.',[['Users & Access','#/users']]],
  [[/\b(backup|back up|export|download)\b/,/\b(data|books|backup|everything|business)\b/],'Open **Settings** → Backup → **Download backup**. Keep the file safe; you can restore it with **Import backup** on the Businesses page. Any list or report can also be exported for Excel with **Export**.',[['Settings','#/settings']]],
  [[/\b(delete|deleted|remove|removed|undo|restore)\b/,/\b(by mistake|restore|recover|undo|back|recycle)\b/],'Deleted items can be restored for 30 days: open **History** → **Recycle bin** and restore the item.',[['History','#/history']]],
  [[/\b(logo)\b/],'Open **Settings** and upload your logo in the logo box. It appears on every printed invoice, receipt and statement.',[['Settings','#/settings']]],
  [[/\b(language|languages|dari|pashto|turkish|english|farsi|persian)\b/,/\b(language|languages|change|switch|translate|speak|available|support|use)\b/],'Choose the language in the language menu at the bottom of the left menu (or on the sign-in page). Falak Hesab has English, Dari, Pashto and Turkish, and each person can choose their own.'],
  [[/\b(ticket|tickets|pnr)\b/,/\b(sell|sold|add|create|new|record|how)\b/],'Travel needs the Pro plan. Open Travel → **Tickets** → **+ New ticket**. Fill in the passenger, PNR, ticket number, airline and route, choose who you sold it to (customer or sub-agent), the selling price and the cost from the airline. The profit is calculated. Press **Create**; the ticket receipt never shows your cost.',[['Tickets','#/ticket']]],
  [[/\b(report|reports|profit|loss|balance sheet)\b/],'The **Summary** shows your balance sheet and profit and loss; change the dates and press Apply. Open **Reports** for profit by month, aged receivables, cash flow, statements and more. Every report has **Print / PDF** and **Export** for Excel.',[['Reports','#/reports']]],
  [[/\b(statement|statements)\b/],'Open **Reports** → **Customer statements** (or Supplier statements) and choose the person. You can print it, save it as PDF or send it on WhatsApp.',[['Customer statements','#/reports/statements']]],
  [[/\b(lock date|lock)\b/],'In **Settings** set the **Lock date**. Nobody can add or change transactions on or before that date. Owners and administrators can change it.',[['Settings','#/settings']]],
  [[/\b(attach|attachment|attachments|upload|photo|scan)\b/],'Open the invoice, receipt, payment or ticket and press **Add files** in the Attachments box (or drag the file there). Photos, PDF, Word and Excel up to 10 MB each.'],
  [[/\b(company address|own page|own address|subdomain|my company link|custom link)\b/],'On Basic and Pro: **Settings** → **Company address**, for example falakhesab.com/your-company. It is your own sign-in page with your logo; send it to your staff.',[['Settings','#/settings']]],
  [[/\b(e.?fatura|e.?ar[sş]iv|gib)\b/],'Not yet. Falak Hesab does not send e-Fatura or e-Arşiv invoices to the Turkish tax system (GİB). Ask your accountant whether you need them.'],
  [[/\b(app|android|iphone|ios|install|mobile)\b/],'There is nothing to install. Falak Hesab works in the browser on phones, tablets and computers. On a phone you can use "Add to home screen" in the browser menu.'],
  [[/\b(manager\.?io|excel|import|move my data|migrate)\b/],'Contact us with "Talk to a person". We have moved a Manager.io business into Falak Hesab before and can help with yours. You can also import a Falak Hesab backup on the Businesses page, and a bank statement (CSV) in a bank account.'],
  [[/\b(safe|secure|security|privacy|who can see)\b/],'Your books are stored in a professional cloud database (Supabase) with daily backups kept for 7 days. Only the people you add in Users & Access can see your business. Passwords are encrypted and we never see them. Turn on two-step login for extra safety.']
];
const chatNorm=s=>String(s||'').toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ');
function chatLocal(q){
  const t=chatNorm(q);
  if(/^(hi|hello|hey|salam|salaam|merhaba|selam|good (morning|evening|afternoon))\b[\s!.]*$/.test(t))return {a:lookupOr('Hello! How can I help you with Falak Hesab?')};
  if(/^(thanks|thank you|thx|tesekkur|teşekkür|tashakor|merci)\b/.test(t)&&t.length<30)return {a:lookupOr('You are welcome! Ask me anything else.')};
  if(LANG!=='en'||t.length>160)return null;
  let best=null;
  for(const [ps,a,go] of CHAT_FAQ){if(ps.every(p=>p.test(t))){const sc=ps.length;if(!best||sc>best.sc)best={sc,a,go}}}
  // long, specific questions go to the AI; the prepared answers are for short common questions
  const words=t.split(' ').length;if(best&&((best.sc===1&&words>7)||words>12))return null;
  return best;
}
const chatLoad=()=>{try{return JSON.parse(sessionStorage.getItem(CHAT_KEY))||[]}catch(e){return []}};
const chatSave=m=>{try{sessionStorage.setItem(CHAT_KEY,JSON.stringify(m.slice(-30)))}catch(e){}};
function chatFmt(s){
  return esc(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').split('\n').map(l=>l.trim()?`<div dir="auto"${/^\s*(\d+\.|-|•)\s/.test(l)?' class="cl"':''}>${l}</div>`:'<div class="cgap"></div>').join('');
}
function chatInit(){
  if($('#chatBtn')||IN_FRAME)return;
  const b=document.createElement('button');b.id='chatBtn';b.type='button';b.className='noprint';b.setAttribute('aria-label','Help chat');
  b.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z" fill="currentColor"/></svg><span>Help</span>';
  const p=document.createElement('section');p.id='chatBox';p.className='noprint';p.hidden=true;p.setAttribute('aria-label','Falak Hesab help');
  p.innerHTML=`<header><img src="logo-mark.png" alt=""><div><b>Falak Hesab help</b><small>Ask anything about Falak Hesab</small></div><button type="button" id="chatX" aria-label="Close">×</button></header>
  <div id="chatMsgs" class="notr" aria-live="polite"></div>
  <div id="chatSug"></div>
  <form id="chatF"><textarea id="chatIn" rows="1" maxlength="1000" placeholder="Type your question…" aria-label="Your question"></textarea><button class="btn primary" id="chatSend" type="submit" aria-label="Send">➤</button></form>
  <footer><a id="chatWa" target="_blank" rel="noopener" href="#">Talk to a person</a><span>AI answers can be wrong. Never share passwords.</span></footer>`;
  document.body.append(b,p);
  b.onclick=()=>chatOpen(true);$('#chatX').onclick=()=>chatOpen(false);
  $('#chatF').onsubmit=e=>{e.preventDefault();chatAsk($('#chatIn').value)};
  $('#chatIn').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();chatAsk($('#chatIn').value)}};
  $('#chatIn').oninput=e=>{const t=e.target;t.style.height='auto';t.style.height=Math.min(t.scrollHeight,120)+'px'};
  $('#chatMsgs').onclick=e=>{const a=e.target.closest('a[data-go]');if(a){e.preventDefault();if(window.innerWidth<700)chatOpen(false);go(a.dataset.go)}};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!p.hidden)chatOpen(false)});
  setInterval(chatVis,800);chatVis();
}
function chatVis(){const b=$('#chatBtn');if(!b)return;if(chatVis.lang!==LANG){const was=chatVis.lang;chatVis.lang=LANG;if(was&&!$('#chatBox').hidden)chatRender()}const shared=$('#authView')&&$('#authView').classList.contains('sharedwrap');b.hidden=shared||!$('#chatBox').hidden;if(shared)$('#chatBox').hidden=true}
function chatOpen(on){const p=$('#chatBox');p.hidden=!on;chatVis();if(on){chatRender();setTimeout(()=>$('#chatIn').focus(),50)}}
function chatRender(){
  const m=chatLoad(),box=$('#chatMsgs');
  const hello=`<div class="cm bot">${chatFmt(lookupOr('Hello! I am the Falak Hesab assistant. Ask me how to do something, about plans and prices, or about a problem you have.'))}</div>`;
  box.innerHTML=hello+m.map(x=>`<div class="cm ${x.role==='user'?'me':'bot'}${x.err?' cerr':''}">${chatFmt(x.content)}${x.go&&S.biz?`<div class="cgo">${x.go.map(([t,h])=>`<a href="${h}" data-go="${h}" class="btn sm">${esc(lookupOr(t))}</a>`).join('')}</div>`:''}</div>`).join('')+(chatAsk.busy?'<div class="cm bot typing"><i></i><i></i><i></i></div>':'');
  $('#chatSug').innerHTML=m.length?'':CHAT_SUGGEST.map(s=>`<button type="button" class="chip">${esc(lookupOr(s))}</button>`).join('');
  $('#chatSug').querySelectorAll('button').forEach((x,i)=>x.onclick=()=>chatAsk(x.textContent));
  const lastQ=[...m].reverse().find(x=>x.role==='user');
  const ctx=[API.user&&CLOUD?'Account: '+API.user.email:'',S.biz?'Business: '+S.biz.name:''].filter(Boolean).join('\n');
  $('#chatWa').href=SUPPORT.wa?supportWa('Hello Falak Hesab support, I need help'+(lastQ?': '+lastQ.content.slice(0,300):'.')+(ctx?'\n\n'+ctx:'')):supportMail('Falak Hesab help');
  box.scrollTop=box.scrollHeight;
}
async function chatAsk(q){
  q=String(q||'').trim().slice(0,1000);if(!q||chatAsk.busy)return;
  $('#chatIn').value='';$('#chatIn').style.height='auto';
  const m=chatLoad();m.push({role:'user',content:q});chatSave(m);
  const local=chatLocal(q);
  if(local){m.push({role:'assistant',content:local.a,go:local.go,src:'faq'});chatSave(m);chatRender();return}
  chatAsk.busy=true;chatRender();
  let reply,err=false;
  try{
    if(!CHAT_FN)throw Object.assign(new Error('demo'),{code:'demo'});
    let token=CFG.supabaseAnonKey,signedIn=false;
    try{const {data}=await API.sb.auth.getSession();if(data.session){token=data.session.access_token;signedIn=true}}catch(e){}
    const msgs=m.filter(x=>!x.err).slice(-10).map(x=>({role:x.role,content:x.content}));
    const plan=S.plan?(S.plan.super?'complimentary':(S.plan.effective||'')+(S.plan.state?' ('+S.plan.state+')':'')):'';
    const r=await fetch(CHAT_FN,{method:'POST',headers:{'Content-Type':'application/json',apikey:CFG.supabaseAnonKey,Authorization:'Bearer '+token},
      body:JSON.stringify({messages:msgs,lang:LANG,page:(location.hash||'').split('/')[1]||(App.page||'home'),signedIn,plan,role:S.biz?S.role||'':''})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.reply)throw Object.assign(new Error(d.error||('HTTP '+r.status)),{code:d.error||r.status});
    reply=d.reply;
  }catch(e){
    err=true;
    reply=e.code==='limit'?lookupOr('You have asked many questions in a short time. Please wait a little, or use "Talk to a person" to write to us on WhatsApp.')
      :lookupOr('Sorry, I can\'t answer that right now. Please use "Talk to a person" to write to us on WhatsApp or email, and we will help you.');
  }
  chatAsk.busy=false;
  const m2=chatLoad();m2.push({role:'assistant',content:reply,err});chatSave(m2);chatRender();
}

/* Admin → Chat questions (what people ask the chatbot; kept 90 days) */
async function adminChatHtml(){
  const {data,error}=await API.sb.from('chat_log').select('created_at,who,lang,page,question,answer,source,tokens_in,tokens_out').order('created_at',{ascending:false}).limit(150);
  if(error)return `<div class="card pad"><h2>Chat questions</h2><p class="muted">The chatbot log is not switched on yet (run Step 10 in Supabase). <span class="small">[${esc(error.message)}]</span></p></div>`;
  const rows=data||[],day=Date.now()-864e5,today=rows.filter(r=>new Date(r.created_at)>day);
  const ai=today.filter(r=>r.source==='ai'),tin=ai.reduce((a,r)=>a+(r.tokens_in||0),0),tout=ai.reduce((a,r)=>a+(r.tokens_out||0),0);
  const cost=(tin*1+tout*5)/1e6; // claude-haiku-4-5: about $1 per million input and $5 per million output tokens
  const src={ai:'AI',limit:'Limit reached',error:'Error',faq:'Prepared'};
  return `<div class="card scroll"><h2 style="padding:14px 18px 0">Chat questions</h2><p class="muted small" style="padding:0 18px">Last 24 hours: ${ai.length} AI answers, about $${cost.toFixed(2)}. ${today.filter(r=>r.source==='limit').length} people hit the limit. Questions are kept 90 days. Prepared answers in the browser are not listed.</p>
  <table><thead><tr><th>When</th><th>Who</th><th>Lang</th><th>Page</th><th>Question</th><th>Answer</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="mono muted" style="white-space:nowrap">${esc(fmtD(r.created_at))} ${esc(String(r.created_at).slice(11,16))}</td><td>${esc(r.who==='customer'?'Customer':'Visitor')}</td><td>${esc(r.lang||'')}</td><td class="muted">${esc(r.page||'')}</td><td dir="auto" style="max-width:320px">${esc(r.question)}</td><td dir="auto" class="muted small" style="max-width:380px">${r.source==='ai'?esc(String(r.answer||'').slice(0,300)):`<span class="tag">${esc(src[r.source]||r.source)}</span>`}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">No questions yet</td></tr>'}</tbody></table></div>`;
}
