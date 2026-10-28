const { chromium } = require('playwright');
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/ERR_|fonts/.test(m.text()))errs.push(m.text())});
 await p.route(/fonts\.g/,r=>r.abort());
 require('fs').writeFileSync('site/_demo.html',require('fs').readFileSync('site/index.html','utf8').replace('<script src="config.js"></script>','<script>window.FALAK_CONFIG={}</script>'));await p.goto('file://'+process.cwd()+'/site/_demo.html');await p.waitForTimeout(800);
 const nav=async h=>{await p.evaluate(h=>location.hash=h,h);await p.waitForTimeout(150);const t=await p.locator('body').innerText();if(/Something went wrong/.test(t))errs.push(h+': '+t.match(/Something went wrong.*/)[0]);};
 const bal=async()=>{await nav('#/summary');return p.locator('.sheet .ok, .sheet .small.neg').first().textContent()};
 console.log('start',await bal());
 const types=['bank','receipt','payment','transfer','customer','supplier','quote','salesorder','salesinvoice','recurringinvoice','creditnote','deliverynote','purchaseorder','purchaseinvoice','debitnote','goodsreceipt','item','writeoff','employee','payslip','expenseclaim','fixedasset','depreciation','journal','project','account','taxcode','currency'];
 const ids=await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('falak_io_demo_v2'));const m={};d.records.forEach(r=>{m[r.type]=m[r.type]||r.id});return m});
 for(const t of types){await nav('#/'+t);await nav('#/'+t+'/new');if(ids[t]){await nav(`#/${t}/edit/${ids[t]}`);await nav(`#/${t}/view/${ids[t]}`)}}
 for(const r of ['reports','reports/trial','reports/gl','reports/pl-month','reports/project','reports/aged-ar','reports/aged-ap','reports/inventory','reports/tax','settings','users','admin','profile','businesses','history','bank/reconcile/'+ids.bank,'bank/import/'+ids.bank,'ledger/view/'+encodeURIComponent('ar:'+ids.customer)])await nav('#/'+r);
 // recurring generate
 await p.evaluate(()=>{});
 // reconcile: tick all & save
 await nav('#/bank/reconcile/'+ids.bank);await p.check('#rAll');await p.fill('#rStmt','100');await p.click('#rSave');await p.waitForTimeout(400);
 await nav('#/bank');console.log('bank row',(await p.locator('tbody tr').first().innerText()).replace(/\s+/g,' '));
 // import statement
 await nav('#/bank/import/'+ids.bank);
 await p.fill('#iText','Date;Description;Amount\n05/10/2026;Customer XYZ transfer;250,00\n06/10/2026;Bank fee;-12,50');
 await p.click('#iRead');await p.waitForTimeout(100);await p.click('#iPrev');await p.waitForTimeout(150);
 const accs=p.locator('.iAcc');console.log('import rows',await accs.count());
 await accs.nth(0).selectOption({label:'4900 – Other income'});await accs.nth(1).selectOption({label:'6700 – Bank charges'});
 await p.click('#iGo');await p.waitForTimeout(500);console.log('after import',await p.evaluate(()=>location.hash));
 // share
 await nav('#/salesinvoice/view/'+ids.salesinvoice);await p.click('#shareBtn');await p.waitForTimeout(300);
 const url=await p.inputValue('#shUrl');console.log('share url',url.slice(-45));
 await nav('#/share/'+url.split('#/share/')[1]);await p.waitForTimeout(300);await p.screenshot({path:'s-share.png'});
 console.log('shared title',await p.locator('#sharedView .dt').textContent());
 await nav('#/summary');
 // recurring: set next date past and generate
 await nav('#/recurringinvoice');console.log('gen button',await p.locator('#genBtn').count());
 // foreign invoice check
 await nav('#/customer');console.log('cust',(await p.locator('tbody').innerText()).replace(/\s+/g,' ').slice(0,300));
 await nav('#/salesinvoice/new');await p.selectOption('#fParty',{label:'C003 – Berlin Tours GmbH'});await p.waitForTimeout(100);console.log('fx shown',!(await p.locator('#fxBox').isHidden()),await p.inputValue('#fRate'));
 console.log('end',await bal());
 await nav('#/history');console.log('history rows',await p.locator('tbody tr[data-i]').count());
 await nav('#/item');await p.screenshot({path:'s-items.png'});
 console.log('errors',errs);await b.close();})();
