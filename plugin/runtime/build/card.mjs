/**
 * Pandacorp build engine v2 — change-queue cards (BUILD-8, D17, D18, PLAN 3.16 A3).
 *
 * A card is `.pandacorp/inbox/changes/<slug>.md`: flat YAML frontmatter + a Markdown body. The queue is a FILE
 * FORMAT shared with Mission Control (`changes.ts`), the DR-147 reconciler (`change-reconcile.mjs`), doc-lint and the
 * default engine's `build-state.mjs`; this module is the only v2 reader and writer of it, and it stays readable by all
 * of them: writers touch single `key: value` lines and never reflow the body, `status` is written as a plain word
 * (the v1 reader matches `^status:\s*(draft|ready|building|done)\s*$`), lists are written as one-line JSON flow
 * sequences (the reconciler only reads that shape), and `integration_paths` / `integration_transaction` (v1 meaning)
 * are never written.
 *
 * Frontmatter is read by a small SAFE parser (`parseYamlSubset`): scalars, quoted strings, one-line flow lists,
 * block lists and block scalars. Anchors, aliases, tags, merge keys, flow maps and nested maps are never expanded or
 * evaluated: they are reported as `unsupported`, and the card check turns them into errors.
 *
 * Pure with respect to its inputs: every side effect goes through `deps` (`resolveDeps`): `fs` (a `node:fs/promises`
 * compatible object), `env`, `homedir`, `now`, and an optional `isTracked(absPath)` guard (D1) that makes a write to a
 * git-tracked card fail closed.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import * as nodeFs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validate } from "./fsx.mjs";
import { SCHEMAS_DIR } from "./paths.mjs";

/** Card `type` values accepted by Mission Control. */
export const CARD_TYPES = Object.freeze(["bug", "feature", "change"]);
/** Card `class` values (urgency, DR-069). */
export const CARD_CLASSES = Object.freeze(["expedite", "standard", "intangible", "fixed-date"]);
/** Card `status` values inside Mission Control's enum; `obsolete` is a read alias of `discarded`, never written. */
export const CARD_STATUSES = Object.freeze(["ready", "draft", "building", "closing", "done", "discarded"]);
/** Slug grammar of a card file stem (the reconciler and `build-state.mjs` require it). */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
/** Frontmatter keys v2 must never write (their meaning belongs to the default engine). */
export const V1_ONLY_KEYS = Object.freeze(["integration_paths", "integration_transaction"]);

const FRD_RE = /^frd-[a-z0-9-]+$/;
const KEY_NAME_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const FM_RE = /^﻿?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;
const CITATION_RE = /"[^"\n]{3,}"|“[^”\n]{3,}”|«[^»\n]{3,}»/;
const PLAIN_ENUM_KEYS = new Set(["status", "type", "class", "engine", "origin"]);
const SHA_RE = /^[0-9a-f]{7,40}$/;

// The schema is the type truth of the frontmatter (card-frontmatter.schema.json); read once, self-located.
const CARD_SCHEMA = JSON.parse(readFileSync(path.join(SCHEMAS_DIR, "card-frontmatter.schema.json"), "utf8"));

const fail = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });

/**
 * Normalize the injected dependencies. Tests pass real `node:fs/promises` against mkdtemp trees.
 * @param {{fs?: object, env?: object, homedir?: string, now?: () => number, isTracked?: (abs: string) => Promise<boolean>}} [deps]
 * @returns {{fs: object, env: object, homedir: string, now: () => number, isTracked: null | ((abs: string) => Promise<boolean>)}}
 */
export function resolveDeps(deps = {}) {
  const env = deps.env ?? process.env;
  const now = deps.now ?? (() => {
    const hooked = env.PANDACORP_NOW ? Date.parse(env.PANDACORP_NOW) : Number.NaN;
    return Number.isFinite(hooked) ? hooked : Date.now();
  });
  return { fs: deps.fs ?? nodeFs, env, homedir: deps.homedir ?? os.homedir(), now, isTracked: deps.isTracked ?? null };
}

// ---------------------------------------------------------------------------------------------------------------
// Safe YAML subset
// ---------------------------------------------------------------------------------------------------------------

function scanQuoted(text) {
  const quote = text[0];
  if (quote === '"') {
    for (let i = 1; i < text.length; i += 1) {
      if (text[i] === "\\") { i += 1; continue; }
      if (text[i] !== '"') continue;
      let value;
      try { value = JSON.parse(text.slice(0, i + 1)); } catch { return null; }
      return { value, rest: text.slice(i + 1) };
    }
    return null;
  }
  let value = "";
  for (let i = 1; i < text.length; i += 1) {
    if (text[i] !== "'") { value += text[i]; continue; }
    if (text[i + 1] === "'") { value += "'"; i += 1; continue; }
    return { value, rest: text.slice(i + 1) };
  }
  return null;
}

const bareScalar = (text) => {
  const plain = text.replace(/\s+#.*$/, "").trim();
  if (plain === "" || plain === "~" || plain === "null") return null;
  if (plain === "true") return true;
  if (plain === "false") return false;
  return plain;
};

/** Parse one scalar token. Returns `{value}` or `{problem}`. */
function parseScalar(text) {
  const token = text.trim();
  if (token === "" || token.startsWith("#")) return { value: null };
  if (/^[&*!]/.test(token) || token.startsWith("<<")) return { problem: `unsupported YAML construct: ${token.slice(0, 20)}` };
  if (token.startsWith("{")) return { problem: "unsupported YAML construct: flow mapping" };
  if (token[0] === '"' || token[0] === "'") {
    const quoted = scanQuoted(token);
    if (!quoted) return { problem: "unterminated or invalid quoted scalar", syntax: true };
    if (!/^\s*(#.*)?$/.test(quoted.rest)) return { problem: "unexpected text after a quoted scalar", syntax: true };
    return { value: quoted.value };
  }
  return { value: bareScalar(token) };
}

function splitFlowItems(inner) {
  const items = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (quote) {
      current += ch;
      if (quote === '"' && ch === "\\") { current += inner[i + 1] ?? ""; i += 1; } else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") { quote = ch; current += ch; } else if (ch === ",") { items.push(current); current = ""; } else current += ch;
  }
  if (quote) return null;
  if (current.trim() !== "" || items.length > 0) items.push(current);
  return items;
}

function parseFlowSeq(text) {
  const close = text.lastIndexOf("]");
  if (close < 0 || !/^\s*(#.*)?$/.test(text.slice(close + 1))) return { problem: "unterminated flow sequence", syntax: true };
  const items = splitFlowItems(text.slice(1, close));
  if (items === null) return { problem: "unterminated quoted scalar in a flow sequence", syntax: true };
  const value = [];
  for (const raw of items) {
    if (/^\s*[[{]/.test(raw)) return { problem: "unsupported YAML construct: nested flow collection" };
    const parsed = parseScalar(raw);
    if (parsed.problem) return parsed;
    if (parsed.value !== null) value.push(typeof parsed.value === "string" ? parsed.value : String(parsed.value));
  }
  return { value };
}

function foldBlock(lines, style, chomp) {
  const indent = Math.min(...lines.filter((l) => l.trim() !== "").map((l) => l.length - l.trimStart().length));
  const body = lines.map((l) => (l.trim() === "" ? "" : l.slice(Number.isFinite(indent) ? indent : 0)));
  let text = style === "|" ? body.join("\n") : body.join("\n").replace(/([^\n])\n(?=[^\n])/g, "$1 ");
  text = text.replace(/\n+$/, "");
  if (chomp === "-") return text;
  return chomp === "+" ? `${text}\n` : text === "" ? "" : `${text}\n`;
}

/**
 * Parse the frontmatter text of a card, work order or similar flat document. Never expands or evaluates anything.
 * @param {string} text the text between the two `---` fences
 * @returns {{data: Record<string, unknown>, keys: string[], errors: string[], unsupported: string[]}}
 *   `errors` = malformed lines; `unsupported` = constructs the subset refuses (a lenient caller may ignore them).
 */
export function parseYamlSubset(text) {
  const data = {};
  const keys = [];
  const errors = [];
  const unsupported = [];
  const lines = String(text ?? "").split(/\r?\n/);
  const isListItem = (l) => /^[ \t]*-([ \t]+|$)/.test(l);
  const note = (bucket, n, why) => bucket.push(`line ${n + 1}: ${why}`);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "" || /^\s*#/.test(line)) continue;
    const m = /^([^\s:#][^:]*?)[ \t]*:(?:[ \t]+(.*)|[ \t]*)$/.exec(line);
    if (!m || /^[ \t]/.test(line)) { note(/^[ \t]|^-/.test(line) ? unsupported : errors, i, `cannot read frontmatter line: ${line.trim().slice(0, 40)}`); continue; }
    const key = m[1];
    if (!KEY_NAME_RE.test(key) || FORBIDDEN_KEYS.has(key)) { note(errors, i, `invalid key: ${key.slice(0, 40)}`); continue; }
    if (Object.hasOwn(data, key)) { note(errors, i, `duplicate key: ${key}`); continue; }
    const rest = (m[2] ?? "").trim();
    let value = null;
    const block = /^([|>])([+-]?)\d?([+-]?)[ \t]*(#.*)?$/.exec(rest);
    if (block) {
      const collected = [];
      while (i + 1 < lines.length && (lines[i + 1].trim() === "" || /^[ \t]/.test(lines[i + 1]))) { i += 1; collected.push(lines[i]); }
      value = foldBlock(collected, block[1], block[2] || block[3]);
    } else if (rest === "" || rest.startsWith("#")) {
      const items = [];
      let j = i + 1;
      while (j < lines.length && (lines[j].trim() === "" || /^\s*#/.test(lines[j]))) j += 1;
      if (j < lines.length && isListItem(lines[j])) {
        for (; j < lines.length && (isListItem(lines[j]) || lines[j].trim() === "" || /^\s*#/.test(lines[j])); j += 1) {
          if (!isListItem(lines[j])) continue;
          const item = parseScalar(lines[j].replace(/^[ \t]*-[ \t]*/, ""));
          if (item.problem) note(item.syntax ? errors : unsupported, j, item.problem);
          else if (item.value !== null) items.push(typeof item.value === "string" ? item.value : String(item.value));
        }
        i = j - 1;
        value = items;
      } else if (j < lines.length && /^[ \t]+\S/.test(lines[j])) {
        note(unsupported, j, `nested mapping or multi-line scalar under ${key}`);
        while (j < lines.length && (lines[j].trim() === "" || /^[ \t]/.test(lines[j]))) j += 1;
        i = j - 1;
        value = "";
      }
    } else if (rest.startsWith("[")) {
      const parsed = parseFlowSeq(rest);
      if (parsed.problem) note(parsed.syntax ? errors : unsupported, i, `${key}: ${parsed.problem}`);
      value = parsed.value ?? [];
    } else {
      const parsed = parseScalar(rest);
      if (parsed.problem) { note(parsed.syntax ? errors : unsupported, i, `${key}: ${parsed.problem}`); value = rest; } else value = parsed.value;
    }
    data[key] = value;
    keys.push(key);
  }
  return { data, keys, errors, unsupported };
}

/**
 * Split a Markdown document into its frontmatter text and body.
 * @param {string} raw whole file
 * @returns {{fm: string, body: string, nl: string} | null} null when there is no frontmatter fence
 */
export function splitFrontmatter(raw) {
  const m = FM_RE.exec(String(raw ?? ""));
  if (!m) return null;
  return { fm: m[1] ?? "", body: raw.slice(m[0].length), nl: raw.includes("\r\n") ? "\r\n" : "\n" };
}

const asList = (value) => {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value === "string" && value.trim() !== "") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
};
const asText = (value) => (typeof value === "string" ? value.trim() : typeof value === "number" || typeof value === "boolean" ? String(value) : "");

/** Normalize a frontmatter list field (flow list, block list or comma scalar) to a string array. */
export const frontmatterList = asList;

// ---------------------------------------------------------------------------------------------------------------
// Frontmatter writing (single-line edits, body untouched)
// ---------------------------------------------------------------------------------------------------------------

function serializeValue(key, value) {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return JSON.stringify(value.map(String));
  const text = String(value);
  if (key.endsWith("_sha") && SHA_RE.test(text) && !/^\d+(e\d+)?$/.test(text)) return text;
  if (PLAIN_ENUM_KEYS.has(key) && /^[a-z][a-z0-9-]*$/.test(text)) return text;
  if ((key === "date" && /^\d{4}-\d{2}-\d{2}$/.test(text)) || (key === "frd" && FRD_RE.test(text))) return text;
  return JSON.stringify(text.replace(/\s+/g, " ").trim());
}

function keyExtent(lines, index) {
  const inline = lines[index].slice(lines[index].indexOf(":") + 1).replace(/\s+#.*$/, "").trim();
  const block = /^[|>]/.test(inline);
  let end = index + 1;
  while (end < lines.length) {
    const l = lines[end];
    if (/^[ \t]+\S/.test(l) || (inline === "" && /^-(\s|$)/.test(l)) || (block && l.trim() === "")) end += 1;
    else break;
  }
  while (block && end > index + 1 && lines[end - 1].trim() === "") end -= 1;
  return end;
}

/**
 * Set and remove frontmatter keys by editing single lines; the body and every other line stay byte-identical.
 * @param {string} raw whole card text
 * @param {{set?: Record<string, unknown>, remove?: string[]}} edits
 * @returns {string} the edited text
 */
export function updateFrontmatter(raw, { set = {}, remove = [] } = {}) {
  const parts = splitFrontmatter(raw);
  if (!parts) throw fail("INVALID_INPUT", "card has no frontmatter");
  const lines = parts.fm === "" ? [] : parts.fm.split(/\r?\n/);
  const find = (key) => lines.findIndex((l) => new RegExp(`^${key}[ \\t]*:`).test(l));
  for (const key of remove) {
    if (!KEY_NAME_RE.test(key)) throw fail("INVALID_INPUT", `invalid frontmatter key: ${key}`);
    const at = find(key);
    if (at >= 0) lines.splice(at, keyExtent(lines, at) - at);
  }
  for (const [key, value] of Object.entries(set)) {
    if (!KEY_NAME_RE.test(key) || FORBIDDEN_KEYS.has(key)) throw fail("INVALID_INPUT", `invalid frontmatter key: ${key}`);
    if (V1_ONLY_KEYS.includes(key)) throw fail("INVALID_INPUT", `v2 never writes ${key}`);
    const line = `${key}: ${serializeValue(key, value)}`;
    const at = find(key);
    if (at >= 0) lines.splice(at, keyExtent(lines, at) - at, line);
    else lines.push(line);
  }
  const closing = /\r?\n$/.test(raw.slice(0, raw.length - parts.body.length)) ? parts.nl : "";
  const head = raw.startsWith("﻿") ? "﻿" : "";
  return `${head}---${parts.nl}${lines.join(parts.nl)}${lines.length ? parts.nl : ""}---${closing}${parts.body}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Reading and checking
// ---------------------------------------------------------------------------------------------------------------

/**
 * Accept a card reference: `change:<id>`, `change=<id>` or a bare slug.
 * @param {string} raw the reference as typed
 * @returns {string | null} the slug, or null when it is not a valid reference
 */
export function parseCardRef(raw) {
  const text = String(raw ?? "").trim();
  const slug = /^change[:=](.+)$/i.exec(text)?.[1]?.trim() ?? text;
  return SLUG_RE.test(slug) ? slug : null;
}

/**
 * Absolute directories of the queue.
 * @param {string} project absolute project root
 */
export const cardPaths = (project) => {
  const pending = path.join(project, ".pandacorp", "inbox", "changes");
  return { pending, done: path.join(pending, "done") };
};

function sectionOf(lines, name) {
  const at = lines.findIndex((l) => {
    const m = /^#{2,6}\s+(.*?)\s*$/.exec(l);
    const heading = m?.[1].toLowerCase().replace(/[*_`:]/g, "").trim() ?? "";
    return heading === name || heading.startsWith(`${name} `) || heading.startsWith(`${name}(`);
  });
  if (at < 0) return null;
  const items = [];
  for (let i = at + 1; i < lines.length && !/^#{1,6}\s/.test(lines[i]); i += 1) {
    const m = /^\s*(?:[-*+]|\d+[.)])\s+(.*\S)\s*$/.exec(lines[i]);
    if (m) items.push({ text: m[1], cited: CITATION_RE.test(m[1]) });
  }
  return items;
}

/**
 * Interpret a card file: frontmatter model, title and the Dentro/Fuera/Dudas sections. Never throws on bad content.
 * @param {string} raw whole file text
 * @param {{slug?: string, source?: "pending"|"done", requireScope?: boolean}} [opts] `requireScope` makes a missing
 *   Dentro/Fuera section an error even when the card is not `origin: conversation` (session cards)
 * @returns {object} `{slug, ok, errors, warnings, fields, ...model}`; `ok` is true when `errors` is empty
 */
export function parseCardText(raw, { slug = "", source = "pending", requireScope = false } = {}) {
  const errors = [];
  const warnings = [];
  const parts = splitFrontmatter(raw);
  if (!parts) {
    return { slug, source, ok: false, errors: ["missing frontmatter (the file must start with a --- fence)"], warnings, fields: {} };
  }
  const yaml = parseYamlSubset(parts.fm);
  for (const e of yaml.errors) errors.push(`frontmatter: ${e}`);
  for (const e of yaml.unsupported) errors.push(`frontmatter: ${e} (not allowed in a card)`);
  const fm = yaml.data;
  const statusRaw = asText(fm.status);
  const status = statusRaw === "obsolete" ? "discarded" : statusRaw;
  if (!CARD_TYPES.includes(fm.type)) errors.push("type: must be one of bug|feature|change");
  if (!CARD_STATUSES.includes(status)) errors.push("status: must be one of ready|draft|building|closing|done|discarded");
  if (statusRaw === "obsolete") warnings.push("status: obsolete is read as discarded and must never be written");
  const lines = parts.body.split(/\r?\n/);
  const h1 = lines.find((l) => /^#\s+\S/.test(l.trim()));
  const title = h1 ? h1.trim().replace(/^#\s+/, "").trim() : "";
  if (!title) errors.push("body: missing title (no H1 heading)");
  const dentro = sectionOf(lines, "dentro");
  const fuera = sectionOf(lines, "fuera");
  const dudas = sectionOf(lines, "dudas");
  const engine = asText(fm.engine);
  const origin = asText(fm.origin);
  const strict = requireScope || origin === "conversation";
  const problem = (message) => (strict ? errors : warnings).push(message);
  if (dentro === null) problem("body: missing the Dentro section");
  else if (dentro.length === 0) problem("body: Dentro has no list items");
  else if (!dentro.some((i) => i.cited)) problem('body: no Dentro item cites the owner message (quote it, e.g. "...")');
  else if (dentro.some((i) => !i.cited)) warnings.push(`body: ${dentro.filter((i) => !i.cited).length} Dentro item(s) without a citation`);
  if (fuera === null) problem("body: missing the Fuera section");
  if (dudas === null && strict) warnings.push("body: missing the Dudas section");
  if (asText(fm.date) !== "" && !/^\d{4}-\d{2}-\d{2}/.test(asText(fm.date))) warnings.push("date: expected YYYY-MM-DD");
  const frds = asList(fm.affected_frds);
  const frd = asText(fm.frd);
  if (frd !== "" && !FRD_RE.test(frd)) warnings.push("frd: expected frd-NN-slug");
  for (const f of frds) if (!FRD_RE.test(f)) warnings.push(`affected_frds: ${f} is not an frd-NN-slug id`);
  // A blank value means "unset" (the card template ships blank keys); only `rigor` may be a literal null.
  const typed = Object.fromEntries(Object.entries(fm).filter(([k, v]) => v !== null || k === "rigor"));
  for (const e of validate(CARD_SCHEMA, typed).errors) {
    const field = e.path.split("/")[1];
    if (field === undefined || field === "type" || field === "status") continue;
    errors.push(`${field}: ${e.message} (card-frontmatter schema)`);
  }
  if (engine === "v2") for (const key of V1_ONLY_KEYS) if (fm[key] !== undefined) errors.push(`${key}: v1-only field, v2 never writes it`);
  if (engine === "v2" && status === "building" && asText(fm.run_id) === "") warnings.push("run_id: a v2 building card should carry the run id");
  return {
    slug, source, ok: errors.length === 0, errors, warnings, fields: statusRaw === "obsolete" ? { ...fm, status: "discarded" } : fm,
    type: asText(fm.type), class: CARD_CLASSES.includes(fm.class) ? fm.class : "standard", status, date: asText(fm.date),
    frd, affected_frds: frds, engine, origin, run_id: asText(fm.run_id), docs_sha: asText(fm.docs_sha), shipped_sha: asText(fm.shipped_sha),
    v1: fm.integration_transaction !== undefined && asText(fm.integration_transaction) !== "",
    title, dentro: dentro ?? [], fuera: fuera ?? [], dudas: dudas ?? [], has_dentro: dentro !== null, body: parts.body,
  };
}

async function lstatOrNull(fs, file) {
  try { return await fs.lstat(file); } catch (error) { if (error?.code === "ENOENT") return null; throw error; }
}

async function readRegular(fs, file) {
  const entry = await lstatOrNull(fs, file);
  if (!entry) return null;
  if (entry.isSymbolicLink() || !entry.isFile()) throw fail("INVALID_PATH", `card must be a regular file: ${file}`);
  return fs.readFile(file, "utf8");
}

/**
 * Read one card from the queue.
 * @param {string} project absolute project root
 * @param {string} slug card slug
 * @param {{where?: "pending"|"done"|"any", requireScope?: boolean}} [opts] where to look (default pending); `requireScope`
 *   is passed to `parseCardText`
 * @param {object} [deps] see `resolveDeps`
 * @returns {Promise<object|null>} the `parseCardText` model, or null when the card does not exist
 */
export async function readCard(project, slug, { where = "pending", requireScope = false } = {}, deps = {}) {
  const { fs } = resolveDeps(deps);
  if (!SLUG_RE.test(slug)) throw fail("INVALID_INPUT", `invalid card slug: ${slug}`);
  const dirs = cardPaths(project);
  for (const source of where === "any" ? ["pending", "done"] : [where]) {
    const raw = await readRegular(fs, path.join(dirs[source], `${slug}.md`));
    if (raw !== null) return parseCardText(raw, { slug, source, requireScope });
  }
  return null;
}

/**
 * List the cards of the queue. A malformed card is reported in `errors`, never dropped (DR-078).
 * @param {string} project absolute project root
 * @param {{done?: boolean}} [opts] `done: true` lists `changes/done/` instead of the pending directory
 * @param {object} [deps] see `resolveDeps`
 * @returns {Promise<{cards: object[], errors: {file: string, reason: string}[]}>} cards sorted by slug
 */
export async function listCards(project, { done = false } = {}, deps = {}) {
  const { fs } = resolveDeps(deps);
  const dirs = cardPaths(project);
  const dir = done ? dirs.done : dirs.pending;
  const entry = await lstatOrNull(fs, dir);
  if (!entry) return { cards: [], errors: [] };
  if (entry.isSymbolicLink() || !entry.isDirectory()) return { cards: [], errors: [{ file: path.basename(dir), reason: "the queue directory must be a real directory" }] };
  const cards = [];
  const errors = [];
  for (const name of (await fs.readdir(dir)).sort()) {
    if (!name.endsWith(".md") || name === "README.md" || name.startsWith("_")) continue;
    const slug = name.slice(0, -3);
    const label = done ? `done/${name}` : name;
    if (!SLUG_RE.test(slug)) { errors.push({ file: label, reason: "file stem is not a valid slug (lowercase letters, digits, hyphens)" }); continue; }
    let raw;
    try { raw = await readRegular(fs, path.join(dir, name)); } catch (error) { errors.push({ file: label, reason: error.message }); continue; }
    if (raw === null || raw.trim() === "") { errors.push({ file: label, reason: "file is empty or unreadable" }); continue; }
    const card = parseCardText(raw, { slug, source: done ? "done" : "pending" });
    if (card.errors.some((e) => e.startsWith("type:") || e.startsWith("status:") || e.startsWith("missing frontmatter") || e.startsWith("frontmatter:") || e.startsWith("body: missing title"))) {
      errors.push({ file: label, reason: card.errors.join("; ") });
      continue;
    }
    cards.push(card);
  }
  return { cards, errors };
}

/**
 * `card check` over a text: the model plus `{errors, warnings, fields}`.
 * @param {string} raw whole file text
 * @param {{slug?: string, requireScope?: boolean}} [opts] `requireScope` forces the Dentro/Fuera errors (session cards)
 */
export function checkCardText(raw, { slug = "", requireScope = false } = {}) {
  const card = parseCardText(raw, { slug, requireScope });
  if (slug !== "" && !SLUG_RE.test(slug)) card.errors.push("file name: the slug must be lowercase letters, digits and hyphens");
  card.ok = card.errors.length === 0;
  return card;
}

/**
 * Check a card file given by absolute path. Read-only. Never throws on bad content.
 * @param {string} file absolute card path (the file stem is the slug)
 * @param {{requireScope?: boolean}} [opts] `requireScope` forces the Dentro/Fuera errors (session cards)
 * @param {object} [deps] see `resolveDeps`
 * @returns {Promise<object>} the card model (`ok`, `errors`, `warnings`, `fields`, ...); a missing or unreadable file gives
 *   `ok: false` with one error and `fields: {}`
 */
async function checkCardFile(file, opts, deps) {
  const { fs } = resolveDeps(deps);
  let raw;
  try { raw = await readRegular(fs, file); } catch (error) { return { ok: false, errors: [error.message], warnings: [], fields: {} }; }
  if (raw === null) return { ok: false, errors: [`file not found: ${file}`], warnings: [], fields: {} };
  return checkCardText(raw, { slug: path.basename(file, ".md"), ...opts });
}

/**
 * `card check` on a file: `{ok, errors, warnings, fields, ...card model}`.
 * @param {string} file absolute card path
 * @param {object} [deps] see `resolveDeps`
 */
export const checkCard = (file, deps = {}) => checkCardFile(file, {}, deps);

/**
 * The `card check` CLI result. The dispatcher exits 6 when `ok` is false (the JSON is still printed in full).
 * @param {string} project absolute project root (resolves a relative path)
 * @param {string} file card path, absolute or relative to `project`
 * @param {{requireScope?: boolean}} [opts]
 * @param {object} [deps] see `resolveDeps`
 * @returns {Promise<object>} `{ok, cmd:"card", sub:"check", errors, warnings, fields, card}`
 */
export async function cardCheckCommand(project, file, opts = {}, deps = {}) {
  const card = await checkCardFile(path.resolve(project, file), opts, deps);
  return { ok: card.ok, cmd: "card", sub: "check", errors: card.errors, warnings: card.warnings, fields: card.fields, card };
}

// ---------------------------------------------------------------------------------------------------------------
// Writing: creation and lifecycle
// ---------------------------------------------------------------------------------------------------------------

async function atomicWrite(fs, file, data, mode = 0o644) {
  const tmp = `${file}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  try {
    await fs.writeFile(tmp, data, { mode });
    await fs.rename(tmp, file);
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
}

async function guardWrite(ctx, file) {
  if (ctx.isTracked && (await ctx.isTracked(file))) {
    throw fail("INVALID_PATH", `card is git-tracked, write it through the integration worktree: ${path.basename(file)}`);
  }
}

async function ensureRealDir(fs, dir, { create = false } = {}) {
  let entry = await lstatOrNull(fs, dir);
  if (!entry && create) { await fs.mkdir(dir, { recursive: true }); entry = await lstatOrNull(fs, dir); }
  if (!entry || entry.isSymbolicLink() || !entry.isDirectory()) throw fail("INVALID_PATH", `queue directory must be a real directory: ${dir}`);
}

const localDay = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const bullets = (items, empty) => (items.length ? items.map((t) => `- ${t}`).join("\n") : empty);

/**
 * Render a new v2 card in the queue format (English frontmatter, Spanish body sections).
 * @param {{type: string, class?: string, status?: string, date: string, frd?: string, affected_frds?: string[], origin?: string,
 *   title: string, dentro: string[], fuera?: string[], dudas?: string[]}} input
 * @returns {string} the card text
 */
export function renderCard(input) {
  const status = input.status ?? "ready";
  const lines = [
    `type: ${serializeValue("type", input.type)}`, `class: ${serializeValue("class", input.class ?? "standard")}`,
    `status: ${serializeValue("status", status)}`, `date: ${serializeValue("date", input.date)}`,
    `frd: ${input.frd ? serializeValue("frd", input.frd) : ""}`.trimEnd(),
    `origin: ${serializeValue("origin", input.origin ?? "conversation")}`,
    `affected_frds: ${serializeValue("affected_frds", input.affected_frds ?? [])}`, "engine: v2",
  ];
  return `---\n${lines.join("\n")}\n---\n\n# ${input.title}\n\n## Dentro\n${bullets(input.dentro, "")}\n\n## Fuera\n${bullets(input.fuera ?? [], "Nada.")}\n\n## Dudas\n${bullets(input.dudas ?? [], "Ninguna.")}\n`;
}

/**
 * Create a card in `.pandacorp/inbox/changes/` (never overwrites; the slug must be new in pending AND done/).
 * @param {string} project absolute project root
 * @param {{slug: string} & Parameters<typeof renderCard>[0]} input card fields; `date` defaults to today
 * @param {object} [deps] see `resolveDeps`
 * @returns {Promise<{slug: string, path: string}>}
 */
export async function createCard(project, input, deps = {}) {
  const ctx = resolveDeps(deps);
  if (!SLUG_RE.test(input.slug ?? "")) throw fail("INVALID_INPUT", `invalid card slug: ${input.slug}`);
  const text = renderCard({ ...input, date: input.date ?? localDay(ctx.now()) });
  const checked = checkCardText(text, { slug: input.slug, requireScope: true });
  if (!checked.ok) throw fail("INVALID_INPUT", `card fails card check: ${checked.errors.join("; ")}`, { errors: checked.errors });
  const dirs = cardPaths(project);
  await ensureRealDir(ctx.fs, dirs.pending, { create: true });
  for (const dir of [dirs.pending, dirs.done]) {
    if (await lstatOrNull(ctx.fs, path.join(dir, `${input.slug}.md`))) throw fail("INVALID_INPUT", `card slug already exists: ${input.slug}`);
  }
  const file = path.join(dirs.pending, `${input.slug}.md`);
  await guardWrite(ctx, file);
  const tmp = `${file}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  await ctx.fs.writeFile(tmp, text, { mode: 0o644 });
  try { await ctx.fs.link(tmp, file); } catch (error) { throw error.code === "EEXIST" ? fail("INVALID_INPUT", `card slug already exists: ${input.slug}`) : error; } finally { await ctx.fs.rm(tmp, { force: true }); }
  return { slug: input.slug, path: file };
}

/**
 * Set and/or remove frontmatter keys of a pending card, atomically, leaving the body untouched.
 * @param {string} project absolute project root
 * @param {string} slug card slug
 * @param {{set?: Record<string, unknown>, remove?: string[]}} edits
 * @param {object} [deps] see `resolveDeps`
 * @returns {Promise<object>} the re-read card model
 */
export async function updateCard(project, slug, edits, deps = {}) {
  const ctx = resolveDeps(deps);
  if (!SLUG_RE.test(slug)) throw fail("INVALID_INPUT", `invalid card slug: ${slug}`);
  const file = path.join(cardPaths(project).pending, `${slug}.md`);
  const raw = await readRegular(ctx.fs, file);
  if (raw === null) throw fail("INVALID_INPUT", `card not found: ${slug}`);
  await guardWrite(ctx, file);
  const mode = (await ctx.fs.lstat(file)).mode & 0o777;
  const next = updateFrontmatter(raw, edits);
  if (next !== raw) await atomicWrite(ctx.fs, file, next, mode);
  return parseCardText(next, { slug });
}

/**
 * `start --run`: the run takes the card. Sets `status: building`, `run_id` and stamps `engine: v2`. Idempotent for the
 * same run; refuses a card that is done, discarded, closing or owned by another run.
 * @param {string} project absolute project root
 * @param {string} slug card slug
 * @param {{runId: string}} opts
 * @param {object} [deps] see `resolveDeps`
 * @returns {Promise<object>} the updated card model
 */
export async function markCardBuilding(project, slug, { runId }, deps = {}) {
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(runId ?? "")) throw fail("INVALID_INPUT", `invalid run id: ${runId}`);
  const card = await readCard(project, slug, {}, deps);
  if (!card) throw fail("INVALID_INPUT", `card not found: ${slug}`);
  const owned = card.status === "building" && card.run_id === runId;
  if (!owned && !["ready", "draft"].includes(card.status)) throw fail("INVALID_STATE", `card ${slug} is ${card.status || "unreadable"}, not buildable`);
  return updateCard(project, slug, { set: { status: "building", run_id: runId, engine: "v2" } }, deps);
}

/**
 * Record the docs-before commit of a card (D17).
 * @param {string} project absolute project root
 * @param {string} slug card slug
 * @param {string} sha the `Change-Docs:` commit
 * @param {object} [deps] see `resolveDeps`
 */
export async function setCardDocsSha(project, slug, sha, deps = {}) {
  if (!SHA_RE.test(sha ?? "")) throw fail("INVALID_INPUT", `invalid sha: ${sha}`);
  return updateCard(project, slug, { set: { docs_sha: sha } }, deps);
}

/**
 * A failed, stopped or abandoned build returns the card to `ready` with a note (BUILD-8).
 * @param {string} project absolute project root
 * @param {string} slug card slug
 * @param {string} note why it was reopened (English, one line)
 * @param {object} [deps] see `resolveDeps`
 */
export async function resetCardReady(project, slug, note, deps = {}) {
  return updateCard(project, slug, { set: { status: "ready", note }, remove: ["run_id"] }, deps);
}

/**
 * D18 decision for a `building` card at `start --run`/`--resume`.
 * @param {{v1: boolean, engine: string, run_id: string}} card a card model
 * @param {{runId: string, otherRunStatus?: string|null}} ctx `runId` = the run being started or resumed;
 *   `otherRunStatus` = `state.status` of the card's own run when it is a different run (`null` = no record of it)
 * @returns {{action: "resume"|"reset_ready"|"leave"|"reconcile_v1"|"unknown", reason: string}}
 */
export function buildingCardAction(card, { runId, otherRunStatus = null }) {
  if (card.engine === "v2") {
    if (card.run_id === runId) return { action: "resume", reason: "v2 card of this run" };
    if (otherRunStatus === null || otherRunStatus === "finished") return { action: "reset_ready", reason: "v2 card of another, terminal run" };
    return { action: "leave", reason: `v2 card of run ${card.run_id}, which is ${otherRunStatus}` };
  }
  if (card.v1) return { action: "reconcile_v1", reason: "default-engine card (integration_transaction): build-state.mjs reconcileBuildingChange" };
  return { action: "unknown", reason: "building card owned by neither engine" };
}

/**
 * Archive a completed card (PLAN 3.16 A3), idempotent and never an error:
 * a pending card gets `status: done` + `shipped_sha` and moves to `done/`; a card already in `done/` (the DR-147
 * reconciler moved it) only gets `shipped_sha` when it has none; a missing card yields a `note` for the journal.
 * @param {string} project absolute project root
 * @param {{slug: string, sha: string}} input the landed commit that completes the card
 * @param {object} [deps] see `resolveDeps`
 * @returns {Promise<{action: "archived"|"stamped"|"already_archived"|"missing"|"conflict", path: string|null, note: string|null}>}
 */
export async function archiveCard(project, { slug, sha }, deps = {}) {
  const ctx = resolveDeps(deps);
  if (!SLUG_RE.test(slug ?? "")) throw fail("INVALID_INPUT", `invalid card slug: ${slug}`);
  if (!SHA_RE.test(sha ?? "")) throw fail("INVALID_INPUT", `invalid sha: ${sha}`);
  const dirs = cardPaths(project);
  const src = path.join(dirs.pending, `${slug}.md`);
  const dst = path.join(dirs.done, `${slug}.md`);
  const [pendingRaw, doneRaw] = [await readRegular(ctx.fs, src), await readRegular(ctx.fs, dst)];
  if (pendingRaw !== null && doneRaw !== null) {
    return { action: "conflict", path: null, note: `card ${slug} exists in changes/ and changes/done/; left untouched` };
  }
  if (pendingRaw !== null) {
    await guardWrite(ctx, src);
    await ensureRealDir(ctx.fs, dirs.done, { create: true });
    const mode = (await ctx.fs.lstat(src)).mode & 0o777;
    await atomicWrite(ctx.fs, src, updateFrontmatter(pendingRaw, { set: { status: "done", shipped_sha: sha } }), mode);
    await ctx.fs.rename(src, dst);
    return { action: "archived", path: dst, note: null };
  }
  if (doneRaw === null) return { action: "missing", path: null, note: `card ${slug} not found in changes/ or changes/done/` };
  if (parseCardText(doneRaw, { slug, source: "done" }).shipped_sha !== "") return { action: "already_archived", path: dst, note: null };
  await guardWrite(ctx, dst);
  await atomicWrite(ctx.fs, dst, updateFrontmatter(doneRaw, { set: { shipped_sha: sha } }), (await ctx.fs.lstat(dst)).mode & 0o777);
  return { action: "stamped", path: dst, note: null };
}
