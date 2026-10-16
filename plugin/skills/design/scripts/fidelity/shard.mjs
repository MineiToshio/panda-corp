#!/usr/bin/env node
/**
 * Shards the frozen prototype into one static mock per UI FRD, demo scaffolding off: docs/frds/<frd>/mocks/<slug>.html
 * holds only the visible screen and the open overlays of each state (icon sprite inlined, every id inside a section
 * prefixed `<stateId>--` with its references rewritten, the reference CSS linked, fonts from its self-hosted
 * @font-face rules), and mocks/screenshots/<id>-<width>-<theme>.jpg every capture.
 * Captures run in parallel across the worker pool; an identical state shared by several FRDs is captured once. A state
 * with capture "viewport" (an overlay or a popover that closes on scroll or resize) is settled before its actions and
 * shot without growing or scrolling the page. Incremental per FRD (docs/design/freeze/shard-cache.json); fail-closed:
 * nothing under docs/frds changes unless every capture of the run succeeded.
 * Usage: node shard.mjs [--only <frd filter>] [--all]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hashOf, loadConfig, prototypeHash } from './config.mjs';
import { applyActions, assertImagesLoaded, fullShot, launch, loadImages, navigate, reassert, relPosix, settle, urlFor } from './lib.mjs';
import { makeStage, publishDirs, runPool, writeIfChanged } from './pool.mjs';
import { readSplitReport } from './split-css.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CODE_HASH = hashOf(...['shard.mjs', 'lib.mjs'].map((f) => fs.readFileSync(path.join(HERE, f))));
const SHOT_RE = /\.(jpe?g|png)$/;

/** Page side: the visible screen plus the open overlays, product-only, ids prefixed, asset paths rebased. */
function snapshotFn({ sid, prefix, screenSel, extras, gate, strip }) {
  const scr = [...document.querySelectorAll(screenSel)].find((x) => !x.hidden);
  if (!scr) return { error: `no visible screen matches ${screenSel}` };
  const extraEls = extras.length ? [...document.querySelectorAll(extras.map((e) => e.selector).join(','))] : [];
  for (const d of extraEls) if (scr.contains(d)) d.replaceWith(document.createComment(' open dialog: shown below the screen '));
  const roots = [scr, ...extraEls];
  if (gate.length) {
    const gs = gate.map((a) => `[${a}]`).join(',');
    for (const r of roots) for (const el of [...r.querySelectorAll(gs), r]) {
      if (!el.matches(gs)) continue;
      if (getComputedStyle(el).display === 'none') el.remove(); else gate.forEach((a) => el.removeAttribute(a));
    }
  }
  if (strip) for (const r of roots) r.querySelectorAll(strip).forEach((el) => el.remove());
  const ids = new Set();
  for (const r of roots) for (const el of [r, ...r.querySelectorAll('[id]')]) if (el.id) ids.add(el.id);
  const map = (v) => (ids.has(v) ? `${sid}--${v}` : v);
  const REF = ['for', 'aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-owns', 'aria-activedescendant', 'aria-details', 'aria-errormessage', 'aria-flowto', 'list', 'form', 'headers', 'popovertarget', 'commandfor'];
  const local = (v) => v && !/^(https?:|data:|blob:|\/|#)/.test(v);
  for (const r of roots) for (const el of [r, ...r.querySelectorAll('*')]) {
    if (el.id) el.id = map(el.id);
    for (const a of REF) if (el.hasAttribute(a)) el.setAttribute(a, el.getAttribute(a).split(/\s+/).map(map).join(' '));
    for (const a of ['href', 'xlink:href']) { const v = el.getAttribute(a); if (v && v.startsWith('#') && ids.has(v.slice(1))) el.setAttribute(a, `#${map(v.slice(1))}`); }
    for (const at of [...el.attributes]) if (/url\(#/.test(at.value)) el.setAttribute(at.name, at.value.replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${map(id)})`));
    for (const a of ['src', 'poster']) { const v = el.getAttribute(a); if (local(v)) el.setAttribute(a, prefix + v); }
    if (el.hasAttribute('srcset')) el.setAttribute('srcset', el.getAttribute('srcset').split(',').map((s) => { const t = s.trim(); return /^(https?:|data:|\/)/.test(t) ? t : prefix + t; }).join(', '));
    if (el.tagName.toLowerCase() === 'image') { const v = el.getAttribute('href'); if (v && !/^(https?:|data:|\/|#)/.test(v)) el.setAttribute('href', prefix + v); }
    if (el.hasAttribute('style')) el.setAttribute('style', el.getAttribute('style').replace(/url\((["']?)(?!https?:|data:|\/|#)([^"')]+)\1\)/g, (m, q, u) => `url(${q}${prefix}${u}${q})`));
  }
  const wrap = scr.parentElement && scr.parentElement !== document.body ? scr.parentElement.tagName.toLowerCase() : null;
  const parts = [wrap ? `<${wrap}>${scr.outerHTML}</${wrap}>` : scr.outerHTML];
  for (const d of extraEls) {
    const spec = extras.find((e) => d.matches(e.selector)) || {};
    if (spec.style) d.setAttribute('style', spec.style);
    parts.push(`<div class="mock-overlay"><p class="mock-note">${spec.label || 'Overlay'}</p>${d.outerHTML}</div>`);
  }
  return { html: parts.join('\n'), ids: [...ids] };
}

const stateKey = (s) => JSON.stringify([s.route, s.actions || [], s.settleMs ?? null, s.capture || 'full']);

/**
 * Plans the captures: one unit per distinct (state, width, theme); snapshot requests ride on the primary-theme unit
 * at the state's widest width.
 * @param {object} cfg normalised config
 * @param {string[]} frds the FRDs to shard
 * @returns {object[]} units
 */
function planUnits(cfg, frds) {
  const units = new Map();
  for (const frd of frds) for (const s of cfg.states[frd]) {
    const widths = s.widths || cfg.widths;
    const snapW = Math.max(...widths);
    for (const theme of cfg.themes) for (const w of widths) {
      const k = `${stateKey(s)}|${w}|${theme}`;
      if (!units.has(k)) units.set(k, { key: { width: w, theme }, state: s, file: `u${units.size}-${w}-${theme}.jpg`, snaps: new Set(), label: `${frd} ${s.id} ${w} ${theme}` });
      if (w === snapW && theme === cfg.themes[0]) units.get(k).snaps.add(s.id);
    }
  }
  return [...units.values()];
}

async function load(h, cfg, s) {
  await navigate(h, urlFor(cfg, s.route, { theme: h.theme }));
  h.dirty = true;
  await h.page.waitForTimeout(400);
  if (s.capture === 'viewport') {
    await settle(h);
    await applyActions(h, s);
    await h.page.waitForTimeout(300);
    await loadImages(h.page, cfg.settle.imageTimeoutMs);
    await assertImagesLoaded(h.page);
  } else {
    await applyActions(h, s);
    await settle(h);
  }
}

/**
 * The shard stage.
 * @param {{cfg: object, browser?: object, only?: string, all?: boolean}} ctx only: FRD name filter
 * @returns {Promise<object>} summary
 */
export async function run({ cfg, browser, only, all = false }) {
  const split = readSplitReport(cfg);
  const html = fs.readFileSync(cfg.paths.prototype, 'utf8');
  const spriteMatch = cfg.sprite ? html.match(new RegExp(cfg.sprite)) : null;
  if (cfg.spriteRequired && !spriteMatch) throw new Error(`sprite: the configured pattern matches nothing in ${cfg.prototype}`);
  const sprite = spriteMatch ? spriteMatch[0] : '';
  const remote = [...html.matchAll(/<link[^>]+href="(https?:[^"]+)"/g)].map((m) => m[1]);
  let frds = Object.keys(cfg.states);
  if (only) { frds = frds.filter((f) => f.includes(only)); if (!frds.length) throw new Error(`no FRD matches --only "${only}"`); }
  for (const frd of frds) if (!fs.existsSync(path.join(cfg.paths.frds, frd))) throw new Error(`states.${frd}: no FRD folder ${path.join(cfg.paths.frds, frd)}`);
  const cacheFile = path.join(cfg.paths.freeze, 'shard-cache.json');
  const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
  const common = hashOf(prototypeHash(cfg), split.order, split.idRules, cfg.shard, cfg.widths, cfg.themes, cfg.params, cfg.sprite, cfg.lang, cfg.settle, CODE_HASH);
  const hashes = Object.fromEntries(frds.map((f) => [f, hashOf(common, f, cfg.states[f])]));
  const pageFile = (frd) => path.join(cfg.paths.frds, frd, 'mocks', `${frd.replace(/^frd-\d+-/, '')}.html`);
  const todo = frds.filter((f) => all || cache[f] !== hashes[f] || !fs.existsSync(pageFile(f)));
  if (!todo.length) return { units: 0, frds: 0, skipped: frds.length, remoteLinks: remote };
  const units = planUnits(cfg, todo);
  const stage = makeStage('shard');
  const prefix = `${relPosix(path.join(cfg.paths.frds, 'x', 'mocks'), cfg.paths.protoDir)}/`;
  const snapArgs = { prefix, screenSel: cfg.screenSelector, extras: cfg.shard.extras, gate: cfg.shard.gateAttributes, strip: cfg.shard.strip };
  const snaps = new Map();
  try {
    const own = !browser;
    const b = browser || (await launch());
    try {
      await runPool({
        browser: b, cfg, units, label: 'shard',
        run: async (u, h) => {
          await load(h, cfg, u.state);
          await fullShot(h, path.join(stage, u.file), { type: 'jpeg', quality: cfg.shard.jpegQuality, viewportOnly: u.state.capture === 'viewport' });
          let firstSnap = true;
          for (const sid of u.snaps) {
            if (!firstSnap) await load(h, cfg, { ...u.state });
            firstSnap = false;
            await reassert(h, `${u.label} snapshot`);
            const snap = await h.page.evaluate(snapshotFn, { ...snapArgs, sid });
            if (snap.error) throw new Error(`${u.label}: ${snap.error}`);
            snaps.set(`${stateKey(u.state)}|${sid}`, snap);
          }
        },
      });
    } finally {
      if (own) await b.close();
    }
    const byKey = new Map(units.map((u) => [`${stateKey(u.state)}|${u.key.width}|${u.key.theme}`, u]));
    const pending = [];
    for (const frd of todo) {
      const dir = path.join(stage, `frd-${frd}`);
      fs.mkdirSync(dir);
      const sections = [];
      const shim = new Set();
      for (const s of cfg.states[frd]) {
        const widths = s.widths || cfg.widths;
        for (const theme of cfg.themes) for (const w of widths) fs.copyFileSync(path.join(stage, byKey.get(`${stateKey(s)}|${w}|${theme}`).file), path.join(dir, `${s.id}-${w}-${theme}.jpg`));
        const snap = snaps.get(`${stateKey(s)}|${s.id}`);
        const attrs = cfg.shard.sectionAttributes.filter((a) => s.route.includes(a.routeMatch)).map((a) => ` ${a.attribute}="${a.value}"`).join('');
        sections.push(`<section class="mock-screen" id="${s.id}"${attrs}><h2 class="mock-title">${s.title} <code>${s.route}</code> <span class="mock-shots">screenshots/${s.id}-{${widths.join(',')}}-{${cfg.themes.join(',')}}.jpg</span></h2>\n${snap.html}\n</section>`);
        for (const r of split.idRules) for (const id of r.ids) if (snap.ids.includes(id)) {
          const pre = r.prelude.replaceAll(`#${id}`, `#${s.id}--${id}`);
          shim.add(r.wrap.reduceRight((acc, wr) => `${wr}{${acc}}`, `${pre}{${r.body}}`));
        }
      }
      pending.push({ frd, dir, doc: mockPage(cfg, frd, split.order, [...shim], sprite, sections) });
    }
    for (const p of pending) {
      publishDirs([{ from: p.dir, to: path.join(cfg.paths.frds, p.frd, 'mocks', 'screenshots'), stale: SHOT_RE }]);
      writeIfChanged(pageFile(p.frd), p.doc);
      cache[p.frd] = hashes[p.frd];
    }
    writeIfChanged(cacheFile, `${JSON.stringify(cache, null, 1)}\n`);
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
  return { units: units.length, frds: todo.length, skipped: frds.length - todo.length, states: todo.reduce((n, f) => n + cfg.states[f].length, 0), remoteLinks: remote };
}

function mockPage(cfg, frd, order, shim, sprite, sections) {
  const dir = path.join(cfg.paths.frds, frd, 'mocks');
  const cssRel = relPosix(dir, cfg.paths.css);
  const links = order.map((f) => `<link rel="stylesheet" href="${cssRel}/${f}.css">`).join('\n');
  const attrs = Object.entries(cfg.shard.htmlAttributes).map(([k, v]) => ` ${k}="${v}"`).join('');
  const [t0, t1 = t0] = cfg.themes;
  const ta = cfg.themeAttribute;
  return `<!doctype html>
<html lang="${cfg.lang}"${attrs}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${frd} mocks</title>
<!-- the portable prototype CSS (${relPosix(cfg.root, cfg.paths.css)}/, in its README load order; fonts come from its self-hosted @font-face rules) -->
${links}
<!-- id shim: every id here is prefixed with its section id, so the prototype's id-selector rules are repeated for the prefixed ids -->
<style>${shim.join('\n')}</style>
<style>.mock-screen{border-top:4px solid currentColor;margin:0 0 64px}.mock-title{font:600 18px/1.3 system-ui,sans-serif;padding:16px;opacity:.85}.mock-title code,.mock-shots{font:500 12px/1.3 ui-monospace,monospace;opacity:.7;margin-left:8px}.mock-overlay{padding:0 16px 24px}.mock-note{font:500 12px/1.3 ui-monospace,monospace;opacity:.7}.mock-bar{position:sticky;top:0;z-index:200;display:flex;gap:12px;align-items:center;padding:8px 16px;background:var(--surface,Canvas);border-bottom:1px solid var(--border,GrayText);font:500 13px/1.3 system-ui,sans-serif}</style>
<script>(function(){var t=new URLSearchParams(location.search).get('theme');if(t)document.documentElement.setAttribute('${ta}',t);})();</script>
</head>
<body>
${sprite}
<div class="mock-bar"><button type="button" onclick="var r=document.documentElement;r.setAttribute('${ta}',r.getAttribute('${ta}')==='${t1}'?'${t0}':'${t1}')">Toggle theme</button><span>${frd}: product-only static slices of ${cfg.prototype} (demo off). The interactive prototype stays the reference for behaviour and motion; screenshots/ holds every state at ${cfg.widths.join(' / ')} x ${cfg.themes.join(' / ')}.</span></div>
${sections.join('\n')}
</body>
</html>
`;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--only');
  console.log(JSON.stringify(await run({ cfg: loadConfig(), only: i >= 0 ? args[i + 1] : undefined, all: args.includes('--all') })));
}
