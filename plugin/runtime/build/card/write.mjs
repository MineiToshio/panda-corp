// card/write.mjs: card creation and frontmatter updates (atomic, guarded against git-tracked cards).
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fail, resolveDeps, SLUG_RE } from "./common.mjs";
import { updateFrontmatter, serializeValue } from "./frontmatter.mjs";
import { cardPaths, parseCardText } from "./parse.mjs";
import { checkCardText, lstatOrNull, readRegular } from "./read.mjs";

export async function atomicWrite(fs, file, data, mode = 0o644) {
  const tmp = `${file}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  try {
    await fs.writeFile(tmp, data, { mode });
    await fs.rename(tmp, file);
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
}

export async function guardWrite(ctx, file) {
  if (ctx.isTracked && (await ctx.isTracked(file))) {
    throw fail("INVALID_PATH", `card is git-tracked, write it through the integration worktree: ${path.basename(file)}`);
  }
}

export async function ensureRealDir(fs, dir, { create = false } = {}) {
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
