/**
 * WO-03-002 (refactored, DR-057) — `CMP-14-status-chips`: decisions/bugs/rethink/proposals chips
 *
 * Refactored to use CountBadge (CMP-13-countbadge) presets for the numeric pill visual
 * — no bespoke chip/pill styles. The outer semantic wrappers keep their existing testids
 * (status-chip-decisions / status-chip-bugs / status-chip-rethink / status-chip-proposals)
 * and accessibility attributes; the visual pill delegates to CountBadge.
 *
 * Server Component. Given pending counters from `lib/status.ts` (ProjectStatus), renders:
 *   - warn CountBadge with `pendingDecisions` count when > 0  (AC-14-004.1)
 *   - danger CountBadge with `pendingBugs` count when > 0    (AC-14-004.2)
 *   - "Rethink pending" indicator when `rethinkPending`       (AC-14-005.1)
 *   - proposals CountBadge when > 0                           (AC-17-007.2)
 *   - Nothing (null) when all are zero / absent / false       (no empty chips)
 *
 * Mirrors the prototype rail `dchip` / `bchip` visual idiom via CountBadge tones.
 * Reusable in the FRD-04 workspace header (same props surface).
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — CountBadge + Chip own all color tokens.
 *   - tabular-nums on every count (CountBadge provides this via Chip).
 *   - data-testid on every chip/indicator (test-writer contract — preserved).
 *   - Chips carry count + title label — NOT color alone (a11y, FRD-13).
 *   - Spanish user-facing copy (i18n: Spanish by default).
 *   - Server Component safe — no hooks, no browser APIs.
 *
 * Traceability:
 *   CMP-14-status-chips → REQ-14-004, REQ-14-005
 *   AC-14-004.1, AC-14-004.2, AC-14-005.1
 *   CMP-17-badge (rail chip) → REQ-17-001; AC-17-007.2, AC-17-007.4, AC-17-007.5
 *   Reuses CMP-13-countbadge (CountBadge) — DR-057.
 */

import { CountBadge } from "@/components/core/CountBadge/CountBadge";

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
// Styles — semantic wrappers only; visual pill delegated to CountBadge.
// Uses CSS custom-property tokens so design-token tests pass.
// ---------------------------------------------------------------------------

/** Wrapper row for all chips */
const ROW_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "calc(var(--space-base, 1rem) * 0.25)",
};

/**
 * Decisions chip outer wrapper — semantic grouping with accessible label.
 * Visual pill (color/size) delegated to CountBadge (tone="warn").
 * Carries color token var(--color-warn) for design-token invariant test.
 */
const DECISIONS_WRAPPER_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25em",
  color: "var(--color-warn)",
};

/**
 * Bugs chip outer wrapper — semantic grouping with accessible label.
 * Visual pill delegated to CountBadge (tone="danger").
 */
const BUGS_WRAPPER_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25em",
  color: "var(--color-danger)",
};

/**
 * Proposals chip outer wrapper — semantic grouping.
 * Visual pill delegated to CountBadge (tone="accent").
 */
const PROPOSALS_WRAPPER_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25em",
  color: "var(--color-accent-text)",
};

/**
 * Count span — for test-contract compatibility (tabular-nums on count testid).
 * Wraps CountBadge so status-chip-*-count testid carries fontVariantNumeric.
 */
const COUNT_SPAN_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontVariantNumeric: "tabular-nums",
};

/** Rethink indicator — muted warning outline pill (not a CountBadge: no numeric count). */
const RETHINK_CHIP_STYLE: React.CSSProperties = {
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
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
  borderStyle: "solid",
  borderWidth: "var(--hairline, 1px)",
  borderColor: "var(--color-danger)",
  opacity: 0.85,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * StatusChips — Server Component that renders warn/danger/accent CountBadge presets
 * for decisions/bugs/proposals, and a rethink indicator.
 *
 * Returns null when nothing to show (all counts zero or false).
 * Uses CountBadge (CMP-13-countbadge) for all numeric pills — DR-057.
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
      {/* Decisions chip — warn CountBadge (AC-14-004.1) */}
      {hasDecisions && typeof pendingDecisions === "number" && (
        <span
          data-testid="status-chip-decisions"
          data-variant="amber"
          style={DECISIONS_WRAPPER_STYLE}
          title={`Decisiones pendientes: ${pendingDecisions}`}
          role="status"
        >
          {/* Count span wraps CountBadge for testid/tabular-nums contract compat */}
          <span data-testid="status-chip-decisions-count" style={COUNT_SPAN_STYLE}>
            <CountBadge count={pendingDecisions} tone="warn" />
          </span>
          {" decisiones"}
        </span>
      )}

      {/* Bugs chip — danger CountBadge (AC-14-004.2) */}
      {hasBugs && typeof pendingBugs === "number" && (
        <span
          data-testid="status-chip-bugs"
          data-variant="red"
          style={BUGS_WRAPPER_STYLE}
          title={`Bugs pendientes: ${pendingBugs}`}
          role="status"
        >
          <span data-testid="status-chip-bugs-count" style={COUNT_SPAN_STYLE}>
            <CountBadge count={pendingBugs} tone="danger" />
          </span>
          {" bugs"}
        </span>
      )}

      {/* Rethink indicator (AC-14-005.1) — no CountBadge: not a numeric count */}
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

      {/* Proposals chip — accent CountBadge (AC-17-007.2, AC-17-007.4) */}
      {hasProposals && typeof pendingProposals === "number" && (
        <span
          data-testid="status-chip-proposals"
          data-variant="proposals"
          style={PROPOSALS_WRAPPER_STYLE}
          title={`Propuestas abiertas: ${pendingProposals}`}
          role="status"
        >
          <span data-testid="status-chip-proposals-count" style={COUNT_SPAN_STYLE}>
            <CountBadge count={pendingProposals} tone="accent" />
          </span>
          {" propuestas"}
        </span>
      )}
    </span>
  );
}
