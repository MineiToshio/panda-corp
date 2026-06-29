/**
 * lib/achievements/signals.ts — Real-signal derivation layer (FRD-10 v2, WO-10-010)
 *
 * Platform golden rule (architecture §1): read-only derivation only. Pure functions, no I/O.
 *
 * The single source (DR-092) that turns the already-read `ReaderData` into the real-signal
 * aggregates the v2 catalogue needs, so the ~80 trophies / ~21 chains read ONE derivation
 * instead of each predicate re-scanning the event stream.
 *
 * Honesty contract (blueprint §2 / §5, docs/achievements.md §1): every aggregate maps to a
 * VERIFIABLE real signal — the REAL event vocabulary the factory emits (AgentDone / ReviewVerdict /
 * GateResult / GateVerdict / BuildLaunch / BuildComplete / BuildRelaunch / AgentFinding /
 * SubagentStop) + project statuses + idea cards. No `achievement`/`task=` reads (nothing emits them).
 * An aggregate with no source is an honest 0 / null / false — never fabricated.
 *
 * Traceability: AC-10-010.1..4.
 */

import type { Event } from "../events/events";
import type { StatusResult } from "../status/status";
import type { ReaderData } from "./stats";

/** A first-occurrence stamp: the real `at` + `project` of the earliest matching event. */
export type FirstStamp = { readonly at: string; readonly project: string } | null;

/**
 * All real-signal aggregates derived once from `ReaderData`.
 * Counts are cumulative over whatever event window the caller supplies (the achievements page
 * reads the stream uncapped so only-grow counters stay honest — WO-10-012).
 */
export type Signals = {
  // ── cumulative counts ──────────────────────────────────────────────────────
  /** Work orders closed green — honest cumulative floor = Σ statuses.workOrdersDone. */
  readonly woClosed: number;
  /** `AgentDone result=green` events in the window (used for time-of-day / marathon signals). */
  readonly greenDoneEvents: number;
  /** `BuildComplete` events. */
  readonly builds: number;
  /** `BuildLaunch` events. */
  readonly buildLaunches: number;
  /** `BuildRelaunch` events. */
  readonly relaunches: number;
  /** `SubagentStop` events (subagents spawned/finished). */
  readonly subagents: number;
  /** Gate passes (`GateResult`/`GateVerdict` verdict=PASS). */
  readonly gatePasses: number;
  /** Reviews approved (`ReviewVerdict` verdict=APPROVED). */
  readonly reviewsApproved: number;
  /** Review findings emitted (`AgentFinding`). */
  readonly findings: number;
  /** Distinct build roles ever seen (`AgentWorking`/`AgentDone` data.role). */
  readonly distinctRoles: number;
  /** Distinct build modes ever seen (`BuildLaunch` data.mode). */
  readonly distinctModes: number;
  /** Distinct UTC days that had a green WO close. */
  readonly activeDays: number;
  /** Longest run of consecutive ISO weeks with at least one green WO. */
  readonly weeklyStreak: number;
  /** Flawless gates: PASS with reopen_count 0. */
  readonly flawlessGates: number;

  // ── records / peaks ────────────────────────────────────────────────────────
  /** Highest `maxAgents` seen on any build launch (0 if none). */
  readonly maxAgentsPeak: number;
  /** Most `BuildRelaunch` events for a single project that also has a `BuildComplete` (0 if none). */
  readonly maxRelaunchThenComplete: number;
  /** Highest `reopen_count` on a gate that later/also reached PASS (0 if none). */
  readonly maxReopenThenPass: number;

  // ── flags ──────────────────────────────────────────────────────────────────
  /** Any `SubagentStop` ran at `effort.level = "xhigh"`. */
  readonly hasXhighEffort: boolean;
  /** A green WO closed before 08:00 UTC (early bird). */
  readonly earlyBird: boolean;
  /** A green WO closed in the 00:00 hour (after midnight). */
  readonly afterMidnight: boolean;
  /** A green WO closed in the 03:00 hour (the witching hour). */
  readonly witchingHour: boolean;
  /** Green WOs on both a Saturday and a Sunday (weekend warrior). */
  readonly weekendWarrior: boolean;
  /** A build completed on a Friday (UTC weekday 5). */
  readonly fridayShip: boolean;

  // ── first-occurrence stamps (for honest unlock date/project) ────────────────
  readonly firstGreenDone: FirstStamp;
  readonly firstBuildLaunch: FirstStamp;
  readonly firstReviewApproved: FirstStamp;
  readonly firstGatePass: FirstStamp;
};

/** True when an event is `AgentDone` with a green result (a work order closed). */
function isGreenDone(ev: Event): boolean {
  return ev.event === "AgentDone" && ev.result === "green";
}

/** Sum of `workOrdersDone` across present statuses — the honest cumulative WO floor. */
function sumWorkOrdersDone(statuses: readonly StatusResult[]): number {
  let total = 0;
  for (const sr of statuses) {
    if (!sr.present || sr.status === null) continue;
    const wo = sr.status.workOrdersDone;
    if (typeof wo === "number" && Number.isFinite(wo)) total += Math.max(0, Math.trunc(wo));
  }
  return total;
}

/** First stamp (earliest by `at`) over events passing the predicate, or null. */
function firstStamp(events: readonly Event[], pred: (ev: Event) => boolean): FirstStamp {
  let best: Event | null = null;
  for (const ev of events) {
    if (!pred(ev)) continue;
    if (best === null || ev.at < best.at) best = ev;
  }
  return best ? { at: best.at, project: best.project ?? "" } : null;
}

/** ISO week key "YYYY-WW" for a date (Monday-based), matching stats.ts. */
function isoWeekKey(d: Date): string {
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const weekStart = new Date(jan4.getTime() - (dayOfWeek - 1) * 86_400_000);
  const weekNum = Math.floor((d.getTime() - weekStart.getTime()) / (7 * 86_400_000)) + 1;
  return `${d.getUTCFullYear()}-${String(weekNum).padStart(2, "0")}`;
}

/** Longest run of consecutive ISO weeks present in the set (0 when empty, ≥1 otherwise). */
function longestWeeklyStreak(weekKeys: ReadonlySet<string>): number {
  if (weekKeys.size === 0) return 0;
  const sorted = [...weekKeys].sort();
  let max = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (areConsecutiveWeeks(sorted[i - 1] ?? "", sorted[i] ?? "")) {
      cur++;
      if (cur > max) max = cur;
    } else {
      cur = 1;
    }
  }
  return max;
}

/** Two "YYYY-WW" keys are consecutive (same-year +1, or year boundary to week 1). */
function areConsecutiveWeeks(a: string, b: string): boolean {
  const [ay, aw] = a.split("-").map((n) => parseInt(n, 10));
  const [by, bw] = b.split("-").map((n) => parseInt(n, 10));
  if (ay === undefined || aw === undefined || by === undefined || bw === undefined) return false;
  if (Number.isNaN(ay) || Number.isNaN(aw) || Number.isNaN(by) || Number.isNaN(bw)) return false;
  if (ay === by) return bw === aw + 1;
  return by === ay + 1 && bw === 1; // any +1-year week-1 (52/53 boundary tolerated)
}

/** Aggregates derived from a single pass over the green-WO close timestamps. */
type TimeAggregates = {
  activeDays: number;
  weeklyStreak: number;
  earlyBird: boolean;
  afterMidnight: boolean;
  witchingHour: boolean;
  weekendWarrior: boolean;
};

/** Derive the time-of-day / cadence aggregates from the green-WO close dates. */
function deriveTimeAggregates(greenDates: readonly Date[]): TimeAggregates {
  const days = new Set<string>();
  const weeks = new Set<string>();
  let earlyBird = false;
  let afterMidnight = false;
  let witchingHour = false;
  let sawSaturday = false;
  let sawSunday = false;
  for (const d of greenDates) {
    days.add(d.toISOString().slice(0, 10));
    weeks.add(isoWeekKey(d));
    const h = d.getUTCHours();
    if (h < 8) earlyBird = true;
    if (h === 0) afterMidnight = true;
    if (h === 3) witchingHour = true;
    const wd = d.getUTCDay();
    if (wd === 6) sawSaturday = true;
    if (wd === 0) sawSunday = true;
  }
  return {
    activeDays: days.size,
    weeklyStreak: longestWeeklyStreak(weeks),
    earlyBird,
    afterMidnight,
    witchingHour,
    weekendWarrior: sawSaturday && sawSunday,
  };
}

/** A gate PASS verdict from a `GateResult` or `GateVerdict` event. */
function isGatePass(ev: Event): boolean {
  return (ev.event === "GateResult" || ev.event === "GateVerdict") && ev.verdict === "PASS";
}

/** Resilience peaks: max relaunch-then-complete and max reopen-then-pass, per project. */
function deriveResilience(events: readonly Event[]): {
  maxRelaunchThenComplete: number;
  maxReopenThenPass: number;
} {
  const relaunchByProject = new Map<string, number>();
  const completedProjects = new Set<string>();
  let maxReopenThenPass = 0;
  for (const ev of events) {
    const project = ev.project ?? "";
    if (ev.event === "BuildRelaunch") {
      relaunchByProject.set(project, (relaunchByProject.get(project) ?? 0) + 1);
    } else if (ev.event === "BuildComplete") {
      completedProjects.add(project);
    } else if (
      isGatePass(ev) &&
      typeof ev.reopenCount === "number" &&
      ev.reopenCount > maxReopenThenPass
    ) {
      maxReopenThenPass = ev.reopenCount;
    }
  }
  let maxRelaunchThenComplete = 0;
  for (const [project, count] of relaunchByProject) {
    if (completedProjects.has(project) && count > maxRelaunchThenComplete) {
      maxRelaunchThenComplete = count;
    }
  }
  return { maxRelaunchThenComplete, maxReopenThenPass };
}

/** Per-event-kind counters accumulated in one pass (extracted to keep complexity low). */
type EventCounts = {
  builds: number;
  buildLaunches: number;
  relaunches: number;
  subagents: number;
  gatePasses: number;
  flawlessGates: number;
  reviewsApproved: number;
  findings: number;
  distinctRoles: number;
  distinctModes: number;
  maxAgentsPeak: number;
  hasXhighEffort: boolean;
  fridayShip: boolean;
};

/** Count a `BuildComplete` (incl. the Friday-ship flag). */
function foldBuildComplete(ev: Event, c: EventCounts): void {
  c.builds++;
  const d = new Date(ev.at);
  if (Number.isFinite(d.getTime()) && d.getUTCDay() === 5) c.fridayShip = true;
}

/** Count a `BuildLaunch` (incl. distinct mode + maxAgents peak). */
function foldBuildLaunch(ev: Event, c: EventCounts, modes: Set<string>): void {
  c.buildLaunches++;
  if (typeof ev.mode === "string") modes.add(ev.mode);
  if (typeof ev.maxAgents === "number" && ev.maxAgents > c.maxAgentsPeak) {
    c.maxAgentsPeak = ev.maxAgents;
  }
}

/** Dispatch one event to its per-kind counter (switch isolated to keep complexity low). */
function foldByKind(ev: Event, c: EventCounts, modes: Set<string>): void {
  switch (ev.event) {
    case "BuildComplete":
      foldBuildComplete(ev, c);
      return;
    case "BuildLaunch":
      foldBuildLaunch(ev, c, modes);
      return;
    case "BuildRelaunch":
      c.relaunches++;
      return;
    case "SubagentStop":
      c.subagents++;
      if (ev.effortLevel === "xhigh") c.hasXhighEffort = true;
      return;
    case "ReviewVerdict":
      if (ev.verdict === "APPROVED") c.reviewsApproved++;
      return;
    case "AgentFinding":
      c.findings++;
      return;
    default:
      return;
  }
}

/** Fold one event into the running counts (role + gate + per-kind dispatch). */
function foldEvent(ev: Event, c: EventCounts, roles: Set<string>, modes: Set<string>): void {
  if (typeof ev.role === "string" && ev.role.length > 0) roles.add(ev.role);
  if (isGatePass(ev)) {
    c.gatePasses++;
    if (ev.reopenCount === 0) c.flawlessGates++;
  }
  foldByKind(ev, c, modes);
}

/** Accumulate the per-event-kind counters over the whole stream in one pass. */
function countEvents(events: readonly Event[]): EventCounts {
  const roles = new Set<string>();
  const modes = new Set<string>();
  const c: EventCounts = {
    builds: 0,
    buildLaunches: 0,
    relaunches: 0,
    subagents: 0,
    gatePasses: 0,
    flawlessGates: 0,
    reviewsApproved: 0,
    findings: 0,
    distinctRoles: 0,
    distinctModes: 0,
    maxAgentsPeak: 0,
    hasXhighEffort: false,
    fridayShip: false,
  };
  for (const ev of events) foldEvent(ev, c, roles, modes);
  c.distinctRoles = roles.size;
  c.distinctModes = modes.size;
  return c;
}

/**
 * Derive every real-signal aggregate from `ReaderData` (IF-10-signals, WO-10-010).
 *
 * Pure: no I/O, no clock, no mutation; same input → same output.
 */
export function deriveSignals(data: ReaderData): Signals {
  const events = data.eventsSnapshot?.events ?? [];
  const greenDoneList = events.filter(isGreenDone);
  const greenDates = greenDoneList
    .map((ev) => new Date(ev.at))
    .filter((d) => Number.isFinite(d.getTime()));
  const time = deriveTimeAggregates(greenDates);
  const c = countEvents(events);
  const resilience = deriveResilience(events);

  return {
    woClosed: sumWorkOrdersDone(data.statuses),
    greenDoneEvents: greenDoneList.length,
    builds: c.builds,
    buildLaunches: c.buildLaunches,
    relaunches: c.relaunches,
    subagents: c.subagents,
    gatePasses: c.gatePasses,
    reviewsApproved: c.reviewsApproved,
    findings: c.findings,
    distinctRoles: c.distinctRoles,
    distinctModes: c.distinctModes,
    activeDays: time.activeDays,
    weeklyStreak: time.weeklyStreak,
    flawlessGates: c.flawlessGates,
    maxAgentsPeak: c.maxAgentsPeak,
    maxRelaunchThenComplete: resilience.maxRelaunchThenComplete,
    maxReopenThenPass: resilience.maxReopenThenPass,
    hasXhighEffort: c.hasXhighEffort,
    earlyBird: time.earlyBird,
    afterMidnight: time.afterMidnight,
    witchingHour: time.witchingHour,
    weekendWarrior: time.weekendWarrior,
    fridayShip: c.fridayShip,
    firstGreenDone: firstStamp(events, isGreenDone),
    firstBuildLaunch: firstStamp(events, (ev) => ev.event === "BuildLaunch"),
    firstReviewApproved: firstStamp(
      events,
      (ev) => ev.event === "ReviewVerdict" && ev.verdict === "APPROVED",
    ),
    firstGatePass: firstStamp(events, isGatePass),
  };
}
