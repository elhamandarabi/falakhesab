/* ================= Falak Hesab — views: inventory, payroll, assets, accounting, settings, users ================= */

/* ---------- Inventory items ---------- */
function vItem(V,r,a,id){
  if(a==='new'||a==='edit'){
    const it=a==='edit'?R('item',id):{name:'',code:'',unit:'',price:'',cost:'',track:true,incomeAccount:'',expenseAccount:''};if(!it)return go('#/item');
    const byName=n=>{const x=accounts().find(y=>y.name===n);return x?'acc:'+x.id:''};
    return formPage(V,{title:`${a==='new'?'New':'Edit'} inventory item`,type:'item',isNew:a==='new',rec:it,
      body:`<div class="grid">${fld('Item name',inp('fName',it.name,'required'))}${fld('Item code',inp('fCode',it.code))}${fld('Unit (e.g. pcs, box, hour)',inp('fUnit',it.unit))}
        ${fld('Sales price',inp('fPrice',it.price,'type="number" step="any" class="num"'))}${fld('Purchase price',inp('fCost',it.cost,'type="number" step="any" class="num"'))}
        ${fld('Income account (sales)',`<select id="fInc">${acctOptions(it.incomeAccount||byName('Sales'),{groups:['income']})}</select>`)}
        ${fld('Expense account (purchases, if not tracked)',`<select id="fExp">${acctOptions(it.expenseAccount||byName('Purchases'),{groups:['expense','asset']})}</select>`)}
        <label class="c span2"><input type="checkbox" id="fTrack" ${it.track?'checked':''}> Track stock quantity (goods). Leave unticked for services.</label></div>`,
      read:()=>{need(val('fName'),'Enter an item name');return {name:val('fName'),code:val('fCode'),unit:val('fUnit'),price:val('fPrice')===''?'':+val('fPrice'),cost:val('fCost')===''?'':+val('fCost'),incomeAccount:val('fInc'),expenseAccount:val('fExp'),track:$('#fTrack').checked}},
      deleteCheck:()=>['quote','salesinvoice','creditnote','purchaseorder','purchaseinvoice','debitnote'].some(t=>L(t).some(d=>(d.lines||[]).some(l=>l.item===id)))?'This item is used on documents and cannot be deleted.':''});
  }
  const inv=inventory();
  listPage(V,{title:'Inventory Items',type:'item',onRow:id=>go(R('item',id).track?ledgerHref('inv:'+id):'#/item/edit/'+id),newLabel:'New item',rows:[...L('item')].sort(byCode),
    cols:[{h:'',f:i=>canWrite('item')?`<a href="#/item/edit/${i.id}">Edit</a>`:''},{h:'Code',f:i=>esc(i.code||''),cls:'mono muted'},{h:'Item name',f:i=>esc(i.name)+(i.track?'':' <span class="tag">service</span>')},{h:'Unit',f:i=>esc(i.unit||''),cls:'muted'},
      {h:'Sales price',num:true,f:i=>i.price===''?'':fmt(i.price)},{h:'Purchase price',num:true,f:i=>i.cost===''?'':fmt(i.cost)},
      {h:'Qty on hand',num:true,f:i=>i.track?`<span class="${inv[i.id].qty<0?'neg':''}">${fmtQ(inv[i.id].qty)}</span>`:''},
      ...(L('deliverynote').length?[{h:'To deliver',num:true,f:i=>i.track&&inv[i.id].toDeliver?fmtQ(inv[i.id].toDeliver):''}]:[]),
      ...(L('goodsreceipt').length?[{h:'To receive',num:true,f:i=>i.track&&inv[i.id].toReceive?fmtQ(inv[i.id].toReceive):''}]:[]),{h:'Average cost',num:true,f:i=>i.track?fmt(inv[i.id].avg):''},
      {h:'Value',num:true,f:i=>i.track?fmt(inv[i.id].value):'',sum:i=>i.track?inv[i.id].value:0}]});
}

/* ---------- Employees ---------- */
function vEmployee(V,r,a,id){
  if(a==='new'||a==='edit'){
    const e=a==='edit'?R('employee',id):{name:'',code:'',email:'',phone:'',address:'',position:''};if(!e)return go('#/employee');
    return formPage(V,{title:`${a==='new'?'New':'Edit'} employee`,type:'employee',isNew:a==='new',rec:e,
      extraBtns:a==='edit'?`<a class="btn" href="${ledgerHref('emp:'+e.id)}">Transactions</a>`:'',
      body:`<div class="grid">${fld('Name',inp('fName',e.name,'required'))}${fld('Employee code',inp('fCode',e.code))}${fld('Position',inp('fPos',e.position))}${fld('Email',inp('fEmail',e.email))}${fld('Phone',inp('fPhone',e.phone))}${fld('Address',`<textarea id="fAddr">${esc(e.address)}</textarea>`,'span2')}</div>`,
      read:()=>{need(val('fName'),'Enter a name');return {name:val('fName'),code:val('fCode'),position:val('fPos'),email:val('fEmail'),phone:val('fPhone'),address:$('#fAddr').value}},
      deleteCheck:()=>usedKey('emp:'+id)||L('payslip').some(p=>p.employee===id)?'This employee has transactions and cannot be deleted.':''});
  }
  const bs=sums(null,null);
  listPage(V,{title:'Employees',type:'employee',newLabel:'New employee',rows:[...L('employee')].sort((x,y)=>x.name.localeCompare(y.name)),onRow:id=>go(ledgerHref('emp:'+id)),
    cols:[{h:'',f:e=>canWrite('employee')?`<a href="#/employee/edit/${e.id}">Edit</a>`:''},{h:'Code',f:e=>esc(e.code||''),cls:'mono muted'},{h:'Name',f:e=>esc(e.name)},{h:'Position',f:e=>esc(e.position||''),cls:'muted'},
      {h:'Owed to employee',num:true,f:e=>fmt(-(bs['emp:'+e.id]||0)),sum:e=>-(bs['emp:'+e.id]||0)}]});
}

/* ---------- Payslips ---------- */
function vPayslip(V,r,a,id){
  if(a==='view'){const x=R('payslip',id);if(!x)return go('#/payslip');return docView(V,'payslip',x)}
  if(a==='new'||a==='edit'){
    if(!L('employee').length){V.innerHTML='<div class="note">Add an employee first. <a href="#/employee/new">New employee</a></div>';return}
    const wages=(accounts().find(x=>x.name==='Salaries & wages')||{}).id;
    const p=a==='edit'?R('payslip',id):{date:today(),ref:nextRef('payslip'),employee:'',desc:'',earnings:[{desc:'Basic salary',account:wages?'acc:'+wages:'',amount:''}],deductions:[]};if(!p)return go('#/payslip');
    let e1,e2;const net=()=>{$('#tNet').textContent=fmt(sumLines(e1?e1.read():[])-sumLines(e2?e2.read():[]))};
    return formPage(V,{title:`${a==='new'?'New':'Edit'} payslip`,type:'payslip',isNew:a==='new',rec:p,extraBtns:a==='edit'?`<a class="btn" href="#/payslip/view/${p.id}">View</a>`:'',after:row=>`#/payslip/view/${row.id}`,
      body:`<div class="grid">${fld('Employee',`<select id="fEmp">${optList(L('employee'),p.employee,'Select…')}</select>`)}${fld('Date',inp('fDate',p.date,'type="date"'))}${fld('Reference',inp('fRef',p.ref))}${fld('Pay period / description',inp('fDesc',p.desc,'placeholder="e.g. October 2026"'))}</div>
        <h2 style="margin-top:18px">Earnings</h2><div id="earn"></div><h2 style="margin-top:18px">Deductions</h2><div id="ded"></div>
        <div class="totals"><span><b style="font-family:var(--body)">Net pay</b></span><b id="tNet">0.00</b></div>`,
      onRender:()=>{e1=LineEditor($('#earn'),[{k:'desc',h:'Description'},{k:'account',h:'Expense account',t:'select',w:'34%',ignoreEmpty:true,opts:v=>acctOptions(v,{groups:['expense']})},{k:'amount',h:'Amount',t:'num',w:'130px'}],p.earnings,{onChange:net});
        e2=LineEditor($('#ded'),[{k:'desc',h:'Description'},{k:'account',h:'Account (e.g. tax or advance)',t:'select',w:'34%',ignoreEmpty:true,opts:v=>acctOptions(v,{sub:true,groups:['liability','asset','expense']})},{k:'amount',h:'Amount',t:'num',w:'130px'}],p.deductions,{onChange:net});net()},
      read:()=>{need(val('fEmp'),'Choose an employee');const E=e1.read(),Dd=e2.read();need(E.length,'Add at least one earning');
        E.concat(Dd).forEach(l=>{need(l.account,'Choose an account on every line');need(+l.amount,'Enter an amount on every line');l.amount=r2(l.amount)});
        return {employee:val('fEmp'),date:val('fDate'),ref:val('fRef'),desc:val('fDesc'),earnings:E,deductions:Dd}}});
  }
  listPage(V,{title:'Payslips',type:'payslip',newLabel:'New payslip',rows:[...L('payslip')].sort((x,y)=>y.date.localeCompare(x.date)),onRow:id=>go('#/payslip/view/'+id),
    cols:[{h:'Date',f:p=>fmtD(p.date),cls:'mono'},{h:'Reference',f:p=>esc(p.ref),cls:'mono'},{h:'Employee',f:p=>esc(nm(R('employee',p.employee)))},{h:'Period',f:p=>esc(p.desc),cls:'muted'},
      {h:'Gross',num:true,f:p=>fmt(sumLines(p.earnings)),sum:p=>sumLines(p.earnings)},{h:'Deductions',num:true,f:p=>fmt(sumLines(p.deductions)),sum:p=>sumLines(p.deductions)},{h:'Net pay',num:true,f:p=>fmt(sumLines(p.earnings)-sumLines(p.deductions)),sum:p=>sumLines(p.earnings)-sumLines(p.deductions)}]});
}

/* ---------- Expense claims ---------- */
function vExpenseClaim(V,r,a,id){
  if(a==='new'||a==='edit'){
    if(!L('employee').length){V.innerHTML='<div class="note">Expense claims are paid back to employees. Add an employee first. <a href="#/employee/new">New employee</a></div>';return}
    const x=a==='edit'?R('expenseclaim',id):{date:today(),ref:nextRef('expenseclaim'),payer:'',desc:'',lines:[]};if(!x)return go('#/expenseclaim');let ed;
    return formPage(V,{title:`${a==='new'?'New':'Edit'} expense claim`,type:'expenseclaim',isNew:a==='new',rec:x,
      body:`<div class="grid">${fld('Paid by (employee)',`<select id="fPayer">${optList(L('employee'),x.payer,'Select…')}</select>`)}${fld('Date',inp('fDate',x.date,'type="date"'))}${fld('Reference',inp('fRef',x.ref))}${fld('Description',inp('fDesc',x.desc))}</div><div id="lines"></div><div class="totals"><span>Total</span><b id="tTot">0.00</b></div>`,
      onRender:()=>{ed=LineEditor($('#lines'),[{k:'account',h:'Account',t:'select',w:'34%',opts:v=>acctOptions(v,{groups:['expense','asset']})},{k:'desc',h:'Description'},...projectCol(),{k:'amount',h:'Amount',t:'num',w:'130px'}],x.lines,{onChange:l=>$('#tTot').textContent=fmt(sumLines(l))})},
      read:()=>{need(val('fPayer'),'Choose who paid');const lines=ed.read();need(lines.length,'Add at least one line');lines.forEach(l=>{need(l.account,'Choose an account on every line');need(+l.amount,'Enter an amount');l.amount=r2(l.amount)});
        return {payer:val('fPayer'),date:val('fDate'),ref:val('fRef'),desc:val('fDesc'),lines}}});
  }
  listPage(V,{title:'Expense Claims',type:'expenseclaim',newLabel:'New expense claim',rows:[...L('expenseclaim')].sort((x,y)=>y.date.localeCompare(x.date)),
    cols:[{h:'Date',f:x=>fmtD(x.date),cls:'mono'},{h:'Reference',f:x=>esc(x.ref),cls:'mono'},{h:'Paid by',f:x=>esc(nm(R('employee',x.payer)))},{h:'Description',f:x=>esc(x.desc),cls:'muted'},{h:'Amount',num:true,f:x=>fmt(sumLines(x.lines)),sum:x=>sumLines(x.lines)}]});
}

/* ---------- Fixed assets & depreciation ---------- */
function vFixedAsset(V,r,a,id){
  if(a==='new'||a==='edit'){
    const f=a==='edit'?R('fixedasset',id):{name:'',code:'',desc:''};if(!f)return go('#/fixedasset');
    return formPage(V,{title:`${a==='new'?'New':'Edit'} fixed asset`,type:'fixedasset',isNew:a==='new',rec:f,
      body:`<div class="grid">${fld('Name',inp('fName',f.name,'required'))}${fld('Code',inp('fCode',f.code))}${fld('Description',`<textarea id="fDesc">${esc(f.desc)}</textarea>`,'span2')}</div><p class="muted small">Record the purchase as a payment (or journal) to the account “Fixed assets, at cost – ${esc(f.name||'this asset')}”. Record wear and tear under Depreciation Entries.</p>`,
      read:()=>{need(val('fName'),'Enter a name');return {name:val('fName'),code:val('fCode'),desc:$('#fDesc').value}},
      deleteCheck:()=>usedKey('fa:'+id)||usedKey('fad:'+id)?'This asset has transactions and cannot be deleted.':''});
  }
  const bs=sums(null,null);
  listPage(V,{title:'Fixed Assets',type:'fixedasset',newLabel:'New fixed asset',rows:[...L('fixedasset')].sort(byCode),
    cols:[{h:'Code',f:f=>esc(f.code||''),cls:'mono muted'},{h:'Name',f:f=>esc(f.name)},{h:'Cost',num:true,f:f=>`<a href="${ledgerHref('fa:'+f.id)}">${fmt(bs['fa:'+f.id]||0)}</a>`,sum:f=>bs['fa:'+f.id]||0},
      {h:'Accumulated depreciation',num:true,f:f=>`<a href="${ledgerHref('fad:'+f.id)}">${fmt(-(bs['fad:'+f.id]||0))}</a>`,sum:f=>-(bs['fad:'+f.id]||0)},{h:'Book value',num:true,f:f=>fmt((bs['fa:'+f.id]||0)+(bs['fad:'+f.id]||0)),sum:f=>(bs['fa:'+f.id]||0)+(bs['fad:'+f.id]||0)}]});
}
function vDepreciation(V,r,a,id){
  if(a==='new'||a==='edit'){
    if(!L('fixedasset').length){V.innerHTML='<div class="note">Add a fixed asset first. <a href="#/fixedasset/new">New fixed asset</a></div>';return}
    const x=a==='edit'?R('depreciation',id):{date:today(),ref:nextRef('depreciation'),desc:'',lines:[]};if(!x)return go('#/depreciation');let ed;
    return formPage(V,{title:`${a==='new'?'New':'Edit'} depreciation entry`,type:'depreciation',isNew:a==='new',rec:x,
      body:`<div class="grid">${fld('Date',inp('fDate',x.date,'type="date"'))}${fld('Reference',inp('fRef',x.ref))}${fld('Description',inp('fDesc',x.desc),'span2')}</div><div id="lines"></div><div class="totals"><span>Total</span><b id="tTot">0.00</b></div>`,
      onRender:()=>{ed=LineEditor($('#lines'),[{k:'asset',h:'Fixed asset',t:'select',opts:v=>optList(L('fixedasset'),v,'Select…')},{k:'amount',h:'Depreciation amount',t:'num',w:'160px'}],x.lines,{onChange:l=>$('#tTot').textContent=fmt(sumLines(l))})},
      read:()=>{const lines=ed.read();need(lines.length,'Add at least one line');lines.forEach(l=>{need(l.asset,'Choose a fixed asset');need(+l.amount,'Enter an amount');l.amount=r2(l.amount)});return {date:val('fDate'),ref:val('fRef'),desc:val('fDesc'),lines}}});
  }
  listPage(V,{title:'Depreciation Entries',type:'depreciation',newLabel:'New depreciation entry',rows:[...L('depreciation')].sort((x,y)=>y.date.localeCompare(x.date)),
    cols:[{h:'Date',f:x=>fmtD(x.date),cls:'mono'},{h:'Reference',f:x=>esc(x.ref),cls:'mono'},{h:'Description',f:x=>esc(x.desc)},{h:'Assets',f:x=>esc((x.lines||[]).map(l=>nm(R('fixedasset',l.asset))).join(', ')),cls:'muted'},{h:'Amount',num:true,f:x=>fmt(sumLines(x.lines)),sum:x=>sumLines(x.lines)}]});
}

/* ---------- Journal entries ---------- */
function vJournal(V,r,a,id){
  if(a==='new'||a==='edit'){
    const j=a==='edit'?R('journal',id):{date:today(),ref:nextRef('journal'),narration:'',lines:[]};if(!j)return go('#/journal');let ed;
    return formPage(V,{title:`${a==='new'?'New':'Edit'} journal entry`,type:'journal',isNew:a==='new',rec:j,
      body:`<div class="grid">${fld('Date',inp('fDate',j.date,'type="date"'))}${fld('Reference',inp('fRef',j.ref))}${fld('Narration',inp('fNar',j.narration),'span2')}</div><div id="lines"></div>
        <div class="totals"><span>Debits</span><b id="tD">0.00</b><span>Credits</span><b id="tC">0.00</b><span></span><span id="tDiff" class="small" style="text-align:right"></span></div>`,
      onRender:()=>{ed=LineEditor($('#lines'),[{k:'account',h:'Account',t:'select',w:'36%',opts:v=>acctOptions(v,{banks:true,sub:true,inv:true})},{k:'desc',h:'Description'},...projectCol(),{k:'debit',h:'Debit',t:'num',w:'120px'},{k:'credit',h:'Credit',t:'num',w:'120px'}],j.lines,{min:2,
        onChange:ls=>{const d=sumLines(ls,'debit'),c=sumLines(ls,'credit');$('#tD').textContent=fmt(d);$('#tC').textContent=fmt(c);$('#tDiff').innerHTML=r2(d-c)?`<span class="neg">Out of balance by ${fmt(Math.abs(d-c))}</span>`:'<span class="ok">Balanced</span>'}})},
      read:()=>{const lines=ed.read();need(lines.length>=2,'A journal entry needs at least two lines');lines.forEach(l=>{need(l.account,'Choose an account on every line');l.debit=r2(l.debit);l.credit=r2(l.credit)});
        const d=sumLines(lines,'debit'),c=sumLines(lines,'credit');need(d>0&&r2(d-c)===0,'Debits and credits must be equal');return {date:val('fDate'),ref:val('fRef'),narration:val('fNar'),lines}}});
  }
  listPage(V,{title:'Journal Entries',type:'journal',newLabel:'New journal entry',rows:[...L('journal')].sort((x,y)=>y.date.localeCompare(x.date)),
    cols:[{h:'Date',f:j=>fmtD(j.date),cls:'mono'},{h:'Reference',f:j=>esc(j.ref),cls:'mono'},{h:'Narration',f:j=>esc(j.narration)},{h:'Accounts',f:j=>esc([...new Set((j.lines||[]).map(l=>keyName(l.account)))].join(', ')),cls:'muted'},{h:'Amount',num:true,f:j=>fmt(sumLines(j.lines,'debit'))}]});
}

/* ---------- Chart of accounts ---------- */
function vAccount(V,r,a,id){
  if(a==='new'||a==='edit'){
    const sys=SYS.find(s=>s.id===id);if(sys){V.innerHTML=`<div class="note">“${esc(sys.name)}” is a built-in account and cannot be changed. <a href="#/account">Back</a></div>`;return}
    const ac=a==='edit'?R('account',id):{name:'',code:'',group:'expense'};if(!ac)return go('#/account');
    return formPage(V,{title:`${a==='new'?'New':'Edit'} account`,type:'account',isNew:a==='new',rec:ac,
      body:`<div class="grid">${fld('Name',inp('fName',ac.name,'required'))}${fld('Code',inp('fCode',ac.code))}${fld('Group',`<select id="fGroup">${Object.entries(GROUPS).map(([k,v])=>`<option value="${k}" ${ac.group===k?'selected':''}>${v}</option>`).join('')}</select>`)}</div>`,
      read:()=>{need(val('fName'),'Enter a name');return {name:val('fName'),code:val('fCode'),group:val('fGroup')}},
      deleteCheck:()=>usedKey('acc:'+id)||L('item').some(i=>i.incomeAccount==='acc:'+id||i.expenseAccount==='acc:'+id)?'This account is in use and cannot be deleted.':''});
  }
  const bs=sums(null,null);
  V.innerHTML=`<div class="head"><h1>Chart of Accounts</h1><div class="tools">${canWrite('account')?'<a class="btn primary" href="#/account/new">+ New account</a>':''}</div></div>
  <div class="card scroll"><table><thead><tr><th style="width:60px"></th><th style="width:90px">Code</th><th>Account</th><th class="num">Balance (${esc(setting('currency'))})</th></tr></thead><tbody>
  ${Object.entries(GROUPS).map(([g,label])=>{const s=creditNormal(g)?-1:1;return `<tr><td colspan="4" class="sec">${label}</td></tr>`+accounts().filter(x=>x.group===g).map(x=>`<tr class="click" data-k="acc:${x.id}"><td>${!x.sys&&canWrite('account')?`<a href="#/account/edit/${x.id}">Edit</a>`:''}</td><td class="mono muted">${esc(x.code||'')}</td><td>${esc(x.name)}${x.sys?' <span class="tag">built-in</span>':''}</td><td class="num">${fmt(s*(bs['acc:'+x.id]||0))}</td></tr>`).join('')}).join('')}
  </tbody></table></div><p class="muted small">Bank accounts, customers, suppliers, employees, inventory, tax and fixed assets have their own control accounts and appear on the Summary automatically.</p>`;
  $$('tr.click').forEach(tr=>tr.onclick=e=>{if(!e.target.closest('a'))go(ledgerHref(tr.dataset.k))});
}

/* ---------- Tax codes ---------- */
function vTaxcode(V,r,a,id){
  if(a==='new'||a==='edit'){
    const t=a==='edit'?R('taxcode',id):{name:'',rate:''};if(!t)return go('#/taxcode');
    return formPage(V,{title:`${a==='new'?'New':'Edit'} tax code`,type:'taxcode',isNew:a==='new',rec:t,
      body:`<div class="grid">${fld('Name (e.g. KDV 20%)',inp('fName',t.name,'required'))}${fld('Rate %',inp('fRate',t.rate,'type="number" step="any" class="num"'))}</div>`,
      read:()=>{need(val('fName'),'Enter a name');return {name:val('fName'),rate:+val('fRate')||0}},
      deleteCheck:()=>usedKey('tax:'+id)||['quote','purchaseorder'].some(x=>L(x).some(d=>(d.lines||[]).some(l=>l.tax===id)))?'This tax code is in use and cannot be deleted.':''});
  }
  const bs=sums(null,null);
  listPage(V,{title:'Tax Codes',type:'taxcode',newLabel:'New tax code',rows:L('taxcode'),onRow:id=>go(ledgerHref('tax:'+id)),
    cols:[{h:'',f:t=>canWrite('taxcode')?`<a href="#/taxcode/edit/${t.id}">Edit</a>`:''},{h:'Name',f:t=>esc(t.name)},{h:'Rate',num:true,f:t=>fmtQ(t.rate)+'%'},{h:'Tax payable',num:true,f:t=>fmt(-(bs['tax:'+t.id]||0)),sum:t=>-(bs['tax:'+t.id]||0)}]});
}

/* ---------- image → small data URL (for the business logo) ---------- */
function shrinkImage(file,maxW,maxH){return new Promise((res,rej)=>{if(!/^image\//.test(file.type))return rej(new Error('Choose a PNG or JPG image'));
  const fr=new FileReader();fr.onerror=()=>rej(new Error('Could not read the image'));fr.onload=()=>{const im=new Image();im.onerror=()=>rej(new Error('Could not read the image'));
    im.onload=()=>{const k=Math.min(1,maxW/im.width,maxH/im.height),w=Math.max(1,Math.round(im.width*k)),h=Math.max(1,Math.round(im.height*k));const c=document.createElement('canvas');c.width=w;c.height=h;
      const x=c.getContext('2d');x.drawImage(im,0,0,w,h);let url=c.toDataURL('image/png');if(url.length>180000){x.globalCompositeOperation='destination-over';x.fillStyle='#fff';x.fillRect(0,0,w,h);url=c.toDataURL('image/jpeg',.85)}
      if(url.length>300000)return rej(new Error('That image is too large. Try a smaller one.'));res(url)};im.src=fr.result};fr.readAsDataURL(file)})}

/* ---------- Settings ---------- */
function vSettings(V){
  const b=S.biz,st=b.settings||{},ad=canAdmin(),slug=b.name.replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')||'business';
  V.innerHTML=`<div class="head"><h1>Settings</h1></div><div class="stack">
  <form class="card pad" id="sf"><h2>Business details</h2><div class="grid">
    ${fld('Business name',inp('sName',b.name,'required'))}${fld('Base currency',inp('sCur',st.currency,'maxlength="5"'))}${fld('Start date of books',inp('sStart',st.startDate,'type="date"'))}
    ${fld('Lock date (no changes on or before)',inp('sLock',st.lockDate||'','type="date"'))}${fld('Phone',inp('sPhone',st.phone))}${fld('Email',inp('sEmail',st.email))}${fld('Tax number',inp('sTax',st.taxNumber))}
    ${fld('Address (printed on documents)',`<textarea id="sAddr">${esc(st.address||'')}</textarea>`,'span2')}
    ${fld('Default invoice notes (e.g. bank details)',`<textarea id="sFoot">${esc(st.invoiceFooter||'')}</textarea>`,'span2')}</div>
    ${ad?'<div class="actions"><div><button class="btn primary" type="submit">Save details</button></div></div>':'<p class="meta">Only administrators can change business details.</p>'}</form>
  <div class="card pad"><h2>Business logo</h2><p class="muted" style="margin-top:0">Shown at the top of invoices, receipts, ticket receipts and other printed documents.</p>
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div class="logobox">${st.logo?`<img src="${esc(st.logo)}" alt="">`:'<span class="muted small">No logo</span>'}</div>
    ${ad?`<div style="display:flex;gap:8px;flex-wrap:wrap"><label class="btn"><input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp" hidden><span>Choose image</span></label>${st.logo?'<button class="btn danger" type="button" id="logoDel">Remove</button>':''}</div>`:''}</div></div>
  <div class="card pad" id="wsCard"><h2>Company address</h2><p class="muted" style="margin-top:0">Your own sign-in page with your logo and name. Staff who open it go straight into this business.</p>
    ${b.slug?`<div class="wslink"><span class="mono">${esc(wsUrl(b.slug))}</span><button class="btn sm" type="button" id="wsCopy">Copy link</button><a class="btn sm" href="${esc(siteRoot()+'/'+b.slug)}" target="_blank" rel="noopener">Open</a></div>`:''}
    ${ad&&!planOk('address')&&!b.slug?`<p class="note" style="margin:8px 0 0">A company address is included in the Basic and Pro plans. <a href="#/billing">See plans</a></p>`:''}
    ${ad&&(planOk('address')||b.slug)?`<form id="wsForm" style="margin-top:12px"><label class="f">Address<div class="wsin"><span class="mono">${esc(wsUrl(''))}</span><input id="wsSlug" value="${esc(b.slug||'')}" maxlength="40" autocomplete="off" spellcheck="false" placeholder="${esc(slugify(b.name)||'your-company')}"></div></label>
      <div class="muted small" id="wsMsg">Small English letters, numbers and dashes. For example: ${esc(slugify(b.name)||'falak-travel')}</div>
      <div class="actions" style="justify-content:flex-start"><div><button class="btn primary" type="submit">Save address</button>${b.slug?'<button class="btn danger" type="button" id="wsDel">Remove address</button>':''}</div></div></form>
      <p class="muted small" style="margin-bottom:0">If you change the address, the old link stops working. Send the new link to your staff.</p>`:''}</div>
  <div class="card pad"><h2>Footers</h2><p class="muted" style="margin-top:0">Text printed at the bottom of documents, for example bank details, terms or a thank-you note.</p>
    <div id="ftList"></div>${ad?'<div class="actions" style="justify-content:flex-start"><div><button class="btn" type="button" id="ftAdd">+ Add footer</button><button class="btn primary" type="button" id="ftSave">Save footers</button></div></div>':''}</div>
  ${cfSettingsCard(ad)}
  <div class="card pad"><h2>Lists</h2><div class="tiles">
    <a class="card tile" href="#/account"><b>Chart of accounts</b><span>${L('account').length+SYS.length} accounts</span></a>
    <a class="card tile" href="#/taxcode"><b>Tax codes</b><span>${L('taxcode').length} tax codes</span></a>
    <a class="card tile" href="#/currency"><b>Currencies</b><span>${L('currency').length} foreign currencies</span></a>
    <a class="card tile" href="#/project"><b>Projects</b><span>${L('project').length} projects</span></a>
    ${ad?`<a class="card tile" href="#/users"><b>Users & access</b><span>Who can sign in to this business</span></a>`:''}
    ${ad?`<a class="card tile" href="#/customize"><b>Customize tabs</b><span>Choose which tabs appear in the menu</span></a>`:''}</div></div>
  <div class="card pad"><h2>Backup</h2><p class="muted" style="margin-top:0">Your books are stored online and shared with your team. You can still download a copy for safekeeping or to move it to another account.</p>
    <div class="actions" style="margin-top:0;justify-content:flex-start"><div><button class="btn" type="button" id="bk">Download backup</button><button class="btn" type="button" id="bkShow">Show backup text</button></div></div>
    <div id="bkBox" hidden style="margin-top:12px"><textarea class="code" id="bkText" readonly></textarea><button class="btn" type="button" id="bkCopy" style="margin-top:8px">Copy</button></div></div>
  ${S.role==='owner'?`<div class="card pad"><h2>Delete business</h2><p class="muted" style="margin-top:0">Deletes this business and all its transactions for everyone.</p><button class="btn danger" type="button" id="delBiz">Delete ${esc(b.name)}</button></div>`:''}</div>`;
  if(!ad)$$('#sf input,#sf textarea').forEach(x=>x.disabled=true);
  const saveSettings=async(patch,msg)=>{const settings=Object.assign({},b.settings||{},patch);
    try{await API.updateBusiness(b.id,{name:b.name,settings});b.settings=settings;S.ver++;toast(msg||'Saved');router()}catch(x){toast('Could not save: '+x.message)}};
  const lf=$('#logoFile');if(lf)lf.onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const url=await shrinkImage(f,480,200);saveSettings({logo:url},'Logo saved')}catch(x){toast(x.message)}};
  const ldl=$('#logoDel');if(ldl)ldl.onclick=()=>saveSettings({logo:''},'Logo removed');
  const wc=$('#wsCopy');if(wc)wc.onclick=()=>copyText(siteRoot()+'/'+b.slug);
  const wf=$('#wsForm');if(wf){const wi=$('#wsSlug'),wm=$('#wsMsg');
    wi.oninput=()=>{const c=wi.value.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/-{2,}/g,'-').replace(/^-/,'');if(c!==wi.value)wi.value=c;wm.className='muted small'};
    const saveSlug=async slug=>{try{await API.updateBusiness(b.id,{slug});b.slug=slug;S.ver++;toast(slug?'Company address saved':'Company address removed');router()}
      catch(x){if(/duplicate|unique|slug_key/i.test(x.message)){wm.className='neg small';wm.textContent=lookupOr('This address is already taken. Try another one.')}
        else if(/slug_format/i.test(x.message)){wm.className='neg small';wm.textContent=lookupOr('Use 3 to 40 small English letters, numbers or dashes.')}
        else if(/slug/i.test(x.message)){wm.className='neg small';wm.textContent=lookupOr('Company addresses are not switched on yet. Run step 6 in Supabase first.')+' ('+x.message+')';console.warn('Company address save failed:',x.message)}else toast('Could not save: '+x.message)}};
    wf.onsubmit=async e=>{e.preventDefault();const v=slugify(wi.value);wi.value=v;
      if(!slugOk(v)){wm.className='neg small';wm.textContent=RESERVED_SLUGS.includes(v)?lookupOr('This address is reserved. Try another one.'):lookupOr('Use 3 to 40 small English letters, numbers or dashes.');return}
      if(v===b.slug){toast('Saved');return}
      let free=true;try{free=await API.slugFree(v,b.id)}catch(x){}
      if(!free){wm.className='neg small';wm.textContent=lookupOr('This address is already taken. Try another one.');return}
      saveSlug(v)};
    const wd=$('#wsDel');if(wd)wd.onclick=()=>confirmBox(lookupOr('Remove the company address? The link will stop working.'),()=>saveSlug(null),lookupOr('Remove'))}
  let fts=JSON.parse(JSON.stringify(st.footers||[]));
  const ftRender=()=>{$('#ftList').innerHTML=fts.map((f,i)=>`<div class="ftitem" data-i="${i}"><div class="grid">${fld('Name',inp('ftN'+i,f.name,'placeholder="e.g. Bank details"'))}</div>
      ${fld('Text',`<textarea id="ftT${i}">${esc(f.text||'')}</textarea>`)}<div class="muted small" style="margin-top:8px">Show on</div>
      <div class="perm">${FOOTER_KINDS.map(([k,l])=>`<label class="c"><input type="checkbox" data-k="${k}" ${(f.on||[]).includes(k)?'checked':''}> ${l}</label>`).join('')}</div>
      ${ad?`<button class="btn danger sm" type="button" data-del="${i}" style="margin-top:8px">Remove footer</button>`:''}</div>`).join('')||'<p class="muted small">No footers yet.</p>';
    if(!ad)$$('#ftList input,#ftList textarea').forEach(x=>x.disabled=true);
    $$('#ftList [data-del]').forEach(x=>x.onclick=()=>{ftRead();fts.splice(+x.dataset.del,1);ftRender()})};
  const ftRead=()=>{fts=fts.map((f,i)=>({id:f.id||newId(),name:val('ftN'+i),text:$('#ftT'+i).value,on:$$(`.ftitem[data-i="${i}"] input[data-k]:checked`).map(c=>c.dataset.k)}))};
  ftRender();
  cfSettingsBind(ad,saveSettings);
  const fa=$('#ftAdd');if(fa)fa.onclick=()=>{ftRead();fts.push({id:newId(),name:'',text:'',on:FOOTER_KINDS.map(k=>k[0])});ftRender()};
  const fsv=$('#ftSave');if(fsv)fsv.onclick=()=>{ftRead();saveSettings({footers:fts.filter(f=>f.text.trim()||f.name.trim())},'Footers saved')};
  $('#sf').onsubmit=async e=>{e.preventDefault();if(!ad)return;const settings=Object.assign({},b.settings||{},{currency:val('sCur').toUpperCase()||'USD',startDate:val('sStart')||st.startDate,lockDate:val('sLock'),phone:val('sPhone'),email:val('sEmail'),taxNumber:val('sTax'),address:$('#sAddr').value,invoiceFooter:$('#sFoot').value});
    try{await API.updateBusiness(b.id,{name:val('sName'),settings});b.name=val('sName');b.settings=settings;S.ver++;toast('Saved');router()}catch(x){toast('Could not save: '+x.message)}};
  const dump=()=>JSON.stringify({app:'falak.io',version:2,name:b.name,settings:b.settings,exported:nowIso(),records:[...S.rows.values()].map(r=>({id:r.id,type:r.type,data:r.data}))});
  $('#bk').onclick=()=>download(`${slug}-${today()}.json`,dump());
  $('#bkShow').onclick=()=>{$('#bkBox').hidden=false;$('#bkText').value=dump()};
  $('#bkCopy').onclick=()=>{const t=$('#bkText');navigator.clipboard.writeText(t.value).then(()=>toast('Copied'),()=>{t.select();toast('Press Ctrl+C / Cmd+C to copy')})};
  const db=$('#delBiz');if(db)db.onclick=()=>confirmBox(`Delete ${b.name} and all its data for everyone?`,async()=>{try{await API.deleteBusiness(b.id);closeBusiness();ls.set('falak_last','');toast('Business deleted');go('#/businesses')}catch(x){toast('Could not delete: '+x.message)}});
}

/* ---------- Users & access ---------- */
async function vUsers(V,r,a,id){
  if(!canAdmin()){V.innerHTML='<div class="note">Only administrators can manage users.</div>';return}
  V.innerHTML='<div class="loading">Loading users…</div>';
  const list=await API.listMembers(S.biz.id);
  const tabsLabel=m=>m.role==='user'?(m.tabs||[]).map(t=>TITLES[t]||t).join(', ')||'No tabs':(m.role==='viewer'?'Can view everything, change nothing':'Full access');
  const form=m=>`<form class="card pad" id="mf"><h2>${m.id?'Edit access for '+esc(m.email):'Add a user'}</h2><div class="grid">
    ${fld('Email address',inp('mEmail',m.email,`type="email" required ${m.id?'disabled':''}`))}
    ${fld('Access level',`<select id="mRole">${['admin','user','viewer'].concat(m.role==='owner'?['owner']:[]).map(x=>`<option value="${x}" ${m.role===x?'selected':''}>${ROLE_LABEL[x]}</option>`).join('')}</select>`)}</div>
    <div id="tabBox" ${m.role==='user'?'':'hidden'} style="margin-top:14px"><div class="muted small">Tabs this user can open and change</div><div class="perm">${RECORD_TABS.map(t=>`<label class="c"><input type="checkbox" value="${t}" ${(m.tabs||[]).includes(t)?'checked':''}> ${TITLES[t]}</label>`).join('')}</div></div>
    <div class="actions"><div><button class="btn primary" type="submit">${m.id?'Update':'Add user'}</button><button class="btn" type="button" id="mCancel">Cancel</button></div>${m.id&&m.role!=='owner'?'<div><button class="btn danger" type="button" id="mDel">Remove access</button></div>':''}</div></form>`;
  const ulim=S.plan&&!S.plan.super?(S.plan.state==='expired'?-1:S.plan.users_limit||0):0,full=ulim<0||(ulim>0&&list.length>=ulim);
  V.innerHTML=`<div class="head"><h1>Users & Access</h1><div class="tools"><button class="btn primary" type="button" id="addU" ${full?'disabled':''}>+ Add user</button></div></div>
  ${full?`<p class="note">${ulim<0?'Your plan has ended. Choose a plan before adding users.':`Your plan allows ${ulim} ${ulim===1?'user':'users'}.`} <a href="#/billing">See plans</a></p>`:''}
  <div id="formBox"></div>
  <div class="card scroll"><table><thead><tr><th>Email</th><th>Access level</th><th>What they can use</th><th>Added</th></tr></thead><tbody>
  ${list.map(m=>`<tr class="click" data-id="${m.id}"><td>${esc(m.email)}${m.email===API.user.email?' <span class="tag">you</span>':''}</td><td>${ROLE_LABEL[m.role]}</td><td class="muted">${esc(tabsLabel(m))}</td><td class="mono muted">${fmtD(m.created_at)}</td></tr>`).join('')}</tbody></table></div>
  ${S.biz.slug?`<div class="card pad" style="margin-top:18px"><h2>Your staff sign-in link</h2><div class="wslink"><span class="mono">${esc(wsUrl(S.biz.slug))}</span><button class="btn sm" type="button" id="wsCopyU">Copy link</button><a class="btn sm" id="wsWa" href="https://wa.me/?text=${encodeURIComponent(lookupOr('Sign in to')+' '+S.biz.name+': '+siteRoot()+'/'+S.biz.slug)}" target="_blank" rel="noopener">Send on WhatsApp</a></div></div>`
    :`<p class="muted small" style="margin-top:14px"><span>Tip: give your business its own sign-in page with your logo and name.</span> <a href="#/settings">Set a company address</a></p>`}
  <div class="card pad" style="margin-top:18px"><h2>How your staff sign in</h2><ol class="muted" style="margin:0;padding-left:18px;line-height:1.8"><li>Add their email here and choose what they may use.</li><li>Send them ${S.biz.slug?'your sign-in link above':'the Falak Hesab link'}. They choose <b>Create a free account</b> with the same email and set their own password.</li><li>After confirming their email they sign in and see this business. Changes appear for everyone straight away.</li></ol></div>`;
  const open=m=>{$('#formBox').innerHTML=form(m);$('#formBox').scrollIntoView({block:'nearest'});
    $('#mRole').onchange=()=>$('#tabBox').hidden=val('mRole')!=='user';$('#mCancel').onclick=()=>$('#formBox').innerHTML='';
    $('#mf').onsubmit=async e=>{e.preventDefault();const email=m.id?m.email:val('mEmail').toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email)){toast('Enter a valid email');return}
      try{await API.saveMember(S.biz.id,{id:m.id,email,role:val('mRole'),tabs:$$('#tabBox input:checked').map(i=>i.value)});toast(m.id?'Access updated':'User added');router()}catch(x){toast(/duplicate/i.test(x.message)?'That email already has access':'Could not save: '+x.message)}};
    const d=$('#mDel');if(d)d.onclick=()=>confirmBox(`Remove ${m.email} from ${S.biz.name}?`,async()=>{try{await API.removeMember(m.id);toast('Access removed');router()}catch(x){toast('Could not remove: '+x.message)}},'Remove')};
  const wcu=$('#wsCopyU');if(wcu)wcu.onclick=()=>copyText(siteRoot()+'/'+S.biz.slug);
  $('#addU').onclick=()=>open({email:'',role:'user',tabs:['receipt','payment','salesinvoice','customer']});
  $$('tr.click').forEach(tr=>tr.onclick=()=>open(list.find(m=>m.id===tr.dataset.id)));
}
