// company address over real paths (/falak-travel and /falak-travel/) with the CSP + redirects of the live site
const { chromium } = require('playwright');const fs=require('fs');
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on('requestfailed',r=>{if(!/fonts/.test(r.url()))console.log('REQFAIL',r.url())});
 p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/fonts|TUNNEL|ERR_FAILED/.test(m.text()))errs.push(m.text())});
 await p.addInitScript(()=>sessionStorage.setItem('mockpersist','1'));await p.route(/fonts\.g/,r=>r.abort());
 await p.route(/vendor\/supabase-/,r=>r.fulfill({body:fs.readFileSync('mock-supabase.js','utf8'),contentType:'application/javascript'}));
 await p.route(/config\.js$/,r=>r.fulfill({body:"window.FALAK_CONFIG={supabaseUrl:'https://yourprojectref.supabase.co',supabaseAnonKey:'k'}",contentType:'application/javascript'}));
 const go=async u=>{await p.goto('http://localhost:8099'+u);await p.waitForTimeout(700)};
 const auth=async(mode,e)=>{await p.evaluate(()=>location.hash='#/x');await p.evaluate(m=>location.hash='#/'+m,mode);await p.waitForTimeout(200);await p.fill('#aEmail',e);await p.fill('#aPw','secret12');await p.click('#af button');await p.waitForTimeout(700)};
 await go('/');await auth('signup','owner@x.com');await auth('login','owner@x.com');
 await p.click('#addBiz');await p.fill('#nbName','Falak Travel');await p.click('#nbBtn');await p.waitForTimeout(800);
 await p.evaluate(()=>location.hash='#/settings');await p.waitForTimeout(300);await p.fill('#wsSlug','falak-travel');await p.click('#wsForm button[type=submit]');await p.waitForTimeout(500);
 ok(/localhost:8099\/falak-travel/.test(await p.locator('#wsCard .wslink').textContent()),'link uses site address');
 await p.click('#signOut');await p.waitForTimeout(400);
 for(const u of ['/falak-travel','/falak-travel/','/Falak-Travel']){await go(u);
   ok((await p.locator('.wsname').textContent().catch(()=>''))==='Falak Travel','branded page at '+u);
   ok(await p.evaluate(()=>!!document.querySelector('.authcard .brand')&&getComputedStyle(document.body).fontFamily.length>0),'styles+app loaded at '+u)}
 await go('/falak-travel/');await auth('login','owner@x.com');
 ok(/Falak Travel/.test(await p.locator('#bizName').textContent()),'owner lands in business via /falak-travel/');
 await p.evaluate(()=>location.hash='#/salesinvoice');await p.waitForTimeout(300);
 ok(await p.locator('#view h1').first().textContent()!=='', 'navigation inside works: '+await p.evaluate(()=>location.pathname+location.hash));
 await go('/does-not-exist');ok((await p.locator('#authView h1').textContent())==='Company not found','unknown path -> Company not found');
 ok(errs.length===0,'no errors '+errs.join(' | '));await b.close()})();
