/**
 * CMP-13-party-parchment — Shared pixel-RPG Parchment (WO-13-009, FND-4)
 *
 * The 📜 Status-Note hand-off element travelling closed-WO → dependent station.
 * Presentational decoration of the real HandoffWritten event.
 *
 * Design contract (party mocks / la-fragua.html .parchment):
 *   - position absolute, width 22px, height 22px
 *   - flex centered, font-size 15px (the 📜 emoji)
 *   - z-index 8, pointer-events none
 *   - filter: drop-shadow(0 0 6px var(--color-warn)) — warm hand-off glow
 *   - aria-hidden: decorative (the real status note is accessible in the feed)
 *
 * Tokens only. Server Component — no "use client".
 * Traceability: WO-13-009 → REQ-06-006
 */

import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParchmentProps {
  /** WO id this parchment comes from (the Status Note author). */
  from: string;
  /** WO id this parchment travels to (the dependent). */
  to: string;
  /** Optional inline style for absolute positioning on the stage. */
  style?: CSSProperties;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Parchment — the travelling 📜 Status-Note hand-off visual.
 * Purely decorative; aria-hidden. Positioned on the stage via `style`.
 *
 * @param props.from  - source WO id
 * @param props.to    - destination WO id
 * @param props.style - absolute positioning on stage
 */
export function Parchment({ from, to, style }: ParchmentProps): React.JSX.Element {
  const rootStyle: CSSProperties = {
    position: "absolute",
    width: "22px",
    height: "22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "15px",
    zIndex: 8,
    pointerEvents: "none",
    filter: "drop-shadow(0 0 6px var(--color-warn))",
    ...style,
  };

  return (
    <div
      data-testid="parchment-root"
      data-from={from}
      data-to={to}
      aria-hidden="true"
      style={rootStyle}
    >
      📜
    </div>
  );
}
