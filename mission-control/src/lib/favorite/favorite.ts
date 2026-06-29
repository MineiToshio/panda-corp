/**
 * setFavorite — mark / unmark an idea card as a favourite (visual-only flag).
 *
 * A third human-triggered, single-field write (ADR-0003), beside the discard/restore
 * status writes. It rewrites exactly one frontmatter field (`favorite`) of one idea card
 * and preserves the body + all other fields verbatim. The flag is purely visual — it does
 * NOT change the card `status`, its board column, or any pipeline flow (FRD-02 REQ-02-012);
 * it just lets the owner highlight the cards/projects they care about, in ANY column.
 *
 * Frontmatter shape: `favorite: true` when marked; the key is REMOVED when unmarked, so a
 * non-favourite card stays byte-clean (no `favorite: false` noise) — same discipline as the
 * optional `discard_reason`.
 *
 * Traceability:
 *   AC-02-012.1 — WHEN the owner marks a card as favourite, the system SHALL write
 *                 `favorite: true` in the `.md` frontmatter, preserving the rest of the file.
 *   AC-02-012.2 — WHEN the owner unmarks it, the system SHALL remove the `favorite` field.
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { resolveFactoryRoot } from "../config/config";

export type FavoriteResult =
  | { ok: true; favorite: boolean }
  | { ok: false; reason: "not-found" | "parse-error" };

/**
 * Set (or clear) the `favorite` flag on the idea card identified by `slug`.
 *
 * @param slug     - The idea slug (filename without `.md`). An empty slug or one that escapes
 *                   the ideas directory (path traversal) returns `{ ok: false, reason: "not-found" }`.
 * @param favorite - The desired state. `true` writes `favorite: true`; `false` removes the field.
 * @param ideasDir - Optional explicit ideas directory (tests). Defaults to the factory ideas dir
 *                   (`PANDACORP_FACTORY_ROOT`-derived, resolved at call-time).
 * @returns `{ ok: true, favorite }` on success (idempotent); `{ ok: false, reason }` on failure
 *          (file left untouched).
 */
export function setFavorite(slug: string, favorite: boolean, ideasDir?: string): FavoriteResult {
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

  // Write only the one field we own. `true` sets it; `false` removes it so the card stays clean.
  if (favorite) {
    parsed.data.favorite = true;
  } else {
    delete parsed.data.favorite;
  }

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

  return { ok: true, favorite };
}
