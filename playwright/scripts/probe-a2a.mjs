import { chromium } from '@playwright/test';
const BASE = 'http://localhost:15100';
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('requestfailed', (r) => console.log(`  ✗ ${r.url()} : ${r.failure()?.errorText}`));
page.on('console', (m) => { if (m.type() === 'error') console.log(`  [err] ${m.text()}`); });

await page.goto(`${BASE}/ui/`, { waitUntil: 'networkidle' });
const skip = page.getByRole('button', { name: /skip setup/i });
await skip.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
if (await skip.count()) await skip.click();

console.log('=== nav links ===');
for (const a of await page.locator('a[href]').all()) {
  const href = await a.getAttribute('href');
  const text = (await a.innerText().catch(() => '')).trim().replace(/\s+/g, ' ');
  if (href) console.log(`  ${href}  "${text}"`);
}

// A2A likely lives under the same playground or a dedicated route. Try candidates.
for (const path of ['/ui/mcp/playground', '/ui/a2a/playground', '/ui/playground', '/ui/agents']) {
  const resp = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }).catch(() => null);
  const code = resp ? resp.status() : 'err';
  const s2 = page.getByRole('button', { name: /skip setup/i });
  if (await s2.count()) await s2.click();
  await page.waitForTimeout(800);
  const heads = await page.locator('h1,h2,h3').allInnerTexts().catch(() => []);
  const btns = await page.getByRole('button').allInnerTexts().catch(() => []);
  const a2a = /a2a|agent|skill|task/i.test(await page.locator('body').innerText());
  console.log(`\n=== ${path} -> ${code} | a2a-ish=${a2a} ===`);
  console.log('  headings:', JSON.stringify(heads));
  console.log('  buttons :', JSON.stringify(btns));
}

await page.screenshot({ path: '/tmp/a2a-probe.png', fullPage: true });
console.log('\nsaved /tmp/a2a-probe.png');
await browser.close();
