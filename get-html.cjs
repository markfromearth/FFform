const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');
  console.log("Found button?", await page.locator('text=I cannot find my business').count());
  await page.click('text=I cannot find my business');
  console.log("Found manual input?", await page.locator('#manual_company_name').count());
  await browser.close();
})();
