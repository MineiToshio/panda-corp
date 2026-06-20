/**
 * CMP-13-party-tooltip — Shared pixel-RPG Tooltip (.wotip) (WO-13-009, FND-4)
 *
 * Hover tooltip for a sprite/beat (WO id+title; phase role+name).
 * Presentational: content + optional anchor positioning.
 *
 * Design contract (party mocks / la-fragua.html .ag .wotip):
 *   - position absolute, bottom 52px, left 50%, translateX(-50%)
 *   - panel bg, accent border (1px solid var(--color-accent))
 *   - radius 8px, padding 4px 9px
 *   - mono font 10px, color text
 *   - ::after tail (border-top-color panel)
 *   - box-shadow: 0 5px 14px rgba(0,0,0,.55)
 *   - display:none by default; shown on parent :hover via CSS
 *
 * Tokens only. Server Component — no "use client".
 * Traceability: WO-13-009 → REQ-06-002.3 / REQ-06-010.3
 */

import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TooltipProps {
  /** Content to render inside the tooltip (WO id+title or phase label). */
  content: ReactNode;
  /**
   * Optional anchor position overrides (bottom/left/transform etc.).
   * Default: bottom 52px, left 50%, translateX(-50%).
   */
  anchor?: CSSProperties;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Hover tooltip (.wotip) for Party sprites and FlowStrip beats.
 * Display is CSS-driven (parent :hover); this component renders it always
 * in the DOM for SSR (display:none by default in the mock, toggled by :hover).
 *
 * @param props.content - tooltip body (WO id+title or beat label)
 * @param props.anchor  - optional positioning overrides
 */
export function Tooltip({ content, anchor }: TooltipProps): React.JSX.Element {
  const rootStyle: CSSProperties = {
    position: "absolute",
    bottom: "52px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "var(--color-panel)",
    border: "1px solid var(--color-accent)",
    borderRadius: "8px",
    padding: "4px 9px",
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    color: "var(--color-text)",
    whiteSpace: "nowrap",
    zIndex: 30,
    boxShadow: "0 5px 14px rgba(0,0,0,.55)",
    pointerEvents: "none",
    ...anchor,
  };

  const tailStyle: CSSProperties = {
    position: "absolute",
    top: "100%",
    left: "50%",
    transform: "translateX(-50%)",
    width: 0,
    height: 0,
    borderLeft: "5px solid transparent",
    borderRight: "5px solid transparent",
    borderTop: "5px solid var(--color-panel)",
    marginTop: "-1px",
  };

  return (
    <div data-testid="tooltip-root" role="tooltip" style={rootStyle}>
      {content}
      <span data-testid="tooltip-tail" aria-hidden="true" style={tailStyle} />
    </div>
  );
}
