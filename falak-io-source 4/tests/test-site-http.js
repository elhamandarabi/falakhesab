// website over real paths with the live CSP headers (/, /privacy, /terms, /?demo=1)
const { chromium } = require('playwright');const fs=require('fs');
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];
 p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/fonts|TUNNEL|ERR_FAILED/.test(m.text()))errs.push(m.text())});
 await p.route(/fonts\.g/,r=>r.abort());
 await p.route(/vendor\/supabase-/,r=>r.fulfill({body:fs.readFileSync('mock-supabase.js','utf8'),contentType:'application/javascript'}));
 await p.route(/config\.js$/,r=>r.fulfill({body:"window.FALAK_CONFIG={supabaseUrl:'https://your-project-ref.supabase.co',supabaseAnonKey:'k'}",contentType:'application/javascript'}));
 const go=async u=>{await p.goto('http://localhost:8099'+u);await p.waitForTimeout(900)};
 await go('/');ok(await p.locator('.shero h1').count()===1,'home at /');ok(await p.evaluate(()=>document.querySelector('#shotImg').complete&&document.querySelector('#shotImg').naturalWidth>0),'screenshots load');
 await go('/privacy');ok(/Privacy Policy/.test(await p.locator('.slegal h1').innerText()),'/privacy');
 await go('/terms');ok(/Terms of Service/.test(await p.locator('.slegal h1').innerText()),'/terms');
 await p.click('.snav a:has-text("Sign in")');await p.waitForTimeout(900);ok(new URL(p.url()).pathname==='/'&&(await p.locator('#authView h1').innerText())==='Sign in','Sign in from /terms goes to /#/login');
 await go('/?demo=1');ok(/Example Travel/.test(await p.locator('#bizName').innerText()),'demo works with CSP');
 ok(errs.length===0,'no errors '+errs.join(' | '));await b.close()})();
