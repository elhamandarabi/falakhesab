// choosing a plan at sign-up; Free watermark on documents
const { chromium } = require('playwright');const fs=require('fs');
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:950}});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await p.addInitScript(()=>sessionStorage.setItem('mockpersist','1'));
 await p.route(/fonts\.g/,r=>r.abort());
 await p.route(/supabase-js|vendor\/supabase-/,r=>r.fulfill({body:fs.readFileSync('mock-supabase.js','utf8'),contentType:'application/javascript'}));
 await p.route(/config\.js$/,r=>r.fulfill({body:"window.FALAK_CONFIG={supabaseUrl:'https://x.supabase.co',supabaseAnonKey:'k',superAdmin:'falaktravelagency11@gmail.com'}",contentType:'application/javascript'}));
 const base='file://'+process.cwd()+'/site/index.html';
 const hash=async h=>{await p.evaluate(x=>location.hash=x,h);await p.waitForTimeout(450)};
 await p.goto(base);await p.waitForTimeout(500);
 await hash('#/login');
 ok(/Create an account/.test(await p.locator('.authcard').innerText()),'login links to Create an account');
 await hash('#/signup');
 ok(await p.locator('#planPick .pp').count()===3,'3 plan choices at sign-up');
 ok(await p.locator('input[name=sPlan][value=pro]').isChecked(),'Pro preselected');
 ok(/\$19/.test(await p.locator('[data-pp=pro]').innerText()),'Pro price on sign-up');
 ok(/Unlimited users/.test(await p.locator('#ppFeat').innerText()),'Pro features listed');
 await p.click('.pp:has(input[value=free])');await p.waitForTimeout(150);
 ok(/1 user/.test(await p.locator('#ppFeat').innerText()),'features follow the choice');
 await p.screenshot({path:'su-signup.png'});
 await p.setViewportSize({width:390,height:900});await p.screenshot({path:'su-signup-mobile.png',fullPage:true});await p.setViewportSize({width:1300,height:950});
 const signup=async(e,plan)=>{await hash('#/login');await hash('#/signup');await p.click(`.pp:has(input[value=${plan}])`);await p.fill('#aEmail',e);await p.fill('#aPw','secret12');await p.click('#af button');await p.waitForTimeout(300)};
 const login=async e=>{await hash('#/x');await hash('#/login');await p.fill('#aEmail',e);await p.fill('#aPw','secret12');await p.click('#af button');await p.waitForTimeout(700)};
 await signup('free@x.com','free');await signup('basic@x.com','basic');
 // Free
 await login('free@x.com');await p.click('#addBiz');await p.fill('#nbName','Free Shop');await p.check('#nbSample');await p.click('#nbBtn');await p.waitForTimeout(900);
 ok(await p.locator('#banner').isHidden(),'Free: no trial banner');
 ok(await p.locator('#nav a[href="#/ticket"]').count()===0,'Free: no travel tabs');
 await hash('#/salesinvoice');await p.locator('tbody tr.click').first().click();await p.waitForTimeout(400);
 ok(/Made with Falak Hesab/.test(await p.locator('#view').innerText()),'Free: Made with Falak Hesab on invoice');
 await p.screenshot({path:'su-free-invoice.png'});
 await hash('#/billing');ok(/Your plan/.test(await p.locator('.plancard').first().innerText()),'Free card is current');
 await p.click('#signOut');await p.waitForTimeout(400);
 // Basic trial
 await login('basic@x.com');await p.click('#addBiz');await p.fill('#nbName','Basic Co');await p.click('#nbBtn');await p.waitForTimeout(900);
 ok(/Free trial/.test(await p.locator('#banner').innerText()),'Basic: trial banner');
 ok(await p.locator('#nav a[href="#/ticket"]').count()===0,'Basic trial: no travel tabs');
 await hash('#/settings');ok(await p.locator('#wsSlug').count()===1,'Basic trial: company address allowed');
 await hash('#/billing');ok(/Basic/.test(await p.locator('.planhead h2').innerText()),'billing shows Basic (trial)');
 await hash('#/salesinvoice/new');ok(!/Made with Falak/.test(await p.locator('#view').innerText()),'no watermark on paid trial');
 ok(errs.length===0,'no page errors '+errs.join(' | '));
 await b.close();})();
