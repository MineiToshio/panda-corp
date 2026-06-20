/**
 * CMP-13-party-flow-strip — Shared pixel-RPG FlowStrip (WO-13-009, FND-4)
 *
 * Always-visible 8-beat pipeline row with → arrows.
 * Inactive beats at .45 opacity; active beat(s) lit.
 * Per-beat hover tooltip (REQ-06-010).
 *
 * Design contract (party mocks / la-fragua.html .flowstrip):
 *   - flex row, panel bg, bd border, border-radius 12px, padding 9px 8px
 *   - .fstep: flex column, centered, opacity .45 inactive / 1 active
 *   - active beat: card bg + bd2 → accent border (border 1px solid var(--color-accent))
 *   - .ftip: tooltip above beat (bottom 100%+9px, width 236px)
 *   - .farrow: bd2-colored → separator
 *   - cursor: help on each beat
 *   - embed mode: hidden (controlled by parent, not by this component)
 *
 * Server Component — pure presentational, no "use client".
 * Traceability: WO-13-009 → REQ-06-010
 */

import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlowBeat {
  /** Unique key for this beat. */
  key: string;
  /** Emoji or icon character. */
  icon: string;
  /** Spanish label (pixel font). */
  label: string;
  /** Sub-label (mono font, small). */
  sub: string;
  /** Optional tooltip body content. */
  tipBody?: ReactNode;
}

export interface FlowStripProps {
  /** Ordered array of pipeline beats (should be 8). */
  beats: readonly FlowBeat[];
  /** Keys of beats that are currently active/lit. */
  activeKeys: readonly string[];
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const ROOT_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  padding: "9px 8px",
  background: "var(--color-panel)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  position: "relative",
};

function stepStyle(active: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 2,
    flex: 1,
    padding: "5px 4px",
    borderRadius: "8px",
    opacity: active ? 1 : 0.45,
    transition: "opacity 0.25s, background 0.25s, border-color 0.25s",
    border: active ? "1px solid var(--color-accent)" : "1px solid transparent",
    background: active ? "var(--color-card)" : "transparent",
    position: "relative",
    cursor: "help",
  };
}

const ICON_STYLE: CSSProperties = {
  fontSize: "17px",
  lineHeight: 1,
};

const LABEL_STYLE: CSSProperties = {
  fontFamily: "var(--font-pixel)",
  fontSize: "11px",
  color: "var(--color-text)",
  whiteSpace: "nowrap",
  letterSpacing: "0.02em",
};

const ACTIVE_LABEL_STYLE: CSSProperties = {
  ...LABEL_STYLE,
  color: "var(--color-accent-text)",
};

const SUB_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "8.5px",
  color: "var(--color-text3)",
  whiteSpace: "nowrap",
};

const TIP_STYLE: CSSProperties = {
  position: "absolute",
  bottom: "calc(100% + 9px)",
  left: "50%",
  transform: "translateX(-50%)",
  width: "236px",
  background: "var(--color-card2)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "9px",
  padding: "8px 11px",
  fontFamily: "var(--font-display)",
  fontSize: "11.5px",
  lineHeight: 1.42,
  color: "var(--color-text2)",
  textAlign: "left",
  zIndex: 60,
  boxShadow: "var(--shadow-2)",
  // CSS-only tooltip: hidden by default; shown on .fstep:hover via parent CSS
  // In React/SSR we always render it; hover is handled by CSS via parent group
  display: "none",
  pointerEvents: "none",
};

const TIP_LABEL_STYLE: CSSProperties = {
  display: "block",
  fontFamily: "var(--font-pixel)",
  fontWeight: 500,
  color: "var(--color-accent-text)",
  marginBottom: 3,
  fontSize: "12px",
};

const ARROW_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  color: "var(--color-border-strong)",
  fontSize: "12px",
  padding: "0 1px",
  flex: "0 0 auto",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * FlowStrip — the always-visible 8-beat pipeline row.
 * Active beats are lit; inactive beats dim to .45 opacity.
 * Per-beat tooltip shows on hover (CSS-driven; rendered in DOM for SSR).
 *
 * @param props.beats      - ordered pipeline beats (8 total)
 * @param props.activeKeys - keys of currently active beats
 */
export function FlowStrip({ beats, activeKeys }: FlowStripProps): React.JSX.Element {
  const activeSet = new Set(activeKeys);

  return (
    <nav
      data-testid="flow-strip-root"
      aria-label="Pipeline de construcción completo"
      style={ROOT_STYLE}
    >
      {beats.map((beat, i) => {
        const active = activeSet.has(beat.key);
        return (
          <div key={beat.key} style={{ display: "flex", alignItems: "stretch", flex: 1 }}>
            {/* Beat step */}
            <div
              data-testid={`flow-beat-${beat.key}`}
              data-active={String(active)}
              data-beat-key={beat.key}
              style={stepStyle(active)}
            >
              {/* Hover tooltip (CSS display:none; shown via :hover in globals.css or inline group) */}
              <span data-testid={`flow-tip-${beat.key}`} style={TIP_STYLE}>
                <b style={TIP_LABEL_STYLE}>{beat.label}</b>
                {beat.tipBody ?? beat.sub}
              </span>

              <span aria-hidden="true" style={ICON_STYLE}>
                {beat.icon}
              </span>
              <span style={active ? ACTIVE_LABEL_STYLE : LABEL_STYLE}>{beat.label}</span>
              <span style={SUB_STYLE}>{beat.sub}</span>
            </div>

            {/* → arrow separator between beats (not after the last one) */}
            {i < beats.length - 1 && (
              <span data-testid="flow-arrow" aria-hidden="true" style={ARROW_STYLE}>
                →
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
