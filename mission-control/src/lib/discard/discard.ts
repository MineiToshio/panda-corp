/**
 * WO-02-004 — `discardIdea` (CMP-02-discard, IF-02-discardIdea)
 *
 * The ONLY `fs.write` in the entire Mission Control codebase (architecture §1/§7).
 * Rewrites exactly one frontmatter field (`status: discarded`) of one idea card,
 * preserving the body and all other frontmatter fields verbatim.
 *
 * Traceability:
 *   AC-02-007.1  WHEN the owner presses "Discard idea", the system SHALL rewrite
 *                `status: discarded` in the `.md` frontmatter, preserving the rest
 *                of the file (Pandacorp's only write).
 *
 * Regression anchors:
 *   B1' (2026-06-16): numeric frontmatter fields (score etc.) must not be corrupted
 *     to NaN or dropped — gray-matter.stringify preserves all field types verbatim.
 *   I2  (2026-06-16): object-valued frontmatter fields must not be emptied vacuously.
 *   I3  (2026-06-16): array-valued frontmatter fields must not be coerced.
 *   B-2 (2026-06-16, layout.guard.test): write-isolation invariant — only the targeted
 *     card is written; no sibling files are touched.
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { resolveFactoryRoot } from "../config/config";

export type DiscardResult = { ok: true } | { ok: false; reason: "not-found" | "parse-error" };

/**
 * Rewrite `status: discarded` in the frontmatter of the idea card identified by `slug`,
 * preserving the body and all other frontmatter fields verbatim.
 *
 * This is the single write in the whole codebase. It touches exactly one field of one file.
 * Invoked only through the Server Action `app/board/actions.ts` (human-triggered, REQ-02-007).
 *
 * @param slug      - The idea slug (filename without `.md`). Must not be empty and must not
 *                    escape the `ideasDir` via path traversal. Any slug that resolves outside
 *                    the ideas directory returns `{ ok: false, reason: "not-found" }`.
 * @param ideasDir  - Optional. Explicit ideas directory path (used by tests). Defaults to
 *                    `config.IDEAS_DIR` (derived from `PANDACORP_FACTORY_ROOT` at call-time).
 * @returns `{ ok: true }` on success (including idempotent repeat on already-discarded card).
 *          `{ ok: false, reason: "not-found" }` when the file is absent or the slug escapes the dir.
 *          `{ ok: false, reason: "parse-error" }` when the file cannot be parsed; file is left untouched.
 */
export function discardIdea(slug: string, ideasDir?: string): DiscardResult {
  // Resolve the ideas directory at call-time (respects PANDACORP_FACTORY_ROOT env swaps in tests).
  const dir = ideasDir ?? path.join(resolveFactoryRoot(), "factory", "ideas");

  // Guard: empty slug → not-found immediately (no fs access).
  if (slug === "") {
    return { ok: false, reason: "not-found" };
  }

  // Resolve the candidate file path.
  const filePath = path.join(dir, `${slug}.md`);

  // Guard: path traversal — if the resolved path does not start with `dir/` (or equal `dir`),
  // the slug escaped the ideas directory; treat as not-found, never access the path.
  const normalizedDir = path.resolve(dir);
  const normalizedFile = path.resolve(filePath);
  if (!normalizedFile.startsWith(normalizedDir + path.sep)) {
    return { ok: false, reason: "not-found" };
  }

  // Guard: file must exist as a regular file (not a directory, not a symlink, not missing).
  // Use lstatSync (not statSync) so we check the entry itself, never the symlink target.
  // A symlink that points outside the ideas dir would pass the path-traversal check above
  // (because the link itself is inside the dir) but following it on write would violate
  // write-isolation — we reject symlinks unconditionally.
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(filePath);
  } catch {
    return { ok: false, reason: "not-found" };
  }

  if (!stat.isFile()) {
    // Directory, symlink, or other non-regular entry → not-found (write-isolation invariant).
    return { ok: false, reason: "not-found" };
  }

  // Read the raw file content.
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return { ok: false, reason: "not-found" };
  }

  // Parse with gray-matter.
  //
  // IMPORTANT: gray-matter maintains an internal cache keyed by raw file content.
  // When the same malformed content is parsed twice in the same process (e.g. a test
  // suite calling discardIdea twice with the same fixture content), the second call
  // returns a cached partial result ({data: {}}, no error) instead of throwing.
  //
  // Gray-matter only caches when called with NO options object. Passing any option
  // (even one that doesn't change behavior) skips the cache and forces a fresh parse.
  // `excerpt: false` is the default value, so it's a no-op semantically but typed.
  //
  // Any parse failure leaves the file untouched.
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw, { excerpt: false });
  } catch {
    return { ok: false, reason: "parse-error" };
  }

  // Record whether the original body ended with a newline before we mutate anything.
  // gray-matter.stringify always appends a trailing '\n' to the body in its output.
  // If the original body had no trailing newline, we strip the extra '\n' from the
  // serialized output so that re-parsing the written file yields the identical body
  // string (the test's readBody() asserts byte-for-byte equality on parsed.content).
  const bodyEndedWithNewline = parsed.content.endsWith("\n");

  // Set the single field we are allowed to write.
  // gray-matter.stringify preserves all other frontmatter fields and the body verbatim
  // (B1': numbers stay numbers; I2: objects stay objects; I3: arrays stay arrays).
  parsed.data.status = "discarded";

  // Re-serialize: gray-matter.stringify(content, data) where content is the markdown body.
  let serialized: string;
  try {
    serialized = matter.stringify(parsed.content, parsed.data);
  } catch {
    return { ok: false, reason: "parse-error" };
  }

  // If the original body had no trailing newline, strip the one that matter.stringify added
  // so the re-parsed body is byte-for-byte identical to the original.
  if (!bodyEndedWithNewline && serialized.endsWith("\n")) {
    serialized = serialized.slice(0, -1);
  }

  // Write — the ONLY fs.write call in the codebase. Targets exactly one file.
  fs.writeFileSync(filePath, serialized, "utf-8");

  return { ok: true };
}
