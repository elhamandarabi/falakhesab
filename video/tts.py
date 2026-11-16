# Narration with the Kokoro voice model (offline). Usage: python3 video/tts.py <model dir>
import json, sys, os, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
d = os.path.join(os.path.dirname(__file__), 'tts'); m = sys.argv[1]
k = Kokoro(os.path.join(m, 'kokoro-v1.0.onnx'), os.path.join(m, 'voices-v1.0.bin'))
VOICE = os.environ.get('VOICE', 'af_heart'); SPEED = float(os.environ.get('SPEED', '1.0'))
for it in json.load(open(os.path.join(d, 'list.json'))):
    s, sr = k.create(it['text'], voice=VOICE, speed=SPEED, lang='en-us')
    nz = np.where(np.abs(s) > 0.01)[0]
    if len(nz): s = s[max(0, nz[0] - 800): nz[-1] + 2400]
    sf.write(os.path.join(d, it['key'] + '.wav'), s, sr)
    json.dump({'dur': len(s) / sr, 'text': it['text']}, open(os.path.join(d, it['key'] + '.json'), 'w'))
    print(round(len(s) / sr, 2), it['text'][:60], flush=True)
