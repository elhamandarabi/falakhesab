// custom fields + attachments (cloud mock with in-memory storage, then demo mode)
const { chromium } = require('playwright');const fs=require('fs');
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
const PNG=fs.readFileSync('vendor/logo-mark.png');
const PDF=Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await p.addInitScript(()=>sessionStorage.setItem('mockpersist','1'));
 await p.route(/fonts\.g/,r=>r.abort());
 await p.route(/supabase-js|vendor\/supabase-/,r=>r.fulfill({body:fs.readFileSync('mock-supabase.js','utf8'),contentType:'application/javascript'}));
 await p.route(/config\.js$/,r=>r.fulfill({body:"window.FALAK_CONFIG={supabaseUrl:'https://x.supabase.co',supabaseAnonKey:'k',superAdmin:'falaktravelagency11@gmail.com'}",contentType:'application/javascript'}));
 const base='file://'+process.cwd()+'/site/index.html';
 const hash=async h=>{await p.evaluate(x=>location.hash=x,h);await p.waitForTimeout(500)};
 const auth=async(mode,e)=>{await hash('#/x');await hash('#/'+mode);await p.fill('#aEmail',e);await p.fill('#aPw','secret12');await p.click('#af button');await p.waitForTimeout(700)};
 const toastTxt=()=>p.locator('#toast').innerText().catch(()=>'');
 await p.goto(base);await p.waitForTimeout(500);
 await auth('signup','own@x.com');await auth('signup','lim@x.com');await auth('login','own@x.com');
 await p.click('#addBiz');await p.fill('#nbName','Attach Co');await p.check('#nbSample');await p.click('#nbBtn');await p.waitForTimeout(1000);
 // custom fields
 await hash('#/settings');ok(await p.locator('#cfCard').count()===1,'Custom fields card in Settings');
 await p.click('#cfAdd');let rows=p.locator('#cfList .ftitem');
 await rows.nth(0).locator('[data-k=label]').fill('Passport number');await rows.nth(0).locator('[data-k=list]').check();
 await p.click('#cfAdd');rows=p.locator('#cfList .ftitem');await rows.nth(1).locator('[data-k=type]').selectOption('salesinvoice');await p.waitForTimeout(100);
 rows=p.locator('#cfList .ftitem');await rows.nth(1).locator('[data-k=label]').fill('File number');await rows.nth(1).locator('[data-k=print]').check();
 await p.click('#cfAdd');rows=p.locator('#cfList .ftitem');await rows.nth(2).locator('[data-k=type]').selectOption('customer');await rows.nth(2).locator('[data-k=kind]').selectOption('select');await p.waitForTimeout(100);
 rows=p.locator('#cfList .ftitem');await rows.nth(2).locator('[data-k=label]').fill('Branch');await rows.nth(2).locator('[data-k=options]').fill('Istanbul\nKabul');
 await p.screenshot({path:'cf-settings.png',fullPage:true});
 await p.click('#cfSave');await p.waitForTimeout(500);ok(/Custom fields saved/.test(await toastTxt()),'custom fields saved');
 // customer with custom fields + attachment on a new record (queued, uploaded after save)
 await hash('#/customer/new');ok(await p.locator('.cfbox input').count()===1&&await p.locator('.cfbox select').count()===1,'customer form shows custom fields');
 await p.fill('#fName','Sara Ahmadi').catch(async()=>{await p.locator('#f input').first().fill('Sara Ahmadi')});
 const cfIds=await p.evaluate(()=>[...document.querySelectorAll('.cfbox [id^=cf_]')].map(e=>e.id));
 await p.fill('#'+cfIds[0],'P1234567');await p.selectOption('#'+cfIds[1],'Kabul');
 await p.setInputFiles('#attFile',{name:'passport scan.png',mimeType:'image/png',buffer:PNG});await p.waitForTimeout(300);
 ok(/passport-scan\.png/.test(await p.locator('#attList').innerText())&&/Saved with the record/.test(await p.locator('#attList').innerText()),'file queued on new record');
 await p.screenshot({path:'att-new.png',fullPage:true});
 await p.click('#saveBtn');await p.waitForTimeout(900);
 await hash('#/customer');ok(/Passport number/.test(await p.locator('thead').innerText())&&/P1234567/.test(await p.locator('tbody').innerText()),'custom field column in the list');
 const cid=await p.evaluate(()=>{const tr=[...document.querySelectorAll('tbody tr.click')].find(t=>/Sara Ahmadi/.test(t.textContent));return tr&&tr.dataset.id});
 await hash('#/customer/edit/'+cid);await p.waitForTimeout(400);
 ok((await p.inputValue('#'+cfIds[0]))==='P1234567'&&(await p.inputValue('#'+cfIds[1]))==='Kabul','custom values kept');
 ok(/passport-scan\.png/.test(await p.locator('#attList').innerText()),'queued file uploaded after save');
 await p.setInputFiles('#attFile',{name:'contract.pdf',mimeType:'application/pdf',buffer:PDF});await p.waitForTimeout(600);
 ok((await p.locator('#attList .attrow').count())===2,'second file added to existing record');
 await p.click('#attList [data-open*="passport"]');await p.waitForTimeout(400);ok(await p.locator('.attview img').count()===1,'image opens in viewer');
 await p.screenshot({path:'att-view.png'});await p.click('#attClose');
 await p.locator('#attList [data-rm*="contract"]').click();await p.click('#mYes');await p.waitForTimeout(500);ok((await p.locator('#attList .attrow').count())===1,'file removed');
 // invoice: printed custom field + attachment on document view
 await hash('#/salesinvoice');await p.locator('tbody tr.click').first().click();await p.waitForTimeout(400);
 const iid=await p.evaluate(()=>location.hash.split('/')[3]);
 await hash('#/salesinvoice/edit/'+iid);const inv=await p.evaluate(()=>[...document.querySelectorAll('.cfbox [id^=cf_]')].map(e=>e.id));await p.fill('#'+inv[0],'F-2026-001');await p.click('#saveBtn');await p.waitForTimeout(700);
 await hash('#/salesinvoice/view/'+iid);ok(/File number[\s\S]*F-2026-001/.test(await p.locator('.doc').innerText()),'custom field printed on invoice');
 await p.setInputFiles('#attFile',{name:'bank receipt.jpg',mimeType:'image/jpeg',buffer:PNG});await p.waitForTimeout(600);
 ok(/bank-receipt\.jpg/.test(await p.locator('#attList').innerText()),'attachment on invoice view');
 await p.screenshot({path:'att-invoice.png',fullPage:true});
 // CSV export includes custom column
 // limited user: sees files, cannot add on other tabs
 await hash('#/users');await p.click('#addU');await p.fill('#mEmail','lim@x.com');await p.selectOption('#mRole','viewer');await p.click('#mf button[type=submit]');await p.waitForTimeout(400);
 await p.click('#signOut');await p.waitForTimeout(400);await auth('login','lim@x.com');await p.waitForTimeout(500);
 await p.locator('.tile').first().click().catch(()=>{});await p.waitForTimeout(800);
 await hash('#/salesinvoice/view/'+iid);await p.waitForTimeout(500);
 ok(/bank-receipt/.test(await p.locator('#attList').innerText()),'view-only user can see and open files');
 ok(await p.locator('#attDrop').isHidden()&&await p.locator('#attList [data-rm]').count()===0,'view-only user cannot add or remove files');
 await p.click('#signOut');await p.waitForTimeout(400);await auth('login','own@x.com');await p.locator('.tile').first().click().catch(()=>{});await p.waitForTimeout(800);
 // deleting a record removes its files
 await hash('#/customer/edit/'+cid);await p.click('#del');await p.click('#mYes');await p.waitForTimeout(800);
 const left=await p.evaluate(id=>Object.keys((JSON.parse(sessionStorage.getItem('mockdb')).db.files)||{}).filter(k=>k.includes(id)).length,cid);ok(left===0,'files removed with the record');
 // Dari
 await hash('#/settings');await p.selectOption('#langSide','fa');await p.waitForTimeout(400);await p.locator('#cfCard').screenshot({path:'cf-settings-fa.png'});await p.selectOption('#langSide','en');
 // demo mode
 await p.goto(base+'?demo=1');await p.waitForTimeout(1200);await hash('#/receipt');await p.locator('tbody tr.click').first().click();await p.waitForTimeout(500);
 const rh=await p.evaluate(()=>location.hash);
 await p.setInputFiles('#attFile',{name:'cash.png',mimeType:'image/png',buffer:PNG});await p.waitForTimeout(600);ok(/cash\.png/.test(await p.locator('#attList').innerText()),'demo: attach works ('+rh+')');
 ok(errs.length===0,'no page errors '+errs.join(' | '));
 await b.close();})();
