"use client";

/**
 * useSceneLife — the Fase-2 "vida" timers of La Fragua (REQ-06-019).
 *
 * Three cheap, coalesced client behaviors (ONE interval, no per-frame state):
 *   - `bubbleIndex`: which running sprite currently speaks (rotates every 6s so
 *     the scene converses without covering every sprite at once).
 *   - `nowMs`: a low-frequency clock for the REAL "N min al fuego" elapsed time
 *     (advances on the same 6s tick — never a per-frame re-render).
 *   - `courierVisible`: a one-shot ~2.4s flight cue when a NEW `wo_commit`
 *     event lands (the engine's per-WO green commit) — the parchment courier
 *     runs from the forge to the tribunal. Anchored to a real event; the
 *     animation itself is decoration (never fakes measurement).
 *
 * Reduced motion: no interval (bubble fixed on the first sprite, elapsed time
 * still real via the mount-time clock) and no courier flight.
 */

import { useEffect, useRef, useState } from "react";

/** Bubble rotation + clock cadence (ms). Low frequency by design (perf budget). */
const LIFE_TICK_MS = 6_000;

/** How long the courier stays on stage (matches the CSS animation). */
const COURIER_FLIGHT_MS = 2_400;

export interface UseSceneLifeInput {
  /** How many running sprites exist (bubble rotation modulus). */
  readonly runningCount: number;
  /** ISO timestamp of the freshest `wo_commit` event, if any. */
  readonly lastCommitAt?: string;
  /** When true: no timers, bubble pinned to sprite 0, no courier. */
  readonly reducedMotion: boolean;
}

export interface UseSceneLifeResult {
  /** Index of the sprite currently speaking (always < runningCount, or 0). */
  readonly bubbleIndex: number;
  /** Low-frequency wall clock (epoch ms); 0 until mounted (SSR-safe). */
  readonly nowMs: number;
  /** True while the parchment courier is mid-flight. */
  readonly courierVisible: boolean;
}

/**
 * Drive the scene's conversational bubble, real-elapsed clock and courier cue.
 *
 * @param input - Running count, freshest wo_commit timestamp, reduced-motion flag.
 */
export function useSceneLife(input: UseSceneLifeInput): UseSceneLifeResult {
  const { runningCount, lastCommitAt, reducedMotion } = input;

  const [tick, setTick] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const [courierVisible, setCourierVisible] = useState(false);

  // One low-frequency interval drives BOTH the bubble rotation and the clock.
  useEffect(() => {
    setNowMs(Date.now());
    if (reducedMotion) return;
    const id = setInterval(() => {
      setTick((t) => t + 1);
      setNowMs(Date.now());
    }, LIFE_TICK_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  // Courier: fire ONLY when a genuinely NEW wo_commit arrives after mount —
  // the stale tail replayed on connect must not launch a phantom flight.
  const seenCommitAtRef = useRef<string | undefined | null>(null);
  useEffect(() => {
    if (seenCommitAtRef.current === null) {
      seenCommitAtRef.current = lastCommitAt;
      return;
    }
    if (lastCommitAt === undefined || lastCommitAt === seenCommitAtRef.current) return;
    seenCommitAtRef.current = lastCommitAt;
    if (reducedMotion) return;
    setCourierVisible(true);
    const id = setTimeout(() => setCourierVisible(false), COURIER_FLIGHT_MS);
    return () => clearTimeout(id);
  }, [lastCommitAt, reducedMotion]);

  const bubbleIndex = runningCount > 0 ? tick % runningCount : 0;
  return { bubbleIndex, nowMs, courierVisible };
}
