#!/usr/bin/env node
/**
 * Render identity of the portable CSS (the linked-check): a copy of the prototype whose main <style> is replaced by
 * <link>s to reference/css/*.css, in the load order of reference/css/README.md (checked against the folder), is
 * captured full height next to the prototype for each configured screen x width, and every pair must be
 * pixel-identical. A screen passes when any of `attempts` fresh capture pairs is identical: Chromium's downscaling of
 * heavily resized images is not always deterministic, while a real CSS difference differs in every attempt. So after a
 * first differing pair the computed styles of both pages are compared: a difference there is deterministic (the split
 * broke the cascade), so the stage fails at once, without the retries, and skips the units not started yet.
 * The copy lives beside the prototype (relative assets resolve the same) and is removed afterwards (--keep keeps it).
 * Usage: node identity.mjs [--keep]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { listScreens, loadConfig } from './config.mjs';
import { fullShot, launch, navigate, settle, urlFor } from './lib.mjs';
import { openDecoder } from './pixels.mjs';
import { makeStage, runPool } from './pool.mjs';
import { mainStyle } from './split-css.mjs';

const CASCADE_PROPS = ['display', 'position', 'top', 'left', 'z-index', 'float', 'box-sizing', 'width', 'height', 'min-height', 'max-width', 'margin', 'padding', 'border-width', 'border-style', 'border-color', 'border-radius', 'color', 'background-color', 'background-image', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'text-decoration-line', 'white-space', 'opacity', 'visibility', 'transform', 'box-shadow', 'outline-style', 'overflow-x', 'overflow-y', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap', 'grid-template-columns', 'order', 'fill', 'stroke'];

/** Runs in the page: one line per body element (document order) with its computed cascade properties, animations settled. */
function styleFingerprint(props) {
  for (const a of document.getAnimations()) { try { if (a.effect?.getTiming().iterations === Infinity) a.cancel(); else a.finish(); } catch { /* an animation that cannot finish keeps its value; both pages behave alike */ } }
  const label = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${[...el.classList].slice(0, 2).map((c) => `.${c}`).join('')}`;
  return [...document.body.querySelectorAll('*')].map((el) => { const cs = getComputedStyle(el); return [label(el), props.map((p) => cs.getPropertyValue(p))]; });
}

/** The first elements whose computed styles differ between the two fingerprints. */
function styleDiff(a, b, props, max = 5) {
  if (a.length !== b.length) return [`element count ${a.length} vs ${b.length}`];
  const out = [];
  for (let i = 0; i < a.length && out.length < max; i++) {
    const j = props.findIndex((_, k) => a[i][1][k] !== b[i][1][k]);
    if (j >= 0) out.push(`${a[i][0]} ${props[j]}: ${a[i][1][j]} (prototype) vs ${b[i][1][j]} (linked)`);
  }
  return out;
}

/**
 * The load order: the README's <link> list, which must name exactly the .css files on disk.
 * @param {string} cssDir reference/css
 * @returns {string[]} file names in order
 */
export function loadOrder(cssDir) {
  const readme = fs.readFileSync(path.join(cssDir, 'README.md'), 'utf8');
  const order = [...readme.matchAll(/<link rel="stylesheet" href="css\/([^"]+\.css)">/g)].map((m) => m[1]);
  if (!order.length) throw new Error(`no <link> load order in ${cssDir}/README.md`);
  const onDisk = fs.readdirSync(cssDir).filter((f) => f.endsWith('.css')).sort();
  const listed = [...order].sort();
  if (JSON.stringify(onDisk) !== JSON.stringify(listed)) throw new Error(`README load order and folder disagree: only on disk [${onDisk.filter((f) => !listed.includes(f))}], only in the README [${listed.filter((f) => !onDisk.includes(f))}]`);
  return order;
}

/**
 * Writes the linked copy beside the prototype.
 * @param {object} cfg normalised config
 * @returns {string} its path
 */
export function buildLinkedCopy(cfg) {
  const html = fs.readFileSync(cfg.paths.prototype, 'utf8');
  const st = mainStyle(html);
  const rel = path.relative(cfg.paths.protoDir, cfg.paths.css).split(path.sep).join('/');
  const links = loadOrder(cfg.paths.css).map((f) => `<link rel="stylesheet" href="${rel}/${f}">`).join('\n');
  const out = path.join(cfg.paths.protoDir, '.linked-check.html');
  fs.writeFileSync(out, html.slice(0, st.open) + links + html.slice(st.end + '</style>'.length));
  return out;
}

/**
 * The identity stage.
 * @param {{cfg: object, browser?: object, keep?: boolean}} ctx
 * @returns {Promise<object>} summary {units, identical, total, results}
 * @throws {Error} when any screen differs in every attempt
 */
export async function run({ cfg, browser, keep = false }) {
  const all = listScreens(cfg);
  const wanted = cfg.identity.screens || all.map((s) => s.id);
  const screens = wanted.map((id) => all.find((s) => s.id === id) || { id, route: `#${id}` });
  const theme = cfg.identity.theme;
  const linked = buildLinkedCopy(cfg);
  const stage = makeStage('identity');
  const own = !browser;
  const b = browser || (await launch());
  try {
    const dec = await openDecoder(b);
    const units = [];
    for (const s of screens) for (const w of cfg.identity.widths) units.push({ key: { width: w, theme }, screen: s, label: `${s.id} ${w} ${theme}` });
    try {
      const shoot = async (h, file, s, tag) => {
        await navigate(h, urlFor(cfg, s.route, { theme, file }));
        await h.page.waitForTimeout(400);
        await settle(h);
        const out = path.join(stage, `${s.id}-${h.width}-${tag}.png`);
        await fullShot(h, out);
        return fs.readFileSync(out);
      };
      const fingerprint = async (h, file, s) => {
        await navigate(h, urlFor(cfg, s.route, { theme, file }));
        await settle(h);
        h.dirty = true;
        return h.page.evaluate(styleFingerprint, CASCADE_PROPS);
      };
      let cascade = null;
      const results = await runPool({
        browser: b, cfg, units, label: 'identity',
        run: async (u, h) => {
          if (cascade) return { screen: u.screen.id, width: u.key.width, theme, identical: false, skipped: true, attempts: 0 };
          let res;
          let attempt = 0;
          let styles = [];
          do {
            attempt++;
            const orig = await shoot(h, cfg.paths.prototype, u.screen, 'orig');
            const copy = await shoot(h, linked, u.screen, 'linked');
            res = await dec.exact(orig, copy);
            if (!res.identical && attempt === 1) styles = styleDiff(await fingerprint(h, cfg.paths.prototype, u.screen), await fingerprint(h, linked, u.screen), CASCADE_PROPS);
          } while (!res.identical && !styles.length && attempt < cfg.identity.attempts);
          if (styles.length) cascade ??= { screen: u.screen.id, width: u.key.width, styles };
          return { screen: u.screen.id, width: u.key.width, theme, identical: res.identical, attempts: attempt, pixels: res.pixels, bbox: res.bbox, sizeMismatch: res.sizeMismatch, styles };
        },
      });
      const identical = results.filter((r) => r.identical).length;
      for (const r of results.filter((x) => !x.skipped)) console.log(`${r.identical ? 'IDENTICAL' : 'DIFFERENT'} ${r.screen} ${r.width} ${r.theme}${r.identical ? (r.attempts > 1 ? ` (attempt ${r.attempts})` : '') : `: ${r.sizeMismatch ? `size ${JSON.stringify(r.sizeMismatch)}` : `${r.pixels} px differ, bbox ${JSON.stringify(r.bbox)}`} (${r.styles.length ? 'computed styles differ, not retried' : `all ${r.attempts} attempts`})`}`);
      const summary = { units: units.length, identical, total: results.length, differing: results.filter((r) => !r.identical && !r.skipped), skipped: results.filter((r) => r.skipped).length, cascade };
      if (cascade) throw Object.assign(new Error(`identity: the linked CSS changes the cascade, computed styles differ on ${cascade.screen} at ${cascade.width} (failed fast, ${summary.skipped} unit(s) skipped):\n  ${cascade.styles.join('\n  ')}\nThe split filed rules into a load order that breaks the cascade${cfg.css.families.length ? '' : ' (no css.families: every rule was filed by the heuristic)'}: declare css.families in load order and claim the rules with css.rules/css.overrides. See the fidelity README (scripts/fidelity/README.md), Troubleshooting, "identity: the linked CSS changes the cascade".`), { summary });
      if (identical !== results.length) throw Object.assign(new Error(`identity: ${results.length - identical} of ${results.length} captures differ between the prototype and its linked copy`), { summary });
      return summary;
    } finally {
      await dec.close();
    }
  } finally {
    if (own) await b.close();
    fs.rmSync(stage, { recursive: true, force: true });
    if (!keep) fs.rmSync(linked, { force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  run({ cfg: loadConfig(), keep: process.argv.includes('--keep') }).then((s) => console.log(`OK: ${s.identical}/${s.total} captures identical`), (e) => { console.error(e.message); process.exit(1); });
}
