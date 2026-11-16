// Travel overview upgrade: sub-agent ageing, airline payments due, refund tracker, alert tiles (demo data)
const { chromium } = require('playwright');
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:950}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(/fonts\.g/,r=>r.abort());
 await p.goto('file://'+process.cwd()+'/site/_demo.html#/travel');await p.waitForTimeout(1300);
 const hash=async(h,ms=800)=>{await p.evaluate(x=>location.hash=x,h);await p.waitForTimeout(ms)};
 const txt=async s=>p.locator(s).innerText();
 ok(await p.locator('#tvAge').count()&&await p.locator('#tvPay').count()&&await p.locator('#tvRef').count(),'three new sections shown');
 ok((await p.locator('.alertkpi').count())===3,'three alert tiles');
 let a=await txt('#tvAge');ok(/Herat Travel/.test(a)&&/480\.00/.test(a)&&/Not due yet/.test(a),'sub-agent ticket (480) listed with ageing columns');
 await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('falak_io_demo_v2'));const ag=d.records.find(r=>r.type==='customer'&&r.data.kind==='agent');const tk=d.records.find(r=>r.type==='ticket'&&r.data.customer===ag.id);
   const x=new Date();x.setDate(x.getDate()-45);tk.data.date=x.toISOString().slice(0,10);tk.data.flightDate='';localStorage.setItem('falak_io_demo_v2',JSON.stringify(d))});
 await p.reload();await p.waitForTimeout(1300);
 const row=await p.locator('#tvAge tbody tr',{hasText:'Herat'}).evaluate(tr=>[...tr.children].map(td=>td.innerText.trim()));
 ok(row[1]===''&&row[3]==='480.00','45-day-old ticket with 7-day terms is 38 days late → 31–60 column: '+row.join(' | '));
 ok(/480\.00/.test(await p.locator('.alertkpi').first().locator('.num').innerText()),'overdue tile shows 480.00');
 let pay=await txt('#tvPay');ok(/Kam Air|Turkish/.test(pay)&&/Overdue/.test(pay),'airline payments due table');
 const pb=p.locator('#tvPay [data-pay]').first();if(await pb.count()){await pb.click();await p.waitForTimeout(700);ok(/#\/payment\/new/.test(p.url())&&/Payment – |Deposit – /.test(await p.inputValue('#fDesc')),'Pay opens a prefilled payment');await hash('#/travel')}
 // airline with deposit smaller than last 7 days of costs → Deposit running low
 await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('falak_io_demo_v2'));const al=d.records.find(r=>r.type==='supplier'&&/Turkish/.test(r.data.name)),bk=d.records.find(r=>r.type==='bank');
   d.records.push({id:'dep-tk-1',business_id:al.business_id,type:'payment',data:{date:new Date().toISOString().slice(0,10),ref:'98',bank:bk.id,contact:al.data.name,desc:'Deposit',lines:[{account:'ap:'+al.id,amount:1300}]}});const tk=d.records.find(r=>r.type==='ticket'&&r.data.airline===al.id&&r.data.ref==='3');tk.data.date=new Date().toISOString().slice(0,10);localStorage.setItem('falak_io_demo_v2',JSON.stringify(d))});
 await p.reload();await p.waitForTimeout(1300);pay=await txt('#tvPay');ok(/Deposit running low/.test(pay),'deposit 320 left, 440 of tickets this week → low deposit warning: '+pay.split('\n').filter(l=>/Turkish/.test(l)).join(''));
 await hash('#/ticket');await p.locator('tbody tr.click',{hasText:'Ahmad Karimi'}).click();await p.waitForTimeout(700);const tid=p.url().split('/').pop();
 if(await p.locator('#tkPayV').count()){await p.click('#tkPayV');await p.waitForTimeout(700);await p.click('#saveBtn');await p.waitForTimeout(800)}
 await hash('#/ticket/view/'+tid);await p.click('#tkCancel');await p.waitForTimeout(800);await p.fill('#fRCust','450');await p.fill('#fRAir','400');await p.click('#saveBtn');await p.waitForTimeout(900);
 ok(await p.locator('#tkRefC').count()===1,'ticket page refund button still works');
 await hash('#/travel',1000);let r=await txt('#tvRef');
 ok(/Ahmad Karimi/.test(r)&&/Pay back customer/.test(r)&&/450\.00/.test(r),'refund tracker: pay back customer 450');
 ok(/^1$/.test((await p.locator('.alertkpi').nth(2).locator('.num').innerText()).trim()),'open refunds tile = 1');
 await p.click('#tvRef [data-rc]');await p.waitForTimeout(800);ok(/#\/payment\/new/.test(p.url())&&/Refund – ticket/.test(await p.inputValue('#fDesc')),'tracker button prefills the refund payment');
 await p.click('#saveBtn');await p.waitForTimeout(900);await hash('#/travel',1000);r=await txt('#tvRef');
 ok(/Done/.test(r)&&!/Pay back customer/.test(r),'after paying back: status Done');
 await p.locator('.alertkpi').nth(1).click();await p.waitForTimeout(700);ok(await p.evaluate(()=>document.getElementById('tvPay').getBoundingClientRect().top<400),'tile scrolls to its table');
 await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:'tv2-en.png',fullPage:true});
 for(const [l,re] of [['fa',/نمایندگان فرعی: چقدر بدهکارند/],['ps',/فرعي اجنټان: څومره پور/],['tr',/Alt acenteler: borçları/]]){await p.selectOption('#langSide',l);await p.waitForTimeout(500);await hash('#/summary',400);await hash('#/travel',900);
   const v=await txt('#view');ok(re.test(v)&&!/Not due yet|Open refunds|Airline payments due|Deposit running low/.test(v),'translated: '+l);if(l==='fa')await p.screenshot({path:'tv2-fa.png',fullPage:true})}
 await p.selectOption('#langSide','en');await p.waitForTimeout(400);
 await p.setViewportSize({width:390,height:800});await hash('#/travel',900);ok(await p.evaluate(()=>document.documentElement.scrollWidth<=392),'no sideways scroll on phone');
 await hash('#/summary',800);ok(/✓/.test(await txt('#view')),'balance sheet still in balance');
 ok(!errs.length,'no page errors '+errs.join(' | '));await b.close()})();
