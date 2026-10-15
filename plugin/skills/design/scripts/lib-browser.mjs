/**
 * Shared browser launcher for the design-phase scripts. Design runs before the project has
 * node_modules, so Playwright is resolved from PLAYWRIGHT_MODULE when set (a scratch install:
 * `npm i --prefix "$TMPDIR/pw" playwright` → PLAYWRIGHT_MODULE="$TMPDIR/pw/node_modules/playwright/index.mjs"),
 * else from the normal module path. CHROME_PATH points at an installed Chrome to skip the browser download.
 */
export async function launchBrowser() {
  let mod;
  try {
    mod = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
  } catch {
    console.error('design scripts: Playwright not found. Run: npm i --prefix "$TMPDIR/pw" playwright && export PLAYWRIGHT_MODULE="$TMPDIR/pw/node_modules/playwright/index.mjs"');
    process.exit(2);
  }
  const chromium = mod.chromium || mod.default?.chromium;
  return chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
}

/** Runs a page-side setup string (assignments and calls on the prototype's globals), then an optional click. */
export async function applySetup(page, { setup, click }) {
  if (setup) await page.evaluate(new Function(setup));
  if (click) { await page.click(click); }
  if (setup || click) await page.waitForTimeout(300);
}

/** Waits for web fonts and lazy images so screenshots and measurements reflect the real render. */
export async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 20)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(250);
}
