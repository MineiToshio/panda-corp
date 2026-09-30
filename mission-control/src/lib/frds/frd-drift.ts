import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * lib/frds/frd-drift.ts: reader of the `drift:` frontmatter list of a FRD (FRD-12 AC-12-003.3).
 *
 * The build engine's certifying gate landing writes `drift: [AC-…, REQ-…]` into
 * `docs/frds/<frd>/frd.md` when it proved pre-existing drift (DR-122, BL-0178). That key is the
 * ONLY writer-side copy (an honest replica, re-derived at every certifying landing); this module
 * is the ONE reader, so every surface that shows a FRD's drift derives from it (DR-115).
 *
 * Fail-loud read boundary (DR-078): an absent key is an explicit "no drift"; a present key that is
 * not a list of `REQ-NN-MMM` / `AC-NN-MMM(.K)` ids, or frontmatter that cannot be parsed, is a
 * typed error the UI renders as an error state, never a silent `[]`.
 */

/** Why a FRD's drift could not be read. */
type FrdDriftFailure =
  /** No `frd.md` for that folder id (legacy or non-FRD folder): nothing to badge. */
  | { readonly ok: false; readonly reason: "missing" }
  /** The file exists but could not be read. */
  | { readonly ok: false; readonly reason: "unreadable"; readonly detail: string }
  /** The frontmatter or its `drift` value does not have the contract's shape. */
  | { readonly ok: false; readonly reason: "malformed"; readonly detail: string };

/** `ids` is the drift list in file order; empty means the key is absent or the list is empty. */
export type FrdDriftResult =
  | { readonly ok: true; readonly ids: readonly string[] }
  | FrdDriftFailure;

/** The contract-id shape the engine writes (mirrors `plugin/scripts/drift-proof.mjs`). */
const CONTRACT_ID_RE = /^(?:REQ|AC)-\d+-\d+(?:\.\d+)?$/;

/** A FRD folder slug: `frd-NN-<slug>`. Anything else never reaches the filesystem. */
const FRD_FOLDER_RE = /^frd-\d+-[a-z0-9][a-z0-9-]*$/;

/**
 * Parse the `drift:` list out of a FRD markdown document (pure).
 *
 * @param markdown - The raw text of a `frd.md`.
 * @returns The ids in file order, or a `malformed` failure naming the offending value.
 */
export function parseFrdDrift(markdown: string): FrdDriftResult {
  let data: Record<string, unknown>;
  try {
    // { excerpt: false } bypasses gray-matter's content-keyed cache (a first call that threw on bad
    // YAML would otherwise poison repeat parses with an empty `data`).
    data = matter(markdown, { excerpt: false }).data as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "malformed", detail: "frontmatter is not valid YAML" };
  }

  if (!("drift" in data)) return { ok: true, ids: [] };

  const raw = data.drift;
  if (!Array.isArray(raw)) {
    return { ok: false, reason: "malformed", detail: "`drift` must be a list of REQ/AC ids" };
  }
  const bad = raw.find((entry) => typeof entry !== "string" || !CONTRACT_ID_RE.test(entry));
  if (bad !== undefined) {
    return {
      ok: false,
      reason: "malformed",
      detail: `\`drift\` entry ${JSON.stringify(bad)} is not a REQ-NN-MMM / AC-NN-MMM(.K) id`,
    };
  }
  return { ok: true, ids: raw as string[] };
}

/**
 * Read one FRD's drift from `<projectPath>/docs/frds/<frdId>/frd.md`.
 *
 * @param projectPath - Absolute path to the project root.
 * @param frdId       - The FRD folder slug, e.g. `frd-02-ideas-board`.
 * @returns The drift ids, `missing` when there is no frd.md, or an explicit failure.
 */
export function readFrdDrift(projectPath: string, frdId: string): FrdDriftResult {
  if (!FRD_FOLDER_RE.test(frdId)) return { ok: false, reason: "missing" };
  const file = path.join(projectPath, "docs", "frds", frdId, "frd.md");
  if (!fs.existsSync(file)) return { ok: false, reason: "missing" };
  let markdown: string;
  try {
    markdown = fs.readFileSync(file, "utf-8");
  } catch (error) {
    return {
      ok: false,
      reason: "unreadable",
      detail: error instanceof Error ? error.message : "frd.md could not be read",
    };
  }
  return parseFrdDrift(markdown);
}
