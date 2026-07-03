import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { resolveFactoryRoot } from "../config/config";

/**
 * lib/backlog/discard-backlog.ts — `discardBacklogItem` (FRD-22, REQ-22-007).
 *
 * One of Mission Control's small, bounded set of writes (architecture §1/§7, ADR-0002):
 * mirrors `lib/changes/discard-change.ts` exactly, scoped instead to the factory-wide
 * `factory/backlog/BL-*.md` queue. Rewrites exactly one frontmatter field —
 * `status: discarded` — of one backlog item, preserving the body and all other
 * frontmatter fields verbatim. Only `open`/`doing` items may be discarded; a `done`
 * (already closed) or already-`discarded` item is refused (`not-discardable`).
 *
 * Unlike the changes queue (filename === id), a backlog filename is `<id>-<slug>.md`,
 * so the target file is located by filename prefix rather than direct construction —
 * this also means an id that cannot match any real filename (e.g. path traversal)
 * naturally resolves to `not-found` without a separate guard.
 *
 * Traceability:
 *   AC-22-007.1  WHEN the owner discards an open/doing backlog item, the system SHALL
 *                rewrite `status: discarded` in the `.md` frontmatter, preserving the
 *                rest of the file, and record `status_before_discard`.
 *   AC-22-007.2  WHEN the item is `done` or already `discarded`, the system SHALL
 *                refuse the write (`not-discardable`) rather than silently no-op.
 */

export type DiscardBacklogResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "parse-error" | "not-discardable" };

/** Resolve the backlog directory from the factory root at call time. */
function backlogDir(): string {
  return path.join(resolveFactoryRoot(), "factory", "backlog");
}

/** Locate the `BL-*.md` file for `id` (filename is `<id>-<slug>.md` or `<id>.md`). */
function findBacklogFile(dir: string, id: string): string | null {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const match = entries.find((f) => f === `${id}.md` || f.startsWith(`${id}-`));
  return match !== undefined ? path.join(dir, match) : null;
}

/**
 * Rewrite `status: discarded` in the frontmatter of the backlog item identified by
 * `id`, preserving the body and all other frontmatter fields verbatim.
 *
 * @param id - The item's `id` field (e.g. `"BL-0007"`), not the filename.
 * @returns `{ ok: true }` on success.
 *          `{ ok: false, reason: "not-found" }` when no file matches `id`.
 *          `{ ok: false, reason: "parse-error" }` when the matched file cannot be
 *          parsed; the file is left untouched.
 *          `{ ok: false, reason: "not-discardable" }` when the item's current status
 *          is `done` or already `discarded`; the file is left untouched.
 */
export function discardBacklogItem(id: string): DiscardBacklogResult {
  if (id === "") {
    return { ok: false, reason: "not-found" };
  }

  const filePath = findBacklogFile(backlogDir(), id);
  if (filePath === null) {
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
  if (priorStatus !== "open" && priorStatus !== "doing") {
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
