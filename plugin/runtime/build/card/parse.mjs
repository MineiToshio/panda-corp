// card/parse.mjs: card references, queue paths and the card text model (never throws on bad content).
import { readFileSync } from "node:fs";
import path from "node:path";
import { validate } from "../fsx.mjs";
import { SCHEMAS_DIR } from "../paths.mjs";
import {
  CARD_CLASSES, CARD_STATUSES, CARD_TYPES, CITATION_RE, FRD_RE, SLUG_RE, V1_ONLY_KEYS,
} from "./common.mjs";
import { asList, asText, parseYamlSubset, splitFrontmatter } from "./yaml.mjs";

// The schema is the type truth of the frontmatter (card-frontmatter.schema.json); read once, self-located.
const CARD_SCHEMA = JSON.parse(readFileSync(path.join(SCHEMAS_DIR, "card-frontmatter.schema.json"), "utf8"));

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
