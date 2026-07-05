/**
 * WO-04-004 — ObjectivesBar (CMP-04-objectives-bar)
 *
 * Server Component: the project's mission-progress bar, faithful to the prototype's
 * compactProjectHeader() — a THIN (6px) inline bar that sits on ONE line beside its
 * readout, inside the header panel (NOT the thick striped XpBar used in the Summary tab):
 *
 *   compactProjectHeader bar (index.html):
 *     <span style="flex:1;min-width:120px;max-width:260px;height:6px;
 *                  background:var(--secondary);border-radius:99px;overflow:hidden;
 *                  border:.5px solid var(--bd)">
 *       <span style="height:100%;width:PCT%;background: PCT>=100 ? var(--ok) : var(--accent)"></span>
 *     </span>
 *     <span style="font-size:11px;color:var(--text3)">PCT%</span>
 *
 *   - Single inline row: [ thin bar ] [ pct% · done/total ] — never stacked.
 *   - The readout adds the work-order count to the prototype's bare percentage:
 *     "100% · 79/79" (percentage AND N/N work orders).
 *   - Omitted when total is 0 or absent (AC-04-002.2).
 *   - tabular-nums on counts (FRD-13 / AC-13-003.1).
 *   - Visible regardless of the active tab (AC-04-002.3) — structural invariant.
 *
 * Design rules (AGENTS.md / FRD-13):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every significant element.
 *   - Spanish copy.
 *   - No "use client" — Server Component.
 *
 * Traceability:
 *   CMP-04-objectives-bar → REQ-04-002
 *   AC-04-002.2, AC-04-002.3
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ObjectivesBarProps {
  /** Derived live from listWorkOrders (aggregateProgress) — DR-092/DR-115, never status.yaml. */
  done: number;
  /** Derived live from listWorkOrders (aggregateProgress) — DR-092/DR-115, never status.yaml; when 0 or undefined the bar is omitted. */
  total: number | undefined;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// Matches the prototype compactProjectHeader() inline bar (one line, thin track).
// ---------------------------------------------------------------------------

/** One inline row: thin track + readout. No own border/background (the panel owns it). */
const ROOT_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

/** Thin 6px pill track — flex:1, capped at 260px (prototype bar). Recessed canvas tone. */
const TRACK_STYLE: React.CSSProperties = {
  display: "block",
  flex: 1,
  minWidth: "120px",
  maxWidth: "260px",
  height: "6px",
  background: "var(--color-base, Canvas)",
  borderRadius: "var(--radius-pill, 999px)",
  overflow: "hidden",
  border: "0.5px solid var(--color-border, currentColor)",
};

/** Readout: "pct% · N/N", 11px muted, tabular numerals. */
const READOUT_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3, currentColor)",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
  flex: "0 0 auto",
};

// ---------------------------------------------------------------------------
// ObjectivesBar component
// ---------------------------------------------------------------------------

/**
 * CMP-04-objectives-bar — the project's mission-progress bar (thin, inline).
 *
 * Server Component (no "use client"). Rendered inside the header panel, on one line.
 * Omitted entirely when total is 0 or undefined (AC-04-002.2).
 *
 * Shows the percentage AND the work-order count: "100% · 79/79".
 */
export function ObjectivesBar({ done, total }: ObjectivesBarProps): React.JSX.Element | null {
  // AC-04-002.2 — omitted when total is 0 or absent
  if (total === undefined || total === 0) {
    return null;
  }

  const pct = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  const isComplete = done >= total;

  const fillStyle: React.CSSProperties = {
    display: "block",
    height: "100%",
    width: `${pct}%`,
    background: isComplete ? "var(--color-ok, currentColor)" : "var(--color-accent, currentColor)",
  };

  return (
    <div
      data-testid="objectives-bar"
      style={ROOT_STYLE}
      role="progressbar"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`Misión: ${done} de ${total} work orders completadas (${pct}%)`}
    >
      {/* Thin pill track with accent/ok fill (prototype compactProjectHeader bar) */}
      <span data-testid="objectives-bar-fill" style={TRACK_STYLE} aria-hidden="true">
        <span style={fillStyle} />
      </span>

      {/* Readout: percentage AND work-order count on the same line — "100% · 79/79" */}
      <span style={READOUT_STYLE} aria-hidden="true">
        <span data-testid="objectives-bar-pct" style={{ fontVariantNumeric: "tabular-nums" }}>
          {pct}%
        </span>
        {" · "}
        <span data-testid="objectives-bar-counts" style={{ fontVariantNumeric: "tabular-nums" }}>
          {done}/{total}
        </span>
      </span>
    </div>
  );
}
