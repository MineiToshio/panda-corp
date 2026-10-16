/**
 * Extracts the design tokens (CSS custom properties) of the prototype's <style> blocks into
 * docs/design/design-tokens.json, grouped per theme, and appends a dated entry to
 * docs/design/design-tokens-history.json whenever the extracted set changed. Run by the split stage, so the tokens
 * and the portable CSS always come from the same prototype bytes.
 *
 * Sources: `:root` / `html` is the first theme; `[<themeAttribute>="<theme>"]` (optionally prefixed by `:root` or
 * `html`) is that theme; `@media (prefers-color-scheme: <theme>)` around a root rule fills the tokens that theme's
 * attribute block does not set. Every other rule that declares custom properties (a breakpoint, a mode, a component
 * scope) is listed under `overrides.rules` with its selector and at-rule context.
 * Keys the extractor does not own (`fonts`, `direction`, `status`, `breakpoints`, ...) are kept as they are.
 */
import fs from 'node:fs';
import { normWs, units } from './cssparse.mjs';
import { relPosix } from './lib.mjs';
import { writeIfChanged } from './pool.mjs';

const DEFAULT_GROUPS = [
  ['typography', /^--(font|fs|fw|lh|track|tracking|leading|letter|type)(-|$)/],
  ['space', /^--(sp|space|spacing|gap|gutter|pad|inset)(-|$)/],
  ['radius', /^--(r|radius|rounded|round)(-|$)/],
  ['stroke', /^--(stroke|bw|border-w|focus|ring)(-|$)/],
  ['zIndex', /^--(z|zi|layer)(-|$)/],
  ['motion', /^--(dur|duration|ease|easing|motion|anim|transition|delay)(-|$)/],
  ['elevation', /^--(shadow|elev|elevation)(-|$)/],
  ['brand', /^--(brand|mark|logo)(-|$)/],
  ['color', /^--(c|color|clr|bg|fg|ink|surface|accent|line|border|text)(-|$)/],
];
const COLOR_VALUE = /^(#[0-9a-f]{3,8}|(rgba?|hsla?|hwb|oklch|oklab|lab|lch|color|color-mix|light-dark)\(|transparent$|currentcolor$)/i;
const CUSTOM_PROP = /(?:^|;)\s*(--[\w-]+)\s*:\s*([^;]*)/g;

/**
 * The custom properties a declaration block defines, in order.
 * @param {string} body declaration block without braces
 * @returns {[string, string][]} name, value pairs
 */
function customProps(body) {
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...clean.matchAll(CUSTOM_PROP)].map((m) => [m[1], m[2].trim()]);
}

/**
 * Which theme a selector list stands for, or null when it is not a theme root.
 * @param {string} prelude normalised selector list
 * @param {{themes: string[], themeAttribute: string}} cfg
 * @returns {string|null} theme name
 */
function themeOf(prelude, cfg) {
  const attr = cfg.themeAttribute.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&');
  const per = prelude.split(',').map((s) => s.trim()).map((s) => {
    if (/^(:root|html)$/.test(s)) return cfg.themes[0];
    const m = new RegExp(`^(?::root|html)?\\[${attr}=["']?([\\w-]+)["']?\\](?::root)?$`).exec(s);
    return m && cfg.themes.includes(m[1]) ? m[1] : null;
  });
  return per.every((t) => t && t === per[0]) ? per[0] : null;
}

const isRootish = (prelude) => prelude.split(',').every((s) => /^(:root|html)(:not\([^)]*\))*$/.test(s.trim()));

/**
 * Reads every custom property of the prototype's <style> blocks.
 * @param {string} html prototype source
 * @param {object} cfg normalised config
 * @returns {{themes: Record<string, Map<string, string>>, overrides: {selector: string, context: string, tokens: Record<string, string>}[]}}
 */
export function readTokens(html, cfg) {
  const themes = Object.fromEntries(cfg.themes.map((t) => [t, new Map()]));
  const fromMedia = Object.fromEntries(cfg.themes.map((t) => [t, new Map()]));
  const overrides = [];
  const walk = (us, context) => {
    for (const u of us) {
      if (u.children) { walk(u.children, [...context, normWs(u.prelude)]); continue; }
      if (u.kind !== 'rule') continue;
      const props = customProps(u.body);
      if (!props.length) continue;
      const prelude = normWs(u.prelude);
      const theme = context.length ? null : themeOf(prelude, cfg);
      const scheme = context.length === 1 && isRootish(prelude) ? /^@media\s*\(prefers-color-scheme:\s*([\w-]+)\)$/.exec(context[0])?.[1] : null;
      if (theme) for (const [k, v] of props) themes[theme].set(k, v);
      else if (scheme && cfg.themes.includes(scheme)) for (const [k, v] of props) fromMedia[scheme].set(k, v);
      else overrides.push({ selector: prelude, context: context.join(' '), tokens: Object.fromEntries(props) });
    }
  };
  for (const m of html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)) walk(units(m[1]), []);
  for (const t of cfg.themes) for (const [k, v] of fromMedia[t]) if (!themes[t].has(k)) themes[t].set(k, v);
  return { themes, overrides };
}

/**
 * The group of one token: the config's `tokens.groups` first, then the name prefixes above, then a colour value,
 * else the first segment of the name.
 * @param {string} name custom property name
 * @param {string} value its value
 * @param {{group: string, re: RegExp}[]} custom configured groups
 * @returns {string} group name
 */
function groupOf(name, value, custom) {
  for (const g of custom) if (g.re.test(name)) return g.group;
  for (const [group, re] of DEFAULT_GROUPS) if (re.test(name)) return group;
  if (COLOR_VALUE.test(value)) return 'color';
  return name.replace(/^--/, '').split('-')[0] || 'other';
}

const grouped = (map, custom) => {
  const out = {};
  for (const [k, v] of map) (out[groupOf(k, v, custom)] ??= {})[k] = v;
  return out;
};
const flat = (sets) => Object.fromEntries(Object.entries(sets || {}).map(([t, groups]) => [t, Object.assign({}, ...Object.values(groups || {}))]));

/**
 * Summary of what changed between two flattened token sets.
 * @param {Record<string, Record<string, string>>} before
 * @param {Record<string, Record<string, string>>} after
 * @returns {{added: number, removed: number, changed: number}}
 */
function changes(before, after) {
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const t of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[t] || {};
    const b = after[t] || {};
    for (const k of Object.keys(b)) if (!(k in a)) added++; else if (a[k] !== b[k]) changed++;
    for (const k of Object.keys(a)) if (!(k in b)) removed++;
  }
  return { added, removed, changed };
}

const readJson = (file) => {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`${file} is not valid JSON (${e.message}); fix or remove it before the split stage rewrites it`); }
};

/**
 * Writes design-tokens.json (extracted keys replaced, every other key kept) and, when the set changed, appends one
 * entry to design-tokens-history.json.
 * @param {object} cfg normalised config
 * @param {{today?: string}} [opts] today: the history date (default: the current UTC date)
 * @returns {{tokens: number, perTheme: Record<string, number>, overrides: number, changed: boolean, history: boolean}}
 * @throws {Error} on a malformed existing tokens or history file
 */
export function writeTokens(cfg, opts = {}) {
  const html = fs.readFileSync(cfg.paths.prototype, 'utf8');
  const { themes, overrides } = readTokens(html, cfg);
  const custom = (cfg.tokens.groups || []).map((g) => ({ group: g.group, re: new RegExp(g.match) }));
  const relProto = relPosix(cfg.root, cfg.paths.prototype);
  const prev = readJson(cfg.paths.tokens) || {};
  const sets = Object.fromEntries(cfg.themes.map((t) => [t, grouped(themes[t], custom)]));
  const next = { $schema: 'pandacorp design tokens (CSS custom properties, grouped)', ...prev };
  next.source = `${relProto} (:root, [${cfg.themeAttribute}] theme blocks, overrides; extracted by the fidelity split stage)`;
  for (const t of cfg.themes) next[t] = sets[t];
  next.overrides = { note: 'Token values redefined under a breakpoint, a mode or a component scope; everything else inherits the theme sets above.', rules: overrides };
  const before = flat(Object.fromEntries(cfg.themes.map((t) => [t, prev[t]])));
  const after = flat(sets);
  const prevOverrides = JSON.stringify(prev.overrides?.rules ?? null);
  const delta = changes(before, after);
  const hadTokens = Object.values(before).some((m) => Object.keys(m).length);
  const changed = !hadTokens || delta.added + delta.removed + delta.changed > 0 || prevOverrides !== JSON.stringify(overrides);
  writeIfChanged(cfg.paths.tokens, `${JSON.stringify(next, null, 2)}\n`);
  const perTheme = Object.fromEntries(cfg.themes.map((t) => [t, themes[t].size]));
  let history = false;
  if (changed) {
    const log = readJson(cfg.paths.tokensHistory) || { note: `History of design-token proposals. The current set is ${relPosix(cfg.root, cfg.paths.tokens)}, extracted from ${relProto}.`, proposals: [] };
    if (!Array.isArray(log.proposals)) throw new Error(`${cfg.paths.tokensHistory} has no "proposals" array; fix it before the split stage appends to it`);
    const counts = cfg.themes.map((t) => `${t} ${perTheme[t]}`).join(', ');
    const outcome = hadTokens ? `${counts}, overrides ${overrides.length}; vs the previous set: +${delta.added} added, -${delta.removed} removed, ~${delta.changed} changed` : `first extraction: ${counts}, overrides ${overrides.length}`;
    log.proposals.push({ date: opts.today || new Date().toISOString().slice(0, 10), name: 'Token extraction (fidelity split stage)', source: relProto, outcome });
    writeIfChanged(cfg.paths.tokensHistory, `${JSON.stringify(log, null, 1)}\n`);
    history = true;
  }
  return { tokens: Object.values(perTheme).reduce((a, b) => a + b, 0), perTheme, overrides: overrides.length, changed, history };
}
