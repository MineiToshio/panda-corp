/**
 * EventsRateChart pure helpers — CMP-12-rate-chart (WO-12-003 UI).
 *
 * Stateless, side-effect-free utilities over the `Bucket` series. No JSX, so
 * no "use client" needed.
 *
 * Traceability:
 *   CMP-12-rate-chart → REQ-12-007 → AC-12-007.1 → IF-12-rate → WO-12-003
 */

import type { Bucket } from "../selectors/rate/rate";

/**
 * Extract the unique set of agents across all buckets, in first-appearance order.
 * Respects the optional `agents` prop for a stable, explicit ordering.
 */
export function collectAgents(buckets: Bucket[], agentsProp?: string[]): string[] {
  if (agentsProp && agentsProp.length > 0) {
    return agentsProp;
  }
  const seen = new Set<string>();
  for (const bucket of buckets) {
    for (const agent of Object.keys(bucket.byAgent)) {
      seen.add(agent);
    }
  }
  return Array.from(seen);
}

/** Compute the global max total across all buckets for bar scaling. */
export function globalMax(buckets: Bucket[]): number {
  let max = 0;
  for (const b of buckets) {
    if (b.total > max) max = b.total;
  }
  return max;
}

/** Truncate a minute key "YYYY-MM-DDTHH:MM" to just "HH:MM". */
export function toTimeLabel(minute: string): string {
  // minute is exactly 16 chars: "2026-06-16T12:29"
  return minute.length >= 16 ? minute.slice(11) : minute;
}

/**
 * Detect a stalled state: all buckets have total === 0 (or no buckets).
 * Consumed by the FRD-18 dashboard rate chart.
 */
export function isStalled(buckets: Bucket[]): boolean {
  if (buckets.length === 0) return true;
  return buckets.every((b) => b.total === 0);
}
