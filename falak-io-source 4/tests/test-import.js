const { chromium } = require('playwright');const fs=require('fs');
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(/fonts\.g/,r=>r.abort());await p.addInitScript(()=>{try{localStorage.setItem('falak_lang','en')}catch(e){}});
 const html=fs.readFileSync('site/index.html','utf8').replace('<script src="config.js"></script>','<script>window.FALAK_CONFIG={}</script>');fs.writeFileSync('site/_demo.html',html);
 await p.goto('file://'+process.cwd()+'/site/_demo.html');await p.waitForTimeout(700);
 await p.evaluate(()=>location.hash='#/businesses');await p.waitForTimeout(300);
 await p.setInputFiles('#impFile','/home/claude/mgr/out/falak-travel-from-manager.json');await p.waitForTimeout(1500);
 console.log('toast',await p.locator('#toast').textContent(),'biz',await p.locator('#bizName').innerText());
 console.log('bal',await p.locator('.sheet .ok, .sheet .small.neg').first().textContent());
 await p.screenshot({path:'/home/claude/mgr/out/summary.png'});
 await p.evaluate(()=>location.hash='#/customer');await p.waitForTimeout(300);
 const rows=await p.$$eval('tbody tr.click',trs=>trs.map(tr=>[...tr.cells].map(c=>c.innerText.trim())));
 fs.writeFileSync('/home/claude/mgr/out/falak-customers.json',JSON.stringify(rows));
 await p.screenshot({path:'/home/claude/mgr/out/customers.png',fullPage:true});
 await p.evaluate(()=>location.hash='#/bank');await p.waitForTimeout(300);
 console.log((await p.locator('tbody').innerText()).replace(/\s+/g,' '));
 console.log('errors',errs);await b.close()})();
