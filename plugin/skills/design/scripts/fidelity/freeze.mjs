#!/usr/bin/env node
/**
 * The design-freeze orchestrator: runs the fidelity stages split (CSS split + token extraction) | measure | shard |
 * screens | catalog | identity (or all, in that order) on one shared browser, resumably. docs/design/freeze/state.json
 * records per stage its status, input hash, output hash and duration; a stage whose inputs are unchanged since its
 * last success (and whose outputs exist) is skipped. A failed stage skips its dependents and the run exits 1; the others still run.
 * Usage: node freeze.mjs <stage|all> [--only <frd filter>] [--all-states] [--all] [--force] [--workers N] [--config file]
 *   --only        shard only the FRDs whose name contains the filter
 *   --all-states  the full matrix (every state x width x theme, every property) instead of the pareto scope cap
 *   --all         ignore the measure and shard caches (re-measure / re-shard everything)
 *   --force       run the stages even when up to date
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as catalog from './catalog.mjs';
import { ConfigError, hashOf, listScreens, loadConfig, prototypeHash, toolHash } from './config.mjs';
import * as identity from './identity.mjs';
import { BrowserUnavailable, launch } from './lib.mjs';
import * as measure from './measure.mjs';
import { writeIfChanged } from './pool.mjs';
import * as screens from './screens.mjs';
import * as shard from './shard.mjs';
import * as split from './split-css.mjs';

export const STAGES = ['split', 'measure', 'shard', 'screens', 'catalog', 'identity'];
const DEPENDS = { split: [], measure: [], shard: ['split'], screens: [], catalog: ['split', 'measure'], identity: ['split'] };
const BROWSER = new Set(['measure', 'shard', 'screens', 'catalog', 'identity']);

const fileHash = (f) => (fs.existsSync(f) ? hashOf(fs.readFileSync(f)) : null);
const dirHash = (d, re = /./) => (fs.existsSync(d) ? hashOf(fs.readdirSync(d).filter((f) => re.test(f)).sort().map((f) => [f, fileHash(path.join(d, f))])) : null);

/** Inputs, outputs and existence check of each stage. */
function stageSpec(cfg, name, protoHash, tools) {
  // downstream stages depend on the CSS only: a hand edit of the curated token keys (fonts) must not recapture
  const splitOut = () => dirHash(cfg.paths.css, /\.css$/);
  const measureOut = () => hashOf(fileHash(cfg.paths.computedStyles), fileHash(path.join(cfg.paths.freeze, 'measure-cache.json')));
  const common = [protoHash, tools, cfg.widths, cfg.themes, cfg.touchBelow, cfg.params, cfg.hostAutoClass, cfg.baseHeight, cfg.settle];
  switch (name) {
    case 'split': return { input: () => hashOf(protoHash, tools, cfg.css, cfg.tokens, cfg.themes, cfg.themeAttribute), output: () => hashOf(splitOut(), fileHash(cfg.paths.tokens)), exists: () => fs.existsSync(path.join(cfg.paths.css, 'README.md')) && fs.existsSync(cfg.paths.tokens) };
    case 'measure': return { input: () => hashOf(...common, cfg.components, cfg.floating, cfg.scope), output: measureOut, exists: () => fs.existsSync(cfg.paths.computedStyles) };
    case 'shard': return { input: () => hashOf(...common, splitOut(), cfg.states, cfg.shard, cfg.sprite, cfg.screenSelector, cfg.lang), output: () => hashOf(Object.keys(cfg.states)), exists: () => Object.keys(cfg.states).every((f) => fs.existsSync(path.join(cfg.paths.frds, f, 'mocks'))) };
    case 'screens': return { input: () => hashOf(...common, listScreens(cfg), cfg.screenshots), output: () => dirHash(cfg.paths.screenshots, /\.jpg$/), exists: () => fs.existsSync(cfg.paths.screenshots) };
    case 'catalog': return { input: () => hashOf(tools, measureOut(), splitOut(), cfg.catalog, cfg.exports, cfg.sprite, cfg.shard.htmlAttributes), output: () => fileHash(cfg.paths.catalog), exists: () => fs.existsSync(cfg.paths.catalog) };
    case 'identity': return { input: () => hashOf(...common, splitOut(), cfg.identity, cfg.screens), output: () => null, exists: () => true };
    default: throw new Error(`unknown stage ${name}`);
  }
}

const fmt = (ms) => (ms == null ? '-' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

/**
 * Runs stages.
 * @param {{cfg: object, stages: string[], only?: string, all?: boolean, force?: boolean, log?: (s: string) => void}} opts
 * @returns {Promise<{ok: boolean, results: object[], totalMs: number, bootMs: number|null}>}
 */
export async function freeze({ cfg, stages, only, all = false, force = false, log = console.log }) {
  const stateFile = path.join(cfg.paths.freeze, 'state.json');
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { version: 1, stages: {}, runs: [] };
  const protoHash = prototypeHash(cfg);
  const tools = toolHash();
  const t0 = Date.now();
  let browser = null;
  let bootMs = null;
  const getBrowser = async () => {
    if (!browser) { const b0 = Date.now(); browser = await launch(); bootMs = Date.now() - b0; }
    return browser;
  };
  const results = [];
  const failed = new Set();
  const save = () => writeIfChanged(stateFile, `${JSON.stringify(state, null, 1)}\n`);
  try {
    for (const name of stages) {
      const spec = stageSpec(cfg, name, protoHash, tools);
      const prev = state.stages[name];
      const blocked = DEPENDS[name].filter((d) => failed.has(d));
      if (blocked.length) { results.push({ stage: name, status: 'blocked', note: `needs ${blocked.join(', ')}` }); failed.add(name); continue; }
      const input = spec.input();
      const partial = name === 'shard' && only;
      if (!force && !all && !partial && prev?.status === 'ok' && prev.inputHash === input && spec.exists()) {
        results.push({ stage: name, status: 'up-to-date', ms: 0, last: prev.durationMs });
        continue;
      }
      const s0 = Date.now();
      const rec = { status: 'running', inputHash: input, startedAt: new Date(s0).toISOString() };
      state.stages[name] = rec;
      save();
      try {
        const ctx = { cfg, only, all, browser: BROWSER.has(name) ? await getBrowser() : undefined };
        const mod = { split, measure, shard, screens, catalog, identity }[name];
        const summary = await mod.run(ctx);
        Object.assign(rec, { status: partial ? 'partial' : 'ok', outputHash: spec.output(), durationMs: Date.now() - s0, finishedAt: new Date().toISOString(), summary });
        if (partial) rec.inputHash = prev?.inputHash ?? null;
        results.push({ stage: name, status: 'ran', ms: rec.durationMs, summary });
      } catch (e) {
        if (e instanceof BrowserUnavailable) throw e;
        Object.assign(rec, { status: 'failed', durationMs: Date.now() - s0, finishedAt: new Date().toISOString(), error: String(e.message).slice(0, 4000) });
        results.push({ stage: name, status: 'failed', ms: rec.durationMs, error: e.message });
        failed.add(name);
      }
      save();
    }
  } finally {
    if (browser) await browser.close();
  }
  const totalMs = Date.now() - t0;
  state.runs = [...(state.runs || []), { at: new Date(t0).toISOString(), workers: cfg.workers, scope: cfg.scope.mode, bootMs, totalMs, stages: Object.fromEntries(results.map((r) => [r.stage, { status: r.status, ms: r.ms ?? null }])) }].slice(-20);
  save();
  log('');
  log(`stage      status       time     units  notes`);
  for (const r of results) {
    const s = r.summary || {};
    const note = r.error ? r.error.split('\n')[0].slice(0, 160) : r.note || (r.status === 'up-to-date' ? `last run ${fmt(r.last)}` : Object.entries(s).filter(([k]) => k !== 'units').map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ').slice(0, 160));
    log(`${r.stage.padEnd(10)} ${r.status.padEnd(12)} ${fmt(r.ms).padStart(7)}  ${String(s.units ?? '-').padStart(5)}  ${note}`);
  }
  log(`total ${fmt(totalMs)} (browser boot ${fmt(bootMs)}, P=${cfg.workers}, scope ${cfg.scope.mode})`);
  for (const r of results.filter((x) => x.error)) log(`\n${r.stage} failed:\n${r.error}`);
  return { ok: !failed.size, results, totalMs, bootMs };
}

async function main(argv) {
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const target = argv.find((a, i) => !a.startsWith('--') && !['--only', '--workers', '--config'].includes(argv[i - 1]));
  if (!target || (target !== 'all' && !STAGES.includes(target))) {
    console.error(`usage: freeze.mjs <${STAGES.join('|')}|all> [--only <frd>] [--all-states] [--all] [--force] [--workers N] [--config file]`);
    return 2;
  }
  if (opt('--workers')) process.env.FIDELITY_WORKERS = opt('--workers');
  let cfg;
  try { cfg = loadConfig({ file: opt('--config'), allStates: argv.includes('--all-states') }); } catch (e) {
    if (e instanceof ConfigError) { console.error(e.message); return 2; }
    throw e;
  }
  try {
    const res = await freeze({ cfg, stages: target === 'all' ? STAGES : [target], only: opt('--only'), all: argv.includes('--all'), force: argv.includes('--force') });
    return res.ok ? 0 : 1;
  } catch (e) {
    if (e instanceof BrowserUnavailable) { console.error(`freeze: ${e.message}`); return 3; }
    throw e;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(e.stack || e.message); process.exit(1); });
}
