import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cache } from "react";
import { type GuildState, getGuildState } from "@/lib/gamification/guildState";
import { readLedgerResult } from "@/lib/gamification/ledger";

function assertEventSourcesReadable(): void {
  const overrides = [
    process.env.PANDACORP_EVENTS_FILE,
    process.env.PANDACORP_CODEX_EVENTS_FILE,
  ].filter((value): value is string => Boolean(value));
  const ownerHome = process.env.HOME ?? os.homedir();
  const sources = overrides.length
    ? overrides
    : [
        path.join(ownerHome, ".claude/dashboard-events.ndjson"),
        path.join(ownerHome, ".codex/dashboard-events.ndjson"),
      ];
  for (const source of sources) {
    try {
      if (!fs.statSync(source).isFile()) throw new Error("Event source is not a file");
      fs.accessSync(source, fs.constants.R_OK);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }
  }
}
/** Validate optional transports and the durable ledger before presenting the shared guild as current. */
export const inicioGuild = cache((): GuildState => {
  assertEventSourcesReadable();
  if (!readLedgerResult().ok) throw new Error("Guild ledger is unreadable");
  return getGuildState();
});
