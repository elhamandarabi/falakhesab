set -e
mkdir -p dist site site/vendor
SB_URL='YOUR_SUPABASE_PROJECT_URL'  # e.g. https://xxxx.supabase.co
cp vendor/supabase-2.45.4.js vendor/591.supabase.js site/vendor/
cp vendor/logo-mark.png site/logo-mark.png
mkdir -p site/img && cp assets/img/*.jpg site/img/ 2>/dev/null || true
cp assets/robots.txt assets/sitemap.xml site/ 2>/dev/null || true
cp assets/pre.js site/pre.js
SB_HOST=${SB_URL#https://}
cat > site/_headers <<H
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://$SB_HOST wss://$SB_HOST; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
H
# company addresses (falakhesab.com/<company>): files first, then every other path opens the app
cat > site/_redirects <<'R'
/:slug/app.js        /app.js        200
/:slug/i18n.js       /i18n.js       200
/:slug/config.js     /config.js     200
/:slug/logo-mark.png /logo-mark.png 200
/:slug/pre.js       /pre.js        200
/privacy             /privacy.html  200
/terms               /terms.html    200
/:slug/vendor/*      /vendor/:splat 200
/:slug/img/*         /img/:splat    200
/*                   /index.html    200
R
python3 i18n/build.py
{ echo "(function(){'use strict';"; cat js/1-core.js js/2-engine.js js/3-ui.js js/4-views-a.js js/4-views-b.js js/4-views-c.js js/4-views-d.js js/4-views-e.js js/4-views-f.js js/4-views-g.js js/4-views-h.js js/4-views-i.js js/4-views-j.js js/6-i18n.js js/5-boot.js; echo "})();"; } > site/app.js
node --check site/app.js
cat > site/config.js <<'C'
/* Falak Hesab settings — paste your Supabase details here (Project Settings → API).
   Leave them empty to run in demo mode (data stays in each browser). */
window.FALAK_CONFIG = {
  supabaseUrl: 'YOUR_SUPABASE_PROJECT_URL',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_PUBLIC_KEY',
  superAdmin: 'falaktravelagency11@gmail.com'
};
C
{ printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<link rel="icon" type="image/png" href="logo-mark.png">\n<link rel="apple-touch-icon" href="logo-mark.png">\n<meta name="theme-color" content="#12345c">\n'; printf '<script src="pre.js"></script>\n'; cat assets/head.html; sed -n '1,/<\/style>/p' shell.html; printf '</head>\n<body>\n'; sed -n '/<\/style>/,$p' shell.html | tail -n +2; printf '<script src="config.js"></script>\n<script src="i18n.js"></script>\n<script src="app.js"></script>\n</body>\n</html>\n'; } > site/index.html
{ cat shell.html; echo '<script>window.FALAK_CONFIG={};</script>'; echo '<script>'; cat site/i18n.js; echo '</script><script>'; cat site/app.js; echo '</script>'; } > dist/preview.html

# help chatbot server function (Supabase Edge Function) with the knowledge base inserted
mkdir -p supabase/functions/falak-chat
python3 - <<'P'
import json
kb=open('chatbot/kb.md',encoding='utf-8').read()
src=open('chatbot/function.ts',encoding='utf-8').read().replace('= __KB__;','= '+json.dumps(kb,ensure_ascii=False)+';',1)
open('supabase/functions/falak-chat/index.ts','w',encoding='utf-8').write(src)
P

# public pages built into the HTML for search engines and people without JavaScript (needs Node + Playwright)
if node -e "require('playwright')" 2>/dev/null; then node tools/prerender.js; else echo "Playwright not found: skipped prerendering (site still works)"; fi
