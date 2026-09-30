const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');
    
    // Step 1
    let results = await new AxeBuilder({ page }).analyze();
    let violations = results.violations.filter(v => v.id === 'color-contrast' || v.id === 'aria-progressbar-name');
    console.log("Step 1 violations (contrast & progressbar):", violations.length);

    // Trigger Error State on Step 1
    await page.getByRole('button', { name: /Continue/i }).click();
    await page.waitForTimeout(500);
    
    // Focus should be on Error Summary container
    const isErrorSummaryFocused = await page.evaluate(() => {
      const active = document.activeElement;
      return active && active.getAttribute('role') === 'alert';
    });
    console.log("Error Summary focused on mount:", isErrorSummaryFocused);

    results = await new AxeBuilder({ page }).analyze();
    violations = results.violations.filter(v => v.id === 'color-contrast' || v.id === 'aria-progressbar-name');
    console.log("Step 1 Error violations (contrast & progressbar):", violations.length);
    
    console.log("Combobox roles:");
    const comboboxData = await page.evaluate(() => {
      const cb = document.getElementById('company_search');
      return {
        role: cb?.getAttribute('role'),
        expanded: cb?.getAttribute('aria-expanded'),
        controls: cb?.getAttribute('aria-controls'),
      };
    });
    console.log(comboboxData);

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
