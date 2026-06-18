/**
 * EventsRateChart styles & agent-color tokens — CMP-12-rate-chart (WO-12-003 UI).
 *
 * Pure style/token module for the EventsRateChart surface. No JSX, so no
 * "use client" needed.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - tabular-nums on every number (FRD-13, AC-13-003).
 */

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

/** Resolve an agent's bar/legend color, falling back through the palette. */
export function agentColor(agent: string, index: number): string {
  return (
    AGENT_COLOR_VAR[agent] ??
    FALLBACK_COLORS[index % FALLBACK_COLORS.length] ??
    "var(--color-accent, currentColor)"
  );
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded color values.
// ---------------------------------------------------------------------------

export const CHART_SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  padding: "calc(var(--spacing, 0.25rem) * 3)",
  background: "var(--color-surface, transparent)",
  borderRadius: "var(--radius, 0.375rem)",
};

export const CHART_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

export const CHART_TITLE_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.75,
};

export const CHART_WINDOW_STYLE: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
  fontVariantNumeric: "tabular-nums",
};

export const BARS_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: "2px",
  height: "4rem",
};

export const BAR_GROUP_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  flex: 1,
  gap: "1px",
};

export const MINUTE_LABEL_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "2px",
  marginTop: "calc(var(--spacing, 0.25rem) * 0.5)",
};

export const MINUTE_LABEL_STYLE: React.CSSProperties = {
  flex: 1,
  fontSize: "0.6rem",
  textAlign: "center",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.5,
  overflow: "hidden",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

export const LEGEND_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "calc(var(--spacing, 0.25rem) * 2) calc(var(--spacing, 0.25rem) * 3)",
  marginTop: "calc(var(--spacing, 0.25rem) * 1)",
};

export const LEGEND_ITEM_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  fontSize: "0.7rem",
  color: "var(--color-text-muted, currentColor)",
};

export const EMPTY_STYLE: React.CSSProperties = {
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

export const STALLED_BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  fontSize: "0.7rem",
  padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius, 0.375rem)",
  background: "var(--color-chip-bg, color-mix(in oklch, currentColor 8%, transparent))",
  color: "var(--color-text-muted, currentColor)",
};

export const STALLED_BADGE_ACTIVE_STYLE: React.CSSProperties = {
  ...STALLED_BADGE_STYLE,
  color: "var(--color-agent-test-writer, var(--color-accent, currentColor))",
  background:
    "var(--color-fail-bg, color-mix(in oklch, var(--color-agent-test-writer, currentColor) 12%, transparent))",
};

export const SKELETON_BARS_STYLE: React.CSSProperties = {
  ...BARS_ROW_STYLE,
};

export const ERROR_STYLE: React.CSSProperties = {
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  color: "var(--color-agent-test-writer, var(--color-accent, currentColor))",
  fontSize: "0.85rem",
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};
