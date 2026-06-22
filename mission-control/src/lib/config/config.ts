import path from "node:path";

/**
 * Path configuration for Mission Control's read-only data layer (FRD-01).
 *
 * Mission Control lives INSIDE the factory repo at `panda-corp/mission-control/`
 * (the special in-factory case, see CLAUDE.md). Therefore the factory root is
 * exactly one level up from the process working directory.
 *
 * Override with the `PANDACORP_FACTORY_ROOT` env var (e.g. for tests, or if the
 * app is ever run from a different cwd).
 *
 * Nothing here calls Claude or writes to disk — this only resolves where to READ.
 */

/** Resolve the factory root from the env override or one level up from cwd. */
export function resolveFactoryRoot(
  env: string | undefined = process.env.PANDACORP_FACTORY_ROOT,
  cwd: string = process.cwd(),
): string {
  if (env && env.trim() !== "") {
    return path.resolve(env);
  }
  return path.resolve(cwd, "..");
}

/**
 * Resolve a project path (a portfolio path cell) to an absolute path.
 * Already-absolute → verbatim; relative → joined against the factory root (call-time, env-aware).
 * Lives here (not in the portfolio module) so consumers can resolve a path without importing — and
 * being mocked out by — the portfolio module.
 */
export function resolveProjectPath(rawPath: string): string {
  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }
  return path.join(resolveFactoryRoot(), rawPath);
}

/** The root of the factory repo (the folder that contains `mission-control/`). */
export const FACTORY_ROOT: string = resolveFactoryRoot();

/** Idea base: `factory/ideas/*.md` (ignore `_idea-template.md` and `decision-log.md`). */
export const IDEAS_DIR: string = path.join(FACTORY_ROOT, "factory", "ideas");

/** Owner profile (FRD-01 onboarding gate keys off its absence). */
export const PROFILE: string = path.join(FACTORY_ROOT, "factory", "profile.md");

/** Portfolio index of created projects (rows → project paths). */
export const PORTFOLIO: string = path.join(FACTORY_ROOT, "factory", "portfolio.md");

/** Per-project status file, relative to a project root: `<projectPath>/.pandacorp/status.yaml`. */
export function projectStatusPath(projectPath: string): string {
  return path.join(projectPath, ".pandacorp", "status.yaml");
}

/** Filenames inside `IDEAS_DIR` that are NOT idea cards (FRD-01). */
export const NON_IDEA_FILES: readonly string[] = ["_idea-template.md", "decision-log.md"];
