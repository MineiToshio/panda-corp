/**
 * lib/achievements/read-model/seal.ts — the self-validating freshness seal (FRD-23, WO-23-001).
 *
 * The seal is the hash of the last commit touching the routes that feed the Informe:
 * `git log -1 --format=%H -- docs/frds .pandacorp/status.yaml` (O(1), ~2 ms). On read, MC
 * compares a portada's stored seal against the project's CURRENT seal: match → the portada is
 * fresh; mismatch → stale → fall back to live git. Correctness never depends on any particular
 * writer having run — the seal decides (DR-115 honest-cache).
 *
 * Platform golden rule (architecture §1): read-only. Git access via `execSync`, scoped to the
 * two pathspecs, `-1`-capped (the phaseTransitions.ts pattern).
 */

import { execSync } from "node:child_process";
import { cache } from "react";
import type { StatsPortada } from "./statsSchema";

/** The pathspecs whose last-touching commit defines the Informe's freshness seal. */
const SEAL_PATHSPECS: readonly string[] = ["docs/frds", ".pandacorp/status.yaml"];

/**
 * The current git seal for a project: the hash of the last commit touching the Informe's source
 * paths, or `null` when git is unavailable / the project is not a git work-tree.
 *
 * `null` is an explicit "cannot compute a seal" — a portada can never be judged fresh against it,
 * so the caller falls back to the live git reader (never treats a missing seal as a match).
 * Request-deduped via `React.cache` (one git call per project per render, DR-092).
 *
 * @param projectPath - Absolute path to the project's git work-tree.
 * @returns The 40-char commit hash, or `null` when no seal can be computed.
 */
export const currentSeal: (projectPath: string) => string | null = cache(
  (projectPath: string): string | null => {
    let out = "";
    try {
      out = execSync(`git log -1 --format=%H -- ${SEAL_PATHSPECS.join(" ")}`, {
        cwd: projectPath,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      return null;
    }
    const hash = out.trim();
    return hash === "" ? null : hash;
  },
);

/**
 * True when a portada's stored seal equals the project's current git seal (fresh).
 *
 * A `null` current seal (git unavailable) is NEVER fresh — the portada cannot be validated, so
 * the caller must fall back. Equality only (seals are commit hashes, not orderable timestamps).
 *
 * @param portada - The parsed portada carrying its stored `seal`.
 * @param seal    - The project's current git seal (`currentSeal`), or `null`.
 * @returns Whether the portada is fresh for the current git state.
 */
export function isFresh(portada: StatsPortada, seal: string | null): boolean {
  return seal !== null && portada.seal === seal;
}
