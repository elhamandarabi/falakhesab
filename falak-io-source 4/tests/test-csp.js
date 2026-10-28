const { chromium } = require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on('requestfailed',r=>console.log('FAILED',r.url().slice(0,90)));
 p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/fonts/.test(m.text()))errs.push(m.text())});

 // real vendor file is served by our server; only replace config to point at a fake project and the mock client
 await p.route(/vendor\/supabase-/,r=>r.fulfill({body:fs.readFileSync('mock-supabase.js','utf8'),contentType:'application/javascript'}));
 await p.route(/config\.js$/,r=>r.fulfill({body:"window.FALAK_CONFIG={supabaseUrl:'https://your-project-ref.supabase.co',supabaseAnonKey:'k'}",contentType:'application/javascript'}));
 const resp=await p.goto('http://localhost:8099/');console.log('CSP header present:',!!resp.headers()['content-security-policy'],'XFO:',resp.headers()['x-frame-options']);
 await p.waitForTimeout(700);console.log('auth h1:',await p.locator('#authView h1').textContent());
 await p.screenshot({path:'st-login.png'});
 await p.evaluate(()=>location.hash='#/signup');await p.waitForTimeout(200);await p.fill('#aEmail','falaktravelagency11@gmail.com');await p.fill('#aPw','secret12');await p.click('#af button');await p.waitForTimeout(300);
 await p.evaluate(()=>location.hash='#/login');await p.waitForTimeout(200);await p.fill('#aEmail','falaktravelagency11@gmail.com');await p.fill('#aPw','secret12');await p.click('#af button');await p.waitForTimeout(700);
 await p.evaluate(()=>location.hash='#/businesses');await p.waitForTimeout(300);
 await p.click('#addBiz');await p.fill('#nbName','Falak Travel');await p.check('#nbSample');await p.click('#nbBtn');await p.waitForTimeout(800);
 for(const h of ['#/summary','#/travel','#/ticket/new','#/customer','#/settings','#/reports','#/support','#/ledger/view/acc%3Atsales','#/history']){await p.evaluate(h=>location.hash=h,h);await p.waitForTimeout(250)}
 await p.evaluate(()=>location.hash='#/ledger/view/acc%3Atsales');await p.waitForTimeout(250);const back=p.locator('[data-back]');console.log('back link count',await back.count());
 await p.evaluate(()=>location.hash='#/summary');await p.waitForTimeout(300);await p.screenshot({path:'st-summary.png'});
 console.log('errors',errs);await b.close()})();
