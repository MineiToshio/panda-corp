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
 *     (architecture | implementation | release).
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

import type { Event } from "../../../../lib/events/events";

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
const ACTIVE_PHASES = new Set<string>(["architecture", "implementation", "release"]);

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
  const activeProjectsCount = countActiveProjects(projects);
  const agentsWorkingCount = countAgentsWorking(events);
  const xpTodayCount = countEvents(events, "XpAwarded");
  const buildsQueuedCount = countEvents(events, "BuildQueued");
  const { failedCount, failedDetail } = countFailedWorkOrders(events);

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

// ---------------------------------------------------------------------------
// Counting helpers (one per KPI) — each pure, no I/O, never throws.
// ---------------------------------------------------------------------------

/**
 * Regression B1' guard: coerce a count to a finite non-negative integer.
 * Number.isFinite rejects NaN, +Infinity, -Infinity; negatives clamp to 0.
 */
function safeCount(n: number): number {
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

/**
 * Count projects whose stage is in the active set.
 * Scalar count, NOT capped at 5 (REQ-12-004 applies to rankings, not this scalar).
 */
function countActiveProjects(projects: ProjectInput[]): number {
  let count = 0;
  for (const project of projects) {
    if (typeof project.stage === "string" && ACTIVE_PHASES.has(project.stage)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Count distinct `agent` string values from AgentWorking events.
 * Regression I3: only count when agent is a string (not an array or undefined).
 */
function countAgentsWorking(events: Event[]): number {
  const activeAgents = new Set<string>();
  for (const ev of events) {
    if (ev.event === "AgentWorking" && typeof ev.agent === "string") {
      activeAgents.add(ev.agent);
    }
  }
  return activeAgents.size;
}

/** Count events whose `event` field matches the given name (honest metric, REQ-12-007). */
function countEvents(events: Event[], eventName: string): number {
  let count = 0;
  for (const ev of events) {
    if (ev.event === eventName) {
      count += 1;
    }
  }
  return count;
}

/**
 * Count events with status exactly === "fail" (regression I3: string equality only)
 * and build the detail string of unique work-order ids (insertion order).
 * Detail is undefined when there are no failures.
 */
function countFailedWorkOrders(events: Event[]): { failedCount: number; failedDetail?: string } {
  let failedCount = 0;
  const failedWorkOrderIds: string[] = [];
  const seenWorkOrderIds = new Set<string>();

  for (const ev of events) {
    if (ev.status === "fail") {
      failedCount += 1;
      if (typeof ev.workOrder === "string" && !seenWorkOrderIds.has(ev.workOrder)) {
        seenWorkOrderIds.add(ev.workOrder);
        failedWorkOrderIds.push(ev.workOrder);
      }
    }
  }

  if (failedCount === 0) {
    return { failedCount };
  }
  const failedDetail =
    failedWorkOrderIds.length > 0
      ? failedWorkOrderIds.join(", ")
      : `${failedCount} evento(s) con error`;
  return { failedCount, failedDetail };
}
