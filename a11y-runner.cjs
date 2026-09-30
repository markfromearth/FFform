const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const path = require('path');

const allViolations = [];

const saveAxeResults = (stepName, results) => {
  if (results.violations.length > 0) {
    results.violations.forEach(v => {
      allViolations.push({ step: stepName, ...v });
    });
  }
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(); const page = await context.newPage();
  const outPath = path.resolve('../a11y/01-automated.json');

  try {
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');
    
    // Step 1
    let results = await new AxeBuilder({ page }).analyze();
    saveAxeResults('Step 1: Your Business', results);
    fs.writeFileSync(outPath, JSON.stringify(allViolations, null, 2));

    // Trigger Error State on Step 1
    await page.getByRole('button', { name: /Continue/i }).click();
    await page.waitForTimeout(500);
    results = await new AxeBuilder({ page }).analyze();
    saveAxeResults('Step 1: Error State', results);
    fs.writeFileSync(outPath, JSON.stringify(allViolations, null, 2));

    // Fill Step 1
    await page.getByLabel('Yes', { exact: true }).check();
    await page.getByRole('button', { name: /I cannot find my business/i }).click();
    await page.getByLabel(/Business Name/i).fill('Test Company');
    await page.getByLabel(/Entity type/i).selectOption('limited_company');
    await page.getByLabel(/Industry/i).selectOption('manufacturing');
    await page.getByLabel(/Annual turnover/i).fill('100000');
    await page.getByLabel(/Gross debtor book/i).fill('50000');
    
    await page.getByRole('button', { name: /Continue/i }).click();
    await page.waitForTimeout(500);

    // Step 2
    results = await new AxeBuilder({ page }).analyze();
    saveAxeResults('Step 2: Your Details', results);
    fs.writeFileSync(outPath, JSON.stringify(allViolations, null, 2));
    
    await page.getByLabel(/Full name/i).fill('John Doe');
    await page.getByLabel(/Role/i).fill('Director');
    await page.getByLabel(/Phone number/i).fill('07700900000');
    await page.getByLabel(/Email/i).fill('test@example.com');
    await page.getByLabel(/When do you need funding\?/i).selectOption('asap');
    
    await page.getByRole('button', { name: /Continue/i }).click();
    await page.waitForTimeout(500);

    // Step 3
    results = await new AxeBuilder({ page }).analyze();
    saveAxeResults('Step 3: Your Invoices', results);
    fs.writeFileSync(outPath, JSON.stringify(allViolations, null, 2));
    
    await page.getByLabel(/What are you hoping to achieve\?/i).selectOption('cashflow');
    await page.getByLabel(/How much funding do you need\?/i).fill('50000');
    await page.getByLabel(/What are your typical payment terms\?/i).selectOption('30');
    await page.getByLabel(/customer concentration/i).selectOption('25');
    await page.getByRole('combobox', { name: /Where are your customers based\?/i }).selectOption(['uk']);
    await page.getByLabel('No', { exact: true }).first().check(); // existing invoice finance
    await page.getByLabel('No', { exact: true }).nth(1).check(); // hmrc status
    await page.getByText(/Working capital/i).click(); // funding purpose
    
    await page.getByRole('button', { name: /Continue/i }).click();
    await page.waitForTimeout(500);

    // Step 4
    results = await new AxeBuilder({ page }).analyze();
    saveAxeResults('Step 4: Final Details', results);
    fs.writeFileSync(outPath, JSON.stringify(allViolations, null, 2));
    
    await page.getByText('I have read and acknowledge').click();
    
    await page.getByRole('button', { name: /Continue/i }).click();
    await page.waitForTimeout(500);

    // Step 5
    results = await new AxeBuilder({ page }).analyze();
    saveAxeResults('Step 5: Review', results);
    fs.writeFileSync(outPath, JSON.stringify(allViolations, null, 2));
    
    await page.getByRole('button', { name: /Submit Application/i }).click();
    await page.waitForTimeout(2000); // Simulate API call and success transition

    // Step 7 (Success)
    results = await new AxeBuilder({ page }).analyze();
    saveAxeResults('Step 7: Success', results);
    fs.writeFileSync(outPath, JSON.stringify(allViolations, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
