import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';

const allViolations = [];

const saveAxeResults = (stepName, results) => {
  if (results.violations.length > 0) {
    results.violations.forEach(v => {
      allViolations.push({ step: stepName, ...v });
    });
  }
};

test('run axe on all steps', async ({ page }) => {
  test.setTimeout(60000); // 1 minute

  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');
  
  // Step 1
  let results = await new AxeBuilder({ page }).analyze();
  saveAxeResults('Step 1: Your Business', results);
  
  // Trigger Error State on Step 1
  await page.getByRole('button', { name: /Continue/i }).click();
  await page.waitForTimeout(500); // wait for validation errors
  results = await new AxeBuilder({ page }).analyze();
  saveAxeResults('Step 1: Error State', results);

  // Fill Step 1
  await page.getByLabel('Yes', { exact: true }).check();
  // Enter manual details
  await page.getByRole('button', { name: /I want to enter my details manually/i }).click();
  await page.getByLabel(/Company name/i).fill('Test Company');
  await page.getByLabel(/Entity type/i).selectOption('ltd');
  await page.getByLabel(/Industry/i).selectOption('manufacturing');
  await page.getByLabel(/Annual turnover/i).fill('100000');
  await page.getByLabel(/Gross debtor book/i).fill('50000');
  
  await page.getByRole('button', { name: /Continue/i }).click();
  await page.waitForTimeout(500);

  // Step 2
  results = await new AxeBuilder({ page }).analyze();
  saveAxeResults('Step 2: Your Details', results);
  
  await page.getByLabel(/Full name/i).fill('John Doe');
  await page.getByLabel(/Role/i).fill('Director');
  await page.getByLabel(/Phone number/i).fill('07700900000');
  await page.getByLabel(/Email/i).fill('test@example.com');
  await page.getByLabel(/When do you need funding?/i).selectOption('asap');
  
  await page.getByRole('button', { name: /Continue/i }).click();
  await page.waitForTimeout(500);

  // Step 3
  results = await new AxeBuilder({ page }).analyze();
  saveAxeResults('Step 3: Your Invoices', results);
  
  await page.getByLabel(/What are you hoping to achieve?/i).selectOption('cashflow');
  await page.getByLabel(/How much funding do you need?/i).fill('50000');
  await page.getByLabel(/What are your typical payment terms?/i).selectOption('30');
  await page.getByLabel(/customer concentration/i).selectOption('25');
  await page.getByLabel(/Where are your customers based?/i).selectOption(['uk']);
  await page.getByLabel('No', { exact: true }).check(); // existing invoice finance
  await page.getByLabel('No', { exact: true }).check(); // hmrc status
  await page.getByText(/Working capital/i).click(); // funding purpose
  
  await page.getByRole('button', { name: /Continue/i }).click();
  await page.waitForTimeout(500);

  // Step 4
  results = await new AxeBuilder({ page }).analyze();
  saveAxeResults('Step 4: Final Details', results);
  
  await page.getByText('I have read and acknowledge').click();
  
  await page.getByRole('button', { name: /Continue/i }).click();
  await page.waitForTimeout(500);

  // Step 5
  results = await new AxeBuilder({ page }).analyze();
  saveAxeResults('Step 5: Review', results);
  
  await page.getByRole('button', { name: /Submit Application/i }).click();
  await page.waitForTimeout(1000); // Simulate API call and success transition

  // Step 7 (Success)
  results = await new AxeBuilder({ page }).analyze();
  saveAxeResults('Step 7: Success', results);

  // Dump all violations
  const outPath = path.resolve('../a11y/01-automated.json');
  fs.writeFileSync(outPath, JSON.stringify(allViolations, null, 2));
});
