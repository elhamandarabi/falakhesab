// help chatbot: prepared answers, AI requests, limits, languages, visibility
const { chromium } = require('playwright');const fs=require('fs');
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
(async()=>{
 const b=await chromium.launch();
 // ---------- A. demo mode ----------
 let p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await p.route(/fonts\.g/,r=>r.abort());
 await p.goto('file://'+process.cwd()+'/site/_demo.html#/summary');await p.waitForTimeout(1200);
 ok(await p.locator('#chatBtn').isVisible(),'demo: chat button visible');
 await p.click('#chatBtn');await p.waitForTimeout(200);
 ok(await p.locator('#chatBox').isVisible()&&await p.locator('#chatBtn').isHidden(),'panel opens, button hides');
 ok(await p.locator('#chatSug .chip').count()===5,'5 suggestions');
 await p.locator('#chatSug .chip').first().click();await p.waitForTimeout(300);
 let last=await p.locator('#chatMsgs .cm.bot').last().innerText();
 ok(/New sales invoice/.test(last),'prepared answer for invoice');
 ok(await p.locator('#chatMsgs .cgo a[data-go="#/salesinvoice"]').count()===1,'button to Sales Invoices');
 await p.click('#chatMsgs .cgo a[data-go="#/salesinvoice"]');await p.waitForTimeout(600);
 ok(/#\/salesinvoice$/.test(p.url()),'button opens the page');
 await p.fill('#chatIn','how much does pro cost');await p.press('#chatIn','Enter');await p.waitForTimeout(300);
 ok(/\$19/.test(await p.locator('#chatMsgs .cm.bot').last().innerText()),'price answer');
 await p.fill('#chatIn','why is the sky blue in winter compared to summer evenings');await p.press('#chatIn','Enter');await p.waitForTimeout(500);
 ok(/Talk to a person/.test(await p.locator('#chatMsgs .cm.bot').last().innerText())&&await p.locator('#chatMsgs .cm.cerr').count()===1,'demo: unknown question → contact us');
 ok(/wa\.me/.test(await p.getAttribute('#chatWa','href'))&&/sky blue/.test(decodeURIComponent(await p.getAttribute('#chatWa','href'))),'Talk to a person carries the question');
 await p.reload();await p.waitForTimeout(1000);await p.click('#chatBtn');
 ok(await p.locator('#chatMsgs .cm.me').count()===3,'conversation kept in this tab');
 await p.screenshot({path:'chat-demo.png'});
 await p.click('#chatX');ok(await p.locator('#chatBox').isHidden(),'close');
 await p.emulateMedia({media:'print'});ok(await p.locator('#chatBtn').isHidden(),'hidden when printing');await p.emulateMedia({media:'screen'});
 await p.close();
 // ---------- B. cloud mode with mock database + fake chat function ----------
 p=await b.newPage({viewport:{width:1300,height:900}});p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await p.addInitScript(()=>sessionStorage.setItem('mockpersist','1'));
 await p.route(/fonts\.g/,r=>r.abort());
 await p.route(/supabase-js|vendor\/supabase-/,r=>r.fulfill({body:fs.readFileSync('mock-supabase.js','utf8'),contentType:'application/javascript'}));
 await p.route(/config\.js$/,r=>r.fulfill({body:"window.FALAK_CONFIG={supabaseUrl:'https://x.supabase.co',supabaseAnonKey:'anonkey',superAdmin:'falaktravelagency11@gmail.com'}",contentType:'application/javascript'}));
 const reqs=[];let mode='ok';
 await p.route('https://x.supabase.co/functions/v1/falak-chat',async r=>{const q=r.request();reqs.push({h:q.headers(),b:JSON.parse(q.postData()||'{}')});
   if(mode==='limit')return r.fulfill({status:429,contentType:'application/json',body:'{"error":"limit"}'});
   if(mode==='down')return r.fulfill({status:502,contentType:'application/json',body:'{"error":"ai_failed"}'});
   const last=reqs.at(-1).b.messages.at(-1).content;
   r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({reply:(reqs.at(-1).b.lang==='fa'?'پاسخ: ':'')+'AI says **bold** for: '+last+'\n1. step one\n<script>x</script>'})})});
 const base='file://'+process.cwd()+'/site/index.html';
 await p.goto(base);await p.waitForTimeout(900);
 ok(await p.locator('#chatBtn').isVisible(),'website visitor sees chat button');
 await p.click('#chatBtn');await p.fill('#chatIn','Do you support Afghani currency for my shop in Herat?');await p.click('#chatSend');await p.waitForTimeout(500);
 ok(reqs.length===1,'AI called for a long question');
 ok(reqs[0].h.authorization==='Bearer anonkey'&&reqs[0].h.apikey==='anonkey'&&reqs[0].b.signedIn===false,'visitor uses anon key');
 ok(reqs[0].b.lang==='en'&&Array.isArray(reqs[0].b.messages)&&reqs[0].b.messages.length===1,'request body: lang + messages');
 const bot=p.locator('#chatMsgs .cm.bot').last();
 ok(await bot.locator('b').count()===1&&await bot.locator('script').count()===0&&/<script>/.test(await bot.innerText()),'reply formatted and escaped');
 await p.fill('#chatIn','and in Turkish lira too, for invoices?');await p.click('#chatSend');await p.waitForTimeout(500);
 ok(reqs[1].b.messages.length===3&&reqs[1].b.messages[1].role==='assistant','conversation history sent');
 mode='limit';await p.fill('#chatIn','one more long question about something very specific please');await p.click('#chatSend');await p.waitForTimeout(500);
 ok(/many questions/.test(await p.locator('#chatMsgs .cm.bot').last().innerText()),'limit message');
 mode='down';await p.fill('#chatIn','another long question about something very specific please now');await p.click('#chatSend');await p.waitForTimeout(500);
 ok(/can't answer that right now/.test(await p.locator('#chatMsgs .cm.bot').last().innerText()),'AI down message');
 ok(!reqs.at(-1).b.messages.some(m=>/many questions/.test(m.content)),'error messages not sent to AI');
 mode='ok';
 // sign up + sign in, then ask inside the app
 const hash=async h=>{await p.evaluate(x=>location.hash=x,h);await p.waitForTimeout(450)};
 const auth=async(m,e)=>{await hash('#/x');await hash('#/'+m);await p.fill('#aEmail',e);await p.fill('#aPw','secret12');await p.click('#af button');await p.waitForTimeout(700)};
 await p.evaluate(()=>sessionStorage.removeItem('falak_chat_v1'));
 await auth('signup','c@x.com');await auth('login','c@x.com');
 await p.click('#addBiz');await p.fill('#nbName','C Travel');await p.click('#nbBtn');await p.waitForTimeout(900);
 await hash('#/ticket');
 if(await p.locator('#chatBox').isHidden())await p.click('#chatBtn');
 await p.fill('#chatIn','The airline refunded half of a ticket, how should I record the partial refund?');await p.click('#chatSend');await p.waitForTimeout(500);
 const r2=reqs.at(-1);
 ok(/^Bearer tok-/.test(r2.h.authorization),'customer sends own sign-in token');
 ok(r2.b.signedIn===true&&r2.b.page==='ticket'&&/pro|trial/i.test(r2.b.plan)&&r2.b.role==='owner','context: page, plan, role ('+r2.b.plan+')');
 // Dari: UI translated, question goes to AI with lang fa
 await p.selectOption('#langSide','fa');await p.waitForTimeout(700);
 ok(await p.locator('#chatBox header b').innerText()==='کمک فلک حساب','header translated');
 await p.fill('#chatIn','چطور فاکتور بسازم؟');await p.click('#chatSend');await p.waitForTimeout(500);
 ok(reqs.at(-1).b.lang==='fa'&&/^پاسخ/.test(await p.locator('#chatMsgs .cm.bot').last().innerText()),'Dari question → AI in Dari');
 await p.screenshot({path:'chat-fa.png'});
 await p.selectOption('#langSide','en');await p.waitForTimeout(500);
 // shared document link hides the chat
 // mobile layout
 await p.setViewportSize({width:390,height:800});await p.waitForTimeout(300);
 const bb=await p.locator('#chatBox').boundingBox();ok(bb&&bb.width>=389&&bb.height>=790,'mobile: full screen panel');
 await p.screenshot({path:'chat-mobile.png'});
 // super admin sees the Chat questions section
 await p.setViewportSize({width:1300,height:900});await p.click('#chatX').catch(()=>{});
 await p.click('#signOut');await p.waitForTimeout(500);await auth('signup','falaktravelagency11@gmail.com');await auth('login','falaktravelagency11@gmail.com');
 await p.evaluate(()=>location.hash='#/admin');await p.waitForTimeout(1200);
 ok(/Chat questions/.test(await p.locator('#view').innerText())&&/No questions yet/.test(await p.locator('#view').innerText()),'admin: Chat questions section');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();
})();
