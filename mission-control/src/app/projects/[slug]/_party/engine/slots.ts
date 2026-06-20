/**
 * WO-06-004 — La Fragua engine geometry helpers (IF-06-engine).
 *
 * Pure slot-assignment and movement math, split out of engine.ts to keep each
 * module loadable whole (clean-code.md size limit). No DOM, no state.
 */

import type { BuildMode } from "@/lib/constants";
import type { Pos } from "../layout";
import { DEEP_SLOTS, FORGE_SLOTS } from "../layout";
import type { InternalWo } from "./types";

/** Walk speed in px per ms. */
export const WALK_SPEED = 0.12;

/** Maximum time delta clamped per tick (ms). */
export const MAX_DT = 48;

/**
 * Returns the forge slot positions for the given mode.
 * deep → DEEP_SLOTS, others → FORGE_SLOTS.
 */
export function getForgeSlots(mode: BuildMode): readonly Pos[] {
  return mode === "deep" ? DEEP_SLOTS : FORGE_SLOTS;
}

/**
 * Find the next free slot index in a slot array, given an already-occupied set.
 * Returns -1 if no slot is available.
 */
export function nextFreeSlot(total: number, occupied: ReadonlySet<number>): number {
  for (let i = 0; i < total; i++) {
    if (!occupied.has(i)) return i;
  }
  return -1;
}

/**
 * Collect occupied slot indices for all WOs currently in the given room.
 */
export function occupiedSlots(wos: Map<string, InternalWo>, room: InternalWo["room"]): Set<number> {
  const occ = new Set<number>();
  for (const w of wos.values()) {
    if (w.room === room) occ.add(w.slotIndex);
  }
  return occ;
}

/** Inputs to {@link stepToward}: current position, target position, and max step. */
export type StepTowardInput = {
  readonly px: number;
  readonly py: number;
  readonly targetPx: number;
  readonly targetPy: number;
  readonly step: number;
};

/**
 * Move (px, py) toward (targetPx, targetPy) by at most `step` pixels.
 * Returns the new position.
 */
export function stepToward(input: StepTowardInput): [number, number] {
  const { px, py, targetPx, targetPy, step } = input;
  const dx = targetPx - px;
  const dy = targetPy - py;
  const d = Math.hypot(dx, dy);
  if (d <= step) return [targetPx, targetPy];
  return [px + (dx / d) * step, py + (dy / d) * step];
}
