/**
 * restoreIdea — "Volver a agregar" (un-discard) write.
 *
 * The board has two human-triggered, single-field status writes: `discardIdea`
 * (status → discarded, + discard_reason) and this one, its inverse. Both live in the discard
 * layer; together with `lib/favorite/setFavorite` (the visual favourite flag, ADR-0003) they are
 * the app's small, bounded set of writes (architecture §1/§7; ADR-0002 widened the original single
 * write — see docs/decision-log.md). Like discard, this rewrites one card's frontmatter and
 * preserves the body + all other fields verbatim.
 *
 * Behaviour: returns the card to the status it had BEFORE it was discarded
 * (`status_before_discard`, fallback `discovered`), and clears the now-stale
 * `status_before_discard` + `discard_reason` fields.
 *
 * Traceability:
 *   AC-02-007.3 — WHEN the owner presses "Volver a agregar" on a discarded card, the system
 *                 SHALL restore its prior status and clear discard_reason / status_before_discard.
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { resolveFactoryRoot } from "../config/config";

export type RestoreResult =
  | { ok: true; restoredTo: string }
  | { ok: false; reason: "not-found" | "parse-error" };

/** Statuses a card may be restored to (never "discarded"). */
const RESTORABLE_FALLBACK = "discovered";
const VALID_PRIOR = new Set(["discovered", "recommended", "in-pipeline", "shipped"]);

/**
 * Restore (un-discard) the idea card identified by `slug`.
 *
 * @param slug     - The idea slug (filename without `.md`).
 * @param ideasDir - Optional explicit ideas directory (tests). Defaults to the factory ideas dir.
 * @returns `{ ok: true, restoredTo }` on success; `{ ok: false, reason }` on failure (file untouched).
 */
export function restoreIdea(slug: string, ideasDir?: string): RestoreResult {
  const dir = ideasDir ?? path.join(resolveFactoryRoot(), "factory", "ideas");

  if (slug === "") {
    return { ok: false, reason: "not-found" };
  }

  const filePath = path.join(dir, `${slug}.md`);

  // Path-traversal guard — the resolved file must stay inside the ideas dir.
  const normalizedDir = path.resolve(dir);
  const normalizedFile = path.resolve(filePath);
  if (!normalizedFile.startsWith(normalizedDir + path.sep)) {
    return { ok: false, reason: "not-found" };
  }

  // Must be a regular file (reject symlinks/dirs — write-isolation invariant).
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

  // Pass an option so gray-matter skips its content-keyed cache (see discard.ts).
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw, { excerpt: false });
  } catch {
    return { ok: false, reason: "parse-error" };
  }

  const bodyEndedWithNewline = parsed.content.endsWith("\n");

  // Resolve the status to restore to: the recorded prior status if valid, else "discovered".
  const prior = parsed.data.status_before_discard;
  const restoredTo =
    typeof prior === "string" && VALID_PRIOR.has(prior) ? prior : RESTORABLE_FALLBACK;

  parsed.data.status = restoredTo;
  // Clear the now-stale discard bookkeeping.
  delete parsed.data.status_before_discard;
  delete parsed.data.discard_reason;

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

  return { ok: true, restoredTo };
}
