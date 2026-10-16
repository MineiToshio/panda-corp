/**
 * Legacy entry points of the design-phase browser helpers, kept for scripts written against them. The capture
 * protocol itself lives in fidelity/lib.mjs (PLAYWRIGHT_MODULE / CHROME_PATH resolution, touch emulation, fail-closed
 * images); these delegate to it.
 */
import { assertImagesLoaded, BrowserUnavailable, launch, loadImages } from './fidelity/lib.mjs';

/**
 * Starts Chromium, or exits 2 with the install hint when Playwright or the browser is missing.
 * @returns {Promise<object>} a Playwright Browser
 */
export async function launchBrowser() {
  try {
    return await launch();
  } catch (e) {
    if (!(e instanceof BrowserUnavailable)) throw e;
    console.error(`design scripts: ${e.message}`);
    process.exit(2);
  }
}

/**
 * Runs a page-side setup string, then an optional click.
 * @param {object} page Playwright page
 * @param {{setup?: string, click?: string}} state
 */
export async function applySetup(page, { setup, click }) {
  if (setup) await page.evaluate(new Function(setup));
  if (click) await page.click(click);
  if (setup || click) await page.waitForTimeout(300);
}

/**
 * Waits for web fonts and images (lazy ones forced), then fails when a visible image did not load.
 * @param {object} page Playwright page
 */
export async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await loadImages(page, 8000);
  await page.waitForTimeout(250);
  await assertImagesLoaded(page);
}
