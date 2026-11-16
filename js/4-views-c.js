/* ================= Falak Hesab — views: write-offs, deliveries, projects, currencies, history, shared links ================= */

/* ---------- Inventory write-offs ---------- */
function vWriteoff(V,r,a,id){
  if(a==='new'||a==='edit'){
    const items=[...L('item')].filter(i=>i.track).sort(byCode);
    if(!items.length){V.innerHTML='<div class="note">Write-offs are for stock items. Add an inventory item with “Track stock quantity” ticked first. <a href="#/item/new">New item</a></div>';return}
    const x=a==='edit'?R('writeoff',id):{date:today(),ref:nextRef('writeoff'),desc:'',account:'acc:cogs',lines:[]};if(!x)return go('#/writeoff');let ed;const inv=inventory();
    return formPage(V,{title:a==='new'?'New inventory write-off':'Edit inventory write-off',type:'writeoff',isNew:a==='new',rec:x,
      body:`<div class="grid">${fld('Date',inp('fDate',x.date,'type="date"'))}${fld('Reference',inp('fRef',x.ref))}${fld('Expense account',`<select id="fAcc">${acctOptions(x.account,{groups:['expense']})}</select>`)}${projectField(x.project)}${fld('Reason',inp('fDesc',x.desc,'placeholder="e.g. damaged, expired, lost"'),'span2')}</div><div id="lines"></div>
        <p class="muted small">Stock is valued at average cost. The value is moved from inventory to the expense account.</p>`,
      onRender:()=>{ed=LineEditor($('#lines'),[{k:'item',h:'Item',t:'select',opts:v=>optList(items,v,'Select…')},{k:'desc',h:'Description'},{k:'qty',h:'Qty',t:'num',w:'100px'},{k:'val',h:'Value',calc:l=>{const x=inv[l.item];return x?qtyOf(l)*x.avg:0}}],x.lines)},
      read:()=>{const lines=ed.read();need(lines.length,'Add at least one line');lines.forEach(l=>{need(l.item,'Choose an item on every line');need(+l.qty>0,'Enter a quantity above zero')});need(val('fAcc'),'Choose an expense account');
        return {date:val('fDate'),ref:val('fRef'),account:val('fAcc'),project:val('fProject'),desc:val('fDesc'),lines}}});
  }
  const inv=inventory();
  listPage(V,{title:'Inventory Write-offs',type:'writeoff',newLabel:'New write-off',rows:[...L('writeoff')].sort((x,y)=>y.date.localeCompare(x.date)),
    cols:[{h:'Date',f:x=>fmtD(x.date),cls:'mono'},{h:'Reference',f:x=>esc(x.ref),cls:'mono'},{h:'Reason',f:x=>esc(x.desc)},{h:'Items',f:x=>esc((x.lines||[]).map(l=>`${fmtQ(qtyOf(l))} × ${nm(R('item',l.item))}`).join(', ')),cls:'muted'},
      {h:'Value',num:true,f:x=>fmt((x.lines||[]).reduce((s,l)=>s+(inv[l.item]?qtyOf(l)*inv[l.item].avg:0),0))}]});
}

/* ---------- Delivery notes & goods receipts ---------- */
function vDelivery(V,type,a,id){
  const isD=type==='deliverynote',pt=isD?'customer':'supplier',one=isD?'Delivery note':'Goods receipt';
  if(a==='view'){const x=R(type,id);if(!x)return go('#/'+type);return docView(V,type,x)}
  if(a==='new'||a==='edit'){
    const items=[...L('item')].filter(i=>i.track).sort(byCode);
    if(!items.length){V.innerHTML='<div class="note">Add an inventory item with “Track stock quantity” ticked first. <a href="#/item/new">New item</a></div>';return}
    if(!L(pt).length){V.innerHTML=`<div class="note">${isD?'Add a customer first.':'Add a supplier first.'} <a href="#/${pt}/new">${isD?'New customer':'New supplier'}</a></div>`;return}
    let x=a==='edit'?R(type,id):{date:today(),ref:nextRef(type),[pt]:'',desc:'',address:'',lines:[]};if(!x)return go('#/'+type);
    if(a==='new'&&App.prefill&&App.prefill.type===type){x=Object.assign(x,App.prefill.data);App.prefill=null}
    let ed;
    return formPage(V,{title:(a==='new'?'New ':'Edit ')+one.toLowerCase(),type,isNew:a==='new',rec:x,after:row=>`#/${type}/view/${row.id}`,
      extraBtns:a==='edit'?`<a class="btn" href="#/${type}/view/${x.id}">View</a>`:'',
      body:`<div class="grid">${fld(isD?'Customer':'Supplier',`<select id="fParty">${optList([...L(pt)].sort((p,q)=>p.name.localeCompare(q.name)),x[pt],'Select…')}</select>`)}${fld('Date',inp('fDate',x.date,'type="date"'))}${fld('Reference',inp('fRef',x.ref))}
        ${fld('Description',inp('fDesc',x.desc))}${isD?fld('Delivery address (if different)',`<textarea id="fAddr">${esc(x.address||'')}</textarea>`,'span2'):''}</div><div id="lines"></div>`,
      onRender:()=>{ed=LineEditor($('#lines'),[{k:'item',h:'Item',t:'select',w:'34%',opts:v=>optList(items,v,'Select…'),on:(tr,v)=>{const it=R('item',v);if(it&&!tr.querySelector('[data-k=desc]').value)tr.querySelector('[data-k=desc]').value=it.name}},{k:'desc',h:'Description'},{k:'qty',h:'Qty',t:'num',w:'110px'}],x.lines)},
      read:()=>{need(val('fParty'),isD?'Choose a customer':'Choose a supplier');const lines=ed.read();need(lines.length,'Add at least one line');lines.forEach(l=>{need(l.item,'Choose an item on every line');need(+l.qty>0,'Enter a quantity above zero')});
        return {[pt]:val('fParty'),date:val('fDate'),ref:val('fRef'),desc:val('fDesc'),address:isD?$('#fAddr').value:'',lines}}});
  }
  listPage(V,{title:isD?'Delivery Notes':'Goods Receipts',type,newLabel:'New '+one.toLowerCase(),rows:[...L(type)].sort((x,y)=>y.date.localeCompare(x.date)),onRow:id=>go(`#/${type}/view/${id}`),
    cols:[{h:'Date',f:x=>fmtD(x.date),cls:'mono'},{h:'Reference',f:x=>esc(x.ref),cls:'mono'},{h:isD?'Customer':'Supplier',f:x=>esc(nm(R(pt,x[pt])))},{h:'Description',f:x=>esc(x.desc),cls:'muted'},
      {h:'Items',f:x=>esc((x.lines||[]).map(l=>`${fmtQ(qtyOf(l))} × ${nm(R('item',l.item))}`).join(', ')),cls:'muted'}]});
}

/* ---------- Projects ---------- */
function vProject(V,r,a,id){
  if(a==='new'||a==='edit'){
    const p=a==='edit'?R('project',id):{name:'',code:'',desc:'',active:true};if(!p)return go('#/project');
    return formPage(V,{title:a==='new'?'New project':'Edit project',type:'project',isNew:a==='new',rec:p,
      body:`<div class="grid">${fld('Name',inp('fName',p.name,'required placeholder="e.g. Kabul office fit-out"'))}${fld('Code',inp('fCode',p.code))}${fld('Description',`<textarea id="fDesc">${esc(p.desc||'')}</textarea>`,'span2')}</div>
        <p class="muted small">Once a project exists, a Project column appears on receipts, payments, invoices, expense claims and journal entries, so you can see profit per project.</p>`,
      read:()=>{need(val('fName'),'Enter a name');return {name:val('fName'),code:val('fCode'),desc:$('#fDesc').value}},
      deleteCheck:()=>postings().some(x=>x.project===id)?'This project is used on transactions and cannot be deleted.':''});
  }
  const pl=projectPL(App.period.from,App.period.to);
  listPage(V,{title:'Projects',type:'project',newLabel:'New project',rows:[...L('project')].sort(byCode),tools:periodBar(),
    cols:[{h:'Code',f:p=>esc(p.code||''),cls:'mono muted'},{h:'Name',f:p=>esc(p.name)},{h:'Income',num:true,f:p=>fmt(pl[p.id].inc),sum:p=>pl[p.id].inc},{h:'Expenses',num:true,f:p=>fmt(pl[p.id].exp),sum:p=>pl[p.id].exp},{h:'Profit',num:true,f:p=>num(pl[p.id].inc-pl[p.id].exp),sum:p=>pl[p.id].inc-pl[p.id].exp}]});
  bindPeriod();
}
function projectPL(from,to){const res={};L('project').forEach(p=>res[p.id]={inc:0,exp:0,acc:{}});
  postings().forEach(p=>{if(!p.project||!res[p.project]||p.date<from||p.date>to||!p.key.startsWith('acc:'))return;const g=keyGroup(p.key),x=res[p.project];
    if(g==='income')x.inc-=p.amt;else if(g==='expense')x.exp+=p.amt;else return;x.acc[p.key]=(x.acc[p.key]||0)+p.amt});
  Object.values(res).forEach(x=>{x.inc=r2(x.inc);x.exp=r2(x.exp)});return res}

/* ---------- Currencies ---------- */
function vCurrency(V,r,a,id){
  if(a==='new'||a==='edit'){
    const c=a==='edit'?R('currency',id):{code:'',name:'',rate:''};if(!c)return go('#/currency');
    const usedBy=()=>['bank','customer','supplier'].some(t=>L(t).some(x=>x.currency===c.code));
    return formPage(V,{title:a==='new'?'New currency':'Edit currency',type:'currency',isNew:a==='new',rec:c,
      body:`<div class="grid">${fld('Code (e.g. EUR, TRY, AFN)',inp('fCode',c.code,`required maxlength="5" ${a==='edit'&&usedBy()?'disabled':''}`))}${fld('Name',inp('fName',c.name,'placeholder="e.g. Turkish lira"'))}
        <label class="f"><span>Default exchange rate: 1 unit = ? ${esc(BASE())}</span>${inp('fRate',c.rate,'type="number" step="any" class="num" required')}</label></div>
        <p class="muted small">This rate is filled in on new transactions. You can change it on each transaction.</p>`,
      read:()=>{const code=($('#fCode').disabled?c.code:val('fCode')).toUpperCase();need(code,'Enter a currency code');need(code!==BASE(),'This is already your base currency');need(!L('currency').some(x=>x.code===code&&x.id!==c.id),'This currency already exists');need(+val('fRate')>0,'Enter an exchange rate above zero');
        return {code,name:val('fName'),rate:+val('fRate')}},
      deleteCheck:()=>usedBy()?'This currency is used by accounts, customers or suppliers.':''});
  }
  listPage(V,{title:'Currencies',type:'currency',newLabel:'New currency',rows:[...L('currency')].sort((a,b)=>a.code.localeCompare(b.code)),
    cols:[{h:'Code',f:c=>esc(c.code),cls:'mono'},{h:'Name',f:c=>esc(c.name||'')},{h:`Rate in ${esc(BASE())}`,num:true,f:c=>fmtQ(c.rate)}]});
  $('#view .head h1').insertAdjacentHTML('afterend',`<span class="muted small">Base currency: ${esc(BASE())}</span>`);
}

/* ---------- History (audit trail) ---------- */
const TYPE_LABEL=()=>Object.assign({},Object.fromEntries(Object.entries(TITLES)),{account:'Chart of Accounts',bank:'Bank & Cash Accounts'});
async function vHistory(V,r,a,id){
  if(!canAdmin()){V.innerHTML='<div class="note">Only administrators can see the change history.</div>';return}
  if(a==='deleted')return vRecycle(V);
  V.innerHTML='<div class="loading">Loading history…</div>';
  let list=[];try{list=await API.history(S.biz.id,a==='record'?id:null)}catch(e){V.innerHTML=`<div class="note">Could not load history: ${esc(e.message)}</div>`;return}
  const TL=TYPE_LABEL(),label=h=>{const d=h.data||{};return [d.ref?'#'+d.ref:'',d.name||'',d.desc||d.narration||''].filter(Boolean).join(' · ')};
  V.innerHTML=`<div class="head"><div>${a==='record'?'<a href="#" data-back class="small">← Back</a>':''}<h1>History</h1><span class="muted">${a==='record'?'Every saved version of this record':'Latest 300 changes in this business'}</span></div><div class="tools">${a==='record'?'':'<a class="btn" href="#/history/deleted">Recycle bin</a>'}<input class="search" id="q" type="search" placeholder="Search…" aria-label="Search"></div></div>
  <div class="card scroll"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Tab</th><th>Record</th><th></th></tr></thead><tbody>
  ${list.map((h,i)=>`<tr data-i="${i}"><td class="mono">${fmtDT(h.changed_at)}</td><td>${esc(h.changed_by||'')}</td><td><span class="tag ${h.action==='deleted'?'overdue':h.action==='created'?'paid':'due'}">${esc(h.action==='created'?'Created':h.action==='deleted'?'Deleted':'Changed')}</span></td><td>${esc(TL[h.type]||h.type)}</td><td class="muted">${esc(label(h))}</td><td><button class="btn sm" type="button" data-show="${i}">Details</button></td></tr><tr hidden id="hd${i}"><td colspan="6"><pre class="mono small" style="white-space:pre-wrap;margin:0;max-height:300px;overflow:auto">${esc(JSON.stringify(h.data,null,2))}</pre></td></tr>`).join('')||'<tr><td colspan="6" class="empty">No changes recorded yet</td></tr>'}</tbody></table></div>`;
  $$('[data-show]').forEach(b=>b.onclick=()=>{const r=$('#hd'+b.dataset.show);r.hidden=!r.hidden});
  $('#q').oninput=()=>{const s=$('#q').value.toLowerCase();$$('tbody tr[data-i]').forEach(tr=>{tr.hidden=!!s&&!tr.textContent.toLowerCase().includes(s);$('#hd'+tr.dataset.i).hidden=true})};
}

/* ---------- Recycle bin: restore records deleted in the last 30 days ---------- */
async function vRecycle(V){
  V.innerHTML='<div class="loading">Loading…</div>';
  let list=[];try{list=await API.deletedItems(S.biz.id)}catch(e){V.innerHTML=`<div class="note">${esc(e.message)}</div>`;return}
  const seen=new Set(),items=list.filter(h=>{if(seen.has(h.record_id)||S.rows.has(h.record_id))return false;seen.add(h.record_id);return true});
  const TL=TYPE_LABEL(),label=h=>{const d=h.data||{};return [d.ref?'#'+d.ref:'',d.name||d.passenger||'',d.desc||d.narration||(d.customer&&R('customer',d.customer)?nm(R('customer',d.customer)):'')||d.receiver||''].filter(Boolean).join(' · ')};
  V.innerHTML=`<div class="head"><div><a href="#/history" class="small">← History</a><h1>Recycle bin</h1><span class="muted">Records deleted in the last 30 days. Restore puts them back exactly as they were.</span></div>
    <div class="tools"><input class="search" id="q" type="search" placeholder="Search…" aria-label="Search"><button class="btn primary" type="button" id="rsSel" disabled>Restore selected</button></div></div>
  <div class="card scroll"><table><thead><tr><th style="width:34px"><input type="checkbox" id="rsAll" aria-label="Select all"></th><th>Deleted</th><th>By</th><th>Tab</th><th>Record</th><th>Date</th><th class="num">Amount</th></tr></thead><tbody>
  ${items.map((h,i)=>{const d=h.data||{},amt=d.sell!=null&&d.sell!==''?d.sell:(d.lines?sumLines(d.lines,d.lines.some(l=>l.amount!==undefined)?'amount':'debit'):d.amount);return `<tr data-i="${i}"><td><input type="checkbox" data-i="${i}"></td><td class="mono">${fmtDT(h.changed_at)}</td><td>${esc(h.changed_by||'')}</td><td>${esc(TL[h.type]||h.type)}</td><td>${esc(label(h))}</td><td class="mono">${d.date?fmtD(d.date):''}</td><td class="num">${amt!=null&&amt!==''&&!isNaN(+amt)?fmt(amt):''}</td></tr>`}).join('')||'<tr><td colspan="7" class="empty">The recycle bin is empty</td></tr>'}</tbody></table></div>
  <p class="muted small">Only owners and administrators can restore. Records dated on or before the lock date cannot be restored until the lock date is moved.</p>`;
  const boxes=()=>$$('tbody input[type=checkbox]'),upd=()=>{$('#rsSel').disabled=!boxes().some(b=>b.checked)};
  boxes().forEach(b=>b.onchange=upd);$('#rsAll').onchange=e=>{boxes().forEach(b=>{if(!b.closest('tr').hidden)b.checked=e.target.checked});upd()};
  $('#q').oninput=()=>{const s=$('#q').value.toLowerCase();$$('tbody tr[data-i]').forEach(tr=>tr.hidden=!!s&&!tr.textContent.toLowerCase().includes(s))};
  $('#rsSel').onclick=()=>{const pick=boxes().filter(b=>b.checked).map(b=>items[+b.dataset.i]);
    const lk=pick.filter(h=>locked((h.data||{}).date));if(lk.length){toast(`${lk.length} ${lookupOr('selected records are on or before the lock date. Move the lock date in Settings first.')}`);return}
    confirmBox(`${lookupOr('Restore')} ${pick.length} ${lookupOr('records?')}`,async()=>{try{await API.insertMany(S.biz.id,pick.map(h=>({id:h.record_id,type:h.type,data:h.data})));await reloadBiz();toast(lookupOr('Restored'));router()}catch(x){toast(lookupOr('Could not restore')+': '+x.message)}},lookupOr('Restore'))};
}

/* ---------- Public shared document (no login) ---------- */
async function vShared(token){
  $('#appView').hidden=true;const A=$('#authView');A.hidden=false;A.className='sharedwrap';
  A.innerHTML='<div class="loading">Loading…</div>';
  let d=null;try{d=await API.sharedDoc(token)}catch(e){}
  if(!d){A.innerHTML='<div class="authwrap"><div class="card authcard"><h1>Link not available</h1><p class="muted">This link was turned off or is not correct. Please ask the sender for a new link.</p></div></div>';return}
  closeBusiness();S.biz={id:'shared',name:d.business.name,settings:d.business.settings||{}};S.role='viewer';
  [{id:d.id,type:d.type,data:d.doc}].concat(d.party?[d.party]:[],d.taxcodes||[]).forEach(r=>S.rows.set(r.id,r));S.ver++;
  A.innerHTML='<div class="content" style="margin:0 auto;max-width:900px" id="sharedView"></div>';
  docView($('#sharedView'),d.type,R(d.type,d.id),{shared:true});
  $('#sharedView').insertAdjacentHTML('beforeend','<p class="muted small noprint" style="text-align:center">Made with Falak Hesab · free accounting</p>');
}

/* ================= Travel agency: tickets, airlines, sub-agents ================= */
const TK_SERVICE=[['ticket','Flight ticket'],['reissue','Date change / reissue'],['baggage','Extra baggage'],['other','Other service']];
const tkService=v=>(TK_SERVICE.find(x=>x[0]===v)||TK_SERVICE[0])[1];
const airlines=()=>[...L('supplier')].sort((a,b)=>(b.kind==='airline')-(a.kind==='airline')||a.name.localeCompare(b.name));
const tkCustomers=()=>[...L('customer')].sort((a,b)=>a.name.localeCompare(b.name));
function partyOpts(list,sel,mark,markLabel){return '<option value="">Select…</option>'+list.map(x=>`<option value="${x.id}" ${sel===x.id?'selected':''}>${esc(x.name)}${x.kind===mark?' ('+markLabel+')':''}</option>`).join('')}

function vTicket(V,r,a,id){
  if(a==='view'){const x=R('ticket',id);if(!x)return go('#/ticket');return docView(V,'ticket',x)}
  if(a==='new'||a==='edit'){
    let t=a==='edit'?R('ticket',id):{date:today(),ref:nextRef('ticket'),service:'ticket',passenger:'',pnr:'',ticketNo:'',airline:(L('supplier').find(s=>s.kind==='airline')||{}).id||'',route:'',flightDate:'',returnDate:'',customer:'',sell:'',cost:'',notes:'',refunded:false};
    if(!t)return go('#/ticket');
    if(a==='new'&&App.prefill&&App.prefill.type==='ticket'){t=Object.assign(t,App.prefill.data);App.prefill=null}
    if(!L('supplier').length||!L('customer').length){V.innerHTML=`<div class="note"><span>Before adding tickets, add at least one airline and one customer.</span> <a href="#/travel">Travel overview</a></div>`;return}
    const cur0=recCur(R('customer',t.customer)),st=a==='edit'?invoiceStatus('sales')[t.id]:null;
    const payBtn=st&&st.due>0&&canWrite('receipt')?`<button class="btn" type="button" id="tkPay">Receive payment</button>`:'';
    formPage(V,{title:a==='new'?'New ticket':'Edit ticket',type:'ticket',isNew:a==='new',rec:t,extraBtns:(a==='edit'?`<a class="btn" href="#/ticket/view/${t.id}">View / Print</a>`:'')+payBtn,after:row=>`#/ticket/view/${row.id}`,
      body:`<div class="grid">${fld('Date issued',inp('fDate',t.date,'type="date" required'))}${fld('Reference',inp('fRef',t.ref))}
        ${fld('Service',`<select id="fSvc">${TK_SERVICE.map(([v,l])=>`<option value="${v}" ${t.service===v?'selected':''}>${l}</option>`).join('')}</select>`)}
        ${fld('Passenger name',inp('fPax',t.passenger,'required'))}${fld('Passenger phone / WhatsApp',inp('fPaxP',t.paxPhone||'','dir="ltr" placeholder="+93 7…"'))}${fld('PNR / booking code',inp('fPnr',t.pnr,'style="text-transform:uppercase" dir="ltr"'))}${fld('Ticket number',inp('fTkt',t.ticketNo,'dir="ltr"'))}
        ${fld('Airline',`<select id="fAir">${partyOpts(airlines(),t.airline,'airline','Airline')}</select>`)}${fld('Route',inp('fRoute',t.route,'placeholder="IST – KBL" dir="ltr"'))}
        ${fld('Flight date',inp('fFly',t.flightDate,'type="date"'))}${fld('Return date',inp('fRet',t.returnDate,'type="date"'))}
        ${fld('Sold to',`<select id="fCust">${partyOpts(tkCustomers(),t.customer,'agent','Sub-agent')}</select>`)}${projectField(t.project)}</div>
        ${rateFields(cur0,t.rate)}
        <div class="grid" style="margin-top:14px">${fld('<span><span>Selling price</span> · <span id="tCur">'+esc(curLabel(cur0))+'</span></span>',inp('fSell',t.sell,'type="number" step="any" class="num" required'))}
          ${fld('Cost from airline',inp('fCost',t.cost,'type="number" step="any" class="num" required'))}
          <label class="f"><span>Profit</span><b id="fProfit" class="num" style="font-size:18px;padding:8px 0 0">0.00</b></label></div>
        <div class="card pad" style="margin-top:16px;background:var(--bg)"><label class="c"><input type="checkbox" id="fRef1" ${t.refunded?'checked':''}> <b>Refunded / cancelled</b></label>
          <div class="grid" id="refBox" ${t.refunded?'':'hidden'} style="margin-top:10px">${fld('Refund date',inp('fRDate',t.refundDate||'','type="date"'))}
            ${fld('Refund to customer',inp('fRCust',t.refundCustomer??'','type="number" step="any" class="num"'))}${fld('Refund from airline',inp('fRAir',t.refundAirline??'','type="number" step="any" class="num"'))}
            <label class="f"><span>Profit after refund</span><b id="fRProfit" class="num" style="font-size:18px;padding:8px 0 0">0.00</b></label></div></div>
        <div class="grid" style="margin-top:14px">${fld('Notes',`<textarea id="fNotes">${esc(t.notes||'')}</textarea>`,'span2')}</div>
        ${st?`<div class="meta">${statusTag(st)} <span>Paid</span> ${fmt(st.paid)} · <span>Still to receive</span> ${fmt(st.due)} ${esc(curLabel(st.cur))}</div>`:''}`,
      onRender:()=>{
        const calc=()=>{const s=+val('fSell')||0,c=+val('fCost')||0,ref=$('#fRef1').checked;$('#fProfit').textContent=fmt(s-c);
          $('#fRProfit').textContent=fmt((s-(ref?+val('fRCust')||0:0))-(c-(ref?+val('fRAir')||0:0)))};
        ['fSell','fCost','fRCust','fRAir'].forEach(k=>$('#'+k).oninput=calc);
        $('#fRef1').onchange=e=>{$('#refBox').hidden=!e.target.checked;if(e.target.checked&&!val('fRDate'))$('#fRDate').value=today();calc()};
        if(App.openRefund&&App.openRefund===t.id){App.openRefund=null;const cb=$('#fRef1');if(!cb.checked){cb.checked=true;cb.onchange({target:cb})}$('#refBox').scrollIntoView({block:'center'});$('#fRCust').focus()}
        $('#fCust').onchange=()=>setRateCur(recCur(R('customer',val('fCust'))));
        $('#fPnr').onchange=e=>e.target.value=e.target.value.toUpperCase();
        const pb=$('#tkPay');if(pb)pb.onclick=()=>{const c=R('customer',t.customer);App.prefill={type:'receipt',data:{contact:c?c.name:'',desc:'Ticket '+t.ref+' – '+t.passenger,lines:[{account:'ar:'+t.customer,invoice:t.id,amount:st.due}]}};go('#/receipt/new')};
        calc()},
      read:()=>{need(val('fDate'),'Enter a date');need(val('fPax'),'Enter the passenger name');
        const tkN=val('fTkt'),pnr=val('fPnr').toUpperCase(),others=L('ticket').filter(o=>o.id!==t.id),dTk=tkN&&others.find(o=>o.ticketNo===tkN),dP=pnr&&others.find(o=>(o.pnr||'').toUpperCase()===pnr&&o.passenger===val('fPax'));
        const warn=dTk?`${lookupOr('Ticket number')} ${tkN} ${lookupOr('is already on ticket')} #${dTk.ref} (${dTk.passenger}).`:dP?`${lookupOr('This passenger already has a ticket with PNR')} ${pnr} (#${dP.ref}).`:'';
        const sig=tkN+'|'+pnr+'|'+val('fPax');if(warn&&$('#f').dataset.dupOk!==sig){$('#f').dataset.dupOk=sig;throw new Error(warn+' '+lookupOr('Press the save button again to save anyway.'))}need(val('fAir'),'Choose the airline');need(val('fCust'),'Choose who the ticket is sold to');
        need(val('fSell')!==''&&+val('fSell')>=0,'Enter the selling price');need(val('fCost')!==''&&+val('fCost')>=0,'Enter the cost from the airline');
        const ref=$('#fRef1').checked,cur=recCur(R('customer',val('fCust')));
        if(ref){need(val('fRDate'),'Enter the refund date');need(val('fRDate')>=val('fDate'),'The refund date cannot be before the issue date')}
        return {date:val('fDate'),ref:val('fRef'),service:val('fSvc'),passenger:val('fPax'),paxPhone:val('fPaxP'),pnr:val('fPnr').toUpperCase(),ticketNo:val('fTkt'),airline:val('fAir'),route:val('fRoute').toUpperCase(),
          flightDate:val('fFly'),returnDate:val('fRet'),customer:val('fCust'),project:val('fProject'),currency:cur,rate:readRate(cur),sell:r2(val('fSell')),cost:r2(val('fCost')),
          refunded:ref,refundDate:ref?val('fRDate'):'',refundCustomer:ref?r2(val('fRCust')):'',refundAirline:ref?r2(val('fRAir')):'',notes:$('#fNotes').value}}});
    return;
  }
  const st=invoiceStatus('sales');
  const rows=[...L('ticket')].sort((x,y)=>y.date.localeCompare(x.date)||(parseInt(y.ref)||0)-(parseInt(x.ref)||0));
  listPage(V,{title:'Tickets',type:'ticket',newLabel:'New ticket',rows,onRow:id=>go('#/ticket/view/'+id),tools:'<a class="btn" href="#/travel">Travel overview</a>',
    cols:[{h:'Date',f:t=>fmtD(t.date),cls:'mono'},{h:'Reference',f:t=>esc(t.ref),cls:'mono'},{h:'Passenger',f:t=>esc(t.passenger)+(t.service&&t.service!=='ticket'?` <span class="tag">${tkService(t.service)}</span>`:'')},
      {h:'PNR',f:t=>esc(t.pnr||''),cls:'mono'},{h:'Airline',f:t=>esc(nm(R('supplier',t.airline)))},{h:'Route',f:t=>esc(t.route||''),cls:'muted'},{h:'Flight date',f:t=>t.flightDate?fmtD(t.flightDate):'',cls:'mono'},
      {h:'Sold to',f:t=>esc(nm(R('customer',t.customer)))},
      {h:'Price',num:true,f:t=>money(ticketCalc(t).netSell,docCur(t)),sum:t=>ticketCalc(t).netSell*docRate(t)},
      {h:'Profit',num:true,f:t=>money(ticketCalc(t).profit,docCur(t)),sum:t=>ticketCalc(t).profit*docRate(t)},
      {h:'Status',f:t=>t.refunded?(ticketRefund(t).custOwed>0?'<span class="tag overdue">Refund to pay back</span>':'<span class="tag">Refunded</span>'):statusTag(st[t.id])}]});
}

/* refunds: prefilled payment back to the customer / receipt from the airline (ticket page and Travel overview) */
function refundToCustomer(x){const rf=ticketRefund(x),c=R('customer',x.customer),bank=L('bank').find(k=>recCur(k)===docCur(x))||L('bank')[0],bc=recCur(bank),amt=bc===docCur(x)?rf.custOwed:r2(rf.custOwed*docRate(x)/curRate(bc));
  App.prefill={type:'payment',data:{bank:bank?bank.id:'',contact:nm(c),refundFor:x.id,desc:'Refund – ticket '+x.ref+' – '+x.passenger,lines:[{account:'ar:'+x.customer,desc:'Ticket refund',amount:amt}]}};go('#/payment/new')}
function refundFromAirline(x){const rf=ticketRefund(x),a=R('supplier',x.airline),bank=L('bank').find(k=>recCur(k)===docCur(x))||L('bank')[0],bc=recCur(bank),amt=bc===docCur(x)?rf.airlineOwes:r2(rf.airlineOwes*docRate(x)/curRate(bc));
  App.prefill={type:'receipt',data:{bank:bank?bank.id:'',contact:nm(a),refundFor:x.id,desc:'Airline refund – ticket '+x.ref+' – '+x.passenger,lines:[{account:'ap:'+x.airline,desc:'Ticket refund',amount:amt}]}};go('#/receipt/new')}

function vTravel(V){
  const {from,to}=App.period,inP=d=>(!from||d>=from)&&(!to||d<=to);
  const tks=L('ticket').filter(t=>inP(t.date)),base=t=>{const x=ticketCalc(t),r=docRate(t);return {sell:x.netSell*r,cost:x.netCost*r,profit:x.profit*r}};
  const tot={n:tks.length,sell:0,cost:0,profit:0};tks.forEach(t=>{const b=base(t);tot.sell+=b.sell;tot.cost+=b.cost;tot.profit+=b.profit});
  const fxb=fxSums(to),bs=sums(null,to),bal=(pre,p)=>{const c=recCur(p);return r2(c?fxb[pre+p.id]||0:bs[pre+p.id]||0)};
  const group=(keyFn)=>{const m={};tks.forEach(t=>{const k=keyFn(t)||'—',b=base(t);const g=m[k]=m[k]||{k,n:0,sell:0,cost:0,profit:0};g.n++;g.sell+=b.sell;g.cost+=b.cost;g.profit+=b.profit});return Object.values(m).sort((a,b)=>b.profit-a.profit)};
  const byAir=group(t=>t.airline),byCust=group(t=>t.customer),byRoute=group(t=>String(t.route||'').toUpperCase().replace(/\s+/g,' ').trim());
  const g=(list,k)=>list.find(x=>x.k===k)||{n:0,sell:0,cost:0,profit:0};
  const airs=L('supplier').filter(s=>s.kind==='airline'||byAir.some(x=>x.k===s.id)).sort((a,b)=>a.name.localeCompare(b.name));
  const agents=L('customer').filter(c=>c.kind==='agent').sort((a,b)=>a.name.localeCompare(b.name));
  const tile=(l,v,cls='')=>`<div class="card pad kpi"><div class="muted small">${l}</div><div class="num ${cls}">${v}</div></div>`;
  const tbl=(title,head,body,extra='')=>`<div class="card"><div class="pad" style="padding-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0">${title}</h2>${extra}</div><div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`;
  const nrow='<tr><td colspan="9" class="empty">Nothing here yet</td></tr>';
  const cw=canWrite('payment'),cr=canWrite('receipt');
  const airRows=airs.map(s=>{const b=bal('ap:',s),x=g(byAir,s.id),c=recCur(s);return `<tr class="click" data-h="${ledgerHref('ap:'+s.id)}"><td>${esc(s.name)}</td><td class="num">${x.n}</td><td class="num">${fmt(x.cost)}</td><td class="num">${fmt(x.profit)}</td>
    <td class="num">${b>0?money(b,c):''}</td><td class="num neg">${b<0?money(-b,c):''}</td><td class="noprint">${cw?`<a href="#" data-dep="${s.id}">Add deposit</a>`:''}</td></tr>`}).join('')||nrow;
  const agRows=agents.map(c=>{const b=bal('ar:',c),x=g(byCust,c.id),cu=recCur(c);return `<tr class="click" data-h="${ledgerHref('ar:'+c.id)}"><td>${esc(c.name)}</td><td class="num">${x.n}</td><td class="num">${fmt(x.sell)}</td><td class="num">${fmt(x.profit)}</td>
    <td class="num">${b<0?money(-b,cu):''}</td><td class="num neg">${b>0?money(b,cu):''}</td><td class="noprint">${cr?`<a href="#" data-rec="${c.id}">Receive deposit</a>`:''}</td></tr>`}).join('')||nrow;
  const routeRows=byRoute.map(x=>`<tr><td dir="ltr" style="text-align:start">${esc(x.k)}</td><td class="num">${x.n}</td><td class="num">${fmt(x.sell)}</td><td class="num">${fmt(x.cost)}</td><td class="num">${fmt(x.profit)}</td></tr>`).join('')||nrow;
  const custRows=byCust.slice(0,15).map(x=>{const c=R('customer',x.k);return `<tr><td>${esc(nm(c))}${c&&c.kind==='agent'?' <span class="tag">Sub-agent</span>':''}</td><td class="num">${x.n}</td><td class="num">${fmt(x.sell)}</td><td class="num">${fmt(x.profit)}</td></tr>`}).join('')||nrow;
  const td=today(),wk=addDays(td,7),fl=L('ticket').filter(t=>!t.refunded&&t.flightDate&&t.flightDate>=td&&t.flightDate<=wk).sort((a,b)=>a.flightDate.localeCompare(b.flightDate));
  const flMsg=t=>{const a=nm(R('supplier',t.airline)),T=lookupOr;return [T('Hello')+' '+t.passenger+',',T('Reminder from')+' '+S.biz.name+': '+T('your flight')+' '+(a?a+' ':'')+(t.route||'')+' '+T('on')+' '+fmtD(t.flightDate)+(t.pnr?' (PNR '+t.pnr+')':'')+'.',T('Please be at the airport at least 3 hours before departure and bring your passport.'),T('Have a good flight!'),setting('phone')?'☎ '+setting('phone'):''].filter(Boolean).join('\n')};
  const flDay=d=>d===td?lookupOr('Today'):d===addDays(td,1)?lookupOr('Tomorrow'):fmtD(d);
  const flRows=fl.map(t=>{const c=R('customer',t.customer),ph=String(t.paxPhone||(c&&c.phone)||'').replace(/[^\d]/g,'');return `<tr class="click" data-h="#/ticket/view/${t.id}"><td><b>${esc(flDay(t.flightDate))}</b></td><td>${esc(t.passenger)}</td><td dir="ltr" style="text-align:start">${esc(t.route||'')}</td><td>${esc(nm(R('supplier',t.airline)))}</td><td class="mono">${esc(t.pnr||'')}</td><td>${esc(nm(c))}</td><td class="noprint"><a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${ph}?text=${encodeURIComponent(flMsg(t))}">WhatsApp reminder</a></td></tr>`}).join('')||'<tr><td colspan="7" class="empty">No flights in the next 7 days</td></tr>';
  const stS=invoiceStatus('sales'),unpaid=L('ticket').filter(t=>stS[t.id]&&stS[t.id].due>0).sort((a,b)=>a.date.localeCompare(b.date));
  /* sub-agent ageing: what each sub-agent owes, by how late it is (due date = ticket date + the agent's payment terms) */
  const toCur=(x,c)=>x.cur===c?x.due:r2(x.due*x.rate/curRate(c)),AGE=[['nd','Not due yet'],['a1','1–30 days late'],['a2','31–60 days late'],['a3','61–90 days late'],['a4','Over 90 days late']];
  const ageKey=d=>{const n=d&&d<td?daysBetween(d,td):0;return n<=0?'nd':n<=30?'a1':n<=60?'a2':n<=90?'a3':'a4'};
  let agOver=0;
  const ageList=agents.map(c=>{const cu=recCur(c),o={c,cu,nd:0,a1:0,a2:0,a3:0,a4:0,tot:0,oldest:null};
    Object.values(stS).forEach(x=>{if(x.party!==c.id||!(x.due>0.004))return;const v=toCur(x,cu),k=ageKey(x.dueDate);o[k]+=v;o.tot+=v;if(k!=='nd')agOver+=x.due*x.rate;if(!o.oldest||x.date<o.oldest.date)o.oldest=x});return o}).filter(o=>o.tot>0.004).sort((a,b)=>(b.a4+b.a3+b.a2+b.a1)-(a.a4+a.a3+a.a2+a.a1)||b.tot-a.tot);
  const ageRows=ageList.map(o=>{const ot=o.oldest,tk=ot&&R('ticket',ot.id);return `<tr class="click" data-h="#/reports/statement/${o.c.id}"><td>${esc(o.c.name)}</td>${AGE.map(([k])=>`<td class="num ${k!=='nd'&&o[k]>0.004?'neg':''}">${o[k]>0.004?fmt(o[k]):''}</td>`).join('')}<td class="num"><b>${money(o.tot,o.cu)}</b></td>
    <td class="small">${ot?(tk?`<a href="#/ticket/view/${tk.id}">#${esc(tk.ref)}</a> · `:'')+fmtD(ot.date):''}</td><td class="noprint"><a class="btn sm" href="#/reports/statement/${o.c.id}">Statement</a></td></tr>`}).join('')||'<tr><td colspan="9" class="empty">No sub-agent owes you money</td></tr>';
  /* airline payments due (due date = ticket date + the airline's payment terms) and low deposits */
  const stP=invoiceStatus('purchase'),wk7=addDays(td,7),ago7=addDays(td,-7);let airSoon=0;
  const payList=airs.map(s=>{const cu=recCur(s),o={s,cu,over:0,week:0,later:0,tot:0,next:'',dep:0,recent:0};
    Object.values(stP).forEach(x=>{if(x.party!==s.id||!(x.due>0.004))return;const v=toCur(x,cu),d=x.dueDate||x.date;
      if(d<td)o.over+=v;else if(d<=wk7)o.week+=v;else o.later+=v;o.tot+=v;if(d<=wk7)airSoon+=x.due*x.rate;if(d>=td&&(!o.next||d<o.next))o.next=d});
    const b=bal('ap:',s);o.dep=b>0?b:0;
    L('ticket').forEach(t=>{if(t.airline===s.id&&t.date>ago7&&t.date<=td){const k=ticketCalc(t);o.recent+=r2(k.netCost*docRate(t)/curRate(cu))}});
    o.low=o.dep>0.004&&o.recent>o.dep;return o}).filter(o=>o.tot>0.004||o.low);
  const payRows=payList.map(o=>`<tr class="click" data-h="${ledgerHref('ap:'+o.s.id)}"><td>${esc(o.s.name)}${o.low?' <span class="tag overdue">Deposit running low</span>':''}</td>
    <td class="num neg">${o.over>0.004?fmt(o.over):''}</td><td class="num">${o.week>0.004?fmt(o.week):''}</td><td class="num">${o.later>0.004?fmt(o.later):''}</td><td class="num"><b>${o.tot>0.004?money(o.tot,o.cu):''}</b></td>
    <td class="mono">${o.next?fmtD(o.next):''}</td><td class="num">${o.dep>0.004?money(o.dep,o.cu):''}</td><td class="noprint">${cw?`<a href="#" data-pay="${o.s.id}">${o.tot>0.004?'Pay':'Add deposit'}</a>`:''}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">Nothing to pay airlines right now</td></tr>';
  /* refund tracker: every cancelled ticket and what is still open */
  const refs=L('ticket').filter(t=>t.refunded).map(t=>({t,rf:ticketRefund(t)})).map(o=>Object.assign(o,{open:o.rf.custOwed>0.004||o.rf.airlineOwes>0.004}))
    .filter(o=>o.open||inP(o.t.refundDate||o.t.date)).sort((a,b)=>(b.open-a.open)||String(b.t.refundDate||b.t.date).localeCompare(String(a.t.refundDate||a.t.date)));
  const openRef=refs.filter(o=>o.open).length;
  const refRows=refs.slice(0,40).map(({t,rf})=>`<tr class="click" data-h="#/ticket/view/${t.id}"><td class="mono">${fmtD(t.refundDate||t.date)}</td><td class="mono">${esc(t.ref)}</td><td>${esc(t.passenger)}</td><td>${esc(nm(R('supplier',t.airline)))}</td>
    <td class="num ${rf.custOwed>0.004?'neg':''}">${rf.custOwed>0.004?money(rf.custOwed,rf.cur):''}</td><td class="num">${rf.airlineOwes>0.004?money(rf.airlineOwes,rf.cur):''}</td>
    <td>${rf.custOwed>0.004?'<span class="tag overdue">Pay back customer</span> ':''}${rf.airlineOwes>0.004?'<span class="tag due">Waiting for airline refund</span>':''}${rf.custOwed>0.004||rf.airlineOwes>0.004?'':'<span class="tag paid">Done</span>'}</td>
    <td class="noprint" style="white-space:nowrap">${rf.custOwed>0.004&&cw?`<a class="btn sm" href="#" data-rc="${t.id}">Pay refund to customer</a> `:''}${rf.airlineOwes>0.004&&cr?`<a class="btn sm" href="#" data-ra="${t.id}">Receive refund from airline</a>`:''}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">No cancelled tickets</td></tr>';
  const alert=(id,l,v,n)=>`<a class="card pad kpi alertkpi ${n?'warn':''}" href="#" data-jump="${id}"><div class="muted small">${l}</div><div class="num ${n?'neg':''}">${v}</div></a>`;
  const unpaidRows=unpaid.slice(0,30).map(t=>`<tr class="click" data-h="#/ticket/view/${t.id}"><td class="mono">${fmtD(t.date)}</td><td class="mono">${esc(t.ref)}</td><td>${esc(t.passenger)}</td><td>${esc(nm(R('customer',t.customer)))}</td><td class="num">${money(stS[t.id].due,stS[t.id].cur)}</td><td>${statusTag(stS[t.id])}</td></tr>`).join('')||nrow;
  V.innerHTML=`<div class="head"><h1>Travel overview</h1><div class="tools">${canWrite('ticket')?'<a class="btn primary" href="#/ticket/new">+ New ticket</a>':''}${periodBar()}</div></div>
  <div class="stack">
  <div class="kpis">${tile('Tickets',tot.n)}${tile('Sales',fmt(tot.sell))}${tile('Cost from airlines',fmt(tot.cost))}${tile('Profit',fmt(tot.profit),tot.profit<0?'neg':'')}</div>
  <div class="kpis2">${alert('tvAge','Overdue from sub-agents',fmt(agOver),agOver>0.004)}${alert('tvPay','Due to airlines in the next 7 days',fmt(airSoon),airSoon>0.004)}${alert('tvRef','Open refunds',openRef,openRef>0)}</div>
  <p class="muted small" style="margin:0"><span>Amounts in</span> ${esc(BASE())}. <span>Deposits and balances are shown in each airline's or agent's own currency.</span></p>
  ${tbl('Upcoming flights (next 7 days)','<th>When</th><th>Passenger</th><th>Route</th><th>Airline</th><th>PNR</th><th>Sold to</th><th class="noprint"></th>',flRows)}
  <div id="tvAge">${tbl('Sub-agents: what they owe and how late','<th>Agent</th>'+AGE.map(([,l])=>`<th class="num">${l}</th>`).join('')+'<th class="num">Total owed</th><th>Oldest unpaid</th><th class="noprint"></th>',ageRows)}</div>
  <div id="tvPay">${tbl('Airline payments due','<th>Airline</th><th class="num">Overdue</th><th class="num">Due in 7 days</th><th class="num">Due later</th><th class="num">Total to pay</th><th>Next due date</th><th class="num">Deposit left</th><th class="noprint"></th>',payRows)}</div>
  <div id="tvRef">${tbl('Refunds','<th>Refund date</th><th>Reference</th><th>Passenger</th><th>Airline</th><th class="num">Still to pay back</th><th class="num">Still to receive</th><th>Status</th><th class="noprint"></th>',refRows)}</div>
  ${tbl('Airlines','<th>Airline</th><th class="num">Tickets</th><th class="num">Cost</th><th class="num">Profit</th><th class="num">Deposit left</th><th class="num">You owe</th><th class="noprint"></th>',airRows,canWrite('supplier')?'<a href="#" id="newAir" class="small">+ Add airline</a>':'')}
  ${tbl('Sub-agents','<th>Agent</th><th class="num">Tickets</th><th class="num">Sales</th><th class="num">Profit</th><th class="num">Deposit left</th><th class="num">Owes you</th><th class="noprint"></th>',agRows,canWrite('customer')?'<a href="#" id="newAg" class="small">+ Add sub-agent</a>':'')}
  ${tbl('Unpaid tickets','<th>Date</th><th>Reference</th><th>Passenger</th><th>Sold to</th><th class="num">Still to receive</th><th></th>',unpaidRows)}
  ${tbl('Profit by route','<th>Route</th><th class="num">Tickets</th><th class="num">Sales</th><th class="num">Cost</th><th class="num">Profit</th>',routeRows)}
  ${tbl('Top customers','<th>Customer</th><th class="num">Tickets</th><th class="num">Sales</th><th class="num">Profit</th>',custRows)}
  <div class="card pad"><h2 style="margin-top:0">How it works</h2><ul style="margin:0;padding-inline-start:20px;line-height:1.7">
    <li>Mark a supplier as Airline and a customer as Sub-agent (B2B) in their details.</li>
    <li>Money you send to an airline as a deposit: press Add deposit. Each ticket's cost is taken from the deposit.</li>
    <li>Money a sub-agent sends you: press Receive deposit. Each ticket you sell them is taken from their deposit.</li>
    <li>Walk-in passengers: add the ticket, then press Receive payment on the ticket.</li>
    <li>Due dates: tickets sold to a sub-agent are due after the agent's Payment terms (days); airline costs after the airline's Payment terms. Set 0 to pay on the issue date.</li></ul></div>
  </div>`;
  bindPeriod();
  $$('#view tr[data-h]').forEach(tr=>tr.onclick=e=>{if(e.target.closest('a'))return;go(tr.dataset.h)});
  $$('#view [data-dep]').forEach(a=>a.onclick=e=>{e.preventDefault();const s=R('supplier',a.dataset.dep);App.prefill={type:'payment',data:{contact:s.name,desc:'Deposit – '+s.name,lines:[{account:'ap:'+s.id,amount:''}]}};go('#/payment/new')});
  $$('#view [data-rec]').forEach(a=>a.onclick=e=>{e.preventDefault();const c=R('customer',a.dataset.rec);App.prefill={type:'receipt',data:{contact:c.name,desc:'Deposit – '+c.name,lines:[{account:'ar:'+c.id,amount:''}]}};go('#/receipt/new')});
  $$('#view [data-jump]').forEach(a=>a.onclick=e=>{e.preventDefault();const el=document.getElementById(a.dataset.jump);if(el)el.scrollIntoView({behavior:'smooth',block:'start'})});
  $$('#view [data-pay]').forEach(a=>a.onclick=e=>{e.preventDefault();const s=R('supplier',a.dataset.pay),o=payList.find(x=>x.s.id===s.id),amt=o&&o.over+o.week>0.004?r2(o.over+o.week):'';App.prefill={type:'payment',data:{contact:s.name,desc:(amt?'Payment – ':'Deposit – ')+s.name,lines:[{account:'ap:'+s.id,amount:amt}]}};go('#/payment/new')});
  $$('#view [data-rc]').forEach(a=>a.onclick=e=>{e.preventDefault();refundToCustomer(R('ticket',a.dataset.rc))});
  $$('#view [data-ra]').forEach(a=>a.onclick=e=>{e.preventDefault();refundFromAirline(R('ticket',a.dataset.ra))});
  const na=$('#newAir');if(na)na.onclick=e=>{e.preventDefault();App.prefill={type:'supplier',kind:'airline'};go('#/supplier/new')};
  const ng=$('#newAg');if(ng)ng.onclick=e=>{e.preventDefault();App.prefill={type:'customer',kind:'agent'};go('#/customer/new')};
}

/* ================= Customize: choose which tabs appear in the menu (like Manager.io) ================= */
function vCustomize(V){
  if(!canAdmin()){go('#/summary');return}
  const hid=hiddenTabs(),ad=canAdmin();
  const cnt=k=>k==='travel'?0:L(k).length;
  const groups=NAV.map(([g,items])=>[g,items.filter(([k])=>!ALWAYS_TABS.includes(k))]).filter(([,items])=>items.length);
  V.innerHTML=`<div class="head"><div><h1>Customize</h1><span class="muted">Choose which tabs appear in the menu for this business.</span></div>
    <div class="tools"><button class="btn" type="button" id="cAll">Show all</button><button class="btn" type="button" id="cNone">Hide all</button></div></div>
  <form id="cf"><div class="custgrid">${groups.map(([g,items])=>`<div class="card pad"><h2>${g}</h2>${items.map(([k,l])=>{const n=cnt(k);
      return `<label class="c custrow"><input type="checkbox" value="${k}" ${hid.has(k)?'':'checked'}><span>${l}</span>${n?`<span class="tag">${n}</span>`:''}</label>`}).join('')}</div>`).join('')}</div>
  <div class="card pad" style="margin-top:18px"><p class="muted" style="margin:0"><span>Always shown:</span> ${['Summary','Reports','Settings','Users & Access','History'].map(x=>`<span>${x}</span>`).join(', ')}.</p>
    <p class="muted small" style="margin:8px 0 0">Hiding a tab does not delete anything. Its records stay in your books and reports, and you can show the tab again any time.</p></div>
  <div class="actions"><div><button class="btn primary" type="submit">Save</button><a class="btn" href="#/summary">Cancel</a></div></div></form>`;
  const boxes=()=>$$('#cf input[type=checkbox]');
  $('#cAll').onclick=()=>boxes().forEach(b=>b.checked=true);
  $('#cNone').onclick=()=>boxes().forEach(b=>b.checked=false);
  $('#cf').onsubmit=e=>{e.preventDefault();if(!ad)return;
    const hide=boxes().filter(b=>!b.checked).map(b=>b.value);
    const withData=hide.filter(k=>!hid.has(k)&&cnt(k)>0);
    const save=async()=>{const st=Object.assign({},S.biz.settings||{},{hiddenTabs:hide.filter(k=>!OPTIONAL_TABS.includes(k)),shownTabs:boxes().filter(b=>b.checked&&OPTIONAL_TABS.includes(b.value)).map(b=>b.value)});delete st.travel;
      try{await API.updateBusiness(S.biz.id,{name:S.biz.name,settings:st});S.biz.settings=st;S.ver++;toast('Saved');go('#/summary')}catch(x){toast('Could not save: '+x.message)}};
    if(withData.length)confirmBox(`${lookupOr('These tabs have records:')} ${withData.map(k=>lookupOr(TITLES[k])).join(', ')}. ${lookupOr('Hide them anyway? Nothing is deleted.')}`,save,'Hide');else save()};
}
