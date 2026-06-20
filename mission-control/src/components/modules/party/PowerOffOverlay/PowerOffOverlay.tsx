/**
 * CMP-13-party-power-off-overlay — Factory-off treatment (WO-13-009, FND-4)
 *
 * Derived from real state (off prop), never a toggle.
 * When off=true: covers the stage with a dark scrim + "⏻ Fábrica apagada" title.
 * When off=false: display:none (not presented to screen readers when hidden).
 *
 * Design contract (party mocks / la-fragua.html .poweroff):
 *   - position absolute, inset 0, z-index 500
 *   - display:none when inactive; flex column centered when active
 *   - background: rgba(10,13,14,.5), border-radius 14px
 *   - .pz: pixel font 24px, text1 color, text-shadow
 *   - .pzs: mono 12px, text2 color
 *   - body.off: desaturates rooms, agents, bridges, parchments (CSS handled by stage/scene)
 *
 * Tokens only on semantic values. The rgba(.5) overlay is a structural literal.
 * Server Component — no "use client".
 * Traceability: WO-13-009 → REQ-06-013
 */

import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PowerOffOverlayProps {
  /**
   * Derived from real state — true when no build is running
   * (factory is powered down). Never a user-toggled prop.
   */
  off: boolean;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function rootStyle(off: boolean): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    zIndex: 500,
    display: off ? "flex" : "none",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    background: "rgba(10,13,14,.5)",
    borderRadius: "14px",
    textAlign: "center",
  };
}

const TITLE_STYLE: CSSProperties = {
  fontFamily: "var(--font-pixel)",
  fontSize: "24px",
  color: "var(--color-text)",
  letterSpacing: "0.03em",
  textShadow: "0 2px 8px rgba(0,0,0,.85)",
};

const SUBTITLE_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  color: "var(--color-text2)",
  textShadow: "0 1px 5px rgba(0,0,0,.85)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Factory-off overlay for the Party stage.
 * Derived-state only (never a button/toggle).
 * Covers the stage when the factory is powered down.
 *
 * @param props.off - true when no build is running
 */
export function PowerOffOverlay({ off }: PowerOffOverlayProps): React.JSX.Element {
  return (
    <div data-testid="power-off-overlay-root" data-off={String(off)} style={rootStyle(off)}>
      <div data-testid="power-off-title" style={TITLE_STYLE}>
        ⏻ Fábrica apagada
      </div>
      <div data-testid="power-off-subtitle" style={SUBTITLE_STYLE}>
        sin build en curso · en Mission Control la fábrica se enciende al lanzar
        /pandacorp:implement
      </div>
    </div>
  );
}
