/* ================= Falak Hesab — accounting engine ================= */
const GROUPS={asset:'Assets',liability:'Liabilities',equity:'Equity',income:'Income',expense:'Expenses'};
const SYS=[{id:'re',name:'Retained earnings',code:'3900',group:'equity',sys:true},{id:'cogs',name:'Cost of goods sold',code:'5000',group:'expense',sys:true},{id:'depr',name:'Depreciation expense',code:'6950',group:'expense',sys:true},{id:'fxgl',name:'Foreign exchange gains/losses',code:'4950',group:'income',sys:true},{id:'tsales',name:'Ticket sales',code:'4200',group:'income',sys:true},{id:'tcost',name:'Ticket cost',code:'5200',group:'expense',sys:true},{id:'xprofit',name:'Exchange profit',code:'4300',group:'income',sys:true},{id:'hcomm',name:'Hawala commission',code:'4310',group:'income',sys:true},{id:'hpay',name:'Hawala to pay out',code:'2300',group:'liability',sys:true},{id:'cashdiff',name:'Cash over/short',code:'5900',group:'expense',sys:true}];
const accounts=()=>SYS.concat(L('account')).sort((a,b)=>(a.code||'').localeCompare(b.code||'')||a.name.localeCompare(b.name));
const byCode=(a,b)=>(a.code||'').localeCompare(b.code||'')||String(a.name||'').localeCompare(String(b.name||''));
const nm=x=>x?(x.name||'(no name)'):'';

const KEYINFO={
  acc:{t:null,label:'',group:null},
  bank:{t:'bank',label:'',group:'asset'},
  ar:{t:'customer',label:'Accounts receivable',group:'asset'},
  ap:{t:'supplier',label:'Accounts payable',group:'liability'},
  emp:{t:'employee',label:'Employee clearing',group:'liability'},
  inv:{t:'item',label:'Inventory on hand',group:'asset'},
  tax:{t:'taxcode',label:'Tax payable',group:'liability'},
  fa:{t:'fixedasset',label:'Fixed assets, at cost',group:'asset'},
  fad:{t:'fixedasset',label:'Accumulated depreciation',group:'asset'}
};
function keyName(key,short){
  if(!key)return'—';const i=key.indexOf(':'),t=key.slice(0,i),id=key.slice(i+1);
  if(t==='acc'){const a=SYS.find(x=>x.id===id)||R('account',id);return a?a.name:'(deleted account)'}
  const info=KEYINFO[t];if(!info)return key;
  const m=R(info.t,id),n=m?nm(m):'(deleted)';
  return (info.label&&!short)?`${info.label} – ${n}`:n;
}
function keyGroup(key){const t=key.split(':')[0];if(t==='acc'){const id=key.slice(4);const a=SYS.find(x=>x.id===id)||R('account',id);return a?a.group:'expense'}return (KEYINFO[t]||{}).group||'asset'}
const creditNormal=g=>g==='liability'||g==='equity'||g==='income';
const masterOf=key=>{const t=key.split(':')[0];return t==='acc'?(SYS.some(s=>'acc:'+s.id===key)?null:'account'):(KEYINFO[t]||{}).t}

/* ---- currencies ---- */
const BASE=()=>String(setting('currency')||'USD').toUpperCase();
function curRate(code){if(!code||code===BASE())return 1;const c=L('currency').find(x=>x.code===code);return c&&+c.rate?+c.rate:1}
const foreign=c=>(c&&c!==BASE())?c:'';
const recCur=m=>m?foreign(m.currency):'';
function masterCur(key){const t=key.split(':')[0];if(t!=='bank'&&t!=='ar'&&t!=='ap')return '';return recCur(R(KEYINFO[t].t,key.slice(t.length+1)))}
const docCur=d=>foreign(d.currency);
const docRate=d=>docCur(d)?(+d.rate||curRate(d.currency)):1;
const curLabel=c=>c||BASE();
/* ---- sarafi daily rates: board quotes "units of currency per 1 base", buy < sell. Mid rate gives the value of 1 unit in base. ---- */
function boardOn(cur,date){if(!foreign(cur))return null;let best=null;L('fxrate').forEach(r=>{if(r.date>(date||'9999'))return;const l=(r.lines||[]).find(x=>x.cur===cur&&+x.buy&&+x.sell);if(l&&(!best||r.date>best.date))best={date:r.date,buy:+l.buy,sell:+l.sell}});return best}
function rateOn(cur,date){if(!foreign(cur))return 1;const b=boardOn(cur,date);return b?2/(b.buy+b.sell):curRate(cur)}

/* ---- line maths ---- */
const qtyOf=l=>(l.qty===''||l.qty==null||isNaN(+l.qty))?1:+l.qty;
function lineCalc(l){const net=r2(qtyOf(l)*(+l.price||0)*(1-(+l.disc||0)/100));const tc=l.tax?R('taxcode',l.tax):null;const tax=tc?r2(net*(+tc.rate||0)/100):0;return {net,tax,total:r2(net+tax)}}
function docTotals(d){let net=0,tax=0;(d.lines||[]).forEach(l=>{const c=lineCalc(l);net+=c.net;tax+=c.tax});return {net:r2(net),tax:r2(tax),total:r2(net+tax)}}
const sumLines=(lines,k='amount')=>r2((lines||[]).reduce((s,l)=>s+(+l[k]||0),0));
/* ---- travel tickets: amounts in the ticket currency ---- */
function ticketCalc(t){const sell=r2(t.sell),cost=r2(t.cost),rc=t.refunded?r2(t.refundCustomer):0,ra=t.refunded?r2(t.refundAirline):0;
  return {sell,cost,rc,ra,netSell:r2(sell-rc),netCost:r2(cost-ra),profit:r2(sell-rc-(cost-ra))}}

/* ---- inventory: quantity, average cost, items still to deliver / receive ---- */
let _inv={v:-1};
function inventory(){
  if(_inv.v===S.ver)return _inv.d;
  const d={};L('item').forEach(it=>d[it.id]={buyQty:0,buyCost:0,qty:0,inv:0,del:0,pinv:0,rec:0});
  const each=(type,fn)=>L(type).forEach(doc=>(doc.lines||[]).forEach(l=>{const x=d[l.item];if(x)fn(x,qtyOf(l),l,doc)}));
  each('purchaseinvoice',(x,q,l,doc)=>{x.qty+=q;x.buyQty+=q;x.buyCost+=lineCalc(l).net*docRate(doc);x.pinv+=q});
  each('debitnote',(x,q,l,doc)=>{x.qty-=q;x.buyQty-=q;x.buyCost-=lineCalc(l).net*docRate(doc);x.pinv-=q});
  each('salesinvoice',(x,q)=>{x.qty-=q;x.inv+=q});
  each('creditnote',(x,q)=>{x.qty+=q;x.inv-=q});
  each('writeoff',(x,q)=>{x.qty-=q});
  each('deliverynote',(x,q)=>{x.del+=q});
  each('goodsreceipt',(x,q)=>{x.rec+=q});
  L('item').forEach(it=>{const x=d[it.id];x.avg=x.buyQty>0?x.buyCost/x.buyQty:(+it.cost||0);x.value=r2(x.qty*x.avg);x.toDeliver=x.inv-x.del;x.toReceive=x.pinv-x.rec});
  _inv={v:S.ver,d};return d;
}

/* ---- postings: every transaction turned into base-currency debit(+)/credit(-) lines ---- */
let _post={v:-1};
function postings(){
  if(_post.v===S.ver)return _post.d;
  const P=[],st=setting('startDate')||'2000-01-01';
  const add=(date,key,amt,type,id,desc,ref,contact,o={})=>{amt=r2(amt);if(!key||(!amt&&!o.fx))return;
    const p={date,key,amt,type,id,desc:desc||'',ref:ref||'',contact:contact||'',project:o.project||''};
    const mc=masterCur(key);if(mc)p.fx=(o.cur===mc&&o.fx!=null)?r2(o.fx):r2(amt/curRate(mc));
    P.push(p)};
  const cn=(t,id)=>nm(R(t,id));
  L('bank').forEach(k=>{const o=+k.opening||0,c=recCur(k),b=r2(o*curRate(c));add(st,'bank:'+k.id,b,'bank',k.id,'Opening balance','','',{fx:o,cur:c});add(st,'acc:re',-b,'bank',k.id,'Opening balance – '+k.name)});
  [['customer','ar:',1],['supplier','ap:',-1]].forEach(([t,pre,sg])=>L(t).forEach(p=>{const o=r2(p.opening);if(!o)return;const c=recCur(p),b=r2(o*curRate(c));
    add(st,pre+p.id,sg*b,t,p.id,'Starting balance','',p.name,{fx:sg*o,cur:c});add(st,'acc:re',-sg*b,t,p.id,'Starting balance – '+p.name)}));
  [['receipt',1],['payment',-1]].forEach(([type,s])=>L(type).forEach(r=>{const rate=docRate(r),cur=docCur(r);let tb=0,tf=0;
    (r.lines||[]).forEach(l=>{const a=r2(l.amount),b=r2(a*rate);tb+=b;tf+=a;add(r.date,l.account,-s*b,type,r.id,l.desc||r.desc,r.ref,r.contact,{fx:-s*a,cur,project:l.project})});
    add(r.date,'bank:'+r.bank,s*tb,type,r.id,r.desc,r.ref,r.contact,{fx:s*tf,cur})}));
  L('transfer').forEach(t=>{const fc=recCur(R('bank',t.from)),tc=recCur(R('bank',t.to));const amtTo=(t.amountTo===''||t.amountTo==null)?+t.amount:+t.amountTo;
    const base=!fc?r2(t.amount):(!tc?r2(amtTo):r2(t.amount*(+t.rate||curRate(fc))));
    add(t.date,'bank:'+t.to,base,'transfer',t.id,t.desc,t.ref,'',{fx:amtTo,cur:tc});add(t.date,'bank:'+t.from,-base,'transfer',t.id,t.desc,t.ref,'',{fx:-t.amount,cur:fc})});
  const inv=inventory();
  [['salesinvoice',1],['creditnote',-1]].forEach(([type,s])=>L(type).forEach(d=>{const c=cn('customer',d.customer),rate=docRate(d),cur=docCur(d);let tb=0,tf=0;
    (d.lines||[]).forEach(l=>{const x=lineCalc(l),nb=r2(x.net*rate),xb=r2(x.tax*rate);tb+=nb+xb;tf+=x.total;const it=R('item',l.item),pr=l.project||d.project;
      add(d.date,l.account,-s*nb,type,d.id,l.desc||d.desc,d.ref,c,{project:pr});
      if(x.tax)add(d.date,'tax:'+l.tax,-s*xb,type,d.id,l.desc||d.desc,d.ref,c);
      if(it&&it.track&&inv[it.id]){const v=r2(qtyOf(l)*inv[it.id].avg);add(d.date,'acc:cogs',s*v,type,d.id,it.name,d.ref,c,{project:pr});add(d.date,'inv:'+it.id,-s*v,type,d.id,l.desc,d.ref,c)}});
    add(d.date,'ar:'+d.customer,s*tb,type,d.id,d.desc,d.ref,c,{fx:s*tf,cur})}));
  [['purchaseinvoice',1],['debitnote',-1]].forEach(([type,s])=>L(type).forEach(d=>{const c=cn('supplier',d.supplier),rate=docRate(d),cur=docCur(d);let tb=0,tf=0;
    (d.lines||[]).forEach(l=>{const x=lineCalc(l),nb=r2(x.net*rate),xb=r2(x.tax*rate);tb+=nb+xb;tf+=x.total;const it=R('item',l.item);
      add(d.date,(it&&it.track)?'inv:'+it.id:l.account,s*nb,type,d.id,l.desc||d.desc,d.ref,c,{project:l.project||d.project});
      if(x.tax)add(d.date,'tax:'+l.tax,s*xb,type,d.id,l.desc||d.desc,d.ref,c)});
    add(d.date,'ap:'+d.supplier,-s*tb,type,d.id,d.desc,d.ref,c,{fx:-s*tf,cur})}));
  L('ticket').forEach(t=>{const x=ticketCalc(t),rate=docRate(t),cur=docCur(t),c=cn('customer',t.customer),d=[t.passenger,t.route].filter(Boolean).join(' · '),o={project:t.project};
    if(t.customer){const b=r2(x.sell*rate);add(t.date,'ar:'+t.customer,b,'ticket',t.id,d,t.ref,c,{fx:x.sell,cur});add(t.date,'acc:tsales',-b,'ticket',t.id,d,t.ref,c,o)}
    if(t.airline){const b=r2(x.cost*rate);add(t.date,'acc:tcost',b,'ticket',t.id,d,t.ref,c,o);add(t.date,'ap:'+t.airline,-b,'ticket',t.id,d,t.ref,cn('supplier',t.airline),{fx:-x.cost,cur})}
    if(t.refunded){const rd=t.refundDate||t.date,dr='Refund – '+d;
      if(t.customer&&x.rc){const b=r2(x.rc*rate);add(rd,'ar:'+t.customer,-b,'ticket',t.id,dr,t.ref,c,{fx:-x.rc,cur});add(rd,'acc:tsales',b,'ticket',t.id,dr,t.ref,c,o)}
      if(t.airline&&x.ra){const b=r2(x.ra*rate);add(rd,'ap:'+t.airline,b,'ticket',t.id,dr,t.ref,cn('supplier',t.airline),{fx:x.ra,cur});add(rd,'acc:tcost',-b,'ticket',t.id,dr,t.ref,c,o)}}});
  /* sarafi: currency exchange, hawala, cash counts */
  L('exchange').forEach(x=>{const gc=recCur(R('bank',x.giveBank)),rc=recCur(R('bank',x.recvBank)),gb=r2((+x.give||0)*rateOn(gc,x.date)),rb=r2((+x.recv||0)*rateOn(rc,x.date)),d=x.customer||'',ds='Exchange '+curLabel(gc)+' → '+curLabel(rc);
    add(x.date,'bank:'+x.giveBank,gb,'exchange',x.id,ds,x.ref,d,{fx:r2(x.give),cur:gc});add(x.date,'bank:'+x.recvBank,-rb,'exchange',x.id,ds,x.ref,d,{fx:-r2(x.recv),cur:rc});add(x.date,'acc:xprofit',-(gb-rb),'exchange',x.id,ds,x.ref,d)});
  L('hawala').forEach(h=>{const p=R('supplier',h.partner),cur=recCur(p),k=rateOn(cur,h.date),amt=r2(h.amount),com=r2(h.commission),pn=nm(p),code=h.code?'#'+h.code:'';
    if(h.dir==='in'){add(h.date,'ap:'+h.partner,r2((amt+com)*k),'hawala',h.id,'Hawala in '+code+' – '+(h.receiver||''),h.ref,pn,{fx:amt+com,cur});add(h.date,'acc:hpay',-r2(amt*k),'hawala',h.id,'To pay '+(h.receiver||''),h.ref,pn);if(com)add(h.date,'acc:hcomm',-r2(com*k),'hawala',h.id,'Hawala commission '+code,h.ref,pn);
      if(h.status==='paid'&&h.bank){const pd=h.paidDate||h.date,k2=rateOn(cur,pd);add(pd,'acc:hpay',r2(amt*k),'hawala',h.id,'Paid to '+(h.receiver||''),h.ref,pn);add(pd,'bank:'+h.bank,-r2(amt*k),'hawala',h.id,'Hawala paid '+code+' – '+(h.receiver||''),h.ref,h.receiver||pn,{fx:-amt,cur:recCur(R('bank',h.bank))})}}
    else{const bc=recCur(R('bank',h.bank));add(h.date,'bank:'+h.bank,r2((amt+com)*k),'hawala',h.id,'Hawala out '+code+' – '+(h.sender||''),h.ref,h.sender||pn,{fx:amt+com,cur:bc});add(h.date,'ap:'+h.partner,-r2(amt*k),'hawala',h.id,'Hawala out '+code+' – to '+(h.receiver||''),h.ref,pn,{fx:-amt,cur});if(com)add(h.date,'acc:hcomm',-r2(com*k),'hawala',h.id,'Hawala commission '+code,h.ref,h.sender||pn)}});
  L('cashcount').forEach(c=>{const d=r2(c.diff);if(!d)return;const cur=recCur(R('bank',c.bank)),b=r2(d*rateOn(cur,c.date));add(c.date,'bank:'+c.bank,b,'cashcount',c.id,'Cash count difference',c.ref,'',{fx:d,cur});add(c.date,'acc:cashdiff',-b,'cashcount',c.id,'Cash count – '+nm(R('bank',c.bank)),c.ref)});
  L('writeoff').forEach(w=>(w.lines||[]).forEach(l=>{const it=R('item',l.item);if(!it||!it.track||!inv[it.id])return;const v=r2(qtyOf(l)*inv[it.id].avg);
    add(w.date,w.account||'acc:cogs',v,'writeoff',w.id,it.name,w.ref,'',{project:w.project});add(w.date,'inv:'+it.id,-v,'writeoff',w.id,w.desc,w.ref)}));
  L('payslip').forEach(p=>{const c=cn('employee',p.employee);let net=0;
    (p.earnings||[]).forEach(l=>{net+=r2(l.amount);add(p.date,l.account,l.amount,'payslip',p.id,l.desc,p.ref,c,{project:p.project})});
    (p.deductions||[]).forEach(l=>{net-=r2(l.amount);add(p.date,l.account,-l.amount,'payslip',p.id,l.desc,p.ref,c)});
    add(p.date,'emp:'+p.employee,-net,'payslip',p.id,'Net pay',p.ref,c)});
  L('expenseclaim').forEach(e=>{const c=cn('employee',e.payer);let t=0;
    (e.lines||[]).forEach(l=>{t+=r2(l.amount);add(e.date,l.account,l.amount,'expenseclaim',e.id,l.desc||e.desc,e.ref,c,{project:l.project})});
    add(e.date,'emp:'+e.payer,-t,'expenseclaim',e.id,e.desc,e.ref,c)});
  L('depreciation').forEach(e=>(e.lines||[]).forEach(l=>{add(e.date,'acc:depr',l.amount,'depreciation',e.id,cn('fixedasset',l.asset),e.ref);add(e.date,'fad:'+l.asset,-l.amount,'depreciation',e.id,e.desc,e.ref)}));
  L('journal').forEach(j=>(j.lines||[]).forEach(l=>add(j.date,l.account,r2(l.debit)-r2(l.credit),'journal',j.id,l.desc||j.narration,j.ref,'',{project:l.project})));
  _post={v:S.ver,d:P};return P;
}
function sums(from,to){const m={};postings().forEach(p=>{if((from&&p.date<from)||(to&&p.date>to))return;m[p.key]=(m[p.key]||0)+p.amt});return m}
function fxSums(to){const m={};postings().forEach(p=>{if(p.fx==null||(to&&p.date>to))return;m[p.key]=(m[p.key]||0)+p.fx});return m}
const usedKey=key=>postings().some(p=>p.key===key);

/* ---- bank clearing (reconciliation) ---- */
function clearedOn(p){
  if(p.type==='bank'||p.type==='journal')return p.date;
  if(p.type==='transfer'){const t=R('transfer',p.id);return t?(p.amt>=0||(p.fx||0)>0?t.clearedTo:t.clearedFrom)||'':''}
  const r=R(p.type,p.id);return r&&r.cleared||'';
}
function bankBalances(bankId,upTo){
  const key='bank:'+bankId,fx=!!masterCur(key);let actual=0,cleared=0;
  postings().forEach(p=>{if(p.key!==key||(upTo&&p.date>upTo))return;const v=fx?p.fx:p.amt;actual+=v;const c=clearedOn(p);if(c&&(!upTo||c<=upTo))cleared+=v});
  return {actual:r2(actual),cleared:r2(cleared),pending:r2(actual-cleared)};
}

/* ---- invoice balances with allocation (explicit first, then oldest first) — in the invoice currency ---- */
// a ticket sold to a sub-agent / bought from an airline is due after that partner's payment terms; walk-in customers pay on the issue date
function ticketDue(t,side){const p=side==='sales'?R('customer',t.customer):R('supplier',t.airline),n=+(p&&p.terms)||0;return p&&n>0&&(side==='sales'?p.kind==='agent':p.kind==='airline')?addDays(t.date,n):t.date}
function invoiceStatus(side){
  const invT=side==='sales'?'salesinvoice':'purchaseinvoice',noteT=side==='sales'?'creditnote':'debitnote',party=side==='sales'?'customer':'supplier',pre=side==='sales'?'ar:':'ap:',payT=side==='sales'?'receipt':'payment',backT=side==='sales'?'payment':'receipt';
  const res={},byParty={},credit={};
  const pc=pid=>recCur(R(party,pid));
  const conv=(amt,fromCur,fromRate,toCur)=>fromCur===toCur?r2(amt):r2(amt*fromRate/curRate(toCur));
  L(invT).forEach(i=>{res[i.id]={id:i.id,party:i[party],cur:docCur(i),rate:docRate(i),total:docTotals(i).total,paid:0,due:0,dueDate:i.dueDate||i.date,date:i.date};(byParty[i[party]]=byParty[i[party]]||[]).push(i)});
  const sb=setting('startDate')||'2000-01-01';
  L(party).forEach(p=>{const o=r2(p.opening);if(!o)return;const c=recCur(p);
    if(o>0){const id='ob:'+p.id;res[id]={id,party:p.id,cur:c,rate:curRate(c),total:o,paid:0,due:0,dueDate:sb,date:sb,opening:true};(byParty[p.id]=byParty[p.id]||[]).push({id,date:sb,dueDate:sb})}
    else credit[p.id]=(credit[p.id]||0)-o});
  const tf=side==='sales'?'customer':'airline';
  L('ticket').forEach(t=>{if(!t[tf])return;const x=ticketCalc(t),dd=ticketDue(t,side);res[t.id]={id:t.id,party:t[tf],cur:docCur(t),rate:docRate(t),total:side==='sales'?x.netSell:x.netCost,paid:0,due:0,dueDate:dd,date:t.date,ticket:true};(byParty[t[tf]]=byParty[t[tf]]||[]).push({id:t.id,date:t.date,dueDate:dd})});
  const apply=(pid,inv,a,fromCur,fromRate)=>{if(inv&&res[inv]){const x=res[inv];x.paid+=fromCur===x.cur?r2(a):r2(a*fromRate/x.rate)}else credit[pid]=(credit[pid]||0)+conv(a,fromCur,fromRate,pc(pid))};
  L(payT).forEach(p=>(p.lines||[]).forEach(l=>{if(l.account&&l.account.startsWith(pre))apply(l.account.slice(3),l.invoice,r2(l.amount),docCur(p),docRate(p))}));
  L(backT).forEach(p=>(p.lines||[]).forEach(l=>{if(l.account&&l.account.startsWith(pre))apply(l.account.slice(3),p.refundFor&&res[p.refundFor]?p.refundFor:null,-r2(l.amount),docCur(p),docRate(p))}));  // a refund paid back counts against its ticket
  L(noteT).forEach(n=>apply(n[party],n.invoice,docTotals(n).total,docCur(n),docRate(n)));
  L('journal').forEach(j=>(j.lines||[]).forEach(l=>{if(l.account&&l.account.startsWith(pre)){const a=side==='sales'?r2(l.credit)-r2(l.debit):r2(l.debit)-r2(l.credit);apply(l.account.slice(3),null,a,'',1)}}));
  Object.entries(byParty).forEach(([pid,list])=>{let c=credit[pid]||0;list.sort((a,b)=>(a.dueDate||a.date).localeCompare(b.dueDate||b.date)).forEach(i=>{const x=res[i.id];const rem=x.total-x.paid;if(c>0&&rem>0){const a=Math.min(c,rem);x.paid+=a;c-=a}});credit[pid]=c});
  const t=today();
  Object.values(res).forEach(x=>{x.paid=r2(x.paid);x.due=r2(x.total-x.paid);
    if(x.total<0||x.due<=0.004){x.status='Paid';x.cls='paid'}
    else if(x.dueDate&&x.dueDate<t){x.days=daysBetween(x.dueDate,t);x.status=`Overdue ${x.days}d`;x.cls='overdue'}
    else{x.status='Due';x.cls='due'}});
  return res;
}
// money still to give back to the customer / get back from the airline after a refund
function ticketRefund(t){const k=ticketCalc(t),cur=docCur(t),rt=docRate(t);
  const conv=p=>docCur(p)===cur?sumLines(p.lines):r2(sumLines(p.lines)*docRate(p)/rt);
  let c=ticketRefund._c;if(!c||c.v!==S.ver)c=ticketRefund._c={v:S.ver,s:invoiceStatus('sales'),p:invoiceStatus('purchase')};
  const sS=c.s[t.id],sP=c.p[t.id];
  const back=r2(L('payment').filter(p=>p.refundFor===t.id).reduce((a,p)=>a+conv(p),0));
  const got=r2(L('receipt').filter(p=>p.refundFor===t.id).reduce((a,p)=>a+conv(p),0));
  const cPaid=r2((sS?sS.paid:0)+back),aPaid=r2((sP?sP.paid:0)+got);   // what was paid before any refund went back
  return {cur,toCustomer:k.rc,fromAirline:k.ra,custPaid:cPaid,paidBack:back,received:got,
    custOwed:t.refunded&&t.customer?r2(Math.max(0,Math.min(k.rc,cPaid-k.netSell)-back)):0,
    airlineOwes:t.refunded&&t.airline?r2(Math.max(0,Math.min(k.ra,aPaid-k.netCost)-got)):0}}
const statusTag=s=>s?`<span class="tag ${s.cls}">${esc(s.status)}</span>`:'';

function nextRef(type){let n=0;L(type).forEach(x=>{const v=parseInt(String(x.ref||'').replace(/\D+/g,''),10);if(!isNaN(v)&&v>n)n=v});return String(n+1)}

/* ---- recurring invoices ---- */
function advanceDate(d,freq,every){const x=new Date(d+'T00:00:00Z'),n=Math.max(1,+every||1);
  if(freq==='week')x.setUTCDate(x.getUTCDate()+7*n);else if(freq==='year')x.setUTCFullYear(x.getUTCFullYear()+n);else{const day=+d.slice(8,10);x.setUTCDate(1);x.setUTCMonth(x.getUTCMonth()+(freq==='quarter'?3*n:n));const last=new Date(Date.UTC(x.getUTCFullYear(),x.getUTCMonth()+1,0)).getUTCDate();x.setUTCDate(Math.min(day,last))}
  return x.toISOString().slice(0,10)}
function dueRecurring(){const t=today();return L('recurringinvoice').filter(r=>r.active!==false&&r.nextDate&&r.nextDate<=t&&(!r.endDate||r.nextDate<=r.endDate))}

/* ---- lock date ---- */
const locked=d=>{const l=setting('lockDate');return !!(l&&d&&d<=l)};
