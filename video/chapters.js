// The tutorial chapters. Run: node video/chapters.js [n ...]   (no argument = all)
const { Rec } = require('./engine');
const pw = 'secret12';

async function signIn(r, email) {   // quiet setup before the chapter starts (trimmed from the video)
  const p = r.p, h = async x => { await p.evaluate(v => location.hash = v, x); await p.waitForTimeout(350) };
  await h('#/login'); await h('#/signup'); await p.fill('#aEmail', email); await p.fill('#aPw', pw); await p.click('#af button'); await p.waitForTimeout(400);
  await h('#/x'); await h('#/login'); await p.fill('#aEmail', email); await p.fill('#aPw', pw); await p.click('#af button'); await p.waitForTimeout(900);
}
async function quietBusiness(r, name) {
  const p = r.p; await p.click('#addBiz'); await p.fill('#nbName', name); await p.check('#nbSample'); await p.click('#nbBtn'); await p.waitForTimeout(1200);
}

const rowId = (r, text) => r.p.evaluate(t => { const tr = [...document.querySelectorAll('tbody tr.click')].find(x => x.textContent.includes(t)); return tr && tr.dataset.id }, text);
const L1 = '#lines tbody tr:first-child';

const CH = {
  // ------------------------------------------------------------------
  1: { name: '01-getting-started', title: '1. Getting started', sub: 'Create your account and your business', cloud: true, next: 'Customers and sales invoices',
    async run(r) {
      await r.begin();
      await r.say('This is falakhesab.com. Falak Hesab is online accounting for small businesses and travel agencies.');
      await r.say('It covers sales, purchases, bank and cash, reports, many currencies and travel, in four languages.', () => r.scrollTo('#s-features', 1500));
      await r.say('There is a free plan, and Basic and Pro can be tried free for 30 days. No bank card is needed.', () => r.scrollTo('#s-pricing', 1500));
      await r.say('To start, press "Try free".', async () => { await r.scroll(0, 900); await r.click('.snav a.btn.primary', { after: 900 }) });
      await r.say('Choose a plan. The 30-day trial of Pro includes everything.', () => r.click('.pp:has(input[value=pro])'));
      await r.say('Type your email and a password with at least 8 characters, letters and numbers.', async () => { await r.type('#aEmail', 'owner@example.com'); await r.type('#aPw', 'MyPass2026') });
      await r.say('Press "Create account". Falak Hesab sends you an email: open the link in it to confirm your account.', () => r.click('#af button.primary', { after: 1200 }));
      await r.say('Then sign in with the same email and password.', async () => { await r.go('#/login', 700); await r.type('#aEmail', 'owner@example.com'); await r.type('#aPw', 'MyPass2026'); await r.click('#af button.primary', { after: 1400 }) });
      await r.say('You now see your businesses. Press "+ New business".', () => r.click('#addBiz', { after: 600 }));
      await r.say('Write the name of your business, your main currency and the start date of your books.', async () => { await r.type('#nbName', 'Example Travel Agency'); await r.point('#nbCur'); await r.point('#nbStart') });
      await r.say('Tick this box if you want example customers and invoices to practise with. Then press "Create business".', async () => { await r.click('#nbSample', { after: 500 }); await r.click('#nbBtn', { after: 1800 }) });
      await r.say('This is the Summary. It shows your balance sheet and your profit and loss, always up to date.', () => r.point('#view .card', { ms: 1200 }));
      await r.say('The menu on the left has a tab for every part of your business: money, sales, purchases, reports and more.', async () => { await r.point('#nav a[href="#/receipt"]'); await r.point('#nav a[href="#/salesinvoice"]'); await r.point('#nav a[href="#/reports"]') });
      await r.say('Each person can choose their own language: English, Dari, Pashto or Turkish.', async () => { await r.point('#langSide'); await r.p.selectOption('#langSide', 'fa'); await r.unring(); await r.wait(1300); await r.scroll(0, 1000); await r.p.evaluate(() => scrollTo(0, 0)); await r.wait(1600); await r.point('#langSide'); await r.p.selectOption('#langSide', 'en'); await r.unring(); await r.wait(1300); await r.scroll(0, 900) });
      await r.end(this.next);
    } },
  // ------------------------------------------------------------------
  2: { name: '02-customers-and-invoices', title: '2. Customers and sales invoices', sub: 'Add a customer, send an invoice, receive the payment', next: 'Bank, cash, receipts and payments',
    async run(r) {
      await r.go('#/summary', 600); await r.begin();
      await r.say('Open Customers in the menu. Here you see every customer and how much each one owes you.', () => r.click('#nav a[href="#/customer"]', { after: 900 }));
      await r.say('Press "+ New customer".', () => r.click('a[href="#/customer/new"]', { after: 900 }));
      await r.say('Fill in the name, email, phone and address. Payment terms are the days the customer has to pay.', async () => {
        await r.type('#fName', 'Kabul Star Trading'); await r.type('#fEmail', 'info@kabulstar.example'); await r.type('#fPhone', '+93 700 123 456'); await r.type('#fTerms', '15') });
      await r.say('Press "Create". The customer is saved.', () => r.click('#saveBtn', { after: 1200 }));
      await r.say('Now open Sales Invoices and press "+ New sales invoice".', async () => { await r.click('#nav a[href="#/salesinvoice"]', { after: 900 }); await r.click('a[href="#/salesinvoice/new"]', { after: 1000 }) });
      await r.say('Choose the customer. The issue date, due date and invoice number are filled in for you.', () => r.pick('#fParty', 'Kabul Star Trading'));
      await r.say('On each line choose an item or write a description, then the quantity and the price.', async () => {
        await r.pick(L1 + ' [data-k=item]', 'A4 paper box'); await r.type(L1 + ' [data-k=qty]', '25'); await r.pick(L1 + ' [data-k=tax]', 'KDV 20%') });
      await r.say('The subtotal, tax and total are calculated automatically.', () => r.point('#tTot', { ms: 1200 }));
      await r.say('Press "Create". Falak Hesab records the sale in your books for you.', () => r.click('#saveBtn', { after: 1500 }));
      await r.say('This is the invoice, ready to print or save as PDF. You can also share a link with your customer.', async () => { await r.point('#prt'); await r.point('#shareBtn') });
      await r.say('When the customer pays, press "Receive payment".', () => r.click('#payBtn', { after: 1200 }));
      await r.say('The receipt is filled in for you: the bank account, the customer and the invoice. Press "Create".', async () => { await r.point('#fBank'); await r.point('#lines'); await r.click('#saveBtn', { after: 1500 }) });
      await r.say('Back in Sales Invoices, the invoice now shows as paid.', () => r.click('#nav a[href="#/salesinvoice"]', { after: 1500 }));
      await r.end(this.next);
    } },
  // ------------------------------------------------------------------
  3: { name: '03-bank-cash-receipts-payments', title: '3. Bank, cash, receipts and payments', sub: 'Money in, money out, and transfers', next: 'Purchases and suppliers',
    async run(r) {
      await r.go('#/summary', 600); await r.begin();
      await r.say('Bank & Cash Accounts shows every bank account and cash box with its balance.', () => r.click('#nav a[href="#/bank"]', { after: 1000 }));
      await r.say('Click an account to see every movement in it, like a bank statement.', async () => { await r.click('tbody tr.click', { after: 1500 }); await r.scroll(300, 900); await r.scroll(0, 600) });
      await r.say('Money you receive is a Receipt. Money you pay is a Payment. Let\'s pay the office rent.', async () => { await r.click('#nav a[href="#/payment"]', { after: 900 }); await r.click('a[href="#/payment/new"]', { after: 1000 }) });
      await r.say('Choose the account you pay from, and who you paid.', async () => { await r.pick('#fBank', 'Main bank account'); await r.type('#fContact', 'Office landlord') });
      await r.say('On the line choose what the money was for, here Rent, and the amount.', async () => { await r.pick(L1 + ' [data-k=account]', 'Rent'); await r.type(L1 + ' [data-k=amount]', '900') });
      await r.say('Press "Create". The bank balance goes down and the rent appears in your profit and loss.', () => r.click('#saveBtn', { after: 1500 }));
      await r.say('To move money between your own accounts, for example from the bank to the cash box, use Inter Account Transfers.', async () => { await r.click('#nav a[href="#/transfer"]', { after: 900 }); await r.click('a[href="#/transfer/new"]', { after: 1000 }) });
      await r.say('Choose from, to and the amount, then press "Create".', async () => { await r.pick('#fFrom', 'Main bank account'); await r.pick('#fTo', 'Cash on hand'); await r.type('#fAmt', '300'); await r.click('#saveBtn', { after: 1500 }) });
      await r.say('Check your balances any time in Bank & Cash Accounts.', () => r.click('#nav a[href="#/bank"]', { after: 1500 }));
      await r.end(this.next);
    } },
  // ------------------------------------------------------------------
  4: { name: '04-purchases-and-suppliers', title: '4. Purchases and suppliers', sub: 'Record bills and pay your suppliers', next: 'Travel: tickets, airlines and sub-agents',
    async run(r) {
      await r.go('#/summary', 600); await r.begin();
      await r.say('Suppliers are the companies you buy from. The list shows how much you owe each one.', () => r.click('#nav a[href="#/supplier"]', { after: 1000 }));
      await r.say('When you receive a bill, record it in Purchase Invoices.', async () => { await r.click('#nav a[href="#/purchaseinvoice"]', { after: 900 }); await r.click('a[href="#/purchaseinvoice/new"]', { after: 1000 }) });
      await r.say('Choose the supplier and add the lines of the bill: item, quantity and cost.', async () => {
        await r.pick('#fParty', 'Paper Wholesale'); await r.pick(L1 + ' [data-k=item]', 'A4 paper box'); await r.type(L1 + ' [data-k=qty]', '50'); await r.type(L1 + ' [data-k=price]', '8') });
      await r.say('Press "Create". Stock items are added to your inventory, and the amount is added to what you owe the supplier.', () => r.click('#saveBtn', { after: 1500 }));
      await r.say('When you pay the supplier, press "Pay this invoice". The payment is filled in for you.', async () => { await r.click('#payBtn', { after: 1200 }); await r.point('#fBank'); await r.click('#saveBtn', { after: 1500 }) });
      await r.say('In Reports, "Aged payables" shows what you still owe and for how long.', async () => { await r.go('#/reports/aged-ap', 1500) });
      await r.end(this.next);
    } },
  // ------------------------------------------------------------------
  5: { name: '05-travel', title: '5. Travel: tickets, airlines and sub-agents', sub: 'For travel agencies', next: 'Reports and statements',
    async run(r) {
      await r.go('#/summary', 600); await r.begin();
      await r.say('Travel overview shows your tickets, sales, airline costs and profit for the period.', () => r.click('#nav a[href="#/travel"]', { after: 1200 }));
      await r.say('It also shows upcoming flights, with a WhatsApp reminder for each passenger, and what every airline and sub-agent owes.', async () => { await r.scroll(260, 1200); await r.scroll(620, 1200); await r.scroll(0, 700) });
      await r.say('To sell a ticket, press "+ New ticket".', () => r.click('a[href="#/ticket/new"]', { after: 1000 }));
      await r.say('Fill in the passenger, PNR, ticket number, airline and route.', async () => {
        await r.type('#fPax', 'Zahra Ahmadi'); await r.type('#fPnr', 'X7KQ2M'); await r.type('#fTkt', '2351234500099'); await r.pick('#fAir', 'Kam Air'); await r.type('#fRoute', 'IST – KBL') });
      await r.say('Choose who you sold it to: a walk-in customer or a sub-agent. Then the selling price and the cost from the airline.', async () => {
        await r.pick('#fCust', 'Herat Travel'); await r.type('#fSell', '560'); await r.type('#fCost', '495'); await r.point('#fProfit', { ms: 1200 }) });
      await r.say('The profit is calculated for you. Press "Create".', () => r.click('#saveBtn', { after: 1500 }));
      await r.say('Open the ticket to print a ticket receipt or send it on WhatsApp. The cost is never shown to the customer.', async () => {
        await r.p.waitForSelector('#prt'); await r.point('#prt'); await r.point('.head .tools a:has-text("WhatsApp")') });
      await r.say('Back on the Travel overview, the sub-agent now owes you more and the airline balance has grown.', async () => { await r.click('#nav a[href="#/travel"]', { after: 1200 }); await r.scrollTo('h2:has-text("Sub-agents")', 1500) });
      await r.end(this.next);
    } },
  // ------------------------------------------------------------------
  6: { name: '06-reports', title: '6. Reports and statements', sub: 'Know your profit, your cash and who owes you', next: 'Your team and settings',
    async run(r) {
      await r.go('#/summary', 600); await r.begin();
      await r.say('The Summary always shows your balance sheet and profit and loss. Change the dates to see any period.', async () => { await r.point('#pFrom'); await r.point('#pTo') });
      await r.say('Open Reports to see all reports.', () => r.click('#nav a[href="#/reports"]', { after: 1200 }));
      await r.say('Profit and loss by month shows how each month went.', () => r.go('#/reports/pl-month', 1800));
      await r.say('Aged receivables shows who owes you money, and how late the payment is.', () => r.go('#/reports/aged-ar', 1800));
      await r.say('A customer statement lists every invoice and payment of one customer, with the running balance.', async () => { await r.go('#/reports/statements', 1200); await r.click('tbody tr.click', { after: 1600 }) });
      await r.say('Print any report, save it as PDF, or press "Export" to open it in Excel.', async () => { await r.point('#prt'); await r.point('#csvRep') });
      await r.end(this.next);
    } },
  // ------------------------------------------------------------------
  7: { name: '07-team-and-settings', title: '7. Your team and settings', sub: 'Staff access, logo, company address and custom fields', cloud: true, next: 'Safety, backups and your plan',
    async setup(r) { await signIn(r, 'owner@example.com'); await quietBusiness(r, 'Example Travel Agency') },
    async run(r) {
      await r.go('#/summary', 600); await r.begin();
      await r.say('Open Settings to add your business details. They are printed on your invoices and receipts.', () => r.click('#nav a[href="#/settings"]', { after: 1000 }));
      await r.say('Upload your logo here. It appears on every printed document.', async () => { await r.point('label:has(#logoFile)'); await r.p.setInputFiles('#logoFile', require('path').join(__dirname, '..', 'vendor/logo-mark.png')); await r.wait(1500) });
      await r.say('On Basic and Pro your business gets its own sign-in page with your logo, for example falakhesab.com/your-company.', async () => { await r.scrollTo('#wsCard', 900); await r.type('#wsSlug', 'example-travel'); await r.click('#wsForm button.primary', { after: 1400 }) });
      await r.say('Custom fields add your own boxes, for example a passport number on every customer.', async () => {
        await r.scrollTo('#cfCard', 900); await r.click('#cfAdd', { after: 600 }); await r.type('#cfList [data-k=label]', 'Passport number'); await r.click('#cfList [data-k=list]', { after: 400 }); await r.click('#cfSave', { after: 1200 }) });
      await r.say('Now Users & Access. Add the email of each staff member and choose what they may use.', async () => { await r.click('#nav a[href="#/users"]', { after: 1000 }); await r.click('#addU', { after: 800 }); await r.type('#mEmail', 'staff@example.com') });
      await r.say('Administrator can do everything. Limited user can only change the tabs you tick. View only can look but not change.', async () => { await r.point('#mRole', { ms: 1500 }); await r.point('#tabBox', { ms: 1200 }); await r.click('#mf button.primary', { after: 1200 }) });
      await r.say('Send your staff the sign-in link. They create an account with the same email and see your business straight away.', async () => { await r.scrollTo('#wsCopyU', 900); await r.point('#wsWa', { ms: 1400 }) });
      await r.end(this.next);
    } },
  // ------------------------------------------------------------------
  8: { name: '08-safety-backups-plan', title: '8. Safety, backups and your plan', sub: 'Keep your books safe', cloud: true, next: null,
    async setup(r) { await signIn(r, 'owner@example.com'); await quietBusiness(r, 'Example Travel Agency') },
    async run(r) {
      await r.go('#/summary', 600); await r.begin();
      await r.say('You can attach a photo or PDF to any invoice, receipt or ticket, for example a photo of the bank receipt.', async () => {
        await r.go('#/salesinvoice', 900); await r.click('tbody tr.click', { after: 1400 }); await r.scrollTo('#attCard', 900);
        await r.point('#attDrop'); await r.p.setInputFiles('#attFile', require('path').join(__dirname, '..', 'vendor/logo-mark.png')); await r.wait(1500) });
      await r.say('History shows every change, who made it and when. Deleted items can be restored from the Recycle bin for 30 days.', async () => { await r.click('#nav a[href="#/history"]', { after: 1500 }) });
      await r.say('In Settings, the lock date stops anyone changing old, closed months by mistake.', async () => { await r.click('#nav a[href="#/settings"]', { after: 900 }); await r.point('#sLock', { ms: 1400 }) });
      await r.say('Download a full backup of your business at any time. Your books always belong to you.', async () => { await r.scrollTo('#bk', 900); await r.point('#bk', { ms: 1400 }) });
      await r.say('Protect your account with two-step login: My account, then "Turn on two-step login", and scan the code with an authenticator app.', async () => { await r.click('#sideFoot a[href="#/profile"]', { after: 1300 }); await r.point('#mfaOn', { ms: 1500 }) });
      await r.say('Plan & billing shows your plan and trial days. Choose Basic or Pro there and send us the receipt on WhatsApp.', async () => { await r.click('#nav a[href="#/billing"]', { after: 1500 }); await r.scroll(380, 1200) });
      await r.say('Need help? Use Help & Support in the menu to write to us on WhatsApp or email.', async () => { await r.scroll(0, 500); await r.click('#sideFoot a[href="#/support"]', { after: 1800 }) });
      await r.end(null);
    } },
};
module.exports = CH;

if (require.main === module) (async () => {
  const want = process.argv.slice(2).map(Number); const list = want.length ? want : Object.keys(CH).map(Number);
  for (const n of list) { const c = CH[n]; const r = new Rec(c.name, c.title, { cloud: c.cloud, sub: c.sub, query: c.query });
    await r.start(); if (c.setup) await c.setup(r);
    try { await c.run(r) } catch (e) { console.error('chapter', n, e.message); await r.p.screenshot({ path: 'video/out/err-' + n + '.png' }).catch(() => {}); r.tEnd = r.now() }
    await r.finish() }
})();
