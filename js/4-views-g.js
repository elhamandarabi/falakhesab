/* ================= Falak Hesab — custom fields and attachments ================= */

/* ---------- custom fields (Settings → Custom fields; values stored in record.data.cf) ---------- */
const CF_TYPES=[['customer','Customers'],['supplier','Suppliers'],['item','Inventory Items'],['employee','Employees'],['project','Projects'],['fixedasset','Fixed Assets'],
  ['quote','Sales Quotes'],['salesorder','Sales Orders'],['salesinvoice','Sales Invoices'],['creditnote','Credit Notes'],['purchaseorder','Purchase Orders'],['purchaseinvoice','Purchase Invoices'],
  ['debitnote','Debit Notes'],['receipt','Receipts'],['payment','Payments'],['ticket','Tickets']];
const CF_KINDS=[['text','Text'],['number','Number'],['date','Date'],['select','Drop-down list'],['textarea','Long text']];
const cfFor=type=>(setting('customFields')||[]).filter(f=>f.type===type&&String(f.label||'').trim());
const cfVal=(f,v)=>v==null||v===''?'':f.kind==='date'?fmtD(v):f.kind==='number'?fmtQ(+v):String(v);
function cfInputs(type,rec){const fs=cfFor(type);if(!fs.length)return'';const v=(rec&&rec.cf)||{};
  return `<div class="cfbox"><div class="muted small cfh">Custom fields</div><div class="grid">${fs.map(f=>{const id='cf_'+f.id,cur=v[f.id]??'';
    const inner=f.kind==='select'?`<select id="${id}"><option value=""></option>${(f.options||[]).map(o=>`<option ${String(cur)===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`
      :f.kind==='textarea'?`<textarea id="${id}">${esc(cur)}</textarea>`
      :inp(id,cur,`type="${f.kind==='number'?'number':f.kind==='date'?'date':'text'}" ${f.kind==='number'?'step="any"':''}`);
    return fld(`<span class="notr">${esc(f.label)}</span>`,inner,f.kind==='textarea'?'span2':'')}).join('')}</div></div>`}
function cfRead(type,rec){const fs=cfFor(type),out=Object.assign({},(rec&&rec.cf)||{});if(!fs.length)return rec&&rec.cf?out:null;
  fs.forEach(f=>{const e=$('#cf_'+f.id);if(!e)return;const x=String(e.value).trim();if(x==='')delete out[f.id];else out[f.id]=f.kind==='number'?+x:x});
  return Object.keys(out).length?out:null}
const cfPrintRows=(type,x)=>cfFor(type).filter(f=>f.print&&(x.cf||{})[f.id]!=null&&(x.cf||{})[f.id]!=='').map(f=>[f.label,cfVal(f,x.cf[f.id])]);
const cfListCols=type=>cfFor(type).filter(f=>f.list).map(f=>({h:`<span class="notr">${esc(f.label)}</span>`,num:f.kind==='number',f:r=>`<span class="notr">${esc(cfVal(f,(r.cf||{})[f.id]))}</span>`}));

function cfSettingsCard(ad){return `<div class="card pad" id="cfCard"><h2>Custom fields</h2><p class="muted" style="margin-top:0">Add your own boxes to customers, invoices, tickets and more. For example: passport number, national ID, file number or branch.</p>
  <div id="cfList"></div>${ad?'<div class="actions" style="justify-content:flex-start"><div><button class="btn" type="button" id="cfAdd">+ Add custom field</button><button class="btn primary" type="button" id="cfSave">Save custom fields</button></div></div>':''}</div>`}
function cfSettingsBind(ad,saveSettings){
  let fs=JSON.parse(JSON.stringify(setting('customFields')||[]));
  const docTypes=new Set(Object.keys(DOCS||{}).concat(['receipt','payment','ticket']));
  const render=()=>{$('#cfList').innerHTML=fs.map((f,i)=>`<div class="ftitem" data-i="${i}"><div class="grid">
      ${fld('Where',`<select data-k="type">${CF_TYPES.map(([k,l])=>`<option value="${k}" ${f.type===k?'selected':''}>${l}</option>`).join('')}</select>`)}
      ${fld('Name of the field',`<input data-k="label" value="${esc(f.label||'')}" placeholder="e.g. Passport number">`)}
      ${fld('Kind',`<select data-k="kind">${CF_KINDS.map(([k,l])=>`<option value="${k}" ${f.kind===k?'selected':''}>${l}</option>`).join('')}</select>`)}
      ${f.kind==='select'?fld('Choices (one per line)',`<textarea data-k="options">${esc((f.options||[]).join('\n'))}</textarea>`):''}</div>
      <div class="perm" style="margin-top:8px"><label class="c"><input type="checkbox" data-k="list" ${f.list?'checked':''}> Show as a column in the list</label>${docTypes.has(f.type)?`<label class="c"><input type="checkbox" data-k="print" ${f.print?'checked':''}> Show on printed documents</label>`:''}</div>
      ${ad?`<button class="btn danger sm" type="button" data-del="${i}" style="margin-top:8px">Remove field</button>`:''}</div>`).join('')||'<p class="muted small">No custom fields yet.</p>';
    if(!ad)$$('#cfList input,#cfList select,#cfList textarea').forEach(x=>x.disabled=true);
    $$('#cfList [data-del]').forEach(x=>x.onclick=()=>{read();fs.splice(+x.dataset.del,1);render()});
    $$('#cfList [data-k="kind"],#cfList [data-k="type"]').forEach(x=>x.onchange=()=>{read();render()})};
  const read=()=>{fs=fs.map((f,i)=>{const box=$(`#cfList .ftitem[data-i="${i}"]`),g=k=>box.querySelector(`[data-k="${k}"]`);
    return {id:f.id||newId().slice(0,8),type:g('type').value,label:g('label').value.trim(),kind:g('kind').value,
      options:g('options')?g('options').value.split('\n').map(s=>s.trim()).filter(Boolean):(f.options||[]),list:g('list').checked,print:g('print')?g('print').checked:false}})};
  render();
  const add=$('#cfAdd');if(add)add.onclick=()=>{read();fs.push({id:newId().slice(0,8),type:'customer',label:'',kind:'text',options:[],list:false,print:false});render();const l=$$('#cfList [data-k="label"]');if(l.length)l[l.length-1].focus()};
  const sv=$('#cfSave');if(sv)sv.onclick=()=>{read();const bad=fs.find(f=>f.kind==='select'&&f.label&&!(f.options||[]).length);if(bad){toast(lookupOr('Add at least one choice to each drop-down list.'));return}
    saveSettings({customFields:fs.filter(f=>f.label)},lookupOr('Custom fields saved'))};
}

/* ---------- attachments ---------- */
const ATT_ACCEPT='image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt';
const fmtSize=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
const attShown=n=>String(n).replace(/^[a-z0-9]{4,8}_/,'');
const attIcon=t=>/^image\//.test(t)?'🖼':/pdf/.test(t)?'📄':/sheet|excel|csv/.test(t)?'📊':'📎';
let ATT_QUEUE=[];                       // files picked on a new record, uploaded right after it is saved
function attachCardHtml(){return `<div class="card pad noprint" id="attCard"><div class="atthead"><h2 style="margin:0">Attachments</h2><span class="muted small" id="attInfo"></span></div>
  <div id="attList" class="attlist"><p class="muted small">Loading…</p></div>
  <label class="attdrop" id="attDrop" hidden><input type="file" id="attFile" multiple accept="${ATT_ACCEPT}" hidden><span><b>Add files</b> <span class="muted">or drop them here</span></span><span class="muted small">Photos, PDF, Word, Excel · up to ${CLOUD?'10 MB':'1 MB'} each</span></label></div>`}
async function attachMount(type,rid){
  const box=$('#attCard');if(!box)return;const can=canWrite(type)&&!(rid&&R(type,rid)&&locked(R(type,rid).date));
  const list=$('#attList'),drop=$('#attDrop'),fileIn=$('#attFile');drop.hidden=!can;
  const paint=files=>{$('#attInfo').textContent=files.length?files.length+' '+lookupOr(files.length===1?'file':'files'):'';
    list.innerHTML=files.map(f=>`<div class="attrow" data-n="${esc(f.name)}"><span class="atti" aria-hidden="true">${attIcon(f.type)}</span><button type="button" class="linkbtn notr" data-open="${esc(f.name)}">${esc(attShown(f.name))}</button><span class="muted small">${f.size?fmtSize(f.size):''}</span>${f.pending?`<span class="tag">${lookupOr('Saved with the record')}</span>`:''}${can?`<button type="button" class="btn sm danger" data-rm="${esc(f.name)}">Remove</button>`:''}</div>`).join('')||`<p class="muted small" style="margin:0">${lookupOr(can?'No files yet. Add a photo of the receipt, a PDF invoice or any other document.':'No files.')}</p>`;
    $$('#attList [data-open]').forEach(b=>b.onclick=()=>open(b.dataset.open,files.find(f=>f.name===b.dataset.open)));
    $$('#attList [data-rm]').forEach(b=>b.onclick=()=>confirmBox(lookupOr('Remove this file?'),async()=>{
      if(!rid){ATT_QUEUE=ATT_QUEUE.filter(f=>f.name!==b.dataset.rm);return load()}
      try{await API.attRemove(S.biz.id,rid,[b.dataset.rm]);toast(lookupOr('File removed'));load()}catch(e){toast(e.message)}},lookupOr('Remove')))};
  const load=async()=>{if(!rid)return paint(ATT_QUEUE.map(f=>({name:f.name,size:f.file.size,type:f.file.type,pending:true})));
    try{paint(await API.attList(S.biz.id,rid))}catch(e){list.innerHTML=`<p class="muted small">${esc(/bucket|not found/i.test(e.message)?lookupOr('Attachments are not switched on yet. Run step 9 in Supabase first.'):e.message)}</p>`}};
  const open=async(name,f)=>{try{const blob=f&&f.pending?ATT_QUEUE.find(q=>q.name===name).file:await API.attGet(S.biz.id,rid,name);const url=URL.createObjectURL(blob);
      if(/^image\//.test(blob.type||(f&&f.type)||'')){const m=$('#modal');m.innerHTML=`<div class="card attview" role="dialog" aria-modal="true"><div class="atthead"><b class="notr">${esc(attShown(name))}</b><div><a class="btn sm" href="${url}" download="${esc(attShown(name))}">Download</a><button class="btn sm" type="button" id="attClose">Close</button></div></div><img src="${url}" alt=""></div>`;m.hidden=false;$('#attClose').onclick=()=>{m.hidden=true;URL.revokeObjectURL(url)}}
      else if(/pdf/.test(blob.type||(f&&f.type)||'')){window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),60000)}
      else{const a=document.createElement('a');a.href=url;a.download=attShown(name);document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},1000)}}catch(e){toast(e.message)}};
  const addFiles=async files=>{files=[...files];if(!files.length)return;const max=CLOUD?10485760:1048576;
    for(const f of files){if(f.size>max){toast(lookupOr(CLOUD?'That file is too large. The limit is 10 MB.':'In the demo, files can be at most 1 MB.'));continue}
      if(!rid){ATT_QUEUE.push({name:Math.random().toString(36).slice(2,8)+'_'+attSafeName(f.name),file:f});continue}
      $('#attInfo').textContent=lookupOr('Uploading…');try{await API.attUpload(S.biz.id,rid,f)}catch(e){toast(e.message)}}
    if(rid&&files.length)toast(lookupOr('Files added'));load()};
  fileIn.onchange=e=>{addFiles(e.target.files);e.target.value=''};
  ['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
  drop.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
  load();
}
async function attachFlushQueue(rid){const q=ATT_QUEUE;ATT_QUEUE=[];let n=0;for(const f of q){try{await API.attUpload(S.biz.id,rid,new File([f.file],f.file.name,{type:f.file.type}));n++}catch(e){toast(e.message)}}return n}
