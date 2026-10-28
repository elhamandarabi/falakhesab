// Full crawl: build data for every module, then visit every page in 4 languages and run integrity checks.
const { chromium } = require('playwright');const fs=require('fs');
const LANGS=(process.argv[2]||'en,fa,ps,tr').split(',');
(async()=>{const b=await chromium.launch();const errs=[];const ctx=await b.newContext({viewport:{width:1300,height:900}});const p=await ctx.newPage();await p.addInitScript(()=>{window.FALAK_EXCHANGE=true});
 p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/ERR_|fonts/.test(m.text()))errs.push('CONSOLE '+m.text())});await p.route(/fonts\.g/,r=>r.abort());
 fs.writeFileSync('site/_demo.html',fs.readFileSync('site/index.html','utf8').replace('<script src="config.js"></script>','<script>window.FALAK_CONFIG={}</script>'));
 await p.goto('file://'+process.cwd()+'/site/_demo.html');await p.waitForTimeout(800);
 const nav=async h=>{await p.evaluate(h=>location.hash=h,h);await p.waitForTimeout(220);const t=await p.locator('body').innerText();if(/Something went wrong/.test(t))errs.push(h+': '+t.match(/Something went wrong.*/)[0])};
 const save=async()=>{await p.click('#saveBtn');await p.waitForTimeout(350)};
 const db=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('falak_io_demo_v2')));
 const idOf=async(t,f,v)=>(await db()).records.find(r=>r.type===t&&r.data[f]===v).id;
 // ---- setup ----
 await nav('#/customize');for(const k of ['sarafi','exchange','hawala','fxrate','cashcount'])await p.check(`#cf input[value=${k}]`);await p.click('#cf button[type=submit]');await p.waitForTimeout(400);
 await nav('#/currency/new');await p.fill('#fCode','AFN');await p.fill('#fName','Afghani');await p.fill('#fRate','0.0141');await save();
 await nav('#/bank/new');await p.fill('#fName','Cash AFN');await p.selectOption('#fCur','AFN');await save();
 await nav('#/supplier/new');await p.fill('#fName','Kam Air');await p.selectOption('#fKind','airline');await p.fill('#fOpen','-2000');await save();
 await nav('#/supplier/new');await p.fill('#fName','Kabul Partner');await p.selectOption('#fKind','saraf');await save();
 await nav('#/customer/new');await p.fill('#fName','Kabul Agent');await p.selectOption('#fKind','agent');await save();
 await nav('#/customer/new');await p.fill('#fName','elham');await p.fill('#fOpen','100');await save();
 const air=await idOf('supplier','name','Kam Air'),ag=await idOf('customer','name','Kabul Agent'),el=await idOf('customer','name','elham'),usd=await idOf('bank','name','Cash on hand'),afn=await idOf('bank','name','Cash AFN');
 await nav('#/ticket/new');await p.fill('#fPax','Pax One');await p.selectOption('#fAir',air);await p.selectOption('#fCust',ag);await p.fill('#fSell','400');await p.fill('#fCost','350');await save();
 await nav('#/ticket/new');await p.fill('#fPax','Pax Two');await p.selectOption('#fAir',air);await p.selectOption('#fCust',el);await p.fill('#fSell','300');await p.fill('#fCost','260');await p.check('#fRef1');await p.fill('#fRCust','200');await p.fill('#fRAir','180');await save();
 await nav('#/payment/new');await p.fill('#fContact','elham');await p.selectOption('#lines [data-k=account]','ar:'+el);await p.fill('#lines [data-k=amount]','15000');await save();
 await nav('#/receipt/new');await p.fill('#fContact','elham');await p.selectOption('#lines [data-k=account]','ar:'+el);await p.fill('#lines [data-k=amount]','1606');await save();
 await nav('#/fxrate/new');await p.fill('#rb'+((await p.locator('#f tbody tr').allInnerTexts()).findIndex(r=>r.startsWith('AFN'))),'70.5');await p.fill('#rs'+((await p.locator('#f tbody tr').allInnerTexts()).findIndex(r=>r.startsWith('AFN'))),'71');
   for(const r of await p.locator('#f tbody tr').all()){const t=await r.innerText();if(!t.startsWith('AFN')){}}await save();
 await nav('#/exchange/new');await p.selectOption('#fGB',usd);await p.selectOption('#fRB',afn);await p.fill('#fGive','10');await p.waitForTimeout(100);await save();
 await nav('#/hawala/new');await p.selectOption('#fDir','in');await p.fill('#fRcv','Zahra');await p.fill('#fAmt','50');await save();
 await nav('#/cashcount/new');await p.selectOption('#fBank',usd);await p.fill('#fCnt','1000');await save();
 // ---- integrity checks ----
 const chk=async()=>{
   await nav('#/summary');const sum=await p.locator('#view').innerText();const ok=/Balance sheet is in balance/.test(sum);
   const AR=+((sum.match(/Accounts receivable\s+([-\d,.]+)/)||[])[1]||'0').replace(/,/g,'');
   await nav('#/customer');const custTot=+(await p.locator('#totRow td').last().innerText()).replace(/,/g,'');
   await nav('#/reports/aged-ar');const agedTot=+(await p.locator('tr.tot td').last().innerText()).replace(/,/g,'');
   await nav('#/reports/trial');const tb=await p.locator('tr.tot').innerText();
   console.log('CHECK balanced:',ok,'| AR on balance sheet',AR,'customers total',custTot,'aged total',agedTot,'| trial',tb.replace(/\s+/g,' '));
   if(!ok||Math.abs(AR-custTot)>0.01)errs.push('INTEGRITY mismatch AR '+AR+' vs '+custTot);};
 await chk();
 // ---- crawl ----
 const d=await db(),ids={};d.records.forEach(r=>{(ids[r.type]=ids[r.type]||[]).push(r.id)});
 const VIEW=['receipt','payment','quote','salesorder','salesinvoice','creditnote','purchaseorder','purchaseinvoice','debitnote','payslip','deliverynote','goodsreceipt','ticket','exchange','hawala'];
 const routes=['summary','reports','travel','sarafi','customize','settings','users','history','support','businesses','profile','admin'];
 ['trial','gl','pl-month','project','aged-ar','aged-ap','inventory','tax','cashflow','equity','bs-compare','pl-compare','sales-customer','rp-summary','statements','supplier-statements'].forEach(r=>routes.push('reports/'+r));
 (ids.customer||[]).forEach(id=>routes.push('reports/statement/'+id));(ids.supplier||[]).forEach(id=>routes.push('reports/sstatement/'+id));
 Object.keys(ids).forEach(t=>{routes.push(t,t+'/new');ids[t].slice(0,3).forEach(id=>{routes.push(t+'/edit/'+id);if(VIEW.includes(t))routes.push(t+'/view/'+id)})});
 ['bank:'+usd,'ar:'+el,'ap:'+air,'acc:xprofit','acc:tsales','acc:hpay'].forEach(k=>routes.push('ledger/view/'+encodeURIComponent(k)));
 (ids.bank||[]).forEach(id=>{routes.push('bank/reconcile/'+id,'bank/import/'+id)});
 for(const L of LANGS){await p.evaluate(l=>localStorage.setItem('falak_lang',l),L);await p.reload();await p.waitForTimeout(600);const left=new Map();
   for(const r of routes){await nav('#/'+r);if(L==='en')continue;
     const arr=await p.evaluate(()=>{const out=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(w.nextNode()){const n=w.currentNode,pe=n.parentElement;if(!pe||['SCRIPT','STYLE','TEXTAREA','OPTION'].includes(pe.tagName)||pe.closest('[hidden]')||pe.closest('#nav a span.n'))continue;const t=n.nodeValue.trim();if(/[A-Za-z]{3,}/.test(t)&&!/[؀-ۿ]/.test(t))out.push(t)}return out});
     arr.forEach(x=>{if(!left.has(x))left.set(x,r)})}
   if(L!=='en'){fs.writeFileSync('crawl-left-'+L+'.txt',[...left].map(([k,v])=>k+'   @'+v).join('\n'));console.log(L,'untranslated candidates:',left.size)}}
 console.log('routes visited:',routes.length,'x',LANGS.length);console.log('errors',errs.slice(0,20));await b.close()})();
