/**
 * The capture protocol shared by every browser stage.
 * - Launch: PLAYWRIGHT_MODULE (a package directory or an index.mjs) else `playwright` from the normal module path;
 *   CHROME_PATH else Playwright's bundled Chromium. File access between local files is allowed.
 * - Pages: one warm context per worker x width x theme. Widths below `touchBelow` are touch phones: isMobile + hasTouch
 *   plus CDP Emulation.setEmulatedMedia hover/any-hover none and pointer/any-pointer coarse, re-asserted after every
 *   shot and checked with matchMedia in every probe.
 * - Navigation: a page whose document is still clean moves by location.hash; anything else is a full load. Every
 *   document load starts with empty Web Storage (an init script) and the pointer parked outside the page, as a fresh
 *   context would.
 * - Capture: the viewport is grown to the document height (never Playwright fullPage, whose captureBeyondViewport drops
 *   the touch emulation); a probe taken while grown fails the run if the host-auto class is on or the touch branch lost.
 * - Settle: fonts, lazy images forced eager (the attribute is restored, a DOM snapshot is unchanged), images decoded,
 *   then a visible image that did not load fails the run. Before a measurement, infinite animations pause at
 *   currentTime 0 and finite ones finish (freezeAnimations); a screenshot uses Playwright's animations: 'disabled'.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Thrown when no browser can be started; callers that may skip (tests) check `instanceof`. */
export class BrowserUnavailable extends Error {}

/**
 * Resolves Playwright's chromium launcher.
 * @returns {Promise<object>} the `chromium` browser type
 * @throws {BrowserUnavailable} when Playwright cannot be loaded
 */
export async function loadChromium() {
  const spec = process.env.PLAYWRIGHT_MODULE;
  let mod;
  try {
    if (!spec) mod = await import('playwright');
    else if (fs.existsSync(spec) && fs.statSync(spec).isDirectory()) mod = createRequire(import.meta.url)(path.resolve(spec));
    else mod = await import(fs.existsSync(spec) ? pathToFileURL(path.resolve(spec)).href : spec);
  } catch (e) {
    throw new BrowserUnavailable(`Playwright not found (${spec || 'playwright'}): ${e.message.split('\n')[0]}. Install it in a scratch folder (npm i --prefix "$TMPDIR/pw" playwright) and set PLAYWRIGHT_MODULE="$TMPDIR/pw/node_modules/playwright".`);
  }
  const chromium = mod.chromium || mod.default?.chromium;
  if (!chromium) throw new BrowserUnavailable(`${spec || 'playwright'} exports no chromium`);
  return chromium;
}

/**
 * Starts Chromium.
 * @returns {Promise<object>} a Playwright Browser
 * @throws {BrowserUnavailable} when Playwright or the browser binary is missing
 */
export async function launch() {
  const chromium = await loadChromium();
  const opts = { args: ['--allow-file-access-from-files', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'], timeout: 180000 };
  if (process.env.CHROME_PATH) {
    if (!fs.existsSync(process.env.CHROME_PATH)) throw new BrowserUnavailable(`CHROME_PATH does not exist: ${process.env.CHROME_PATH}`);
    opts.executablePath = process.env.CHROME_PATH;
  }
  try {
    return await chromium.launch(opts);
  } catch (e) {
    throw new BrowserUnavailable(`Chromium did not start: ${e.message.split('\n')[0]} (set CHROME_PATH to a Chromium or headless shell)`);
  }
}

/**
 * @param {object} cfg normalised config
 * @param {number} w viewport width
 * @returns {boolean} whether this width is emulated as a touch phone
 */
export const isTouch = (cfg, w) => w < cfg.touchBelow;

const COLOR_SCHEMES = new Set(['light', 'dark']);

/**
 * Opens a warm page for one width x theme.
 * @param {object} browser Playwright Browser
 * @param {object} cfg normalised config
 * @param {{width: number, theme: string}} key the context
 * @returns {Promise<object>} handle {ctx, page, cdp, width, theme, touch, dirty, base}
 */
export async function openHandle(browser, cfg, { width, theme }) {
  const touch = isTouch(cfg, width);
  const ctx = await browser.newContext({ viewport: { width, height: cfg.baseHeight }, isMobile: touch, hasTouch: touch, colorScheme: COLOR_SCHEMES.has(theme) ? theme : 'light', deviceScaleFactor: 1 });
  ctx.setDefaultTimeout(120000);
  ctx.setDefaultNavigationTimeout(180000);
  await ctx.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* storage disabled for this origin */ } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const handle = { ctx, page, cdp, width, theme, touch, dirty: true, base: null, cfg };
  await emulate(handle);
  return handle;
}

/** Closes a handle's context. @param {object} h handle */
export async function closeHandle(h) {
  await h.ctx.close().catch(() => {});
}

/**
 * (Re-)asserts the media emulation: prefers-color-scheme, and the touch branch at phone widths.
 * @param {object} h handle
 */
export async function emulate(h) {
  const features = [];
  if (COLOR_SCHEMES.has(h.theme)) features.push({ name: 'prefers-color-scheme', value: h.theme });
  if (h.touch) features.push({ name: 'hover', value: 'none' }, { name: 'any-hover', value: 'none' }, { name: 'pointer', value: 'coarse' }, { name: 'any-pointer', value: 'coarse' });
  await h.cdp.send('Emulation.setEmulatedMedia', { features });
}

/**
 * The prototype URL of a route: the route's own query, then demo-off, theme and host params.
 * @param {object} cfg normalised config
 * @param {string} route '#screen' or '?k=v#screen'
 * @param {{theme?: string, file?: string, extra?: string}} [opts] file: another page (e.g. the linked copy)
 * @returns {string} file URL
 */
export function urlFor(cfg, route, { theme = cfg.themes[0], file = cfg.paths.prototype, extra = '' } = {}) {
  let q = '';
  let h = route || '';
  if (h.startsWith('?')) { const i = h.indexOf('#'); q = h.slice(1, i < 0 ? undefined : i); h = i < 0 ? '' : h.slice(i); }
  const params = new URLSearchParams(q);
  for (const p of [cfg.params.demoOff, cfg.params.theme ? `${cfg.params.theme}=${theme}` : '', cfg.params.host, extra]) {
    if (p) for (const [k, v] of new URLSearchParams(p)) params.set(k, v);
  }
  const qs = params.toString();
  return `${pathToFileURL(file).href}${qs ? `?${qs}` : ''}${h}`;
}

const splitHash = (url) => { const i = url.indexOf('#'); return i < 0 ? [url, ''] : [url.slice(0, i), url.slice(i)]; };

/**
 * Moves a warm page to a URL. A clean page on the same document only changes location.hash; a dirty one (any setup,
 * state or snapshot touched its DOM) or another document is a full load.
 * @param {object} h handle
 * @param {string} url target
 */
export async function navigate(h, url) {
  const [base, hash] = splitHash(url);
  // a warm page keeps the pointer where the previous unit clicked, which would leave :hover on whatever sits there
  // in the next document; a fresh context has no pointer position, so park it outside the page
  await h.page.mouse.move(-1, -1);
  if (h.cfg.hashNavigation && !h.dirty && h.base === base && hash) {
    if (h.page.url() !== url) {
      await h.page.evaluate((hh) => new Promise((r) => { addEventListener('hashchange', () => r(), { once: true }); location.hash = hh; setTimeout(r, 2000); }), hash);
    }
    await h.page.evaluate(() => window.scrollTo(0, 0));
  } else {
    if (h.base === base) await h.page.goto('about:blank');
    await h.page.goto(url, { waitUntil: 'load' });
  }
  h.base = base;
  h.dirty = false;
}

/**
 * Settles a page: fonts, lazy images forced, images decoded, optional scroll pass, fixed wait, then fail-closed images.
 * @param {object} h handle
 * @param {{scroll?: boolean}} [opts]
 */
export async function settle(h, { scroll = h.cfg.settle.scrollPass } = {}) {
  const { page, cfg } = h;
  await page.evaluate(() => document.fonts.ready);
  if (scroll) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 25)); }
      window.scrollTo(0, 0);
    });
  }
  await loadImages(page, cfg.settle.imageTimeoutMs);
  if (cfg.settle.waitMs) await page.waitForTimeout(cfg.settle.waitMs);
  await assertImagesLoaded(page);
}

/**
 * Forces every lazy image to load (the loading attribute is put back afterwards) and waits for all images to decode,
 * at most `timeoutMs`. It never asserts: assertImagesLoaded does.
 * @param {object} page Playwright page
 * @param {number} timeoutMs
 */
export async function loadImages(page, timeoutMs) {
  await page.evaluate(async (ms) => {
    const lazy = [...document.images].filter((i) => i.loading === 'lazy');
    for (const i of lazy) i.loading = 'eager';
    const wait = Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))))
      .then(() => Promise.all([...document.images].filter((i) => i.complete && i.naturalWidth).map((i) => i.decode().catch(() => null))));
    await Promise.race([wait, new Promise((r) => setTimeout(r, ms))]);
    for (const i of lazy) i.setAttribute('loading', 'lazy');
  }, timeoutMs);
}

/**
 * Fails when a visible image is not decoded (complete false or naturalWidth 0): a capture with a broken image is never produced.
 * @param {object} page Playwright page
 * @throws {Error} listing the broken sources
 */
export async function assertImagesLoaded(page) {
  const broken = await page.evaluate(() => [...document.images]
    .filter((i) => i.getClientRects().length > 0 && getComputedStyle(i).visibility !== 'hidden' && (!i.complete || i.naturalWidth === 0))
    .map((i) => i.getAttribute('src') || i.currentSrc || '(no src)'));
  if (broken.length) {
    const srcs = [...new Set(broken)];
    throw new Error(`${broken.length} visible image(s) did not load on ${page.url()}:\n  ${srcs.slice(0, 20).join('\n  ')}${srcs.length > 20 ? `\n  ... and ${srcs.length - 20} more` : ''}`);
  }
}

/**
 * Pauses every infinite animation at currentTime 0 and finishes every finite one (deterministic frames).
 * @param {object} page Playwright page
 */
export async function freezeAnimations(page) {
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      try {
        if (a.effect && a.effect.getTiming().iterations === Infinity) { a.pause(); a.currentTime = 0; } else a.finish();
      } catch { /* an animation without an end (no effect timing) is left as is */ }
    }
  });
}

/**
 * Probe recorded with every capture: the media branch, host-auto, theme and (when configured) demo-off.
 * @param {object} h handle
 * @returns {Promise<object>} {hover, coarse, hostAuto, theme, demoOff?}
 */
export async function mediaProbe(h) {
  const { cfg } = h;
  return h.page.evaluate(({ hostCls, themeExpr, themeAttr, demoExpr }) => {
    const o = { hover: matchMedia('(hover:hover)').matches, coarse: matchMedia('(pointer:coarse)').matches };
    o.hostAuto = hostCls ? document.documentElement.classList.contains(hostCls) : false;
    o.theme = themeExpr ? (0, eval)(themeExpr) : document.documentElement.getAttribute(themeAttr);
    if (demoExpr) o.demoOff = Boolean((0, eval)(demoExpr));
    return o;
  }, { hostCls: cfg.hostAutoClass, themeExpr: cfg.probe.theme, themeAttr: cfg.themeAttribute, demoExpr: cfg.probe.demoOff });
}

/**
 * Fails unless a probe shows product mode: host-auto off, demo off (when probed) and, at phone width, the touch branch.
 * @param {object} probe a mediaProbe result
 * @param {object} h handle
 * @param {string} label what was captured
 * @param {{product?: boolean}} [opts] product false: a generated page (catalogue), not the prototype; demo-off is not probed
 */
export function assertProbe(probe, h, label, { product = true } = {}) {
  if (probe.hostAuto) throw new Error(`host-auto class "${h.cfg.hostAutoClass}" was on during the capture: ${label}`);
  if (product && probe.demoOff === false) throw new Error(`demo scaffolding was on during the capture: ${label}`);
  if (h.touch && (probe.hover || !probe.coarse)) throw new Error(`touch emulation lost: ${label}`);
}

/**
 * Re-asserts the emulation and checks the probe.
 * @param {object} h handle
 * @param {string} label for the error
 * @param {{product?: boolean}} [opts] see assertProbe
 * @returns {Promise<object>} the probe
 */
export async function reassert(h, label, opts) {
  await emulate(h);
  const probe = await mediaProbe(h);
  assertProbe(probe, h, label, opts);
  return probe;
}

/**
 * Captures the page. Full height grows the viewport to the document height first; viewport-only shoots as is.
 * @param {object} h handle
 * @param {string} file output path
 * @param {{type?: 'png'|'jpeg', quality?: number, viewportOnly?: boolean}} [opts]
 * @returns {Promise<object>} the probe taken right after the shot (while the viewport is still grown)
 */
export async function fullShot(h, file, { type = 'png', quality, viewportOnly = false } = {}) {
  const { page, cfg, width } = h;
  if (!viewportOnly) {
    let height = 0;
    for (let i = 0; i < 4; i++) {
      const nh = await page.evaluate(() => Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)));
      if (nh === height) break;
      height = nh;
      await page.setViewportSize({ width, height: Math.min(height, cfg.maxCaptureHeight) });
      await page.waitForTimeout(250);
    }
  }
  // Playwright's disabled mode finishes finite animations and cancels infinite ones for the shot: the frame every
  // reference so far was taken with (measurements pause infinite ones at t=0 instead, see freezeAnimations)
  const opts = { path: file, type, animations: 'disabled', caret: 'hide' };
  if (type === 'jpeg') opts.quality = quality ?? 85;
  await page.screenshot(opts);
  const probe = await mediaProbe(h);
  assertProbe(probe, h, file);
  if (!viewportOnly) await page.setViewportSize({ width, height: cfg.baseHeight });
  await reassert(h, `after ${file}`);
  return probe;
}

/**
 * Runs a state's actions in order (click, domClick, fill, wait, waitFor, scroll, removeAttr, setAttr, js), then waits
 * `settleMs` (default 450) when any ran. Marks the page dirty.
 * @param {object} h handle
 * @param {{actions?: object[], settleMs?: number}} state
 */
export async function applyActions(h, state) {
  const { page } = h;
  const actions = state.actions || [];
  if (!actions.length) return;
  h.dirty = true;
  for (const a of actions) {
    if (a.js !== undefined) await page.evaluate(new Function(a.js));
    else if (a.domClick) await page.evaluate((s) => { const e = document.querySelector(s); if (!e) throw new Error(`domClick: no element ${s}`); e.click(); }, a.domClick);
    else if (a.click) { const l = page.locator(a.click).first(); await l.scrollIntoViewIfNeeded(); await l.click(); }
    else if (a.fill) await page.locator(a.fill[0]).first().fill(a.fill[1]);
    else if (a.wait !== undefined) await page.waitForTimeout(a.wait);
    else if (a.waitFor) await page.locator(a.waitFor).first().waitFor({ state: 'visible', timeout: 15000 });
    else if (a.scroll !== undefined) await page.evaluate((y) => { if (typeof y === 'number') window.scrollTo(0, y); else document.querySelector(y)?.scrollIntoView({ block: 'start' }); }, a.scroll);
    else if (a.removeAttr) await page.evaluate(([s, n]) => document.querySelectorAll(s).forEach((e) => e.removeAttribute(n)), a.removeAttr);
    else if (a.setAttr) await page.evaluate(([s, n, v]) => document.querySelectorAll(s).forEach((e) => e.setAttribute(n, v)), a.setAttr);
  }
  await page.waitForTimeout(state.settleMs ?? 450);
}

/**
 * Retries a job once after a timeout or a crashed target; any other error propagates.
 * @param {() => Promise<T>} fn the job
 * @param {string} label for the log
 * @returns {Promise<T>}
 * @template T
 */
export async function retry(fn, label) {
  try { return await fn(); } catch (e) {
    if (!/Timeout|Target (page, context or browser )?closed|has been closed|crash/i.test(String(e && (e.name + e.message)))) throw e;
    console.error(`retry after ${String(e.message).split('\n')[0]}: ${label}`);
    return fn();
  }
}

/** @param {string} s @returns {string} a filename-safe slug */
export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** @param {string} from @param {string} to @returns {string} a POSIX relative path */
export const relPosix = (from, to) => path.relative(from, to).split(path.sep).join('/');
