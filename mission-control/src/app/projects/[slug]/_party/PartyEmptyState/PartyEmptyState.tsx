/**
 * WO-06-011 — PartyEmptyState (CMP-06-empty)
 *
 * Graceful empty state for the Party tab when there is no active team.
 * AC-06-010.1: IF there is no active team, it SHALL show an empty state gracefully.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - Spanish copy (UI in Spanish per AGENTS.md).
 *   - data-testid="party-empty-state" always present.
 *   - Never a blank/crash.
 *
 * Traceability:
 *   CMP-06-empty → REQ-06-010 (AC-06-010.1)
 */

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded colors (FRD-13)
// ---------------------------------------------------------------------------

const CONTAINER_STYLE: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  padding: "calc(var(--spacing, 0.25rem) * 12)",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.7,
  textAlign: "center",
};

const ICON_STYLE: React.CSSProperties = {
  fontSize: "2.5rem",
  lineHeight: 1,
};

const HEADING_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "1rem",
  fontWeight: 600,
  color: "var(--color-text, currentColor)",
  opacity: 0.85,
};

const BODY_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "0.875rem",
  lineHeight: 1.5,
  maxWidth: "28ch",
};

const HINT_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "0.75rem",
  opacity: 0.6,
  lineHeight: 1.5,
  maxWidth: "32ch",
};

// ---------------------------------------------------------------------------
// PartyEmptyState component
// ---------------------------------------------------------------------------

/**
 * Friendly empty state when no active build team is running.
 * Provides guidance to the operator without crashing or being blank.
 * AC-06-010.1: graceful empty state.
 */
export function PartyEmptyState(): React.JSX.Element {
  return (
    <div
      data-testid="party-empty-state"
      role="status"
      aria-label="Sin FRD en construcción — no hay agentes activos"
      style={CONTAINER_STYLE}
    >
      {/* Icon — visual hint (aria-hidden since label above covers it) */}
      <span aria-hidden="true" style={ICON_STYLE}>
        ⚔️
      </span>

      {/* Main message — La Fragua per-FRD framing (WO-06-011 retry) */}
      <p style={HEADING_STYLE}>No hay un FRD en construcción</p>

      {/* Description */}
      <p style={BODY_STYLE}>
        La Fragua se activará cuando se inicie una construcción con{" "}
        <code>/pandacorp:implement</code>.
      </p>

      {/* Guidance hint */}
      <p style={HINT_STYLE}>
        Los agentes aparecerán aquí FRD a FRD, conforme avance la construcción.
      </p>
    </div>
  );
}
