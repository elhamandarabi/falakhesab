// public website: home page, demo, privacy/terms, CSV export
const { chromium } = require('playwright');const fs=require('fs');
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
(async()=>{
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1300,height:900},colorScheme:'light',acceptDownloads:true});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await p.route(/fonts\.g/,r=>r.abort());
 await p.route(/supabase-js|vendor\/supabase-/,r=>r.fulfill({body:fs.readFileSync('mock-supabase.js','utf8'),contentType:'application/javascript'}));
 await p.route(/config\.js$/,r=>r.fulfill({body:"window.FALAK_CONFIG={supabaseUrl:'https://x.supabase.co',supabaseAnonKey:'k',superAdmin:'falaktravelagency11@gmail.com'}",contentType:'application/javascript'}));
 const base='file://'+process.cwd()+'/site/index.html';
 await p.goto(base);await p.waitForSelector('.shero',{timeout:8000}).catch(()=>{});
 ok(await p.locator('.shero h1').count()===1,'home page at the root for visitors');
 ok(/online accounting/i.test(await p.title()),'SEO title: '+await p.title());
 for(const id of ['s-features','s-pricing','s-security','s-export','s-about','s-contact','s-faq'])ok(await p.locator('#'+id).count()===1,'section '+id);
 ok(await p.locator('#sPlans .plancard').count()===3,'3 prices');
 ok(/\$19/.test(await p.locator('#sPlans').innerText()),'Pro price shown');
 ok(await p.locator('a[href*="demo="]').count()>=4,'View demo buttons');
 ok(await p.locator('a[href="#/signup"]').count()>=2,'Try free buttons');
 ok(/e-Fatura/.test(await p.locator('#s-faq').innerText()),'honest e-Fatura answer');
 ok(!/★|5 stars|testimonial/i.test(await p.locator('#authView main').innerText()),'no made-up reviews');
 await p.screenshot({path:'site-home.png',fullPage:true});
 // tabs
 await p.click('.stab[data-shot=travel]');ok(/travel\.jpg/.test(await p.getAttribute('#shotImg','src')),'screenshot tabs');
 // nav scroll link
 await p.click('.slinks a[data-sec=pricing]');await p.waitForTimeout(600);ok(await p.evaluate(()=>document.getElementById('s-pricing').getBoundingClientRect().top<200),'Pricing link scrolls');
 // privacy + terms
 await p.evaluate(()=>location.hash='#/privacy');await p.waitForTimeout(400);ok(/Privacy Policy/.test(await p.locator('.slegal h1').innerText()),'privacy page');ok(/KVKK/.test(await p.locator('.slegal').innerText()),'privacy mentions KVKK');
 await p.screenshot({path:'site-privacy.png'});
 await p.evaluate(()=>location.hash='#/terms');await p.waitForTimeout(400);ok(/Terms of Service/.test(await p.locator('.slegal h1').innerText()),'terms page');
 // footer link back to a home section from a legal page
 await p.click('.sfoot a[data-sec=faq]');await p.waitForTimeout(700);ok(await p.locator('#s-faq').count()===1,'footer FAQ link from terms opens home');
 // sign in from website
 await p.click('.snav a:has-text("Sign in")');await p.waitForTimeout(400);ok((await p.locator('#authView h1').innerText())==='Sign in','Sign in button opens sign-in');
 await p.evaluate(()=>location.hash='#/signup/basic');await p.waitForTimeout(400);ok(await p.locator('input[name=sPlan][value=basic]').isChecked(),'pricing card preselects Basic');
 // Dari + mobile
 await p.evaluate(()=>location.hash='#/home');await p.waitForTimeout(400);await p.selectOption('#langSite','fa');await p.waitForTimeout(500);
 await p.screenshot({path:'site-home-fa.png',fullPage:false});
 const left=await p.evaluate(()=>{const o=[];const w=document.createTreeWalker(document.querySelector('#authView main'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.trim();if(/[A-Za-z]{4,}/.test(t)&&!/^(Falak Hesab|Falak Travel|Pro|WhatsApp.*|falakhesab\.com.*|Supabase.*|Netlify.*|Manager\.io.*|.*@.*)$/.test(t))o.push(t)}return o});
 console.log('fa leftovers ('+left.length+'):',JSON.stringify(left.slice(0,40)));
 await p.selectOption('#langSite','en');await p.waitForTimeout(300);
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(300);await p.screenshot({path:'site-home-mobile.png',fullPage:true});
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no sideways scroll on phone');
 await p.setViewportSize({width:1300,height:900});
 // public demo
 await p.goto(base+'?demo=travel');await p.waitForTimeout(1500);await p.keyboard.press('Escape');
 ok(/Example Travel/.test(await p.locator('#bizName').innerText()),'demo opens sample business');
 ok(/Demo with sample data/.test(await p.locator('#banner').innerText()),'demo banner');
 await p.evaluate(()=>location.hash='#/ticket');await p.waitForTimeout(400);ok(await p.locator('tbody tr.click').count()===3,'demo has 3 tickets');
 const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#csvBtn')]);const f=await dl.path();const csv=fs.readFileSync(f,'utf8');
 ok(/Mariam Sultani/.test(csv)&&csv.charCodeAt(0)===0xfeff,'CSV export of a list (UTF-8 for Excel)');
 await p.evaluate(()=>location.hash='#/reports/trial');await p.waitForTimeout(500);
 const [dl2]=await Promise.all([p.waitForEvent('download'),p.click('#csvRep')]);ok(/Total/.test(fs.readFileSync(await dl2.path(),'utf8')),'CSV export of a report');
 ok(errs.length===0,'no page errors '+errs.join(' | '));
 await b.close();})();
