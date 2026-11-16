// Falak Hesab tutorial recorder: drives the real app with Playwright, adds a visible cursor,
// highlight rings and caption bar, records video, writes captions (SRT) and the voice script.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const VO = require('./voice'), LEAD = 0.25;   // narration starts 0.25 s after its caption appears
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const W = 1280, H = 720, MK = 4;   // a 4px timing strip under the picture is cropped away after recording

const OVERLAY = () => {
  if (window.__Vinit) return; window.__Vinit = 1;
  const install = () => {
  const css = `
  #banner{display:none!important}
  #__mk{direction:ltr;position:fixed;left:0;right:0;bottom:0;height:4px;z-index:2147483647;display:flex;pointer-events:none}
  #__mk i{flex:1;background:#000}
  #__cur{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transition:transform .05s linear;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
  #__cur.down{transform-origin:0 0}
  #__ring{position:fixed;z-index:2147483646;pointer-events:none;border:3px solid #f2b632;border-radius:10px;box-shadow:0 0 0 6px rgba(242,182,50,.28);transition:all .35s ease;opacity:0}
  #__cap{direction:ltr;unicode-bidi:isolate;position:fixed;left:50%;bottom:26px;transform:translateX(-50%);max-width:1060px;z-index:2147483645;pointer-events:none;
    background:rgba(9,24,44,.92);color:#fff;font:600 23px/1.38 Manrope,"Segoe UI",system-ui,sans-serif;padding:14px 26px;border-radius:14px;
    box-shadow:0 10px 30px rgba(0,0,0,.35);text-align:center;opacity:0;transition:opacity .3s}
  #__cap small{display:block;font-weight:500;font-size:17px;color:#d6a84a;margin-bottom:2px;letter-spacing:.03em}
  #__card{direction:ltr;position:fixed;inset:0;z-index:2147483647;display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;
    background:linear-gradient(160deg,#0d2a4a 0%,#12345c 55%,#137070 100%);color:#fff;font-family:Manrope,"Segoe UI",system-ui,sans-serif}
  #__card img{width:120px;background:#fff;border-radius:22px;padding:10px 14px}
  #__card .k{color:#d6a84a;font-weight:700;letter-spacing:.12em;font-size:18px;text-transform:uppercase}
  #__card h1{font:400 54px Marcellus,Georgia,serif;margin:0;max-width:1000px;line-height:1.15}
  #__card p{font-size:22px;color:#d8e3ec;margin:0;max-width:900px}
  #__card .u{position:absolute;bottom:34px;font-size:17px;color:#b8c8d6}`;
  const st = document.createElement('style'); st.textContent = css; document.documentElement.appendChild(st);
  const mk = (id, html) => { const d = document.createElement('div'); d.id = id; if (html) d.innerHTML = html; document.documentElement.appendChild(d); return d };
  const cur = mk('__cur', '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l7.5 19 2.6-7.6L21 10.8z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>');
  const ring = mk('__ring'), cap = mk('__cap'), card = mk('__card'), mark = mk('__mk', '<i></i>'.repeat(8));
  addEventListener('mousemove', e => { cur.style.left = e.clientX - 3 + 'px'; cur.style.top = e.clientY - 2 + 'px' }, true);
  addEventListener('mousedown', () => cur.style.transform = 'scale(.82)', true);
  addEventListener('mouseup', () => cur.style.transform = '', true);
  window.__V = {
    mark(n) { [...mark.children].forEach((b, i) => b.style.background = (n >> (7 - i)) & 1 ? '#fff' : '#000') },
    cap(t, s) { cap.innerHTML = (s ? `<small>${s}</small>` : '') + t; cap.style.opacity = t ? 1 : 0 },
    ring(r) { if (!r) { ring.style.opacity = 0; return } Object.assign(ring.style, { left: r.x - 6 + 'px', top: r.y - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px', opacity: 1 }) },
    card(k, t, p, logo) { if (!t) { card.style.display = 'none'; return } card.innerHTML = `<img src="${logo}" alt=""><div class="k">${k}</div><h1>${t}</h1>${p ? `<p>${p}</p>` : ''}<div class="u">falakhesab.com</div>`; card.style.display = 'flex' }
  };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
};

class Rec {
  constructor(name, title, opts = {}) { this.name = name; this.title = title; this.opts = opts; this.caps = []; this.script = []; this.cur = { x: W / 2, y: H / 2 } }
  async start() {
    this.b = await chromium.launch();
    this.ctx = await this.b.newContext({ viewport: { width: W, height: H + MK }, colorScheme: 'light', acceptDownloads: true, recordVideo: { dir: path.join(OUT, 'raw'), size: { width: W, height: H + MK } } });
    this.t0 = Date.now();
    await this.ctx.addInitScript(OVERLAY);
    if (this.opts.cloud) await this.ctx.addInitScript(() => sessionStorage.setItem('mockpersist', '1'));
    const p = this.p = await this.ctx.newPage();
    await p.route(/fonts\.g/, r => r.continue().catch(() => r.abort()));
    if (this.opts.cloud) {
      await p.route(/supabase-js|vendor\/supabase-/, r => r.fulfill({ body: fs.readFileSync(path.join(ROOT, 'mock-supabase.js'), 'utf8'), contentType: 'application/javascript' }));
      await p.route(/config\.js$/, r => r.fulfill({ body: "window.FALAK_CONFIG={supabaseUrl:'https://x.supabase.co',supabaseAnonKey:'k',superAdmin:'falaktravelagency11@gmail.com'}", contentType: 'application/javascript' }));
    }
    this.logo = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'vendor/logo-mark.png')).toString('base64');
    this.page = this.opts.cloud ? 'site/index.html' : 'site/_demo.html';
    await p.goto('file://' + path.join(ROOT, this.page) + (this.opts.query || ''));
    await p.waitForTimeout(1200);
  }
  now() { return Date.now() - this.t0 }
  async begin() { this.tStart = this.now(); const c = VO.clip(VO.cardLine({ title: this.title, sub: this.opts.sub })); await this.card(this.title, this.opts.sub || '', Math.max(3600, c ? c.dur * 1000 + 1300 : 0)); }
  async wait(ms) { await this.p.waitForTimeout(ms) }
  async card(t, sub, ms = 3200, kicker = 'Falak Hesab tutorial', mk = 250) { await this.p.evaluate(([k, t, s, l, m]) => { window.__V.card(k, t, s, l); window.__V.mark(m) }, [kicker, t, sub, this.logo, mk]); await this.wait(ms); if (this.keep) { await this.p.evaluate(() => window.__V.mark(252)); await this.wait(1500) } else await this.p.evaluate(() => window.__V.card()) }
  async cap(text, opt = {}) {
    const hold = opt.hold || Math.max(2400, 52 * text.length + 1100);
    const a = this.now(); await this.p.evaluate(([t, s]) => window.__V.cap(t, s), [text, opt.step || '']);
    this.script.push(text);
    if (opt.after) await opt.after();
    await this.wait(hold);
    this.caps.push({ a, b: this.now(), text });
  }
  // show a caption, do the actions while it is visible, keep it long enough to read
  async say(text, fn, opt = {}) {
    const vc = VO.clip(text); if (!vc) console.warn('no narration for:', text); const need = opt.hold || Math.max(2600, 50 * text.length + 1200, vc ? vc.dur * 1000 + 1000 : 0);
    const a = this.now(); await this.unring(); const mk = this.caps.length + 1; await this.p.evaluate(([t, m]) => { window.__V.cap(t); window.__V.mark(m) }, [text, mk]); this.script.push(text);
    await this.wait(700);
    if (fn) await fn();
    const left = need - (this.now() - a); await this.wait(Math.max(left, 900));
    this.caps.push({ a, b: this.now(), text });
  }
  async capOn(text, opt = {}) { const a = this.now(); await this.p.evaluate(t => window.__V.cap(t), text); this.script.push(text); this._open = { a, text } }
  async capOff() { if (this._open) { this.caps.push({ a: this._open.a, b: this.now(), text: this._open.text }); this._open = null } await this.p.evaluate(() => window.__V.cap('')) }
  async box(sel) { const l = this.p.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); await this.wait(200); return await l.boundingBox() }
  async point(sel, { ring = true, ms = 650 } = {}) {
    const bb = await this.box(sel); if (!bb) throw new Error('not visible: ' + sel);
    const x = bb.x + Math.min(bb.width / 2, 60), y = bb.y + bb.height / 2;
    await this.p.mouse.move(x, y, { steps: 22 }); this.cur = { x, y };
    if (ring) await this.p.evaluate(r => window.__V.ring(r), bb);
    await this.wait(ms); return bb;
  }
  async unring() { await this.p.evaluate(() => window.__V.ring(null)) }
  async click(sel, o = {}) { const bb = await this.point(sel, o); await this.p.mouse.down(); await this.wait(90); await this.p.mouse.up(); await this.unring(); await this.wait(o.after ?? 700) }
  async type(sel, text, o = {}) { await this.point(sel, o); await this.p.locator(sel).first().click(); await this.p.locator(sel).first().fill(''); await this.p.keyboard.type(String(text), { delay: o.delay || 55 }); await this.unring(); await this.wait(350) }
  async pick(sel, label) {
    await this.point(sel);
    await this.p.evaluate(([s, lb]) => { const e = document.querySelector(s); const o = [...e.options].find(o => o.textContent.includes(lb)); if (!o) throw new Error('option ' + lb); e.value = o.value; e.dispatchEvent(new Event('change', { bubbles: true })); e.dispatchEvent(new Event('input', { bubbles: true })) }, [sel, label]);
    await this.unring(); await this.wait(500);
  }
  async go(hash, ms = 900) { await this.p.evaluate(h => location.hash = h, hash); await this.wait(ms) }
  async scroll(y, ms = 900) { await this.p.evaluate(y => window.scrollTo({ top: y, behavior: 'smooth' }), y); await this.wait(ms) }
  async scrollTo(sel, ms = 900) { const l = this.p.locator(sel).first(); if (await l.count()) await l.evaluate(e => window.scrollTo({ top: e.getBoundingClientRect().top + scrollY - 90, behavior: 'smooth' })); else console.warn('scrollTo missing', sel); await this.wait(ms) }
  async end(next) { this.next = next; const ec = VO.clip(VO.endLine({ next })); await this.capOff(); await this.unring(); this.keep = true; await this.card(next ? 'Next: ' + next : 'Thank you!', next ? '' : 'Questions? WhatsApp +93 79 104 4260', Math.max(2800, ec ? ec.dur * 1000 + 1200 : 0), 'Falak Hesab', 251); this.tEnd = this.now(); }
  // read the timing strip from the raw video: frame -> marker number
  marks(raw) {
    const buf = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', raw, '-vf', `fps=30,crop=${W}:${MK}:0:${H},scale=8:1:flags=area,format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 });
    const out = []; for (let i = 0; i + 8 <= buf.length; i += 8) { let n = 0; for (let k = 0; k < 8; k++) n = n * 2 + (buf[i + k] > 128 ? 1 : 0); out.push(n) } return out;
  }
  async finish() {
    const v = this.p.video(); await this.ctx.close(); const raw = await v.path(); await this.b.close();
    const m = this.marks(raw), first = n => { const i = m.indexOf(n); return i < 0 ? null : i / 30 };
    const ss = first(250) ?? 0, endCard = first(251), stop = first(252);
    const end = stop ?? (endCard != null ? endCard + 2.8 : m.length / 30);
    const dur = end - ss;
    // caption k runs from its first frame until the next marker change
    const caps = this.caps.map((c, i) => { const a = first(i + 1); return a == null ? null : { a, text: c.text, i } }).filter(Boolean);
    caps.forEach((c, j) => { const nx = caps[j + 1] ? caps[j + 1].a : (endCard ?? end); c.b = nx });
    const lost = this.caps.length - caps.length; if (lost) console.warn(this.name, lost, 'captions not found in video');
    const mp4 = path.join(OUT, this.name + '.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss.toFixed(3), '-i', raw, '-t', dur.toFixed(3), '-vf', `fps=30,crop=${W}:${H}:0:0,format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-movflags', '+faststart', '-an', mp4]);
    // narration track: title card, every caption, end card
    const clips = [[VO.clip(VO.cardLine({ title: this.title, sub: this.opts.sub })), 0.45]];
    caps.forEach(c => clips.push([VO.clip(c.text), c.a - ss + LEAD, c.b - ss]));
    if (endCard != null) clips.push([VO.clip(VO.endLine({ next: this.next })), endCard - ss + 0.35]);
    const use = clips.filter(c => c[0]);
    use.forEach(([c, at, until]) => { if (until && at + c.dur > until + 0.05) console.warn(this.name, 'narration runs over by', (at + c.dur - until).toFixed(2) + 's:', c.file) });
    if (use.length) {
      const silent = mp4.replace('.mp4', '.silent.mp4'); fs.renameSync(mp4, silent);
      const args = ['-y', '-loglevel', 'error', '-i', silent]; use.forEach(([c]) => args.push('-i', c.file));
      const f = use.map(([c, at], i) => `[${i + 1}:a]aresample=48000,adelay=${Math.round(at * 1000)}:all=1[a${i}]`).join(';') + ';' + use.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${use.length}:normalize=0:duration=longest,apad,atrim=0:${dur.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
      execFileSync('ffmpeg', [...args, '-filter_complex', f, '-map', '0:v', '-map', '[out]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', '-movflags', '+faststart', mp4]);
      fs.unlinkSync(silent);
    }
    const tc = sec => { let ms = Math.max(0, Math.round(sec * 1000)); const h = Math.floor(ms / 3600000), mi = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, x = ms % 1000; return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(x).padStart(3, '0')}` };
    const rel = caps.map(c => ({ a: c.a - ss, b: c.b - ss - 0.05, text: c.text }));
    fs.writeFileSync(path.join(OUT, this.name + '.srt'), rel.map((c, i) => `${i + 1}\n${tc(c.a)} --> ${tc(c.b)}\n${c.text}\n`).join('\n'));
    fs.writeFileSync(path.join(OUT, this.name + '.json'), JSON.stringify({ name: this.name, title: this.title, duration: dur, caps: rel }, null, 1));
    fs.unlinkSync(raw);
    console.log('saved', mp4, dur.toFixed(1) + 's', 'video/wall ratio', (dur / (((this.tEnd || this.now()) - this.tStart) / 1000)).toFixed(3));
  }
}
module.exports = { Rec, ROOT };
