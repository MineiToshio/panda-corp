"use client";

/**
 * EventsRateChart — CMP-12-rate-chart (WO-12-003 UI)
 *
 * Renders the events-per-minute rate as a stacked bar chart, colored per agent.
 * This is the UI surface for the `eventsPerMinute` selector (IF-12-rate).
 *
 * Consumed by:
 *   - FRD-18 dashboard rate chart — alive-vs-stalled pulse
 *   - FRD-18 dashboard — rate chart panel
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - tabular-nums on every number (FRD-13, AC-13-003).
 *   - data-testid on every interactive / significant element (test-writer contract).
 *   - Spanish aria-labels (AGENTS.md — single operator, Spanish UI).
 *   - Empty / loading / error / stalled states implemented.
 *   - No color-only state encoding: every state uses icon + label alongside color.
 *   - prefers-reduced-motion: animations disabled via CSS media query.
 *
 * Traceability:
 *   CMP-12-rate-chart → REQ-12-007 → AC-12-007.1 → IF-12-rate → WO-12-003
 */

import type { Bucket } from "../selectors/rate/rate";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EventsRateChartProps {
  /**
   * Bucket array from `eventsPerMinute`. Pass [] while loading.
   * Each bucket covers one completed UTC minute.
   */
  buckets: Bucket[];
  /**
   * When true, render a loading skeleton instead of the chart.
   */
  isLoading?: boolean;
  /**
   * When provided, render an error state with this message.
   * Ignored when isLoading is true.
   */
  error?: string;
  /**
   * Maximum bar height in pixels.
   * @default 64
   */
  maxBarHeight?: number;
  /**
   * Optional label shown in the chart header (e.g. "Últimos 30 min").
   */
  windowLabel?: string;
  /**
   * Optional ordered list of agent names for stable color assignment.
   * When absent, agents are derived from buckets in order of first appearance.
   */
  agents?: string[];
}

// ---------------------------------------------------------------------------
// Constants — agent color CSS variables (FRD-13 IF-13-agent-colors).
// Each maps an agent role to its CSS custom property token.
// Fallback chain: agent var → accent → currentColor.
// ---------------------------------------------------------------------------

/** Map from agent name to its CSS custom property. Extensible. */
const AGENT_COLOR_VAR: Record<string, string> = {
  "frontend-dev": "var(--color-agent-frontend-dev, var(--color-accent, oklch(0.6 0.2 240)))",
  "backend-dev": "var(--color-agent-backend-dev, var(--color-accent, oklch(0.55 0.18 160)))",
  "test-writer": "var(--color-agent-test-writer, var(--color-accent, oklch(0.55 0.2 30)))",
  reviewer: "var(--color-agent-reviewer, var(--color-accent, oklch(0.6 0.18 300)))",
  researcher: "var(--color-agent-researcher, var(--color-accent, oklch(0.58 0.15 200)))",
  architect: "var(--color-agent-architect, var(--color-accent, oklch(0.55 0.17 260)))",
  librarian: "var(--color-agent-librarian, var(--color-accent, oklch(0.58 0.14 100)))",
  orchestrator: "var(--color-agent-orchestrator, var(--color-accent, oklch(0.6 0.2 340)))",
  "product-manager": "var(--color-agent-product-manager, var(--color-accent, oklch(0.58 0.16 60)))",
  designer: "var(--color-agent-designer, var(--color-accent, oklch(0.6 0.18 350)))",
  "security-auditor":
    "var(--color-agent-security-auditor, var(--color-accent, oklch(0.55 0.18 0)))",
};

/** Fallback for unknown agent names — cycles through a limited palette. */
const FALLBACK_COLORS = [
  "var(--color-accent, oklch(0.6 0.2 240))",
  "var(--color-agent-backend-dev, oklch(0.55 0.18 160))",
  "var(--color-agent-reviewer, oklch(0.6 0.18 300))",
  "var(--color-agent-librarian, oklch(0.58 0.14 100))",
  "var(--color-agent-orchestrator, oklch(0.6 0.2 340))",
];

function agentColor(agent: string, index: number): string {
  return (
    AGENT_COLOR_VAR[agent] ??
    FALLBACK_COLORS[index % FALLBACK_COLORS.length] ??
    "var(--color-accent, currentColor)"
  );
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded color values.
// ---------------------------------------------------------------------------

const CHART_SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  padding: "calc(var(--spacing, 0.25rem) * 3)",
  background: "var(--color-surface, transparent)",
  borderRadius: "var(--radius, 0.375rem)",
};

const CHART_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

const CHART_TITLE_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.75,
};

const CHART_WINDOW_STYLE: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
  fontVariantNumeric: "tabular-nums",
};

const BARS_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: "2px",
  height: "4rem",
};

const BAR_GROUP_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  flex: 1,
  gap: "1px",
};

const MINUTE_LABEL_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "2px",
  marginTop: "calc(var(--spacing, 0.25rem) * 0.5)",
};

const MINUTE_LABEL_STYLE: React.CSSProperties = {
  flex: 1,
  fontSize: "0.6rem",
  textAlign: "center",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.5,
  overflow: "hidden",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

const LEGEND_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "calc(var(--spacing, 0.25rem) * 2) calc(var(--spacing, 0.25rem) * 3)",
  marginTop: "calc(var(--spacing, 0.25rem) * 1)",
};

const LEGEND_ITEM_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  fontSize: "0.7rem",
  color: "var(--color-text-muted, currentColor)",
};

const EMPTY_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  padding: "calc(var(--spacing, 0.25rem) * 6) 0",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
  fontSize: "0.85rem",
  textAlign: "center",
};

const STALLED_BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  fontSize: "0.7rem",
  padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius, 0.375rem)",
  background: "var(--color-chip-bg, color-mix(in oklch, currentColor 8%, transparent))",
  color: "var(--color-text-muted, currentColor)",
};

const STALLED_BADGE_ACTIVE_STYLE: React.CSSProperties = {
  ...STALLED_BADGE_STYLE,
  color: "var(--color-agent-test-writer, var(--color-accent, currentColor))",
  background:
    "var(--color-fail-bg, color-mix(in oklch, var(--color-agent-test-writer, currentColor) 12%, transparent))",
};

const SKELETON_BARS_STYLE: React.CSSProperties = {
  ...BARS_ROW_STYLE,
};

const ERROR_STYLE: React.CSSProperties = {
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  color: "var(--color-agent-test-writer, var(--color-accent, currentColor))",
  fontSize: "0.85rem",
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the unique set of agents across all buckets, in first-appearance order.
 * Respects the optional `agents` prop for a stable, explicit ordering.
 */
function collectAgents(buckets: Bucket[], agentsProp?: string[]): string[] {
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
function globalMax(buckets: Bucket[]): number {
  let max = 0;
  for (const b of buckets) {
    if (b.total > max) max = b.total;
  }
  return max;
}

/** Truncate a minute key "YYYY-MM-DDTHH:MM" to just "HH:MM". */
function toTimeLabel(minute: string): string {
  // minute is exactly 16 chars: "2026-06-16T12:29"
  return minute.length >= 16 ? minute.slice(11) : minute;
}

/**
 * Detect a stalled state: all buckets have total === 0 (or no buckets).
 * Consumed by the FRD-18 dashboard rate chart.
 */
function isStalled(buckets: Bucket[]): boolean {
  if (buckets.length === 0) return true;
  return buckets.every((b) => b.total === 0);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Colored dot used in the legend. */
function AgentDot({ color }: { color: string }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

/** Single stacked bar column for one minute bucket. */
function MinuteBar({
  bucket,
  agentList,
  maxHeight,
  maxTotal,
  agentColorMap,
}: {
  bucket: Bucket;
  agentList: string[];
  maxHeight: number;
  maxTotal: number;
  agentColorMap: Map<string, string>;
}): React.JSX.Element {
  const heightPx =
    maxTotal > 0 ? Math.max(1, Math.round((bucket.total / maxTotal) * maxHeight)) : 0;
  const stalledBar = bucket.total === 0;

  const totalAriaLabel = `${toTimeLabel(bucket.minute)}: ${bucket.total} evento${bucket.total !== 1 ? "s" : ""}`;

  if (stalledBar) {
    return (
      <div
        data-testid="rate-bar-stalled"
        role="img"
        style={{
          ...BAR_GROUP_STYLE,
          justifyContent: "flex-end",
        }}
        aria-label={totalAriaLabel}
        title={totalAriaLabel}
      >
        <div
          style={{
            height: "2px",
            background: "var(--color-chip-bg, color-mix(in oklch, currentColor 12%, transparent))",
            borderRadius: "1px",
            width: "100%",
          }}
        />
      </div>
    );
  }

  // Build stacked agent segments within the bar
  const segments: React.JSX.Element[] = [];
  for (const agent of agentList) {
    const count = bucket.byAgent[agent] ?? 0;
    if (count === 0) continue;
    const segHeight = Math.max(1, Math.round((count / bucket.total) * heightPx));
    const color = agentColorMap.get(agent) ?? "var(--color-accent, currentColor)";
    segments.push(
      <div
        key={agent}
        aria-hidden="true"
        style={{
          height: `${segHeight}px`,
          background: color,
          width: "100%",
          // Restrained motion: only transform+opacity, <300ms (FRD-13)
          transition: "height 200ms var(--ease-out, ease-out)",
        }}
      />,
    );
  }

  // Events without an agent identity (counted in total but not in byAgent)
  const agentSum = Object.values(bucket.byAgent).reduce((s, n) => s + n, 0);
  const orphanCount = bucket.total - agentSum;
  if (orphanCount > 0) {
    const orphanHeight = Math.max(1, Math.round((orphanCount / bucket.total) * heightPx));
    segments.push(
      <div
        key="__no-agent"
        aria-hidden="true"
        style={{
          height: `${orphanHeight}px`,
          background: "var(--color-chip-bg, color-mix(in oklch, currentColor 20%, transparent))",
          width: "100%",
          transition: "height 200ms var(--ease-out, ease-out)",
        }}
      />,
    );
  }

  return (
    <div
      data-testid="rate-bar"
      role="img"
      style={{
        ...BAR_GROUP_STYLE,
        height: `${maxHeight}px`,
      }}
      aria-label={totalAriaLabel}
      title={totalAriaLabel}
    >
      {/* Stack from bottom: reverse so the first agent is at the bottom */}
      {segments.reverse()}
    </div>
  );
}

/** Loading skeleton for the chart. */
function RateSkeleton({ maxBarHeight }: { maxBarHeight: number }): React.JSX.Element {
  const placeholders = Array.from({ length: 10 }, (_, i) => `skel-${i}`);
  return (
    <div
      data-testid="rate-chart-loading"
      role="status"
      aria-busy="true"
      aria-label="Cargando gráfico de actividad"
      style={CHART_SECTION_STYLE}
    >
      <div style={CHART_HEADER_STYLE}>
        <div
          style={{
            height: "0.75rem",
            width: "8rem",
            borderRadius: "var(--radius, 0.375rem)",
            background: "var(--color-chip-bg, color-mix(in oklch, currentColor 12%, transparent))",
          }}
          aria-hidden="true"
        />
      </div>
      <div style={{ ...SKELETON_BARS_STYLE, height: `${maxBarHeight}px` }}>
        {placeholders.map((k, i) => (
          <div
            key={k}
            aria-hidden="true"
            style={{
              flex: 1,
              height: `${Math.max(6, Math.round(maxBarHeight * (0.2 + (i % 4) * 0.2)))}px`,
              background:
                "var(--color-chip-bg, color-mix(in oklch, currentColor 12%, transparent))",
              borderRadius: "2px",
              alignSelf: "flex-end",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * EventsRateChart — renders the events-per-minute rate bar chart.
 *
 * Each bar column is one completed minute bucket from `eventsPerMinute`.
 * Segments within each bar are stacked per agent, using the FRD-13 agent color tokens.
 * When all buckets are zeroed, a "Fábrica detenida" stalled state is shown.
 *
 * This component is "use client" because it renders interactive bars
 * (hover tooltips via title attributes, transitions). If used in an RSC context,
 * pass pre-computed buckets from a Server Component parent.
 */
export function EventsRateChart({
  buckets,
  isLoading = false,
  error,
  maxBarHeight = 64,
  windowLabel,
  agents: agentsProp,
}: EventsRateChartProps): React.JSX.Element {
  // --- Loading state ---
  if (isLoading) {
    return <RateSkeleton maxBarHeight={maxBarHeight} />;
  }

  // --- Error state ---
  if (typeof error === "string") {
    return (
      <div
        data-testid="rate-chart-error"
        role="alert"
        aria-label="Error al cargar el gráfico de actividad"
        style={CHART_SECTION_STYLE}
      >
        <p style={ERROR_STYLE}>
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      </div>
    );
  }

  // --- Empty state — no buckets at all ---
  if (buckets.length === 0) {
    return (
      <div
        data-testid="rate-chart-empty"
        role="status"
        aria-label="Sin datos de actividad"
        style={{ ...CHART_SECTION_STYLE, ...EMPTY_STYLE }}
      >
        <span aria-hidden="true" style={{ fontSize: "1.5rem" }}>
          —
        </span>
        <span>Sin datos de actividad</span>
      </div>
    );
  }

  // --- Derive display data ---
  const agentList = collectAgents(buckets, agentsProp);
  const maxTotal = globalMax(buckets);
  const stalled = isStalled(buckets);

  // Build stable color map: agent → CSS color string
  const agentColorMap = new Map<string, string>();
  for (const [idx, agent] of agentList.entries()) {
    agentColorMap.set(agent, agentColor(agent, idx));
  }

  // Compute the label for the last minute in the window
  const lastMinuteLabel =
    buckets.length > 0 ? toTimeLabel(buckets[buckets.length - 1]?.minute ?? "") : "";

  // Total events across the whole window for the summary
  const totalInWindow = buckets.reduce((s, b) => s + b.total, 0);

  return (
    <section
      data-testid="rate-chart"
      aria-label={`Gráfico de actividad: ${totalInWindow} evento${totalInWindow !== 1 ? "s" : ""} en la ventana`}
      style={CHART_SECTION_STYLE}
    >
      {/* Header row: title + stalled/live badge + window label */}
      <div style={CHART_HEADER_STYLE}>
        <span style={CHART_TITLE_STYLE}>Eventos / min</span>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "calc(var(--spacing, 0.25rem) * 2)",
          }}
        >
          {/* Stalled / alive badge — never color-only: always has icon + label */}
          {stalled ? (
            <span
              data-testid="rate-chart-stalled-badge"
              role="status"
              aria-label="Fábrica detenida — sin actividad reciente"
              style={STALLED_BADGE_ACTIVE_STYLE}
            >
              <span aria-hidden="true">■</span>
              Detenida
            </span>
          ) : (
            <span
              data-testid="rate-chart-live-badge"
              role="status"
              aria-label="Fábrica activa"
              style={STALLED_BADGE_STYLE}
            >
              <span aria-hidden="true">▶</span>
              Activa
            </span>
          )}

          {windowLabel && <span style={CHART_WINDOW_STYLE}>{windowLabel}</span>}
        </div>
      </div>

      {/* Bar chart — one column per bucket, stacked by agent */}
      <div
        data-testid="rate-chart-bars"
        aria-label={`Barras de actividad — último minuto: ${lastMinuteLabel}`}
        style={BARS_ROW_STYLE}
        role="img"
      >
        {buckets.map((bucket) => (
          <MinuteBar
            key={bucket.minute}
            bucket={bucket}
            agentList={agentList}
            maxHeight={maxBarHeight}
            maxTotal={maxTotal}
            agentColorMap={agentColorMap}
          />
        ))}
      </div>

      {/* Time-axis labels: show first and last minute */}
      <div style={MINUTE_LABEL_ROW_STYLE} aria-hidden="true">
        {buckets.map((bucket, i) => {
          // Only render a label for the first and last bucket to avoid crowding
          const isFirst = i === 0;
          const isLast = i === buckets.length - 1;
          if (!isFirst && !isLast) {
            return <div key={bucket.minute} style={MINUTE_LABEL_STYLE} />;
          }
          return (
            <div key={bucket.minute} style={MINUTE_LABEL_STYLE}>
              {toTimeLabel(bucket.minute)}
            </div>
          );
        })}
      </div>

      {/* Summary row: total events */}
      <div
        data-testid="rate-chart-summary"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "0.7rem",
          color: "var(--color-text-muted, currentColor)",
          opacity: 0.8,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>
          Total: <strong style={{ fontVariantNumeric: "tabular-nums" }}>{totalInWindow}</strong>
        </span>
      </div>

      {/* Agent color legend — only shown when there are agents to display */}
      {agentList.length > 0 && (
        <ul
          data-testid="rate-chart-legend"
          aria-label="Leyenda de agentes"
          style={{ ...LEGEND_ROW_STYLE, listStyle: "none", margin: 0, padding: 0 }}
        >
          {agentList.map((agent) => {
            const color = agentColorMap.get(agent) ?? "var(--color-accent, currentColor)";
            // Sum this agent's total across all buckets for the legend count
            const agentTotal = buckets.reduce((s, b) => s + (b.byAgent[agent] ?? 0), 0);
            return (
              <li
                key={agent}
                data-testid={`rate-chart-legend-item-${agent}`}
                style={LEGEND_ITEM_STYLE}
                aria-label={`${agent}: ${agentTotal} evento${agentTotal !== 1 ? "s" : ""}`}
              >
                <AgentDot color={color} />
                <span>{agent}</span>
                <span
                  style={{ fontVariantNumeric: "tabular-nums", opacity: 0.7 }}
                  data-testid={`rate-chart-legend-count-${agent}`}
                >
                  {agentTotal}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
