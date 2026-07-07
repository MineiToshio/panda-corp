/**
 * lib/achievements/read-model/factorySeal.ts — the factory-wide freshness seal (FRD-23, WO-23-005, REQ-23-006.2).
 *
 * The factory-scoped store (`stats-factory.json`) holds factory-wide facts (`phaseTransitions`,
 * `scalars.{projects,decisions}`, `lessons`) whose truth depends on routes NO per-project seal
 * watches. This seal is the hash of the last commit touching ALL of them: `factory/portfolio.md`,
 * `factory/decisions/`, `factory/memory/` and EVERY project's `.pandacorp/status.yaml`. A change to
 * any of these routes (e.g. a phase change in project B) mismatches the seal and the store is
 * treated stale — the exact cross-project defect the SSOT split fixes (DR-115/DR-116, AC-23-006.2).
 *
 * Platform golden rule (architecture §1): read-only. Git access via `execSync`, scoped to those
 * pathspecs, `-1`-capped (the phaseTransitions.ts / seal.ts pattern). Equality only, never ordered —
 * a seal is a commit hash, not an orderable timestamp (LESSON-0009's ordering hazard does not apply).
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { resolveProjectPath } from "../../config/config";
import { readPortfolio } from "../../portfolio/portfolio";
import type { StatsFactory } from "./statsSchema";

/** The factory-wide pathspecs (relative to the factory root) whose last-touching commit is the seal. */
const FACTORY_PATHSPECS: readonly string[] = [
  "factory/portfolio.md",
  "factory/decisions",
  "factory/memory",
];

/** Status.yaml path relative to a project repo root — the per-project route the factory seal also watches. */
const STATUS_REL_PATH = path.join(".pandacorp", "status.yaml");

/**
 * Collect the `.pandacorp/status.yaml` pathspecs of every portfolio project that lives INSIDE the
 * factory git repo, RELATIVE to the factory root (so a single `git log` in the factory repo scopes
 * to them). Projects in sibling repos (their status.yaml escapes the factory root with a leading
 * `..`) are excluded here — their git history is a DIFFERENT repo, unreachable from the factory's
 * `git log`; watching them requires the per-project seal / their own trigger, not this one. Only
 * existing, in-repo files are included — a phantom or escaping pathspec would make `git log` error
 * (→ a null seal → the store falsely treated stale). Placeholder cells ("—"/"-"/"") are skipped.
 */
function projectStatusPathspecs(factoryRoot: string): readonly string[] {
  const specs: string[] = [];
  for (const entry of readPortfolio()) {
    const rawPath = entry.path;
    if (!rawPath || rawPath.trim() === "" || rawPath === "—" || rawPath === "-") continue;
    const projectRoot = resolveProjectPath(rawPath);
    const statusAbs = path.join(projectRoot, STATUS_REL_PATH);
    if (!fs.existsSync(statusAbs)) continue;
    const rel = path.relative(factoryRoot, statusAbs);
    // Escapes the factory repo (sibling repo) → not in the factory's git history; skip.
    if (rel.startsWith("..") || path.isAbsolute(rel)) continue;
    specs.push(rel);
  }
  return specs;
}

/**
 * The current factory-wide git seal: the hash of the last commit touching the factory-wide routes
 * (`portfolio.md` + `decisions/` + `memory/`) OR any project's `.pandacorp/status.yaml`, or `null`
 * when git is unavailable / no route exists.
 *
 * `null` is an explicit "cannot compute a factory seal" — the store can never be judged fresh
 * against it, so the caller falls back to the live `derive*` cores (never treats it as a match).
 * Request-deduped via `React.cache` (one git call per factory root per render, DR-092).
 *
 * @param factoryRoot - Absolute path to the factory repo root (the git work-tree the seal is read in).
 * @returns The 40-char commit hash, or `null` when no seal can be computed.
 */
export const currentFactorySeal: (factoryRoot: string) => string | null = cache(
  (factoryRoot: string): string | null => {
    const pathspecs = [...FACTORY_PATHSPECS, ...projectStatusPathspecs(factoryRoot)];
    const quoted = pathspecs.map((spec) => `"${spec}"`).join(" ");
    let out = "";
    try {
      out = execSync(`git log -1 --format=%H -- ${quoted}`, {
        cwd: factoryRoot,
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
 * True when a factory store's stored seal equals the factory's current git seal (fresh).
 *
 * A `null` current seal (git unavailable) is NEVER fresh — the store cannot be validated, so the
 * caller must fall back. Equality only (seals are commit hashes, not orderable timestamps —
 * LESSON-0009).
 *
 * @param store - The parsed factory store carrying its stored `seal`.
 * @param seal  - The factory's current git seal (`currentFactorySeal`), or `null`.
 * @returns Whether the store is fresh for the current git state.
 */
export function isFactoryFresh(store: StatsFactory, seal: string | null): boolean {
  return seal !== null && store.seal === seal;
}
