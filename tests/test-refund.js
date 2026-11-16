// ticket cancellation and refunds: pay back the customer, get money back from the airline (demo data)
const { chromium } = require('playwright');
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:950}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(/fonts\.g/,r=>r.abort());
 await p.goto('file://'+process.cwd()+'/site/_demo.html#/ticket');await p.waitForTimeout(1200);
 const hash=async(h,ms=700)=>{await p.evaluate(x=>location.hash=x,h);await p.waitForTimeout(ms)};
 // ticket 2: Ahmad Karimi 520 — first take full payment
 await p.locator('tbody tr.click',{hasText:'Ahmad Karimi'}).click();await p.waitForTimeout(700);const tid=p.url().split('/').pop();
 ok(await p.locator('#tkCancel').count()===1,'ticket shows Cancel / refund');
 if(await p.locator('#tkPayV').count()){await p.click('#tkPayV');await p.waitForTimeout(700);await p.click('#saveBtn');await p.waitForTimeout(800)}
 await hash('#/ticket/view/'+tid);
 await p.click('#tkCancel');await p.waitForTimeout(800);
 ok(await p.locator('#fRef1').isChecked()&&await p.locator('#refBox').isVisible(),'Cancel / refund opens the ticket with the refund box ready');
 await p.fill('#fRCust','450');await p.fill('#fRAir','400');await p.waitForTimeout(100);
 ok(/-?\d/.test(await p.locator('#fRProfit').innerText()),'profit after refund calculated: '+await p.locator('#fRProfit').innerText());
 await p.click('#saveBtn');await p.waitForTimeout(900);
 let t=await p.locator('.refbox').innerText();ok(/Still to pay back\s*450\.00/.test(t),'refund box: 450.00 still to pay back');
 ok(await p.locator('#tkRefC').count()===1,'button: Pay refund to customer');
 await p.click('#tkRefC');await p.waitForTimeout(800);
 ok(/#\/payment\/new/.test(p.url())&&/Refund – ticket/.test(await p.inputValue('#fDesc'))&&/450/.test(await p.locator('#lines').evaluate(e=>[...e.querySelectorAll('input')].map(i=>i.value).join(' '))),'payment prefilled: refund 450 to customer');
 await p.click('#saveBtn');await p.waitForTimeout(900);
 await hash('#/ticket/view/'+tid,900);t=await p.locator('.refbox').innerText();
 ok(/Paid back\s*450\.00/.test(t)&&/Still to pay back\s*0\.00/.test(t)&&/Customer had paid\s*520\.00/.test(t)&&await p.locator('#tkRefC').count()===0,'after paying: paid back 450, nothing left, button gone');
 ok(/Balance due\s*0\.00/.test(await p.locator('.totals').innerText()),'ticket balance due 0.00 after the refund is paid back');
 // airline: we had paid Kam Air? if not paid, nothing to receive
 const air=await p.locator('#tkRefA').count();
 ok(/Refund from airline\s*400\.00/.test(t),'airline refund amount shown (receive button '+(air?'shown':'hidden: airline not paid yet, refund lowers what we owe')+')');
 await hash('#/ticket',800);ok(/Refunded/.test(await p.locator('tbody tr',{hasText:'Ahmad Karimi'}).innerText()),'ticket list: Refunded');
 // a refunded but unpaid ticket: nothing to pay back
 await p.locator('tbody tr.click',{hasText:'Mariam Sultani'}).click();await p.waitForTimeout(700);
 await p.click('#tkCancel');await p.waitForTimeout(700);await p.fill('#fRCust','480');await p.fill('#fRAir','440');await p.click('#saveBtn');await p.waitForTimeout(900);
 ok(await p.locator('#tkRefC').count()===0&&/Nothing to pay back/.test(await p.locator('.refbox').innerText()),'unpaid ticket: no refund payment needed');
 // pay the airline then receive its refund
 // we paid the airline for this ticket → after the refund the airline owes us 400
 await p.evaluate(tid=>{const d=JSON.parse(localStorage.getItem('falak_io_demo_v2'));const tk=d.records.find(r=>r.id===tid),bk=d.records.find(r=>r.type==='bank');
   d.records.push({id:'pay-air-1',business_id:tk.business_id,type:'payment',data:{date:tk.data.date,ref:'99',bank:bk.id,contact:'Kam Air',desc:'Ticket cost',lines:[{account:'ap:'+tk.data.airline,invoice:tid,amount:455}]}});localStorage.setItem('falak_io_demo_v2',JSON.stringify(d))},tid);
 await p.reload();await p.waitForTimeout(1200);await hash('#/ticket/view/'+tid,900);
 ok(/still to receive\s*400\.00/.test(await p.locator('.refbox').innerText())&&await p.locator('#tkRefA').count()===1,'airline paid: 400.00 to receive back, button shown');
 await p.click('#tkRefA');await p.waitForTimeout(800);ok(/#\/receipt\/new/.test(p.url())&&/Airline refund/.test(await p.inputValue('#fDesc')),'receipt prefilled from airline');
 await p.click('#saveBtn');await p.waitForTimeout(900);await hash('#/ticket/view/'+tid,900);
 ok(/received\s*400\.00/.test(await p.locator('.refbox').innerText())&&await p.locator('#tkRefA').count()===0,'airline refund received, button gone');
 await p.selectOption('#langSide','fa');await p.waitForTimeout(500);await hash('#/ticket/view/'+tid,900);
 ok(/بازپرداخت/.test(await p.locator('.refbox').innerText()),'refund box in Dari');await p.screenshot({path:'refund-fa.png',fullPage:true});
 await p.selectOption('#langSide','en');await p.waitForTimeout(400);await p.screenshot({path:'refund-en.png',fullPage:true});
 ok(/✓/.test(await (await hash('#/summary',800),p.locator('#view').innerText())),'balance sheet still in balance');
 ok(!errs.length,'no page errors '+errs.join(' | '));await b.close()})();
