/**
 * CMP-13-party-speech-bubble — Shared pixel-RPG SpeechBubble (WO-13-009, FND-4)
 *
 * WO caption bubble shown when an agent is in "say-on" state.
 * Presentational: text in, bubble out. The visibility is toggled by the parent
 * scene via CSS class or data-attr (the scene drives say-on, not this component).
 *
 * Design contract (party mocks / la-fragua.html .ag .say):
 *   - position absolute, bottom 48px, left 50% translateX(-50%)
 *   - max-width 150px; width max-content
 *   - panel bg, bd2 border, radius 8px, padding 4px 8px
 *   - mono font, 10px, line-height 1.3
 *   - ::after tail pointer (border-top-color panel)
 *   - raised: bottom 92px (even columns talk higher to avoid overlap)
 *   - aria-hidden: decorative (agent state is conveyed by the feed/StateBadge)
 *
 * Tokens only. Server Component — no "use client".
 * Traceability: WO-13-009 → REQ-06-017
 */

import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpeechBubbleProps {
  /** The text displayed inside the bubble. */
  text: string;
  /**
   * When true the bubble renders higher (bottom 92px instead of 48px).
   * Used for even-column sprites so adjacent bubbles don't overlap.
   */
  raised?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Agent speech bubble (say-on / sayin state).
 * aria-hidden — decorative; the real WO status is in the event feed.
 *
 * @param props.text   - bubble text
 * @param props.raised - true for even-column agents (renders higher)
 */
export function SpeechBubble({ text, raised = false }: SpeechBubbleProps): React.JSX.Element {
  const rootStyle: CSSProperties = {
    position: "absolute",
    bottom: raised ? "92px" : "48px",
    left: "50%",
    transform: "translateX(-50%)",
    maxWidth: "150px",
    width: "max-content",
    background: "var(--color-panel)",
    border: "1px solid var(--color-border-strong)",
    borderRadius: "8px",
    padding: "4px 8px",
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    lineHeight: 1.3,
    color: "var(--color-text)",
    textAlign: "center",
    zIndex: 9,
    boxShadow: "0 3px 10px rgba(0,0,0,.4)",
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
    <div
      data-testid="speech-bubble-root"
      data-raised={String(raised)}
      aria-hidden="true"
      style={rootStyle}
    >
      <span data-testid="speech-bubble-text">{text}</span>
      <span data-testid="speech-bubble-tail" aria-hidden="true" style={tailStyle} />
    </div>
  );
}
