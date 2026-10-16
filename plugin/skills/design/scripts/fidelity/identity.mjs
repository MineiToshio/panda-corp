#!/usr/bin/env node
/**
 * Render identity of the portable CSS (the linked-check): a copy of the prototype whose main <style> is replaced by
 * <link>s to reference/css/*.css, in the load order of reference/css/README.md (checked against the folder), is
 * captured full height next to the prototype for each configured screen x width, and every pair must be
 * pixel-identical. A screen passes when any of `attempts` fresh capture pairs is identical: Chromium's downscaling of
 * heavily resized images is not always deterministic, while a real CSS difference differs in every attempt.
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
      const results = await runPool({
        browser: b, cfg, units, label: 'identity',
        run: async (u, h) => {
          let res;
          let attempt = 0;
          do {
            attempt++;
            const orig = await shoot(h, cfg.paths.prototype, u.screen, 'orig');
            const copy = await shoot(h, linked, u.screen, 'linked');
            res = await dec.exact(orig, copy);
          } while (!res.identical && attempt < cfg.identity.attempts);
          return { screen: u.screen.id, width: u.key.width, theme, identical: res.identical, attempts: attempt, pixels: res.pixels, bbox: res.bbox, sizeMismatch: res.sizeMismatch };
        },
      });
      const identical = results.filter((r) => r.identical).length;
      for (const r of results) console.log(`${r.identical ? 'IDENTICAL' : 'DIFFERENT'} ${r.screen} ${r.width} ${r.theme}${r.identical ? (r.attempts > 1 ? ` (attempt ${r.attempts})` : '') : `: ${r.sizeMismatch ? `size ${JSON.stringify(r.sizeMismatch)}` : `${r.pixels} px differ, bbox ${JSON.stringify(r.bbox)}`} (all ${r.attempts} attempts)`}`);
      const summary = { units: units.length, identical, total: results.length, differing: results.filter((r) => !r.identical) };
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
