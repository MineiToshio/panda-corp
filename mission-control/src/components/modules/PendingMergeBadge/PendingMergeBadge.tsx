/**
 * PendingMergeBadge — the global "pending merge" indicator of the app shell (FRD-21, WO-21-002).
 *
 * Surfaces un-merged parallel work so a forgotten worktree is never silently stranded (DR-096). The
 * layout calls `getPendingMerge()` (server) and passes the result here; this client island renders the
 * topbar chip and, on click, opens a panel (the shared Modal primitive, DR-057) listing the items.
 *
 * Design rules (FRD-21):
 *   - empty (no pending work) → render NOTHING (calm; the owner's fear is *not looking*, not a nag).
 *   - ok → "⎇ N pendientes" chip; alert-toned (`data-state="stale"`) when any item is STALE. Status is
 *     conveyed by text (count + per-row status label), never by color alone (AC-21-002, accessibility.md).
 *   - error (git unreadable) → an explicit, distinct error chip — NEVER a silent "al día" (DR-078).
 *   - Click → a Modal listing each item (branch · status · age · the land command). Reuses Modal (DR-057).
 *   - Zero hardcoded colors — shared `.tab` visual + CountBadge tones + Modal.
 *
 * Traceability: CMP-21-pending-badge → REQ-21-001, REQ-21-002, REQ-21-003, REQ-21-006.
 */

"use client";

import { useState } from "react";
import { CountBadge } from "@/components/core/CountBadge/CountBadge";
import { Modal } from "@/components/core/Modal/Modal";
import { navTabStyle } from "@/components/modules/Nav/navTab";
import type { PendingItem, PendingResult } from "@/lib/pendingMerge/pendingMerge";

export interface PendingMergeBadgeProps {
  /** The server-derived pending-merge state (from `getPendingMerge()`). */
  result: PendingResult;
}

const SR_ONLY: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
};

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  padding: "10px 12px",
  border: "0.5px solid var(--color-border-strong)",
  borderRadius: "var(--radius-md, 10px)",
  background: "var(--color-card)",
};

const ROW_TOP_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const CMD_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "11px",
  color: "var(--color-text-muted, var(--color-text))",
  wordBreak: "break-all",
};

const STATUS_LABEL: Record<PendingItem["status"], string> = {
  stale: "estancado",
  ready: "listo, sin mergear",
  "in-progress": "en curso",
};

function landCommand(item: PendingItem): string {
  const where = item.worktree ?? `(worktree removido — rama ${item.branch})`;
  return `cd ${where} && bash .pandacorp/merge-queue.sh`;
}

/** One pending item as a row inside the panel. */
function PendingRow({ item }: { item: PendingItem }): React.JSX.Element {
  return (
    <li data-testid="pending-merge-row" style={ROW_STYLE}>
      <div style={ROW_TOP_STYLE}>
        <strong style={{ fontFamily: "var(--font-mono, monospace)" }}>{item.branch}</strong>
        {/* status as TEXT (not color alone, AC-21-002) */}
        <span data-testid="pending-merge-row-status">· {STATUS_LABEL[item.status]}</span>
        <span style={{ color: "var(--color-text-muted, var(--color-text))" }}>
          · +{item.ahead} · {item.ageHours}h{item.task ? ` · ${item.task}` : ""}
        </span>
      </div>
      <code style={CMD_STYLE}>{landCommand(item)}</code>
    </li>
  );
}

/**
 * PendingMergeBadge — the shell's un-merged-work indicator. Renders nothing when there is none, an
 * alert-toned count when anything is stale, an explicit error chip when git can't be read, and a Modal
 * with the full list on click.
 */
export function PendingMergeBadge({ result }: PendingMergeBadgeProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false);

  if (result.kind === "empty") return null;

  if (result.kind === "error") {
    return (
      <span
        data-testid="pending-merge-badge"
        data-state="error"
        title="No se pudo leer el estado de merges pendientes"
        style={navTabStyle(false)}
      >
        <span aria-hidden="true">⎇ !</span>
        <span style={SR_ONLY}>No se pudo leer el estado de merges pendientes</span>
      </span>
    );
  }

  const { items } = result;
  const hasStale = items.some((i) => i.status === "stale");
  const accessibleName = `${items.length} pendientes de merge${hasStale ? " (alguno estancado)" : ""}`;

  return (
    <>
      <button
        type="button"
        data-testid="pending-merge-badge"
        data-state={hasStale ? "stale" : "pending"}
        aria-label={accessibleName}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        style={{ ...navTabStyle(false), cursor: "pointer" }}
      >
        <span aria-hidden="true">⎇ pendientes</span>
        <span data-testid="pending-merge-count" aria-hidden="true">
          <CountBadge count={items.length} tone={hasStale ? "danger" : "accent"} />
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Pendientes de merge"
        testIdBase="pending-merge"
      >
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            color: "var(--color-text-muted, var(--color-text))",
          }}
        >
          Trabajo sin fusionar a main. Un worktree que sobrevive = trabajo sin mergear (DR-096).
        </p>
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {items.map((item) => (
            <PendingRow key={item.branch} item={item} />
          ))}
        </ul>
      </Modal>
    </>
  );
}
