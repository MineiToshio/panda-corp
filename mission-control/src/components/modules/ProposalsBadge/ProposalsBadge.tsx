/**
 * ProposalsBadge — guild top-bar badge for open proposal count (WO-17-007).
 *
 * Server Component. Shows the open proposal count (candidates + promotions + prune +
 * self-suggestions, minus dismissed) and links to `app/proposals`.
 *
 * Design rules (FRD-09 White-Hat, AC-17-007.4):
 *   - When openCount === 0: calm / al-día state — badge is still present for navigation
 *     but has no urgency decoration (no dot, no pulse, no nagging copy).
 *   - When openCount > 0: shows the count as a text node (not color-alone — AC-17-007.5).
 *   - Zero hardcoded colors — all visual values via CSS custom properties.
 *   - Spanish copy + accessible label with count (AC-17-007.5).
 *
 * Traceability:
 *   CMP-17-badge → REQ-17-001, REQ-17-008
 *   AC-17-007.1 (links to /proposals with count)
 *   AC-17-007.4 (calm when 0)
 *   AC-17-007.5 (Spanish + a11y, count not color-alone)
 */

import Link from "next/link";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProposalsBadgeProps {
  /**
   * Number of open proposals (candidates + promotions + prune + self-suggestions,
   * minus dismissed). Pass 0 for the calm / al-día state.
   */
  openCount: number;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only
// ---------------------------------------------------------------------------

const WRAPPER_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  position: "relative",
};

const LINK_BASE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.3em",
  textDecoration: "none",
  color: "var(--color-text, currentColor)",
  padding: "0.25rem 0.5rem",
  borderRadius: "var(--radius, 0.5rem)",
  fontSize: "0.75rem",
  fontWeight: 500,
  transition: "background 0.15s",
};

const BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "1.25rem",
  height: "1.25rem",
  padding: "0 0.25rem",
  borderRadius: "9999px",
  fontSize: "0.6875rem",
  fontWeight: 700,
  lineHeight: 1,
  background: "var(--color-accent, currentColor)",
  color: "var(--color-base, Canvas)",
  fontVariantNumeric: "tabular-nums",
};

const LABEL_STYLE: React.CSSProperties = {
  lineHeight: 1.2,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ProposalsBadge — proposal count badge for the guild top bar.
 *
 * Renders a link to /proposals with the open proposal count.
 * When openCount === 0: calm state (no urgency decoration).
 * When openCount > 0: shows a distinct count pill alongside the label.
 *
 * Server Component: no interactivity; data is passed as a prop.
 *
 * Traceability:
 *   CMP-17-badge → AC-17-007.1, AC-17-007.4, AC-17-007.5
 */
export function ProposalsBadge({ openCount }: ProposalsBadgeProps): React.JSX.Element {
  const hasProposals = openCount > 0;

  const ariaLabel = hasProposals
    ? `Propuestas abiertas: ${openCount}. Ir a bandeja de propuestas.`
    : "Propuestas. Sin elementos pendientes.";

  return (
    <span data-testid="proposals-badge" style={WRAPPER_STYLE}>
      <Link
        href="/proposals"
        data-testid="proposals-badge-link"
        aria-label={ariaLabel}
        style={LINK_BASE_STYLE}
      >
        {/* Text label — Spanish, always present (navigation + a11y) */}
        <span data-testid="proposals-badge-label" style={LABEL_STYLE}>
          Propuestas
        </span>

        {/* Count pill — only shown when there are open proposals (AC-17-007.4) */}
        {hasProposals && (
          <span data-testid="proposals-badge-count" style={BADGE_STYLE} aria-hidden="true">
            {openCount}
          </span>
        )}
      </Link>
    </span>
  );
}
