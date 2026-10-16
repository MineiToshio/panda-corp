import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../../../package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const output = fileURLToPath(new URL('./', import.meta.url));
const base = process.env.MOCKUP_URL || 'http://127.0.0.1:8769/data-model-viewer/';
await mkdir(new URL('./screenshots/', import.meta.url), { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const failures = [];
try {
  for (const view of ['architecture', 'portfolio']) {
    for (const theme of ['dark', 'light']) {
      for (const width of [320, 375, 768, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
        const page = await context.newPage();
        const runtimeErrors = [];
        const badResponses = [];
        page.on('pageerror', error => runtimeErrors.push(error.message));
        page.on('response', response => { if (response.status() >= 400) badResponses.push(response.url()); });
        await page.goto(`${base}?view=${view}&theme=${theme}&demo=off&host=page`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const metrics = await page.evaluate(() => {
          const visible = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
          return {
            horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
            diagramDefault: document.querySelector('#mode-diagram').getAttribute('aria-pressed') === 'true',
            canvasOverflow: getComputedStyle(document.querySelector('#canvas')).overflow,
            visibleH1s: [...document.querySelectorAll('h1')].filter(visible).length,
            demoLeaks: [...document.querySelectorAll('[data-demo-only]')].filter(visible).length,
            smallText: [...document.querySelectorAll('body *')].filter(el => visible(el) && [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 12).slice(0, 8).map(el => el.textContent.trim().slice(0, 90)),
            smallControls: [...document.querySelectorAll('button,input,select')].filter(visible).filter(el => el.getBoundingClientRect().height < 44 || el.getBoundingClientRect().width < 44).map(el => el.getAttribute('aria-label') || el.textContent.trim()),
            fontFacesLoaded: [...document.fonts].filter(font => font.status === 'loaded').map(font => font.family),
          };
        });
        const audit = await new AxeBuilder({ page }).analyze();
        const violations = audit.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) }));
        const row = { view, theme, width, ...metrics, runtimeErrors, badResponses, violations };
        results.push(row);
        if (!metrics.diagramDefault || metrics.canvasOverflow !== 'hidden' || metrics.horizontalOverflow || metrics.visibleH1s !== 1 || metrics.demoLeaks || metrics.smallText.length || metrics.smallControls.length || runtimeErrors.length || badResponses.length || violations.length) failures.push(row);
        if ([320, 375, 1280].includes(width)) await page.screenshot({ path: `${output}screenshots/${view}-${theme}-${width}.png`, fullPage: true });
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
await writeFile(`${output}matrix.json`, `${JSON.stringify({ base, results, failures }, null, 2)}\n`);
console.log(JSON.stringify({ cases: results.length, failures: failures.length, details: failures }, null, 2));
if (failures.length) process.exitCode = 1;
