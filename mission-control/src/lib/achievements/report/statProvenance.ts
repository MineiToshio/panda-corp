import { accountingEvents, normalizeEventName } from "@/lib/events/event-contract";
import type { ReaderData } from "../readerData";

const PROVENANCE = {
  agents: ["AgentWorking", "AgentDone"],
  streak: ["AgentDone"],
  speed: ["BuildLaunch", "BuildComplete"],
  builds: ["BuildComplete"],
  subagents: ["SubagentStop"],
  gates: ["GateResult", "GateVerdict"],
  reviews: ["ReviewVerdict"],
  findings: ["AgentFinding"],
  modes: ["BuildLaunch"],
  activedays: ["AgentDone"],
  iterations: ["BuildRelaunch"],
  flawless: ["GateResult", "GateVerdict"],
} as const;

/** Kinds observed in either telemetry or corroborated facts, without granting telemetry XP. */
export function recordedKinds(data: ReaderData): ReadonlySet<string> {
  return new Set(
    [...accountingEvents(data), ...(data.eventsSnapshot?.events ?? [])].map(
      (event) => normalizeEventName(event.event).display,
    ),
  );
}

/** A zero is unknown only when none of its feeding event kinds has ever been recorded. */
export function neverRecorded(key: string, value: number, kinds: ReadonlySet<string>): boolean {
  if (value !== 0 || !(key in PROVENANCE)) return false;
  return !PROVENANCE[key as keyof typeof PROVENANCE].some((kind) => kinds.has(kind));
}
