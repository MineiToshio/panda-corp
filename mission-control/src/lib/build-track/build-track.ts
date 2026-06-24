/**
 * Observability Timeline v2 — durable build-track reader.
 *
 * Reads the build engine's per-project timeline log at
 * `<projectPath>/.pandacorp/track.jsonl` (append-only, one JSON object per line,
 * committed — DR-086) and turns it into an honest, real-duration timeline.
 *
 * This replaces the old fake "equal-width 20-min bars" placeholder: durations are
 * computed from real wall-clock timestamps. When no track exists yet, it falls back
 * to a STRUCTURAL view (the work-order list with no durations) — never fabricated bars.
 *
 * Read-only and fail-soft: a missing/unreadable track or a malformed line is skipped,
 * never thrown.
 */

import fs from "node:fs";
import path from "node:path";
import type { WorkOrder } from "@/lib/work-orders/work-orders";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** State of a timeline node (work order, FRD or the rollup). */
export type TLState = "done" | "fail" | "in_progress" | "review" | "todo";

export interface TLWorkOrder {
  id: string;
  title: string;
  /** Parent FRD folder slug, e.g. "frd-01-data-reading". */
  frd: string;
  state: TLState;
  /** Wall-clock start in epoch ms (last attempt), or null when unknown. */
  startMs: number | null;
  /** Wall-clock end in epoch ms (last attempt), or null when unknown. */
  endMs: number | null;
  /** Duration in minutes (≥1 when both bounds known), or null. */
  durationMin: number | null;
  /** Number of wo_start lines seen for this WO (reopens counted). */
  attempts: number;
}

interface TLReview {
  startMs: number | null;
  endMs: number | null;
  verdict: "pass" | "reject" | null;
  durationMin: number | null;
}

export interface TLFrd {
  /** FRD folder slug, e.g. "frd-01-data-reading". */
  id: string;
  /** Prettified label, e.g. "FRD-01". */
  label: string;
  startMs: number | null;
  endMs: number | null;
  state: TLState;
  workOrders: TLWorkOrder[];
  review: TLReview | null;
}

export interface BuildTimeline {
  frds: TLFrd[];
  /** True only when the source is the track and real durations are present. */
  hasDurations: boolean;
  source: "track" | "structural" | "empty";
  /** Earliest start across all WOs (epoch ms), or null when unknown. */
  buildStartMs: number | null;
}

// ---------------------------------------------------------------------------
// Track line shapes (parsed defensively from JSONL)
// ---------------------------------------------------------------------------

type TrackKind = "wo_start" | "wo_end" | "review_start" | "review_end" | "frd_end";

interface TrackLine {
  kind: TrackKind;
  frd: string;
  at: number;
  /** wo_start / wo_end only. */
  wo?: string;
  /** wo_end only — the engine's end state. */
  state?: string;
  /** review_end only. */
  verdict?: string;
}

// ---------------------------------------------------------------------------
// State mapping
// ---------------------------------------------------------------------------

/** Map a wo_end `state` value to a TLState; null when unrecognised. */
function mapEndState(raw: string | undefined): TLState | null {
  if (raw === undefined) return null;
  const key = raw.trim().toLowerCase();
  if (key === "in_review") return "review";
  if (key === "verified") return "done";
  if (key === "failed") return "fail";
  if (key === "done") return "done";
  if (key === "fail") return "fail";
  if (key === "review") return "review";
  if (key === "in_progress") return "in_progress";
  if (key === "todo") return "todo";
  return null;
}

/** Map a WorkOrder.state to a TLState (1:1; both vocabularies coincide). */
function mapOrderState(state: WorkOrder["state"]): TLState {
  return state;
}

/** Roll up child WO states into a single FRD/timeline state. */
function rollupState(states: readonly TLState[]): TLState {
  if (states.length === 0) return "todo";
  if (states.every((s) => s === "done")) return "done";
  if (states.some((s) => s === "fail")) return "fail";
  if (states.some((s) => s === "in_progress" || s === "review")) return "in_progress";
  return "todo";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Prettify an FRD folder slug to its short label: "frd-01-data-reading" → "FRD-01". */
function frdLabel(slug: string): string {
  const m = /^(frd-\d+)/i.exec(slug);
  if (m?.[1] !== undefined) return m[1].toUpperCase();
  return slug;
}

/** Round a span (ms) to whole minutes, clamped to ≥1; null when either bound missing. */
function durationMinutes(startMs: number | null, endMs: number | null): number | null {
  if (startMs === null || endMs === null) return null;
  return Math.max(1, Math.round((endMs - startMs) / 60_000));
}

/** Min of two nullable numbers (null = absent). */
function minNullable(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

/** Max of two nullable numbers (null = absent). */
function maxNullable(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

// ---------------------------------------------------------------------------
// Track parsing (fail-soft — malformed lines skipped, never throws)
// ---------------------------------------------------------------------------

/** Parse a single JSONL line into a TrackLine, or null when malformed/unknown. */
function parseTrackLine(line: string): TrackLine | null {
  const trimmed = line.trim();
  if (trimmed === "") return null;

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;

  const obj = raw as Record<string, unknown>;
  const kind = obj.kind;
  const frd = obj.frd;
  const at = obj.at;

  if (typeof kind !== "string" || typeof frd !== "string" || frd.trim() === "") return null;
  if (
    kind !== "wo_start" &&
    kind !== "wo_end" &&
    kind !== "review_start" &&
    kind !== "review_end" &&
    kind !== "frd_end"
  ) {
    return null;
  }
  if (typeof at !== "string" || at.trim() === "") return null;

  const atMs = Date.parse(at);
  if (!Number.isFinite(atMs)) return null;

  const result: TrackLine = { kind, frd: frd.trim(), at: atMs };

  if (typeof obj.wo === "string" && obj.wo.trim() !== "") result.wo = obj.wo.trim();
  if (typeof obj.state === "string") result.state = obj.state;
  if (typeof obj.verdict === "string") result.verdict = obj.verdict;

  return result;
}

/** Read + parse the track file. Returns [] when absent/unreadable/empty. */
function readTrackLines(projectPath: string): TrackLine[] {
  const trackPath = path.join(projectPath, ".pandacorp", "track.jsonl");
  let raw: string;
  try {
    raw = fs.readFileSync(trackPath, "utf-8");
  } catch {
    return [];
  }

  const lines: TrackLine[] = [];
  for (const line of raw.split("\n")) {
    const parsed = parseTrackLine(line);
    if (parsed !== null) lines.push(parsed);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Track → BuildTimeline
// ---------------------------------------------------------------------------

/** Mutable accumulator for one work order while folding the track lines. */
interface WoAccumulator {
  id: string;
  attempts: number;
  /** start ms of the current/last open attempt (set by wo_start). */
  pendingStart: number | null;
  /** start ms of the last completed (or in-progress) attempt. */
  lastStart: number | null;
  lastEnd: number | null;
  lastEndState: TLState | null;
}

/** Mutable accumulator for one FRD while folding the track lines. */
interface FrdAccumulator {
  id: string;
  /** WO accumulators in first-seen order. */
  wos: Map<string, WoAccumulator>;
  woOrder: string[];
  reviewStart: number | null;
  reviewEnd: number | null;
  reviewVerdict: "pass" | "reject" | null;
  frdEnd: number | null;
}

function ensureFrd(map: Map<string, FrdAccumulator>, id: string): FrdAccumulator {
  const existing = map.get(id);
  if (existing !== undefined) return existing;
  const created: FrdAccumulator = {
    id,
    wos: new Map(),
    woOrder: [],
    reviewStart: null,
    reviewEnd: null,
    reviewVerdict: null,
    frdEnd: null,
  };
  map.set(id, created);
  return created;
}

function ensureWo(frd: FrdAccumulator, id: string): WoAccumulator {
  const existing = frd.wos.get(id);
  if (existing !== undefined) return existing;
  const created: WoAccumulator = {
    id,
    attempts: 0,
    pendingStart: null,
    lastStart: null,
    lastEnd: null,
    lastEndState: null,
  };
  frd.wos.set(id, created);
  frd.woOrder.push(id);
  return created;
}

function applyLine(map: Map<string, FrdAccumulator>, line: TrackLine): void {
  const frd = ensureFrd(map, line.frd);

  switch (line.kind) {
    case "wo_start": {
      if (line.wo === undefined) return;
      const wo = ensureWo(frd, line.wo);
      wo.attempts += 1;
      // A fresh attempt: this start becomes the (provisionally) last attempt's start;
      // clear the prior end so a start-without-end correctly reads as in_progress.
      wo.pendingStart = line.at;
      wo.lastStart = line.at;
      wo.lastEnd = null;
      wo.lastEndState = null;
      return;
    }
    case "wo_end": {
      if (line.wo === undefined) return;
      const wo = ensureWo(frd, line.wo);
      // Pair this end with the most recent start (keep-last-attempt).
      if (wo.pendingStart !== null) wo.lastStart = wo.pendingStart;
      wo.lastEnd = line.at;
      wo.lastEndState = mapEndState(line.state);
      wo.pendingStart = null;
      return;
    }
    case "review_start":
      frd.reviewStart = line.at;
      return;
    case "review_end":
      frd.reviewEnd = line.at;
      frd.reviewVerdict =
        line.verdict === "pass" ? "pass" : line.verdict === "reject" ? "reject" : null;
      return;
    case "frd_end":
      frd.frdEnd = line.at;
      return;
    default: {
      // Exhaustiveness guard: `kind` is a finite union, so this is unreachable.
      const _exhaustive: never = line.kind;
      void _exhaustive;
    }
  }
}

/** Resolve a WO accumulator's final state, cross-referencing the orders list. */
function resolveWoState(wo: WoAccumulator, orderState: TLState | undefined): TLState {
  // A start with no matching end ⇒ in progress.
  if (wo.lastStart !== null && wo.lastEnd === null) return "in_progress";
  if (wo.lastEndState !== null) return wo.lastEndState;
  if (orderState !== undefined) return orderState;
  return "todo";
}

function buildReview(frd: FrdAccumulator): TLReview | null {
  if (frd.reviewStart === null && frd.reviewEnd === null && frd.reviewVerdict === null) {
    return null;
  }
  return {
    startMs: frd.reviewStart,
    endMs: frd.reviewEnd,
    verdict: frd.reviewVerdict,
    durationMin: durationMinutes(frd.reviewStart, frd.reviewEnd),
  };
}

function fromTrack(lines: readonly TrackLine[], orders: readonly WorkOrder[]): BuildTimeline {
  const orderById = new Map<string, WorkOrder>();
  for (const o of orders) orderById.set(o.id, o);

  const acc = new Map<string, FrdAccumulator>();
  for (const line of lines) applyLine(acc, line);

  let buildStartMs: number | null = null;

  const frds: TLFrd[] = [];
  for (const frdAcc of acc.values()) {
    const tlWos: TLWorkOrder[] = [];
    let frdStart: number | null = null;
    let frdEndFromWos: number | null = null;

    for (const woId of frdAcc.woOrder) {
      const wo = frdAcc.wos.get(woId);
      if (wo === undefined) continue;
      const order = orderById.get(woId);
      const state = resolveWoState(
        wo,
        order !== undefined ? mapOrderState(order.state) : undefined,
      );
      const tlWo: TLWorkOrder = {
        id: woId,
        title: order?.title ?? woId,
        frd: frdAcc.id,
        state,
        startMs: wo.lastStart,
        endMs: wo.lastEnd,
        durationMin: durationMinutes(wo.lastStart, wo.lastEnd),
        attempts: wo.attempts,
      };
      tlWos.push(tlWo);
      frdStart = minNullable(frdStart, wo.lastStart);
      frdEndFromWos = maxNullable(frdEndFromWos, wo.lastEnd);
      buildStartMs = minNullable(buildStartMs, wo.lastStart);
    }

    tlWos.sort((a, b) => compareByStartThenId(a.startMs, a.id, b.startMs, b.id));

    const review = buildReview(frdAcc);
    const frdEnd = frdAcc.frdEnd ?? frdAcc.reviewEnd ?? frdEndFromWos;
    const frdState = rollupState(tlWos.map((w) => w.state));

    frds.push({
      id: frdAcc.id,
      label: frdLabel(frdAcc.id),
      startMs: frdStart,
      endMs: frdEnd,
      state: frdState,
      workOrders: tlWos,
      review,
    });
  }

  frds.sort((a, b) => compareByStartThenId(a.startMs, a.id, b.startMs, b.id));

  return { frds, hasDurations: true, source: "track", buildStartMs };
}

/** Order by startMs ascending (nulls last), then by id ascending. */
function compareByStartThenId(
  aStart: number | null,
  aId: string,
  bStart: number | null,
  bId: string,
): number {
  if (aStart !== bStart) {
    if (aStart === null) return 1;
    if (bStart === null) return -1;
    return aStart - bStart;
  }
  return aId.localeCompare(bId);
}

// ---------------------------------------------------------------------------
// Structural fallback (orders only, no durations)
// ---------------------------------------------------------------------------

function fromStructural(orders: readonly WorkOrder[]): BuildTimeline {
  const byFrd = new Map<string, TLWorkOrder[]>();
  const frdOrder: string[] = [];

  for (const o of orders) {
    let list = byFrd.get(o.frd);
    if (list === undefined) {
      list = [];
      byFrd.set(o.frd, list);
      frdOrder.push(o.frd);
    }
    list.push({
      id: o.id,
      title: o.title,
      frd: o.frd,
      state: mapOrderState(o.state),
      startMs: null,
      endMs: null,
      durationMin: null,
      attempts: 1,
    });
  }

  frdOrder.sort((a, b) => a.localeCompare(b));

  const frds: TLFrd[] = frdOrder.map((frdId) => {
    const wos = (byFrd.get(frdId) ?? []).slice().sort((a, b) => a.id.localeCompare(b.id));
    return {
      id: frdId,
      label: frdLabel(frdId),
      startMs: null,
      endMs: null,
      state: rollupState(wos.map((w) => w.state)),
      workOrders: wos,
      review: null,
    };
  });

  return { frds, hasDurations: false, source: "structural", buildStartMs: null };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read the durable build timeline for a project.
 *
 * Precedence:
 *   1. `.pandacorp/track.jsonl` with usable lines → real durations (`source: "track"`).
 *   2. Otherwise, the work-order list → structural view, no durations (`source: "structural"`).
 *   3. Nothing → empty (`source: "empty"`).
 *
 * Read-only and fail-soft: a missing/unreadable track or a malformed line is skipped,
 * never thrown.
 *
 * @param projectPath - Absolute path to the project root.
 * @param orders      - Work orders discovered for the project (for titles + fallback).
 */
export function readBuildTimeline(
  projectPath: string,
  orders: readonly WorkOrder[],
): BuildTimeline {
  if (projectPath && projectPath.trim() !== "") {
    const lines = readTrackLines(projectPath);
    if (lines.length > 0) {
      return fromTrack(lines, orders);
    }
  }

  if (orders.length > 0) {
    return fromStructural(orders);
  }

  return { frds: [], hasDurations: false, source: "empty", buildStartMs: null };
}
