import sqlite3,uuid,struct,json
from pb import varint,parse
def guid_of(b):
    p=parse(b)
    if p is None: return None
    d={f:v for f,w,v in p}
    if set(d)<= {1,2} and all(w==1 for f,w,v in p) and p:
        lo=d.get(1,('f64',b'\0'*8))[1];hi=d.get(2,('f64',b'\0'*8))[1]
        return str(uuid.UUID(bytes_le=bytes(lo)+bytes(hi)))
    return None
def dec(b,depth=0):
    p=parse(b)
    if p is None: return None
    out={}
    for f,w,v in p:
        if w==2:
            g=guid_of(v) if len(v)in(18,9,0) or len(v)==18 else None
            if g: val=('G',g)
            else:
                val=None
                try:
                    s=v.decode('utf8')
                    if s and all(ch.isprintable() or ch in '\n\r\t' for ch in s): val=s
                except: pass
                if val is None:
                    sub=dec(v,depth+1)
                    val=sub if sub is not None else v.hex()
        elif w==1: val=('f64',bytes(v[1]).hex())
        else: val=v
        if f in out:
            if not isinstance(out[f],list) or not getattr(out[f],'_rep',False):
                L=RepList([out[f]]);out[f]=L
            out[f].append(val)
        else: out[f]=val
    return out
class RepList(list): _rep=True
def date(d):
    import datetime
    if not isinstance(d,dict) or 1 not in d: return None
    v=d[1];v=(v>>1)^-(v&1)
    return str(datetime.date(1970,1,1)+datetime.timedelta(days=v))
def decimal(d):
    if not isinstance(d,dict):return None
    lo=d.get(1,0);hi=d.get(2,0);ss=d.get(3,0)
    n=lo+(hi<<64);sign=-1 if ss&1 else 1;scale=ss>>1
    return sign*n/(10**scale)
