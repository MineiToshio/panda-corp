/**
 * Loads, validates and normalises docs/design/freeze/fidelity.config.json. The JSON schema next to this file is the
 * single source of the config's shape: `validate` interprets the subset of JSON Schema it uses, so the schema an
 * editor shows and the check the tools run cannot drift apart.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SCHEMA_PATH = path.join(HERE, 'config.schema.json');
export const CONFIG_REL = 'docs/design/freeze/fidelity.config.json';
export const FREEZE_REL = 'docs/design/freeze';
/** Capture widths and themes when the config omits them; the design gate applies the same defaults. */
export const DEFAULT_WIDTHS = Object.freeze([375, 768, 1280]);
export const DEFAULT_THEMES = Object.freeze(['light', 'dark']);

const DEFAULT_SPRITE = '<svg(?=[^>]*\\bwidth="0")(?=[^>]*\\bheight="0")[^>]*>[\\s\\S]*?</svg>';
const DEFAULT_PREFIX_STRIP = '^(html:not\\([^)]*\\)|html:has\\(.*?\\)\\)|html|\\[data-theme="[^"]*"\\]|\\.dark|\\.light|\\.host-auto|:root)\\s*';

/** A config that failed validation; `errors` lists every problem as "path: message". */
export class ConfigError extends Error {
  constructor(errors, file) {
    super(`invalid fidelity config${file ? ` (${file})` : ''}:\n  ${errors.join('\n  ')}`);
    this.errors = errors;
  }
}

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const typeMatches = (want, v) => {
  const t = typeOf(v);
  return want === t || (want === 'number' && (t === 'integer' || t === 'number'));
};

/**
 * Validates a value against the JSON-Schema subset used by config.schema.json.
 * @param {object} schema the (sub)schema
 * @param {unknown} value the value to check
 * @param {object} [root] the root schema, for $ref resolution
 * @param {string} [at] the JSON path of `value`, for messages
 * @returns {string[]} the problems found (empty when valid)
 */
export function validate(schema, value, root = schema, at = '$') {
  if (schema.$ref) return validate(resolveRef(root, schema.$ref), value, root, at);
  const errs = [];
  if (schema.type) {
    const types = [].concat(schema.type);
    if (!types.some((t) => typeMatches(t, value))) return [`${at}: expected ${types.join(' or ')}, got ${typeOf(value)}`];
  }
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${at}: must be one of ${schema.enum.join(', ')}`);
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errs.push(`${at}: must be >= ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errs.push(`${at}: must be <= ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errs.push(`${at}: needs at least ${schema.minItems} item(s)`);
    if (schema.items) value.forEach((v, i) => errs.push(...validate(schema.items, v, root, `${at}[${i}]`)));
  } else if (typeOf(value) === 'object') errs.push(...validateObject(schema, value, root, at));
  return errs;
}

function validateObject(schema, value, root, at) {
  const errs = [];
  const keys = Object.keys(value);
  if (schema.minProperties !== undefined && keys.length < schema.minProperties) errs.push(`${at}: needs at least ${schema.minProperties} key(s)`);
  if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) errs.push(`${at}: allows at most ${schema.maxProperties} key(s)`);
  for (const r of schema.required || []) if (!(r in value)) errs.push(`${at}: missing required "${r}"`);
  for (const k of keys) {
    const sub = schema.properties?.[k];
    if (sub) errs.push(...validate(sub, value[k], root, `${at}.${k}`));
    else if (schema.additionalProperties === false) errs.push(`${at}: unknown key "${k}"`);
    else if (typeof schema.additionalProperties === 'object') errs.push(...validate(schema.additionalProperties, value[k], root, `${at}.${k}`));
  }
  return errs;
}

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`unsupported $ref ${ref}`);
  return ref.slice(2).split('/').reduce((o, k) => o[k], root);
}

/** @returns {object} the parsed config schema */
export function loadSchema() {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

/**
 * The project root: FIDELITY_ROOT, else PROJECT_ROOT, else the current directory. Never a hardcoded path.
 * @returns {string} absolute project root
 */
export function resolveRoot() {
  return path.resolve(process.env.FIDELITY_ROOT || process.env.PROJECT_ROOT || process.cwd());
}

/**
 * Reads, validates and normalises a config.
 * @param {{root?: string, file?: string, raw?: object, allStates?: boolean}} [opts] raw: an in-memory config instead of the file
 * @returns {object} the normalised config (defaults applied, `paths` resolved, `root` set)
 * @throws {ConfigError} when the config does not match the schema or names a missing prototype
 */
export function loadConfig(opts = {}) {
  const root = path.resolve(opts.root || resolveRoot());
  const file = opts.raw ? null : path.resolve(root, opts.file || CONFIG_REL);
  if (file && !fs.existsSync(file)) throw new ConfigError([`no config at ${file} (see config.schema.json and fidelity.config.example.json)`], file);
  const raw = opts.raw || JSON.parse(fs.readFileSync(file, 'utf8'));
  const errors = validate(loadSchema(), raw);
  if (errors.length) throw new ConfigError(errors, file);
  const cfg = normalise(structuredClone(raw), root);
  const problems = semanticChecks(cfg);
  if (problems.length) throw new ConfigError(problems, file);
  if (opts.allStates) cfg.scope.mode = 'full';
  cfg.configFile = file;
  return cfg;
}

function normalise(c, root) {
  c.root = root;
  c.lang ??= 'en';
  c.widths = [...new Set(c.widths || DEFAULT_WIDTHS)].sort((a, b) => a - b);
  c.touchBelow ??= 768;
  c.themes ??= [...DEFAULT_THEMES];
  c.themeAttribute ??= 'data-theme';
  c.params = { demoOff: 'demo=off', host: 'host=page', theme: 'theme', ...c.params };
  if (c.hostAutoClass === undefined) c.hostAutoClass = 'host-auto';
  c.baseHeight ??= 900;
  c.maxCaptureHeight ??= 65000;
  c.workers = Number(process.env.FIDELITY_WORKERS) || c.workers || 4;
  c.hashNavigation ??= true;
  c.settle = { waitMs: 500, imageTimeoutMs: 8000, scrollPass: false, ...c.settle };
  c.probe = { demoOff: null, theme: null, ...c.probe };
  c.screenSelector ??= 'main > [data-screen]';
  c.screenAttribute ??= 'data-screen';
  c.demoOnlyAttribute ??= 'data-demo-only';
  c.spriteRequired = c.sprite !== undefined && c.sprite !== null;
  if (c.sprite === undefined) c.sprite = DEFAULT_SPRITE;
  c.states ??= {};
  c.components ??= [];
  c.floating ??= [];
  c.scope = { mode: 'pareto', ...c.scope };
  c.scope.primaryWidth ??= Math.max(...c.widths);
  c.scope.touchWidth ??= Math.min(...c.widths);
  c.catalog = { title: 'Components', sheetMax: 30000, ...c.catalog };
  c.identity = { widths: [c.scope.touchWidth, c.scope.primaryWidth].filter((w, i, a) => a.indexOf(w) === i), theme: c.themes[0], attempts: 3, ...c.identity };
  c.diff = { threshold: 0.1, maxRatio: 0.005, sliceHeight: c.baseHeight, ...c.diff };
  c.shard = { extras: [{ selector: 'dialog[open]', label: 'Dialog (top layer in the app)', style: 'position:static;margin:24px auto;transform:none' }], strip: `[${c.demoOnlyAttribute}]`, gateAttributes: [], sectionAttributes: [], htmlAttributes: { [c.themeAttribute]: 'light' }, jpegQuality: 88, ...c.shard };
  const protoAbs = path.resolve(root, c.prototype);
  const protoDir = path.dirname(protoAbs);
  c.screenshots = { prefix: path.basename(protoAbs).replace(/\.[^.]+$/, ''), jpegQuality: 85, ...c.screenshots };
  c.tokens = { groups: [], ...c.tokens };
  c.css = { numbered: true, families: [], rules: [], overrides: {}, prefixStrip: DEFAULT_PREFIX_STRIP, verbatim: [], closingComments: [], unmatched: 'heuristic', ...c.css };
  const reference = path.join(protoDir, 'reference');
  c.paths = {
    prototype: protoAbs,
    protoDir,
    reference,
    css: path.resolve(root, c.css.out || path.join(path.relative(root, reference), 'css')),
    computedStyles: path.join(reference, 'computed-styles.json'),
    crops: path.join(reference, 'components'),
    catalog: path.join(protoDir, 'components.html'),
    screenshots: path.join(protoDir, 'screenshots'),
    frds: path.join(root, 'docs/frds'),
    freeze: path.join(root, FREEZE_REL),
    tokens: path.join(root, 'docs/design/design-tokens.json'),
    tokensHistory: path.join(root, 'docs/design/design-tokens-history.json'),
  };
  return c;
}

function semanticChecks(c) {
  const errs = [];
  if (!fs.existsSync(c.paths.prototype)) errs.push(`prototype: no file at ${c.paths.prototype}`);
  if (!c.widths.includes(c.scope.primaryWidth)) errs.push(`scope.primaryWidth ${c.scope.primaryWidth} is not one of widths`);
  if (!c.widths.includes(c.scope.touchWidth)) errs.push(`scope.touchWidth ${c.scope.touchWidth} is not one of widths`);
  const names = new Set();
  for (const comp of c.components) {
    if (names.has(comp.name)) errs.push(`components: duplicate name "${comp.name}"`);
    names.add(comp.name);
  }
  for (const f of c.floating) {
    const comp = c.components.find((x) => x.name === f.component);
    if (!comp) errs.push(`floating: unknown component "${f.component}"`);
    else if (!comp.states[f.state]) errs.push(`floating: "${f.component}" has no state "${f.state}"`);
  }
  const fams = new Set(c.css.families.map((f) => f.name));
  for (const r of c.css.rules) if (!fams.has(r.family)) errs.push(`css.rules: unknown family "${r.family}"`);
  for (const [k, fam] of Object.entries(c.css.overrides)) if (!fams.has(fam)) errs.push(`css.overrides["${k}"]: unknown family "${fam}"`);
  for (const r of c.css.rules) { try { new RegExp(r.match); } catch (e) { errs.push(`css.rules: bad regex ${r.match}: ${e.message}`); } }
  for (const g of c.tokens.groups) { try { new RegExp(g.match); } catch (e) { errs.push(`tokens.groups: bad regex ${g.match}: ${e.message}`); } }
  for (const [frd, list] of Object.entries(c.states)) {
    const ids = new Set();
    for (const s of list) { if (ids.has(s.id)) errs.push(`states.${frd}: duplicate id "${s.id}"`); ids.add(s.id); }
  }
  return errs;
}

/**
 * sha256 of any JSON-serialisable value or Buffer/string.
 * @param {...unknown} parts the inputs
 * @returns {string} hex digest (16 chars)
 */
export function hashOf(...parts) {
  const h = crypto.createHash('sha256');
  for (const p of parts) h.update(Buffer.isBuffer(p) ? p : typeof p === 'string' ? p : JSON.stringify(p ?? null)).update('\u0000');
  return h.digest('hex').slice(0, 16);
}

/**
 * Fingerprint of the prototype: its HTML bytes plus every other file under its folder (content up to 2 MB, size and
 * mtime above) except the generated outputs, so an edited image or font invalidates the stages that render it.
 * @param {object} cfg normalised config
 * @returns {string} hash
 */
export function prototypeHash(cfg) {
  const skip = new Set([cfg.paths.reference, cfg.paths.screenshots, cfg.paths.catalog, path.join(cfg.paths.protoDir, '.linked-check.html')]);
  // files the catalog stage exported (config `exports`) are outputs, not inputs
  const exported = path.join(cfg.paths.freeze, 'exports.json');
  if (fs.existsSync(exported)) for (const rel of JSON.parse(fs.readFileSync(exported, 'utf8'))) skip.add(path.resolve(cfg.paths.protoDir, rel));
  const entries = [];
  const walk = (dir, depth) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, d.name);
      if (skip.has(p) || d.name.startsWith('.')) continue;
      const st = fs.statSync(p);
      if (st.isDirectory()) { if (depth < 8) walk(p, depth + 1); continue; }
      if (p === cfg.paths.prototype) continue;
      // small files by content; big ones (photo packs) by size and mtime, so a run never reads hundreds of MB
      entries.push(`${path.relative(cfg.paths.protoDir, p)}:${st.size}:${st.size <= 2e6 ? hashOf(fs.readFileSync(p)) : Math.round(st.mtimeMs)}`);
    }
  };
  walk(cfg.paths.protoDir, 0);
  return hashOf(fs.readFileSync(cfg.paths.prototype), entries.sort());
}

/** @returns {string} hash of this toolset's own sources (a tool change invalidates every stage) */
export function toolHash() {
  return hashOf(...fs.readdirSync(HERE).filter((f) => f.endsWith('.mjs')).sort().map((f) => fs.readFileSync(path.join(HERE, f))));
}

/**
 * The screens of the whole-app set: the configured list, else every element carrying screenAttribute in the
 * prototype source that is not marked demoOnlyAttribute.
 * @param {object} cfg normalised config
 * @returns {{id: string, route: string, widths: number[]}[]} screens
 */
export function listScreens(cfg) {
  if (cfg.screens) return cfg.screens.map((s) => (typeof s === 'string' ? { id: s, route: `#${s}`, widths: cfg.widths } : { route: `#${s.id}`, widths: cfg.widths, ...s }));
  const html = fs.readFileSync(cfg.paths.prototype, 'utf8');
  const attr = cfg.screenAttribute.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&');
  const re = new RegExp(`<[a-zA-Z][\\w-]*\\s([^>]*?)\\b${attr}="([^"]+)"([^>]*)>`, 'g');
  const out = [];
  for (const m of html.matchAll(re)) {
    if ((m[1] + m[3]).includes(cfg.demoOnlyAttribute) || out.some((s) => s.id === m[2])) continue;
    out.push({ id: m[2], route: `#${m[2]}`, widths: cfg.widths });
  }
  return out;
}
