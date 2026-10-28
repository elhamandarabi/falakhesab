const { chromium } = require('playwright');const fs=require('fs');
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
(async()=>{
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1300,height:900}});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await p.addInitScript(()=>sessionStorage.setItem('mockpersist','1'));
 await p.route(/fonts\.g/,r=>r.abort());
 await p.route(/supabase-js|vendor\/supabase-/,r=>r.fulfill({body:fs.readFileSync('mock-supabase.js','utf8'),contentType:'application/javascript'}));
 await p.route(/config\.js$/,r=>r.fulfill({body:"window.FALAK_CONFIG={supabaseUrl:'https://x.supabase.co',supabaseAnonKey:'k',superAdmin:'falaktravelagency11@gmail.com'}",contentType:'application/javascript'}));
 const base='file://'+process.cwd()+'/site/index.html';
 const h1=()=>p.locator('#authView h1').textContent();
 const signup=async(e)=>{await p.evaluate(()=>location.hash='#/login');await p.waitForTimeout(100);await p.evaluate(()=>location.hash='#/signup');await p.waitForTimeout(200);await p.fill('#aEmail',e);await p.fill('#aPw','secret12');await p.click('#af button');await p.waitForTimeout(300)};
 const login=async(e)=>{await p.evaluate(()=>location.hash='#/login');await p.waitForTimeout(200);await p.fill('#aEmail',e);await p.fill('#aPw','secret12');await p.click('#af button');await p.waitForTimeout(700)};
 await p.goto(base);await p.waitForTimeout(500);
 await signup('owner@falak.io');await signup('staff@falak.io');await signup('outsider@x.com');await signup('falaktravelagency11@gmail.com');
 await login('owner@falak.io');
 await p.click('#addBiz');await p.fill('#nbName','Falak Travel');await p.click('#nbBtn');await p.waitForTimeout(800);
 // logo
 const png=fs.readFileSync('vendor/logo-mark.png');
 await p.evaluate(()=>location.hash='#/settings');await p.waitForTimeout(300);
 await p.setInputFiles('#logoFile',{name:'l.png',mimeType:'image/png',buffer:png});await p.waitForTimeout(800);
 ok(await p.locator('#wsSlug').count()===1,'settings has company address field');
 ok((await p.getAttribute('#wsSlug','placeholder'))==='falak-travel','placeholder suggests falak-travel');
 await p.fill('#wsSlug','admin');await p.click('#wsForm button[type=submit]');await p.waitForTimeout(200);
 ok(/reserved/i.test(await p.locator('#wsMsg').textContent()),'reserved word rejected');
 await p.fill('#wsSlug','ab');await p.click('#wsForm button[type=submit]');await p.waitForTimeout(200);
 ok(/3 to 40/i.test(await p.locator('#wsMsg').textContent()),'too short rejected');
 await p.fill('#wsSlug','Falak Travel!');ok((await p.inputValue('#wsSlug'))==='falak-travel-','typing is cleaned: '+await p.inputValue('#wsSlug'));
 await p.click('#wsForm button[type=submit]');await p.waitForTimeout(500);
 ok(/falakhesab\.com\/falak-travel/.test(await p.locator('#wsCard .wslink').textContent()),'address saved and shown');
 await p.screenshot({path:'ws-settings.png',fullPage:false});
 // users page link
 await p.evaluate(()=>location.hash='#/users');await p.waitForTimeout(300);
 ok(await p.locator('#wsCopyU').count()===1,'users page shows staff sign-in link');
 ok(/wa\.me/.test(await p.getAttribute('#wsWa','href')),'whatsapp invite link');
 await p.click('#addU');await p.fill('#mEmail','staff@falak.io');await p.click('#mf button[type=submit]');await p.waitForTimeout(400);
 // another owner's business (own free trial) tries to take the same address
 await p.click('#signOut');await p.waitForTimeout(400);await login('outsider@x.com');
 await p.click('#addBiz');await p.fill('#nbName','Other Co');await p.click('#nbBtn');await p.waitForTimeout(800);
 await p.evaluate(()=>location.hash='#/settings');await p.waitForTimeout(300);
 await p.fill('#wsSlug','falak-travel');await p.click('#wsForm button[type=submit]');await p.waitForTimeout(300);
 ok(/taken/i.test(await p.locator('#wsMsg').textContent()),'taken address rejected');
 await p.click('#signOut');await p.waitForTimeout(400);
 // branded sign-in page
 await p.goto(base+'?ws=falak-travel');await p.waitForSelector('.wsname',{timeout:8000}).catch(()=>{});
 ok((await p.locator('.wsname').textContent())==='Falak Travel','branded sign-in shows company name');
 ok(await p.locator('.authcard .wslogo').count()===1,'branded sign-in shows logo');
 ok(/Falak Travel/.test(await p.title()),'page title: '+await p.title());
 await p.screenshot({path:'ws-login.png'});
 await p.setViewportSize({width:390,height:800});await p.screenshot({path:'ws-login-mobile.png'});await p.setViewportSize({width:1300,height:900});
 // staff lands in the business
 await login('staff@falak.io');
 ok(/#\/(summary|receipt|payment|salesinvoice|customer)/.test(await p.evaluate(()=>location.hash)),'staff lands inside business: '+await p.evaluate(()=>location.hash));
 ok(/Falak Travel/.test(await p.locator('#bizName').textContent()),'staff sees Falak Travel');
 await p.click('#signOut');await p.waitForTimeout(400);
 ok((await p.locator('.wsname').count())===1,'after sign-out the branded page is back');
 // outsider
 await login('outsider@x.com');
 ok((await h1())==='No access yet','outsider gets No access yet');
 await p.screenshot({path:'ws-noaccess.png'});
 await p.click('#aOut2');await p.waitForTimeout(400);ok((await h1())==='Sign in','outsider signed out');
 // super admin
 await login('falaktravelagency11@gmail.com');
 ok(/Falak Travel/.test(await p.locator('#bizName').textContent()),'super admin opens company');
 await p.evaluate(()=>location.hash='#/admin');await p.waitForTimeout(400);
 ok(/\/falak-travel/.test(await p.locator('#view').textContent()),'admin list shows address column');
 await p.click('#signOut');await p.waitForTimeout(400);
 // unknown company
 await p.goto(base+'?ws=nobody-here');await p.waitForSelector('#authView h1, #view h1',{timeout:8000}).catch(()=>{});await p.waitForTimeout(300);
 ok((await h1())==='Company not found','unknown address shows Company not found');
 await p.screenshot({path:'ws-missing.png'});
 // Dari
 await p.goto(base+'?ws=falak-travel');await p.waitForSelector('#authView h1, #view h1',{timeout:8000}).catch(()=>{});await p.waitForTimeout(300);
 await p.selectOption('#langAuth','fa').catch(()=>{});await p.waitForTimeout(300);await p.screenshot({path:'ws-login-fa.png'});
 ok(errs.length===0,'no page errors '+errs.join(' | '));
 await b.close();})();
