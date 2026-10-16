#!/usr/bin/env node
/**
 * Whole-app screenshots: every product screen x width x theme, full height, demo off, host-auto off and the touch branch
 * at phone widths (asserted per capture), JPEG, into <prototype dir>/screenshots/<prefix>--<screen>--<width>--<theme>.jpg.
 * Fail-closed: captures are staged; the folder changes (stale <prefix>--*.jpg removed, new ones copied) only when every
 * capture succeeded. No other file in the folder is ever touched.
 * Usage: node screens.mjs [--screens a,b] [--widths 375,768]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { listScreens, loadConfig } from './config.mjs';
import { fullShot, launch, navigate, settle, urlFor } from './lib.mjs';
import { makeStage, publishDirs, runPool } from './pool.mjs';

/**
 * The screens stage.
 * @param {{cfg: object, browser?: object, screens?: string[], widths?: number[]}} ctx a filter keeps the other files
 * @returns {Promise<object>} summary {units, screens}
 */
export async function run({ cfg, browser, screens: onlyScreens, widths: onlyWidths }) {
  const screens = listScreens(cfg).filter((s) => !onlyScreens || onlyScreens.includes(s.id));
  if (!screens.length) throw new Error('screens: no screen to capture (configure `screens`, or mark screens with the screen attribute)');
  const prefix = cfg.screenshots.prefix;
  const esc = prefix.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&');
  const re = new RegExp(`^${esc}--[a-z0-9_-]+--\\d+--[a-z0-9_-]+\\.jpg$`, 'i');
  const units = [];
  for (const theme of cfg.themes) for (const s of screens) for (const w of s.widths) {
    if (onlyWidths && !onlyWidths.includes(w)) continue;
    units.push({ key: { width: w, theme }, screen: s, file: `${prefix}--${s.id}--${w}--${theme}.jpg`, label: `${s.id} ${w} ${theme}` });
  }
  const stage = makeStage('screens');
  try {
    const own = !browser;
    const b = browser || (await launch());
    try {
      await runPool({
        browser: b, cfg, units, label: 'screens',
        run: async (u, h) => {
          await navigate(h, urlFor(cfg, u.screen.route, { theme: u.key.theme }));
          await h.page.waitForTimeout(400);
          await settle(h);
          await fullShot(h, path.join(stage, u.file), { type: 'jpeg', quality: cfg.screenshots.jpegQuality });
        },
      });
    } finally {
      if (own) await b.close();
    }
    const full = !onlyScreens && !onlyWidths;
    const written = publishDirs([{ from: stage, to: cfg.paths.screenshots, stale: full ? re : null }]);
    return { units: units.length, screens: screens.length, written };
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const cfg = loadConfig();
  console.log(JSON.stringify(await run({ cfg, screens: opt('--screens')?.split(','), widths: opt('--widths')?.split(',').map(Number) })));
}
