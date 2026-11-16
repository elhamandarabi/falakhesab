const { chromium } = require('playwright');
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844}});await p.addInitScript(()=>{try{localStorage.setItem('falak_lang','fa')}catch(e){}});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/ERR_|fonts/.test(m.text()))errs.push(m.text())});
 await p.route(/fonts\.g/,r=>r.abort());
 require('fs').writeFileSync('site/_demo.html',require('fs').readFileSync('site/index.html','utf8').replace('<script src="config.js"></script>','<script>window.FALAK_CONFIG={}</script>'));
 await p.goto('file://'+process.cwd()+'/site/_demo.html');await p.waitForTimeout(800);
 const nav=async h=>{await p.evaluate(h=>location.hash=h,h);await p.waitForTimeout(200);const t=await p.locator('body').innerText();if(/Something went wrong/.test(t))errs.push(h+': '+t.match(/Something went wrong.*/)[0])};
 const save=async()=>{await p.click('#saveBtn');await p.waitForTimeout(350)};
 const bal=async()=>{await nav('#/summary');return p.locator('.sheet .ok, .sheet .small.neg').first().textContent()};
 console.log('start',await bal());
 // airline + agent
 await nav('#/travel');await p.click('#newAir');await p.waitForTimeout(200);console.log('kind preset:',await p.inputValue('#fKind'));await p.fill('#fName','Kam Air');await save();
 await nav('#/travel');await p.click('#newAg');await p.waitForTimeout(200);await p.fill('#fName','Kabul Agent');await save();
 const id=async(type,name)=>p.evaluate(([t,n])=>{const d=JSON.parse(localStorage.getItem('falak_io_demo_v2'));return d.records.find(r=>r.type===t&&r.data.name===n).id},[type,name]);
 const air=await id('supplier','Kam Air'),ag=await id('customer','Kabul Agent');
 // deposits
 await nav('#/travel');await p.click(`[data-dep="${air}"]`);await p.waitForTimeout(300);await p.fill('#lines [data-k=amount]','1000');await save();console.log('after deposit:',await p.evaluate(()=>location.hash));
 await nav('#/travel');await p.click(`[data-rec="${ag}"]`);await p.waitForTimeout(300);await p.fill('#lines [data-k=amount]','500');await save();
 // tickets
 const tk=async(o)=>{await nav('#/ticket/new');await p.fill('#fPax',o.pax);await p.fill('#fPnr',o.pnr);await p.selectOption('#fAir',air);await p.fill('#fRoute',o.route);await p.selectOption('#fCust',o.cust);
   await p.fill('#fSell',String(o.sell));await p.fill('#fCost',String(o.cost));
   if(o.ref){await p.check('#fRef1');await p.fill('#fRCust',String(o.ref[0]));await p.fill('#fRAir',String(o.ref[1]))}
   const pr=await p.textContent(o.ref?'#fRProfit':'#fProfit');await save();return pr};
 console.log('profit shown t1',await tk({pax:'Ali Ahmadi',pnr:'abc123',route:'IST – KBL',cust:ag,sell:400,cost:350}));
 const walk=await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('falak_io_demo_v2'));return d.records.find(r=>r.type==='customer'&&!r.data.kind).id});
 console.log('profit shown t2',await tk({pax:'Sara Noori',pnr:'xyz789',route:'IST – MZR',cust:walk,sell:300,cost:250}));
 console.log('profit shown t3',await tk({pax:'Omid Karimi',pnr:'qqq111',route:'ist – kbl',cust:ag,sell:200,cost:180,ref:[150,130]}));
 // receive payment for t2
 const t2=await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('falak_io_demo_v2'));return d.records.find(r=>r.type==='ticket'&&r.data.passenger==='Sara Noori').id});
 await nav('#/ticket/edit/'+t2);await p.click('#tkPay');await p.waitForTimeout(300);
 console.log('receipt prefill:',await p.inputValue('#lines [data-k=amount]'),await p.inputValue('#lines [data-k=invoice]')===t2);await save();
 await nav('#/ticket');console.log('ticket rows:\n'+(await p.locator('tbody').innerText()).replace(/\t/g,' | '));
 await nav('#/travel');
 console.log('tiles:',(await p.locator('.tiles').innerText()).replace(/\s+/g,' '));

 await p.screenshot({path:'tr-fa-overview.png',fullPage:true});
 await nav('#/ticket/edit/'+t2);await p.screenshot({path:'tr-fa-form.png',fullPage:true});
 await nav('#/ledger/view/'+encodeURIComponent('acc:tsales'));
 console.log('balance',await bal());
 await nav('#/reports/trial');
 // receipt invoice dropdown shows tickets
 await nav('#/receipt/new');await p.selectOption('#lines [data-k=account]','ar:'+walk);await p.waitForTimeout(100);console.log('receipt link options:',(await p.locator('#lines [data-k=invoice]').innerText()).replace(/\n/g,' / '));
 // printable receipt
 await nav('#/ticket');await p.locator('tbody tr.click').last().click();await p.waitForTimeout(300);console.log('row click ->',await p.evaluate(()=>location.hash.split('/').slice(0,3).join('/')));
 console.log('view text:',(await p.locator('.card.doc').innerText()).replace(/\s+/g,' '));
 const wa=decodeURIComponent(await p.locator('.head a.btn[href^="https://wa.me"]').getAttribute('href'));console.log('whatsapp:',wa.replace(/\n/g,' | '));
 console.log('cost leaked in view/whatsapp?',/350/.test(await p.locator('.card.doc').innerText())||/350/.test(wa));
 await p.screenshot({path:'tr-fa-view.png',fullPage:true});
 // unpaid ticket -> receive payment from view
 await nav('#/ticket/new');await p.fill('#fPax','Zahra Rahimi');await p.selectOption('#fAir',air);await p.selectOption('#fCust',walk);await p.fill('#fSell','120');await p.fill('#fCost','100');await save();
 console.log('after create ->',await p.evaluate(()=>location.hash.split('/').slice(0,3).join('/')),'pay button:',await p.locator('#tkPayV').count());
 await p.click('#tkPayV');await p.waitForTimeout(300);console.log('prefill amount',await p.inputValue('#lines [data-k=amount]'));await save();
 await nav('#/travel');
 // toggle off
 await nav('#/settings');await p.uncheck('#sTravel');await p.click('#sf button[type=submit]');await p.waitForTimeout(300);
 console.log('nav has Travel after off:',(await p.locator('#nav').innerText()).includes('Tickets'));
 await nav('#/settings');await p.check('#sTravel');await p.click('#sf button[type=submit]');await p.waitForTimeout(300);
 console.log('nav has Travel after on:',(await p.locator('#nav').innerText()).includes('Tickets'));
 console.log('errors',errs);await b.close()})();
