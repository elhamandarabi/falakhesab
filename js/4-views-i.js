/* ================= Falak Hesab — first-business checklist and the guided demo tour ================= */

/* ---------- checklist on the Summary (owners and administrators, until done or hidden) ---------- */
function onboardSteps(){
  const ob=setting('onboard')||{},cur=setting('currency')||'USD',start=setting('startDate')||'';
  const n=t=>L(t).length,anyTx=n('salesinvoice')+n('receipt')+n('payment')+n('purchaseinvoice')+n('journal')>0;
  const opening=L('bank').some(k=>+k.opening)||L('customer').some(c=>+c.opening)||L('supplier').some(c=>+c.opening)||n('journal')>0;
  return [
    {k:'currency',done:!!ob.currency||anyTx,t:'Check your base currency',
      d:`<span>Your books are kept in</span> <b class="mono">${esc(cur)}</b>. <span>Change it in Settings before you add transactions.</span>`,
      a:[['Looks right','ob:currency'],['Open Settings','#/settings']]},
    {k:'opening',done:!!ob.noOpening||opening,t:'Add opening balances',
      d:`<span>Add your bank and cash accounts with the money they held on your start date</span>${start?` (<span class="mono">${fmtD(start)}</span>)`:''}<span>, and what customers and suppliers owed then.</span>`,
      a:[['Add bank or cash account','#/bank/new'],['New business: nothing to add','ob:noOpening']]},
    {k:'customer',done:n('customer')>0,t:'Add your first customer',d:'Sales → Customers → + New customer.',a:[['Add customer','#/customer/new']]},
    {k:'invoice',done:n('salesinvoice')>0,t:'Create your first sales invoice',d:'Choose the customer, add the lines and press Create. Then print it or share a link.',a:[['New sales invoice','#/salesinvoice/new']]},
    {k:'payment',done:n('receipt')>0,t:'Record your first payment',d:'When the customer pays, open the invoice and press Receive payment. The receipt is filled in for you.',a:[[n('salesinvoice')?'Open Sales Invoices':'New receipt',n('salesinvoice')?'#/salesinvoice':'#/receipt/new']]}];
}
function onboardHtml(){
  if(!S.biz||!canAdmin()||!planOk('write'))return '';
  const ob=setting('onboard')||{};if(ob.hidden)return '';
  const st=onboardSteps(),done=st.filter(x=>x.done).length;if(done===st.length)return '';
  const next=st.find(x=>!x.done);
  return `<section class="card pad onboard" id="onboard" aria-labelledby="obTitle"><div class="obhead"><div><h2 id="obTitle">Get your business ready</h2>
    <p class="muted small" style="margin:2px 0 0"><span class="num">${done} / ${st.length}</span> <span>steps done</span></p></div>
    <button class="btn sm" type="button" data-ob="hidden">Hide this list</button></div>
    <div class="obbar" role="progressbar" aria-valuemin="0" aria-valuemax="${st.length}" aria-valuenow="${done}" aria-label="Steps done"><i style="width:${Math.round(done/st.length*100)}%"></i></div>
    <ol class="oblist">${st.map((x,i)=>`<li class="${x.done?'done':''}${x===next?' next':''}"><span class="obmark" aria-hidden="true">${x.done?'✓':i+1}</span><div><b>${x.t}</b> ${x.done?'<span class="tag paid">Done</span>':''}
      ${x.done?'':`<p class="muted small">${x.d}</p><div class="obact">${x.a.map(([l,h],j)=>h.startsWith('ob:')?`<button class="btn sm" type="button" data-ob="${h.slice(3)}">${l}</button>`:`<a class="btn sm ${j?'':'primary'}" href="${h}">${l}</a>`).join('')}</div>`}</div></li>`).join('')}</ol></section>`;
}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-ob]');if(!b||!S.biz)return;e.preventDefault();
  const k=b.dataset.ob,ob=Object.assign({},setting('onboard')||{},{[k]:true}),settings=Object.assign({},S.biz.settings||{},{onboard:ob});
  b.disabled=true;try{await API.updateBusiness(S.biz.id,{name:S.biz.name,settings});S.biz.settings=settings;S.ver++;if(k==='hidden')toast(lookupOr('Checklist hidden'));router({keepScroll:true})}
  catch(x){b.disabled=false;toast(x.message)}});

/* ---------- public demo: two starting points ---------- */
const DEMO_KINDS={business:{name:'Example Shop (sample)',home:'#/summary'},travel:{name:'Example Travel Agency (sample)',home:'#/travel'}};
const demoKindParam=()=>{const m=/[?&]demo=([a-z]+)/.exec(location.search);return m&&DEMO_KINDS[m[1]]?m[1]:null};
async function demoSetup(){
  const y=today().slice(0,4)+'-01-01';
  for(const k of ['business','travel']){if(Demo.d.businesses.some(b=>(b.settings||{}).demo===k))continue;
    const b=await API.createBusiness(DEMO_KINDS[k].name,{currency:'USD',startDate:y,demo:k,onboard:{currency:true},...(k==='business'?{travel:false}:{}),address:'Sample business to explore Falak Hesab.\nNothing here is real or sent online.'});
    await API.insertMany(b.id,seedRows(true,{travel:k==='travel'}))}
  const want=demoKindParam(),pick=k=>Demo.d.businesses.find(b=>(b.settings||{}).demo===k);
  if(want){ls.set('falak_last',pick(want).id);if(!location.hash||location.hash==='#/')location.hash=DEMO_KINDS[want].home;App.tourAuto=want}
  else if(!ls.get('falak_last')||!Demo.d.businesses.some(b=>b.id===ls.get('falak_last'))){App.demoChoose=true}
}
function demoKind(){return S.biz&&(S.biz.settings||{}).demo||null}
function demoChooser(){
  if($('#demoPick'))return;
  const m=document.createElement('div');m.id='demoPick';m.className='tourwrap';
  m.innerHTML=`<div class="card pad demopick" role="dialog" aria-modal="true" aria-labelledby="dpT"><h2 id="dpT">Which demo do you want to see?</h2><p class="muted" style="margin-top:0">Both use sample data. Everything stays in this browser.</p>
    <div class="dpgrid">${[['business','Small business','Sales, purchases, bank and cash, stock and reports for a shop or office.'],['travel','Travel agency','Tickets, airlines, sub-agents and upcoming flights, plus all the accounting.']].map(([k,t,d])=>`<button type="button" class="card pad dpopt" data-demo="${k}"><b>${t}</b><span class="muted small">${d}</span></button>`).join('')}</div></div>`;
  document.body.appendChild(m);m.querySelector('button').focus();
  m.querySelectorAll('[data-demo]').forEach(b=>b.onclick=async()=>{const k=b.dataset.demo;m.remove();const biz=Demo.d.businesses.find(x=>(x.settings||{}).demo===k);
    if(biz){await openBusiness({...biz,role:'owner',tabs:[]});go(DEMO_KINDS[k].home);setTimeout(()=>tourStart(k),700)}});
}

/* ---------- guided walkthrough (a few steps, Next / Back / Close) ---------- */
const TOURS={
  business:[
    {go:'#/summary',el:'#view .sheet',t:'This is the Summary: your balance sheet and profit and loss, always up to date. Change the dates to see any period.'},
    {el:'#side',t:'The menu has a tab for every part of your business: money, sales, purchases, stock, payroll and reports.'},
    {go:'#/salesinvoice',el:'#view a[href="#/salesinvoice/new"]',t:'Create invoices here. Try it: you can change anything in this demo.'},
    {go:'#/bank',el:'#view .card.scroll',t:'Bank & Cash Accounts shows every account and its balance. Click one to see each movement, like a bank statement.'},
    {go:'#/reports',el:'#view .tiles',t:'Reports: profit by month, aged receivables, cash flow, statements and more. Print or export any of them.'},
    {el:'#banner a[href$="#/signup"]',t:'Ready for your own books? Create a free account. Nothing from this demo is sent online.'}],
  travel:[
    {go:'#/travel',el:'#view .kpis',t:'The Travel overview shows tickets, sales, airline costs and profit for the period.'},
    {el:()=>$$('#view .stack > .card')[0],t:'Upcoming flights for the next 7 days, with a WhatsApp reminder for each passenger.'},
    {el:()=>$$('#view .stack > .card')[2],t:'What each sub-agent owes you, and below it what you owe each airline and which tickets are still unpaid.'},
    {go:'#/ticket',el:'#view a[href="#/ticket/new"]',t:'Sell a ticket: passenger, PNR, airline, route, price and cost on one screen. The profit is calculated for you.'},
    {go:'#/reports/statements',el:'#view .card',t:'Send a sub-agent or customer their statement on WhatsApp, or print it.'},
    {el:'#banner a[href$="#/signup"]',t:'Ready for your own books? Create a free account. Nothing from this demo is sent online.'}]
};
const tourState={k:null,i:0};
function tourStart(k){k=k||demoKind();if(!TOURS[k])return;tourState.k=k;tourState.i=0;try{sessionStorage.setItem('falak_tour_'+k,'1')}catch(e){}tourShow()}
function tourEnd(){const w=$('#tour');if(w)w.remove();window.removeEventListener('resize',tourPlace);window.removeEventListener('scroll',tourPlace);tourState.k=null;const b=$('#tourBtn');if(b)b.focus()}
async function tourShow(){
  const st=TOURS[tourState.k][tourState.i];if(!st)return tourEnd();
  if(st.go&&location.hash!==st.go){location.hash=st.go;await new Promise(r=>setTimeout(r,500))}
  let w=$('#tour');if(!w){w=document.createElement('div');w.id='tour';w.innerHTML='<div class="tourring" aria-hidden="true"></div><div class="tourpop" role="dialog" aria-modal="false" aria-labelledby="tourTxt"><button type="button" class="tourx" aria-label="Close">×</button><p id="tourTxt" aria-live="polite"></p><div class="tourfoot"><span class="tourn muted small"></span><span><button type="button" class="btn" id="tourBack">Back</button> <button type="button" class="btn primary" id="tourNext">Next</button></span></div></div>';
    document.body.appendChild(w);w.querySelector('.tourx').onclick=tourEnd;$('#tourBack').onclick=()=>{tourState.i=Math.max(0,tourState.i-1);tourShow()};
    $('#tourNext').onclick=()=>{tourState.i++;tourShow()};window.addEventListener('resize',tourPlace);window.addEventListener('scroll',tourPlace,{passive:true})}
  const last=tourState.i===TOURS[tourState.k].length-1;
  $('#tourTxt').textContent=lookupOr(st.t);$('.tourn').textContent=`${tourState.i+1} / ${TOURS[tourState.k].length}`;
  $('#tourBack').disabled=tourState.i===0;$('#tourNext').textContent=lookupOr(last?'Finish':'Next');
  const el=tourEl(st);if(el)el.scrollIntoView({block:'center',behavior:'instant'});tourPlace();$('#tourNext').focus();
}
const tourEl=st=>{try{return typeof st.el==='function'?st.el():$(st.el)}catch(e){return null}};
function tourPlace(){
  const w=$('#tour');if(!w||!tourState.k)return;const st=TOURS[tourState.k][tourState.i];
  const el=tourEl(st),ring=w.querySelector('.tourring'),pop=w.querySelector('.tourpop'),r=el&&el.getBoundingClientRect();
  if(!el||!r.width||!r.height){ring.style.display='none';pop.classList.remove('sheet');pop.classList.add('center');pop.style.left=pop.style.top=pop.style.width='';return}
  ring.style.display='block';Object.assign(ring.style,{left:r.left-6+'px',top:r.top-6+'px',width:r.width+12+'px',height:r.height+12+'px'});
  pop.classList.remove('center');
  if(window.innerWidth<700){pop.classList.add('sheet');pop.style.left=pop.style.top=pop.style.width='';return}pop.classList.remove('sheet');
  const pw=Math.min(360,window.innerWidth-32),ph=pop.offsetHeight||170,below=r.bottom+12+ph<window.innerHeight;
  pop.style.width=pw+'px';pop.style.left=Math.max(16,Math.min(window.innerWidth-pw-16,r.left))+'px';
  pop.style.top=(below?r.bottom+14:Math.max(16,r.top-ph-14))+'px';
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#tour'))tourEnd()});
