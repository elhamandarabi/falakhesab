// tiny static server that applies site/_headers and site/_redirects like Netlify (for CSP + company address testing)
const http=require('http'),fs=require('fs'),path=require('path');const root=path.join(__dirname,'site');
const hdr={};fs.readFileSync(path.join(root,'_headers'),'utf8').split('\n').slice(1).forEach(l=>{const m=l.match(/^\s+([\w-]+):\s*(.*)$/);if(m)hdr[m[1]]=m[2]});
const rules=fs.existsSync(path.join(root,'_redirects'))?fs.readFileSync(path.join(root,'_redirects'),'utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(l=>{const [from,to,code]=l.split(/\s+/);const names=[];
  const re=new RegExp('^'+from.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/:(\w+)/g,(m,n)=>{names.push(n);return '([^/]+)'}).replace(/\*/g,()=>{names.push('splat');return '(.*)'})+'$');return {re,names,to,code:+code||301}}):[];
const types={'.html':'text/html','.js':'application/javascript','.png':'image/png'};
const isFile=f=>{try{return fs.statSync(f).isFile()}catch(e){return false}};
http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);let f=path.join(root,u);if(u.endsWith('/')&&isFile(f+'index.html'))f+='index.html';
  if(!isFile(f)){for(const x of rules){const m=x.re.exec(u);if(!m)continue;let t=x.to;x.names.forEach((n,i)=>{t=t.replace(':'+n,m[i+1])});
      if(x.code===200){f=path.join(root,t);break}r.writeHead(x.code,{Location:t});return r.end()}}
  fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,Object.assign({'Content-Type':types[path.extname(f)]||'text/plain'},hdr));r.end(d)})}).listen(+process.argv[2]||8099);
