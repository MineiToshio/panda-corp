/** Set overrides before server boot: config.ts derives its exported paths at import time. */
/** Canonical environment variable names (private, never NEXT_PUBLIC). */
export const ENV = {
  PANDACORP_FACTORY_ROOT: "PANDACORP_FACTORY_ROOT",
  PANDACORP_EVENTS_FILE: "PANDACORP_EVENTS_FILE",
  PANDACORP_CODEX_EVENTS_FILE: "PANDACORP_CODEX_EVENTS_FILE",
  PANDACORP_ACCOUNTS_FILE: "PANDACORP_ACCOUNTS_FILE",
  PANDACORP_CODEX_PLUGIN_ROOT: "PANDACORP_CODEX_PLUGIN_ROOT",
  MC_CLOCK: "MC_CLOCK",
  MC_GIT_FIXTURE: "MC_GIT_FIXTURE",
} as const;
/** Resolve OS home, preferring HOME over Windows USERPROFILE. */
export function resolveHomeDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) throw new Error("Set HOME or USERPROFILE before starting Mission Control");
  return home;
}
