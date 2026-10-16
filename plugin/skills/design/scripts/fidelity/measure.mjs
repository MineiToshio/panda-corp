#!/usr/bin/env node
/**
 * Measures every configured component x state x context into reference/computed-styles.json: computed styles of the
 * root and its key children (44 properties + size), anchor offsets of the floating panels, 1280-light DOM snapshots
 * for the catalogue and component images (reference/components/). Contexts follow the scope cap (config.schema.json
 * scope.mode). Incremental: each component's inputs (its config, its floating specs, the scope, the prototype and the
 * measuring code) are hashed into docs/design/freeze/measure-cache.json and only changed components are re-measured;
 * `--all` re-measures everything. Fail-closed: a component with a missing root or a failing state keeps its previous
 * cache entry, computed-styles.json is written only when every component measured cleanly, and the stage then fails.
 * Usage: node measure.mjs [--all] [--all-states]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hashOf, loadConfig, prototypeHash } from './config.mjs';
import { assertProbe, launch, mediaProbe, navigate, reassert, settle, slug, urlFor } from './lib.mjs';
import { COLOR_PROPS, PROPS, pageAnchor, pageCropBox, pageMeasure, pageResolve, pageSnapshot, pageTag, pageToggle, pageUndo } from './measure-page.mjs';
import { makeStage, runPool, writeIfChanged } from './pool.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CODE_HASH = hashOf(...['measure.mjs', 'measure-page.mjs', 'lib.mjs'].map((f) => fs.readFileSync(path.join(HERE, f))));
const CROP_RE = /^[a-z0-9-]+--[a-z0-9-]+--\d+-[a-z0-9-]+\.png$/;
const FORCE_ONLY = new Set(['force', 'wait', 'widths', 'layout']);

const isLayoutState = (st) => st.layout ?? !(st.force?.length && Object.keys(st).every((k) => FORCE_ONLY.has(k)));
const defaultState = (comp) => (comp.states.default ? 'default' : Object.keys(comp.states)[0]);
const ctxKey = (theme, w) => `${theme}-${w}`;

/**
 * The measurement jobs of one component under the configured scope.
 * pareto: every state at the primary width in the primary theme (all properties, image, snapshot); layout states also
 * at the touch width; each other theme with the colour properties only, every state at the primary width and the
 * default state at the touch width; images of the other themes for the default state only.
 * full: every state x width x theme, all properties, an image each.
 * @param {object} cfg normalised config
 * @param {object} comp component config
 * @returns {{sn: string, st: object, theme: string, w: number, props: 'all'|'color', crop: boolean, snapshot: boolean}[]}
 */
export function planComponent(cfg, comp) {
  const [primaryTheme, ...otherThemes] = cfg.themes;
  const { primaryWidth, touchWidth } = cfg.scope;
  const def = defaultState(comp);
  const jobs = [];
  for (const [sn, st] of Object.entries(comp.states)) {
    const allowed = cfg.widths.filter((w) => !st.widths || st.widths.includes(w));
    if (!allowed.length) continue;
    if (cfg.scope.mode === 'full') {
      const snapW = allowed.includes(primaryWidth) ? primaryWidth : allowed[allowed.length - 1];
      for (const theme of cfg.themes) for (const w of allowed) jobs.push({ sn, st, theme, w, props: 'all', crop: true, snapshot: theme === primaryTheme && w === snapW });
      continue;
    }
    const lw = allowed.includes(primaryWidth) ? primaryWidth : allowed[allowed.length - 1];
    const touch = allowed.includes(touchWidth) && touchWidth !== lw;
    jobs.push({ sn, st, theme: primaryTheme, w: lw, props: 'all', crop: true, snapshot: true });
    if (touch && isLayoutState(st)) jobs.push({ sn, st, theme: primaryTheme, w: touchWidth, props: 'all', crop: true, snapshot: false });
    for (const theme of otherThemes) {
      jobs.push({ sn, st, theme, w: lw, props: 'color', crop: sn === def, snapshot: false });
      if (touch && sn === def) jobs.push({ sn, st, theme, w: touchWidth, props: 'color', crop: true, snapshot: false });
    }
  }
  return jobs;
}

/** @returns {string} the incremental-cache hash of one component */
function componentHash(cfg, comp, protoHash) {
  const floating = cfg.floating.filter((f) => f.component === comp.name);
  return hashOf(comp, floating, cfg.scope, cfg.widths, cfg.themes, cfg.touchBelow, cfg.params, cfg.hostAutoClass, cfg.baseHeight, cfg.settle, protoHash, CODE_HASH);
}

/** Groups jobs into page loads: states sharing a route share one load; a click / route / scroll / js / pre state gets its own. */
function unitsFor(cfg, comps) {
  const units = new Map();
  for (const comp of comps) for (const j of planComponent(cfg, comp)) {
    const route = j.st.route || comp.route;
    const fresh = !!(j.st.click || j.st.route || j.st.scroll || j.st.js || j.st.spre || comp.pre);
    const key = `${ctxKey(j.theme, j.w)}|${fresh ? `fresh:${comp.name}:${j.sn}` : route}`;
    if (!units.has(key)) units.set(key, { key: { width: j.w, theme: j.theme }, route, label: `${comp.name} / ${j.sn} @ ${ctxKey(j.theme, j.w)}`, jobs: [] });
    units.get(key).jobs.push({ ...j, comp });
  }
  return [...units.values()];
}

async function applyState(h, comp, st) {
  const { page, cdp } = h;
  const specs = [...(st.force || []).map((f) => f[0]), ...(st.attr || []).map((a) => a[0]), ...(st.cls || []).map((c) => c[0])];
  const ok = await page.evaluate(pageTag, { specs });
  if (ok.some((x) => !x)) throw new Error(`state target missing: ${comp.name} ${JSON.stringify(specs)} ${JSON.stringify(ok)}`);
  const forced = [];
  const docId = (st.force || []).length ? (await cdp.send('DOM.getDocument', { depth: 0 })).root.nodeId : null;
  for (const [i, [, pcs]] of (st.force || []).entries()) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: docId, selector: `[data-ms-t${i}]` });
    if (nodeId) await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: pcs });
    forced.push(nodeId);
  }
  const undo = await page.evaluate(pageToggle, { attr: st.attr || [], cls: st.cls || [], base: (st.force || []).length });
  if (st.js) await page.evaluate(new Function(st.js));
  if (st.scroll) await page.evaluate((y) => window.scrollTo(0, y), st.scroll);
  await page.waitForTimeout(st.wait || 450);
  return { forced, undo };
}

async function revertState(h, applied) {
  for (const nid of applied.forced) if (nid) await h.cdp.send('CSS.forcePseudoState', { nodeId: nid, forcedPseudoClasses: [] });
  await h.page.evaluate(pageUndo, applied.undo);
  await h.page.evaluate(() => window.scrollTo(0, 0));
  await h.page.waitForTimeout(300);
}

/** Crops the root (and an open popover hanging from it); null, with a warning, when it has no on-screen box. */
async function crop(h, file, show, label) {
  const { page } = h;
  const swapBack = () => page.evaluate(() => { const k = document.querySelector('[data-ms-keep]'); if (k) { document.querySelector('[data-ms-root]').removeAttribute('data-ms-root'); k.setAttribute('data-ms-root', ''); k.removeAttribute('data-ms-keep'); } });
  if (show) await page.evaluate((s) => { const r = document.querySelector('[data-ms-root]'); const e = r.closest(s); if (e && e !== r) { r.setAttribute('data-ms-keep', ''); r.removeAttribute('data-ms-root'); e.setAttribute('data-ms-root', ''); } }, show);
  const vp = page.viewportSize();
  await page.evaluate(() => { const e = document.querySelector('[data-ms-root]'); const r = e.getBoundingClientRect(); if (r.width && (r.right <= 0 || r.left >= innerWidth)) e.scrollIntoView({ inline: 'center', block: 'nearest' }); });
  const box = await page.evaluate(() => { const e = document.querySelector('[data-ms-root]'); const r = e.getBoundingClientRect(); return { h: r.height, w: r.width, fixed: getComputedStyle(e).position === 'fixed' || e.matches('dialog[open]') }; });
  if (!box.w || !box.h) { await swapBack(); console.warn(`WARNING image skipped (no box, ${box.w}x${box.h}): ${label}`); return null; }
  if (!box.fixed && box.h + 280 > vp.height) { await page.setViewportSize({ width: vp.width, height: Math.min(Math.ceil(box.h + 300), 6000) }); await page.waitForTimeout(250); }
  if (!box.fixed) await page.evaluate(() => { const e = document.querySelector('[data-ms-root]'); const r = e.getBoundingClientRect(); window.scrollBy(0, r.top - (innerHeight - r.height) / 2 - 40); });
  await page.waitForTimeout(150);
  const r = await page.evaluate(pageCropBox);
  const v2 = page.viewportSize();
  const x = Math.max(0, Math.floor(r.x - 8));
  const y = Math.max(0, Math.floor(r.y - 8));
  const clip = { x, y, width: Math.min(v2.width - x, Math.ceil(r.w + 16)), height: Math.min(v2.height - y, Math.ceil(r.h + 16)) };
  const onScreen = r.x + r.w > 0 && r.y + r.h > 0 && r.x < v2.width && r.y < v2.height && clip.width > 0 && clip.height > 0;
  if (onScreen) await page.screenshot({ path: file, clip, animations: 'disabled', caret: 'hide' });
  else console.warn(`WARNING image skipped (off-screen): ${label}`);
  if (v2.height !== vp.height) await page.setViewportSize(vp);
  await reassert(h, `image ${label}`);
  await swapBack();
  return onScreen ? path.basename(file) : null;
}

const FATAL = /touch emulation|host-auto|demo scaffolding|Timeout|Target (page, context or browser )?closed|has been closed/i;

async function runJob(h, j, cfg, stageDir) {
  const { page } = h;
  const { comp: c, sn, st } = j;
  const label = `${c.name} / ${sn} / ${ctxKey(j.theme, j.w)}`;
  let applied = null;
  try {
    if (c.pre) { await page.evaluate(new Function(c.pre)); await page.waitForTimeout(400); }
    if (st.click && !st.click.startsWith('$ ')) {
      const l = page.locator(st.click).filter({ visible: true }).first();
      if (await l.count()) { await l.scrollIntoViewIfNeeded(); await l.click(); } else await page.evaluate((s) => document.querySelector(s).click(), st.click);
      await page.waitForTimeout(500);
    }
    if (st.spre) { await page.evaluate(new Function(st.spre)); await page.waitForTimeout(st.wait || 900); }
    if (!(await page.evaluate(pageResolve, { rootSel: st.root || c.root }))) return { j, missing: `root not found: ${st.root || c.root}` };
    if (st.click?.startsWith('$ ')) { await page.evaluate((s) => document.querySelector('[data-ms-root]').querySelector(s).click(), st.click.slice(2)); await page.waitForTimeout(500); }
    applied = await applyState(h, c, st);
    const res = { j };
    const spec = cfg.floating.find((f) => f.component === c.name && f.state === sn);
    if (spec) {
      res.anchor = await page.evaluate(pageAnchor, { panel: spec.panel, anchor: spec.anchor });
      if (res.anchor.error) throw new Error(`${label}: ${res.anchor.error}`);
    }
    const m = await page.evaluate(pageMeasure, { props: j.props === 'all' ? PROPS : COLOR_PROPS, children: c.children || null });
    res.probe = await mediaProbe(h);
    assertProbe(res.probe, h, label);
    res.measure = { root: m.root, children: m.children };
    res.childSelectors = m.childSelectors;
    if (j.snapshot) res.snapshot = { ...(await page.evaluate(pageSnapshot, { forcedMap: (st.force || []).map((f, i) => [i, f[1]]), show: c.show || null })), ctx: ctxKey(j.theme, j.w) };
    if (j.crop) res.crop = await crop(h, path.join(stageDir, `${slug(c.name)}--${slug(sn)}--${j.w}-${slug(j.theme)}.png`), c.show, label);
    await revertState(h, applied);
    return res;
  } catch (e) {
    if (FATAL.test(String(e.message))) throw e;
    if (applied) await revertState(h, applied).catch(() => {});
    await page.evaluate(() => { for (let n = 0; n < 12; n++) document.querySelectorAll(`[data-ms-t${n}]`).forEach((x) => x.removeAttribute(`data-ms-t${n}`)); }).catch(() => {});
    return { j, error: `${label}: ${String(e.message).split('\n')[0]}` };
  }
}

function sortedRecord(cfg, comp, rec) {
  const ctxOrder = cfg.themes.flatMap((t) => cfg.widths.map((w) => ctxKey(t, w)));
  const byCtx = (o) => Object.fromEntries(ctxOrder.filter((k) => o && k in o).map((k) => [k, o[k]]));
  const bySt = (o) => Object.fromEntries(Object.keys(comp.states).filter((s) => o[s]).map((s) => [s, byCtx(o[s])]));
  const out = { route: comp.route, selector: comp.root, children: rec.children, states: bySt(rec.states) };
  if (comp.note) out.note = comp.note;
  if (Object.keys(rec.anchor_offset).length) out.anchor_offset = bySt(rec.anchor_offset);
  return { ...out, snapshots: Object.fromEntries(Object.keys(comp.states).filter((s) => rec.snapshots[s]).map((s) => [s, rec.snapshots[s]])), crops: bySt(rec.crops) };
}

const SCHEMA_TEXT = 'components[name] = {route, selector (root), children (key descendant selectors; "doc:" = anywhere in the document), states[stateName][`${theme}-${width}`] = {root: {property: computed value, ..., size: "WxH" (bounding box, px)}, children: {selector: {...} | null when absent}}, anchor_offset?[stateName][context] = {panel_size, anchor_size, top_left: {dx, dy}, top_right: {dx, dy}} | {absent, reason}, note?}. Touch widths emulate a phone ((hover:none) and (pointer:coarse) match, verified per capture). Every capture uses the demo-off and host-mode params. States are forced with CDP CSS.forcePseudoState, attribute/class toggles, page code, scrolling or real clicks; values are read after the state wait (default 450 ms) with finite animations finished; a record with animated: "infinite" has a property driven by an endless animation, recorded paused at currentTime 0. Which contexts exist and which properties a context records: see scope.';

/**
 * The measure stage.
 * @param {{cfg: object, browser?: object, all?: boolean}} ctx all: ignore the cache
 * @returns {Promise<object>} summary {units, measured, skipped, components}
 */
export async function run({ cfg, browser, all = false }) {
  const cacheFile = path.join(cfg.paths.freeze, 'measure-cache.json');
  const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : { version: 1, components: {} };
  const protoHash = prototypeHash(cfg);
  const hashes = new Map(cfg.components.map((c) => [c.name, componentHash(cfg, c, protoHash)]));
  const todo = cfg.components.filter((c) => all || cache.components[c.name]?.hash !== hashes.get(c.name));
  const units = unitsFor(cfg, todo);
  const stageDir = makeStage('measure');
  const failures = [];
  try {
    if (units.length) {
      const own = !browser;
      const b = browser || (await launch());
      try {
        const results = await runPool({
          browser: b, cfg, units, label: 'measure',
          run: async (unit, h) => {
            if (!h.cssOn) { await h.cdp.send('DOM.enable'); await h.cdp.send('CSS.enable'); h.cssOn = true; }
            await navigate(h, urlFor(cfg, unit.route, { theme: unit.key.theme }));
            h.dirty = true;
            await h.page.waitForTimeout(400);
            await settle(h);
            const out = [];
            for (const j of unit.jobs) out.push(await runJob(h, j, cfg, stageDir));
            return out;
          },
        });
        const recs = new Map(todo.map((c) => [c.name, { children: c.children || [], states: {}, snapshots: {}, crops: {}, anchor_offset: {}, failed: [] }]));
        for (const r of results.flat()) {
          const rec = recs.get(r.j.comp.name);
          const ck = ctxKey(r.j.theme, r.j.w);
          if (r.error || r.missing) { rec.failed.push(r.error || `${r.j.comp.name} / ${r.j.sn} / ${ck}: ${r.missing}`); continue; }
          rec.children = r.childSelectors;
          (rec.states[r.j.sn] ||= {})[ck] = r.measure;
          if (r.snapshot) rec.snapshots[r.j.sn] = r.snapshot;
          if (r.crop) (rec.crops[r.j.sn] ||= {})[ck] = r.crop;
          if (r.anchor) (rec.anchor_offset[r.j.sn] ||= {})[ck] = r.anchor;
        }
        fs.mkdirSync(cfg.paths.crops, { recursive: true });
        for (const comp of todo) {
          const rec = recs.get(comp.name);
          if (rec.failed.length) { failures.push(...rec.failed); continue; }
          const prev = cache.components[comp.name]?.record;
          for (const f of Object.values(prev?.crops || {}).flatMap((o) => Object.values(o))) fs.rmSync(path.join(cfg.paths.crops, f), { force: true });
          const record = sortedRecord(cfg, comp, rec);
          for (const f of Object.values(record.crops).flatMap((o) => Object.values(o))) fs.copyFileSync(path.join(stageDir, f), path.join(cfg.paths.crops, f));
          cache.components[comp.name] = { hash: hashes.get(comp.name), record };
        }
      } finally {
        if (own) await b.close();
      }
    }
    for (const name of Object.keys(cache.components)) if (!hashes.has(name)) {
      for (const f of Object.values(cache.components[name].record.crops || {}).flatMap((o) => Object.values(o))) fs.rmSync(path.join(cfg.paths.crops, f), { force: true });
      delete cache.components[name];
    }
    writeIfChanged(cacheFile, JSON.stringify(cache));
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
  if (failures.length) throw new Error(`measure: ${failures.length} state(s) failed (the other components are cached; re-run to retry):\n  ${failures.slice(0, 30).join('\n  ')}`);
  writeComputedStyles(cfg, cache);
  if (all || todo.length === cfg.components.length) pruneCrops(cfg, cache);
  return { units: units.length, measured: todo.length, skipped: cfg.components.length - todo.length, components: cfg.components.length, records: units.reduce((n, u) => n + u.jobs.length, 0) };
}

function writeComputedStyles(cfg, cache) {
  const components = Object.fromEntries(cfg.components.map((c) => {
    const { snapshots, crops, ...rest } = cache.components[c.name].record;
    return [c.name, rest];
  }));
  const scope = { mode: cfg.scope.mode, primaryWidth: cfg.scope.primaryWidth, touchWidth: cfg.scope.touchWidth, primaryTheme: cfg.themes[0], colorOnlyThemes: cfg.scope.mode === 'pareto' ? cfg.themes.slice(1) : [] };
  const build = (generated) => JSON.stringify({ source: path.basename(cfg.paths.prototype), schema: SCHEMA_TEXT, properties: [...PROPS, 'size'], colorProperties: COLOR_PROPS, widths: cfg.widths, themes: cfg.themes, scope, generated, components });
  // the date moves only when the content does, so an unchanged re-run leaves the file byte-identical
  const prev = fs.existsSync(cfg.paths.computedStyles) ? JSON.parse(fs.readFileSync(cfg.paths.computedStyles, 'utf8')) : null;
  const kept = prev?.generated && build(prev.generated) === JSON.stringify(prev) ? prev.generated : new Date().toISOString().slice(0, 10);
  writeIfChanged(cfg.paths.computedStyles, build(kept));
}

function pruneCrops(cfg, cache) {
  if (!fs.existsSync(cfg.paths.crops)) return;
  const keep = new Set(Object.values(cache.components).flatMap((e) => Object.values(e.record.crops || {}).flatMap((o) => Object.values(o))));
  for (const f of fs.readdirSync(cfg.paths.crops)) if (CROP_RE.test(f) && !keep.has(f)) fs.rmSync(path.join(cfg.paths.crops, f));
}

/**
 * The cached records (with DOM snapshots and image names), as the catalogue reads them.
 * @param {object} cfg normalised config
 * @returns {Record<string, object>} name -> record, in config order
 * @throws {Error} when a component has not been measured
 */
export function readMeasured(cfg) {
  const file = path.join(cfg.paths.freeze, 'measure-cache.json');
  const cache = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { components: {} };
  const missing = cfg.components.filter((c) => !cache.components[c.name]).map((c) => c.name);
  if (missing.length) throw new Error(`not measured yet (run the measure stage): ${missing.join(', ')}`);
  return Object.fromEntries(cfg.components.map((c) => [c.name, cache.components[c.name].record]));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const cfg = loadConfig({ allStates: args.includes('--all-states') });
  console.log(JSON.stringify(await run({ cfg, all: args.includes('--all') })));
}
