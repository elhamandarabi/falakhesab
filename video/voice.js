// Spoken version of a caption + cache key for its narration file
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, 'tts');
function spoken(t) {
  return t.replace(/falakhesab\.com\/your-company/g, 'falak hesab dot com, slash, your company')
    .replace(/falakhesab\.com/g, 'falak hesab dot com')
    .replace(/"\+ /g, '"').replace(/\+ /g, '')
    .replace(/&/g, 'and').replace(/\bPNR\b/g, 'P N R').replace(/\bPDF\b/g, 'P D F')
    .replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();
}
const key = t => crypto.createHash('sha1').update(spoken(t)).digest('hex').slice(0, 16);
function clip(t) { const f = path.join(DIR, key(t) + '.wav'), j = f.replace('.wav', '.json'); if (!fs.existsSync(j)) return null; return { file: f, dur: JSON.parse(fs.readFileSync(j)).dur } }
const cardLine = c => `Chapter ${c.title.replace(/^(\d+)\.\s*/, '$1: ')}. ${c.sub || ''}`.trim();
const endLine = c => c.next ? `Next: ${c.next.replace(':', ',')}.` : 'Thank you for watching! If you have questions, write to us on WhatsApp.';
module.exports = { spoken, key, clip, cardLine, endLine, DIR };
