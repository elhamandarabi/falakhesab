const { chromium } = require('playwright');
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|fonts/.test(m.text()))errs.push(m.text())});
 await p.route(/fonts\.g/,r=>r.abort());
 await p.goto('file://'+process.cwd()+'/site/index.html');await p.waitForTimeout(800);
 const nav=async h=>{await p.evaluate(h=>location.hash=h,h);await p.waitForTimeout(120);const t=await p.locator('#view').innerText();if(/Something went wrong/.test(t))errs.push(h+': '+t.slice(0,200));};
 console.log((await p.locator('.ok,.small.neg').first().textContent()));
 await p.screenshot({path:'s-summary.png'});
 const types=['bank','receipt','payment','transfer','customer','supplier','quote','salesinvoice','creditnote','purchaseorder','purchaseinvoice','debitnote','item','employee','payslip','expenseclaim','fixedasset','depreciation','journal','account','taxcode'];
 const ids=await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('falak_io_demo_v2'));const m={};d.records.forEach(r=>{m[r.type]=m[r.type]||r.id});return m});
 for(const t of types){await nav('#/'+t);await nav('#/'+t+'/new');if(ids[t]){await nav(`#/${t}/edit/${ids[t]}`);await nav(`#/${t}/view/${ids[t]}`)}}
 for(const r of ['reports','reports/trial','reports/gl','reports/pl-month','reports/aged-ar','reports/aged-ap','reports/inventory','reports/tax','settings','users','admin','profile','businesses','ledger/view/'+encodeURIComponent('ar:'+ids.customer)])await nav('#/'+r);
 // create invoice then receive payment
 await nav('#/salesinvoice/new');
 await p.selectOption('#fParty',{index:2});
 await p.selectOption('#lines [data-k=item]',{index:2});await p.fill('#lines [data-k=qty]','3');
 await p.click('#saveBtn');await p.waitForTimeout(300);
 console.log('after create url',await p.evaluate(()=>location.hash));
 console.log('status',await p.locator('.tag').first().textContent().catch(()=>'?'));
 await p.click('#payBtn');await p.waitForTimeout(300);
 console.log('receipt prefill amount',await p.inputValue('#lines [data-k=amount]'));
 await p.click('#saveBtn');await p.waitForTimeout(300);
 await nav('#/salesinvoice');await p.screenshot({path:'s-inv.png'});
 console.log('statuses',(await p.locator('tbody .tag').allTextContents()).join(','));
 await nav('#/summary');console.log((await p.locator('.ok,.small.neg').first().textContent()));
 await nav('#/salesinvoice/view/'+ids.salesinvoice);await p.screenshot({path:'s-view.png'});
 await nav('#/item');await p.screenshot({path:'s-item.png'});
 await p.setViewportSize({width:390,height:800});await nav('#/salesinvoice/new');await p.screenshot({path:'s-mobile.png'});
 console.log('overflow',await p.evaluate(()=>document.documentElement.scrollWidth));
 console.log('errors',errs);await b.close();})();
