// Ledger fixture: known transactions → expected balances (demo mode, engine + report pages)
const { chromium } = require('playwright');
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:950}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(/fonts\.g/,r=>r.abort());
 await p.goto('file://'+process.cwd()+'/site/_demo_eng.html#/summary');await p.waitForTimeout(1200);
 await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('falak_io_demo_v2'));const biz=d.businesses[0];biz.settings=Object.assign({},biz.settings,{startDate:'2026-01-01',baseCurrency:'USD',lockDate:''});
  const R=[];let n=0;const id=()=>'00000000-0000-4000-8000-'+String(++n).padStart(12,'0');const add=(type,data)=>{const i=id();R.push({id:i,business_id:biz.id,type,data});return i};
  const inc=add('account',{name:'Service income',code:'4000',group:'income'}),rent=add('account',{name:'Rent',code:'6100',group:'expense'}),
   vat=add('taxcode',{name:'VAT 20%',rate:20}),eur=add('currency',{code:'EUR',name:'Euro',rate:1.20}),
   cash=add('bank',{name:'Cash',opening:1000,currency:''}),bank2=add('bank',{name:'Bank',opening:0,currency:''}),beur=add('bank',{name:'EUR account',opening:0,currency:'EUR'}),
   c1=add('customer',{name:'C1',opening:200,currency:'',terms:0}),c2=add('customer',{name:'C2 EUR',opening:0,currency:'EUR',terms:0}),ag=add('customer',{name:'Agent',kind:'agent',opening:0,currency:'',terms:7}),
   s1=add('supplier',{name:'Landlord',opening:0,currency:'',terms:30}),air=add('supplier',{name:'Airline',kind:'airline',opening:0,currency:'',terms:0});
  const i1=add('salesinvoice',{date:'2026-02-01',ref:'1',customer:c1,currency:'',rate:'',lines:[{desc:'Work',account:'acc:'+inc,qty:3,price:33.33,disc:'',tax:vat}]});
  add('receipt',{date:'2026-02-05',ref:'1',bank:cash,currency:'',rate:'',contact:'C1',lines:[{account:'ar:'+c1,invoice:i1,amount:50}]});
  const p1=add('purchaseinvoice',{date:'2026-02-03',ref:'1',supplier:s1,currency:'',rate:'',lines:[{desc:'Rent',account:'acc:'+rent,qty:1,price:300,disc:'',tax:''}]});
  add('payment',{date:'2026-02-06',ref:'1',bank:cash,currency:'',rate:'',contact:'Landlord',lines:[{account:'ap:'+s1,invoice:p1,amount:100}]});
  add('creditnote',{date:'2026-02-07',ref:'1',customer:c1,invoice:i1,currency:'',rate:'',lines:[{desc:'Discount',account:'acc:'+inc,qty:1,price:10,disc:'',tax:''}]});
  add('transfer',{date:'2026-02-08',ref:'1',from:cash,to:bank2,amount:200,amountTo:''});
  const i2=add('salesinvoice',{date:'2026-03-01',ref:'2',customer:c2,currency:'EUR',rate:1.10,lines:[{desc:'EUR work',account:'acc:'+inc,qty:1,price:100,disc:'',tax:''}]});
  add('receipt',{date:'2026-03-10',ref:'2',bank:beur,currency:'EUR',rate:1.20,contact:'C2',lines:[{account:'ar:'+c2,invoice:i2,amount:100}]});
  add('ticket',{date:'2026-03-15',ref:'1',service:'ticket',passenger:'P One',airline:air,customer:ag,sell:500,cost:420,currency:'',rate:'',refunded:false});
  d.records=d.records.filter(r=>r.business_id!==biz.id).concat(R);localStorage.setItem('falak_io_demo_v2',JSON.stringify(d));window.__ids={inc,rent,vat,cash,bank2,beur,c1,c2,ag,s1,air,i1,i2}});
 await p.reload();await p.waitForTimeout(1200);
 const r=await p.evaluate(()=>{const {sums,fxSums,L}=window.__eng;const s=sums(null,'2026-12-31'),fx=fxSums('2026-12-31'),g=k=>Math.round((s[k]||0)*100)/100;
   const ids={};L('bank').forEach(x=>ids[x.name]='bank:'+x.id);L('customer').forEach(x=>ids[x.name]='ar:'+x.id);L('supplier').forEach(x=>ids[x.name]='ap:'+x.id);L('account').forEach(x=>ids[x.name]='acc:'+x.id);L('taxcode').forEach(x=>ids.vat='tax:'+x.id);
   const tot=Math.round(Object.values(s).reduce((a,b)=>a+b,0)*100)/100;
   return {tot,cash:g(ids.Cash),bank:g(ids.Bank),eur:g(ids['EUR account']),eurfx:Math.round((fx[ids['EUR account']]||0)*100)/100,c1:g(ids.C1),c2:g(ids['C2 EUR']),c2fx:Math.round((fx[ids['C2 EUR']]||0)*100)/100,ag:g(ids.Agent),
     s1:g(ids.Landlord),air:g(ids.Airline),vat:g(ids.vat),inc:g(ids['Service income']),rent:g(ids.Rent),ts:g('acc:tsales'),tc:g('acc:tcost'),re:g('acc:re'),fxgl:g('acc:fxgl')}});
 console.log(JSON.stringify(r));
 const E={tot:0,cash:750,bank:200,eur:120,eurfx:100,c1:259.99,ag:500,s1:-200,air:-420,vat:-20,inc:-199.99,rent:300,ts:-500,tc:420,re:-1200};
 for(const [k,v] of Object.entries(E))ok(Math.abs(r[k]-v)<0.005,`${k}: expected ${v}, got ${r[k]}`);
 ok(Math.abs(r.c2)<0.005&&Math.abs(r.fxgl+10)<0.005,`EUR customer fully paid: expected AR 0.00 and a realised FX gain of 10.00 (invoice at 1.10, paid at 1.20); got AR ${r.c2} (EUR ${r.c2fx}) and FX gain ${-r.fxgl}`);
 await p.evaluate(()=>location.hash='#/summary');await p.waitForTimeout(900);ok(/✓/.test(await p.locator('#view').innerText()),'balance sheet page shows in balance');
 ok(!errs.length,'no page errors '+errs.join(' | '));await b.close()})();
