// writes video/tts/list.json with every line that needs narration; then run tts.py
const fs = require('fs'), path = require('path'), V = require('./voice'), CH = require('./chapters');
const lines = new Set();
for (const c of Object.values(CH)) { lines.add(V.cardLine(c)); lines.add(V.endLine(c)) }
const OUT = path.join(__dirname, 'out');
for (const f of fs.readdirSync(OUT).filter(f => /^0[1-8].*\.json$/.test(f))) JSON.parse(fs.readFileSync(path.join(OUT, f))).caps.forEach(c => lines.add(c.text));
// also every r.say('...') text in chapters.js, in case a chapter changed
const src = fs.readFileSync(path.join(__dirname, 'chapters.js'), 'utf8');
for (const m of src.matchAll(/r\.say\('((?:[^'\\]|\\.)*)'/g)) lines.add(m[1].replace(/\\'/g, "'"));
const todo = [...lines].filter(t => !V.clip(t)).map(t => ({ key: V.key(t), text: V.spoken(t) }));
fs.writeFileSync(path.join(V.DIR, 'list.json'), JSON.stringify(todo, null, 1)); console.log(lines.size, 'lines,', todo.length, 'to make');
