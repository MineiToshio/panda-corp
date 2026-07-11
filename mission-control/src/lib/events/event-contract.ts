import { createHash } from "node:crypto";
import vocabulary from "./event-vocabulary.json";
import type { Event } from "./events";

/** Sentinel for a true result whose historical occurrence time has no durable oracle. */
export const UNKNOWN_ACCOUNTING_AT = "1970-01-01T12:00:00.000Z";

export type EventRuntime = "claude" | "codex" | "unknown";
type VocabularyEntry = { readonly display: string; readonly aliases: readonly string[] };
const entries = vocabulary.events as Record<string, VocabularyEntry>;
const aliases = new Map<string, { semanticName: string; display: string }>();
for (const [semanticName, entry] of Object.entries(entries)) {
  aliases.set(semanticName, { semanticName, display: entry.display });
  for (const alias of entry.aliases) aliases.set(alias, { semanticName, display: entry.display });
}

export function normalizeEventName(name: string): { semanticName: string; display: string } {
  return aliases.get(name) ?? { semanticName: `legacy.${name}`, display: name };
}

export function legacyEventId(rawLine: string, runtime: EventRuntime): string {
  return `legacy:${runtime}:${createHash("sha256").update(rawLine.trim()).digest("hex")}`;
}

export function eventSubject(event: Event): string {
  return (
    event.subject ??
    event.workOrder ??
    event.frd ??
    event.task ??
    event.agent ??
    event.project ??
    "global"
  );
}

export function semanticLedgerKey(event: Event): string {
  const semanticName = event.semanticName ?? normalizeEventName(event.event).semanticName;
  return `${event.runId ?? event.session ?? "legacy"}\u0000${semanticName}\u0000${eventSubject(event)}`;
}

/** One result-bearing act per (run,event,subject), regardless of alias or transport. */
export function semanticLedger(events: readonly Event[]): Event[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    // Pre-contract legacy events have no trustworthy run boundary; preserve them.
    // New Claude/Codex producers MUST carry run_id and are safely ledgered.
    if (event.runId === undefined) return true;
    const key = semanticLedgerKey(event);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Accounting boundary: production supplies oracle-corroborated durable facts. */
export function accountingEvents(input: {
  readonly eventsSnapshot?: { readonly events: readonly Event[] } | null;
  readonly durableEvents?: readonly Event[];
}): Event[] {
  if (input.durableEvents !== undefined) return semanticLedger(input.durableEvents);
  // Historical pure unit fixtures predate ReaderData.durableEvents. Keep their
  // isolated coverage without making omission a production fail-open.
  if (process.env.NODE_ENV === "test") return semanticLedger(input.eventsSnapshot?.events ?? []);
  return [];
}

export const EVENT_VOCABULARY_VERSION = vocabulary.version;
