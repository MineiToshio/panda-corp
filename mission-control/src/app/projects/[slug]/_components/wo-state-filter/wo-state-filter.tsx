"use client";

/**
 * WO-05-007 — WoStateFilter (state pill row)
 *
 * Client Component ("use client"). Secondary filter control for the kanban board —
 * lists every WorkOrderState plus "all" and calls onSelect when a pill is chosen.
 * Same pattern as WoFrdFilter (WO-05-004): pills built on the shared Chip,
 * aria-pressed toggles, data-testid per pill.
 *
 * Traceability:
 *   REQ-05-007   Secondary filter by work-order state, combinable with the FRD filter by AND.
 *   AC-05-007.1  Lists every WorkOrderState + "all"; selecting a state narrows the view.
 *   AC-05-007.3  aria-pressed + text conveys the pressed pill (not color alone); keyboard-operable.
 *
 * Design rules:
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every interactive element.
 *   - aria-pressed on each toggle button (a11y).
 *   - Spanish copy (UI-facing).
 *   - The option pills ARE the shared Chip primitive (DR-057), not a bespoke pill.
 */

import { Chip } from "@/components/core/Chip/Chip";
import type { WorkOrderState } from "@/lib/work-orders/work-orders";

// ---------------------------------------------------------------------------
// Canonical state order + Spanish labels — mirrors WoBoard's COLUMNS (wo-board.tsx),
// which is the label source of truth (not exported, so re-declared verbatim here per
// the WO scope note: "do not re-declare a divergent map").
// ---------------------------------------------------------------------------

const STATE_OPTIONS: ReadonlyArray<{ state: WorkOrderState; label: string }> = [
  { state: "todo", label: "To do" },
  { state: "in_progress", label: "En progreso" },
  { state: "review", label: "Review / Testing" },
  { state: "fail", label: "Falló" },
  { state: "done", label: "Hecho" },
] as const;

// ---------------------------------------------------------------------------
// Styles — identical pattern to WoFrdFilter's pill row
// ---------------------------------------------------------------------------

const CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1.5) calc(var(--spacing, 0.25rem) * 2)",
  padding: "calc(var(--spacing, 0.25rem) * 3) calc(var(--spacing, 0.25rem) * 4)",
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  background: "var(--color-surface, Canvas)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.65,
  flexShrink: 0,
  marginRight: "calc(var(--spacing, 0.25rem) * 2)",
};

/** The toggle <button> is a transparent shell; the visual pill is the shared Chip. */
const TOGGLE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  background: "none",
  border: "none",
  padding: 0,
  margin: 0,
  cursor: "pointer",
  maxWidth: "200px",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface WoStateFilterProps {
  /** Currently selected WorkOrderState (null = "All"). */
  selected: WorkOrderState | null;
  /** Callback when the selection changes (null = "All"). */
  onSelect: (state: WorkOrderState | null) => void;
}

/**
 * WoStateFilter — pill-style work-order state filter bar (CMP-05-state-filter).
 *
 * Client Component (needs click handlers and aria-pressed state).
 * REQ-05-007 / AC-05-007.1 / AC-05-007.3.
 */
export function WoStateFilter({ selected, onSelect }: WoStateFilterProps): React.JSX.Element {
  const allActive = selected === null;

  return (
    <fieldset
      data-testid="wo-state-filter"
      aria-label="Filtrar por estado"
      style={{ border: "none", ...CONTAINER_STYLE, margin: 0 }}
    >
      <span style={LABEL_STYLE}>Estado:</span>
      <button
        type="button"
        data-testid="wo-state-filter-all"
        aria-pressed={allActive}
        onClick={() => onSelect(null)}
        style={TOGGLE_STYLE}
      >
        <Chip tone={allActive ? "accent" : "secondary"}>Todos</Chip>
      </button>
      {STATE_OPTIONS.map(({ state, label }) => {
        const active = selected === state;
        return (
          <button
            key={state}
            type="button"
            data-testid="wo-state-filter-option"
            aria-pressed={active}
            aria-label={`Filtrar por estado ${label}`}
            onClick={() => onSelect(state)}
            style={TOGGLE_STYLE}
            title={label}
          >
            <Chip tone={active ? "accent" : "secondary"}>{label}</Chip>
          </button>
        );
      })}
    </fieldset>
  );
}
