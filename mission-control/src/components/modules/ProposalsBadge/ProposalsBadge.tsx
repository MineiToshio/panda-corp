/**
 * ProposalsBadge — the "Propuestas" destination of the global app shell (CMP-17-badge → CMP-19-nav).
 *
 * Re-anchor (FRD-19): the prototype's `tabProp()` is the Propuestas nav pill carrying its open-count
 * badge — ONE element, not a tab plus a separate badge. So ProposalsBadge IS the Propuestas
 * destination: a `.tab`-styled `next/link` to /proposals, active by route, whose accessible name is
 * exactly "Propuestas" (the Shell-Presence Gate matches destinations by exact label) with the count
 * shown as a visible, aria-hidden CountBadge pill (FRD-17 AC-17-007.5: count conveyed as text, not
 * color-alone; the prototype's badge is visual-only — the /proposals page announces the count).
 *
 * Design rules:
 *   - When openCount === 0: calm / al-día — no count pill, no urgency decoration (AC-17-007.4); the
 *     link stays present for navigation.
 *   - When openCount > 0: the count is the shared CountBadge primitive (DR-057), not a forked pill.
 *   - Zero hardcoded colors — the `.tab` visual + tokens (shared navTabStyle).
 *
 * Traceability:
 *   CMP-17-badge → REQ-17-001, REQ-17-008, AC-17-007.1/.4/.5
 *   CMP-19-nav  → REQ-19-001 (AC-19-001.2/.3), REQ-19-002 (AC-19-002.1)
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CountBadge } from "@/components/core/CountBadge/CountBadge";
import { isNavActive, navTabStyle } from "@/components/modules/Nav/navTab";

const PROPOSALS_PATH = "/proposals";

export interface ProposalsBadgeProps {
  /**
   * Number of open proposals (candidates + promotions + prune + self-suggestions, minus dismissed).
   * Pass 0 for the calm / al-día state.
   */
  openCount: number;
}

/**
 * ProposalsBadge — the Propuestas shell-nav destination with its open-count.
 *
 * Renders a `.tab` link to /proposals (accessible name "Propuestas"), marked active via
 * `usePathname()` when on /proposals, with the open count as a visible aria-hidden CountBadge.
 */
export function ProposalsBadge({ openCount }: ProposalsBadgeProps): React.JSX.Element {
  const pathname = usePathname() ?? "";
  const active = isNavActive(pathname, PROPOSALS_PATH);
  const hasProposals = openCount > 0;

  return (
    <span data-testid="proposals-badge" style={{ display: "inline-flex", alignItems: "center" }}>
      <Link
        href={PROPOSALS_PATH}
        data-testid="proposals-badge-link"
        data-active={active ? "true" : "false"}
        aria-current={active ? "page" : undefined}
        style={navTabStyle(active)}
      >
        {/* Visible label — the link's accessible name is exactly "Propuestas" (Shell-Presence Gate). */}
        Propuestas
        {/* Count pill — only when there are open proposals (AC-17-007.4). The pill IS the shared
            CountBadge primitive (DR-057); aria-hidden so it stays out of the link's accessible name
            while remaining visible (count not color-alone, AC-17-007.5). */}
        {hasProposals && (
          <span data-testid="proposals-badge-count" aria-hidden="true">
            <CountBadge count={openCount} tone="accent" />
          </span>
        )}
      </Link>
    </span>
  );
}
