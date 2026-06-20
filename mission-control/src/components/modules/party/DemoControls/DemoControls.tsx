/**
 * CMP-13-party-demo-controls — DR-061 SOLO DEMO wrapper (WO-13-009, FND-4)
 *
 * Canonical wrapper for preview-only controls. Wraps any demo children in:
 *   - dashed border (bd2 color)
 *   - "🔧 SOLO DEMO" badge (warn-colored)
 *   - one-line explanatory note
 *
 * Never ships in read-only Mission Control. Used only in preview routes and
 * the mock HTML to demonstrate states that require interactive controls.
 *
 * Design contract (party mocks / la-fragua.html .controls.demo):
 *   - border: 1px dashed var(--color-border-strong)
 *   - border-radius 10px, padding 8px 11px
 *   - background: rgba(255,255,255,.012) (structural literal, theme-neutral)
 *   - .demobadge: mono 10px, warn color, warn-bg, warn border, radius 6px
 *   - .demonote: text3, 11px
 *
 * Tokens only on semantic colors. The rgba(.012) bg is a structural literal.
 * Server Component — no "use client".
 * Traceability: WO-13-009 → DR-061
 */

import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DemoControlsProps {
  /** One-line explanatory note about why these controls are demo-only. */
  note: string;
  /** The demo-only control children (mode selectors, pause/reset buttons, etc.). */
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const ROOT_STYLE: CSSProperties = {
  border: "1px dashed var(--color-border-strong)",
  borderRadius: "10px",
  padding: "8px 11px",
  background: "rgba(255,255,255,.012)",
  display: "flex",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap",
};

const BADGE_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  color: "var(--color-warn)",
  background: "var(--color-warn-bg)",
  border: "1px solid var(--color-warn)",
  borderRadius: "6px",
  padding: "2px 7px",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const NOTE_STYLE: CSSProperties = {
  color: "var(--color-text3)",
  fontSize: "11px",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DR-061 SOLO DEMO wrapper.
 * Wraps demo-only controls with a dashed border + badge + note.
 * Never rendered in production read-only Mission Control.
 *
 * @param props.note     - one-line explanation of why controls are demo-only
 * @param props.children - the demo-only controls
 */
export function DemoControls({ note, children }: DemoControlsProps): React.JSX.Element {
  return (
    <div data-testid="demo-controls-root" style={ROOT_STYLE}>
      <span data-testid="demo-controls-badge" style={BADGE_STYLE}>
        🔧 SOLO DEMO
      </span>
      <span data-testid="demo-controls-note" style={NOTE_STYLE}>
        {note}
      </span>
      {children}
    </div>
  );
}
