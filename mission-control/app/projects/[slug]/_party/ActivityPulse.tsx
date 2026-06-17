"use client";
/**
 * WO-06-009 — ActivityPulse (CMP-06-pulse)
 *
 * Per-minute activity bars, colored per agent.
 * Consumes IF-12-rate (`Bucket[]` from `eventsPerMinute`) — does NOT re-derive
 * the rate; the caller is responsible for computing it.
 *
 * "Alive vs stalled" affordance: when the latest bucket is empty / all buckets
 * are empty, the pulse shows a stalled indicator (text + icon — never color-only,
 * per FRD-13).
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - tabular-nums on all numeric labels.
 *   - data-testid on every structural / interactive element.
 *   - Accessible: stalled state carries role + visible text (not color-only).
 *
 * Traceability:
 *   CMP-06-pulse → REQ-06-015
 *   IF-12-rate  (rate.ts, WO-12-003) — input contract
 *   IF-06-agent-color (tokens.ts, WO-06-002) — AGENT_COLOR
 */

import { AGENT_COLOR } from "@/app/_design/tokens";
import type { Bucket } from "@/app/_observability/selectors/rate";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ActivityPulseProps {
  /**
   * Per-minute buckets from `eventsPerMinute(events, window, now)`.
   * Pre-computed by the caller — never recomputed here (IF-12-rate contract).
   */
  buckets: Bucket[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive the sorted set of agent keys that appear in at least one bucket.
 * Preserves a deterministic order (sorted) so bars always appear in the same
 * left-to-right position across re-renders.
 */
function activeAgents(buckets: Bucket[]): string[] {
  const seen = new Set<string>();
  for (const bucket of buckets) {
    for (const agent of Object.keys(bucket.byAgent)) {
      seen.add(agent);
    }
  }
  return Array.from(seen).sort();
}

/**
 * Compute the maximum count across all buckets and agents so that bar heights
 * are relative to the peak (normalised 0–100%).
 * Returns 1 as the floor so we never divide by zero.
 */
function peakCount(buckets: Bucket[], agents: string[]): number {
  let max = 0;
  for (const bucket of buckets) {
    for (const agent of agents) {
      const count = Object.hasOwn(bucket.byAgent, agent) ? (bucket.byAgent[agent] as number) : 0;
      if (count > max) max = count;
    }
  }
  return max > 0 ? max : 1;
}

/**
 * True when the most recent bucket (last element) has total === 0,
 * OR when the buckets array is empty (no signal at all).
 */
function isStalled(buckets: Bucket[]): boolean {
  if (buckets.length === 0) return true;
  const lastBucket = buckets[buckets.length - 1];
  return lastBucket !== undefined && lastBucket.total === 0;
}

/**
 * Return the CSS custom property reference for an agent role.
 * Falls back to `--color-agent-unknown` for roles not in AGENT_COLOR.
 */
function agentColorVar(agent: string): string {
  if (Object.hasOwn(AGENT_COLOR, agent)) {
    return AGENT_COLOR[agent as keyof typeof AGENT_COLOR];
  }
  return "--color-agent-unknown";
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded colors
// ---------------------------------------------------------------------------

const CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  padding: "calc(var(--spacing, 0.25rem) * 3)",
  background: "var(--color-surface-panel, var(--color-surface, Canvas))",
  borderRadius: "var(--radius, 0.5rem)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  letterSpacing: "0.04em",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.7,
  textTransform: "uppercase",
};

const CHART_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: "calc(var(--spacing, 0.25rem) * 0.5)",
  height: "3rem",
  fontVariantNumeric: "tabular-nums",
};

const COLUMN_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "1px",
  flex: "1 1 0",
  minWidth: 0,
  height: "100%",
  justifyContent: "flex-end",
};

const STALLED_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
  padding: "calc(var(--spacing, 0.25rem) * 2) calc(var(--spacing, 0.25rem) * 3)",
  borderRadius: "var(--radius, 0.5rem)",
  background: "var(--color-surface-panel, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  color: "var(--color-text-muted, currentColor)",
  fontSize: "0.75rem",
  opacity: 0.75,
};

// ---------------------------------------------------------------------------
// Sub-component: a single stacked column (one minute)
// ---------------------------------------------------------------------------

interface ColumnProps {
  bucket: Bucket;
  agents: string[];
  peak: number;
}

function BucketColumn({ bucket, agents, peak }: ColumnProps): React.JSX.Element {
  return (
    // Plain div column — the outer chart role="img" aria-label covers accessibility.
    // No role/aria-label here to avoid Biome useSemanticElements violations.
    <div style={COLUMN_STYLE} data-minute={bucket.minute}>
      {agents.map((agent) => {
        const count = Object.hasOwn(bucket.byAgent, agent) ? (bucket.byAgent[agent] as number) : 0;
        const heightPct = Math.round((count / peak) * 100);
        const colorVar = agentColorVar(agent);

        return (
          // Visual bar — decorative within the chart img region.
          // data-testid and data-* attrs carry the info for tests.
          <div
            key={agent}
            data-testid={`activity-pulse-bar-${agent}`}
            data-agent-color={colorVar}
            data-count={count}
            style={{
              width: "100%",
              height: heightPct > 0 ? `${heightPct}%` : "2px",
              minHeight: heightPct > 0 ? undefined : "2px",
              // Bar color via CSS custom property — never hardcoded
              background: `var(${colorVar}, var(--color-accent, currentColor))`,
              borderRadius: "1px",
              opacity: count === 0 ? 0.15 : 1,
              transition: "height 150ms var(--ease-out, ease-out)",
            }}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActivityPulse component
// ---------------------------------------------------------------------------

/**
 * Renders per-minute activity bars colored per agent (AC-06-015.1).
 *
 * - One bar (segment) per agent per minute bucket, stacked vertically within each column.
 * - Bar height encodes event count relative to the peak across the window.
 * - Agent color from AGENT_COLOR (FRD-13 tokens / IF-06-agent-color).
 * - When the most recent bucket is empty (or no buckets), shows the stalled indicator.
 * - Never throws on empty or all-zero input.
 */
export function ActivityPulse({ buckets }: ActivityPulseProps): React.JSX.Element {
  const agents = activeAgents(buckets);
  const stalled = isStalled(buckets);

  return (
    <section
      data-testid="activity-pulse"
      aria-label="Pulso de actividad del equipo"
      style={CONTAINER_STYLE}
    >
      {/* Label row */}
      <span style={LABEL_STYLE} data-testid="activity-pulse-label">
        Pulso de actividad
      </span>

      {/* Chart area — always rendered even in stalled state so the container is stable */}
      <div
        data-testid="activity-pulse-chart"
        style={CHART_STYLE}
        role="img"
        aria-label={
          stalled
            ? "Sin actividad reciente — fábrica detenida"
            : `${buckets.length} minutos de actividad`
        }
      >
        {buckets.length > 0 && agents.length > 0 ? (
          (() => {
            const peak = peakCount(buckets, agents);
            return buckets.map((bucket) => (
              <BucketColumn key={bucket.minute} bucket={bucket} agents={agents} peak={peak} />
            ));
          })()
        ) : (
          /* No buckets or no agents: flat placeholder bars */
          <div
            style={{
              width: "100%",
              height: "2px",
              background: "var(--color-border, currentColor)",
              opacity: 0.2,
              borderRadius: "1px",
              alignSelf: "flex-end",
            }}
          />
        )}
      </div>

      {/* Stalled indicator — visible when the pulse is flat / no recent activity */}
      {stalled && (
        <div
          data-testid="activity-pulse-stalled"
          role="status"
          aria-label="Sin actividad reciente"
          style={STALLED_STYLE}
        >
          {/* Icon identifier — resolved to SVG by the icon renderer at higher levels */}
          <span aria-hidden="true" style={{ fontSize: "0.875rem" }}>
            ⏸
          </span>
          <span>Sin actividad reciente</span>
        </div>
      )}
    </section>
  );
}
