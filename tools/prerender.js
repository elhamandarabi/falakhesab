// Builds the public pages into the HTML: site/index.html (home), site/privacy.html, site/terms.html.
// Run after build.sh has written site/. Needs Node + Playwright. The app still renders as before;
// assets/pre.js hides this copy wherever the app shows something else.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..'), SITE = path.join(ROOT, 'site');
const MOCK = ['mock-supabase.js', 'tests/mock-supabase.js'].map(f => path.join(ROOT, f)).find(f => fs.existsSync(f));
const types = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
const BASE = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
const server = http.createServer((q, r) => {
  let f = path.join(SITE, decodeURIComponent(q.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(200, { 'Content-Type': 'text/html' }); return r.end(BASE) }
  r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(r);
}).listen(0);
const clean = h => h
  .replace(/<select id="langSite"[\s\S]*?<\/select>/g, '')            // the language menu needs the app
  .replace(/\s(id="shotImg")/, ' $1')
  .replace(/https?:\/\/127\.0\.0\.1:\d+/g, '');
(async () => {
  const port = server.address().port, b = await chromium.launch(), out = {};
  for (const [name, url] of [['index', '/'], ['privacy', '/privacy'], ['terms', '/terms']]) {
    const p = await b.newPage();
    await p.route(/fonts\.g/, r => r.abort());
    if (MOCK) await p.route(/vendor\/supabase-/, r => r.fulfill({ body: fs.readFileSync(MOCK, 'utf8'), contentType: 'application/javascript' }));
    await p.route(/config\.js$/, r => r.fulfill({ body: "window.FALAK_CONFIG={supabaseUrl:'https://example.supabase.co',supabaseAnonKey:'k'}", contentType: 'application/javascript' }));
    await p.goto(`http://127.0.0.1:${port}${url}`); await p.waitForSelector(name === 'index' ? '#s-faq' : '.slegal');
    await p.waitForTimeout(300);
    out[name] = { html: clean(await p.$eval('#authView', e => e.innerHTML)), title: await p.title() };
    await p.close();
  }
  await b.close(); server.close();
  const page = (name, o) => {
    let h = BASE.replace('<div id="authView" hidden></div>', `<div id="authView" class="site pre">${o.html}</div>`);
    if (!h.includes('class="site pre"')) throw new Error('authView placeholder not found');
    if (name !== 'index') {
      const url = 'https://falakhesab.com/' + name, desc = name === 'privacy' ? 'How Falak Hesab handles your personal data (draft).' : 'Terms of Service for using Falak Hesab (draft).';
      h = h.replace(/<title>[^<]*<\/title>/, `<title>${o.title}</title>`)
        .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`)
        .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`)
        .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${desc}">`)
        .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/, '');
    }
    fs.writeFileSync(path.join(SITE, name + '.html'), h);
    console.log('prerendered', name + '.html', Math.round(o.html.length / 1024) + ' KB');
  };
  page('index', out.index); page('privacy', out.privacy); page('terms', out.terms);
})().catch(e => { console.error('prerender failed:', e.message); server.close(); process.exit(1) });
