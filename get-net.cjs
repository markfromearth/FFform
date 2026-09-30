const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('response', async (response) => {
      if (response.url().includes('/api/')) {
        console.log(response.url(), response.status());
        console.log(await response.text());
      }
  });
  await page.goto('http://localhost:5173/');
  await page.fill('input[placeholder="e.g. Acme Corp or 12345678"]', '08209948');
  await page.waitForTimeout(4000);
  
  // click manual
  await page.click('text=I cannot find my business');
  await page.fill('input[id="manual_company_name"]', 'Test Corp');
  await page.selectOption('select[id="entity_type"]', 'limited_company');
  await page.selectOption('select[id="industry"]', 'manufacturing');
  await page.fill('input[id="annual_turnover"]', '1500000');
  await page.fill('input[id="gross_debtor_book"]', '250000');
  await page.click('label[for="b2b_yes"]');
  await page.click('button:has-text("Continue")');
  
  // fill step 2
  await page.fill('input[id="contact_full_name"]', 'Jane Doe');
  await page.selectOption('select[id="contact_role"]', 'director_owner');
  await page.fill('input[id="phone"]', '07700900000');
  await page.fill('input[id="email"]', 'jane.doe@example.com');
  await page.click('text=As soon as possible');
  await page.click('button:has-text("Continue")');

  // fill step 3
  await page.click('text=Release cash from all unpaid invoices');
  await page.fill('input[id="requested_facility"]', '250000');
  await page.selectOption('select[id="payment_terms_days"]', '30_or_less');
  await page.selectOption('select[id="largest_debtor_concentration_pct"]', 'under_20');
  await page.click('text=UK');
  await page.click('button:has-text("Continue")');

  // fill step 4
  await page.click('label[for="existing-no"]');
  await page.selectOption('select[id="hmrc_status"]', 'up_to_date');
  await page.click('text=Support growth');
  await page.click('button:has-text("Continue")');

  await page.click('input[type="checkbox"]', { force: true });
  await page.click('button:has-text("Submit my enquiry")');
  await page.waitForTimeout(3000);

  await browser.close();
})();
