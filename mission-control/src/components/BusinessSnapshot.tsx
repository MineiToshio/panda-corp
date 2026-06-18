/**
 * BusinessSnapshot — compact chip row for shipped project metrics (CMP-03-snapshot).
 *
 * Renders active users / return metric / last review verdict as compact chips.
 * Only for shipped/operation projects. Absent snapshot → renders nothing (null).
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - tabular-nums on the container (AC-13-003, numeric metric readability).
 *   - data-testid="business-snapshot" on root (WO-03-003 contract).
 *   - Server Component safe — no hooks, no browser APIs.
 *   - Read-only: no interactive controls.
 *
 * Traceability:
 *   CMP-03-snapshot → REQ-03-003, AC-03-003.1
 *   WO-03-003
 */

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded hex/rgb/hsl values.
// Fallbacks use system semantic values so the component renders before
// design tokens are frozen (WO-13-002, globals.css).
// ---------------------------------------------------------------------------

const SNAPSHOT_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "calc(var(--space-base, 1rem) * 0.25)",
  alignItems: "center",
  fontVariantNumeric: "tabular-nums",
};

const CHIP_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.125rem 0.375rem",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  fontSize: "0.6875rem",
  fontWeight: 500,
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BusinessSnapshotProps {
  /** Active user count string from the portfolio row (filled by review-launch). */
  users?: string;
  /** Return metric string from the portfolio row (e.g. "$1 200 MRR", "OSS stars"). */
  returnMetric?: string;
  /** Last review verdict string from the portfolio row (e.g. "double-down", "hold", "kill"). */
  verdict?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * BusinessSnapshot — compact chips showing shipped-project health metrics.
 *
 * Returns null when no fields are present (no placeholder noise per WO-03-003).
 *
 * data-testid contract (WO-03-003):
 *   - "business-snapshot"       — root element (only present when ≥1 field exists)
 *   - "business-snapshot-users" — users chip
 *   - "business-snapshot-return" — return metric chip
 *   - "business-snapshot-verdict" — verdict chip
 */
export function BusinessSnapshot({
  users,
  returnMetric,
  verdict,
}: BusinessSnapshotProps): React.JSX.Element | null {
  const hasAny = users !== undefined || returnMetric !== undefined || verdict !== undefined;
  if (!hasAny) return null;

  return (
    <div data-testid="business-snapshot" style={SNAPSHOT_ROW_STYLE}>
      {users !== undefined && (
        <span
          data-testid="business-snapshot-users"
          style={CHIP_STYLE}
          title={`Usuarios activos: ${users}`}
        >
          {users}
        </span>
      )}
      {returnMetric !== undefined && (
        <span
          data-testid="business-snapshot-return"
          style={CHIP_STYLE}
          title={`Métrica de retorno: ${returnMetric}`}
        >
          {returnMetric}
        </span>
      )}
      {verdict !== undefined && (
        <span
          data-testid="business-snapshot-verdict"
          style={CHIP_STYLE}
          title={`Veredicto: ${verdict}`}
        >
          {verdict}
        </span>
      )}
    </div>
  );
}
