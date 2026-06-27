/**
 * PendingMergeBadge — the global "pending merge" indicator of the app shell (FRD-21, WO-21-002).
 *
 * Surfaces un-merged parallel work so a forgotten worktree is never silently stranded (DR-096). It is
 * a server-rendered shell slot (like ProposalsBadge): the layout calls `getPendingMerge()` and passes
 * the result here, so the indicator carries server-derived git state without a client fetch.
 *
 * Design rules (FRD-21):
 *   - empty (no pending work) → render NOTHING (calm; the owner's fear is *not looking*, not a nag).
 *   - ok → "⎇ N pendientes" with the shared CountBadge (DR-057); alert tone when any item is STALE.
 *     Status is conveyed by text (the count + the listed statuses in the accessible name), never by
 *     color alone (AC-21-002, accessibility.md).
 *   - error (git unreadable) → an explicit, distinct error chip — NEVER a silent "al día" (DR-078).
 *   - Zero hardcoded colors — the shared `.tab` visual + CountBadge tones.
 *
 * Traceability: CMP-21-pending-badge → REQ-21-001, REQ-21-002, REQ-21-006.
 */

import Link from "next/link";
import { CountBadge } from "@/components/core/CountBadge/CountBadge";
import { navTabStyle } from "@/components/modules/Nav/navTab";
import type { PendingItem, PendingResult } from "@/lib/pendingMerge/pendingMerge";

const PENDING_PATH = "/portfolio?view=work-orders";

export interface PendingMergeBadgeProps {
  /** The server-derived pending-merge state (from `getPendingMerge()`). */
  result: PendingResult;
}

/** Human summary of one item for the accessible name (status not color-alone, AC-21-002). */
function describe(item: PendingItem): string {
  return `${item.branch} (${item.status}, +${item.ahead}, ${item.ageHours}h)`;
}

/**
 * PendingMergeBadge — the shell's un-merged-work indicator. Renders nothing when there is none,
 * an alert-toned count when anything is stale, and an explicit error chip when git can't be read.
 */
export function PendingMergeBadge({ result }: PendingMergeBadgeProps): React.JSX.Element | null {
  if (result.kind === "empty") return null;

  if (result.kind === "error") {
    return (
      <span
        data-testid="pending-merge-badge"
        data-state="error"
        title="No se pudo leer el estado de merges pendientes"
        style={navTabStyle(false)}
      >
        ⎇ <span aria-hidden="true">!</span>
        <span
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
          }}
        >
          No se pudo leer el estado de merges pendientes
        </span>
      </span>
    );
  }

  const { items } = result;
  const hasStale = items.some((i) => i.status === "stale");
  const accessibleName = `${items.length} pendientes de merge: ${items.map(describe).join("; ")}`;

  return (
    <Link
      href={PENDING_PATH}
      data-testid="pending-merge-badge"
      data-state={hasStale ? "stale" : "pending"}
      aria-label={accessibleName}
      title={accessibleName}
      style={navTabStyle(false)}
    >
      <span aria-hidden="true">⎇ pendientes</span>
      <span data-testid="pending-merge-count" aria-hidden="true">
        <CountBadge count={items.length} tone={hasStale ? "danger" : "accent"} />
      </span>
    </Link>
  );
}
