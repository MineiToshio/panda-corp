#!/usr/bin/env node
/**
 * Reference comparator, reusable by the build's fidelity gate.
 * (a) Pixels: a candidate screenshot against its reference, per viewport-height slice: the pixelmatch 7 YIQ metric
 *     (threshold 0.1), anti-aliasing ignored, magenta reference pixels masked, at most 0.5% differing pixels per slice.
 * (b) Computed styles: a candidate computed-styles.json (same schema) against the reference: typography, colour and
 *     size exact; spacing (padding, margin, gap, insets, outline-offset) and radius within 1 px; anchor offsets within
 *     1 px. Only the properties the reference records are compared (a colour-only context compares colours only).
 * Usage:
 *   node diff.mjs pixels <reference.png|jpg> <candidate.png|jpg> [--slice 900] [--threshold 0.1] [--max-ratio 0.005] [--no-mask]
 *   node diff.mjs styles <reference computed-styles.json> <candidate computed-styles.json> [--component <name>]
 * Prints a JSON report; exit 0 = pass, 1 = differences, 2 = usage or input error.
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { launch } from './lib.mjs';
import { openDecoder } from './pixels.mjs';

const TYPO = new Set(['font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-transform', 'text-overflow', 'white-space']);
const COLOR = new Set(['color', 'background-color', 'background-image', 'border-top', 'border-right', 'border-bottom', 'border-left', 'box-shadow', 'outline', 'filter', 'opacity', 'mix-blend-mode']);
const SIZE = new Set(['width', 'height', 'min-height', 'size']);
const SPACING = new Set(['padding', 'margin', 'gap', 'top', 'right', 'bottom', 'left', 'outline-offset']);
const RADIUS = new Set(['border-radius']);
const IGNORED = new Set(['animated', 'animatedProps']);

/**
 * The tolerance rule of a property.
 * @param {string} prop CSS property (or "size")
 * @returns {{rule: string, tol: number}} tol in px for numeric tokens
 */
export function ruleFor(prop) {
  if (SPACING.has(prop)) return { rule: 'spacing', tol: 1 };
  if (RADIUS.has(prop)) return { rule: 'radius', tol: 1 };
  if (TYPO.has(prop)) return { rule: 'typography', tol: 0 };
  if (COLOR.has(prop)) return { rule: 'colour', tol: 0 };
  if (SIZE.has(prop)) return { rule: 'size', tol: 0 };
  return { rule: 'exact', tol: 0 };
}

const NUM = /^(-?\d*\.?\d+(?:e-?\d+)?)(px)?$/i;
const tokens = (v) => String(v).trim().split(/(\s+|,|\/|x(?=-?\d))/).filter((t) => t && !/^\s+$/.test(t));

/**
 * Compares two computed values token by token: numbers within `tol` (exact rules allow 0.01 of float noise), anything
 * else verbatim.
 * @param {string} a reference value
 * @param {string} b candidate value
 * @param {number} tol px tolerance for numeric tokens
 * @returns {boolean} equal within tolerance
 */
export function valuesMatch(a, b, tol) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length !== tb.length) return false;
  return ta.every((x, i) => {
    const y = tb[i];
    if (x === y) return true;
    const mx = x.match(NUM);
    const my = y.match(NUM);
    if (!mx || !my || (mx[2] || '') !== (my[2] || '')) return false;
    return Math.abs(Number(mx[1]) - Number(my[1])) <= Math.max(tol, 0.01) + 1e-9;
  });
}

function diffElement(ref, cand, where, out) {
  if (ref === null) { if (cand) out.push({ ...where, property: '(element)', ref: null, cand: 'present', rule: 'presence' }); return; }
  if (!cand) { out.push({ ...where, property: '(element)', ref: 'present', cand: null, rule: 'presence' }); return; }
  for (const [p, v] of Object.entries(ref)) {
    if (IGNORED.has(p)) continue;
    const { rule, tol } = ruleFor(p);
    if (!valuesMatch(v, cand[p], tol)) out.push({ ...where, property: p, ref: v, cand: cand[p] ?? null, rule });
  }
}

function diffAnchor(ref, cand, where, out) {
  if (!cand) { out.push({ ...where, property: 'anchor_offset', ref, cand: null, rule: 'anchor' }); return; }
  if (ref.absent || cand.absent) { if (!ref.absent !== !cand.absent) out.push({ ...where, property: 'anchor_offset.absent', ref: !!ref.absent, cand: !!cand.absent, rule: 'anchor' }); return; }
  for (const corner of ['top_left', 'top_right']) for (const d of ['dx', 'dy']) {
    if (Math.abs(ref[corner][d] - cand[corner]?.[d]) > 1 + 1e-9 || cand[corner]?.[d] === undefined) out.push({ ...where, property: `anchor_offset.${corner}.${d}`, ref: ref[corner][d], cand: cand[corner]?.[d] ?? null, rule: 'anchor' });
  }
  for (const k of ['panel_size', 'anchor_size']) if (!ref[k].every((x, i) => Math.abs(x - (cand[k]?.[i] ?? NaN)) <= 0.01 + 1e-9)) out.push({ ...where, property: `anchor_offset.${k}`, ref: ref[k], cand: cand[k] ?? null, rule: 'size' });
}

/**
 * Computed-style diff of two computed-styles.json documents.
 * @param {object} ref reference document
 * @param {object} cand candidate document
 * @param {{component?: string}} [opts] restrict to one component
 * @returns {{ok: boolean, compared: number, failures: object[]}} compared = element records compared
 */
export function diffStyles(ref, cand, { component } = {}) {
  const failures = [];
  let compared = 0;
  for (const [name, rc] of Object.entries(ref.components || {})) {
    if (component && name !== component) continue;
    const cc = cand.components?.[name];
    if (!cc) { failures.push({ component: name, property: '(component)', ref: 'present', cand: null, rule: 'presence' }); continue; }
    for (const [state, ctxs] of Object.entries(rc.states)) for (const [context, rec] of Object.entries(ctxs)) {
      const crec = cc.states?.[state]?.[context];
      const where = { component: name, state, context };
      if (!crec) { failures.push({ ...where, property: '(state)', ref: 'present', cand: null, rule: 'presence' }); continue; }
      diffElement(rec.root, crec.root, { ...where, element: 'root' }, failures);
      compared++;
      for (const [sel, ch] of Object.entries(rec.children || {})) { diffElement(ch, crec.children?.[sel], { ...where, element: sel }, failures); compared++; }
    }
    for (const [state, ctxs] of Object.entries(rc.anchor_offset || {})) for (const [context, a] of Object.entries(ctxs)) diffAnchor(a, cc.anchor_offset?.[state]?.[context], { component: name, state, context, element: 'panel' }, failures);
  }
  return { ok: failures.length === 0, compared, failures };
}

/**
 * Pixel diff of two image files.
 * @param {object} browser Playwright Browser (used to decode)
 * @param {Buffer} ref reference bytes
 * @param {Buffer} cand candidate bytes
 * @param {{sliceHeight?: number, threshold?: number, maxRatio?: number, mask?: number[]|null}} [opts]
 * @returns {Promise<object>} {ok, width, height, slices, failing}
 */
export async function diffPixels(browser, ref, cand, { sliceHeight = 900, threshold = 0.1, maxRatio = 0.005, mask } = {}) {
  const dec = await openDecoder(browser);
  try {
    const r = await dec.diff(ref, cand, { sliceHeight, threshold, maxRatio, mask });
    return { ...r, threshold, maxRatio, sliceHeight, failing: r.slices.filter((s) => !s.ok).map((s) => s.y) };
  } finally { await dec.close(); }
}

async function main(argv) {
  const [mode, a, b, ...rest] = argv;
  const opt = (n, d) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : d; };
  if (!['pixels', 'styles'].includes(mode) || !a || !b) {
    console.error('usage: diff.mjs pixels <ref> <cand> [--slice N] [--threshold T] [--max-ratio R] [--no-mask] | diff.mjs styles <ref.json> <cand.json> [--component name]');
    return 2;
  }
  for (const f of [a, b]) if (!fs.existsSync(f)) { console.error(`no such file: ${f}`); return 2; }
  let report;
  if (mode === 'styles') report = diffStyles(JSON.parse(fs.readFileSync(a, 'utf8')), JSON.parse(fs.readFileSync(b, 'utf8')), { component: opt('--component') });
  else {
    const browser = await launch();
    try {
      report = await diffPixels(browser, fs.readFileSync(a), fs.readFileSync(b), { sliceHeight: Number(opt('--slice', 900)), threshold: Number(opt('--threshold', 0.1)), maxRatio: Number(opt('--max-ratio', 0.005)), mask: rest.includes('--no-mask') ? null : undefined });
    } finally { await browser.close(); }
  }
  console.log(JSON.stringify(report, null, 1));
  return report.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(e.message); process.exit(2); });
}
