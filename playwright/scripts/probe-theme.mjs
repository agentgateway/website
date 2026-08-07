// One-off probe: how does the agentgateway UI switch themes?
// Run against a locally running UI on :15000.
import { chromium } from '@playwright/test';

const URL = 'http://localhost:15000/ui/';

function themeState(page) {
  return page.evaluate(() => ({
    htmlClass: document.documentElement.className,
    htmlDataTheme: document.documentElement.getAttribute('data-theme'),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    localStorageKeys: Object.fromEntries(
      Object.keys(localStorage)
        .filter((k) => /theme|color|mode|dark/i.test(k))
        .map((k) => [k, localStorage.getItem(k)]),
    ),
  }));
}

const browser = await chromium.launch();

for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  console.log(`\n=== colorScheme: ${scheme} (no interaction) ===`);
  console.log(JSON.stringify(await themeState(page), null, 2));
  await ctx.close();
}

// Look for a theme toggle control.
const ctx = await browser.newContext({ colorScheme: 'light' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });

const candidates = [
  page.getByRole('button', { name: /theme|dark|light|appearance/i }),
  page.getByLabel(/theme|dark|light|appearance/i),
  page.locator('[aria-label*="theme" i], [title*="theme" i], button:has-text("Toggle")'),
];
let toggle = null;
for (const c of candidates) {
  if (await c.count().catch(() => 0)) {
    toggle = c.first();
    break;
  }
}

if (!toggle) {
  console.log('\n=== toggle: NOT FOUND by common selectors ===');
} else {
  console.log('\n=== toggle found — clicking it ===');
  const before = await themeState(page);
  await toggle.click();
  await page.waitForTimeout(500);
  const after = await themeState(page);
  console.log('before:', JSON.stringify(before));
  console.log('after: ', JSON.stringify(after));
}

await browser.close();
