import json,os
base=os.path.dirname(os.path.abspath(__file__))
d={}
for line in open(os.path.join(base,'dict.txt'),encoding='utf8'):
    line=line.rstrip('\n')
    if not line.strip(): continue
    en,fa,ps,tr=line.split('|')
    if '{' in en: continue
    d[en]={'fa':fa,'ps':ps,'tr':tr}
pat=open(os.path.join(base,'patterns.js'),encoding='utf8').read()
open(os.path.join(base,'..','site','i18n.js'),'w',encoding='utf8').write('window.FALAK_I18N={dict:'+json.dumps(d,ensure_ascii=False)+',patterns:'+pat+'};\n')
