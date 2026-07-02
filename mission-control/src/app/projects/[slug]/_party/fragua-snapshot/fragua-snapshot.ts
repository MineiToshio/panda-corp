/**
 * WO-06-005 — toFraguaSnapshot (IF-06-fragua-snapshot)
 *
 * Pure function: enriched event tail (+ authoritative work orders) →
 * serializable `FraguaSnapshot`. No DOM, no I/O, no side-effects.
 *
 * Source-of-truth split (DR-092, 2026-07-01 rework):
 *   - The work-order FRONTMATTER (`opts.workOrders`, the same `listWorkOrders`
 *     source the Work Orders board reads) decides scene STRUCTURE: which WOs
 *     are sprites and in which room, the queue, the trophies, the global
 *     counter, and the gate. It cannot fabricate — a WO the board shows as
 *     `review` is in the Tribunal here too.
 *   - The EVENT stream decides LIVENESS only: the current FRD focus, the mode,
 *     `lastEventAt` (heartbeat) and the feed. When `opts.workOrders` is absent
 *     (legacy callers/tests), the event-derived structure is kept as fallback.
 *
 * Responsibilities (blueprint §3, FRD-06 REQ-06-001/002/004/005/008/009):
 *   - Detect the current FRD in build (most recent event with a non-empty
 *     `frd` field; frontmatter in-flight WOs as fallback).
 *   - Read mode from the event stream; default `'powerful'` when absent (REQ-06-009).
 *   - Cap forge sprites at the wave size for the mode (REQ-06-001 AC-06-001.2).
 *   - Trophies: frontmatter `done` WOs of the FRD ∪ achievement events; compact
 *     beyond 9 (REQ-06-005).
 *   - Gate open when a `gate` event appears for the current FRD OR the
 *     frontmatter shows every FRD WO at `review`/`done` (REQ-06-004).
 *   - Global done/total from the frontmatter (falls back to achievement events).
 *   - Tolerate missing optional fields; never throw (REQ-06-008 AC-06-008.2).
 *
 * Traceability:
 *   IF-06-fragua-snapshot → REQ-06-001, REQ-06-002, REQ-06-004, REQ-06-005,
 *                           REQ-06-008, REQ-06-009, REQ-06-010
 */

import type { BuildMode } from "@/lib/constants";
import type { Event as DashboardEvent } from "@/lib/events/events";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import type { EventVM } from "../event-vm/event-vm";
import { toEventVM } from "../event-vm/event-vm";

// ---------------------------------------------------------------------------
// Types (blueprint §3 contracts)
// ---------------------------------------------------------------------------

/** Work-order visual state within a FRD (La Fragua faithful model). */
type WoState = "building" | "in_review" | "verified" | "blocked";

/** Relay state for deep-mode work orders that have a frontend sub-step. */
export type RelayState = {
  step: "test" | "backend" | "frontend";
  contractPublished: boolean;
};

/**
 * Server-derived snapshot passed to the client scene.
 * All fields are serializable — no `fs`, no class instances.
 * Null `frd` means no active build; `active: false` → empty state.
 */
export type FraguaSnapshot = {
  /** The FRD currently in build (per-FRD scene), or null if none. */
  frd: { id: string; title: string } | null;
  /** Mode read from state; default 'powerful' (AC-06-009.1). */
  mode: BuildMode;
  /** Wave size cap on concurrently-rendered WOs (mode → wave, blueprint §3). */
  wave: number;
  /** Running WOs (≤ wave, already capped). */
  running: { wo: string; title: string; state: WoState; relay?: RelayState }[];
  /** "+N en cola" count of queued/non-running WOs. */
  queuedCount: number;
  /** Reviewer gate state: open iff all FRD WOs are IN_REVIEW. */
  gate: { open: boolean };
  /** VERIFIED WOs on the Bóveda shelf (≤9 shown; remainder in archivedCount). */
  trophies: { wo: string }[];
  /** Number of VERIFIED WOs beyond the shelf capacity (AC-06-005.2). */
  archivedCount: number;
  /** Global project WO counter (AC-06-002.2). */
  project: { done: number; total: number };
  /** Capped event tail mapped to view-models (for EventFeed). */
  events: EventVM[];
  /** True when there is a FRD currently in build with visible events. */
  active: boolean;
  /** ISO 8601 string of the latest retained event; null if none. */
  lastEventAt: string | null;
};

// ---------------------------------------------------------------------------
// Wave table (blueprint §3, faithful to engine)
// ---------------------------------------------------------------------------

/**
 * Wave size per build mode.
 * Controls the maximum number of concurrently-rendered work-order sprites.
 */
const WAVE: Readonly<Record<BuildMode, number>> = Object.freeze({
  pro: 2,
  balanced: 4,
  powerful: 8,
  deep: 6,
});

/** Default mode when none is present in the event stream (AC-06-009.1). */
const DEFAULT_MODE: BuildMode = "powerful";

/** Maximum trophies displayed on the Bóveda shelf (AC-06-005.2). */
const MAX_TROPHIES = 9;

/** Valid BuildMode values for enum-guarded parsing. */
const VALID_MODES = new Set<string>(["pro", "balanced", "powerful", "deep"]);

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** The minimal authoritative work-order shape the snapshot needs (serializable). */
export type SceneWorkOrder = Pick<WorkOrder, "id" | "frd" | "state">;

export interface ToFraguaSnapshotOpts {
  /**
   * The lastEventAt value from readEvents (ISO 8601 or null).
   * Passed through to the snapshot so callers don't have to re-derive it.
   */
  lastEventAt: string | null;
  /**
   * The project's authoritative work orders (id + frd + frontmatter state) —
   * the SAME `listWorkOrders` source the Work Orders board reads (DR-092).
   * When present, the scene STRUCTURE (sprites, rooms, queue, trophies, global
   * counter, gate) is derived from here, and events only drive liveness.
   * When absent, the legacy event-derived structure is used.
   */
  workOrders?: readonly SceneWorkOrder[];
  /**
   * Optional mode override (e.g. from a project status.yaml).
   * When provided, takes precedence over any mode field in the events.
   * When absent, the mode is derived from the event stream (default 'powerful').
   */
  modeOverride?: BuildMode;
  /**
   * Optional external project-level WO totals.
   * When provided, used for the global {done, total} counter instead of
   * the event-derived count.
   */
  projectTotals?: { done: number; total: number };
  /**
   * The project's authoritative build flag from `status.yaml` (`running`).
   * The event ndjson keeps the LAST build's events forever, so events alone
   * cannot tell "building now" from "finished long ago" — a stale tail would
   * render a frozen active scene + a phantom running WO. When `running` is
   * explicitly `false`, the snapshot is forced to the factory-off state
   * (`active: false`, no running WOs) regardless of the event tail (AC-06-013).
   * `undefined`/`true` keeps the event-derived behavior.
   */
  running?: boolean;
  /**
   * Authoritative per-WO visual state, keyed by work-order id, derived from the
   * work-order frontmatter `implementation_status` (the SAME source the Work
   * Orders tab reads — DR-092 single source). When present, it overrides the
   * event-derived state of each running WO so the Party agrees with the board:
   * a WO that frontmatter says is `in_review` walks to the Tribunal instead of
   * staying in the forge as `building`. A WO absent from the map (or no map at
   * all) keeps the event-derived `building` default. The event stream still
   * drives liveness/animation; the frontmatter decides which room.
   */
  woStates?: Readonly<Record<string, WoState>>;
}

// ---------------------------------------------------------------------------
// Internal types for pass-2 accumulation
// ---------------------------------------------------------------------------

interface FrdContext {
  currentFrdId: string;
  wave: number;
}

interface FrdScan {
  runningWos: string[];
  allWoIds: Set<string>;
  /** Trophies on the CURRENT FRD's Bóveda shelf (per-FRD, AC-06-005.1). */
  trophyWoIds: string[];
  /** Unique achievement WOs across ALL FRDs (global counter, AC-06-002.2). */
  globalDoneWoIds: Set<string>;
  gateOpen: boolean;
}

// ---------------------------------------------------------------------------
// FRD title derivation
// ---------------------------------------------------------------------------

/**
 * Derive a human-readable title from a FRD slug.
 * Example: "frd-06-party" → "FRD-06 Party"
 * Falls back to the raw id when the format is unrecognised.
 */
function deriveFrdTitle(frdId: string): string {
  const match = /^frd-(\d+)-(.+)$/.exec(frdId);
  if (!match) return frdId;
  const num = match[1];
  const slug = (match[2] ?? "")
    .split("-")
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
  return `FRD-${num} ${slug}`;
}

// ---------------------------------------------------------------------------
// Pass 1: detect mode and the current FRD
// ---------------------------------------------------------------------------

/**
 * Scan events for the most-recent mode and FRD id.
 * Returns {detectedMode, currentFrdId} — both may be null when enriched fields
 * are absent (AC-06-008.2: tolerate missing optional fields).
 */
function detectModeAndFrd(events: readonly DashboardEvent[]): {
  detectedMode: BuildMode | null;
  currentFrdId: string | null;
} {
  let detectedMode: BuildMode | null = null;
  let currentFrdId: string | null = null;

  for (const ev of events) {
    if (typeof ev.mode === "string" && VALID_MODES.has(ev.mode)) {
      detectedMode = ev.mode as BuildMode;
    }
    // Empty/whitespace frd is FRD-less activity (e.g. the visual-qa pass emits
    // frd:"") — it must never become the scene's FRD id.
    if (typeof ev.frd === "string" && ev.frd.trim() !== "") {
      currentFrdId = ev.frd;
    }
  }

  return { detectedMode, currentFrdId };
}

/**
 * Frontmatter fallback for the FRD focus: when the event tail carries no frd
 * (rotated file, engine that predates enrichment), a feature with in-flight
 * work orders (`in_progress`/`review`) is still honestly "the FRD in build".
 * Picks the FIRST such FRD in work-order file order (the engine builds FRD by
 * FRD, so at most one FRD is genuinely mid-flight; stragglers from interrupted
 * runs resolve to the earliest, which is the one the next run resumes first).
 */
function frdFromWorkOrders(workOrders: readonly SceneWorkOrder[] | undefined): string | null {
  if (workOrders === undefined) return null;
  const inFlight = workOrders.find((w) => w.state === "in_progress" || w.state === "review");
  return inFlight !== undefined ? inFlight.frd : null;
}

// ---------------------------------------------------------------------------
// Pass 2 helpers: process individual event types
// ---------------------------------------------------------------------------

/**
 * An event's `wo` field can carry a real work-order id (`WO-02-001`),
 * `foundation`, OR — for FRD-level activity (an agent working the FRD as a
 * whole, before/between its work orders) — the FRD id itself (`frd-02-home`).
 * Only real work orders are sprites/counted in the scene; an FRD id arriving in
 * `wo` is NOT a work order and must never spawn a phantom avatar or inflate the
 * WO count.
 */
function isFrdLevelWoId(wo: string): boolean {
  return /^frd-/i.test(wo);
}

/** Mutable running-WO tracking sets shared across pass-2 event processors. */
interface RunningTracking {
  readonly seenWoIds: Set<string>;
  readonly stoppedWoIds: Set<string>;
}

/**
 * Process an AgentWorking event: register its WO as running (if not stopped),
 * up to the wave cap, and track it in allWoIds.
 */
function processAgentWorking(
  ev: DashboardEvent,
  ctx: FrdContext,
  tracking: RunningTracking,
  scan: FrdScan,
): void {
  if (
    ev.event !== "AgentWorking" ||
    ev.frd !== ctx.currentFrdId ||
    typeof ev.workOrder !== "string"
  )
    return;
  if (isFrdLevelWoId(ev.workOrder)) return;

  scan.allWoIds.add(ev.workOrder);
  if (!tracking.seenWoIds.has(ev.workOrder) && !tracking.stoppedWoIds.has(ev.workOrder)) {
    tracking.seenWoIds.add(ev.workOrder);
    if (scan.runningWos.length < ctx.wave) {
      scan.runningWos.push(ev.workOrder);
    }
  }
}

/**
 * Process a SubagentStop event: mark the WO as stopped and remove it from
 * the running list.
 */
function processSubagentStop(
  ev: DashboardEvent,
  ctx: FrdContext,
  stoppedWoIds: Set<string>,
  scan: FrdScan,
): void {
  if (
    ev.event !== "SubagentStop" ||
    ev.frd !== ctx.currentFrdId ||
    typeof ev.workOrder !== "string"
  )
    return;
  if (isFrdLevelWoId(ev.workOrder)) return;

  stoppedWoIds.add(ev.workOrder);
  const idx = scan.runningWos.indexOf(ev.workOrder);
  if (idx !== -1) scan.runningWos.splice(idx, 1);
}

/**
 * Process an achievement event. Two distinct buckets, kept decoupled:
 *   - The global project counter (AC-06-002.2) counts every unique achievement
 *     WO across ALL FRDs → `globalDoneWoIds`.
 *   - The Bóveda trophy shelf (AC-06-005.1) is per-FRD → `trophyWoIds`. A
 *     foreign-FRD achievement lingering in the globally-capped event tail must
 *     NOT leak onto the current FRD's shelf. An achievement with no `frd` field
 *     is treated as belonging to the current scene (backward-compat with
 *     legacy/global emitters, AC-06-008.2).
 */
function processAchievement(
  ev: DashboardEvent,
  ctx: FrdContext,
  seenTrophies: Set<string>,
  scan: FrdScan,
): void {
  if (ev.event !== "achievement" || typeof ev.workOrder !== "string") return;
  if (isFrdLevelWoId(ev.workOrder)) return;

  // Global counter: every unique achievement WO, regardless of FRD.
  scan.globalDoneWoIds.add(ev.workOrder);

  // Per-FRD shelf: explicit foreign FRD is excluded; absent frd defaults to the
  // current scene (legacy/global achievements).
  const belongsToCurrentFrd = typeof ev.frd !== "string" || ev.frd === ctx.currentFrdId;
  if (!belongsToCurrentFrd) return;

  if (!seenTrophies.has(ev.workOrder)) {
    seenTrophies.add(ev.workOrder);
    scan.trophyWoIds.push(ev.workOrder);
  }
  scan.allWoIds.add(ev.workOrder);
}

// ---------------------------------------------------------------------------
// Pass 2: scan events for FRD-specific data
// ---------------------------------------------------------------------------

/**
 * Scan events for running WOs, trophies, and gate state for the given FRD.
 * Extracted to keep toFraguaSnapshot within the complexity budget.
 */
function scanFrdData(events: readonly DashboardEvent[], ctx: FrdContext): FrdScan {
  const scan: FrdScan = {
    runningWos: [],
    allWoIds: new Set<string>(),
    trophyWoIds: [],
    globalDoneWoIds: new Set<string>(),
    gateOpen: false,
  };

  const seenWoIds = new Set<string>();
  const stoppedWoIds = new Set<string>();
  const seenTrophies = new Set<string>();
  const tracking: RunningTracking = { seenWoIds, stoppedWoIds };

  for (const ev of events) {
    // Track all WOs for this FRD across all event types (FRD-level wo ids,
    // which carry the FRD id itself, are not work orders — excluded).
    if (
      ev.frd === ctx.currentFrdId &&
      typeof ev.workOrder === "string" &&
      !isFrdLevelWoId(ev.workOrder)
    ) {
      scan.allWoIds.add(ev.workOrder);
    }

    processAgentWorking(ev, ctx, tracking, scan);
    processSubagentStop(ev, ctx, stoppedWoIds, scan);
    processAchievement(ev, ctx, seenTrophies, scan);

    if (ev.event === "gate" && ev.frd === ctx.currentFrdId) {
      scan.gateOpen = true;
    }
  }

  return scan;
}

// ---------------------------------------------------------------------------
// Frontmatter-derived scene structure (DR-092 — the board's source decides)
// ---------------------------------------------------------------------------

/** Scene structure derived from the authoritative work-order frontmatter. */
interface SceneStructure {
  running: FraguaSnapshot["running"];
  queuedCount: number;
  trophyWoIds: string[];
  gateOpenFromState: boolean;
  totals: { done: number; total: number };
}

/**
 * Derive the scene structure for the current FRD from the work-order
 * frontmatter: `in_progress` → forge sprite (≤ wave; overflow queues),
 * `review` → tribunal sprite, `done` → trophy, `todo`/`fail` → "+N en cola".
 * The gate reads open when every FRD WO sits at `review`/`done` with at least
 * one still under review (AC-06-004.2), even before the engine's `gate` event.
 */
function structureFromWorkOrders(
  workOrders: readonly SceneWorkOrder[],
  frdId: string,
  wave: number,
): SceneStructure {
  const frdWos = workOrders.filter((w) => w.frd === frdId);
  const building = frdWos.filter((w) => w.state === "in_progress");
  const inReview = frdWos.filter((w) => w.state === "review");
  const waiting = frdWos.filter((w) => w.state === "todo" || w.state === "fail");

  const forgeSprites = building.slice(0, wave);
  const running: FraguaSnapshot["running"] = [
    ...forgeSprites.map((w) => ({ wo: w.id, title: w.id, state: "building" as WoState })),
    ...inReview.map((w) => ({ wo: w.id, title: w.id, state: "in_review" as WoState })),
  ];

  const trophyWoIds = frdWos.filter((w) => w.state === "done").map((w) => w.id);
  const gateOpenFromState =
    frdWos.length > 0 &&
    inReview.length > 0 &&
    frdWos.every((w) => w.state === "review" || w.state === "done");

  return {
    running,
    queuedCount: waiting.length + (building.length - forgeSprites.length),
    trophyWoIds,
    gateOpenFromState,
    totals: {
      done: workOrders.filter((w) => w.state === "done").length,
      total: workOrders.length,
    },
  };
}

// ---------------------------------------------------------------------------
// toFraguaSnapshot — the pure derivation function (IF-06-fragua-snapshot)
// ---------------------------------------------------------------------------

/**
 * Derive a `FraguaSnapshot` from the enriched event tail.
 *
 * @param events - Capped event tail from readEvents (EventsSnapshot.events).
 * @param opts   - Options including lastEventAt and optional overrides.
 * @returns A fully-typed, serializable FraguaSnapshot. Never throws.
 */
export function toFraguaSnapshot(
  events: readonly DashboardEvent[],
  opts: ToFraguaSnapshotOpts,
): FraguaSnapshot {
  const emptySnapshot: FraguaSnapshot = {
    frd: null,
    mode: DEFAULT_MODE,
    wave: WAVE[DEFAULT_MODE],
    running: [],
    queuedCount: 0,
    gate: { open: false },
    trophies: [],
    archivedCount: 0,
    project: { done: 0, total: 0 },
    events: [],
    active: false,
    lastEventAt: opts.lastEventAt,
  };

  const { detectedMode, currentFrdId: eventFrdId } = detectModeAndFrd(events);

  // Mode precedence: modeOverride > stream detection > default.
  const mode: BuildMode =
    opts.modeOverride !== undefined ? opts.modeOverride : (detectedMode ?? DEFAULT_MODE);

  const wave = WAVE[mode];
  const eventVMs = events.map(toEventVM);

  // FRD focus: the freshest event frd wins; the frontmatter's in-flight FRD is
  // the fallback (an active build whose events rotated away still renders).
  const currentFrdId = eventFrdId ?? frdFromWorkOrders(opts.workOrders);

  if (currentFrdId === null) {
    return { ...emptySnapshot, mode, wave, events: eventVMs };
  }

  const ctx: FrdContext = { currentFrdId, wave };
  const scan = scanFrdData(events, ctx);

  // Factory-off: status.yaml's `running:false` is the authoritative "build is off"
  // signal. Event-freshness alone can't tell a finished build from a long, quiet
  // WO, so when the build is OFF we drop the running WOs (no phantom sprite) and
  // mark the snapshot inactive so the scene shows the powered-off state (AC-06-013).
  const isFactoryOff = opts.running === false;

  // Structure: frontmatter when available (DR-092); event-derived fallback.
  const fromFm =
    opts.workOrders !== undefined
      ? structureFromWorkOrders(opts.workOrders, currentFrdId, wave)
      : null;

  // Trophies: frontmatter `done` WOs first (stable file order), then any
  // achievement-event trophies not already present (legacy emitters).
  const trophyWoIds =
    fromFm !== null
      ? [
          ...fromFm.trophyWoIds,
          ...scan.trophyWoIds.filter((id) => !fromFm.trophyWoIds.includes(id)),
        ]
      : scan.trophyWoIds;

  const displayedTrophies = trophyWoIds.slice(0, MAX_TROPHIES);
  const archivedCount = Math.max(0, trophyWoIds.length - MAX_TROPHIES);

  const eventRunning = scan.runningWos.map((wo) => ({
    wo,
    title: wo,
    // Authoritative frontmatter state (DR-092) decides the room; the
    // event-derived default is `building` (forge).
    state: opts.woStates?.[wo] ?? ("building" as WoState),
  }));
  const running = isFactoryOff ? [] : (fromFm?.running ?? eventRunning);

  // Global project counter (AC-06-002.2): frontmatter totals when available;
  // explicit override wins; achievement-event count as last resort.
  const projectTotals = opts.projectTotals ??
    fromFm?.totals ?? {
      done: scan.globalDoneWoIds.size,
      total: Math.max(scan.allWoIds.size, scan.globalDoneWoIds.size),
    };

  // The queue is per-FRD: only current-FRD trophies count as already done.
  const queuedCount =
    fromFm?.queuedCount ??
    Math.max(0, scan.allWoIds.size - running.length - scan.trophyWoIds.length);

  const gateOpen = scan.gateOpen || (fromFm?.gateOpenFromState ?? false);

  return {
    frd: { id: currentFrdId, title: deriveFrdTitle(currentFrdId) },
    mode,
    wave,
    running,
    queuedCount,
    gate: { open: isFactoryOff ? false : gateOpen },
    trophies: displayedTrophies.map((wo) => ({ wo })),
    archivedCount,
    project: projectTotals,
    events: eventVMs,
    active: !isFactoryOff,
    lastEventAt: opts.lastEventAt,
  };
}
