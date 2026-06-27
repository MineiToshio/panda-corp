/**
 * PendingMergeBlock — the per-project "pending merge" section of the Summary tab (FRD-21, WO-21-002).
 *
 * The SECONDARY surface of the pending-merge visibility (the global shell indicator is the primary):
 * shows THIS project's un-merged worktrees/branches, placed right after the decision-points block.
 * Server component (no interactivity); fed `readPending(projectPath)` by the workspace. Reads the same
 * data source as the shell indicator + the Kanban (DR-092 single source).
 *
 * Fail-loud (DR-078): error (git unreadable) and empty (truly none) are distinct, distinctly rendered —
 * never a silent "al día" on a read failure. Status is conveyed by text, not color alone (a11y).
 *
 * Traceability: CMP-21-pending-block → REQ-21-004, REQ-21-006.
 */

import { Panel } from "@/components/core/Panel/Panel";
import type { PendingItem, PendingResult } from "@/lib/pendingMerge/pendingMerge";

const STATUS_LABEL: Record<PendingItem["status"], string> = {
  stale: "estancado",
  ready: "listo, sin mergear",
  "in-progress": "en curso",
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--color-text2, var(--color-text-secondary, var(--color-text)))",
  margin: "0 0 6px",
};

const EMPTY_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text3, var(--color-text-muted, var(--color-text)))",
  margin: "6px 0 0",
  fontStyle: "italic",
};

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  padding: "9px 0",
  borderTop: "0.5px solid var(--color-border)",
};

const META_STYLE: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--color-text2, var(--color-text-secondary, var(--color-text)))",
};

const MUTED_STYLE: React.CSSProperties = {
  color: "var(--color-text3, var(--color-text-muted, var(--color-text)))",
};

const CMD_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "11px",
  color: "var(--color-text3, var(--color-text-muted, var(--color-text)))",
  wordBreak: "break-all",
};

function landCommand(item: PendingItem): string {
  return `cd ${item.worktree ?? `(worktree removido — ${item.branch})`} && bash .pandacorp/merge-queue.sh`;
}

/**
 * PendingMergeBlock — a Summary-tab section listing this project's un-merged worktrees/branches.
 * Renders an explicit error state when git can't be read, an "al día" state when there is none, or
 * the list (branch · status-as-text · commits · age · the land command) otherwise.
 */
export function PendingMergeBlock({ result }: { result: PendingResult }): React.JSX.Element {
  return (
    <Panel>
      <section data-testid="pending-merge-block" aria-label="Pendientes de merge">
        <p style={TITLE_STYLE}>Pendientes de merge</p>

        {result.kind === "error" ? (
          <p data-testid="pending-merge-block-error" role="status" style={EMPTY_STYLE}>
            No se pudo leer el estado de merges pendientes.
          </p>
        ) : result.kind === "empty" ? (
          <p data-testid="pending-merge-block-empty" role="status" style={EMPTY_STYLE}>
            Al día — no hay worktrees sin fusionar.
          </p>
        ) : (
          <ul
            data-testid="pending-merge-block-list"
            aria-label="Worktrees sin fusionar"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {result.items.map((item) => (
              <li key={item.branch} data-testid="pending-merge-block-row" style={ROW_STYLE}>
                <span style={META_STYLE}>
                  <strong style={{ fontFamily: "var(--font-mono, monospace)" }}>
                    {item.branch}
                  </strong>
                  {" · "}
                  <span data-testid="pending-merge-block-status">{STATUS_LABEL[item.status]}</span>
                  <span style={MUTED_STYLE}>
                    {" · "}+{item.ahead} · {item.ageHours}h{item.task ? ` · ${item.task}` : ""}
                  </span>
                </span>
                <code style={CMD_STYLE}>{landCommand(item)}</code>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Panel>
  );
}
