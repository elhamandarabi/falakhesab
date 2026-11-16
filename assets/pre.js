/* Falak Hesab: runs before the page is drawn. The home page and the Privacy/Terms pages are built into the HTML
   (so search engines and people without JavaScript can read them). Everywhere else — the app, sign-in, company
   addresses, the demo, other languages, signed-in people — that built-in copy is hidden until the app takes over. */
(function(){var d=document.documentElement,l=location,h=l.hash,p=l.pathname.replace(/\/index\.html$/,'/'),show=false;
  d.className+=' js';
  try{
    var lang=localStorage.getItem('falak_lang'),signed=false;
    for(var i=0;i<localStorage.length;i++){if(/^sb-.*-auth-token$/.test(localStorage.key(i))){signed=true;break}}
    var noHash=!h||h==='#'||h==='#/';
    if(l.protocol!=='file:'&&!/[?&]demo/.test(l.search)&&(!lang||lang==='en')){
      if(p==='/'&&((noHash&&!signed)||/^#\/home/.test(h)))show=true;
      if(/^\/(privacy|terms)\/?$/.test(p)&&noHash)show=true;
    }
  }catch(e){}
  if(!show)d.className+=' nopre';
})();
