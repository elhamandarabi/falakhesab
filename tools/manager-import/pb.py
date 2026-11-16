import sqlite3,uuid
def varint(b,i):
    r=s=0
    while True:
        x=b[i];i+=1;r|=(x&0x7f)<<s;s+=7
        if x<0x80:return r,i
def parse(b,depth=0):
    out=[];i=0
    try:
        while i<len(b):
            k,i=varint(b,i);f,w=k>>3,k&7
            if f==0:return None
            if w==0:v,i=varint(b,i)
            elif w==1:v=('f64',b[i:i+8]);i+=8
            elif w==5:v=('f32',b[i:i+4]);i+=4
            elif w==2:
                l,i=varint(b,i);v=b[i:i+l];i+=l
                if i>len(b):return None
            else:return None
            out.append((f,w,v))
        return out
    except Exception:return None
def show(b,ind=0,maxd=6):
    p=parse(b)
    if p is None: return
    for f,w,v in p:
        pad='  '*ind
        if w==2:
            try:
                s=v.decode('utf8')
                if s.isprintable() and len(v)>0 and (len(v)!=16):
                    print(f'{pad}{f}: "{s}"');continue
            except:pass
            if len(v)==16:
                print(f'{pad}{f}: guid {uuid.UUID(bytes_le=bytes(v))}');
            sub=parse(v)
            if sub is not None and ind<maxd and len(v)!=16:
                print(f'{pad}{f}: {{');show(v,ind+1);print(pad+'}')
            elif len(v)!=16: print(f'{pad}{f}: bytes {v.hex()}')
        elif w==1:
            import struct;print(f'{pad}{f}: double {struct.unpack("<d",v[1])[0]}')
        else: print(f'{pad}{f}: {v}')
