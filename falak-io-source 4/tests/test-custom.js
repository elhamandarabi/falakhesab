const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];
 p.on('pageerror',e=>errs.push('PAGEERR '+e.message));await p.route(/fonts\.g/,r=>r.abort());
 require('fs').writeFileSync('site/_demo.html',require('fs').readFileSync('site/index.html','utf8').replace('<script src="config.js"></script>','<script>window.FALAK_CONFIG={}</script>'));
 await p.goto('file://'+process.cwd()+'/site/_demo.html');await p.waitForTimeout(800);
 const nav=async h=>{await p.evaluate(h=>location.hash=h,h);await p.waitForTimeout(250)};
 const menu=async()=>(await p.locator('#nav').innerText()).replace(/\s*\d+\s*/g,' ').replace(/\s+/g,' ');
 await nav('#/summary');console.log('customize link:',await p.locator('#nav a.custom').count());
 await p.click('#nav a.custom');await p.waitForTimeout(250);console.log('page:',await p.locator('h1').textContent(),'boxes:',await p.locator('#cf input[type=checkbox]').count());
 await p.screenshot({path:'cu-page.png',fullPage:true});
 // hide Payroll group (has data) and Travel (no data)
 for(const k of ['employee','payslip','expenseclaim','travel','ticket','fixedasset','depreciation'])await p.uncheck(`#cf input[value=${k}]`);
 await p.click('#cf button[type=submit]');await p.waitForTimeout(250);console.log('confirm shown:',await p.locator('#modal').isVisible(),(await p.locator('#modal p').innerText()));
 await p.click('#mYes');await p.waitForTimeout(400);
 console.log('menu now:',await menu());
 console.log('Payroll group gone:',!(await menu()).includes('Payslips'),'Travel gone:',!(await menu()).includes('Tickets'));
 // hidden tab still reachable by link + balance unchanged
 await nav('#/payslip');console.log('payslip page still opens:',await p.locator('h1').first().textContent());
 await nav('#/summary');console.log('balance:',await p.locator('.sheet .ok, .sheet .small.neg').first().textContent());
 // settings tile + reload persistence
 await p.reload();await p.waitForTimeout(800);await nav('#/summary');console.log('after reload Payroll hidden:',!(await menu()).includes('Payslips'));
 await nav('#/customize');console.log('payslip box unchecked:',!(await p.isChecked('#cf input[value=payslip]')));
 await p.click('#cAll');await p.click('#cf button[type=submit]');await p.waitForTimeout(400);console.log('after Show all, Payroll back:',(await menu()).includes('Payslips'));
 await nav('#/settings');console.log('settings tile:',await p.locator('a.tile[href="#/customize"]').count());
 await nav('#/customize');await p.screenshot({path:'cu-page2.png'});
 console.log('errors',errs);await b.close()})();
