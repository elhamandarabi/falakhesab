const { chromium } = require('playwright');const fs=require('fs');
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(/fonts\.g/,r=>r.abort());
 fs.writeFileSync('site/_demo.html',fs.readFileSync('site/index.html','utf8').replace('<script src="config.js"></script>','<script>window.FALAK_CONFIG={}</script>'));
 await p.goto('file://'+process.cwd()+'/site/_demo.html');await p.waitForTimeout(700);
 const id=await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('falak_io_demo_v2'));return d.records.find(r=>r.type==='customer'&&r.data.name==='Noor Imports').id});
 const before=await p.evaluate(()=>JSON.parse(localStorage.getItem('falak_io_demo_v2')).records.length);
 await p.evaluate(h=>location.hash=h,'#/customer/edit/'+id);await p.waitForTimeout(300);
 await p.click('#delAll');await p.waitForTimeout(200);
 console.log(await p.locator('#modal p').innerText());
 console.log('disabled before typing',await p.locator('#mYes').isDisabled());
 await p.fill('#delName','noor imports');console.log('disabled after',await p.locator('#mYes').isDisabled());
 await p.click('#mYes');await p.waitForTimeout(800);
 const after=await p.evaluate(()=>JSON.parse(localStorage.getItem('falak_io_demo_v2')).records.length);
 console.log('records',before,'->',after,'toast',await p.locator('#toast').textContent(),'hash',await p.evaluate(()=>location.hash));
 await p.evaluate(()=>location.hash='#/summary');await p.waitForTimeout(300);
 console.log(await p.locator('.sheet .ok, .sheet .small.neg').first().textContent());
 console.log('errors',errs);await b.close();fs.unlinkSync('site/_demo.html')})();
