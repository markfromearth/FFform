# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y.spec.js >> run axe on all steps
- Location: a11y.spec.js:16:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /I want to enter my details manually/i })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - link "Skip to main content" [ref=e4] [cursor=pointer]:
    - /url: "#main-content"
  - banner [ref=e5]:
    - img "Factoring Finance" [ref=e7]
  - main [ref=e8]:
    - generic [ref=e9]:
      - generic [ref=e10]:
        - generic [ref=e11]:
          - generic [ref=e12]: Step 1 of 5 · Your business
          - generic [ref=e13]: About 3 minutes
        - progressbar [ref=e14]
      - generic [ref=e17]:
        - generic [ref=e18]:
          - heading "Check your options" [level=2] [ref=e19]
          - heading "Tell us about your business" [level=1] [ref=e20]
          - paragraph [ref=e21]: We'll use these details to see which invoice finance providers are most likely to suit you.
        - generic [ref=e22]:
          - group "Does your business invoice other businesses for goods or services already supplied?" [ref=e23]:
            - generic [ref=e25]:
              - generic [ref=e26] [cursor=pointer]:
                - radio "Yes" [checked] [active] [ref=e27]
                - generic [ref=e28]: "Yes"
              - generic [ref=e29] [cursor=pointer]:
                - radio "A mixture of businesses and consumers" [ref=e30]
                - generic [ref=e31]: A mixture of businesses and consumers
          - generic [ref=e32]:
            - generic [ref=e33]: What is your business?
            - generic [ref=e34]:
              - textbox "What is your business?" [invalid] [ref=e36]:
                - /placeholder: e.g. Acme Corp or 12345678
              - paragraph [ref=e37]: Required
              - button "I cannot find my business" [ref=e40] [cursor=pointer]
          - generic [ref=e41]:
            - generic [ref=e42]:
              - generic [ref=e43]: Industry
              - combobox "Industry" [invalid] [ref=e44]:
                - option "Select industry" [selected]
                - option "Construction and trades"
                - option "Haulage and logistics"
                - option "Recruitment"
                - option "Manufacturing"
                - option "Other"
              - paragraph [ref=e45]: Required
            - generic [ref=e48]:
              - generic [ref=e49]: Approximate annual turnover
              - generic [ref=e50]:
                - generic: £
                - spinbutton "Approximate annual turnover" [invalid] [ref=e51]
              - generic [ref=e52]:
                - button "Under £100k" [ref=e53] [cursor=pointer]
                - button "£100k–£250k" [ref=e54] [cursor=pointer]
                - button "£250k–£500k" [ref=e55] [cursor=pointer]
                - button "£500k–£1m" [ref=e56] [cursor=pointer]
                - button "£1m–£5m" [ref=e57] [cursor=pointer]
                - button "£5m+" [ref=e58] [cursor=pointer]
              - paragraph [ref=e59]: Annual turnover is required
          - generic [ref=e62]:
            - generic [ref=e63]: How much is currently owed on unpaid invoices?
            - generic [ref=e64]:
              - generic: £
              - spinbutton "How much is currently owed on unpaid invoices?" [invalid] [ref=e65]
            - generic [ref=e66]:
              - button "Under £10k" [ref=e67] [cursor=pointer]
              - button "£10k–£50k" [ref=e68] [cursor=pointer]
              - button "£50k–£100k" [ref=e69] [cursor=pointer]
              - button "£100k–£250k" [ref=e70] [cursor=pointer]
              - button "£250k–£500k" [ref=e71] [cursor=pointer]
              - button "£500k+" [ref=e72] [cursor=pointer]
            - paragraph [ref=e73]: Debtor book is required
        - generic [ref=e76]:
          - generic [ref=e80]:
            - paragraph [ref=e81]: "Please provide the missing information to continue:"
            - list [ref=e82]:
              - listitem [ref=e83]:
                - generic [ref=e84]: "Business Name:"
                - text: Required
              - listitem [ref=e85]:
                - generic [ref=e86]: "Entity Type:"
                - text: Required
              - listitem [ref=e87]:
                - generic [ref=e88]: "Industry:"
                - text: Required
              - listitem [ref=e89]:
                - generic [ref=e90]: "Annual Turnover:"
                - text: Annual turnover is required
              - listitem [ref=e91]:
                - generic [ref=e92]: "Unpaid Invoices:"
                - text: Debtor book is required
          - generic [ref=e93]:
            - paragraph [ref=e94]: Initial enquiry only — this will not affect your credit score.
            - button "Continue" [ref=e97] [cursor=pointer]
  - contentinfo [ref=e100]:
    - generic [ref=e101]:
      - generic [ref=e102]:
        - link "Privacy Policy" [ref=e103] [cursor=pointer]:
          - /url: "#"
        - generic [ref=e104]: •
        - link "Accessibility" [ref=e105] [cursor=pointer]:
          - /url: "#"
        - generic [ref=e106]: •
        - generic [ref=e107]: Need help? 0800 368 7474
      - generic [ref=e112]: © 2026 Factoring Finance Ltd
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | import fs from 'fs';
  4  | import path from 'path';
  5  | 
  6  | const allViolations = [];
  7  | 
  8  | const saveAxeResults = (stepName, results) => {
  9  |   if (results.violations.length > 0) {
  10 |     results.violations.forEach(v => {
  11 |       allViolations.push({ step: stepName, ...v });
  12 |     });
  13 |   }
  14 | };
  15 | 
  16 | test('run axe on all steps', async ({ page }) => {
  17 |   test.setTimeout(60000); // 1 minute
  18 | 
  19 |   await page.goto('http://localhost:5173/');
  20 |   await page.waitForLoadState('networkidle');
  21 |   
  22 |   // Step 1
  23 |   let results = await new AxeBuilder({ page }).analyze();
  24 |   saveAxeResults('Step 1: Your Business', results);
  25 |   
  26 |   // Trigger Error State on Step 1
  27 |   await page.getByRole('button', { name: /Continue/i }).click();
  28 |   await page.waitForTimeout(500); // wait for validation errors
  29 |   results = await new AxeBuilder({ page }).analyze();
  30 |   saveAxeResults('Step 1: Error State', results);
  31 | 
  32 |   // Fill Step 1
  33 |   await page.getByLabel('Yes', { exact: true }).check();
  34 |   // Enter manual details
> 35 |   await page.getByRole('button', { name: /I want to enter my details manually/i }).click();
     |                                                                                    ^ Error: locator.click: Test timeout of 60000ms exceeded.
  36 |   await page.getByLabel(/Company name/i).fill('Test Company');
  37 |   await page.getByLabel(/Entity type/i).selectOption('ltd');
  38 |   await page.getByLabel(/Industry/i).selectOption('manufacturing');
  39 |   await page.getByLabel(/Annual turnover/i).fill('100000');
  40 |   await page.getByLabel(/Gross debtor book/i).fill('50000');
  41 |   
  42 |   await page.getByRole('button', { name: /Continue/i }).click();
  43 |   await page.waitForTimeout(500);
  44 | 
  45 |   // Step 2
  46 |   results = await new AxeBuilder({ page }).analyze();
  47 |   saveAxeResults('Step 2: Your Details', results);
  48 |   
  49 |   await page.getByLabel(/Full name/i).fill('John Doe');
  50 |   await page.getByLabel(/Role/i).fill('Director');
  51 |   await page.getByLabel(/Phone number/i).fill('07700900000');
  52 |   await page.getByLabel(/Email/i).fill('test@example.com');
  53 |   await page.getByLabel(/When do you need funding?/i).selectOption('asap');
  54 |   
  55 |   await page.getByRole('button', { name: /Continue/i }).click();
  56 |   await page.waitForTimeout(500);
  57 | 
  58 |   // Step 3
  59 |   results = await new AxeBuilder({ page }).analyze();
  60 |   saveAxeResults('Step 3: Your Invoices', results);
  61 |   
  62 |   await page.getByLabel(/What are you hoping to achieve?/i).selectOption('cashflow');
  63 |   await page.getByLabel(/How much funding do you need?/i).fill('50000');
  64 |   await page.getByLabel(/What are your typical payment terms?/i).selectOption('30');
  65 |   await page.getByLabel(/customer concentration/i).selectOption('25');
  66 |   await page.getByLabel(/Where are your customers based?/i).selectOption(['uk']);
  67 |   await page.getByLabel('No', { exact: true }).check(); // existing invoice finance
  68 |   await page.getByLabel('No', { exact: true }).check(); // hmrc status
  69 |   await page.getByText(/Working capital/i).click(); // funding purpose
  70 |   
  71 |   await page.getByRole('button', { name: /Continue/i }).click();
  72 |   await page.waitForTimeout(500);
  73 | 
  74 |   // Step 4
  75 |   results = await new AxeBuilder({ page }).analyze();
  76 |   saveAxeResults('Step 4: Final Details', results);
  77 |   
  78 |   await page.getByText('I have read and acknowledge').click();
  79 |   
  80 |   await page.getByRole('button', { name: /Continue/i }).click();
  81 |   await page.waitForTimeout(500);
  82 | 
  83 |   // Step 5
  84 |   results = await new AxeBuilder({ page }).analyze();
  85 |   saveAxeResults('Step 5: Review', results);
  86 |   
  87 |   await page.getByRole('button', { name: /Submit Application/i }).click();
  88 |   await page.waitForTimeout(1000); // Simulate API call and success transition
  89 | 
  90 |   // Step 7 (Success)
  91 |   results = await new AxeBuilder({ page }).analyze();
  92 |   saveAxeResults('Step 7: Success', results);
  93 | 
  94 |   // Dump all violations
  95 |   const outPath = path.resolve('../a11y/01-automated.json');
  96 |   fs.writeFileSync(outPath, JSON.stringify(allViolations, null, 2));
  97 | });
  98 | 
```