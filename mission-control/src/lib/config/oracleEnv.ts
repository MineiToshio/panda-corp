import path from "node:path";
import { ENV } from "./env";

/** Build absolute oracle paths without accessing the owner's filesystem. Caller MC_CLOCK wins. */
export function oracleEnv(repoRoot: string): Record<string, string> {
  const fixtures = path.resolve(repoRoot, "docs/design/prototype/fixtures");
  const home = path.join(fixtures, "home");
  return {
    [ENV.PANDACORP_FACTORY_ROOT]: path.join(fixtures, "factory-root"),
    HOME: home,
    USERPROFILE: home,
    [ENV.PANDACORP_EVENTS_FILE]: path.join(home, ".claude/dashboard-events.ndjson"),
    [ENV.PANDACORP_CODEX_EVENTS_FILE]: path.join(home, ".codex/dashboard-events.ndjson"),
    [ENV.PANDACORP_ACCOUNTS_FILE]: path.join(fixtures, "pandacorp-vault/services/accounts.yaml"),
    [ENV.PANDACORP_CODEX_PLUGIN_ROOT]: path.join(home, ".codex/plugins/cache"),
    [ENV.MC_GIT_FIXTURE]: path.join(fixtures, "git-state.json"),
    [ENV.MC_CLOCK]: process.env.MC_CLOCK ?? "2026-10-21T00:20:00.000Z",
    GIT_DIR: path.join(fixtures, ".no-git"),
    GIT_CEILING_DIRECTORIES: fixtures,
    NEXT_TELEMETRY_DISABLED: "1",
  };
}
