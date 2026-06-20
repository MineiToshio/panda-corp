/**
 * WO-13-007 — CountBadge (CMP-13-countbadge)
 *
 * Numeric pill for rail/badge counts (decisions/bugs/proposals).
 * A Chip count preset — named variant, NOT a fork of Chip.
 *
 * Spec: tabular-nums, canvas-colored numeral, 17px min width.
 * Tokens only. Light+dark first-class. WCAG AA.
 *
 * Traceability: CMP-13-countbadge, AC-13-006.x.
 * Consumers: ProposalsBadge, StatusChips, ProjectRail.
 */

import { Chip, type ChipTone } from "@/components/core/Chip/Chip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CountBadgeProps {
  /** The numeric count to display. */
  count: number;
  /** Visual tone. */
  tone: "warn" | "danger" | "accent" | "ok" | "info" | "secondary";
}

// ---------------------------------------------------------------------------
// CountBadge component
// ---------------------------------------------------------------------------

/**
 * CountBadge — numeric pill for rail/badge counts.
 *
 * Wraps Chip with tabular-nums and minimum 17px width.
 * Usage: `<CountBadge count={3} tone="warn" />`
 */
export function CountBadge({ count, tone }: CountBadgeProps): React.JSX.Element {
  return (
    <span
      data-testid="count-badge"
      data-tone={tone}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "17px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <Chip tone={tone as ChipTone}>{String(count)}</Chip>
    </span>
  );
}
