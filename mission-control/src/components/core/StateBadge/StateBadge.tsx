/**
 * WO-13-005 — StateBadge (CMP-13-state-badge)
 *
 * Renders a state as icon + shape + Spanish label — NEVER color-only.
 * AC-13-007.1 (REQ-13-007): each state paired with an icon/shape + label.
 * AC-13-008.1 (REQ-13-008): Spanish aria-label on the badge container.
 *
 * Consumed by: Party sprites/feed (FRD-06), DAG nodes (FRD-12),
 *              board/portfolio chips (FRD-02/FRD-03).
 *
 * Color is reinforcement only — the icon shape and label are the primary signals
 * (critical with the warm palette: reds/oranges/amber are close together).
 *
 * Lucide identifier strings stored in STATE_BADGE.icon are rendered as inline SVG
 * shape primitives — no external dependency on lucide-react is required.
 * The `data-icon` attribute carries the Lucide identifier so downstream consumers
 * and tests can verify the shape signal without parsing SVG path content.
 *
 * Accessibility model:
 *   - The outer <span role="img"> carries aria-label (the Spanish state label).
 *   - Inner SVGs are decorative: aria-hidden="true" role="presentation" stated
 *     explicitly on each element (biome noSvgWithoutTitle requires explicit attrs).
 *   - The visible <span> label provides the text signal so the badge is never
 *     color-only and is readable without assistive technology.
 */

import type { AgentState } from "@/app/_design/tokens";
import { AGENT_STATES, STATE_BADGE } from "@/app/_design/tokens";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StateBadgeProps {
  /** The canonical agent state to render. Unknown values render a safe fallback. */
  state: AgentState;
  /** Optional size variant. Defaults to "md". */
  size?: "sm" | "md";
}

// ---------------------------------------------------------------------------
// Fallback entry for unknown states (never crashes, always shows a label)
// ---------------------------------------------------------------------------

const FALLBACK_ENTRY = { icon: "help-circle", label: "Desconocido" };

function getEntry(state: string): { icon: string; label: string } {
  const isCanonical = (AGENT_STATES as readonly string[]).includes(state);
  if (isCanonical) {
    return STATE_BADGE[state as AgentState];
  }
  return FALLBACK_ENTRY;
}

// ---------------------------------------------------------------------------
// Inline SVG icon shapes
// Each SVG is decorative: aria-hidden + role="presentation" stated explicitly
// so biome's noSvgWithoutTitle rule is satisfied without a <title> element.
// All shapes are geometrically distinct so no two states share the same icon.
// ---------------------------------------------------------------------------

const ICON_SIZES = { sm: 14, md: 16 } as const;

function IconShape({ icon, size }: { icon: string; size: 14 | 16 }): React.JSX.Element {
  const r = size;
  const c = r / 2;
  const sw = 1.5;

  // Shared non-a11y SVG attributes (geometry + stroke style only).
  // aria-hidden and role are stated explicitly on each <svg> element below
  // because biome's static analysis does not peer through object spreads.
  const geo = {
    width: r,
    height: r,
    viewBox: `0 0 ${r} ${r}`,
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (icon) {
    // working — loader arc (gap at top suggests motion/rotation)
    case "loader-circle":
      return (
        <svg {...geo} aria-hidden="true" role="presentation">
          <path d={`M ${c} 2 A ${c - 2} ${c - 2} 0 1 1 ${c - 0.01} 2`} strokeLinecap="round" />
        </svg>
      );

    // idle — dashed circle (passive / waiting state)
    case "circle-dashed":
      return (
        <svg {...geo} aria-hidden="true" role="presentation">
          <circle cx={c} cy={c} r={c - 2} strokeDasharray="3 2" />
        </svg>
      );

    // failed — solid circle + X (distinct from circle-check)
    case "circle-x":
      return (
        <svg {...geo} aria-hidden="true" role="presentation">
          <circle cx={c} cy={c} r={c - 2} />
          <line x1={c - 2} y1={c - 2} x2={c + 2} y2={c + 2} />
          <line x1={c + 2} y1={c - 2} x2={c - 2} y2={c + 2} />
        </svg>
      );

    // completed — solid circle + checkmark (distinct from circle-x)
    case "circle-check":
      return (
        <svg {...geo} aria-hidden="true" role="presentation">
          <circle cx={c} cy={c} r={c - 2} />
          <polyline points={`${c - 2.5},${c} ${c - 0.5},${c + 2} ${c + 2.5},${c - 2}`} />
        </svg>
      );

    // blocked — prohibition circle with diagonal slash
    case "ban":
      return (
        <svg {...geo} aria-hidden="true" role="presentation">
          <circle cx={c} cy={c} r={c - 2} />
          <line
            x1={c - (c - 2) * 0.7}
            y1={c - (c - 2) * 0.7}
            x2={c + (c - 2) * 0.7}
            y2={c + (c - 2) * 0.7}
          />
        </svg>
      );

    // reviewing — eye with pupil
    case "eye":
      return (
        <svg {...geo} aria-hidden="true" role="presentation">
          <path d={`M 2 ${c} C ${c - 2} ${c - 3}, ${c + 2} ${c - 3}, ${r - 2} ${c}`} />
          <path d={`M 2 ${c} C ${c - 2} ${c + 3}, ${c + 2} ${c + 3}, ${r - 2} ${c}`} />
          <circle cx={c} cy={c} r={1.5} fill="currentColor" stroke="none" />
        </svg>
      );

    // fallback — diamond shape for unknown icon identifiers
    default:
      return (
        <svg {...geo} aria-hidden="true" role="presentation">
          <polygon points={`${c},2 ${r - 2},${c} ${c},${r - 2} 2,${c}`} />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// StateBadge component (CMP-13-state-badge)
// ---------------------------------------------------------------------------

/**
 * StateBadge — renders an agent state as icon + shape + Spanish label.
 *
 * Contract guarantees (WO-13-005):
 *   - Always renders `data-testid="state-badge"` (never omitted).
 *   - `data-icon` = the Lucide identifier string from STATE_BADGE[state].icon.
 *   - `data-state` = the state value (enables non-color CSS styling by consumers).
 *   - `aria-label` = the Spanish label (AC-13-008.1; never empty).
 *   - Visible label text in the DOM (AC-13-007.1; not color-only).
 *   - No hardcoded hex colors in inline style attributes (FRD-13 §3).
 *   - Unknown or empty state → safe fallback ("Desconocido"), never throws.
 *
 * role="img" on the outer span is required so `aria-label` is semantically
 * valid (biome lint/a11y/useAriaPropsSupportedByRole).
 */
export function StateBadge({ state, size = "md" }: StateBadgeProps): React.JSX.Element {
  const stateStr = typeof state === "string" ? state : "";
  const entry = getEntry(stateStr);
  const iconSize = ICON_SIZES[size];

  return (
    <span
      role="img"
      data-testid="state-badge"
      data-icon={entry.icon}
      data-state={stateStr}
      aria-label={entry.label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        // Colors via CSS custom properties only — no hardcoded hex (FRD-13 §3)
        color: "var(--color-state-text, currentColor)",
      }}
    >
      <IconShape icon={entry.icon} size={iconSize} />
      <span>{entry.label}</span>
    </span>
  );
}
