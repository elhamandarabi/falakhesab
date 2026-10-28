// plans, trial, limits and manual payments (cloud mode with the mock database)
const { chromium } = require('playwright');const fs=require('fs');
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await p.addInitScript(()=>sessionStorage.setItem('mockpersist','1'));
 await p.route(/fonts\.g/,r=>r.abort());
 await p.route(/supabase-js|vendor\/supabase-/,r=>r.fulfill({body:fs.readFileSync('mock-supabase.js','utf8'),contentType:'application/javascript'}));
 await p.route(/config\.js$/,r=>r.fulfill({body:"window.FALAK_CONFIG={supabaseUrl:'https://x.supabase.co',supabaseAnonKey:'k',superAdmin:'falaktravelagency11@gmail.com'}",contentType:'application/javascript'}));
 const base='file://'+process.cwd()+'/site/index.html';
 const hash=async h=>{await p.evaluate(x=>location.hash=x,h);await p.waitForTimeout(450)};
 const auth=async(mode,e)=>{await hash('#/x');await hash('#/'+mode);await p.fill('#aEmail',e);await p.fill('#aPw','secret12');await p.click('#af button');await p.waitForTimeout(700)};
 const out=async()=>{await p.click('#signOut');await p.waitForTimeout(500)};
 const banner=()=>p.locator('#banner').innerText().catch(()=>'');
 const toastTxt=()=>p.locator('#toast').innerText().catch(()=>'');
 await p.goto(base);await p.waitForTimeout(500);
 for(const e of ['c@x.com','falaktravelagency11@gmail.com'])await auth('signup',e);
 // 1. new business → 30-day trial
 await auth('login','c@x.com');
 await p.click('#addBiz');await p.fill('#nbName','C Travel');await p.click('#nbBtn');await p.waitForTimeout(900);
 ok(/Free trial/.test(await banner())&&/30 days left/.test(await banner()),'trial banner: '+(await banner()).replace(/\n/g,' '));
 ok(await p.locator('#nav a[href="#/billing"]').count()===1,'Plan & billing in menu');
 ok(await p.locator('#nav a[href="#/ticket"]').count()===1,'Travel tabs during trial');
 // 2. trial = unlimited users
 await hash('#/users');for(const u of ['u1@x.com','u2@x.com','u3@x.com']){await p.click('#addU');await p.fill('#mEmail',u);await p.click('#mf button[type=submit]');await p.waitForTimeout(350)}
 ok((await p.locator('tbody tr').count())===4,'4 users during trial');
 // 3. billing page + request Pro
 await hash('#/billing');
 ok(await p.locator('.plancard').count()===3,'3 plan cards');
 ok(/\$19/.test(await p.locator('.plancard.best').innerText())&&/₺649/.test(await p.locator('.plancard.best').innerText()),'Pro price USD + TRY');
 await p.screenshot({path:'pl-billing.png',fullPage:true});
 await p.click('[data-req="pro"]');await p.waitForTimeout(600);
 ok(!(await p.locator('#payBox').isHidden()),'payment instructions shown');
 ok(/wa\.me/.test(await p.getAttribute('#payWa','href'))&&/Pro plan/.test(decodeURIComponent(await p.getAttribute('#payWa','href'))),'WhatsApp message prefilled');
 ok(/Waiting for payment: Pro/.test(await p.locator('.note').first().innerText()),'request noted on page');
 await p.screenshot({path:'pl-request.png',fullPage:true});
 await out();
 // 4. super admin sees the request, ends the plan
 await auth('login','falaktravelagency11@gmail.com');await hash('#/admin');
 ok(/Wants Pro/.test(await p.locator('#plansAdmin').innerText()),'admin sees Wants Pro');
 ok(/Waiting for payment/.test(await p.locator('#plansAdmin').innerText()),'admin waiting list');
 await p.screenshot({path:'pl-admin.png',fullPage:true});
 await p.click('[data-plan]');await p.waitForTimeout(300);
 ok((await p.inputValue('#mpAmt'))==='19','amount prefilled from price');
 await p.click('[data-act="end"]');await p.click('#mYes');await p.waitForTimeout(600);
 ok(/Ended/.test(await p.locator('#plansAdmin').innerText()),'admin ended plan');
 await out();
 // 5. owner: read-only
 await auth('login','c@x.com');await p.locator('.tile').first().click();await p.waitForTimeout(800);
 ok(/Your plan has ended/.test(await banner()),'ended banner');
 await hash('#/customer');ok(await p.locator('a.btn.primary:has-text("New")').count()===0,'no New button when read-only');
 await hash('#/customer/new');const sv=p.locator('#saveBtn');
 if(await sv.count()&&await sv.isVisible()){await p.fill('#fName','Blocked Co').catch(()=>{});await sv.click();await p.waitForTimeout(500);ok(/read-only|ended/i.test(await toastTxt()),'server blocks save: '+await toastTxt())}else ok(true,'form is read-only');
 await hash('#/users');ok(await p.locator('#addU').isDisabled(),'Add user disabled when ended');
 await hash('#/billing');await p.click('#goFree');await p.click('#mYes');await p.waitForTimeout(500);
 ok(/Free plan allows 1/.test(await toastTxt()),'Free refused with 4 users: '+await toastTxt());
 await p.screenshot({path:'pl-ended.png',fullPage:true});
 await out();
 // 6. super marks paid
 await auth('login','falaktravelagency11@gmail.com');await hash('#/admin');await p.click('[data-plan]');await p.waitForTimeout(300);
 await p.selectOption('#mpMonths','3');await p.waitForTimeout(100);ok((await p.inputValue('#mpAmt'))==='57','3 months = 57');
 await p.fill('#mpNote','cash Kabul office');await p.click('#mpForm button[type=submit]');await p.waitForTimeout(600);
 ok(/Paid until/.test(await toastTxt()),'mark paid toast: '+await toastTxt());
 ok(/Received[\s\S]*57/.test(await p.locator('#plansAdmin .kpis').innerText()),'income total');
 // prices
 await p.click('#plansAdmin details summary');await p.fill('#pd_basic','12');await p.click('#priceForm button[type=submit]');await p.waitForTimeout(400);
 await out();
 await auth('login','c@x.com');await p.locator('.tile').first().click();await p.waitForTimeout(800);
 ok(!(/ended/i.test(await banner())),'no ended banner after payment: '+(await banner()));
 await hash('#/billing');ok(/Active/.test(await p.locator('.planhead').innerText())&&/paid until/.test(await p.locator('.planhead').innerText()),'billing shows active + paid until');
 ok(/\$12/.test(await p.locator('.plancard').nth(1).innerText()),'new Basic price shown');
 ok(/cash|Pro · 3/.test(await p.locator('table').last().innerText()),'payment history');
 await p.screenshot({path:'pl-active.png',fullPage:true});
 await hash('#/ticket');ok(await p.locator('#view a[href="#/ticket/new"]').count()>=1,'can add tickets on Pro');
 // 7. second business → Free
 await hash('#/businesses');await p.click('#addBiz');await p.fill('#nbName','C Shop');await p.click('#nbBtn');await p.waitForTimeout(900);
 ok(await p.locator('#nav a[href="#/ticket"]').count()===0,'Free: travel tabs hidden');
 await hash('#/users');ok(await p.locator('#addU').isDisabled(),'Free: 1 user limit');
 await hash('#/settings');ok(/Basic and Pro plans/.test(await p.locator('#wsCard').innerText()),'Free: address needs Basic');
 await hash('#/billing');ok(/Your plan/.test(await p.locator('.plancard').first().innerText()),'Free card marked current');
 // Dari check on the billing page
 await p.selectOption('#langSide','fa');await p.waitForTimeout(400);await hash('#/businesses');await p.locator('.tile').first().click();await p.waitForTimeout(800);await hash('#/billing');
 const left=await p.evaluate(()=>{const o=[];const w=document.createTreeWalker(document.querySelector('#view'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.trim();if(/[A-Za-z]{3,}/.test(t)&&!/^(Pro|USD|TRY|WhatsApp|Falak\.io.*)$/.test(t))o.push(t)}return o});
 console.log('fa leftovers:',JSON.stringify(left));await p.screenshot({path:'pl-billing-fa.png',fullPage:true});
 await p.selectOption('#langSide','en');await p.waitForTimeout(300);
 ok(errs.length===0,'no page errors '+errs.join(' | '));
 await b.close();})();
