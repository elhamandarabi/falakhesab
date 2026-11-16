/* ================= Falak Hesab — languages (English, Dari, Pashto, Turkish) ================= */
const LANGS={en:'English',fa:'دری',ps:'پښتو',tr:'Türkçe'};
let LANG=(()=>{const l=ls.get('falak_lang');return LANGS[l]?l:'en'})();
const I18N=window.FALAK_I18N||{dict:{},patterns:[]};
function lookup(k,depth=0){
  const d=I18N.dict[k];if(d&&d[LANG])return d[LANG];
  for(const p of I18N.patterns){const m=k.match(p.re);if(m&&p[LANG]){const v=p[LANG];return typeof v==='function'?v(m,lookupOr):k.replace(p.re,v)}}
  if(depth>2)return null;
  const pre=k.match(/^([+←✓•]\s?)(.+)$/);if(pre){const t=lookup(pre[2],depth+1);if(t)return (LANG==='fa'||LANG==='ps'?pre[1].replace('←','→'):pre[1])+t}
  for(const sep of [' – ',' · ']){if(k.includes(sep)){const parts=k.split(sep),ts=parts.map(x=>lookup(x.trim(),depth+1));if(ts.some(Boolean))return parts.map((x,i)=>ts[i]||x).join(sep)}}
  return null;
}
const lookupOr=k=>lookup(k)||k;
function trText(s){
  if(LANG==='en'||!s)return null;const k=s.trim();if(!k)return null;
  const t=lookup(k);return t==null?null:s.replace(k,t);
}
const SKIP={SCRIPT:1,STYLE:1,TEXTAREA:1,PRE:1};
// remember the English text of every node we translate, so switching language again (or back to English) works
const _orig=new WeakMap(),_origA=new WeakMap();
function trNode(n){const o=_orig.get(n);const en=o&&o[1]===n.nodeValue?o[0]:n.nodeValue;const t=LANG==='en'?en:trText(en);const v=t==null?en:t;if(v!==en)_orig.set(n,[en,v]);else _orig.delete(n);if(v!==n.nodeValue)n.nodeValue=v}
function trAttr(el,a){const v=el.getAttribute(a);if(!v)return;const m=_origA.get(el)||{};const o=m[a];const en=o&&o[1]===v?o[0]:v;const t=LANG==='en'?en:trText(en);const nv=t==null?en:t;if(nv!==en){m[a]=[en,nv];_origA.set(el,m)}else if(m[a])delete m[a];if(nv!==v)el.setAttribute(a,nv)}
function translateTree(root,force){
  if((LANG==='en'&&!force)||!root)return;
  if(root.nodeType===3){trNode(root);return}
  if(root.nodeType!==1||SKIP[root.tagName]||(root.closest&&root.closest('.notr')))return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>{const p=n.parentElement;return(!p||SKIP[p.tagName]||p.closest('.notr'))?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}});
  const nodes=[];while(w.nextNode())nodes.push(w.currentNode);
  nodes.forEach(trNode);
  const els=[root,...root.querySelectorAll('[placeholder],[aria-label],[title]')];
  els.forEach(el=>{if(!el.getAttribute||el.closest('.notr'))return;['placeholder','aria-label','title'].forEach(a=>trAttr(el,a))});
}
const _obs=new MutationObserver(ms=>{if(LANG==='en')return;ms.forEach(m=>{if(m.type==='childList')m.addedNodes.forEach(translateTree);else if(m.type==='attributes')translateTree(m.target)})});
function applyLang(){
  const rtl=LANG==='fa'||LANG==='ps';document.documentElement.lang=LANG==='fa'?'fa-AF':LANG;document.documentElement.dir=rtl?'rtl':'ltr';
  _obs.disconnect();translateTree(document.body,true);if(LANG!=='en'){_obs.observe(document.body,{childList:true,subtree:true})}
}
function setLang(l){if(!LANGS[l]||l===LANG)return;LANG=l;ls.set('falak_lang',l);applyLang();router({keepScroll:true})}
const langPicker=id=>`<select id="${id}" class="notr langsel" aria-label="Language">${Object.entries(LANGS).map(([k,v])=>`<option value="${k}" ${k===LANG?'selected':''}>${v}</option>`).join('')}</select>`;
function bindLangPicker(id){const s=document.getElementById(id);if(s)s.onchange=()=>setLang(s.value)}
