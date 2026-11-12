// card/read.mjs: reading, listing and checking cards of the queue (read-only).
import path from "node:path";
import { fail, resolveDeps, SLUG_RE } from "./common.mjs";
import { cardPaths, parseCardText } from "./parse.mjs";

export async function lstatOrNull(fs, file) {
  try { return await fs.lstat(file); } catch (error) { if (error?.code === "ENOENT") return null; throw error; }
}

export async function readRegular(fs, file) {
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
