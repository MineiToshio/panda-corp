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
 * Internal pieces live in sibling modules:
 *   - styles.ts  — `*_STYLE` constants + agent color tokens + `agentColor()`.
 *   - helpers.ts — pure helpers (collectAgents, globalMax, toTimeLabel, isStalled).
 *   - parts.tsx  — sub-components (AgentDot, MinuteBar, RateSkeleton).
 *
 * Traceability:
 *   CMP-12-rate-chart → REQ-12-007 → AC-12-007.1 → IF-12-rate → WO-12-003
 */

import type { Bucket } from "../selectors/rate/rate";
import { collectAgents, globalMax, isStalled, toTimeLabel } from "./helpers";
import { AgentDot, MinuteBar, RateSkeleton } from "./parts";
import {
  agentColor,
  BARS_ROW_STYLE,
  CHART_HEADER_STYLE,
  CHART_SECTION_STYLE,
  CHART_TITLE_STYLE,
  CHART_WINDOW_STYLE,
  EMPTY_STYLE,
  ERROR_STYLE,
  LEGEND_ITEM_STYLE,
  LEGEND_ROW_STYLE,
  MINUTE_LABEL_ROW_STYLE,
  MINUTE_LABEL_STYLE,
  STALLED_BADGE_ACTIVE_STYLE,
  STALLED_BADGE_STYLE,
} from "./styles";

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
