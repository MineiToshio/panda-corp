"use client";

/**
 * EventsRateChart sub-components — CMP-12-rate-chart (WO-12-003 UI).
 *
 * Internal presentational parts of the EventsRateChart surface: the legend dot,
 * a single stacked minute bar, and the loading skeleton. "use client" because
 * they render interactive bars (hover tooltips via title attributes, transitions).
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - data-testid on every interactive / significant element (test-writer contract).
 *   - Spanish aria-labels (AGENTS.md — single operator, Spanish UI).
 *   - prefers-reduced-motion: animations disabled via CSS media query.
 *
 * Traceability:
 *   CMP-12-rate-chart → REQ-12-007 → AC-12-007.1 → IF-12-rate → WO-12-003
 */

import type { Bucket } from "../selectors/rate/rate";
import { toTimeLabel } from "./helpers";
import {
  BAR_GROUP_STYLE,
  CHART_HEADER_STYLE,
  CHART_SECTION_STYLE,
  SKELETON_BARS_STYLE,
} from "./styles";

/** Colored dot used in the legend. */
export function AgentDot({ color }: { color: string }): React.JSX.Element {
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
export function MinuteBar({
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
export function RateSkeleton({ maxBarHeight }: { maxBarHeight: number }): React.JSX.Element {
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
