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

import { AGENT_COLOR } from "@/app/_design/tokens/tokens";
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

/** One FRD's real state on the Campaña strip (v2 global scene, REQ-06-019). */
export type CampaignFrd = {
  frd: string;
  title: string;
  state: "pending" | "building" | "in_review" | "verified" | "blocked";
  done: number;
  total: number;
  /** Stable per-FRD color (a CSS custom-property name from the agent palette). */
  colorKey: string;
};

/**
 * Server-derived snapshot passed to the client scene.
 * All fields are serializable — no `fs`, no class instances.
 * Null `frd` means no active build; `active: false` → empty state.
 *
 * v2 (2026-07-01, global-wave engine): the scene is GLOBAL — `running` spans
 * every FRD (each entry carries its `frd` + `colorKey`), `campaign` lists all
 * FRDs with their real state, and `gate` models the serialized tribunal queue
 * (one FRD judged at a time, the rest waiting in line — exactly the engine).
 */
export type FraguaSnapshot = {
  /** The FRD in focus (the one being judged, else the first building), or null. */
  frd: { id: string; title: string } | null;
  /** Mode read from state; default 'powerful' (AC-06-009.1). */
  mode: BuildMode;
  /** Wave size cap on concurrently-rendered WOs (mode → wave, blueprint §3). */
  wave: number;
  /** Running WOs across ALL FRDs (forge ≤ wave; tribunal ≤ 12). */
  running: {
    wo: string;
    title: string;
    state: WoState;
    frd?: string;
    colorKey?: string;
    /** Real wall-clock start (epoch ms, from track.jsonl) — "N min al fuego". */
    startedAtMs?: number;
    relay?: RelayState;
  }[];
  /** "+N en cola" count of queued/non-running WOs (across FRDs). */
  queuedCount: number;
  /**
   * The tribunal: `open` while any FRD is under judgment (back-compat);
   * `judging` = the FRD in session; `queue` = FRDs waiting in line (serialized
   * gates, BL-0021).
   */
  gate: { open: boolean; judging?: string | null; queue?: string[] };
  /**
   * The Bóveda shelf (≤9 entries; remainder archived). An entry is either ONE
   * verified WO, or — when EVERY work order of a FRD is VERIFIED — that whole
   * FRD collapsed into a single stacked trophy (`group` present; `wo` then
   * carries the FRD id so keys stay unique). Owner, 2026-07-02: a finished FRD
   * reads as one achievement, not N repeated statuettes.
   */
  trophies: { wo: string; frd?: string; colorKey?: string; group?: { count: number } }[];
  /** Number of VERIFIED WOs beyond the shelf capacity (AC-06-005.2). */
  archivedCount: number;
  /** Global project WO counter (AC-06-002.2). */
  project: { done: number; total: number };
  /** All FRDs with their real state, in file order (the Campaña, REQ-06-019). */
  campaign?: CampaignFrd[];
  /**
   * BLOCKED work orders — the enfermería (failure as a first-class state,
   * AC-06-015.1): real `fail` frontmatter, never hidden inside a queue count.
   */
  infirmary?: { wo: string; frd?: string; colorKey?: string }[];
  /** The freshest per-WO green commit (engine `wo_commit`) — the courier flight. */
  lastCommit?: { wo: string; at: string };
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

/** Tribunal slots (4×3, AC-06-004.4) — cap on in_review sprites in the room. */
const MAX_TRIBUNAL_SPRITES = 12;

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
   * Real per-WO build starts (wo id → epoch ms) from the durable track.jsonl
   * timeline — powers the "N min al fuego" speech bubbles with REAL time, never
   * a fabricated progress value. Absent entries simply render no elapsed time.
   */
  woStarts?: Readonly<Record<string, number>>;
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
  if (inFlight !== undefined) return inFlight.frd;
  // A FINISHED build (every WO done, no event tail) still renders its scene —
  // powered off, trophies on the shelf. Focus falls to the LAST FRD (the freshest
  // completed work); without this the all-done case early-returned an empty
  // snapshot and the vault vanished (found adding the FRD-group shelf, 2026-07-02).
  const last = workOrders[workOrders.length - 1];
  return last !== undefined ? last.frd : null;
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

/** Global scene structure derived from the authoritative work-order frontmatter. */
interface SceneStructure {
  running: FraguaSnapshot["running"];
  queuedCount: number;
  trophies: { wo: string; frd: string; colorKey: string; group?: { count: number } }[];
  campaign: CampaignFrd[];
  /** FRDs whose WOs all sit at review/done (≥1 review) — the tribunal line, in order. */
  gateQueue: string[];
  /** BLOCKED (`fail`) work orders — the enfermería, never hidden (AC-06-015.1). */
  infirmary: { wo: string; frd: string; colorKey: string }[];
  totals: { done: number; total: number };
}

/** Stable per-FRD palette: the 13 agent color tokens, assigned by FRD file order. */
const FRD_COLOR_KEYS: readonly string[] = Object.freeze(Object.values(AGENT_COLOR));

/** One FRD's campaign state from its work orders (blocked > verified > in_review > pending > building). */
function campaignState(wos: readonly SceneWorkOrder[]): CampaignFrd["state"] {
  if (wos.some((w) => w.state === "fail")) return "blocked";
  if (wos.every((w) => w.state === "done")) return "verified";
  if (
    wos.some((w) => w.state === "review") &&
    wos.every((w) => w.state === "review" || w.state === "done")
  )
    return "in_review";
  if (wos.every((w) => w.state === "todo")) return "pending";
  return "building";
}

/**
 * Derive the GLOBAL scene from the work-order frontmatter (v2, global-wave
 * engine): the forge shows `in_progress` WOs of EVERY FRD (≤ wave — the real
 * wave), the tribunal line is the FRDs whose WOs all reached review/done, the
 * Campaña lists every FRD with its real state, and trophies are the latest
 * `done` WOs across the project (each carrying its FRD color).
 */
function structureFromWorkOrders(
  workOrders: readonly SceneWorkOrder[],
  wave: number,
): SceneStructure {
  // Group by FRD in file order; assign each FRD its stable palette color.
  const byFrd = new Map<string, SceneWorkOrder[]>();
  for (const w of workOrders) {
    const list = byFrd.get(w.frd);
    if (list) list.push(w);
    else byFrd.set(w.frd, [w]);
  }
  const colorOf = new Map<string, string>();
  const campaign: CampaignFrd[] = [];
  let idx = 0;
  for (const [frd, wos] of byFrd) {
    const colorKey = FRD_COLOR_KEYS[idx % FRD_COLOR_KEYS.length] ?? "--color-agent-unknown";
    colorOf.set(frd, colorKey);
    idx++;
    campaign.push({
      frd,
      title: deriveFrdTitle(frd),
      state: campaignState(wos),
      done: wos.filter((w) => w.state === "done").length,
      total: wos.length,
      colorKey,
    });
  }

  const gateQueue = campaign.filter((c) => c.state === "in_review").map((c) => c.frd);

  // Forge: every in_progress WO across FRDs (the actual global wave), ≤ wave.
  const building = workOrders.filter((w) => w.state === "in_progress");
  const forgeSprites = building.slice(0, wave);
  // Tribunal sprites: EVERY review WO stands at the tribunal (it already walked
  // there — committed, awaiting its FRD's gate), even while its FRD still forges
  // siblings; the LINE chips below list only the gate-READY FRDs.
  const inReview = workOrders.filter((w) => w.state === "review").slice(0, MAX_TRIBUNAL_SPRITES);

  const woEntry = (w: SceneWorkOrder, state: WoState) => ({
    wo: w.id,
    title: w.id,
    state,
    frd: w.frd,
    colorKey: colorOf.get(w.frd) ?? "--color-agent-unknown",
  });
  const running: FraguaSnapshot["running"] = [
    ...forgeSprites.map((w) => woEntry(w, "building")),
    ...inReview.map((w) => woEntry(w, "in_review")),
  ];

  // Bóveda: a FULLY-verified FRD collapses into ONE stacked trophy (its WOs read
  // as one achievement); loose verified WOs of FRDs still in progress keep their
  // individual statuette. Shelf capped at MAX_TROPHIES keeping the tail (the
  // loose entries are the freshest work). Everything not represented is archived.
  const done = workOrders.filter((w) => w.state === "done");
  const completedFrds = new Set(campaign.filter((c) => c.state === "verified").map((c) => c.frd));
  const groupEntries = campaign
    .filter((c) => c.state === "verified")
    .map((c) => ({
      wo: c.frd,
      frd: c.frd,
      colorKey: c.colorKey,
      group: { count: c.total },
    }));
  const looseEntries = done
    .filter((w) => !completedFrds.has(w.frd))
    .map((w) => ({
      wo: w.id,
      frd: w.frd,
      colorKey: colorOf.get(w.frd) ?? "--color-agent-unknown",
    }));
  const trophies: SceneStructure["trophies"] = [...groupEntries, ...looseEntries].slice(
    -MAX_TROPHIES,
  );

  const waiting = workOrders.filter((w) => w.state === "todo");
  // Failure is a first-class state (AC-06-015.1): a BLOCKED WO gets a bed in the
  // enfermería, never a silent slot inside the "+N en cola" count.
  const infirmary = workOrders
    .filter((w) => w.state === "fail")
    .map((w) => ({
      wo: w.id,
      frd: w.frd,
      colorKey: colorOf.get(w.frd) ?? "--color-agent-unknown",
    }));

  return {
    running,
    queuedCount: waiting.length + (building.length - forgeSprites.length),
    trophies,
    campaign,
    gateQueue,
    infirmary,
    totals: { done: done.length, total: workOrders.length },
  };
}

/** The freshest per-WO green commit (engine `wo_commit`) — the courier's cue. */
function lastCommitEvent(
  events: readonly DashboardEvent[],
): { wo: string; at: string } | undefined {
  let last: { wo: string; at: string } | undefined;
  for (const ev of events) {
    if (ev.event === "wo_commit" && typeof ev.workOrder === "string") {
      last = { wo: ev.workOrder, at: ev.at };
    }
  }
  return last;
}

/** The freshest engine `gate` event's FRD — the tribunal-in-session hint. */
function lastGateEventFrd(events: readonly DashboardEvent[]): string | null {
  let last: string | null = null;
  for (const ev of events) {
    if (ev.event === "gate" && typeof ev.frd === "string" && ev.frd.trim() !== "") last = ev.frd;
  }
  return last;
}

// ---------------------------------------------------------------------------
// Compose helpers (extracted to keep toFraguaSnapshot within the complexity budget)
// ---------------------------------------------------------------------------

/**
 * Tribunal in session: the freshest engine `gate` event picks WHICH queued FRD
 * is being judged; the head of the line is the honest default (gates are
 * serialized, BL-0021 — at most one is genuinely in session).
 */
function resolveJudging(
  fromFm: SceneStructure | null,
  events: readonly DashboardEvent[],
): string | null {
  if (fromFm === null) return null;
  const gateHint = lastGateEventFrd(events);
  if (gateHint !== null && fromFm.gateQueue.includes(gateHint)) return gateHint;
  return fromFm.gateQueue[0] ?? null;
}

/**
 * Trophies + archived count: frontmatter `done` WOs (with FRD colors);
 * achievement-event trophies only as the legacy fallback.
 */
function composeTrophies(
  fromFm: SceneStructure | null,
  scan: FrdScan,
): { trophies: FraguaSnapshot["trophies"]; archivedCount: number } {
  if (fromFm !== null) {
    // A group entry represents ALL its FRD's WOs — archived = done not on the shelf.
    const represented = fromFm.trophies.reduce((sum, t) => sum + (t.group?.count ?? 1), 0);
    return {
      trophies: fromFm.trophies,
      archivedCount: Math.max(0, fromFm.totals.done - represented),
    };
  }
  return {
    trophies: scan.trophyWoIds.slice(0, MAX_TROPHIES).map((wo) => ({ wo })),
    archivedCount: Math.max(0, scan.trophyWoIds.length - MAX_TROPHIES),
  };
}

/** The tribunal state: closed when the factory is off; queue always real. */
function composeGate(
  fromFm: SceneStructure | null,
  scan: FrdScan,
  judging: string | null,
  isFactoryOff: boolean,
): FraguaSnapshot["gate"] {
  const queue = fromFm?.gateQueue ?? [];
  if (isFactoryOff) return { open: false, judging: null, queue };
  const open = fromFm !== null ? judging !== null : scan.gateOpen;
  return { open, judging, queue };
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

  // Structure: frontmatter when available (DR-092) — the GLOBAL scene; event-
  // derived single-FRD fallback for legacy callers/tests without workOrders.
  const fromFm =
    opts.workOrders !== undefined && opts.workOrders.length > 0
      ? structureFromWorkOrders(opts.workOrders, wave)
      : null;

  const judging = resolveJudging(fromFm, events);

  // FRD focus (header/MissionBar): the FRD under judgment, else the first one
  // building, else the freshest event frd (a finished build still renders its
  // last scene, powered off), else the frontmatter's in-flight FRD.
  const firstBuilding = fromFm?.campaign.find((c) => c.state === "building")?.frd ?? null;
  const currentFrdId = judging ?? firstBuilding ?? eventFrdId ?? frdFromWorkOrders(opts.workOrders);

  if (currentFrdId === null) {
    return { ...emptySnapshot, mode, wave, events: eventVMs, campaign: fromFm?.campaign };
  }

  const ctx: FrdContext = { currentFrdId, wave };
  const scan = scanFrdData(events, ctx);

  // Factory-off: status.yaml's `running:false` is the authoritative "build is off"
  // signal. Event-freshness alone can't tell a finished build from a long, quiet
  // WO, so when the build is OFF we drop the running WOs (no phantom sprite) and
  // mark the snapshot inactive so the scene shows the powered-off state (AC-06-013).
  const isFactoryOff = opts.running === false;

  const { trophies, archivedCount } = composeTrophies(fromFm, scan);

  const eventRunning = scan.runningWos.map((wo) => ({
    wo,
    title: wo,
    // Authoritative frontmatter state (DR-092) decides the room; the
    // event-derived default is `building` (forge).
    state: opts.woStates?.[wo] ?? ("building" as WoState),
  }));
  // Real per-WO start times (track.jsonl) ride along for "N min al fuego".
  const running = isFactoryOff
    ? []
    : (fromFm?.running ?? eventRunning).map((r) => {
        const startedAtMs = opts.woStarts?.[r.wo];
        return startedAtMs !== undefined ? { ...r, startedAtMs } : r;
      });

  // Global project counter (AC-06-002.2): frontmatter totals when available;
  // explicit override wins; achievement-event count as last resort.
  const projectTotals = opts.projectTotals ??
    fromFm?.totals ?? {
      done: scan.globalDoneWoIds.size,
      total: Math.max(scan.allWoIds.size, scan.globalDoneWoIds.size),
    };

  const queuedCount =
    fromFm?.queuedCount ??
    Math.max(0, scan.allWoIds.size - running.length - scan.trophyWoIds.length);

  const gate = composeGate(fromFm, scan, judging, isFactoryOff);

  return {
    frd: { id: currentFrdId, title: deriveFrdTitle(currentFrdId) },
    mode,
    wave,
    running,
    queuedCount,
    gate,
    trophies,
    archivedCount,
    project: projectTotals,
    campaign: fromFm?.campaign,
    // The enfermería stays visible even powered-off — a BLOCKED WO is parked
    // state awaiting the owner, not live activity (unlike running sprites).
    infirmary: fromFm?.infirmary,
    lastCommit: lastCommitEvent(events),
    events: eventVMs,
    active: !isFactoryOff,
    lastEventAt: opts.lastEventAt,
  };
}
