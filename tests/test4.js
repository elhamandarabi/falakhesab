const { chromium } = require('playwright');
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(/fonts\.g/,r=>r.abort());require('fs').writeFileSync('site/_demo.html',require('fs').readFileSync('site/index.html','utf8').replace('<script src="config.js"></script>','<script>window.FALAK_CONFIG={}</script>'));await p.goto('file://'+process.cwd()+'/site/_demo.html');await p.waitForTimeout(700);
 const nav=async h=>{await p.evaluate(h=>location.hash=h,h);await p.waitForTimeout(150)};
 const bal=async()=>{await nav('#/summary');return p.locator('.sheet .ok, .sheet .small.neg').first().textContent()};
 // FX invoice
 await nav('#/salesinvoice/new');await p.selectOption('#fParty',{label:'C003 – Berlin Tours GmbH'});await p.fill('#fRate','1.10');
 await p.selectOption('#lines [data-k=item]',{label:'S-CON – Consulting hour'});await p.fill('#lines [data-k=qty]','2');await p.click('#saveBtn');await p.waitForTimeout(300);
 console.log('fx inv total',await p.locator('.totals').first().innerText().then(t=>t.replace(/\s+/g,' ')));
 await p.click('#payBtn');await p.waitForTimeout(200);console.log('pay amount',await p.inputValue('#lines [data-k=amount]'),'bank fx box hidden',await p.locator('#fxBox').isHidden());
 await p.click('#saveBtn');await p.waitForTimeout(300);
 await nav('#/salesinvoice');console.log('statuses',(await p.locator('tbody .tag').allTextContents()).join(','));
 console.log(await bal());
 // recurring: set next date in past
 const rid=await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('falak_io_demo_v2'));return d.records.find(r=>r.type==='recurringinvoice').id});
 await nav('#/recurringinvoice/edit/'+rid);await p.fill('#fNext','2026-08-01');await p.click('#saveBtn');await p.waitForTimeout(300);
 await nav('#/summary');console.log('note',await p.locator('.note').first().innerText().catch(()=>'none'));
 await nav('#/recurringinvoice');await p.click('#genBtn');await p.waitForTimeout(500);
 await nav('#/salesinvoice');console.log('invoices now',await p.locator('tbody tr.click').count());
 // lock date
 await nav('#/settings');await p.fill('#sLock','2026-08-31');await p.click('#sf button[type=submit]');await p.waitForTimeout(300);
 await nav('#/receipt/new');await p.fill('#fDate','2026-08-01');await p.selectOption('#lines [data-k=account]',{index:3});await p.fill('#lines [data-k=amount]','5');await p.click('#saveBtn');await p.waitForTimeout(200);
 console.log('lock toast',await p.locator('#toast').textContent());
 // write-off & delivery
 await nav('#/writeoff/new');await p.selectOption('#lines [data-k=item]',{index:1});await p.fill('#lines [data-k=qty]','2');await p.fill('#fDate','2026-10-01');await p.click('#saveBtn');await p.waitForTimeout(300);
 await nav('#/deliverynote/new');await p.selectOption('#fParty',{index:1});await p.selectOption('#lines [data-k=item]',{index:1});await p.fill('#lines [data-k=qty]','5');await p.click('#saveBtn');await p.waitForTimeout(300);
 await nav('#/item');console.log('items',(await p.locator('tbody tr').first().innerText()).replace(/\s+/g,' '));
 console.log(await bal());console.log('errors',errs);await b.close()})();
