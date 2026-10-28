/* ================= Falak Hesab — public website: home, privacy, terms ================= */
const appLink=h=>location.protocol==='file:'?h:'/'+h;                 // links from public pages into the app
const demoLink=()=>location.protocol==='file:'?'?demo=1':'/?demo=1';
const SITE_TITLE='Falak Hesab – online accounting for small businesses, and travel agencies';
const LEGAL_UPDATED='28/10/2026';

function siteNav(){return `<header class="snav"><div class="swrap snavin">
  <a class="sbrand" href="${appLink('#/home')}"><span class="mark"><img src="logo-mark.png" alt="" width="240" height="179"></span><span>Falak Hesab</span></a>
  <nav class="slinks" aria-label="Website"><a href="${appLink('#/home')}" data-sec="features">Features</a><a href="${appLink('#/home')}" data-sec="pricing">Pricing</a><a href="${appLink('#/home')}" data-sec="security">Security</a><a href="${appLink('#/home')}" data-sec="faq">FAQ</a></nav>
  <div class="sact">${langPicker('langSite')}<a class="btn" href="${appLink('#/login')}">Sign in</a><a class="btn primary" href="${appLink('#/signup')}">Try free</a></div></div></header>`}
function siteFoot(){return `<footer class="sfoot"><div class="swrap sfootin">
  <div><a class="sbrand" href="${appLink('#/home')}"><span class="mark"><img src="logo-mark.png" alt="" width="240" height="179"></span><span>Falak Hesab</span></a>
    <p class="muted small">Online accounting made in Istanbul by Falak Travel.</p></div>
  <div class="sfcols"><div><b>Product</b><a href="${appLink('#/home')}" data-sec="features">Features</a><a href="${appLink('#/home')}" data-sec="pricing">Pricing</a><a href="${demoLink()}">Demo</a><a href="${appLink('#/signup')}">Create an account</a></div>
    <div><b>Company</b><a href="${appLink('#/home')}" data-sec="about">About us</a><a href="${appLink('#/home')}" data-sec="contact">Contact</a><a href="${appLink('#/home')}" data-sec="faq">FAQ</a></div>
    <div><b>Legal</b><a href="${location.protocol==='file:'?'#/privacy':'/privacy'}">Privacy Policy</a><a href="${location.protocol==='file:'?'#/terms':'/terms'}">Terms of Service</a></div></div></div>
  <div class="swrap sfbot muted small"><span>© 2026 Falak Travel · Istanbul</span><span>falakhesab.com</span></div></footer>`}
const ic=n=>({invoice:'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7',expense:'M4 7h16v12H4zM4 11h16M8 15h3',bank:'M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18',report:'M5 20V10M10 20V4M15 20v-7M20 20V8',fx:'M7 7h11l-3-3M17 17H6l3 3',team:'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6M2 20c0-3 3-5 6-5s6 2 6 5M14 15c3 0 6 2 6 5',plane:'M2 16l20-8-4 10-5-3-3 4-1-5z',swap:'M4 8h13l-3-3M20 16H7l3 3',box:'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',people:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',lock:'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',cloud:'M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11-1 4.5 4.5 0 0 0 1 9z',download:'M12 4v11M7 10l5 5 5-5M5 20h14',history:'M4 12a8 8 0 1 0 3-6.3M4 4v5h5M12 8v5l3 2',shield:'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z',phone:'M8 3h8v18H8zM11 18h2'}[n]);
const svgI=n=>`<svg class="sico" viewBox="0 0 24 24" aria-hidden="true"><path d="${ic(n)}"/></svg>`;

function vPublic(page){
  $('#appView').hidden=true;const A=$('#authView');A.hidden=false;A.className='site';
  const go2=sec=>{const el=document.getElementById('s-'+sec);if(el)el.scrollIntoView({behavior:'smooth',block:'start'})};
  if(page==='privacy'||page==='terms'){document.title=(page==='privacy'?'Privacy Policy':'Terms of Service')+' · Falak Hesab';
    A.innerHTML=siteNav()+`<main class="swrap slegal">${page==='privacy'?privacyHtml():termsHtml()}</main>`+siteFoot();bindSite(go2);window.scrollTo(0,0);return}
  document.title=SITE_TITLE;
  const feats=[
    ['invoice','Sales and invoices','Quotes, sales orders, invoices, credit notes, delivery notes and recurring invoices. Send customer statements and share documents on WhatsApp.'],
    ['expense','Purchases and expenses','Supplier invoices, purchase orders, payments, goods receipts and staff expense claims.'],
    ['bank','Bank and cash','All your bank and cash accounts, transfers between them, bank statement import (CSV) and reconciliation.'],
    ['report','Reports','Balance sheet, profit and loss, cash flow, trial balance, general ledger, aged receivables and payables, comparisons and statements.'],
    ['fx','Many currencies','Work in your base currency and also in USD, EUR, AFN, TRY or any other, with your own exchange rates.'],
    ['team','Your team, your rules','Owner, administrator, limited user or view only. Limited users change only the tabs you choose. Changes appear for everyone straight away.'],
    ['plane','For travel agencies','Tickets with passenger, PNR and route, airlines, sub-agents, refunds, profit per ticket, upcoming flights and ticket receipts.'],
    ['box','Inventory, payroll and assets','Stock items, employees and payslips, fixed assets and depreciation, projects and tax codes (KDV / VAT).']];
  const who=[['Small businesses','Shops, offices and service companies that want clear books without an accountant at every step.'],['Travel agencies','Sell tickets to walk-in customers and sub-agents and see what every airline and agent owes.']];
  const sec=[
    ['lock','Encrypted connection','Every page and every request uses HTTPS.'],
    ['shield','Each business is separate','Database rules keep every business’s books apart. Only the people you add can open yours.'],
    ['people','Two-step login','Owners and staff can protect their account with a 6-digit code from an authenticator app.'],
    ['cloud','Daily backups','The database is backed up automatically every day and backups are kept for 7 days.'],
    ['history','History and recycle bin','Every change is recorded with who made it. Deleted items can be restored for 30 days.'],
    ['invoice','Lock date','Close a period so nobody can change old transactions by mistake.'],
    ['phone','Automatic sign-out','On shared computers Falak Hesab signs out after 60 minutes without activity.'],
    ['team','We can’t see your password','Passwords are stored by our sign-in provider in encrypted form. We never see them.']];
  const faq=[
    ['Is there a free plan?','Yes. The Free plan is free forever for one user and includes all accounting. Basic and Pro start with a 30-day free trial.'],
    ['Do I need a bank card to start?','No. You create an account with your email. There are no automatic charges.'],
    ['How do I pay?','By bank transfer or in cash. You can pay for 1, 3, 6 or 12 months. We switch your plan on as soon as we receive your payment.'],
    ['What happens if I stop paying?','Nothing is deleted. Your books become read-only: you can still open, print and download everything. You can also switch to the Free plan.'],
    ['Can I take my data with me?','Yes. Download a full backup file of your business at any time, export any list or report for Excel (CSV), and print or save any document as PDF.'],
    ['Which languages are there?','English, Dari, Pashto and Turkish. Each person chooses their own language.'],
    ['Can my staff use it at the same time?','Yes. Add their email in Users & Access and choose what they may use. On Basic and Pro your business also gets its own sign-in page, for example falakhesab.com/your-company.'],
    ['Does it work on a phone?','Yes. Falak Hesab works in the browser on phones, tablets and computers. There is nothing to install.'],
    ['Can I move from Manager.io or Excel?','Contact us. We have moved a Manager.io business into Falak Hesab before and can help you with yours.'],
    ['Does Falak Hesab send e-Fatura or e-Arşiv invoices?','Not yet. Falak Hesab does not send invoices to the Turkish tax system (GİB). Ask your accountant whether you need e-Fatura or e-Arşiv.'],
    ['Where is my data stored?','In a professional cloud database (Supabase, PostgreSQL). The website is hosted by Netlify. See the Privacy Policy for details.']];
  A.innerHTML=siteNav()+`<main>
  <section class="shero"><div class="swrap sherogrid"><div>
    <p class="skick">Online accounting · English · دری · پښتو · Türkçe</p>
    <h1>Clear books for your business or travel agency</h1>
    <p class="slead">Invoices, expenses, bank and cash, reports and many currencies in one simple online system. Work together with your team from any phone or computer.</p>
    <div class="scta"><a class="btn primary big" href="${appLink('#/signup')}">Try free</a><a class="btn big" href="${demoLink()}">View demo</a></div>
    <p class="muted small">No card needed. Free plan forever, or try Basic and Pro free for 30 days.</p></div>
    <figure class="shot hero"><div class="shotbar"><i></i><i></i><i></i><span>falakhesab.com</span></div><img src="img/summary.jpg" alt="Falak Hesab summary: balance sheet and profit and loss" width="1280" height="800" fetchpriority="high"></figure></div></section>
  <section class="ssec" id="s-features"><div class="swrap"><h2>Everything a small business needs</h2><p class="slead">Built like the accounting programs accountants know, with double-entry books behind every screen, but simple to use.</p>
    <div class="sfeat">${feats.map(([i,t,d])=>`<div class="sfc">${svgI(i)}<h3>${t}</h3><p>${d}</p></div>`).join('')}</div></div></section>
  <section class="ssec alt"><div class="swrap"><h2>See it before you sign up</h2><p class="slead">Real screens from Falak Hesab. Open the demo to try it yourself with sample data.</p>
    <div class="stabs" role="tablist">${[['summary','Summary'],['invoice','Invoice'],['travel','Travel'],['report','Reports']].map(([k,l],i)=>`<button type="button" role="tab" class="stab ${i?'':'on'}" data-shot="${k}">${l}</button>`).join('')}</div>
    <figure class="shot"><div class="shotbar"><i></i><i></i><i></i><span>falakhesab.com</span></div><img id="shotImg" src="img/summary.jpg" alt="Falak Hesab screen" width="1280" height="800" loading="lazy"></figure>
    <div class="scta center"><a class="btn primary big" href="${demoLink()}">Open the demo</a></div></div></section>
  <section class="ssec"><div class="swrap"><h2>Made for</h2><div class="swho">${who.map(([t,d])=>`<div class="card pad"><h3>${t}</h3><p class="muted">${d}</p></div>`).join('')}</div>
    <div class="sexample card pad"><h3>A day at a travel agency</h3><ol><li>Sell a ticket to a sub-agent: passenger, PNR, airline, price and cost on one screen.</li><li>Falak Hesab books the sale, the airline cost and your profit automatically.</li><li>Send the sub-agent their statement on WhatsApp at the end of the week.</li><li>See what every airline and sub-agent owes on the Travel overview.</li></ol><p class="muted small" style="margin-bottom:0">Falak Travel in Istanbul runs its own books this way every day.</p></div></div></section>
  <section class="ssec alt" id="s-pricing"><div class="swrap"><h2>Simple prices</h2><p class="slead">Per business, per month. Pay for 1, 3, 6 or 12 months by bank transfer or cash. No automatic charges and nothing to cancel.</p>
    <div class="plans" id="sPlans"></div>
    <div class="sterms card pad"><h3>If you stop paying</h3><p class="muted" style="margin:0">Nothing is deleted. When your trial or paid time ends, your books become read-only until you pay again. You can still open, print and download everything, or switch to the Free plan (1 user).</p></div></div></section>
  <section class="ssec" id="s-security"><div class="swrap"><h2>Your data is safe and it stays yours</h2><p class="slead">We only list protections that Falak Hesab really has today.</p>
    <div class="sfeat">${sec.map(([i,t,d])=>`<div class="sfc">${svgI(i)}<h3>${t}</h3><p>${d}</p></div>`).join('')}</div>
    <div class="sexport card pad" id="s-export">${svgI('download')}<div><h3>Take your data with you at any time</h3><ul><li>Download a complete backup file of your business from Settings (JSON). You can import it again into a new business.</li><li>Export any list or report for Excel, Google Sheets or LibreOffice (CSV).</li><li>Print or save any invoice, statement or report as PDF.</li><li>If you leave, your books stay readable so you can take everything. The owner can delete the business completely from Settings.</li></ul></div></div></div></section>
  <section class="ssec alt" id="s-about"><div class="swrap sabout"><div><h2>Who runs Falak Hesab</h2><p>Falak Hesab is made in Istanbul by Falak Travel, a travel agency that keeps its own books in Falak Hesab every day. We built it because we needed simple accounting in our own languages for travel work, and we use what we build.</p>
      <p class="muted">Customer reviews will appear here when our first customers share them. We don’t publish made-up reviews.</p></div>
    <div class="card pad" id="s-contact"><h3>Contact and support</h3><p class="muted">Questions before you start, or help with your books? Write to us.</p>
      <div class="scta">${SUPPORT.wa?`<a class="btn primary" href="${supportWa('Hello Falak Hesab, I have a question about Falak Hesab.')}" target="_blank" rel="noopener">WhatsApp ${esc(SUPPORT.phone)}</a>`:''}${SUPPORT.email?`<a class="btn" href="${supportMail('Falak Hesab – question')}">${esc(SUPPORT.email)}</a>`:''}</div></div></div></section>
  <section class="ssec" id="s-faq"><div class="swrap snarrow"><h2>Questions and answers</h2>${faq.map(([q,a2])=>`<details class="sfaq"><summary>${q}</summary><p>${a2}</p></details>`).join('')}</div></section>
  <section class="ssec sfinal"><div class="swrap center"><h2>Start with your own books today</h2><p class="slead">Free plan forever. Basic and Pro free for 30 days. No card needed.</p><div class="scta center"><a class="btn primary big" href="${appLink('#/signup')}">Try free</a><a class="btn big" href="${demoLink()}">View demo</a></div></div></section>
  </main>`+siteFoot();
  bindSite(go2);
  $$('.stab').forEach(b=>b.onclick=()=>{$$('.stab').forEach(x=>x.classList.toggle('on',x===b));$('#shotImg').src='img/'+b.dataset.shot+'.jpg'});
  const paintPlans=pl=>{$('#sPlans').innerHTML=['free','basic','pro'].map(k=>`<div class="card pad plancard ${k==='pro'?'best':''}"><div class="plantop"><h2>${PLAN_NAME[k]}</h2>${k==='pro'?'<span class="tag">For travel agencies</span>':''}</div>
      <div class="planprice">${fmtPrice(pl,k)}</div><ul class="planlist">${planFeatures(k,pl).map(f=>`<li>${esc(f)}</li>`).join('')}</ul>
      <a class="btn ${k==='pro'?'primary':''}" href="${appLink('#/signup/'+k)}">${k==='free'?'Start free':'Try free for 30 days'}</a></div>`).join('')};
  paintPlans(DEFAULT_PLANS);if(CLOUD)API.planConfig().then(c=>paintPlans(c.plans||DEFAULT_PLANS)).catch(()=>{});
  const want=(location.hash.match(/^#\/home\/(\w+)/)||[])[1];if(want)setTimeout(()=>go2(want),60);else window.scrollTo(0,0);
}
function bindSite(go2){bindLangPicker('langSite');
  $$('#authView [data-sec]').forEach(a=>a.onclick=e=>{if(!$('#s-features')){a.href=appLink('#/home/'+a.dataset.sec);return}e.preventDefault();go2(a.dataset.sec)})}

function privacyHtml(){const em=esc(SUPPORT.email||'');return `<p class="note">Draft · last updated ${LEGAL_UPDATED}. This first version describes how Falak Hesab works today. It will be reviewed by a lawyer.</p>
<h1>Privacy Policy</h1>
<p>Falak Hesab (falakhesab.com) is an online accounting service run by Falak Travel, Istanbul, Türkiye ("we"). This policy explains what personal data we process, why, and what rights you have, including under the Turkish Personal Data Protection Law (KVKK, Law No. 6698).</p>
<h2>1. Who is responsible</h2><p>Data controller for account data: Falak Travel, Istanbul. Contact: ${em}${SUPPORT.phone?` · WhatsApp ${esc(SUPPORT.phone)}`:''}. For the accounting records a business enters (customers, suppliers, employees and so on), that business is responsible for the data and we process it on its behalf.</p>
<h2>2. What we process</h2><ul>
<li><b>Account data:</b> your email address and the date you signed up. Your password is stored only in encrypted (hashed) form by our sign-in provider. We never see it.</li>
<li><b>Two-step login:</b> if you turn it on, the secret for your authenticator app is stored by our sign-in provider.</li>
<li><b>Business records:</b> everything you and your team type into Falak Hesab: business details and logo, customers, suppliers, invoices, payments, employees, payslips and other records, plus a history of changes with the email of who made them.</li>
<li><b>Plan and payments:</b> your plan, trial dates and the payments we record by hand. We do not collect card details.</li>
<li><b>Technical data:</b> our hosting and database providers keep standard server logs, such as IP address, browser type and time of request, for security and to keep the service running.</li>
<li><b>Your browser:</b> Falak Hesab saves your sign-in session, chosen language and last opened business in your browser’s storage. We don’t use advertising or tracking cookies.</li></ul>
<h2>3. Why we process it</h2><ul><li>To provide the service you asked for: your account, your books, your team’s access (performance of a contract).</li><li>To keep the service secure, prevent misuse and fix problems (legitimate interest).</li><li>To answer your questions and record your payments (contract and legal obligations).</li></ul><p>We do not sell your data and we do not use your business records for advertising.</p>
<h2>4. Service providers</h2><p>We use these providers to run Falak Hesab. Their servers may be located outside Türkiye.</p><ul><li><b>Supabase</b>: database, sign-in and daily backups.</li><li><b>Netlify</b>: website hosting.</li><li><b>Google Fonts</b>: the letters you see on the screen are loaded from Google, which receives your IP address.</li><li><b>WhatsApp and email</b>: only when you choose to contact us or to share a document.</li></ul>
<h2>5. How long we keep data</h2><p>Your business records are kept until the owner deletes the business or asks us to delete the account. Database backups are kept for 7 days, so deleted data disappears from backups within about a week. Deleted records stay in the in-app recycle bin for 30 days.</p>
<h2>6. Security</h2><p>HTTPS on every connection, separation of businesses by database rules, roles and permissions, optional two-step login, daily backups, a change history and automatic sign-out after 60 minutes without activity.</p>
<h2>7. Your rights</h2><p>You can ask to see, correct, export or delete your personal data, ask how it is processed, and object to processing, as described in article 11 of KVKK. You can export your business data yourself at any time (Settings → Backup). For anything else, write to ${em}. You may also complain to the Turkish Personal Data Protection Authority (KVKK).</p>
<h2>8. Changes</h2><p>We will show important changes to this policy in Falak Hesab before they take effect.</p>`}

function termsHtml(){const em=esc(SUPPORT.email||'');return `<p class="note">Draft · last updated ${LEGAL_UPDATED}. This first version will be reviewed by a lawyer.</p>
<h1>Terms of Service</h1>
<p>These terms apply when you use Falak Hesab (falakhesab.com), an online accounting service run by Falak Travel, Istanbul, Türkiye ("we"). By creating an account you agree to them.</p>
<h2>1. The service</h2><p>Falak Hesab lets you keep the books of one or more businesses online and work on them with your team. We may improve and change features over time.</p>
<h2>2. Your account</h2><ul><li>Use a real email address and keep your password secret. We recommend two-step login.</li><li>The owner of a business decides who has access and is responsible for the people they add.</li><li>You must not use Falak Hesab for anything illegal, or try to access businesses that aren’t yours.</li></ul>
<h2>3. Plans, trial and payment</h2><ul><li>The Free plan is free for one user. Basic and Pro are paid per business per month at the prices shown on our website.</li><li>A new account can try Basic or Pro free for 30 days, once per owner.</li><li>You pay in advance by bank transfer or in cash, for 1, 3, 6 or 12 months. There are no automatic charges.</li><li>Payments are not refunded for time already started, unless the law requires it.</li><li>We may change prices. A new price applies from your next payment, and we tell you at least 30 days before.</li></ul>
<h2>4. When a trial or paid period ends</h2><p>Your data is not deleted. The books become read-only until you pay again. You can still open, print and export everything, or switch to the Free plan if it fits your business.</p>
<h2>5. Your data</h2><ul><li>Your business records belong to you. You can download a full backup, export lists and reports, and delete your business at any time.</li><li>We process your data as described in our <a href="${location.protocol==='file:'?'#/privacy':'/privacy'}">Privacy Policy</a>.</li></ul>
<h2>6. Your responsibility for your books</h2><p>Falak Hesab is a tool. You are responsible for the records you enter and for your tax, legal and accounting obligations. Falak Hesab does not give tax or legal advice and does not yet send e-Fatura or e-Arşiv invoices to the Turkish tax system.</p>
<h2>7. Availability</h2><p>We work to keep Falak Hesab available and backed up every day, but we can’t promise it will never be interrupted. Keep your own backup copies of important data.</p>
<h2>8. Liability</h2><p>As far as the law allows, we are not liable for indirect losses, such as lost profit, caused by using or not being able to use Falak Hesab. Our total liability is limited to what you paid us in the last 12 months.</p>
<h2>9. Ending the service</h2><p>You can stop using Falak Hesab at any time. We may suspend accounts that break these terms. If we ever close the service, we will tell you at least 60 days in advance so you can export your data.</p>
<h2>10. Law and contact</h2><p>These terms are governed by the laws of the Republic of Türkiye. Questions: ${em}${SUPPORT.phone?` · WhatsApp ${esc(SUPPORT.phone)}`:''}.</p>`}
