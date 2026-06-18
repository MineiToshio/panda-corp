/**
 * WO-14-003 — `CMP-14-status-chips`: decisions/bugs/rethink/proposals chips
 *
 * Server Component. Given pending counters from `lib/status.ts` (ProjectStatus),
 * renders:
 *   - Amber chip with `pendingDecisions` count when > 0  (AC-14-004.1)
 *   - Red chip with `pendingBugs` count when > 0         (AC-14-004.2)
 *   - "Rethink pending" indicator when `rethinkPending`  (AC-14-005.1)
 *   - Proposals chip with `pendingProposals` count when > 0 (AC-17-007.2 — third stream)
 *   - Nothing (null) when all are zero / absent / false  (no empty chips)
 *
 * Mirrors the prototype rail `dchip` / `bchip` visual idiom.
 * Reusable in the FRD-04 workspace header (same props surface).
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - tabular-nums on every count (AC-13-003).
 *   - data-testid on every chip/indicator (test-writer contract).
 *   - Chips carry count + title label — NOT color alone (a11y, FRD-13).
 *   - Spanish user-facing copy (i18n: Spanish by default).
 *   - Server Component safe — no hooks, no browser APIs.
 *
 * Traceability:
 *   CMP-14-status-chips → REQ-14-004, REQ-14-005
 *   AC-14-004.1, AC-14-004.2, AC-14-005.1
 *   WO-14-003
 *   CMP-17-badge (rail chip) → REQ-17-001; AC-17-007.2, AC-17-007.4, AC-17-007.5
 *   WO-17-007
 */

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StatusChipsProps {
  /**
   * Number of pending decisions from `ProjectStatus.pendingDecisions`.
   * Chip shown only when > 0. Absent / undefined → no chip.
   */
  pendingDecisions?: number;
  /**
   * Number of pending bugs from `ProjectStatus.pendingBugs`.
   * Chip shown only when > 0. Absent / undefined → no chip.
   */
  pendingBugs?: number;
  /**
   * Whether a rethink is pending (`ProjectStatus.rethinkPending`).
   * Indicator shown only when true. Absent / false → no indicator.
   */
  rethinkPending?: boolean;
  /**
   * Number of open proposals for this project (FRD-17 third stream, WO-17-007).
   * Chip shown only when > 0. Absent / undefined → no chip.
   * CMP-17-badge: per-project portfolio-rail chip alongside decisions/bugs.
   */
  pendingProposals?: number;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded hex/rgb/hsl values.
// Fallbacks use system semantic values so the component renders before
// design tokens are frozen (WO-13-002, globals.css).
// ---------------------------------------------------------------------------

/** Shared base chip layout */
const BASE_CHIP_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25em",
  padding: "0.125rem 0.4375rem",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  fontSize: "0.6875rem",
  fontWeight: 600,
  lineHeight: 1.4,
  border: "none",
  whiteSpace: "nowrap",
};

/** Amber chip: pending decisions */
const AMBER_CHIP_STYLE: React.CSSProperties = {
  ...BASE_CHIP_STYLE,
  background: "var(--color-agent-researcher, currentColor)",
  color: "var(--color-contrast, Canvas)",
};

/** Red chip: pending bugs */
const RED_CHIP_STYLE: React.CSSProperties = {
  ...BASE_CHIP_STYLE,
  background: "var(--color-agent-security-auditor, currentColor)",
  color: "var(--color-contrast, Canvas)",
};

/** Proposals chip: guild accent tone (FRD-17, WO-17-007) */
const PROPOSALS_CHIP_STYLE: React.CSSProperties = {
  ...BASE_CHIP_STYLE,
  background: "var(--color-agent-product-manager, currentColor)",
  color: "var(--color-contrast, Canvas)",
};

/** Rethink indicator: muted warning tone */
const RETHINK_CHIP_STYLE: React.CSSProperties = {
  ...BASE_CHIP_STYLE,
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
  border: "var(--hairline, 1px) solid var(--color-agent-security-auditor, currentColor)",
  opacity: 0.85,
};

/** Count <span> — tabular-nums for alignment (AC-13-003) */
const COUNT_STYLE: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
};

/** Wrapper row */
const ROW_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "calc(var(--space-base, 1rem) * 0.25)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * StatusChips — Server Component that renders amber/red/rethink/proposals chips.
 *
 * Returns null when nothing to show (all counts zero or false).
 *
 * Traceability:
 *   CMP-14-status-chips → REQ-14-004, REQ-14-005; AC-14-004.1/.2, AC-14-005.1
 *   CMP-17-badge (rail chip) → REQ-17-001; AC-17-007.2, AC-17-007.4, AC-17-007.5
 */
export function StatusChips({
  pendingDecisions,
  pendingBugs,
  rethinkPending,
  pendingProposals,
}: StatusChipsProps): React.JSX.Element | null {
  const hasDecisions = typeof pendingDecisions === "number" && pendingDecisions > 0;
  const hasBugs = typeof pendingBugs === "number" && pendingBugs > 0;
  const hasRethink = rethinkPending === true;
  const hasProposals = typeof pendingProposals === "number" && pendingProposals > 0;

  // Nothing to render — return null (no empty wrapper in the DOM)
  if (!hasDecisions && !hasBugs && !hasRethink && !hasProposals) {
    return null;
  }

  return (
    <span style={ROW_STYLE}>
      {/* Amber chip — pending decisions (AC-14-004.1) */}
      {hasDecisions && (
        <span
          data-testid="status-chip-decisions"
          data-variant="amber"
          style={AMBER_CHIP_STYLE}
          title={`Decisiones pendientes: ${pendingDecisions}`}
          role="status"
        >
          <span data-testid="status-chip-decisions-count" style={COUNT_STYLE}>
            {pendingDecisions}
          </span>
          {" decisiones"}
        </span>
      )}

      {/* Red chip — pending bugs (AC-14-004.2) */}
      {hasBugs && (
        <span
          data-testid="status-chip-bugs"
          data-variant="red"
          style={RED_CHIP_STYLE}
          title={`Bugs pendientes: ${pendingBugs}`}
          role="status"
        >
          <span data-testid="status-chip-bugs-count" style={COUNT_STYLE}>
            {pendingBugs}
          </span>
          {" bugs"}
        </span>
      )}

      {/* Rethink indicator (AC-14-005.1) */}
      {hasRethink && (
        <span
          data-testid="status-chip-rethink"
          data-variant="rethink"
          style={RETHINK_CHIP_STYLE}
          title="Rethink pendiente — la construcción se pausará"
          role="status"
        >
          ⚑ rethink pendiente
        </span>
      )}

      {/* Proposals chip — FRD-17 third stream (AC-17-007.2, AC-17-007.4) */}
      {hasProposals && (
        <span
          data-testid="status-chip-proposals"
          data-variant="proposals"
          style={PROPOSALS_CHIP_STYLE}
          title={`Propuestas abiertas: ${pendingProposals}`}
          role="status"
        >
          <span data-testid="status-chip-proposals-count" style={COUNT_STYLE}>
            {pendingProposals}
          </span>
          {" propuestas"}
        </span>
      )}
    </span>
  );
}
