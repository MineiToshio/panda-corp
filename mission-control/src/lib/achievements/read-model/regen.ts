/**
 * lib/achievements/read-model/regen.ts — the universal regeneration trigger (FRD-23, WO-23-004).
 *
 * The Informe mixes sources from MANY skills, so its write cannot depend on `/implement` closing
 * (FRD-23 §4). Since every change that affects the Informe ends in a COMMIT, the commit is the
 * correct universal trigger — the Claude Code Stop hook and/or a git `post-commit` hook call
 * `regenerateForCommit(projectPath)` for the affected project(s). This covers every path: direct
 * hand edits, ideas/decisions/phase moves, single-FRD builds, "nobody regenerated yet".
 *
 * Platform golden rule (architecture §1): factory tooling — invoked by the hooks / the CLI in
 * `scripts/`, NOT the MC render path. It delegates the derivation to the single writer
 * (`writeStatsPortada`, WO-23-002, DR-115) — it NEVER re-implements a number.
 *
 * Degrade honestly (resilience + DR-078): a `PortadaDeriveError` (git unavailable / a non-`ok`
 * source) does NOT abort the commit — the hook returns a non-`ok` outcome and the reader's live-git
 * fallback covers the gap at read time. A genuinely UNEXPECTED error is re-thrown (never swallowed).
 */

import { PortadaDeriveError, writeStatsPortada } from "./statsWriter";

/** The outcome of a regeneration call — a written path, or an explicit degrade reason. */
export type RegenOutcome =
  | { readonly ok: true; readonly written: string }
  | { readonly ok: false; readonly reason: string };

/** Injectable dependencies (the writer is defaulted; overridable for unit tests). */
export type RegenDeps = {
  /** Writes the project's portada, returning its path or throwing `PortadaDeriveError`. */
  readonly writePortada: (projectPath: string) => string;
};

/**
 * Regenerate one project's materialized portada at its universal write point (a commit).
 *
 * The trigger hook (Stop / `post-commit`) calls this for the affected project. On success it returns
 * the written path; when the portada could not be derived from git (a `PortadaDeriveError`) it
 * DEGRADES honestly — returns `{ ok: false, reason }` so the hook does NOT abort the commit (the
 * reader's live-git fallback keeps the Informe correct, just slower). Any OTHER error is genuinely
 * unexpected and re-thrown (never swallowed — error-handling rule).
 *
 * @param projectPath - Absolute path to the committed project's git work-tree.
 * @param deps        - Injectable writer (defaults to the single `writeStatsPortada`).
 * @returns The regeneration outcome the hook reports (never throws on a derive failure).
 */
export function regenerateForCommit(
  projectPath: string,
  deps: RegenDeps = { writePortada: (p) => writeStatsPortada(p) },
): RegenOutcome {
  try {
    return { ok: true, written: deps.writePortada(projectPath) };
  } catch (error) {
    if (error instanceof PortadaDeriveError) {
      return { ok: false, reason: error.message };
    }
    // Genuinely unexpected (permissions, disk) — surface it, never swallow it.
    throw error;
  }
}
