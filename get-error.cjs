const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');

  await page.click('text=I cannot find my business');
  await page.fill('input[id="manual_company_name"]', 'Acme Test Corp');
  await page.selectOption('select[id="entity_type"]', 'limited_company');
  await page.selectOption('select[id="industry"]', 'manufacturing');
  await page.fill('input[id="annual_turnover"]', '1500000');
  await page.fill('input[id="gross_debtor_book"]', '250000');
  await page.click('label[for="b2b_yes"]');
  await page.click('button:has-text("Continue")');

  await page.fill('input[id="contact_full_name"]', 'Jane Doe');
  await page.selectOption('select[id="contact_role"]', 'director_owner');
  await page.fill('input[id="phone"]', '07700900000');
  await page.fill('input[id="email"]', 'jane.doe@example.com');
  await page.click('text=As soon as possible');
  await page.click('button:has-text("Continue")');

  await page.click('text=Release cash from all unpaid invoices');
  await page.fill('input[id="requested_facility"]', '250000');
  await page.selectOption('select[id="payment_terms_days"]', '30_or_less');
  await page.selectOption('select[id="largest_debtor_concentration_pct"]', 'under_20');
  await page.click('text=UK');
  await page.click('button:has-text("Continue")');

  await page.click('label[for="existing-no"]');
  await page.selectOption('select[id="hmrc_status"]', 'up_to_date');
  await page.click('text=Support growth');
  await page.fill('textarea[id="additional_context"]', 'E2E Testing.');
  await page.click('button:has-text("Continue")');

  await page.click('input[type="checkbox"]', { force: true });
  await page.click('button:has-text("Submit my enquiry")');

  await page.waitForTimeout(2000);
  
  const html = await page.innerHTML('.text-error');
  console.log("Error html:", html);
  await browser.close();
})();
