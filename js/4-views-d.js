/* ================= Falak Hesab — Sarafi: currency exchange, hawala, daily rates, cash counts ================= */
const bankCur=id=>recCur(R('bank',id));
const bankOpts=(sel,blank)=>(blank?`<option value="">${esc(blank)}</option>`:'')+[...L('bank')].sort(byCode).map(k=>`<option value="${k.id}" ${sel===k.id?'selected':''}>${esc(k.name)} · ${esc(curLabel(recCur(k)))}</option>`).join('');
const sarafPartners=()=>[...L('supplier')].sort((a,b)=>(b.kind==='saraf')-(a.kind==='saraf')||a.name.localeCompare(b.name));
/* balance of a bank/cash account in its own currency, up to a date, optionally ignoring one record */
function bankBalOn(bankId,date,skipId){const key='bank:'+bankId,f=!!bankCur(bankId);return r2(postings().filter(p=>p.key===key&&(!date||p.date<=date)&&p.id!==skipId).reduce((s,p)=>s+(f?p.fx:p.amt),0))}
/* suggested rate for "customer gives 1 X → receives r Y", using the daily rates board (via the base currency) */
function suggestRate(gc,rc,date){
  const toBase=c=>{if(!foreign(c))return 1;const b=boardOn(c,date);return b?1/b.sell:curRate(c)};   // we sell base for the customer's currency
  const fromBase=c=>{if(!foreign(c))return 1;const b=boardOn(c,date);return b?b.buy:1/curRate(c)};  // we buy base, paying the customer's currency
  return toBase(gc)*fromBase(rc);
}
const fmtR=n=>{n=+n||0;return n>=100?n.toFixed(2):n>=1?n.toFixed(4):n.toFixed(6)};
const newCode=()=>String(Math.floor(100000+Math.random()*900000));

/* ---------- Currency exchange ---------- */
function vExchange(V,r,a,id){
  if(a==='view'){const x=R('exchange',id);if(!x)return go('#/exchange');return docView(V,'exchange',x)}
  if(a==='new'||a==='edit'){
    if(L('bank').length<2){V.innerHTML=`<div class="note"><span>Add a cash or bank account for each currency first (for example Cash USD and Cash AFN).</span> <a href="#/bank/new">Add bank or cash account</a></div>`;return}
    const ks=[...L('bank')].sort(byCode);
    const x=a==='edit'?R('exchange',id):{date:today(),ref:nextRef('exchange'),customer:'',phone:'',idNo:'',give:'',giveBank:ks[0].id,recvBank:(ks.find(k=>recCur(k)!==recCur(ks[0]))||ks[1]).id,rate:'',recv:'',notes:''};if(!x)return go('#/exchange');
    formPage(V,{title:a==='new'?'New currency exchange':'Edit currency exchange',type:'exchange',isNew:a==='new',rec:x,after:row=>`#/exchange/view/${row.id}`,
      extraBtns:a==='edit'?`<a class="btn" href="#/exchange/view/${x.id}">View / Print</a>`:'',
      body:`<div class="grid">${fld('Date',inp('fDate',x.date,'type="date" required'))}${fld('Reference',inp('fRef',x.ref))}${fld('Customer name',inp('fCust',x.customer))}${fld('Phone / WhatsApp',inp('fPhone',x.phone,'dir="ltr"'))}${fld('ID / passport number',inp('fIdNo',x.idNo,'dir="ltr"'))}</div>
        <div class="xbox"><div class="card pad"><h2>Customer gives</h2><div class="grid">${fld('Amount',inp('fGive',x.give,'type="number" step="any" class="num" required'))}${fld('Received in',`<select id="fGB">${bankOpts(x.giveBank)}</select>`)}</div></div>
        <div class="card pad"><h2>Customer receives</h2><div class="grid">${fld('Paid from',`<select id="fRB">${bankOpts(x.recvBank)}</select>`)}${fld('<span><span>Rate</span>: 1 <span id="rcG"></span> = ? <span id="rcR"></span></span>',inp('fRate',x.rate,'type="number" step="any" class="num"'))}${fld('Amount',inp('fRecv',x.recv,'type="number" step="any" class="num" required'))}</div>
          <p class="muted small" id="xHint" style="margin:8px 0 0"></p></div></div>
        <div class="totals"><span>Profit</span><b id="xProfit">0.00</b></div>
        <div class="grid" style="margin-top:14px">${fld('Notes',`<textarea id="fNotes">${esc(x.notes||'')}</textarea>`,'span2')}</div>`,
      onRender:()=>{
        const upd=src=>{const gc=bankCur(val('fGB')),rc=bankCur(val('fRB')),g=+val('fGive')||0;$('#rcG').textContent=curLabel(gc);$('#rcR').textContent=curLabel(rc);
          if(src==='auto'){const s=suggestRate(gc,rc,val('fDate'));$('#fRate').value=gc===rc?'':fmtR(s);$('#fRecv').value=g&&s&&gc!==rc?r2(g*s):''}
          if(src==='rate'){const rt=+val('fRate')||0;$('#fRecv').value=g&&rt?r2(g*rt):''}
          if(src==='recv'){const rv=+val('fRecv')||0;$('#fRate').value=g&&rv?fmtR(rv/g):''}
          const rv=+val('fRecv')||0,d=val('fDate'),pr=g*rateOn(gc,d)-rv*rateOn(rc,d);$('#xProfit').textContent=fmt(pr)+' '+BASE();$('#xProfit').classList.toggle('neg',pr<0);
          const bal=bankBalOn(val('fRB'),d,x.id),bg=boardOn(gc,d)||boardOn(rc,d);
          $('#xHint').innerHTML=(gc===rc?`<span class="neg">${esc(lookupOr('Choose two accounts with different currencies.'))}</span> `:'')+`${esc(lookupOr('Available in paid-from account'))}: <b class="${bal<rv?'neg':''}">${fmt(bal)} ${esc(curLabel(rc))}</b>`+(bg?'':` · <a href="#/fxrate/new">${esc(lookupOr('Add today\'s rates'))}</a>`)};
        $('#fGive').oninput=()=>upd(a==='edit'&&+x.rate?'rate':'auto');$('#fGB').onchange=$('#fRB').onchange=$('#fDate').onchange=()=>upd('auto');
        $('#fRate').oninput=()=>upd('rate');$('#fRecv').oninput=()=>upd('recv');upd(a==='edit'?'show':'auto')},
      read:()=>{const gc=bankCur(val('fGB')),rc=bankCur(val('fRB'));need(val('fDate'),'Enter a date');need(+val('fGive')>0,'Enter the amount the customer gives');need(+val('fRecv')>0,'Enter the amount the customer receives');
        need(val('fGB')!==val('fRB')&&gc!==rc,'Choose two accounts with different currencies.');
        return {date:val('fDate'),ref:val('fRef'),customer:val('fCust'),phone:val('fPhone'),idNo:val('fIdNo'),give:r2(val('fGive')),giveBank:val('fGB'),recvBank:val('fRB'),rate:+val('fRate')||'',recv:r2(val('fRecv')),notes:$('#fNotes').value}}});
    return;
  }
  const prof=x=>x.give*rateOn(bankCur(x.giveBank),x.date)-x.recv*rateOn(bankCur(x.recvBank),x.date);
  listPage(V,{title:'Currency Exchange',type:'exchange',newLabel:'New exchange',rows:[...L('exchange')].sort((p,q)=>q.date.localeCompare(p.date)||(parseInt(q.ref)||0)-(parseInt(p.ref)||0)),onRow:id=>go('#/exchange/view/'+id),
    tools:'<a class="btn" href="#/sarafi">Exchange & Transfers</a>',
    cols:[{h:'Date',f:x=>fmtD(x.date),cls:'mono'},{h:'Reference',f:x=>esc(x.ref),cls:'mono'},{h:'Customer',f:x=>esc(x.customer||'')},
      {h:'Customer gives',num:true,f:x=>money(x.give,curLabel(bankCur(x.giveBank)))},{h:'Customer receives',num:true,f:x=>money(x.recv,curLabel(bankCur(x.recvBank)))},
      {h:'Rate',num:true,f:x=>fmtR(x.recv/x.give)},{h:'Profit',num:true,f:x=>fmt(prof(x)),sum:x=>prof(x)}]});
}

/* ---------- Hawala transfers ---------- */
function vHawala(V,r,a,id){
  if(a==='view'){const x=R('hawala',id);if(!x)return go('#/hawala');return docView(V,'hawala',x)}
  if(a==='new'||a==='edit'){
    if(!L('supplier').some(s=>s.kind==='saraf')&&a==='new'){V.innerHTML=`<div class="note"><span>Add your partner saraf first: Suppliers → New supplier → Type: Partner saraf (hawala). Use one partner record for each currency.</span> <a href="#" id="addP">+ Add partner saraf</a></div>`;
      $('#addP').onclick=e=>{e.preventDefault();App.prefill={type:'supplier',kind:'saraf'};go('#/supplier/new')};return}
    const ps=sarafPartners();
    const x=a==='edit'?R('hawala',id):{dir:'out',date:today(),ref:nextRef('hawala'),code:newCode(),partner:(ps[0]||{}).id||'',sender:'',senderPhone:'',senderId:'',receiver:'',receiverPhone:'',fromCity:'',toCity:'',amount:'',commission:'',bank:'',status:'pending',paidDate:'',notes:''};if(!x)return go('#/hawala');
    if(a==='new'&&App.prefill&&App.prefill.type==='hawala'){Object.assign(x,App.prefill.data);App.prefill=null}
    formPage(V,{title:a==='new'?'New hawala transfer':'Edit hawala transfer',type:'hawala',isNew:a==='new',rec:x,after:row=>`#/hawala/view/${row.id}`,
      extraBtns:a==='edit'?`<a class="btn" href="#/hawala/view/${x.id}">View / Print</a>`:'',
      body:`<div class="grid">${fld('Direction',`<select id="fDir"><option value="out" ${x.dir!=='in'?'selected':''}>Send money (customer pays us, partner pays out)</option><option value="in" ${x.dir==='in'?'selected':''}>Receive money (partner sends, we pay out)</option></select>`,'span2')}
        ${fld('Date',inp('fDate',x.date,'type="date" required'))}${fld('Reference',inp('fRef',x.ref))}${fld('Transfer code',inp('fCode',x.code,'dir="ltr" class="mono"'))}
        ${fld('Partner saraf',`<select id="fPart">${partyOpts(ps,x.partner,'saraf','Partner saraf')}</select>`)}</div>
        <div class="xbox"><div class="card pad"><h2>Sender</h2><div class="grid">${fld('Name',inp('fSnd',x.sender))}${fld('Phone / WhatsApp',inp('fSndP',x.senderPhone,'dir="ltr"'))}${fld('ID / passport number',inp('fSndId',x.senderId,'dir="ltr"'))}${fld('From city',inp('fFrom',x.fromCity))}</div></div>
        <div class="card pad"><h2>Receiver</h2><div class="grid">${fld('Name',inp('fRcv',x.receiver,'required'))}${fld('Phone / WhatsApp',inp('fRcvP',x.receiverPhone,'dir="ltr"'))}${fld('To city',inp('fTo',x.toCity))}</div></div></div>
        <div class="grid" style="margin-top:14px">${fld('<span><span>Amount</span> · <span id="hCur"></span></span>',inp('fAmt',x.amount,'type="number" step="any" class="num" required'))}${fld('Our commission',inp('fCom',x.commission,'type="number" step="any" class="num" placeholder="0.00"'))}
          ${fld('<span id="hBankL"></span>',`<select id="fBank">${bankOpts(x.bank,'Select…')}</select>`)}
          ${fld('Status',`<select id="fSt"><option value="pending" ${x.status!=='paid'?'selected':''}>Pending</option><option value="paid" ${x.status==='paid'?'selected':''}>Paid</option></select>`)}${fld('Paid on',inp('fPaid',x.paidDate,'type="date"'))}</div>
        <p class="muted small" id="hHint" style="margin:8px 0 0"></p>
        <div class="grid" style="margin-top:14px">${fld('Notes',`<textarea id="fNotes">${esc(x.notes||'')}</textarea>`,'span2')}</div>`,
      onRender:()=>{const upd=()=>{const inb=val('fDir')==='in',c=curLabel(recCur(R('supplier',val('fPart'))));$('#hCur').textContent=c;
          $('#hBankL').textContent=lookupOr(inb?'Paid out from':'Money received in');const tot=(+val('fAmt')||0)+(inb?0:(+val('fCom')||0));
          $('#hHint').textContent=inb?lookupOr('The partner owes us the amount plus our commission. When you pay the receiver, set Status to Paid and choose the cash account.'):`${lookupOr('Customer pays')}: ${fmt(tot)} ${c}. ${lookupOr('We now owe the partner the amount; the commission is our income.')}`};
        ['fDir','fPart','fAmt','fCom'].forEach(k=>{$('#'+k).oninput=$('#'+k).onchange=upd});$('#fSt').onchange=()=>{if(val('fSt')==='paid'&&!val('fPaid'))$('#fPaid').value=today()};upd()},
      read:()=>{const inb=val('fDir')==='in',pc=recCur(R('supplier',val('fPart')));need(val('fDate'),'Enter a date');need(val('fPart'),'Choose the partner saraf');need(val('fRcv'),'Enter the receiver name');need(+val('fAmt')>0,'Enter the amount');
        const needBank=!inb||val('fSt')==='paid';if(needBank){need(val('fBank'),'Choose the cash or bank account');need(bankCur(val('fBank'))===pc,'The cash account must be in the same currency as the partner ('+curLabel(pc)+').')}
        if(inb&&val('fSt')==='paid')need(val('fPaid')>=val('fDate'),'The paid date cannot be before the transfer date');
        return {dir:inb?'in':'out',date:val('fDate'),ref:val('fRef'),code:val('fCode'),partner:val('fPart'),sender:val('fSnd'),senderPhone:val('fSndP'),senderId:val('fSndId'),fromCity:val('fFrom'),receiver:val('fRcv'),receiverPhone:val('fRcvP'),toCity:val('fTo'),
          amount:r2(val('fAmt')),commission:val('fCom')===''?'':r2(val('fCom')),bank:val('fBank'),status:val('fSt'),paidDate:val('fSt')==='paid'?(val('fPaid')||val('fDate')):'',notes:$('#fNotes').value}}});
    return;
  }
  const cur=h=>curLabel(recCur(R('supplier',h.partner)));
  listPage(V,{title:'Hawala Transfers',type:'hawala',newLabel:'New hawala',rows:[...L('hawala')].sort((p,q)=>q.date.localeCompare(p.date)||(parseInt(q.ref)||0)-(parseInt(p.ref)||0)),onRow:id=>go('#/hawala/view/'+id),
    tools:'<a class="btn" href="#/sarafi">Exchange & Transfers</a>',
    cols:[{h:'Date',f:h=>fmtD(h.date),cls:'mono'},{h:'Code',f:h=>esc(h.code||''),cls:'mono'},{h:'Direction',f:h=>h.dir==='in'?'<span class="tag due">Receive</span>':'<span class="tag cash">Send</span>'},
      {h:'Sender → Receiver',f:h=>esc((h.sender||'—')+' → '+(h.receiver||''))},{h:'Partner saraf',f:h=>esc(nm(R('supplier',h.partner)))},
      {h:'Amount',num:true,f:h=>money(h.amount,cur(h))},{h:'Commission',num:true,f:h=>h.commission?fmt(h.commission):''},{h:'Status',f:h=>h.status==='paid'?'<span class="tag paid">Paid</span>':'<span class="tag warn">Pending</span>'}]});
}

/* ---------- Daily rates board ---------- */
function vFxrate(V,r,a,id){
  const curs=L('currency').map(c=>c.code).filter(c=>foreign(c));
  if(a==='new'||a==='edit'){
    if(!curs.length){V.innerHTML=`<div class="note"><span>Add your currencies first (Accounting → Currencies), for example AFN, TRY, EUR.</span> <a href="#/currency/new">Add currency</a></div>`;return}
    const last=[...L('fxrate')].sort((p,q)=>q.date.localeCompare(p.date))[0];
    const x=a==='edit'?R('fxrate',id):{date:today(),lines:curs.map(c=>{const l=last&&(last.lines||[]).find(y=>y.cur===c);return {cur:c,buy:l?l.buy:'',sell:l?l.sell:''}})};if(!x)return go('#/fxrate');
    curs.forEach(c=>{if(!(x.lines||[]).some(l=>l.cur===c))x.lines.push({cur:c,buy:'',sell:''})});
    formPage(V,{title:a==='new'?'New daily rates':'Edit daily rates',type:'fxrate',isNew:a==='new',rec:x,
      body:`<div class="grid">${fld('Date',inp('fDate',x.date,'type="date" required'))}</div><p class="muted small"><span>Rates are for 1 unit of the base currency</span> (${esc(BASE())}). <span>Buy: the rate when we buy it from a customer. Sell: the rate when we sell it to a customer.</span></p>
        <div class="scroll"><table><thead><tr><th>Currency</th><th class="num">Buy</th><th class="num">Sell</th><th class="num">Spread</th></tr></thead><tbody>${x.lines.map((l,i)=>`<tr><td><b>${esc(l.cur)}</b> <span class="muted small">${esc((L('currency').find(c=>c.code===l.cur)||{}).name||'')}</span></td>
          <td><input class="num" type="number" step="any" id="rb${i}" value="${esc(l.buy)}"></td><td><input class="num" type="number" step="any" id="rs${i}" value="${esc(l.sell)}"></td><td class="num muted" id="rp${i}"></td></tr>`).join('')}</tbody></table></div>`,
      onRender:()=>{const sp=()=>x.lines.forEach((l,i)=>{const b=+val('rb'+i),s=+val('rs'+i);$('#rp'+i).textContent=b&&s?fmtR(s-b):''});$$('#f input').forEach(e=>e.addEventListener('input',sp));sp()},
      read:()=>{need(val('fDate'),'Enter a date');const lines=x.lines.map((l,i)=>({cur:l.cur,buy:val('rb'+i)===''?'':+val('rb'+i),sell:val('rs'+i)===''?'':+val('rs'+i)})).filter(l=>l.buy!==''||l.sell!=='');
        lines.forEach(l=>{need(+l.buy>0&&+l.sell>0,'Enter both buy and sell for '+l.cur);need(+l.sell>=+l.buy,'Sell must be higher than buy for '+l.cur)});need(lines.length,'Enter at least one rate');return {date:val('fDate'),lines}}});
    return;
  }
  listPage(V,{title:'Daily Rates',type:'fxrate',newLabel:'New daily rates',rows:[...L('fxrate')].sort((p,q)=>q.date.localeCompare(p.date)),
    cols:[{h:'Date',f:x=>fmtD(x.date),cls:'mono'},{h:'Buy / sell rates',f:x=>(x.lines||[]).map(l=>`<span class="tag">${esc(l.cur)} ${fmtR(l.buy)} / ${fmtR(l.sell)}</span>`).join(' ')}]});
}

/* ---------- Cash counts (end of day) ---------- */
function vCashcount(V,r,a,id){
  if(a==='new'||a==='edit'){
    if(!L('bank').length){V.innerHTML='<div class="note">Add a bank or cash account first. <a href="#/bank/new">Add bank or cash account</a></div>';return}
    const x=a==='edit'?R('cashcount',id):{date:today(),ref:nextRef('cashcount'),bank:([...L('bank')].find(k=>k.type==='cash')||L('bank')[0]).id,counted:'',note:''};if(!x)return go('#/cashcount');
    if(a==='new'&&App.prefill&&App.prefill.type==='cashcount'){Object.assign(x,App.prefill.data);App.prefill=null}
    formPage(V,{title:a==='new'?'New cash count':'Edit cash count',type:'cashcount',isNew:a==='new',rec:x,
      body:`<div class="grid">${fld('Date',inp('fDate',x.date,'type="date" required'))}${fld('Reference',inp('fRef',x.ref))}${fld('Cash or bank account',`<select id="fBank">${bankOpts(x.bank)}</select>`)}</div>
        <div class="kpis" style="margin-top:16px"><div class="card pad kpi"><div class="muted small">Balance in Falak Hesab</div><div class="num" id="ccSys"></div></div>
          <div class="card pad kpi"><div class="muted small">Counted cash</div><input id="fCnt" type="number" step="any" class="num" value="${esc(x.counted)}" style="margin-top:8px;font-size:18px"></div>
          <div class="card pad kpi"><div class="muted small">Difference</div><div class="num" id="ccDiff"></div></div></div>
        <p class="muted small">If the counted cash is different, Falak Hesab adjusts the account to the counted amount and records the difference as "Cash over/short".</p>
        <div class="grid" style="margin-top:10px">${fld('Note',`<textarea id="fNote">${esc(x.note||'')}</textarea>`,'span2')}</div>`,
      onRender:()=>{const upd=()=>{const s=bankBalOn(val('fBank'),val('fDate'),x.id),c=val('fCnt'),cu=curLabel(bankCur(val('fBank')));$('#ccSys').textContent=fmt(s)+' '+cu;const d=c===''?0:r2(+c-s);$('#ccDiff').textContent=c===''?'—':fmt(d)+' '+cu;$('#ccDiff').classList.toggle('neg',d<0)};
        ['fDate','fBank','fCnt'].forEach(k=>{$('#'+k).oninput=$('#'+k).onchange=upd});upd()},
      read:()=>{need(val('fDate'),'Enter a date');need(val('fCnt')!=='','Enter the counted cash');const s=bankBalOn(val('fBank'),val('fDate'),x.id);
        return {date:val('fDate'),ref:val('fRef'),bank:val('fBank'),counted:r2(val('fCnt')),expected:s,diff:r2(+val('fCnt')-s),note:$('#fNote').value}}});
    return;
  }
  listPage(V,{title:'Cash Counts',type:'cashcount',newLabel:'New cash count',rows:[...L('cashcount')].sort((p,q)=>q.date.localeCompare(p.date)),
    cols:[{h:'Date',f:x=>fmtD(x.date),cls:'mono'},{h:'Account',f:x=>esc(nm(R('bank',x.bank)))},{h:'Balance in Falak Hesab',num:true,f:x=>money(x.expected,curLabel(bankCur(x.bank)))},
      {h:'Counted cash',num:true,f:x=>money(x.counted,curLabel(bankCur(x.bank)))},{h:'Difference',num:true,f:x=>`<span class="${x.diff<0?'neg':''}">${fmt(x.diff)}</span>`},{h:'Note',f:x=>esc(x.note||''),cls:'muted'}]});
}

/* ---------- Sarafi overview ---------- */
function vSarafi(V){
  const {from,to}=App.period,inP=d=>d>=from&&d<=to,day=App.sarafDay||today();
  const P=postings(),pl=sums(from,to);
  const xp=-(pl['acc:xprofit']||0),hc=-(pl['acc:hcomm']||0),nx=L('exchange').filter(x=>inP(x.date)).length,pend=L('hawala').filter(h=>h.status!=='paid');
  const tile=(l,v,cls='')=>`<div class="card pad kpi"><div class="muted small">${l}</div><div class="num ${cls}">${v}</div></div>`;
  const tbl=(title,head,body,extra='')=>`<div class="card"><div class="pad" style="padding-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0">${title}</h2>${extra}</div><div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`;
  const nrow=n=>`<tr><td colspan="${n}" class="empty">Nothing here yet</td></tr>`;
  // rates board
  const curs=L('currency').map(c=>c.code).filter(c=>foreign(c));
  const board=curs.map(c=>{const b=boardOn(c,today());return `<tr><td><b>${esc(c)}</b></td><td class="num">${b?fmtR(b.buy):'—'}</td><td class="num">${b?fmtR(b.sell):'—'}</td><td class="mono muted">${b?fmtD(b.date):''}</td></tr>`}).join('')||nrow(4);
  // cash by currency
  let totB=0;const cash=[...L('bank')].sort(byCode).map(k=>{const c=recCur(k),bal=bankBalOn(k.id,to),bv=r2(bal*rateOn(c,to));totB+=bv;
    return `<tr class="click" data-h="${ledgerHref('bank:'+k.id)}"><td>${esc(k.name)}</td><td>${esc(curLabel(c))}</td><td class="num">${fmt(bal)}</td><td class="num">${fmt(bv)}</td><td class="noprint">${canWrite('cashcount')?`<a href="#" data-cc="${k.id}">Count cash</a>`:''}</td></tr>`}).join('')||nrow(5);
  // partners
  const fxb=fxSums(to),bs=sums(null,to);
  const parts=L('supplier').filter(s=>s.kind==='saraf').sort((a,b)=>a.name.localeCompare(b.name)).map(s=>{const c=recCur(s),b=r2(c?fxb['ap:'+s.id]||0:bs['ap:'+s.id]||0);
    return `<tr class="click" data-h="${ledgerHref('ap:'+s.id)}"><td>${esc(s.name)}</td><td>${esc(curLabel(c))}</td><td class="num">${b>0?fmt(b):''}</td><td class="num neg">${b<0?fmt(-b):''}</td></tr>`}).join('')||nrow(4);
  // pending hawala
  const pendRows=pend.sort((a,b)=>a.date.localeCompare(b.date)).slice(0,30).map(h=>`<tr class="click" data-h="#/hawala/view/${h.id}"><td class="mono">${fmtD(h.date)}</td><td class="mono">${esc(h.code||'')}</td><td>${h.dir==='in'?'<span class="tag due">Receive</span>':'<span class="tag cash">Send</span>'}</td><td>${esc(h.receiver||'')}</td><td>${esc(nm(R('supplier',h.partner)))}</td><td class="num">${money(h.amount,curLabel(recCur(R('supplier',h.partner))))}</td><td class="num muted">${daysBetween(h.date,today())}d</td></tr>`).join('')||nrow(7);
  // daily cash report
  const dayRows=[...L('bank')].sort(byCode).map(k=>{const key='bank:'+k.id,f=!!recCur(k);let o=0,i=0,ou=0;P.forEach(p=>{if(p.key!==key)return;const v=f?p.fx:p.amt;if(p.date<day)o+=v;else if(p.date===day){if(v>0)i+=v;else ou-=v}});
    return `<tr><td>${esc(k.name)}</td><td>${esc(curLabel(recCur(k)))}</td><td class="num">${fmt(o)}</td><td class="num">${i?fmt(i):''}</td><td class="num">${ou?fmt(ou):''}</td><td class="num"><b>${fmt(o+i-ou)}</b></td></tr>`}).join('')||nrow(6);
  V.innerHTML=`<div class="head"><h1>Exchange & Transfers</h1><div class="tools">${canWrite('exchange')?'<a class="btn primary" href="#/exchange/new">+ New exchange</a>':''}${canWrite('hawala')?'<a class="btn" href="#/hawala/new">+ New hawala</a>':''}${periodBar()}</div></div>
  <div class="stack">
  <div class="kpis">${tile('Exchange profit',fmt(xp),xp<0?'neg':'')}${tile('Hawala commission',fmt(hc))}${tile('Exchanges',nx)}${tile('Pending hawala',pend.length)}</div>
  <p class="muted small" style="margin:0"><span>Profit and commission in</span> ${esc(BASE())}, ${fmtD(from)} – ${fmtD(to)}.</p>
  <div class="sgrid">${tbl("Today's rates",`<th>Currency</th><th class="num">Buy</th><th class="num">Sell</th><th>Date</th>`,board,canWrite('fxrate')?'<a href="#/fxrate/new" class="small">Update rates</a>':'')}
  ${tbl('Partner sarafs',`<th>Partner</th><th>Currency</th><th class="num">They owe us</th><th class="num">We owe them</th>`,parts,canWrite('supplier')?'<a href="#" id="newP" class="small">+ Add partner saraf</a>':'')}</div>
  ${tbl('Cash by currency',`<th>Account</th><th>Currency</th><th class="num">Balance</th><th class="num"><span>Value</span> ${esc(BASE())}</th><th class="noprint"></th>`,cash+`<tr class="tot"><td colspan="3">Total</td><td class="num">${fmt(totB)}</td><td></td></tr>`)}
  ${tbl('Pending hawala',`<th>Date</th><th>Code</th><th>Direction</th><th>Receiver</th><th>Partner</th><th class="num">Amount</th><th class="num">Waiting</th>`,pendRows)}
  ${tbl('Daily cash report',`<th>Account</th><th>Currency</th><th class="num">Opening</th><th class="num">Money in</th><th class="num">Money out</th><th class="num">Closing</th>`,dayRows,`<input type="date" id="sDay" value="${day}" style="width:auto">`)}
  <div class="card pad"><h2 style="margin-top:0">How it works</h2><ul style="margin:0;padding-inline-start:20px;line-height:1.7">
    <li>Keep one cash or bank account for each currency (for example Cash USD, Cash AFN, Cash TRY) and add the currencies in Accounting → Currencies.</li>
    <li>Every morning enter Daily Rates. Currency Exchange uses them to suggest the rate and to calculate your profit.</li>
    <li>Partner sarafs are suppliers with Type: Partner saraf (hawala). Use one partner record for each currency.</li>
    <li>At the end of the day use Count cash to compare the real cash with Falak Hesab.</li></ul>
    <p class="muted small" style="margin:10px 0 0">Money exchange and hawala usually need a licence and customer ID records. Check the rules that apply to your business.</p></div>
  </div>`;
  bindPeriod();
  $$('#view tr[data-h]').forEach(tr=>tr.onclick=e=>{if(e.target.closest('a'))return;go(tr.dataset.h)});
  $$('#view [data-cc]').forEach(a=>a.onclick=e=>{e.preventDefault();App.prefill={type:'cashcount',data:{bank:a.dataset.cc}};go('#/cashcount/new')});
  const np=$('#newP');if(np)np.onclick=e=>{e.preventDefault();App.prefill={type:'supplier',kind:'saraf'};go('#/supplier/new')};
  $('#sDay').onchange=e=>{App.sarafDay=e.target.value;router({keepScroll:true})};
}
