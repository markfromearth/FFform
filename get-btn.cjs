const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');
  const btn = await page.$('.bg-primary');
  const style = await page.evaluate(el => window.getComputedStyle(el).color, btn);
  console.log(style);
  await browser.close();
})();
