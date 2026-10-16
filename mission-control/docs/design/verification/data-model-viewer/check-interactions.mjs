import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(new URL('../../../../package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const browser = await chromium.launch({ headless: true });
const base = process.env.MOCKUP_URL || 'http://127.0.0.1:8769/data-model-viewer/';
const checks = [];
const errors = [];
try {
  for (const view of ['architecture', 'portfolio']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}?view=${view}&theme=dark&demo=off`);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('#project-tabs .selected').innerText(), 'Arquitectura');
    assert.equal(await page.locator('#model-title').innerText(), 'Modelo de datos');
    assert.equal(await page.locator('.entity[data-entity]').count(), 6);
    assert.equal(await page.locator('.edge[data-relation]').count(), 5);
    const effectiveMinFont = await page.locator('.field-name').evaluateAll(elements => Math.min(...elements.map(el => parseFloat(getComputedStyle(el).fontSize) * el.getBoundingClientRect().height / el.offsetHeight)));
    assert(effectiveMinFont >= 12, `Unreadable rendered font: ${effectiveMinFont}`);
    await page.getByRole('button', { name: 'Seleccionar tabla users', exact: true }).click();
    assert.equal(await page.locator('#inspector h3').first().innerText(), 'users');
    assert(await page.locator('.entity.related').count() >= 1);
    await page.locator('#inspector button[data-relation="profile"]').click();
    assert((await page.locator('#inspector').innerText()).includes('0..1'));
    await page.locator('#model-search').fill('collection_id');
    assert((await page.locator('#search-status').innerText()).includes('collection_items'));
    await page.locator('#mode-list').click();
    assert.equal(await page.locator('#list-view [data-list-entity]').count(), 2);
    await page.locator('#model-search').fill('not-a-real-field');
    assert.equal(await page.locator('#list-view [data-list-entity]').count(), 0);
    await page.locator('#clear-search').click();
    assert.equal(await page.locator('#list-view [data-list-entity]').count(), 6);
    await page.locator('#mode-diagram').click();
    await page.locator('#expand').click();
    assert(await page.locator('#expanded').evaluate(el => el.open));
    const modalAudit = await new AxeBuilder({ page }).analyze();
    assert.equal(modalAudit.violations.length, 0, JSON.stringify(modalAudit.violations.map(v => v.id)));
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'expand');
    const initialZoom = await page.locator('#zoom-level').innerText();
    await page.locator('#zoom-in').click();
    assert.notEqual(await page.locator('#zoom-level').innerText(), initialZoom);
    await page.locator('#fit').click();
    assert(await page.locator('#zoom-level').innerText());
    await page.getByRole('link', { name: view === 'architecture' ? 'Portfolio' : 'Tablero', exact: true }).click();
    assert.equal(await page.locator('#project-tabs .selected').innerText(), 'Arquitectura');
    checks.push({ view, flow: 'shared architecture, selection, neighbors, optional relation, search, list, clear, zoom, fullscreen axe and focus, navigation without demo', effectiveMinFont });
    await context.close();
  }
  for (const view of ['architecture', 'portfolio']) {
    for (const state of ['loading', 'missing', 'none', 'error']) {
      const context = await browser.newContext({ viewport: { width: 375, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}?view=${view}&state=${state}&theme=light&demo=off`);
      assert(await page.locator('#empty-state').isVisible());
      assert.equal(await page.locator('#model-content').isVisible(), false);
      assert.equal(await page.locator('.provenance').isVisible(), false);
      assert.equal(await page.locator('.model-heading .chip').isVisible(), false);
      const audit = await new AxeBuilder({ page }).analyze();
      assert.equal(audit.violations.length, 0, JSON.stringify(audit.violations.map(v => v.id)));
      checks.push({ view, state, flow: 'distinct empty state, no contradictory ready facts, axe clean' });
      await context.close();
    }
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
} finally {
  await browser.close();
  await writeFile(new URL('./interactions.json', import.meta.url), JSON.stringify({ checks, errors }, null, 2) + '\n');
}
console.log(JSON.stringify({ flows: checks.length, runtimeErrors: errors.length }));
