/* ================= Falak Hesab — views: summary, ledger, money, sales & purchases ================= */
const VIEWABLE=['receipt','payment','quote','salesorder','salesinvoice','creditnote','purchaseorder','purchaseinvoice','debitnote','payslip','deliverynote','goodsreceipt','ticket','exchange','hawala'];
const srcLink=(type,id)=>type==='bank'?`#/bank/edit/${id}`:`#/${type}/${VIEWABLE.includes(type)?'view':'edit'}/${id}`;
const SRC_LABEL={bank:'Opening balance',receipt:'Receipt',payment:'Payment',transfer:'Transfer',salesinvoice:'Sales invoice',creditnote:'Credit note',purchaseinvoice:'Purchase invoice',debitnote:'Debit note',payslip:'Payslip',expenseclaim:'Expense claim',depreciation:'Depreciation',journal:'Journal entry',writeoff:'Inventory write-off',ticket:'Ticket',customer:'Starting balance',supplier:'Starting balance',exchange:'Currency exchange',hawala:'Hawala transfer',cashcount:'Cash count'};
const ledgerHref=key=>'#/ledger/view/'+encodeURIComponent(key);

function periodBar(){return `<form class="period noprint" id="per"><label class="f">From<input type="date" id="pFrom" value="${App.period.from}"></label><label class="f">To<input type="date" id="pTo" value="${App.period.to}"></label><button class="btn" type="submit">Apply</button></form>`}
function bindPeriod(){const f=$('#per');if(f)f.onsubmit=e=>{e.preventDefault();App.period.from=val('pFrom');App.period.to=val('pTo');router()}}
const sumPre=(m,pre)=>Object.keys(m).filter(k=>k.startsWith(pre)).reduce((s,k)=>s+m[k],0);
const money=(n,c)=>`${fmt(n)}${c?` <span class="muted small">${esc(c)}</span>`:''}`;

/* ---------- currency + exchange rate fields shared by forms ---------- */
function rateFields(cur,rate){
  return `<div id="fxBox" class="grid" ${foreign(cur)?'':'hidden'} style="margin-top:14px"><label class="f">Currency<input id="fCurShow" value="${esc(cur||'')}" disabled></label>
    <label class="f"><span>Exchange rate: 1 <span id="fxC">${esc(cur||'')}</span> = ? ${esc(BASE())}</span><input id="fRate" type="number" step="any" class="num" value="${esc(rate||curRate(cur))}"></label></div>`;
}
function setRateCur(cur){const box=$('#fxBox');if(!box)return;const f=foreign(cur);box.hidden=!f;$('#fCurShow').value=f;$('#fxC').textContent=f;if(f)$('#fRate').value=curRate(f);const tc=$('#tCur');if(tc)tc.textContent=curLabel(f)}
const readRate=cur=>foreign(cur)?(+val('fRate')||curRate(cur)):'';

/* ---------- Summary ---------- */
function vSummary(V){
  const {from,to}=App.period,bs=sums(null,to),pl=sums(from,to);
  const row=(label,v,href)=>`<div class="row" data-h="${href||''}"><span>${esc(label)}</span>${num(v)}</div>`;
  const accRows=(g,m,sign,skipRe)=>accounts().filter(a=>a.group===g&&!(skipRe&&a.id==='re')).map(a=>({l:a.name,v:sign*(m['acc:'+a.id]||0),h:ledgerHref('acc:'+a.id)})).filter(x=>r2(x.v)!==0);
  const banks=L('bank').sort(byCode);
  const assets=[],liab=[],eq=[];
  banks.filter(k=>k.type!=='cash').forEach(k=>assets.push({sec:'Cash at bank',l:k.name,v:bs['bank:'+k.id]||0,h:ledgerHref('bank:'+k.id)}));
  banks.filter(k=>k.type==='cash').forEach(k=>assets.push({sec:'Cash on hand',l:k.name,v:bs['bank:'+k.id]||0,h:ledgerHref('bank:'+k.id)}));
  const pos=(pre,sg)=>Object.keys(bs).filter(k=>k.startsWith(pre)).reduce((q,k)=>q+Math.max(0,sg*bs[k]),0);
  const ar=pos('ar:',1),arAdv=pos('ar:',-1),apAdv=pos('ap:',1),inv=sumPre(bs,'inv:'),fa=sumPre(bs,'fa:'),fad=sumPre(bs,'fad:');
  if(r2(ar))assets.push({sec:'Receivables',l:'Accounts receivable',v:ar,h:'#/customer'});
  if(r2(apAdv))assets.push({sec:'Receivables',l:'Advances to suppliers and deposits',v:apAdv,h:'#/reports/supplier-statements'});
  if(r2(inv))assets.push({sec:'Inventory',l:'Inventory on hand',v:inv,h:'#/item'});
  if(r2(fa)||r2(fad)){assets.push({sec:'Fixed assets',l:'Fixed assets, at cost',v:fa,h:'#/fixedasset'});assets.push({sec:'Fixed assets',l:'Accumulated depreciation',v:fad,h:'#/fixedasset'})}
  accRows('asset',bs,1).forEach(x=>assets.push({sec:'Other assets',...x}));
  const ap=pos('ap:',-1),emp=-sumPre(bs,'emp:');
  if(r2(ap))liab.push({l:'Accounts payable',v:ap,h:'#/supplier'});
  if(r2(arAdv))liab.push({l:'Customer advances and deposits',v:arAdv,h:'#/reports/statements'});
  L('taxcode').forEach(t=>{const v=-(bs['tax:'+t.id]||0);if(r2(v))liab.push({l:'Tax payable – '+t.name,v,h:ledgerHref('tax:'+t.id)})});
  if(r2(emp))liab.push({l:'Employee clearing accounts',v:emp,h:'#/employee'});
  accRows('liability',bs,-1).forEach(x=>liab.push(x));
  accRows('equity',bs,-1,true).forEach(x=>eq.push(x));
  let ret=0;accounts().filter(a=>a.id==='re'||a.group==='income'||a.group==='expense').forEach(a=>ret-=bs['acc:'+a.id]||0);
  eq.push({l:'Retained earnings',v:ret,h:ledgerHref('acc:re')});
  const tot=a=>a.reduce((s,x)=>s+x.v,0),TA=tot(assets),TL=tot(liab),TE=tot(eq);
  let lastSec='';const assetHtml=assets.map(x=>{const s=x.sec!==lastSec?`<div class="sec"><span>${x.sec}</span></div>`:'';lastSec=x.sec;return s+row(x.l,x.v,x.h)}).join('');
  const inc=accRows('income',pl,-1),exp=accRows('expense',pl,1),net=tot(inc)-tot(exp);
  const balanced=Math.abs(r2(TA-TL-TE))<0.005,due=dueRecurring();
  V.innerHTML=`<div class="head"><h1>Summary</h1>${periodBar()}</div>
  ${onboardHtml()||(L('bank').length?'':`<div class="note">Start by adding a bank or cash account. ${canWrite('bank')?'<a href="#/bank/new">Add bank or cash account</a>':''}</div>`)}
  ${due.length&&canWrite('salesinvoice')?`<div class="note"><b>${due.length}</b> <span>recurring invoices are ready to create.</span> <a href="#/recurringinvoice">Create them now</a></div>`:''}
  <div class="sheet">
   <div class="card"><h2>Balance sheet <span class="muted small" style="font-family:var(--body);font-weight:400">${fmtD(to)}</span></h2>
    ${assetHtml}<div class="row grand"><span>Total assets</span>${num(TA)}</div>
    <div class="sec"><span>Liabilities</span></div>${liab.map(x=>row(x.l,x.v,x.h)).join('')||'<div class="row muted" style="cursor:default">No liabilities</div>'}
    <div class="row sub"><span>Total liabilities</span>${num(TL)}</div>
    <div class="sec"><span>Equity</span></div>${eq.map(x=>row(x.l,x.v,x.h)).join('')}
    <div class="row sub"><span>Total equity</span>${num(TE)}</div>
    <div class="row grand"><span>Total liabilities & equity</span>${num(TL+TE)}</div>
    <div style="padding:8px 18px 14px" class="small ${balanced?'ok':'neg'}">${balanced?'✓ Balance sheet is in balance':'Balance sheet is out of balance'}</div></div>
   <div class="card"><h2>Profit and loss <span class="muted small" style="font-family:var(--body);font-weight:400">${fmtD(from)} – ${fmtD(to)}</span></h2>
    <div class="sec"><span>Income</span></div>${inc.map(x=>row(x.l,x.v,x.h)).join('')||'<div class="row muted" style="cursor:default">No income in this period</div>'}
    <div class="row sub"><span>Total income</span>${num(tot(inc))}</div>
    <div class="sec"><span>Expenses</span></div>${exp.map(x=>row(x.l,x.v,x.h)).join('')||'<div class="row muted" style="cursor:default">No expenses in this period</div>'}
    <div class="row sub"><span>Total expenses</span>${num(tot(exp))}</div>
    <div class="row grand"><span>${net>=0?'Net profit':'Net loss'}</span>${num(net)}</div></div>
  </div><p class="muted small">All amounts in ${esc(BASE())}.</p>`;
  bindPeriod();$$('.row[data-h]').forEach(r=>{if(r.dataset.h)r.onclick=()=>go(r.dataset.h)});
}

/* ---------- Ledger for any account ---------- */
function vLedger(V,r,a,key){
  if(!key)return go('#/summary');
  const g=keyGroup(key),sign=creditNormal(g)?-1:1,{from,to}=App.period,fc=masterCur(key);
  let P=postings().filter(p=>p.key===key).sort((x,y)=>x.date.localeCompare(y.date));
  const vOf=p=>fc?p.fx:p.amt;
  const opening=sign*P.filter(p=>p.date<from).reduce((s,p)=>s+vOf(p),0),openingB=sign*P.filter(p=>p.date<from).reduce((s,p)=>s+p.amt,0);
  P=P.filter(p=>p.date>=from&&p.date<=to);let run=opening,runB=openingB;
  const t=key.split(':')[0],mid=key.slice(t.length+1),mt=masterOf(key);
  const rows=P.map(p=>{run+=sign*vOf(p);runB+=sign*p.amt;const v=vOf(p);return `<tr class="click" data-h="${srcLink(p.type,p.id)}"><td class="mono">${fmtD(p.date)}</td><td>${SRC_LABEL[p.type]||p.type}</td><td class="mono">${esc(p.ref)}</td><td>${esc(p.contact)}${p.contact&&p.desc?' · ':''}<span class="muted">${esc(p.desc)}</span></td><td class="num">${v>0?fmt(v):''}</td><td class="num">${v<0?fmt(-v):''}</td><td class="num">${fmt(run)}</td>${fc?`<td class="num muted">${fmt(runB)}</td>`:''}</tr>`}).join('');
  const editHref=mt?(mt==='account'?`#/account/edit/${mid}`:`#/${mt}/edit/${mid}`):'';
  const tools=t==='bank'&&canWrite('bank')?`<a class="btn noprint" href="#/bank/reconcile/${mid}">Reconcile</a><a class="btn noprint" href="#/bank/import/${mid}">Import statement</a>`:'';
  V.innerHTML=`<div class="head"><div><a href="#" data-back class="noprint small">← Back</a><h1>${esc(keyName(key))}</h1><span class="muted">${GROUPS[g]}${fc?' · '+esc(fc):''}</span></div><div class="tools">${tools}${editHref&&canSee(mt)?`<a class="btn noprint" href="${editHref}">Edit details</a>`:''}${periodBar()}</div></div>
  <div class="card scroll"><table><thead><tr><th>Date</th><th>Transaction</th><th>Reference</th><th>Details</th><th class="num">Debit${fc?' '+esc(fc):''}</th><th class="num">Credit${fc?' '+esc(fc):''}</th><th class="num">Balance${fc?' '+esc(fc):''}</th>${fc?`<th class="num">Balance ${esc(BASE())}</th>`:''}</tr></thead>
  <tbody><tr><td colspan="6" class="muted">Opening balance</td><td class="num">${fmt(opening)}</td>${fc?`<td class="num muted">${fmt(openingB)}</td>`:''}</tr>${rows||`<tr><td colspan="${fc?8:7}" class="empty">No transactions in this period</td></tr>`}
  <tr class="tot"><td colspan="6">Closing balance</td><td class="num">${fmt(run)}</td>${fc?`<td class="num">${fmt(runB)}</td>`:''}</tr></tbody></table></div>`;
  bindPeriod();$$('tr.click').forEach(tr=>tr.onclick=()=>go(tr.dataset.h));
}

/* ---------- Bank & cash ---------- */
function vBank(V,r,a,id){
  if(a==='reconcile')return vReconcile(V,id);
  if(a==='import')return vImport(V,id);
  if(a==='new'||a==='edit'){
    const k=a==='edit'?R('bank',id):{name:'',type:'bank',opening:0,number:'',currency:''};if(!k)return go('#/bank');
    return formPage(V,{title:a==='new'?'New bank or cash account':'Edit bank or cash account',type:'bank',isNew:a==='new',rec:k,
      body:`<div class="grid">${fld('Name',inp('fName',k.name,'required placeholder="e.g. Ziraat Bank TRY"'))}
      ${fld('Type',`<select id="fType"><option value="bank" ${k.type!=='cash'?'selected':''}>Bank account</option><option value="cash" ${k.type==='cash'?'selected':''}>Cash account</option></select>`)}
      ${fld('Currency',`<select id="fCur">${curOptions(k.currency)}</select>`)}
      ${fld('Account number / IBAN',inp('fNum',k.number))}${fld('Opening balance',inp('fOpen',k.opening||0,'type="number" step="any" class="num"'))}</div>
      <p class="muted small">Opening balance is the amount in this account on ${fmtD(setting('startDate'))}, in the account's own currency.</p>`,
      read:()=>{need(val('fName'),'Enter a name');return {name:val('fName'),type:val('fType'),currency:val('fCur'),number:val('fNum'),opening:r2(val('fOpen'))}},
      deleteCheck:()=>postings().some(p=>p.key==='bank:'+id&&p.type!=='bank')?'This account has transactions. Delete them first.':''});
  }
  const bb={};L('bank').forEach(k=>bb[k.id]=bankBalances(k.id));const base=sums(null,null);
  listPage(V,{title:'Bank & Cash Accounts',type:'bank',newLabel:'New bank or cash account',rows:L('bank').sort(byCode),onRow:id=>go(ledgerHref('bank:'+id)),
    cols:[{h:'',f:k=>canWrite('bank')?`<a href="#/bank/edit/${k.id}">Edit</a>`:''},{h:'Name',f:k=>esc(k.name)},{h:'Type',f:k=>`<span class="tag ${k.type==='cash'?'cash':'bank'}">${k.type==='cash'?'Cash':'Bank'}</span>`},{h:'Currency',f:k=>esc(curLabel(recCur(k))),cls:'mono'},
      {h:'Cleared balance',num:true,f:k=>fmt(bb[k.id].cleared)},{h:'Pending',num:true,f:k=>bb[k.id].pending?`<a href="#/bank/reconcile/${k.id}">${fmt(bb[k.id].pending)}</a>`:''},
      {h:'Actual balance',num:true,f:k=>fmt(bb[k.id].actual)},{h:`In ${esc(BASE())}`,num:true,f:k=>fmt(base['bank:'+k.id]||0),sum:k=>base['bank:'+k.id]||0}]});
}

/* ---------- Bank reconciliation ---------- */
function vReconcile(V,bankId){
  const k=R('bank',bankId);if(!k)return go('#/bank');
  const key='bank:'+bankId,fx=!!masterCur(key);
  const items=postings().filter(p=>p.key===key&&!['bank','journal'].includes(p.type)).sort((a,b)=>a.date.localeCompare(b.date));
  const state=App.recon&&App.recon.bank===bankId?App.recon:(App.recon={bank:bankId,date:today(),stmt:''});
  V.innerHTML=`<div id="recon"><div class="head"><div><a href="#/bank" class="small noprint">← Bank & Cash Accounts</a><h1>Reconcile ${esc(k.name)}</h1><span class="muted">Tick every transaction that appears on your bank statement.</span></div><div class="tools"><a class="btn" href="#/bank/import/${bankId}">Import statement</a></div></div>
  <div class="card pad"><div class="grid">${fld('Statement date',inp('rDate',state.date,'type="date"'))}${fld(`Closing balance on statement (${esc(curLabel(recCur(k)))})`,inp('rStmt',state.stmt,'type="number" step="any" class="num" placeholder="0.00"'))}
    <div class="f"><span class="muted small">Cleared balance</span><b class="num" id="rCleared" style="font-size:18px;text-align:start">0.00</b></div><div class="f"><span class="muted small">Difference</span><b class="num" id="rDiff" style="font-size:18px;text-align:start">—</b></div></div></div>
  <div class="card scroll" style="margin-top:16px"><table><thead><tr><th style="width:40px"><input type="checkbox" id="rAll" aria-label="Tick all"></th><th>Date</th><th>Transaction</th><th>Reference</th><th>Details</th><th class="num">Money in</th><th class="num">Money out</th><th>Cleared on</th></tr></thead><tbody>
  ${items.map((p,i)=>{const c=clearedOn(p),v=fx?p.fx:p.amt;return `<tr data-i="${i}"><td><input type="checkbox" class="rChk" ${c?'checked':''} aria-label="Cleared"></td><td class="mono">${fmtD(p.date)}</td><td>${SRC_LABEL[p.type]}</td><td class="mono">${esc(p.ref)}</td><td>${esc(p.contact)} <span class="muted">${esc(p.desc)}</span></td><td class="num">${v>0?fmt(v):''}</td><td class="num">${v<0?fmt(-v):''}</td><td class="mono muted">${c?fmtD(c):''}</td></tr>`}).join('')||'<tr><td colspan="8" class="empty">No transactions</td></tr>'}</tbody></table></div>
  <div class="actions"><div><button class="btn primary" type="button" id="rSave">Save reconciliation</button><a class="btn" href="#/bank">Cancel</a></div></div></div>`;
  const opening=postings().filter(p=>p.key===key&&['bank','journal'].includes(p.type)).reduce((s,p)=>s+(fx?p.fx:p.amt),0);
  const calc=()=>{state.date=val('rDate');state.stmt=val('rStmt');let c=opening;$$('tbody tr[data-i]').forEach(tr=>{if(tr.querySelector('.rChk').checked){const p=items[+tr.dataset.i];if(p.date<=state.date||clearedOn(p))c+=fx?p.fx:p.amt}});
    $('#rCleared').textContent=fmt(c);if(state.stmt===''){$('#rDiff').textContent='—';$('#rDiff').className='num'}else{const d=r2(+state.stmt-c);$('#rDiff').textContent=d?fmt(d):'0.00 ✓';$('#rDiff').className='num '+(d?'neg':'ok')}};
  $('#recon').addEventListener('change',calc);$('#recon').addEventListener('input',calc);
  $('#rAll').onchange=e=>{$$('.rChk').forEach(c=>c.checked=e.target.checked);calc()};calc();
  $('#rSave').onclick=async()=>{const d=val('rDate')||today();const changes=new Map();
    $$('tbody tr[data-i]').forEach(tr=>{const p=items[+tr.dataset.i],on=tr.querySelector('.rChk').checked,cur=clearedOn(p);if(on===!!cur)return;
      const rec=changes.get(p.id)||Object.assign({},R(p.type,p.id),{_type:p.type});
      if(p.type==='transfer'){if(p.amt>=0)rec.clearedTo=on?d:'';else rec.clearedFrom=on?d:''}else rec.cleared=on?d:'';changes.set(p.id,rec)});
    if(!changes.size){toast('Nothing changed');return}
    $('#rSave').disabled=true;try{for(const rec of changes.values()){const t=rec._type;delete rec._type;await saveRec(t,rec,false)}toast(`Saved ${changes.size} transactions`);router()}catch(e){$('#rSave').disabled=false}};
}

/* ---------- Bank statement import (CSV) ---------- */
function parseCSV(text){
  const first=text.split(/\r?\n/).find(l=>l.trim())||'';const delim=[';','\t',','].map(d=>[d,first.split(d).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){const ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++}else q=false}else cell+=ch}
    else if(ch==='"')q=true;else if(ch===delim){row.push(cell);cell=''}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(c=>c.trim()))rows.push(row);row=[];cell=''}else cell+=ch}
  row.push(cell);if(row.some(c=>c.trim()))rows.push(row);return rows.map(r=>r.map(c=>c.trim()));
}
function parseAmount(s){s=String(s||'').replace(/[^\d,.\-()]/g,'');if(!s)return NaN;let neg=/^\(.*\)$/.test(s)||s.startsWith('-');s=s.replace(/[()\-]/g,'');
  const lc=s.lastIndexOf(','),ld=s.lastIndexOf('.');if(lc>ld){s=s.replace(/\./g,'').replace(',','.')}else s=s.replace(/,/g,'');const n=parseFloat(s);return neg?-n:n}
function parseDate(s,fmtx){s=String(s||'').trim();const m=s.match(/(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})/);if(!m)return '';let [_,a,b,c]=m;
  let y,mo,d;if(a.length===4){y=a;mo=b;d=c}else if(fmtx==='mdy'){mo=a;d=b;y=c}else{d=a;mo=b;y=c}if(y.length===2)y='20'+y;
  const iso=`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;return isNaN(new Date(iso))?'':iso}
function vImport(V,bankId){
  const k=R('bank',bankId);if(!k)return go('#/bank');
  if(!canWrite('receipt')||!canWrite('payment')){V.innerHTML='<div class="note">You need access to Receipts and Payments to import a bank statement.</div>';return}
  V.innerHTML=`<div class="head"><div><a href="${ledgerHref('bank:'+bankId)}" class="small">← ${esc(k.name)}</a><h1>Import bank statement</h1><span class="muted">Download a CSV file from your online banking and add it here.</span></div></div>
  <div class="card pad"><div class="grid"><label class="f">CSV file<input type="file" id="iFile" accept=".csv,.txt,text/csv"></label>
   ${fld('Date format in the file',`<select id="iFmt"><option value="dmy">Day/Month/Year (31/12/2026)</option><option value="mdy">Month/Day/Year (12/31/2026)</option></select>`)}</div>
   <label class="f" style="margin-top:14px">…or paste the statement text<textarea id="iText" class="code" placeholder="Date;Description;Amount&#10;01/10/2026;Customer payment;1500,00&#10;03/10/2026;Office rent;-900,00"></textarea></label>
   <div class="actions"><div><button class="btn primary" type="button" id="iRead">Read statement</button></div></div></div><div id="iMap"></div>`;
  $('#iFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const fr=new FileReader();fr.onload=()=>{$('#iText').value=fr.result;$('#iRead').click()};fr.readAsText(f)};
  $('#iRead').onclick=()=>{const rows=parseCSV($('#iText').value);if(rows.length<1){toast('No rows found');return}
    const hasHead=rows[0].some(c=>/[a-zA-Z؀-ۿ]/.test(c)&&isNaN(parseAmount(c)))&&!parseDate(rows[0][0],'dmy');
    const head=hasHead?rows[0]:rows[0].map((_,i)=>'Column '+(i+1)),data=hasHead?rows.slice(1):rows;
    const guess=re=>Math.max(0,head.findIndex(h=>re.test(h)));
    const colSel=(id,label,def,opt)=>fld(label,`<select id="${id}">${opt?'<option value="-1">—</option>':''}${head.map((h,i)=>`<option value="${i}" ${i===def?'selected':''}>${esc(h)}</option>`).join('')}</select>`);
    $('#iMap').innerHTML=`<div class="card pad" style="margin-top:16px"><h2>Which column is which?</h2><div class="grid">${colSel('cDate','Date',guess(/date|tarih|تاریخ/i))}${colSel('cDesc','Description',guess(/desc|açıklama|aciklama|detail|narr|شرح/i))}
      ${colSel('cAmt','Amount (+ in, − out)',guess(/amount|tutar|miktar|مبلغ/i))}${colSel('cOut','Money out column (if separate)',-1,true)}</div>
      <div class="actions"><div><button class="btn primary" type="button" id="iPrev">Preview transactions</button></div></div></div><div id="iPrevBox"></div>`;
    $('#iPrev').onclick=()=>preview(data)};
  const preview=data=>{const cD=+val('cDate'),cS=+val('cDesc'),cA=+val('cAmt'),cO=+val('cOut'),fm=val('iFmt');
    const lines=data.map(r=>{let a=parseAmount(r[cA]);if(cO>=0){const o=parseAmount(r[cO]);if(!isNaN(o)&&o)a=-Math.abs(o);else a=Math.abs(a||0)}return {date:parseDate(r[cD],fm),desc:r[cS]||'',amount:r2(a)}}).filter(l=>l.date&&l.amount);
    if(!lines.length){toast('Could not read any dates and amounts. Check the columns and date format.');return}
    const key='bank:'+bankId,fx=!!masterCur(key),open=postings().filter(p=>p.key===key&&['receipt','payment','transfer'].includes(p.type)&&!clearedOn(p));const used=new Set();
    lines.forEach(l=>{const m=open.find(p=>!used.has(p.id+p.amt)&&r2(fx?p.fx:p.amt)===l.amount&&Math.abs(daysBetween(p.date,l.date))<=7);if(m){used.add(m.id+m.amt);l.match=m}});
    $('#iPrevBox').innerHTML=`<div class="card scroll" style="margin-top:16px"><table><thead><tr><th style="width:40px"></th><th>Date</th><th>Description</th><th class="num">Amount</th><th>What to do</th></tr></thead><tbody>
      ${lines.map((l,i)=>`<tr data-i="${i}"><td><input type="checkbox" class="iUse" checked aria-label="Use"></td><td class="mono">${fmtD(l.date)}</td><td>${esc(l.desc)}</td><td class="num ${l.amount<0?'neg':''}">${fmt(l.amount)}</td>
        <td>${l.match?`<span class="tag paid">Matches ${SRC_LABEL[l.match.type]} #${esc(l.match.ref)}</span> <span class="muted small">will be marked cleared</span>`:`<select class="iAcc" aria-label="Account">${acctOptions('',{sub:true,blank:l.amount>0?'Create receipt to…':'Create payment to…'})}</select>`}</td></tr>`).join('')}</tbody></table></div>
      <div class="actions"><div><button class="btn primary" type="button" id="iGo">Import ticked lines</button></div></div><p class="muted small">Lines without an account are skipped. Matching transactions are found by the same amount within 7 days.</p>`;
    $('#iGo').onclick=async()=>{const todo=[],clear=[];$$('#iPrevBox tbody tr').forEach(tr=>{if(!tr.querySelector('.iUse').checked)return;const l=lines[+tr.dataset.i];if(l.match)clear.push(l);else{const acc=tr.querySelector('.iAcc').value;if(acc)todo.push({...l,acc})}});
      if(!todo.length&&!clear.length){toast('Choose an account for at least one line');return}$('#iGo').disabled=true;
      try{const rows=[];let rn=+nextRef('receipt'),pn=+nextRef('payment');const cur=recCur(k);
        todo.forEach(l=>{const isR=l.amount>0;rows.push({type:isR?'receipt':'payment',data:{date:l.date,ref:String(isR?rn++:pn++),bank:bankId,currency:cur,rate:cur?curRate(cur):'',contact:'',desc:l.desc,cleared:l.date,lines:[{account:l.acc,desc:'',amount:Math.abs(l.amount)}]}})});
        if(rows.length)(await API.insertMany(S.biz.id,rows)).forEach(setRow);
        for(const l of clear){const p=l.match,rec=Object.assign({},R(p.type,p.id));if(p.type==='transfer'){if(p.amt>=0)rec.clearedTo=l.date;else rec.clearedFrom=l.date}else rec.cleared=l.date;await saveRec(p.type,rec,false)}
        toast(`Created ${rows.length} and matched ${clear.length} transactions`);go(ledgerHref('bank:'+bankId))}catch(e){toast('Import failed: '+e.message);$('#iGo').disabled=false}};
  };
}

/* ---------- Receipts & payments ---------- */
function invOpts(type,account,sel){
  const side=type==='receipt'?'sales':'purchase',pre=side==='sales'?'ar:':'ap:';
  if(!account||!account.startsWith(pre))return '<option value="">—</option>';
  const pid=account.slice(3),st=invoiceStatus(side),list=L(side==='sales'?'salesinvoice':'purchaseinvoice').filter(i=>i[side==='sales'?'customer':'supplier']===pid&&(st[i.id].due>0||i.id===sel)).sort((x,y)=>x.date.localeCompare(y.date));
  const ob=st['ob:'+pid]&&(st['ob:'+pid].due>0||sel==='ob:'+pid)?`<option value="ob:${pid}" ${sel==='ob:'+pid?'selected':''}>Starting balance · ${fmt(st['ob:'+pid].due)} ${esc(curLabel(st['ob:'+pid].cur))}</option>`:'';
  const tk=L('ticket').filter(t=>t[side==='sales'?'customer':'airline']===pid&&st[t.id]&&(st[t.id].due>0||t.id===sel)).sort((x,y)=>x.date.localeCompare(y.date));
  return '<option value="">Not linked</option>'+ob+list.map(i=>`<option value="${i.id}" ${sel===i.id?'selected':''}>#${esc(i.ref)} · ${fmtD(i.date)} · ${fmt(st[i.id].due)} ${esc(curLabel(st[i.id].cur))}</option>`).join('')
    +tk.map(t=>`<option value="${t.id}" ${sel===t.id?'selected':''}>Ticket #${esc(t.ref)} · ${esc(t.passenger||'')} · ${fmt(st[t.id].due)} ${esc(curLabel(st[t.id].cur))}</option>`).join('');
}
function contactsDatalist(){return `<datalist id="contacts">${[...new Set(L('customer').concat(L('supplier'),L('employee')).map(nm).concat(L('receipt').concat(L('payment')).map(x=>x.contact)).filter(Boolean))].map(c=>`<option value="${esc(c)}">`).join('')}</datalist>`}

function vRP(V,type,a,id){
  const isR=type==='receipt',Lb=isR?{one:'Receipt',contact:'Received from',bank:'Received in'}:{one:'Payment',contact:'Paid to',bank:'Paid from'};
  if(a==='view'){const x=R(type,id);if(!x)return go('#/'+type);return docView(V,type,x)}
  if(a==='new'||a==='edit'){
    if(!L('bank').length){V.innerHTML=`<div class="note">Add a bank or cash account first. <a href="#/bank/new">Add bank or cash account</a></div>`;return}
    let x=a==='edit'?R(type,id):{date:today(),ref:nextRef(type),bank:L('bank')[0].id,contact:'',desc:'',lines:[]};if(!x)return go('#/'+type);
    if(a==='new'&&App.prefill&&App.prefill.type===type){x=Object.assign(x,App.prefill.data);App.prefill=null}
    const cur0=recCur(R('bank',x.bank));let ed;
    return formPage(V,{title:a==='new'?(isR?'New receipt':'New payment'):(isR?'Edit receipt':'Edit payment'),type,isNew:a==='new',rec:x,
      extraBtns:a==='edit'?`<a class="btn" href="#/${type}/view/${x.id}">View</a>`:'',after:row=>`#/${type}/view/${row.id}`,
      body:`<div class="grid">${fld('Date',inp('fDate',x.date,'type="date" required'))}${fld('Reference',inp('fRef',x.ref))}
        ${fld(Lb.bank,`<select id="fBank">${optList(L('bank'),x.bank)}</select>`)}${fld(Lb.contact,inp('fContact',x.contact,'list="contacts"'))}
        ${fld('Description',inp('fDesc',x.desc),'span2')}</div>${rateFields(cur0,x.rate)}${contactsDatalist()}<div id="lines"></div>
        <div class="totals"><span>Total <span id="tCur">${esc(curLabel(cur0))}</span></span><b id="tTot">0.00</b></div>
        <div class="grid" style="margin-top:14px"><label class="c"><input type="checkbox" id="fClr" ${x.cleared?'checked':''}> Cleared on bank statement</label>${fld('Cleared on',inp('fClrD',x.cleared||'','type="date"'))}</div>`,
      onRender:()=>{$('#fBank').onchange=()=>setRateCur(recCur(R('bank',val('fBank'))));
        $('#fClr').onchange=e=>{if(e.target.checked&&!val('fClrD'))$('#fClrD').value=val('fDate')};
        ed=LineEditor($('#lines'),[
        {k:'account',h:'Account',t:'select',w:'30%',opts:v=>acctOptions(v,{sub:true}),on:(tr,v)=>{tr.querySelector('[data-k=invoice]').innerHTML=invOpts(type,v,'')}},
        {k:'invoice',h:'Invoice',t:'select',w:'20%',ignoreEmpty:true,opts:(v,l)=>invOpts(type,l.account,v),on:(tr,v)=>{const amt=tr.querySelector('[data-k=amount]');if(v&&!amt.value){const s=invoiceStatus(isR?'sales':'purchase')[v];if(s)amt.value=s.due}}},
        {k:'desc',h:'Description'},...projectCol(),{k:'amount',h:'Amount',t:'num',w:'130px'}],x.lines,{onChange:ls=>$('#tTot').textContent=fmt(sumLines(ls))})},
      read:()=>{const lines=ed.read();need(lines.length,'Add at least one line');lines.forEach(l=>{need(l.account,'Choose an account on every line');need(+l.amount,'Enter an amount on every line');l.amount=r2(l.amount)});
        need(val('fDate'),'Enter a date');const cur=recCur(R('bank',val('fBank')));const clr=$('#fClr').checked?(val('fClrD')||val('fDate')):'';
        return {date:val('fDate'),ref:val('fRef'),bank:val('fBank'),currency:cur,rate:readRate(cur),contact:val('fContact'),desc:val('fDesc'),cleared:clr,lines,...(x.refundFor?{refundFor:x.refundFor}:{})}}});
  }
  const rows=[...L(type)].sort((x,y)=>y.date.localeCompare(x.date)||(parseInt(y.ref)||0)-(parseInt(x.ref)||0));
  listPage(V,{title:isR?'Receipts':'Payments',type,newLabel:isR?'New receipt':'New payment',rows,
    cols:[{h:'',f:x=>`<a href="#/${type}/view/${x.id}">View</a>`},{h:'Date',f:x=>fmtD(x.date),cls:'mono'},{h:'Reference',f:x=>esc(x.ref),cls:'mono'},{h:Lb.bank,f:x=>esc(nm(R('bank',x.bank)))},{h:Lb.contact,f:x=>esc(x.contact)},
      {h:'Description',cls:'muted',f:x=>esc(x.desc||(x.lines||[]).map(l=>keyName(l.account)).join(', '))},{h:'Cleared',f:x=>x.cleared?'<span class="tag paid">✓</span>':''},{h:'Amount',num:true,f:x=>money(sumLines(x.lines),docCur(x)),sum:x=>r2(sumLines(x.lines)*docRate(x))}]});
}

/* ---------- Transfers ---------- */
function vTransfer(V,r,a,id){
  if(a==='new'||a==='edit'){
    if(L('bank').length<2){V.innerHTML=`<div class="note">You need at least two bank or cash accounts to make a transfer. <a href="#/bank/new">Add bank or cash account</a></div>`;return}
    const t=a==='edit'?R('transfer',id):{date:today(),ref:nextRef('transfer'),from:L('bank')[0].id,to:L('bank')[1].id,amount:'',amountTo:'',rate:'',desc:''};if(!t)return go('#/transfer');
    const sync=()=>{const fc=recCur(R('bank',val('fFrom'))),tc=recCur(R('bank',val('fTo')));$('#toBox').hidden=fc===tc;$('#rateBox').hidden=!(fc&&tc);$('#fcl').textContent=curLabel(fc);$('#tcl').textContent=curLabel(tc);if(fc&&tc&&!val('fRate'))$('#fRate').value=curRate(fc)};
    return formPage(V,{title:a==='new'?'New inter account transfer':'Edit inter account transfer',type:'transfer',isNew:a==='new',rec:t,
      body:`<div class="grid">${fld('Date',inp('fDate',t.date,'type="date"'))}${fld('Reference',inp('fRef',t.ref))}${fld('Paid from',`<select id="fFrom">${optList(L('bank'),t.from)}</select>`)}${fld('Received in',`<select id="fTo">${optList(L('bank'),t.to)}</select>`)}
        <label class="f"><span>Amount paid <span id="fcl"></span></span>${inp('fAmt',t.amount,'type="number" step="any" class="num"')}</label>
        <label class="f" id="toBox"><span>Amount received <span id="tcl"></span></span>${inp('fAmtTo',t.amountTo,'type="number" step="any" class="num"')}</label>
        <label class="f" id="rateBox"><span>Exchange rate to ${esc(BASE())}</span>${inp('fRate',t.rate,'type="number" step="any" class="num"')}</label>
        ${fld('Description',inp('fDesc',t.desc))}</div>`,
      onRender:()=>{$('#fFrom').onchange=sync;$('#fTo').onchange=sync;sync()},
      read:()=>{const fc=recCur(R('bank',val('fFrom'))),tc=recCur(R('bank',val('fTo')));const o={date:val('fDate'),ref:val('fRef'),from:val('fFrom'),to:val('fTo'),amount:r2(val('fAmt')),amountTo:fc===tc?'':r2(val('fAmtTo')),rate:fc&&tc?+val('fRate')||'':'',desc:val('fDesc'),clearedFrom:t.clearedFrom||'',clearedTo:t.clearedTo||''};
        need(o.from!==o.to,'Choose two different accounts');need(o.amount>0,'Enter an amount above zero');if(fc!==tc)need(o.amountTo>0,'Enter the amount received');return o}});
  }
  listPage(V,{title:'Inter Account Transfers',type:'transfer',newLabel:'New transfer',rows:[...L('transfer')].sort((x,y)=>y.date.localeCompare(x.date)),
    cols:[{h:'Date',f:t=>fmtD(t.date),cls:'mono'},{h:'Reference',f:t=>esc(t.ref),cls:'mono'},{h:'Paid from',f:t=>esc(nm(R('bank',t.from)))},{h:'Received in',f:t=>esc(nm(R('bank',t.to)))},{h:'Description',f:t=>esc(t.desc),cls:'muted'},{h:'Amount',num:true,f:t=>money(t.amount,recCur(R('bank',t.from)))}]});
}

/* ---------- Customers & suppliers ---------- */
function vParty(V,type,a,id){
  const isC=type==='customer',pre=isC?'ar:':'ap:',side=isC?'sales':'purchase';
  if(a==='new'||a==='edit'){
    const p=a==='edit'?R(type,id):{name:'',code:'',email:'',phone:'',address:'',terms:isC?15:30,taxNumber:'',currency:'',kind:App.prefill&&App.prefill.type===type?App.prefill.kind:''};if(App.prefill&&App.prefill.type===type)App.prefill=null;if(!p)return go('#/'+type);
    formPage(V,{title:a==='new'?(isC?'New customer':'New supplier'):(isC?'Edit customer':'Edit supplier'),type,isNew:a==='new',rec:p,
      extraBtns:a==='edit'?`<a class="btn" href="${ledgerHref(pre+p.id)}">${isC?'Statement':'Transactions'}</a>`+(canAdmin()?`<button class="btn danger" type="button" id="delAll">${isC?'Delete customer and all their transactions':'Delete supplier and all their transactions'}</button>`:''):'',
      body:`<div class="grid">${fld('Name',inp('fName',p.name,'required'))}${fld('Code',inp('fCode',p.code))}${fld('Email',inp('fEmail',p.email,'type="email"'))}${fld('Phone / WhatsApp',inp('fPhone',p.phone))}
        ${fld('Type',`<select id="fKind">${(isC?[['','Customer'],['agent','Sub-agent (B2B)']]:[['','Supplier'],['airline','Airline'],['saraf','Partner saraf (hawala)']]).map(([v,l])=>`<option value="${v}" ${(p.kind||'')===v?'selected':''}>${l}</option>`).join('')}</select>`)}
        ${fld(isC?'Starting balance (they owed you)':'Starting balance (you owed them)',inp('fOpen',p.opening??'','type="number" step="any" class="num" placeholder="0.00"'))}
        ${fld('Payment terms (days)',inp('fTerms',p.terms,'type="number" min="0"'))}${fld('Tax number',inp('fTax',p.taxNumber))}${fld('Currency',`<select id="fCur" ${a==='edit'&&usedKey(pre+p.id)?'disabled':''}>${curOptions(p.currency)}</select>`)}
        ${fld('Billing address',`<textarea id="fAddr">${esc(p.address)}</textarea>`,'span2')}</div>`,
      read:()=>{need(val('fName'),'Enter a name');
        const nmL=val('fName').toLowerCase(),ph=val('fPhone').replace(/[^\d]/g,''),others=L(type).filter(o=>o.id!==p.id),dup=others.find(o=>String(o.name||'').trim().toLowerCase()===nmL)||(ph.length>=7&&others.find(o=>String(o.phone||'').replace(/[^\d]/g,'').endsWith(ph.slice(-9))));
        const sig=nmL+'|'+ph;if(dup&&$('#f').dataset.dupOk!==sig){$('#f').dataset.dupOk=sig;throw new Error(`${lookupOr(isC?'A customer with the same name or phone already exists':'A supplier with the same name or phone already exists')}: ${dup.name}. ${lookupOr('Press the save button again to save anyway.')}`)}
        return {name:val('fName'),code:val('fCode'),kind:val('fKind'),opening:val('fOpen')===''?'':r2(val('fOpen')),email:val('fEmail'),phone:val('fPhone'),terms:+val('fTerms')||0,taxNumber:val('fTax'),currency:$('#fCur').disabled?(p.currency||''):val('fCur'),address:$('#fAddr').value}},
      deleteCheck:()=>(usedKey(pre+id)||L(isC?'quote':'purchaseorder').some(d=>d[type]===id))?(isC?'This customer has transactions and cannot be deleted.':'This supplier has transactions and cannot be deleted.'):''});
    const da=$('#delAll');if(da)da.onclick=()=>partyDeleteAll(type,p);
    return;
  }
  const fxb=fxSums(null),bs=sums(null,null),st=Object.values(invoiceStatus(side));
  const over=pid=>st.filter(s=>s.party===pid&&s.cls==='overdue').reduce((s,x)=>s+x.due,0);
  const bal=p=>{const c=recCur(p),v=c?fxb[pre+p.id]||0:bs[pre+p.id]||0;return (isC?1:-1)*v};
  listPage(V,{title:isC?'Customers':'Suppliers',type,newLabel:isC?'New customer':'New supplier',rows:[...L(type)].sort((x,y)=>x.name.localeCompare(y.name)),onRow:id=>go(ledgerHref(pre+id)),
    cols:[{h:'',f:p=>canWrite(type)?`<a href="#/${type}/edit/${p.id}">Edit</a>`:''},{h:'Name',f:p=>esc(p.name)+(p.kind==='agent'?' <span class="tag">Sub-agent</span>':p.kind==='airline'?' <span class="tag">Airline</span>':p.kind==='saraf'?' <span class="tag">Partner saraf</span>':'')},{h:'Code',f:p=>esc(p.code||''),cls:'mono muted'},{h:'Contact',f:p=>esc([p.email,p.phone].filter(Boolean).join(' · ')),cls:'muted'},
      {h:'Overdue',num:true,f:p=>{const o=over(p.id);return o>0?`<span class="neg">${money(o,recCur(p))}</span>`:''}},
      {h:isC?'Balance due':'Balance owed',num:true,f:p=>money(bal(p),recCur(p)),sum:p=>(isC?1:-1)*(bs[pre+p.id]||0)}]});
}

/* ---------- Sales & purchase documents ---------- */
const DOCS={
  quote:{one:'Sales quote',many:'Sales Quotes',party:'customer',side:'sales',due:'Expiry date',print:'QUOTE',share:true},
  salesorder:{one:'Sales order',many:'Sales Orders',party:'customer',side:'sales',due:'Delivery date',print:'SALES ORDER',share:true},
  salesinvoice:{one:'Sales invoice',many:'Sales Invoices',party:'customer',side:'sales',due:'Due date',print:'INVOICE',status:true,share:true},
  recurringinvoice:{one:'Recurring invoice',many:'Recurring Invoices',party:'customer',side:'sales',recurring:true},
  creditnote:{one:'Credit note',many:'Credit Notes',party:'customer',side:'sales',link:'salesinvoice',print:'CREDIT NOTE',share:true},
  purchaseorder:{one:'Purchase order',many:'Purchase Orders',party:'supplier',side:'purchase',due:'Delivery date',print:'PURCHASE ORDER',share:true},
  purchaseinvoice:{one:'Purchase invoice',many:'Purchase Invoices',party:'supplier',side:'purchase',due:'Due date',print:'PURCHASE INVOICE',status:true},
  debitnote:{one:'Debit note',many:'Debit Notes',party:'supplier',side:'purchase',link:'purchaseinvoice',print:'DEBIT NOTE'}
};
const FREQ={week:'Week(s)',month:'Month(s)',quarter:'Quarter(s)',year:'Year(s)'};
function vDoc(V,type,a,id){
  const D=DOCS[type],sales=D.side==='sales',pt=D.party;
  if(a==='view'&&!D.recurring){const x=R(type,id);if(!x)return go('#/'+type);return docView(V,type,x)}
  if(a==='new'||a==='edit'||(a==='view'&&D.recurring)){
    if(a==='view')a='edit';
    let x=a==='edit'?R(type,id):{date:today(),dueDate:'',ref:D.recurring?'':nextRef(type),[pt]:'',desc:'',lines:[],notes:a==='new'&&sales?(setting('invoiceFooter')||''):'',nextDate:today(),freq:'month',every:1,dueDays:15,active:true};if(!x)return go('#/'+type);
    if(a==='new'&&App.prefill&&App.prefill.type===type){x=Object.assign(x,App.prefill.data);App.prefill=null}
    if(!L(pt).length){V.innerHTML=`<div class="note">${sales?'Add a customer first.':'Add a supplier first.'} <a href="#/${pt}/new">${sales?'New customer':'New supplier'}</a></div>`;return}
    let ed;const items=[...L('item')].sort(byCode),cur0=recCur(R(pt,x[pt]));
    const lockAcc=(tr)=>{if(sales)return;const it=R('item',tr.querySelector('[data-k=item]').value),s=tr.querySelector('[data-k=account]');if(it&&it.track){s.value='';s.disabled=true;s.options[0].textContent='Inventory on hand'}else{s.disabled=false;s.options[0].textContent='Select account…'}};
    const totals=ls=>{let n=0,t=0;ls.forEach(l=>{const c=lineCalc(l);n+=c.net;t+=c.tax});$('#tNet').textContent=fmt(n);$('#tTax').textContent=fmt(t);$('#tTot').textContent=fmt(n+t)};
    const head=D.recurring?`${fld('Next invoice date',inp('fNext',x.nextDate,'type="date"'))}${fld('Repeat every',`<span style="display:flex;gap:6px">${inp('fEvery',x.every,'type="number" min="1" style="width:70px"')}<select id="fFreq">${Object.entries(FREQ).map(([k,v])=>`<option value="${k}" ${x.freq===k?'selected':''}>${v}</option>`).join('')}</select></span>`)}
        ${fld('Due after (days)',inp('fDueDays',x.dueDays,'type="number" min="0"'))}${fld('End date (optional)',inp('fEnd',x.endDate||'','type="date"'))}<label class="c"><input type="checkbox" id="fActive" ${x.active!==false?'checked':''}> Active</label>`
      :`${fld('Issue date',inp('fDate',x.date,'type="date"'))}${D.due?fld(D.due,inp('fDue',x.dueDate,'type="date"')):''}${fld('Reference',inp('fRef',x.ref))}
        ${D.link?fld(DOCS[D.link].one,`<select id="fLink"></select>`):''}`;
    return formPage(V,{title:(a==='new'?'New ':'Edit ')+D.one.toLowerCase(),type,isNew:a==='new',rec:x,
      extraBtns:a==='edit'&&!D.recurring?`<a class="btn" href="#/${type}/view/${x.id}">View</a>`:'',after:D.recurring?null:row=>`#/${type}/view/${row.id}`,
      body:`<div class="grid">${fld(sales?'Customer':'Supplier',`<select id="fParty">${optList([...L(pt)].sort((p,q)=>p.name.localeCompare(q.name)),x[pt],'Select…')}</select>`)}
        ${head}${fld('Description',inp('fDesc',x.desc),'span2')}${projectField(x.project)}</div>${rateFields(cur0,x.rate)}
        <div id="lines"></div>
        <div class="totals"><span>Subtotal</span><b id="tNet">0.00</b><span>Tax</span><b id="tTax">0.00</b><span><b style="font-family:var(--body)">Total <span id="tCur">${esc(curLabel(cur0))}</span></b></span><b id="tTot">0.00</b></div>
        <div class="grid" style="margin-top:14px">${fld('Notes (printed at the bottom)',`<textarea id="fNotes">${esc(x.notes||'')}</textarea>`,'span2')}</div>`,
      onRender:()=>{
        const linkFill=()=>{const s=$('#fLink');if(!s)return;const pid=val('fParty');s.innerHTML='<option value="">Not linked</option>'+L(D.link).filter(i=>i[pt]===pid).sort((p,q)=>q.date.localeCompare(p.date)).map(i=>`<option value="${i.id}" ${x.invoice===i.id?'selected':''}>#${esc(i.ref)} · ${fmtD(i.date)} · ${fmt(docTotals(i).total)}</option>`).join('')};
        linkFill();
        $('#fParty').onchange=()=>{linkFill();const p=R(pt,val('fParty'));setRateCur(recCur(p));if(p&&D.due&&$('#fDue')&&!$('#fDue').value&&p.terms)$('#fDue').value=addDays(val('fDate'),p.terms)};
        ed=LineEditor($('#lines'),[
          {k:'item',h:'Item',t:'select',w:'15%',opts:v=>optList(items,v,'—'),init:tr=>lockAcc(tr),
           on:(tr,v)=>{const it=R('item',v);if(it){tr.querySelector('[data-k=desc]').value=it.name;const pr=sales?it.price:it.cost,c=foreign(curLabel(recCur(R(pt,val('fParty')))));tr.querySelector('[data-k=price]').value=pr===''||pr==null?'':(c?r2(pr/(+val('fRate')||curRate(c))):pr);const s=tr.querySelector('[data-k=account]');const acc=sales?it.incomeAccount:it.expenseAccount;if(acc)s.value=acc}lockAcc(tr)}},
          {k:'desc',h:'Description',w:'19%'},
          {k:'account',h:'Account',t:'select',w:'16%',ignoreEmpty:true,opts:v=>acctOptions(v,{groups:sales?['income','liability','equity','asset','expense']:['expense','asset','liability','equity','income']})},
          ...projectCol(),
          {k:'qty',h:'Qty',t:'num',w:'66px',ph:'1'},{k:'price',h:'Unit price',t:'num',w:'96px'},{k:'disc',h:'Disc %',t:'num',w:'60px'},
          {k:'tax',h:'Tax',t:'select',w:'96px',ignoreEmpty:true,opts:v=>taxOptions(v)},{k:'amt',h:'Amount',calc:l=>lineCalc(l).net}],x.lines,{onChange:totals})},
      read:()=>{const lines=ed.read();need(val('fParty'),sales?'Choose a customer':'Choose a supplier');need(lines.length,'Add at least one line');
        lines.forEach(l=>{const it=R('item',l.item);need(l.account||(!sales&&it&&it.track),'Choose an account on every line');need(l.price!=='','Enter a price on every line')});
        const cur=recCur(R(pt,val('fParty')));
        const o={[pt]:val('fParty'),desc:val('fDesc'),notes:$('#fNotes').value,lines,currency:cur,rate:readRate(cur),project:val('fProject'),shareToken:x.shareToken||''};
        if(D.recurring){Object.assign(o,{nextDate:val('fNext'),every:+val('fEvery')||1,freq:val('fFreq'),dueDays:+val('fDueDays')||0,endDate:val('fEnd'),active:$('#fActive').checked});need(o.nextDate,'Enter the next invoice date');delete o.rate}
        else Object.assign(o,{date:val('fDate'),dueDate:val('fDue'),ref:val('fRef'),invoice:val('fLink')});
        return o}});
  }
  if(D.recurring)return vRecurringList(V);
  const st=D.status?invoiceStatus(D.side):null;
  const rows=[...L(type)].sort((x,y)=>y.date.localeCompare(x.date)||(parseInt(y.ref)||0)-(parseInt(x.ref)||0));
  const cols=[{h:'',f:x=>`<a href="#/${type}/view/${x.id}">View</a>`},{h:'Issue date',f:x=>fmtD(x.date),cls:'mono'}];
  if(D.due)cols.push({h:D.due,f:x=>fmtD(x.dueDate),cls:'mono'});
  cols.push({h:'Reference',f:x=>esc(x.ref),cls:'mono'},{h:sales?'Customer':'Supplier',f:x=>esc(nm(R(pt,x[pt])))});
  if(D.link)cols.push({h:DOCS[D.link].one,f:x=>{const i=R(D.link,x.invoice);return i?'#'+esc(i.ref):''},cls:'mono muted'});
  cols.push({h:'Description',f:x=>esc(x.desc),cls:'muted'},{h:'Total',num:true,f:x=>money(docTotals(x).total,docCur(x)),sum:x=>r2(docTotals(x).total*docRate(x))});
  if(st)cols.push({h:'Balance due',num:true,f:x=>money(st[x.id].due,docCur(x)),sum:x=>r2(st[x.id].due*docRate(x))},{h:'Status',f:x=>statusTag(st[x.id])});
  listPage(V,{title:D.many,type,newLabel:'New '+D.one.toLowerCase(),rows,cols,onRow:id=>go(`#/${type}/view/${id}`)});
}

/* ---------- recurring invoices list + generator ---------- */
function vRecurringList(V){
  const due=dueRecurring();
  listPage(V,{title:'Recurring Invoices',type:'recurringinvoice',newLabel:'New recurring invoice',rows:[...L('recurringinvoice')].sort((a,b)=>(a.nextDate||'').localeCompare(b.nextDate||'')),onRow:id=>go('#/recurringinvoice/edit/'+id),
    tools:due.length&&canWrite('salesinvoice')?`<button class="btn primary" type="button" id="genBtn">Create ${due.length} due invoices</button>`:'',
    cols:[{h:'Customer',f:x=>esc(nm(R('customer',x.customer)))},{h:'Description',f:x=>esc(x.desc),cls:'muted'},{h:'Repeats',f:x=>`${x.every||1} ${esc(FREQ[x.freq]||'')}`},{h:'Next invoice',f:x=>`<span class="${x.nextDate<=today()?'neg':''}">${fmtD(x.nextDate)}</span>`,cls:'mono'},
      {h:'Status',f:x=>x.active===false?'<span class="tag">Paused</span>':(x.endDate&&x.nextDate>x.endDate?'<span class="tag">Finished</span>':'<span class="tag paid">Active</span>')},{h:'Amount',num:true,f:x=>money(docTotals(x).total,docCur(x))}]});
  const b=$('#genBtn');if(b)b.onclick=async()=>{b.disabled=true;try{let n=+nextRef('salesinvoice'),made=0;const t=today();
    for(const r of dueRecurring()){const rows=[];let d=r.nextDate;
      while(d<=t&&(!r.endDate||d<=r.endDate)&&rows.length<60){rows.push({type:'salesinvoice',data:{customer:r.customer,date:d,dueDate:addDays(d,r.dueDays||0),ref:String(n++),desc:r.desc,notes:r.notes||'',project:r.project||'',currency:r.currency||'',rate:r.currency?curRate(r.currency):'',lines:JSON.parse(JSON.stringify(r.lines||[])),fromRecurring:r.id}});d=advanceDate(d,r.freq,r.every)}
      (await API.insertMany(S.biz.id,rows)).forEach(setRow);made+=rows.length;await saveRec('recurringinvoice',Object.assign({},r,{nextDate:d}),false)}
    toast(`Created ${made} invoices`);go('#/salesinvoice')}catch(e){toast('Could not create: '+e.message);b.disabled=false}};
}

/* ---------- footers (Settings → Footers) printed at the bottom of documents ---------- */
const FOOTER_KINDS=[['sales','Sales documents'],['purchase','Purchase documents'],['money','Receipts and payments'],['ticket','Ticket receipts'],['sarafi','Exchange and hawala slips'],['payslip','Payslips']];
const footerKind=t=>['quote','salesorder','salesinvoice','creditnote','deliverynote'].includes(t)?'sales':['purchaseorder','purchaseinvoice','debitnote','goodsreceipt'].includes(t)?'purchase':(t==='receipt'||t==='payment')?'money':(t==='exchange'||t==='hawala')?'sarafi':t;
function docFooters(type){const k=footerKind(type),f=(setting('footers')||[]).filter(x=>(x.on||[]).includes(k)&&String(x.text||'').trim());
  const mark=S.plan&&!S.plan.super&&S.plan.effective==='free'?`<div class="freemark">Made with Falak Hesab – free accounting · falakhesab.com</div>`:'';
  return (f.length?`<div class="docfoot">${f.map(x=>`<div>${esc(x.text)}</div>`).join('')}</div>`:'')+mark}

/* ---------- printable / shareable view for documents ---------- */
function shareUrl(tok){return location.origin+location.pathname+'#/share/'+tok}
function docView(V,type,x,opt={}){
  const D=DOCS[type],b=S.biz,shared=!!opt.shared,cur=esc(curLabel(docCur(x)));
  const bizBlock=`<div>${setting('logo')?`<img class="doclogo" src="${esc(setting('logo'))}" alt="">`:''}<b style="font:700 18px var(--body)">${esc(b.name)}</b><div class="muted" style="white-space:pre-line">${esc(setting('address')||'')}</div><div class="muted">${esc([setting('phone'),setting('email')].filter(Boolean).join(' · '))}</div>${setting('taxNumber')?`<div class="muted"><span>Tax number</span>: ${esc(setting('taxNumber'))}</div>`:''}</div>`;
  let title,party='',metaRows=[],table='',totals='',extra='',actions='';
  if(D){
    const p=R(D.party,x[D.party]);title=D.print;
    party=`<div><div class="muted small">${D.party==='customer'?'Bill to':'Supplier'}</div><b>${esc(nm(p))}</b><div style="white-space:pre-line">${esc(p&&p.address||'')}</div>${p&&p.taxNumber?`<div class="muted"><span>Tax number</span>: ${esc(p.taxNumber)}</div>`:''}</div>`;
    metaRows=[['Number',x.ref],['Issue date',fmtD(x.date)]];if(D.due&&x.dueDate)metaRows.push([D.due,fmtD(x.dueDate)]);
    if(D.link&&x.invoice&&!shared){const i=R(D.link,x.invoice);if(i)metaRows.push([DOCS[D.link].one,'#'+i.ref])}
    if(x.project&&!shared){const pj=R('project',x.project);if(pj)metaRows.push(['Project',pj.name])}
    const anyDisc=(x.lines||[]).some(l=>+l.disc),anyTax=(x.lines||[]).some(l=>l.tax);
    table=`<thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th>${anyDisc?'<th class="num">Disc %</th>':''}${anyTax?'<th>Tax</th>':''}<th class="num">Amount</th></tr></thead><tbody>${(x.lines||[]).map(l=>`<tr><td>${esc(l.desc||nm(R('item',l.item)))}</td><td class="num">${fmtQ(qtyOf(l))}</td><td class="num">${fmt(l.price)}</td>${anyDisc?`<td class="num">${l.disc||''}</td>`:''}${anyTax?`<td>${esc(nm(R('taxcode',l.tax)))}</td>`:''}<td class="num">${fmt(lineCalc(l).net)}</td></tr>`).join('')}</tbody>`;
    const t=docTotals(x);totals=`<div class="totals"><span>Subtotal</span><b>${fmt(t.net)}</b>${t.tax?`<span>Tax</span><b>${fmt(t.tax)}</b>`:''}<span><b style="font-family:var(--body)">Total ${cur}</b></span><b>${fmt(t.total)}</b>`;
    if(D.status&&!shared){const s=invoiceStatus(D.side)[x.id];totals+=`<span>Paid</span><b>${fmt(s.paid)}</b><span><b style="font-family:var(--body)">Balance due</b></span><b>${fmt(s.due)}</b></div><p class="noprint">${statusTag(s)}</p>`;
      if(s.due>0&&canWrite(type==='salesinvoice'?'receipt':'payment'))actions+=`<button class="btn primary" type="button" id="payBtn">${type==='salesinvoice'?'Receive payment':'Pay this invoice'}</button>`;
      if(canWrite(D.side==='sales'?'creditnote':'debitnote'))actions+=`<button class="btn" type="button" id="noteBtn">${D.side==='sales'?'Credit note':'Debit note'}</button>`;
      if(canWrite(D.side==='sales'?'deliverynote':'goodsreceipt')&&(x.lines||[]).some(l=>R('item',l.item)&&R('item',l.item).track))actions+=`<button class="btn" type="button" id="dnBtn">${D.side==='sales'?'Delivery note':'Goods receipt'}</button>`;
      if(type==='salesinvoice'&&canWrite('recurringinvoice'))actions+=`<button class="btn" type="button" id="recBtn">Make recurring</button>`}
    else totals+='</div>';
    if(!shared&&['quote','salesorder','purchaseorder'].includes(type)&&canWrite(type==='purchaseorder'?'purchaseinvoice':'salesinvoice'))actions+=`<button class="btn primary" type="button" id="convBtn">${type==='purchaseorder'?'Copy to purchase invoice':'Copy to sales invoice'}</button>`;
    if(!shared&&type==='quote'&&canWrite('salesorder'))actions+=`<button class="btn" type="button" id="soBtn">Copy to sales order</button>`;
    if(!shared&&['salesorder','purchaseorder'].includes(type)&&canWrite(type==='salesorder'?'deliverynote':'goodsreceipt'))actions+=`<button class="btn" type="button" id="dnBtn">${type==='salesorder'?'Delivery note':'Goods receipt'}</button>`;
    if(x.notes)extra=`<p style="white-space:pre-line;margin-top:24px">${esc(x.notes)}</p>`;
    if(D.share&&!shared&&canWrite(type))actions+=`<button class="btn" type="button" id="shareBtn">Share</button>`;
  }else if(type==='receipt'||type==='payment'){
    title=type==='receipt'?'RECEIPT':'PAYMENT';
    party=`<div><div class="muted small">${type==='receipt'?'Received from':'Paid to'}</div><b>${esc(x.contact)}</b></div>`;
    metaRows=[['Number',x.ref],['Date',fmtD(x.date)],[type==='receipt'?'Received in':'Paid from',nm(R('bank',x.bank))]];
    table=`<thead><tr><th>Account</th><th>Description</th><th class="num">Amount</th></tr></thead><tbody>${(x.lines||[]).map(l=>{const i=l.invoice&&(R('salesinvoice',l.invoice)||R('purchaseinvoice',l.invoice)||R('ticket',l.invoice)),lk=String(l.invoice||'').startsWith('ob:')?'Starting balance':i?(R('ticket',l.invoice)?'Ticket #'+i.ref:'#'+i.ref):'';return `<tr><td>${esc(keyName(l.account))}${lk?` <span class="muted">· ${esc(lk)}</span>`:''}</td><td>${esc(l.desc)}</td><td class="num">${fmt(l.amount)}</td></tr>`}).join('')}</tbody>`;
    totals=`<div class="totals"><span><b style="font-family:var(--body)">Total ${cur}</b></span><b>${fmt(sumLines(x.lines))}</b></div>`;
    if(x.desc)extra=`<p>${esc(x.desc)}</p>`;
    extra+=`<div class="sig"><div>Prepared by</div><div>${type==='receipt'?'Received by':'Approved by'}</div></div>`;
  }else if(type==='payslip'){
    const e=R('employee',x.employee),g=sumLines(x.earnings),dd=sumLines(x.deductions);title='PAYSLIP';
    party=`<div><div class="muted small">Employee</div><b>${esc(nm(e))}</b><div class="muted">${esc(e&&e.code||'')}</div></div>`;
    metaRows=[['Number',x.ref],['Date',fmtD(x.date)]];if(x.desc)metaRows.push(['Pay period',x.desc]);
    table=`<thead><tr><th>Earnings</th><th class="num">Amount</th></tr></thead><tbody>${(x.earnings||[]).map(l=>`<tr><td>${esc(l.desc||keyName(l.account))}</td><td class="num">${fmt(l.amount)}</td></tr>`).join('')}<tr class="tot"><td>Gross pay</td><td class="num">${fmt(g)}</td></tr></tbody>
      <thead><tr><th>Deductions</th><th class="num">Amount</th></tr></thead><tbody>${(x.deductions||[]).map(l=>`<tr><td>${esc(l.desc||keyName(l.account))}</td><td class="num">${fmt(l.amount)}</td></tr>`).join('')||'<tr><td class="muted">None</td><td></td></tr>'}<tr class="tot"><td>Total deductions</td><td class="num">${fmt(dd)}</td></tr></tbody>`;
    totals=`<div class="totals"><span><b style="font-family:var(--body)">Net pay ${esc(BASE())}</b></span><b>${fmt(g-dd)}</b></div>`;
    extra=`<div class="sig"><div>Employer</div><div>Employee</div></div>`;
  }else if(type==='deliverynote'||type==='goodsreceipt'){
    const isD=type==='deliverynote',pt=isD?'customer':'supplier',p=R(pt,x[pt]);title=isD?'DELIVERY NOTE':'GOODS RECEIPT';
    party=`<div><div class="muted small">${isD?'Deliver to':'Received from'}</div><b>${esc(nm(p))}</b><div style="white-space:pre-line">${esc(x.address||p&&p.address||'')}</div></div>`;
    metaRows=[['Number',x.ref],['Date',fmtD(x.date)]];
    table=`<thead><tr><th>Code</th><th>Item</th><th>Description</th><th class="num">Qty</th></tr></thead><tbody>${(x.lines||[]).map(l=>{const it=R('item',l.item);return `<tr><td class="mono">${esc(it&&it.code||'')}</td><td>${esc(nm(it))}</td><td>${esc(l.desc)}</td><td class="num">${fmtQ(qtyOf(l))} ${esc(it&&it.unit||'')}</td></tr>`}).join('')}</tbody>`;
    if(x.desc)extra=`<p>${esc(x.desc)}</p>`;extra+=`<div class="sig"><div>${isD?'Delivered by':'Checked by'}</div><div>${isD?'Received by':'Signature'}</div></div>`;
  }else if(type==='exchange'){
    const gc=curLabel(bankCur(x.giveBank)),rc=curLabel(bankCur(x.recvBank));title='EXCHANGE RECEIPT';
    party=`<div><div class="muted small">Customer</div><b>${esc(x.customer||'—')}</b>${x.phone?`<div dir="ltr" style="text-align:start">${esc(x.phone)}</div>`:''}${x.idNo?`<div class="muted"><span>ID</span>: ${esc(x.idNo)}</div>`:''}</div>`;
    metaRows=[['Number',x.ref],['Date',fmtD(x.date)]];
    table=`<thead><tr><th>Description</th><th class="num">Amount</th><th>Currency</th></tr></thead><tbody><tr><td>Customer gives</td><td class="num">${fmt(x.give)}</td><td>${esc(gc)}</td></tr><tr><td>Customer receives</td><td class="num">${fmt(x.recv)}</td><td>${esc(rc)}</td></tr></tbody>`;
    totals=`<div class="totals"><span>Rate</span><b>1 ${esc(gc)} = ${fmtR(x.recv/x.give)} ${esc(rc)}</b></div>`;
    extra=`<div class="sig"><div>Prepared by</div><div>Customer signature</div></div>`;
    if(!shared){const T=lookupOr,msg=[b.name,T('Exchange receipt')+' #'+x.ref,T('Date')+': '+fmtD(x.date),T('Customer gives')+': '+fmt(x.give)+' '+gc,T('Customer receives')+': '+fmt(x.recv)+' '+rc,T('Rate')+': 1 '+gc+' = '+fmtR(x.recv/x.give)+' '+rc,setting('phone')?'☎ '+setting('phone'):''].filter(Boolean).join('\n');
      actions+=`<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${String(x.phone||'').replace(/[^\d]/g,'')}?text=${encodeURIComponent(msg)}">WhatsApp</a>`}
  }else if(type==='hawala'){
    const inb=x.dir==='in',cur=curLabel(recCur(R('supplier',x.partner))),com=r2(x.commission);title=inb?'HAWALA – PAY OUT':'HAWALA TRANSFER';
    party=`<div style="display:flex;gap:32px;flex-wrap:wrap"><div><div class="muted small">Sender</div><b>${esc(x.sender||'—')}</b>${x.senderPhone?`<div dir="ltr" style="text-align:start">${esc(x.senderPhone)}</div>`:''}${x.fromCity?`<div class="muted">${esc(x.fromCity)}</div>`:''}</div>
      <div><div class="muted small">Receiver</div><b>${esc(x.receiver||'')}</b>${x.receiverPhone?`<div dir="ltr" style="text-align:start">${esc(x.receiverPhone)}</div>`:''}${x.toCity?`<div class="muted">${esc(x.toCity)}</div>`:''}</div></div>`;
    metaRows=[['Number',x.ref],['Date',fmtD(x.date)],['Transfer code',x.code||''],['Status',x.status==='paid'?'Paid':'Pending']];if(x.status==='paid'&&x.paidDate)metaRows.push(['Paid on',fmtD(x.paidDate)]);
    table=`<thead><tr><th>Description</th><th class="num">Amount ${esc(cur)}</th></tr></thead><tbody><tr><td>${inb?'Amount to pay the receiver':'Amount the receiver gets'}</td><td class="num">${fmt(x.amount)}</td></tr>${!inb&&com?`<tr><td>Commission</td><td class="num">${fmt(com)}</td></tr>`:''}</tbody>`;
    totals=inb?'':`<div class="totals"><span><b style="font-family:var(--body)">Total paid ${esc(cur)}</b></span><b>${fmt(r2(x.amount)+com)}</b></div>`;
    extra=`<div class="sig"><div>Prepared by</div><div>${inb?'Receiver signature':'Sender signature'}</div></div>`;
    if(!shared){if(inb&&x.status!=='paid'&&canWrite('hawala'))actions+=`<button class="btn primary" type="button" id="hwPaid">Mark as paid</button>`;
      const T=lookupOr,msg=[b.name,T('Hawala transfer')+' – '+T('Transfer code')+': '+(x.code||''),T('Amount')+': '+fmt(x.amount)+' '+cur,T('Receiver')+': '+(x.receiver||'')+(x.toCity?' ('+x.toCity+')':''),x.sender?T('Sender')+': '+x.sender:'',T('Status')+': '+T(x.status==='paid'?'Paid':'Pending'),setting('phone')?'☎ '+setting('phone'):''].filter(Boolean).join('\n');
      actions+=`<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${String((inb?x.receiverPhone:x.senderPhone)||'').replace(/[^\d]/g,'')}?text=${encodeURIComponent(msg)}">WhatsApp</a>`}
  }else if(type==='ticket'){
    const c=R('customer',x.customer),a=R('supplier',x.airline),k=ticketCalc(x),s=invoiceStatus('sales')[x.id];title='TICKET RECEIPT';
    party=`<div><div class="muted small">Passenger</div><b>${esc(x.passenger)}</b>${c&&c.kind==='agent'?`<div class="muted small" style="margin-top:8px">Agent</div><div>${esc(nm(c))}</div>`:''}</div>`;
    metaRows=[['Number',x.ref],['Issue date',fmtD(x.date)]];if(x.pnr)metaRows.push(['PNR',x.pnr]);if(x.ticketNo)metaRows.push(['Ticket number',x.ticketNo]);if(a)metaRows.push(['Airline',nm(a)]);
    table=`<thead><tr><th>Description</th><th>Route</th><th>Flight date</th><th>Return date</th><th class="num">Amount</th></tr></thead><tbody><tr><td>${tkService(x.service)}</td><td dir="ltr" style="text-align:start">${esc(x.route||'')}</td><td>${x.flightDate?fmtD(x.flightDate):''}</td><td>${x.returnDate?fmtD(x.returnDate):''}</td><td class="num">${fmt(k.sell)}</td></tr>
      ${x.refunded&&k.rc?`<tr><td>Refund</td><td></td><td>${fmtD(x.refundDate||x.date)}</td><td></td><td class="num">-${fmt(k.rc)}</td></tr>`:''}</tbody>`;
    totals=`<div class="totals"><span><b style="font-family:var(--body)">Total ${cur}</b></span><b>${fmt(k.netSell)}</b>${s?`<span>Paid</span><b>${fmt(s.paid)}</b><span><b style="font-family:var(--body)">Balance due</b></span><b>${fmt(s.due)}</b>`:''}</div>`+(x.refunded?'<p><span class="tag">Refunded</span></p>':s?`<p class="noprint">${statusTag(s)}</p>`:'');
    if(!(setting('footers')||[]).length&&setting('invoiceFooter'))extra=`<p style="white-space:pre-line;margin-top:24px">${esc(setting('invoiceFooter'))}</p>`;
    extra+=`<div class="sig"><div>Prepared by</div><div>Passenger signature</div></div>`;
    if(!shared){
      if(s&&s.due>0&&canWrite('receipt'))actions+=`<button class="btn primary" type="button" id="tkPayV">Receive payment</button>`;
      if(x.refunded){const rf=ticketRefund(x);
        if(rf.custOwed>0&&canWrite('payment'))actions+=`<button class="btn primary" type="button" id="tkRefC">Pay refund to customer</button>`;
        if(rf.airlineOwes>0&&canWrite('receipt'))actions+=`<button class="btn" type="button" id="tkRefA">Receive refund from airline</button>`;
        extra+=`<div class="refbox noprint"><h3>Refund</h3><table class="paysum"><tbody>
          <tr><th scope="row">Refund to customer</th><td>${fmt(rf.toCustomer)} ${esc(cur)}</td></tr>
          <tr><th scope="row">Customer had paid</th><td>${fmt(rf.custPaid)} ${esc(cur)}</td></tr>
          <tr><th scope="row">Paid back</th><td>${fmt(rf.paidBack)} ${esc(cur)}</td></tr>
          <tr class="paytotal"><th scope="row">Still to pay back</th><td>${fmt(rf.custOwed)} ${esc(cur)}</td></tr>
          <tr><th scope="row">Refund from airline</th><td>${fmt(rf.fromAirline)} ${esc(cur)} · <span>received</span> ${fmt(rf.received)} · <span>still to receive</span> ${fmt(rf.airlineOwes)}</td></tr></tbody></table>
          ${rf.custOwed<=0&&rf.toCustomer>0&&rf.paidBack<=0?'<p class="muted small">Nothing to pay back: the customer had not paid more than the new price, so the refund only lowers what they owe.</p>':''}</div>`}
      else if(canWrite('ticket'))actions+=`<button class="btn" type="button" id="tkCancel">Cancel / refund</button>`;
      const phone=String(c&&c.phone||'').replace(/[^\d]/g,'');
      const T=lookupOr,L2=(k,v)=>v?T(k)+': '+v:'';
      const msg=[b.name,T('Ticket receipt')+' #'+x.ref,L2('Passenger',x.passenger),L2('PNR',x.pnr),L2('Ticket number',x.ticketNo),L2('Airline',a&&nm(a)),L2('Route',x.route),L2('Flight date',x.flightDate&&fmtD(x.flightDate)),L2('Return date',x.returnDate&&fmtD(x.returnDate)),
        L2('Total',fmt(k.netSell)+' '+curLabel(docCur(x))),s?L2('Paid',fmt(s.paid)):'',s?L2('Balance due',fmt(s.due)):'',x.refunded?T('Refunded'):'',setting('phone')?'☎ '+setting('phone'):''].filter(Boolean).join('\n');
      actions+=`<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${phone}?text=${encodeURIComponent(msg)}">WhatsApp</a>`;
    }
  }
  metaRows=metaRows.concat(cfPrintRows(type,x));
  V.innerHTML=`${shared?'':`<div class="head noprint"><a href="#/${type}" class="small">← ${esc(TITLES[type])}</a><div class="tools">${actions}${canWrite(type)?`<a class="btn" href="#/${type}/edit/${x.id}">Edit</a>`:''}${IN_FRAME?'':'<button class="btn" type="button" id="prt">Print / PDF</button>'}</div></div><div id="shareBox"></div>`}
  ${shared&&!IN_FRAME?'<div class="head noprint"><span></span><div class="tools"><button class="btn" type="button" id="prt">Print / PDF</button></div></div>':''}
  <div class="card doc"><div class="dh">${bizBlock}<div class="dt">${title}</div></div>
   <div class="parties">${party}<dl class="kv">${metaRows.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>
   <div class="scroll"><table>${table}</table></div>${totals}${extra}${docFooters(type)}</div>
  ${shared?'':`<p class="meta noprint">${x._u?`Last changed ${fmtDT(x._u)}${x._by?' by '+esc(x._by):''}`:''}${canAdmin()?` · <a href="#/history/record/${x.id}">History</a>`:''}</p>`}`;
  const on=(sel,fn)=>{const e=$(sel);if(e)e.onclick=fn};
  on('#prt',()=>window.print());
  if(shared)return;
  if(!NO_ATT.includes(type)){V.insertAdjacentHTML('beforeend',attachCardHtml());attachMount(type,x.id)}
  on('#hwPaid',()=>{const pc=recCur(R('supplier',x.partner)),bank=x.bank&&bankCur(x.bank)===pc?x.bank:(L('bank').find(k=>recCur(k)===pc&&k.type==='cash')||L('bank').find(k=>recCur(k)===pc)||{}).id;
    if(!bank){toast(lookupOr('Add a cash account in this currency first.'));return}
    confirmBox(`${lookupOr('Pay')} ${fmt(x.amount)} ${curLabel(pc)} ${lookupOr('to')} ${x.receiver||''} ${lookupOr('from')} ${nm(R('bank',bank))}?`,async()=>{try{await saveRec('hawala',Object.assign({},x,{status:'paid',paidDate:today(),bank}),false);toast(lookupOr('Marked as paid'));router()}catch(e){}},lookupOr('Mark as paid'))});
  on('#tkCancel',()=>{App.openRefund=x.id;go('#/ticket/edit/'+x.id)});
  on('#tkRefC',()=>refundToCustomer(x));
  on('#tkRefA',()=>refundFromAirline(x));
  on('#tkPayV',()=>{const s=invoiceStatus('sales')[x.id],c=R('customer',x.customer);const bank=L('bank').find(k=>recCur(k)===docCur(x))||L('bank')[0],bc=recCur(bank),amt=bc===docCur(x)?s.due:r2(s.due*docRate(x)/curRate(bc));
    App.prefill={type:'receipt',data:{bank:bank?bank.id:'',contact:nm(c),desc:'Ticket '+x.ref+' – '+x.passenger,lines:[{account:'ar:'+x.customer,invoice:x.id,amount:amt}]}};go('#/receipt/new')});
  on('#payBtn',()=>{const s=invoiceStatus(D.side)[x.id],t=type==='salesinvoice'?'receipt':'payment',p=R(D.party,x[D.party]);
    const bank=L('bank').find(k=>recCur(k)===docCur(x))||L('bank')[0];
    const bc=recCur(bank),amt=bc===docCur(x)?s.due:r2(s.due*docRate(x)/curRate(bc));
    App.prefill={type:t,data:{bank:bank?bank.id:'',contact:nm(p),desc:`${D.one} #${x.ref}`,lines:[{account:(D.side==='sales'?'ar:':'ap:')+x[D.party],invoice:x.id,desc:'',amount:amt}]}};go(`#/${t}/new`)});
  on('#noteBtn',()=>{const t=D.side==='sales'?'creditnote':'debitnote';App.prefill={type:t,data:{[D.party]:x[D.party],invoice:x.id,desc:`#${x.ref}`,lines:JSON.parse(JSON.stringify(x.lines||[]))}};go(`#/${t}/new`)});
  on('#convBtn',()=>{const t=type==='purchaseorder'?'purchaseinvoice':'salesinvoice',p=R(D.party,x[D.party]);App.prefill={type:t,data:{[D.party]:x[D.party],desc:x.desc,notes:x.notes||'',project:x.project||'',dueDate:p&&p.terms?addDays(today(),p.terms):'',lines:JSON.parse(JSON.stringify(x.lines||[]))}};go(`#/${t}/new`)});
  on('#soBtn',()=>{App.prefill={type:'salesorder',data:{customer:x.customer,desc:x.desc,notes:x.notes||'',lines:JSON.parse(JSON.stringify(x.lines||[]))}};go('#/salesorder/new')});
  on('#dnBtn',()=>{const t=D.side==='sales'?'deliverynote':'goodsreceipt';App.prefill={type:t,data:{[D.party]:x[D.party],desc:`${D.one} #${x.ref}`,lines:(x.lines||[]).filter(l=>R('item',l.item)&&R('item',l.item).track).map(l=>({item:l.item,desc:l.desc,qty:qtyOf(l)}))}};go(`#/${t}/new`)});
  on('#recBtn',()=>{App.prefill={type:'recurringinvoice',data:{customer:x.customer,desc:x.desc,notes:x.notes||'',project:x.project||'',lines:JSON.parse(JSON.stringify(x.lines||[])),nextDate:advanceDate(x.date,'month',1),dueDays:x.dueDate?Math.max(0,daysBetween(x.date,x.dueDate)):15}};go('#/recurringinvoice/new')});
  on('#shareBtn',async()=>{let tok=x.shareToken;
    if(!tok){tok=(newId()+newId()).replace(/-/g,'').slice(0,32);try{const row=await saveRec(type,Object.assign({},x,{shareToken:tok}),false);x._u=row.updated_at;x.shareToken=tok}catch(e){return}}
    const url=shareUrl(tok),p=R(D.party,x[D.party]),msg=`${b.name} – ${D.one} #${x.ref}: ${url}`;const phone=String(p&&p.phone||'').replace(/[^\d]/g,'');
    $('#shareBox').innerHTML=`<div class="card pad noprint" style="margin-bottom:16px"><h2>Share this ${esc(D.one.toLowerCase())}</h2><p class="muted small" style="margin-top:0">Anyone with this link can view and print it. They do not need an account.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><input id="shUrl" value="${esc(url)}" readonly style="flex:1;min-width:220px"><button class="btn" type="button" id="shCopy">Copy link</button>
      <a class="btn" target="_blank" rel="noopener" href="https://wa.me/${phone}?text=${encodeURIComponent(msg)}">WhatsApp</a><a class="btn" href="mailto:${encodeURIComponent(p&&p.email||'')}?subject=${encodeURIComponent(b.name+' – '+D.one+' #'+x.ref)}&body=${encodeURIComponent(msg)}">Email</a>
      <button class="btn danger" type="button" id="shStop">Stop sharing</button></div></div>`;
    $('#shCopy').onclick=()=>{navigator.clipboard.writeText(url).then(()=>toast('Link copied'),()=>{$('#shUrl').select();toast('Press Ctrl+C / Cmd+C to copy')})};
    $('#shStop').onclick=async()=>{try{await saveRec(type,Object.assign({},R(type,x.id),{shareToken:''}),false);toast('Link turned off');router()}catch(e){}}});
}

/* ---------- delete a customer/supplier together with every transaction that uses them ---------- */
function partyRelated(type,id){
  const key=(type==='customer'?'ar:':'ap:')+id,out=[];
  ['receipt','payment','expenseclaim'].forEach(t=>L(t).forEach(r=>{if((r.lines||[]).some(l=>l.account===key))out.push([t,r])}));
  L('journal').forEach(j=>{if((j.lines||[]).some(l=>l.account===key))out.push(['journal',j])});
  const docs=type==='customer'?['quote','salesorder','salesinvoice','recurringinvoice','creditnote','deliverynote']:['purchaseorder','purchaseinvoice','debitnote','goodsreceipt'];
  docs.forEach(t=>L(t).forEach(d=>{if(d[type]===id)out.push([t,d])}));
  L('ticket').forEach(t=>{if(t[type==='customer'?'customer':'airline']===id)out.push(['ticket',t])});
  if(type==='supplier')L('hawala').forEach(h=>{if(h.partner===id)out.push(['hawala',h])});
  return out;
}
function partyDeleteAll(type,p){
  if(!canAdmin()){toast('Only administrators can do this.');return}
  const rel=partyRelated(type,p.id);
  const lockedOnes=rel.filter(([,r])=>locked(r.date));
  if(lockedOnes.length){toast(`Books are locked up to ${fmtD(setting('lockDate'))}. Change the lock date in Settings first.`);return}
  const counts={};rel.forEach(([t])=>counts[t]=(counts[t]||0)+1);
  const list=Object.entries(counts).map(([t,n])=>`${n} × ${TITLES[t]||t}`).join(', ')||'no transactions';
  const m=$('#modal');
  m.innerHTML=`<div class="card" role="dialog" aria-modal="true"><h2 style="margin-top:0">Delete ${esc(p.name)}?</h2>
    <p>This permanently deletes <b>${esc(p.name)}</b> and <b>${rel.length}</b> transactions (${esc(list)}). Your totals will change. This cannot be undone.</p>
    <label class="f">Type the name to confirm<input id="delName" autocomplete="off"></label>
    <div class="actions" style="justify-content:flex-end"><div><button class="btn" id="mNo" type="button">Cancel</button><button class="btn danger" id="mYes" type="button" disabled>Delete everything</button></div></div></div>`;
  m.hidden=false;$('#delName').focus();
  $('#delName').oninput=()=>{$('#mYes').disabled=val('delName').toLowerCase()!==String(p.name).trim().toLowerCase()};
  $('#mNo').onclick=()=>m.hidden=true;
  $('#mYes').onclick=async()=>{const b=$('#mYes');b.disabled=true;$('#mNo').disabled=true;let n=0;
    try{for(const [,r] of rel){b.textContent=`Deleting ${++n} of ${rel.length}…`;await deleteRec(r.id)}
      await deleteRec(p.id);m.hidden=true;toast(`Deleted ${p.name} and ${rel.length} transactions`);go('#/'+type)}
    catch(e){m.hidden=true;toast('Stopped: some items could not be deleted. Open the list and try again.');router()}};
}
