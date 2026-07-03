import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * lib/changes/discard-change.ts — `discardChange` (FRD-04, REQ-04-008).
 *
 * One of Mission Control's small, bounded set of writes (architecture §1/§7, ADR-0002):
 * mirrors `lib/discard/discard.ts` (the idea-card discard write) exactly, scoped instead
 * to a project's `.pandacorp/inbox/changes/` queue. Rewrites exactly one frontmatter
 * field — `status: discarded` — of one change-queue item, preserving the body and all
 * other frontmatter fields verbatim. Only `ready`/`draft` items may be discarded; a
 * `done` (already shipped) or already-`discarded` item is refused (`not-discardable`).
 *
 * Unlike `done/` (the build engine's own archival move, DR-069), a discarded item stays
 * in place — no file move — so a future restore only needs to flip `status` back.
 *
 * Traceability:
 *   AC-04-008.1  WHEN the owner discards a ready/draft change, the system SHALL rewrite
 *                `status: discarded` in the `.md` frontmatter, preserving the rest of
 *                the file, and record `status_before_discard` for a future restore.
 *   AC-04-008.2  WHEN the item is `done` or already `discarded`, the system SHALL refuse
 *                the write (`not-discardable`) rather than silently no-op.
 */

export type DiscardChangeResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "parse-error" | "not-discardable" };

/**
 * Rewrite `status: discarded` in the frontmatter of the change-queue item identified
 * by `id`, preserving the body and all other frontmatter fields verbatim.
 *
 * @param projectPath - Absolute path to the project root (same resolved path
 *                      `readChangeQueue` receives).
 * @param id          - The change's slug (filename without `.md`). Must not be empty
 *                      and must not escape the active changes directory via path
 *                      traversal — any id that resolves outside it returns
 *                      `{ ok: false, reason: "not-found" }`.
 * @returns `{ ok: true }` on success.
 *          `{ ok: false, reason: "not-found" }` when the file is absent (including a
 *          `done/`-archived item — only the active queue is ever discardable) or the
 *          id escapes the directory.
 *          `{ ok: false, reason: "parse-error" }` when the file cannot be parsed; the
 *          file is left untouched.
 *          `{ ok: false, reason: "not-discardable" }` when the item's current status is
 *          `done` or already `discarded`; the file is left untouched.
 */
export function discardChange(projectPath: string, id: string): DiscardChangeResult {
  const dir = path.join(projectPath, ".pandacorp", "inbox", "changes");

  // Guard: empty id → not-found immediately (no fs access).
  if (id === "") {
    return { ok: false, reason: "not-found" };
  }

  const filePath = path.join(dir, `${id}.md`);

  // Guard: path traversal — the resolved path must stay inside `dir`.
  const normalizedDir = path.resolve(dir);
  const normalizedFile = path.resolve(filePath);
  if (!normalizedFile.startsWith(normalizedDir + path.sep)) {
    return { ok: false, reason: "not-found" };
  }

  // Guard: file must exist as a regular file — lstatSync (not statSync) so a symlink
  // is rejected outright rather than followed (write-isolation invariant).
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(filePath);
  } catch {
    return { ok: false, reason: "not-found" };
  }
  if (!stat.isFile()) {
    return { ok: false, reason: "not-found" };
  }

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return { ok: false, reason: "not-found" };
  }

  // { excerpt: false } bypasses gray-matter's content-keyed cache (a stale empty
  // object after a prior malformed parse in the same process — regression 2026-06-16).
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw, { excerpt: false });
  } catch {
    return { ok: false, reason: "parse-error" };
  }

  const priorStatus = parsed.data.status;
  if (priorStatus !== "ready" && priorStatus !== "draft") {
    // Already discarded, done, or an unrecognised status — never silently discard.
    return { ok: false, reason: "not-discardable" };
  }

  // Record whether the original body ended with a newline before mutating anything.
  const bodyEndedWithNewline = parsed.content.endsWith("\n");

  parsed.data.status_before_discard = priorStatus;
  parsed.data.status = "discarded";

  let serialized: string;
  try {
    serialized = matter.stringify(parsed.content, parsed.data);
  } catch {
    return { ok: false, reason: "parse-error" };
  }

  if (!bodyEndedWithNewline && serialized.endsWith("\n")) {
    serialized = serialized.slice(0, -1);
  }

  fs.writeFileSync(filePath, serialized, "utf-8");

  return { ok: true };
}
