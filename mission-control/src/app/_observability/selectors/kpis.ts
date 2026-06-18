/**
 * WO-12-002 — `deriveKpis` (IF-12-kpis).
 *
 * Pure selector: given the capped event tail and the active-projects list,
 * derives exactly 5 critical KPIs for the Mission Control header.
 *
 * Contract:
 *   deriveKpis(events: Event[], projects: ProjectListItem[]): Kpi[]
 *   - Returns EXACTLY 5 canonical KPIs (never fewer, never more):
 *       "active-projects", "agents-working", "xp-today", "builds-queued",
 *       "failed-work-orders"
 *   - Each Kpi: { key: string; label: string; value: number; detail?: string }
 *   - "failed-work-orders" counts events with status === "fail" (first-class per FRD-06/13).
 *   - "agents-working" counts distinct `agent` string values from AgentWorking events.
 *   - "active-projects" counts projects in active phases
 *     (architecture | implementation | release | operation).
 *   - "xp-today" counts XpAwarded events (or 0 if none).
 *   - "builds-queued" counts BuildQueued events (or 0 if none).
 *   - All values are finite non-negative integers.
 *   - Pure: no I/O, no env reads, no Claude calls. Never throws.
 *
 * Regression anchors:
 *   B1' (WO-13-001, 2026-06-16): typeof NaN === "number" — every numeric count
 *     uses Number.isFinite guards; deriveKpis must never return value=NaN.
 *   I2  (WO-13-001, 2026-06-16): empty inputs → zeroed values, not undefined.
 *   I3  (WO-13-001, 2026-06-16): status === "fail" exact string, not truthy cast.
 *   FREEZE-ON-RED (WO-02-004): events missing optional fields must not throw.
 *   WO-01-005 adversarial I3: agent must be a string before counting.
 *
 * Traceability:
 *   AC-12-001.1 → REQ-12-001 → IF-12-kpis → WO-12-002
 *   AC-12-007.1 → REQ-12-007 → IF-12-kpis → WO-12-002
 */

import type { Event } from "../../../lib/events";

/**
 * A single KPI displayed in the Mission Control header.
 *
 * - `key`: machine identifier (one of the 5 canonical keys).
 * - `label`: human-readable label in Spanish (UI-facing).
 * - `value`: derived numeric count; always a finite non-negative integer.
 * - `detail`: optional human-readable context string (present for non-zero
 *   failed-work-orders to surface work order IDs).
 */
export type Kpi = {
  key: string;
  label: string;
  value: number;
  detail?: string;
};

/**
 * Minimal project shape consumed by deriveKpis.
 * Compatible with `ProjectListItem` from `lib/portfolio.ts` (subset).
 */
type ProjectInput = {
  stage?: string;
};

/**
 * Active phases — projects in these phases contribute to the "active-projects" KPI.
 * Mirrors the ACTIVE_PHASES set in lib/portfolio.ts.
 */
const ACTIVE_PHASES = new Set<string>(["architecture", "implementation", "release", "operation"]);

/**
 * Derive the ≤5 critical KPIs from the capped event tail and the projects list.
 *
 * The function is pure: given the same inputs it always returns the same output.
 * It never reads env variables, never calls external services, and never throws.
 *
 * @param events   - Already-parsed, capped `Event[]` from `lib/events`
 *                   (no re-reading the file — blueprint §3 / REQ-12-007).
 * @param projects - Active-projects list from `lib/portfolio.ts` `activeProjects()`.
 *                   Only the `stage` field is consumed.
 * @returns An array of exactly 5 `Kpi` objects in specification order.
 */
export function deriveKpis(events: Event[], projects: ProjectInput[]): Kpi[] {
  // ---- 1. active-projects -----------------------------------------------
  // Count projects whose stage is in the active set.
  // Note: this is a scalar count, NOT itself capped at 5 (REQ-12-004 applies
  // to rankings/groupings, not to this aggregated scalar — test anchors this).
  let activeProjectsCount = 0;
  for (const project of projects) {
    if (typeof project.stage === "string" && ACTIVE_PHASES.has(project.stage)) {
      activeProjectsCount += 1;
    }
  }

  // ---- 2. agents-working ------------------------------------------------
  // Count distinct `agent` string values from AgentWorking events.
  // Regression I3: only count when agent is a string (not an array or undefined).
  const activeAgents = new Set<string>();
  for (const ev of events) {
    if (ev.event === "AgentWorking" && typeof ev.agent === "string") {
      activeAgents.add(ev.agent);
    }
  }
  const agentsWorkingCount = activeAgents.size;

  // ---- 3. xp-today ------------------------------------------------------
  // Count XpAwarded events in the tail (honest metric, REQ-12-007).
  // No extra instrumentation beyond the event tail.
  let xpTodayCount = 0;
  for (const ev of events) {
    if (ev.event === "XpAwarded") {
      xpTodayCount += 1;
    }
  }

  // ---- 4. builds-queued ------------------------------------------------
  // Count BuildQueued events in the tail.
  let buildsQueuedCount = 0;
  for (const ev of events) {
    if (ev.event === "BuildQueued") {
      buildsQueuedCount += 1;
    }
  }

  // ---- 5. failed-work-orders -------------------------------------------
  // Count events with status exactly === "fail" (regression I3: string equality only).
  // First-class KPI per FRD-06/13 failure visibility.
  // Collect unique work order IDs from fail events for the detail field.
  let failedCount = 0;
  const failedWorkOrderIds: string[] = [];
  const seenWorkOrderIds = new Set<string>();

  for (const ev of events) {
    if (ev.status === "fail") {
      failedCount += 1;
      // Surface the work order ID in detail when present (unique, insertion order).
      if (typeof ev.workOrder === "string" && !seenWorkOrderIds.has(ev.workOrder)) {
        seenWorkOrderIds.add(ev.workOrder);
        failedWorkOrderIds.push(ev.workOrder);
      }
    }
  }

  // Build the detail string for failed-work-orders.
  // Present and non-empty when failedCount > 0; undefined when no failures.
  let failedDetail: string | undefined;
  if (failedCount > 0) {
    if (failedWorkOrderIds.length > 0) {
      failedDetail = failedWorkOrderIds.join(", ");
    } else {
      // Some fail events had no workOrder field — still produce a non-empty detail.
      failedDetail = `${failedCount} evento(s) con error`;
    }
  }

  // ---- Regression B1' guard --------------------------------------------
  // All counts derive from integer increment (+= 1) or Set.size — both are always
  // finite non-negative integers. No floating-point arithmetic is involved.
  // The guard below is a belt-and-suspenders runtime check so the contract is
  // self-documenting: no KPI value may be NaN or non-finite.
  function safeCount(n: number): number {
    // Number.isFinite rejects NaN, +Infinity, -Infinity.
    return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
  }

  // ---- Return exactly 5 KPIs in specification order --------------------
  return [
    {
      key: "active-projects",
      label: "Proyectos activos",
      value: safeCount(activeProjectsCount),
    },
    {
      key: "agents-working",
      label: "Agentes trabajando",
      value: safeCount(agentsWorkingCount),
    },
    {
      key: "xp-today",
      label: "XP del día",
      value: safeCount(xpTodayCount),
    },
    {
      key: "builds-queued",
      label: "Builds en cola",
      value: safeCount(buildsQueuedCount),
    },
    {
      key: "failed-work-orders",
      label: "Work orders fallidos",
      value: safeCount(failedCount),
      ...(failedDetail !== undefined ? { detail: failedDetail } : {}),
    },
  ];
}
