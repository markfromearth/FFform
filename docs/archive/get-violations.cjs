const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');
  let results = await new AxeBuilder({ page }).analyze();
  console.log(JSON.stringify(results.violations.filter(v => v.id === 'color-contrast' || v.id === 'aria-progressbar-name').map(v => v.id), null, 2));
  await browser.close();
})();
