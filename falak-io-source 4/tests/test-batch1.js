const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];
 p.on('pageerror',e=>errs.push('PAGEERR '+e.message));await p.route(/fonts\.g/,r=>r.abort());
 require('fs').writeFileSync('site/_demo.html',require('fs').readFileSync('site/index.html','utf8').replace('<script src="config.js"></script>','<script>window.FALAK_CONFIG={}</script>'));
 await p.goto('file://'+process.cwd()+'/site/_demo.html');await p.waitForTimeout(800);
 const nav=async h=>{await p.evaluate(h=>location.hash=h,h);await p.waitForTimeout(250)};
 const save=async()=>{await p.click('#saveBtn');await p.waitForTimeout(350)};
 const bal=async()=>{await nav('#/summary');return p.locator('.sheet .ok, .sheet .small.neg').first().textContent()};
 const ids=await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('falak_io_demo_v2'));const m={};d.records.forEach(r=>{m[r.type]=m[r.type]||r.id});return m});
 const arTotal=async()=>{await nav('#/summary');return (await p.locator('.row',{hasText:'Accounts receivable'}).innerText()).replace(/\s+/g,' ')};
 console.log('start',await bal(),'|',await arTotal());
 // 1. starting balances
 await nav('#/customer/new');await p.fill('#fName','Old Customer');await p.fill('#fOpen','250');await save();
 await nav('#/supplier/new');await p.fill('#fName','Ariana Afghan Airlines');await p.selectOption('#fKind','airline');await p.fill('#fOpen','-1000');await save();
 console.log('after openings',await bal(),'|',await arTotal());
 await nav('#/customer');console.log('customer row:',(await p.locator('tr',{hasText:'Old Customer'}).innerText()).replace(/\s+/g,' '));
 await nav('#/travel');console.log('airline row:',(await p.locator('tr',{hasText:'Ariana'}).innerText()).replace(/\s+/g,' '));
 await nav('#/reports/aged-ar');console.log('aged has Old Customer:',(await p.locator('body').innerText()).includes('Old Customer'));
 // receipt linked to starting balance
 const oc=await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('falak_io_demo_v2'));return d.records.find(r=>r.data.name==='Old Customer').id});
 await nav('#/receipt/new');await p.selectOption('#lines [data-k=account]','ar:'+oc);await p.waitForTimeout(100);
 console.log('link options:',(await p.locator('#lines [data-k=invoice]').innerText()).replace(/\n/g,' / '));
 await p.selectOption('#lines [data-k=invoice]','ob:'+oc);await p.waitForTimeout(100);console.log('auto amount',await p.inputValue('#lines [data-k=amount]'));await save();
 await nav('#/customer');console.log('customer row after pay:',(await p.locator('tr',{hasText:'Old Customer'}).innerText()).replace(/\s+/g,' '));
 console.log('balance',await bal());
 // 2. logo
 await nav('#/settings');await p.setInputFiles('#logoFile','/tmp/claude-0/-home-claude/c8123794-34df-541c-9d2c-52106dc86241/scratchpad/testlogo.png');await p.waitForTimeout(800);
 console.log('logo stored:',await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('falak_io_demo_v2'));return (d.businesses[0].settings.logo||'').slice(0,22)+' len '+(d.businesses[0].settings.logo||'').length}));
 // 3. footers
 await nav('#/settings');await p.click('#ftAdd');await p.fill('#ftN0','Bank details');await p.fill('#ftT0','Bank: Ziraat Bankası\nIBAN: TR00 0000 0000 0000');
 await p.click('#ftAdd');await p.fill('#ftN1','Thanks');await p.fill('#ftT1','Thank you for flying with us!');
 for(const k of ['sales','purchase','money','payslip'])await p.uncheck(`.ftitem[data-i="1"] input[data-k=${k}]`);
 await p.click('#ftSave');await p.waitForTimeout(400);
 // business details save must keep logo
 await nav('#/settings');await p.fill('#sPhone','+90 555 000 0000');await p.click('#sf button[type=submit]');await p.waitForTimeout(400);
 console.log('logo kept after details save:',await p.evaluate(()=>!!JSON.parse(localStorage.getItem('falak_io_demo_v2')).businesses[0].settings.logo));
 await nav('#/salesinvoice/view/'+ids.salesinvoice);
 console.log('invoice logo:',await p.locator('.card.doc img.doclogo').count(),'footer:',(await p.locator('.docfoot').innerText()).replace(/\n/g,' | '));
 await p.screenshot({path:'b1-invoice.png',fullPage:true});
 // ticket receipt gets both
 await nav('#/ticket/new');await p.fill('#fPax','Test Pax');await p.selectOption('#fAir',{label:'Ariana Afghan Airlines (Airline)'});await p.selectOption('#fCust',oc);await p.fill('#fSell','300');await p.fill('#fCost','250');await save();
 console.log('ticket footer:',(await p.locator('.docfoot').innerText()).replace(/\n/g,' | '));
 await p.screenshot({path:'b1-ticket.png',fullPage:true});
 await nav('#/travel');console.log('airline after ticket:',(await p.locator('tr',{hasText:'Ariana'}).innerText()).replace(/\s+/g,' '));
 console.log('final',await bal());
 console.log('errors',errs);await b.close()})();
