const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];
 p.on('pageerror',e=>errs.push('PAGEERR '+e.message));await p.route(/fonts\.g/,r=>r.abort());
 require('fs').writeFileSync('site/_demo.html',require('fs').readFileSync('site/index.html','utf8').replace('<script src="config.js"></script>','<script>window.FALAK_CONFIG={}</script>'));
 await p.goto('file://'+process.cwd()+'/site/_demo.html');await p.waitForTimeout(800);
 const nav=async h=>{await p.evaluate(h=>location.hash=h,h);await p.waitForTimeout(300)};const save=async()=>{await p.click('#saveBtn');await p.waitForTimeout(400)};
 const toastT=async()=>{await p.waitForTimeout(150);return await p.locator('#toast').innerText().catch(()=>'')};
 const cnt=async t=>p.evaluate(t=>JSON.parse(localStorage.getItem('falak_io_demo_v2')).records.filter(r=>r.type===t).length,t);
 // duplicates: customer
 await nav('#/customer/new');await p.fill('#fName','noor imports');await save();console.log('dup customer warning:',await toastT(),'| saved?',await cnt('customer'));
 await save();console.log('second press saves:',await cnt('customer'));
 // tickets dup
 await nav('#/supplier/new');await p.fill('#fName','Kam Air');await p.selectOption('#fKind','airline');await save();
 const air=await p.evaluate(()=>JSON.parse(localStorage.getItem('falak_io_demo_v2')).records.find(r=>r.data.name==='Kam Air').id);
 const cust=await p.evaluate(()=>JSON.parse(localStorage.getItem('falak_io_demo_v2')).records.find(r=>r.type==='customer').id);
 const tom=new Date(Date.now()+864e5).toISOString().slice(0,10);
 const tk=async(pax,pnr,no)=>{await nav('#/ticket/new');await p.fill('#fPax',pax);await p.fill('#fPaxP','+93 70 555 1234');await p.fill('#fPnr',pnr);await p.fill('#fTkt',no);await p.selectOption('#fAir',air);await p.selectOption('#fCust',cust);await p.fill('#fFly',tom);await p.fill('#fRoute','IST – KBL');await p.fill('#fSell','400');await p.fill('#fCost','350');await save()};
 await tk('Ali','ABC123','7740001');console.log('tickets:',await cnt('ticket'));
 await tk('Sara','ABC123','7740002');console.log('same PNR other passenger (group booking) saves without warning:',await cnt('ticket'));
 await tk('Omid','XYZ999','7740001');console.log('dup ticket no warning:',await toastT(),'| tickets:',await cnt('ticket'));
 // flights tomorrow
 await nav('#/travel');const c=p.locator('.card',{has:p.locator('h2',{hasText:/^Upcoming flights/})});console.log('upcoming:',(await c.locator('tbody').innerText()).replace(/\t/g,' | ').replace(/\n/g,' // '));
 console.log('reminder:',decodeURIComponent(await c.locator('a[href^="https://wa.me"]').first().getAttribute('href')).replace(/\n/g,' | '));
 // recycle bin: delete a ticket then restore
 const t1=await p.evaluate(()=>JSON.parse(localStorage.getItem('falak_io_demo_v2')).records.find(r=>r.type==='ticket'&&r.data.passenger==='Ali').id);
 await nav('#/ticket/edit/'+t1);await p.click('#del');await p.click('#mYes');await p.waitForTimeout(400);console.log('after delete tickets:',await cnt('ticket'));
 await nav('#/history');await p.click('a[href="#/history/deleted"]');await p.waitForTimeout(400);console.log('bin rows:',(await p.locator('tbody').innerText()).replace(/\t/g,' | ').split('\n').slice(0,2).join(' // '));
 await p.locator('tbody input[type=checkbox]').first().check();await p.click('#rsSel');await p.click('#mYes');await p.waitForTimeout(600);
 console.log('after restore tickets:',await cnt('ticket'),'| ticket back with same id:',await p.evaluate(id=>!!JSON.parse(localStorage.getItem('falak_io_demo_v2')).records.find(r=>r.id===id),t1));
 await nav('#/history/deleted');console.log('bin after restore:',(await p.locator('tbody').innerText()).trim().slice(0,60));
 await nav('#/summary');console.log('balance:',await p.locator('.sheet .ok, .sheet .small.neg').first().textContent());
 console.log('errors',errs);await b.close()})();
