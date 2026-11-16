const { chromium } = require('playwright');const fs=require('fs');
const LANG=process.argv[2]||'fa';
(async()=>{
 const b=await chromium.launch();const left=new Map();const errs=[];
 const p=await b.newPage({viewport:{width:1300,height:900}});await p.addInitScript(()=>{window.FALAK_EXCHANGE=true});await p.route(/fonts\.g/,r=>r.abort());
 p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(l=>{try{localStorage.setItem('falak_lang',l)}catch(e){}},LANG);
 await p.goto('file://'+process.cwd()+'/site/_demo.html');await p.waitForTimeout(700);await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('falak_io_demo_v2'));d.businesses[0].settings.shownTabs=['sarafi','exchange','hawala','fxrate','cashcount'];localStorage.setItem('falak_io_demo_v2',JSON.stringify(d))});await p.reload();await p.waitForTimeout(700);
 const grab=async(h)=>{const arr=await p.evaluate(()=>{const out=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(w.nextNode()){const n=w.currentNode,pe=n.parentElement;if(!pe||['SCRIPT','STYLE','TEXTAREA','PRE'].includes(pe.tagName)||pe.closest('.notr')||pe.closest('[hidden]'))continue;const t=n.nodeValue.trim();if(/[a-z]{3,}/.test(t))out.push(t)}return out});arr.forEach(x=>{if(!left.has(x))left.set(x,h)})};
 const nav=async h=>{await p.evaluate(h=>location.hash=h,h);await p.waitForTimeout(150);await grab(h)};
 const types=['exchange','hawala','fxrate','cashcount','ticket','bank','receipt','payment','transfer','customer','supplier','quote','salesorder','salesinvoice','recurringinvoice','creditnote','deliverynote','purchaseorder','purchaseinvoice','debitnote','goodsreceipt','item','writeoff','employee','payslip','expenseclaim','fixedasset','depreciation','journal','project','account','taxcode','currency'];
 const ids=await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('falak_io_demo_v2'));const m={};d.records.forEach(r=>{m[r.type]=m[r.type]||r.id});return m});
 for(const t of types){await nav('#/'+t);await nav('#/'+t+'/new');if(ids[t]){await nav(`#/${t}/edit/${ids[t]}`);await nav(`#/${t}/view/${ids[t]}`)}}
 for(const r of ['summary','reports','reports/trial','reports/gl','reports/pl-month','reports/project','reports/aged-ar','reports/aged-ap','reports/inventory','reports/tax','reports/cashflow','reports/equity','reports/bs-compare','reports/pl-compare','reports/sales-customer','reports/rp-summary','reports/statements','reports/statement/'+ids.customer,'settings','users','admin','profile','businesses','support','travel','sarafi','customize','history','bank/reconcile/'+ids.bank,'bank/import/'+ids.bank])await nav('#/'+r);
 await nav('#/summary');await p.screenshot({path:'l-'+LANG+'-summary.png'});
 await nav('#/salesinvoice/new');await p.screenshot({path:'l-'+LANG+'-form.png'});
 await nav('#/salesinvoice/view/'+ids.salesinvoice);await p.screenshot({path:'l-'+LANG+'-view.png'});
 fs.writeFileSync('left-'+LANG+'.txt',[...left].map(([k,v])=>k+'   @'+v).join('\n'));console.log(left.size,'errors',errs.slice(0,3));await b.close()})();
