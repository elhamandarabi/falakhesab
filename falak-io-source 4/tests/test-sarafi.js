const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});await p.addInitScript(()=>{window.FALAK_EXCHANGE=true});const errs=[];
 p.on('pageerror',e=>errs.push('PAGEERR '+e.message));await p.route(/fonts\.g/,r=>r.abort());
 require('fs').writeFileSync('site/_demo.html',require('fs').readFileSync('site/index.html','utf8').replace('<script src="config.js"></script>','<script>window.FALAK_CONFIG={}</script>'));
 await p.goto('file://'+process.cwd()+'/site/_demo.html');await p.waitForTimeout(800);
 const nav=async h=>{await p.evaluate(h=>location.hash=h,h);await p.waitForTimeout(300);const t=await p.locator('body').innerText();if(/Something went wrong/.test(t))errs.push(h+': '+t.match(/Something went wrong.*/)[0])};
 const save=async()=>{await p.click('#saveBtn');await p.waitForTimeout(400)};
 const bal=async()=>{await nav('#/summary');return p.locator('.sheet .ok, .sheet .small.neg').first().textContent()};
 const idOf=async(t,f,v)=>p.evaluate(([t,f,v])=>JSON.parse(localStorage.getItem('falak_io_demo_v2')).records.find(r=>r.type===t&&r.data[f]===v).id,[t,f,v]);
 console.log('start',await bal());
 await nav('#/summary');console.log('sarafi hidden by default:',!(await p.locator('#nav').innerText()).includes('Hawala'));
 await nav('#/customize');for(const k of ['sarafi','exchange','hawala','fxrate','cashcount'])await p.check(`#cf input[value=${k}]`);await p.click('#cf button[type=submit]');await p.waitForTimeout(400);
 console.log('sarafi shown after customize:',(await p.locator('#nav').innerText()).includes('Hawala'));
 // currencies + cash accounts
 for(const [c,n] of [['AFN','Afghani'],['TRY','Turkish lira']]){await nav('#/currency/new');await p.fill('#fCode',c);await p.fill('#fName',n);await p.fill('#fRate',c==='AFN'?'0.0141':'0.029');await save()}
 for(const [n,c] of [['Cash AFN','AFN'],['Cash TRY','TRY']]){await nav('#/bank/new');await p.fill('#fName',n);await p.selectOption('#fType','cash').catch(()=>{});await p.selectOption('#fCur',c);await save()}
 const usd=await idOf('bank','name','Cash on hand'),afn=await idOf('bank','name','Cash AFN');
 // rates
 await nav('#/fxrate/new');const rows=await p.locator('#f tbody tr').allInnerTexts();console.log('rate rows:',rows.map(r=>r.split('\t')[0].trim()).join(', '));
 const idx=async c=>(await p.locator('#f tbody tr').allInnerTexts()).findIndex(r=>r.startsWith(c));
 let i=await idx('AFN');await p.fill('#rb'+i,'70.5');await p.fill('#rs'+i,'71');i=await idx('TRY');await p.fill('#rb'+i,'34.1');await p.fill('#rs'+i,'34.3');await save();
 // exchange 2 first: customer gives 71000 AFN gets USD
 await nav('#/exchange/new');await p.fill('#fCust','Hamid');await p.selectOption('#fGB',afn);await p.selectOption('#fRB',usd);await p.fill('#fGive','71000');await p.waitForTimeout(150);
 console.log('AFN->USD suggested rate',await p.inputValue('#fRate'),'recv',await p.inputValue('#fRecv'),'profit',await p.textContent('#xProfit'));await save();
 await nav('#/exchange/new');await p.fill('#fCust','Ahmad Shah');await p.fill('#fPhone','+93 70 123 4567');await p.selectOption('#fGB',usd);await p.selectOption('#fRB',afn);await p.fill('#fGive','1000');await p.waitForTimeout(150);
 console.log('USD->AFN suggested rate',await p.inputValue('#fRate'),'recv',await p.inputValue('#fRecv'),'profit',await p.textContent('#xProfit'),'| hint:',await p.textContent('#xHint'));await save();
 console.log('exchange slip:',(await p.locator('.card.doc').innerText()).replace(/\s+/g,' '));
 console.log('wa:',decodeURIComponent(await p.locator('a[href^="https://wa.me"]').getAttribute('href')).replace(/\n/g,' | '));
 await p.screenshot({path:'sf-exchange.png',fullPage:true});
 // partner
 await nav('#/hawala/new');console.log('hawala without partner shows note:',(await p.locator('.note').count())>0);
 await p.click('#addP');await p.waitForTimeout(300);console.log('kind preset:',await p.inputValue('#fKind'));await p.fill('#fName','Kabul Partner (USD)');await save();
 // hawala out
 await nav('#/hawala/new');await p.fill('#fSnd','Rahim');await p.fill('#fSndP','+90 555 111 2233');await p.fill('#fRcv','Karim');await p.fill('#fTo','Kabul');await p.fill('#fAmt','500');await p.fill('#fCom','10');await p.selectOption('#fBank',usd);
 console.log('hint out:',await p.textContent('#hHint'));await save();
 console.log('hawala slip:',(await p.locator('.card.doc').innerText()).replace(/\s+/g,' '));
 await p.screenshot({path:'sf-hawala.png',fullPage:true});
 // hawala in pending, then mark paid
 await nav('#/hawala/new');await p.selectOption('#fDir','in');await p.fill('#fSnd','Nasir (Kabul)');await p.fill('#fRcv','Zahra');await p.fill('#fRcvP','+90 555 999 8877');await p.fill('#fAmt','300');await p.fill('#fCom','5');await save();
 await nav('#/sarafi');console.log('tiles:',(await p.locator('.kpis').innerText()).replace(/\s+/g,' '));
 const tb=async h=>{const c=p.locator('.card',{has:p.locator('h2',{hasText:new RegExp('^'+h+'$')})});return (await c.locator('tbody').innerText()).replace(/\t/g,' | ').replace(/\n/g,' // ')};
 console.log('[partners]',await tb('Partner sarafs'));console.log('[pending]',await tb('Pending hawala'));console.log('[cash]',await tb('Cash by currency'));
 const hin=await idOf('hawala','receiver','Zahra');await nav('#/hawala/view/'+hin);await p.click('#hwPaid');await p.waitForTimeout(200);console.log('confirm:',await p.textContent('#modal p'));await p.click('#mYes');await p.waitForTimeout(400);
 await nav('#/sarafi');console.log('[partners after paid]',await tb('Partner sarafs'));console.log('[pending after]',await tb('Pending hawala'));
 // cash count AFN
 await nav('#/sarafi');await p.click(`[data-cc="${afn}"]`);await p.waitForTimeout(300);console.log('system AFN:',await p.textContent('#ccSys'));await p.fill('#fCnt','450');await p.waitForTimeout(100);console.log('diff:',await p.textContent('#ccDiff'));await save();
 await nav('#/sarafi');console.log('[cash after count]',await tb('Cash by currency'));console.log('[daily]',await tb('Daily cash report'));
 await p.screenshot({path:'sf-overview.png',fullPage:true});
 console.log('balance',await bal());
 await nav('#/summary');console.log('P&L lines:',(await p.locator('#view').innerText()).split('\n').filter(l=>/Exchange|Hawala|Cash over/.test(l)).join(' ; ').replace(/\t/g,' '));
 for(const h of ['#/exchange','#/hawala','#/fxrate','#/cashcount','#/reports/cashflow','#/reports/trial'])await nav(h);
 console.log('errors',errs);await b.close()})();
