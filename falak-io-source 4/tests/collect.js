const { chromium } = require('playwright');const fs=require('fs');
(async()=>{
 const b=await chromium.launch();const set=new Set();
 const grab=async p=>{const arr=await p.evaluate(()=>{const out=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(w.nextNode()){const n=w.currentNode,pe=n.parentElement;if(!pe||['SCRIPT','STYLE','TEXTAREA','PRE'].includes(pe.tagName)||pe.closest('.notr'))continue;const t=n.nodeValue.trim();if(t)out.push(t)}
   document.querySelectorAll('[placeholder],[aria-label],[title]').forEach(e=>['placeholder','aria-label','title'].forEach(a=>{const v=e.getAttribute(a);if(v&&v.trim())out.push(v.trim())}));return out});arr.forEach(x=>set.add(x))};
 const p=await b.newPage({viewport:{width:1300,height:900}});await p.route(/fonts\.g/,r=>r.abort());
 await p.goto('file://'+process.cwd()+'/site/index.html');await p.waitForTimeout(700);
 const nav=async h=>{await p.evaluate(h=>location.hash=h,h);await p.waitForTimeout(120);await grab(p)};
 const types=['bank','receipt','payment','transfer','customer','supplier','quote','salesorder','salesinvoice','recurringinvoice','creditnote','deliverynote','purchaseorder','purchaseinvoice','debitnote','goodsreceipt','item','writeoff','employee','payslip','expenseclaim','fixedasset','depreciation','journal','project','account','taxcode','currency'];
 const ids=await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('falak_io_demo_v2'));const m={};d.records.forEach(r=>{m[r.type]=m[r.type]||r.id});return m});
 for(const t of types){await nav('#/'+t);await nav('#/'+t+'/new');if(ids[t]){await nav(`#/${t}/edit/${ids[t]}`);await nav(`#/${t}/view/${ids[t]}`)}}
 for(const r of ['summary','reports','reports/trial','reports/gl','reports/pl-month','reports/project','reports/aged-ar','reports/aged-ap','reports/inventory','reports/tax','settings','users','admin','profile','businesses','history','bank/reconcile/'+ids.bank,'bank/import/'+ids.bank,'ledger/view/'+encodeURIComponent('ar:'+ids.customer)])await nav('#/'+r);
 await nav('#/users');await p.click('#addU');await grab(p);
 await nav('#/businesses');await p.click('#addBiz');await grab(p);
 await nav('#/bank/import/'+ids.bank);await p.fill('#iText','Date;Description;Amount\n05/10/2026;X;250,00');await p.click('#iRead');await grab(p);await p.click('#iPrev');await grab(p);
 await nav('#/salesinvoice/view/'+ids.salesinvoice);await p.click('#shareBtn');await p.waitForTimeout(200);await grab(p);
 // auth screens with mock
 const p2=await b.newPage();await p2.route(/fonts\.g/,r=>r.abort());
 await p2.route(/supabase-js/,r=>r.fulfill({body:fs.readFileSync('mock-supabase.js','utf8'),contentType:'application/javascript'}));
 await p2.route(/config\.js$/,r=>r.fulfill({body:"window.FALAK_CONFIG={supabaseUrl:'https://x.supabase.co',supabaseAnonKey:'k'}",contentType:'application/javascript'}));
 await p2.goto('file://'+process.cwd()+'/site/index.html');await p2.waitForTimeout(500);
 for(const m of ['login','signup','forgot','reset']){await p2.evaluate(h=>location.hash=h,'#/'+m);await p2.waitForTimeout(150);await grab(p2)}
 await p2.evaluate(()=>location.hash='#/share/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');await p2.waitForTimeout(300);await grab(p2);
 fs.writeFileSync('strings-dom.json',JSON.stringify([...set],null,0));console.log(set.size);await b.close()})();
