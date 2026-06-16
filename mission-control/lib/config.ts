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

/** The root of the factory repo (the folder that contains `mission-control/`). */
export const FACTORY_ROOT: string = resolveFactoryRoot();

/** Idea base: `factory/ideas/*.md` (ignore `_idea-template.md` and `decision-log.md`). */
export const IDEAS_DIR: string = path.join(FACTORY_ROOT, "factory", "ideas");

/** Owner profile (FRD-01 onboarding gate keys off its absence). */
export const PROFILE: string = path.join(FACTORY_ROOT, "factory", "profile.md");

/** Portfolio index of created projects (rows → project paths). */
export const PORTFOLIO: string = path.join(FACTORY_ROOT, "factory", "portfolio.md");

/** Decision registry (read-only; surfaced in Configuration / Manual). */
export const DECISIONS_REGISTRY: string = path.join(
  FACTORY_ROOT,
  "factory",
  "decisions",
  "registry.yaml",
);

/** Engineering standards directory (read-only; surfaced in Configuration / Manual). */
export const STANDARDS_DIR: string = path.join(FACTORY_ROOT, "factory", "standards");

/** Cross-project engineering memory (lessons, candidates) for FRD-17. */
export const MEMORY_DIR: string = path.join(FACTORY_ROOT, "factory", "memory");

/** Plugin source (skills + agents) — read-only, for the Manual's derived Reference (FRD-08). */
export const PLUGIN_DIR: string = path.join(FACTORY_ROOT, "plugin");
export const PLUGIN_SKILLS_DIR: string = path.join(PLUGIN_DIR, "skills");
export const PLUGIN_AGENTS_DIR: string = path.join(PLUGIN_DIR, "agents");

/** Installed-plugin manifest in the user's Claude install (FRD-15 drift check). */
export const INSTALLED_PLUGINS_JSON: string = path.join(
  homeDir(),
  ".claude",
  "plugins",
  "installed_plugins.json",
);

/** The factory's live event stream (FRD-06 Party / FRD-12 / FRD-18 digest). */
export const EVENTS_NDJSON: string = path.join(homeDir(), ".claude", "dashboard-events.ndjson");

/** The build task state directory (FRD-06 Party). */
export const TASKS_DIR: string = path.join(homeDir(), ".claude", "tasks");

/** Per-project status file, relative to a project root: `<projectPath>/.pandacorp/status.yaml`. */
export function projectStatusPath(projectPath: string): string {
  return path.join(projectPath, ".pandacorp", "status.yaml");
}

/** Filenames inside `IDEAS_DIR` that are NOT idea cards (FRD-01). */
export const NON_IDEA_FILES: readonly string[] = ["_idea-template.md", "decision-log.md"];

function homeDir(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? "";
}
