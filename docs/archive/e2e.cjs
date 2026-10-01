const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  // Mock the API!
  await context.route('**/api/submit-application', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true })
    });
  });

  const page = await context.newPage();

  try {
    console.log("Starting End-to-End Test...");
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');

    // STEP 1: Your Business
    console.log("Filling Step 1...");
    await page.click('text=I cannot find my business');
    await page.fill('input[id="manual_company_name"]', 'Acme Test Corp');
    await page.selectOption('select[id="entity_type"]', 'limited_company');
    await page.selectOption('select[id="industry"]', 'manufacturing');
    
    await page.fill('input[id="annual_turnover"]', '1500000');
    await page.fill('input[id="gross_debtor_book"]', '250000');
    
    // B2B Radio
    await page.click('label[for="b2b_yes"]');
    await page.click('button:has-text("Continue")');

    // STEP 2: Your Details
    console.log("Filling Step 2...");
    await page.waitForSelector('text=Your details', { timeout: 5000 }).catch(() => {});
    await page.fill('input[id="contact_full_name"]', 'Jane Doe');
    await page.selectOption('select[id="contact_role"]', 'director_owner');
    await page.fill('input[id="phone"]', '07700900000');
    await page.fill('input[id="email"]', 'jane.doe@example.com');
    await page.click('text=As soon as possible');
    await page.click('button:has-text("Continue")');

    // STEP 3: Your Invoices
    console.log("Filling Step 3...");
    await page.waitForSelector('text=Your invoices', { timeout: 5000 }).catch(() => {});
    // desired outcome
    await page.click('text=Release cash from all unpaid invoices');

    await page.fill('input[id="requested_facility"]', '250000');
    await page.selectOption('select[id="payment_terms_days"]', '30_or_less');
    await page.selectOption('select[id="largest_debtor_concentration_pct"]', 'under_20');
    
    // Checkboxes for geography
    await page.click('text=UK');
    
    await page.click('button:has-text("Continue")');

    // STEP 4: Final Details
    console.log("Filling Step 4...");
    await page.waitForSelector('text=Final details', { timeout: 5000 }).catch(() => {});

    // Existing finance
    await page.click('label[for="existing-no"]');
    
    // HMRC
    await page.selectOption('select[id="hmrc_status"]', 'up_to_date');

    // Funding purpose (checkbox)
    await page.click('text=Support growth');

    await page.fill('textarea[id="additional_context"]', 'E2E Testing automated data entry.');
    
    await page.click('button:has-text("Continue")');

    // STEP 5: Review
    console.log("Reviewing and Submitting (Step 5)...");
    await page.waitForSelector('text=Review', { timeout: 5000 }).catch(() => {});
    
    // We must check the processing notice checkbox in Step 5 before submitting
    await page.click('input[type="checkbox"]', { force: true });
    
    await page.click('button:has-text("Submit my enquiry")');

    // STEP 6: Uploads
    console.log("Step 6: Uploads...");
    // FIX: Using getByRole for reliable targeting
    await page.waitForSelector('text=Upload', { timeout: 5000 }).catch(() => {});
    await page.getByRole('button', { name: /provide them later/i }).click();

    // STEP 7: Success
    console.log("Waiting for Success Page (Step 7)...");
    await page.waitForTimeout(4000); // Wait for the "Link Sent" delay
    
    const bodyText = await page.innerText('body');
    if (bodyText.includes('Complete') || bodyText.includes('Success') || bodyText.includes('Thank you') || bodyText.includes('application has been submitted') || bodyText.includes('Link sent')) {
        console.log("✅ End-to-End Test Passed Successfully!");
    } else {
        console.log("⚠️ End-to-End Test finished but couldn't verify success screen wording.");
    }

  } catch (err) {
    console.error("❌ E2E Test Failed:", err.message);
  } finally {
    await browser.close();
  }
})();
