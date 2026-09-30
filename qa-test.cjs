const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const report = {
    phase1: { status: 'Failed', details: [] },
    phase2: { status: 'Failed', details: [] },
    phase3: { status: 'Failed', details: [] },
    phase4: { status: 'Failed', details: [] },
  };

  // Listeners for network traffic
  page.on('response', async (response) => {
    const url = response.url();
    // Phase 1: Companies House
    if (url.includes('companieshouse.gov.uk') || url.includes('/api/company')) {
      const status = response.status();
      report.phase1.details.push(`Requested: ${url}, Status: ${status}`);
      if (status === 200) report.phase1.status = 'Passed';
    }
    
    // Phase 2: Turnstile
    if (url.includes('challenges.cloudflare.com/turnstile')) {
      const status = response.status();
      report.phase2.details.push(`Turnstile script loaded: ${status}`);
      if (status === 200) report.phase2.status = 'Passed';
    }

    // Phase 3: Submit Application
    if (url.includes('/api/submit-application')) {
      const status = response.status();
      let bodyText = '';
      try {
          bodyText = await response.text();
      } catch (e) {}
      report.phase3.details.push(`POST /api/submit-application, Status: ${status}, Response: ${bodyText.substring(0, 100)}`);
      if (status === 200) {
          report.phase3.status = 'Passed';
      } else {
          report.phase3.status = 'Failed';
      }
    }
  });

  try {
    console.log("Navigating to app...");
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');

    // === PHASE 1: Companies House ===
    console.log("Testing Phase 1...");
    // Type in the search box
    // Wait, the input is for autocomplete. 
    await page.fill('input[placeholder="e.g. Acme Corp or 12345678"]', '08209948');
    await page.waitForTimeout(3000); // Wait for autocomplete debounce/fetch
    
    // Just in case Phase 1 failed, we fallback to manual to reach Phase 3
    await page.click('text=I cannot find my business').catch(() => {});
    await page.fill('input[id="manual_company_name"]', 'Test Corp').catch(() => {});
    await page.selectOption('select[id="entity_type"]', 'limited_company').catch(() => {});
    await page.selectOption('select[id="industry"]', 'manufacturing').catch(() => {});
    
    await page.fill('input[id="annual_turnover"]', '1500000');
    await page.fill('input[id="gross_debtor_book"]', '250000');
    await page.click('label[for="b2b_yes"]');
    await page.click('button:has-text("Continue")');

    // Fill Step 2
    await page.waitForSelector('text=Your details', { timeout: 5000 }).catch(() => {});
    await page.fill('input[id="contact_full_name"]', 'Jane Doe');
    await page.selectOption('select[id="contact_role"]', 'director_owner');
    await page.fill('input[id="phone"]', '07700900000');
    await page.fill('input[id="email"]', 'jane.doe@example.com');
    await page.click('text=As soon as possible');
    await page.click('button:has-text("Continue")');

    // Fill Step 3
    await page.waitForSelector('text=Your invoices', { timeout: 5000 }).catch(() => {});
    await page.click('text=Release cash from all unpaid invoices');
    await page.fill('input[id="requested_facility"]', '250000');
    await page.selectOption('select[id="payment_terms_days"]', '30_or_less');
    await page.selectOption('select[id="largest_debtor_concentration_pct"]', 'under_20');
    await page.click('text=UK');
    await page.click('button:has-text("Continue")');

    // Fill Step 4
    await page.waitForSelector('text=Final details', { timeout: 5000 }).catch(() => {});
    await page.click('label[for="existing-no"]');
    await page.selectOption('select[id="hmrc_status"]', 'up_to_date');
    await page.click('text=Support growth');
    await page.click('button:has-text("Continue")');

    // === PHASE 2 & 3: Turnstile & Submission ===
    console.log("Testing Phase 2 and 3...");
    await page.waitForSelector('text=Review', { timeout: 5000 }).catch(() => {});
    
    // Check turnstile iframe
    const frames = page.frames();
    const hasTurnstile = frames.some(f => f.url().includes('challenges.cloudflare.com'));
    if (hasTurnstile) {
        report.phase2.status = 'Passed';
        report.phase2.details.push('Turnstile iframe found in DOM');
    } else {
        report.phase2.details.push('No Turnstile iframe found in DOM');
    }

    await page.click('input[type="checkbox"]', { force: true });
    await page.click('button:has-text("Submit my enquiry")');

    // Wait for network request to settle
    await page.waitForTimeout(4000);

    // If it failed, we won't reach Phase 4. We will just check if we are on step 6.
    const isStep6 = await page.locator('text=Upload').count() > 0;
    if (!isStep6) {
        report.phase4.details.push("Could not reach Step 6 due to Submission failure in Phase 3.");
    } else {
        report.phase4.details.push("Reached Step 6, but file upload not tested as backend doesn't exist.");
    }

  } catch (err) {
    console.error("Test Error:", err);
  } finally {
    fs.writeFileSync('qa-report.json', JSON.stringify(report, null, 2));
    await browser.close();
  }
})();
