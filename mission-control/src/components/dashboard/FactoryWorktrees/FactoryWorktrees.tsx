/**
 * CMP-18-factory-worktrees — "Árboles de trabajo" section for the Inicio dashboard.
 *
 * Shows pending (un-merged) git worktrees of the factory repo (panda-corp) so a
 * forgotten branch is never silently stranded (DR-096 §7 "never silently strand a worktree").
 * Data source: `getPendingMerge()` — the same request-scoped cached reader used by
 * the shell badge (PendingMergeBadge), single source per DR-092.
 *
 * Fail-loud (DR-078): `error` (git unreadable) and `empty` (genuinely none) are
 * rendered distinctly — never a silent "al día" on a read failure.
 *
 * Visual contract — matches the established home-screen section pattern (DR-062):
 *   SectionHead  (icon + label + count chip)
 *   ├─ empty     → calm "sin pendientes" panel (no nagging)
 *   ├─ error     → explicit "no se pudo leer" panel
 *   └─ ok        → list of WorktreeRow cards
 *                    [ icon-tile (tinted by status) | branch · task | meta | cmd chip ]
 *
 * Server Component — no "use client" needed; CopyButton is already client-internal.
 *
 * Traceability: CMP-18-factory-worktrees → FRD-18 REQ-18-XXX (tracked in decision-log)
 */

import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import type { PendingItem, PendingResult } from "@/lib/pendingMerge/pendingMerge";

// ---------------------------------------------------------------------------
// Styles (CSS custom properties only — FRD-13)
// ---------------------------------------------------------------------------

const SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const CARD_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 14px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border-strong)",
  background: "var(--color-card)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
};

const ICON_TILE_BASE: React.CSSProperties = {
  width: "34px",
  height: "34px",
  flex: "0 0 auto",
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const BRANCH_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--color-text)",
};

const TASK_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text2)",
};

const META_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3)",
  marginTop: "1px",
};

const CMD_CHIP_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flex: "0 0 auto",
  background: "var(--color-base)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "var(--radius-sm)",
  padding: "4px 6px 4px 10px",
};

const CMD_TEXT_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  color: "var(--color-text2)",
  fontVariantNumeric: "tabular-nums",
  maxWidth: "260px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const CALM_PANEL_STYLE: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "var(--radius-md)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
  padding: "18px",
  color: "var(--color-text3)",
  fontSize: "13px",
  textAlign: "center",
};

// ---------------------------------------------------------------------------
// Per-status visuals (icon + tint tokens)
// ---------------------------------------------------------------------------

interface StatusVisual {
  icon: string;
  bg: string;
  fg: string;
  label: string;
}

const STATUS_VISUALS = {
  stale: {
    icon: "ti-clock-exclamation",
    bg: "var(--color-danger-bg)",
    fg: "var(--color-danger)",
    label: "estancado",
  },
  "in-progress": {
    icon: "ti-hammer",
    bg: "var(--color-accent-bg)",
    fg: "var(--color-accent-text)",
    label: "en curso",
  },
  ready: {
    icon: "ti-git-merge",
    bg: "var(--color-ok-bg)",
    fg: "var(--color-ok)",
    label: "listo, sin mergear",
  },
} satisfies Record<PendingItem["status"], StatusVisual>;

// ---------------------------------------------------------------------------
// Right-slot chip for SectionHead
// ---------------------------------------------------------------------------

function CountChip({ count, hasStale }: { count: number; hasStale: boolean }): React.JSX.Element {
  const tone = hasStale ? "var(--color-danger)" : "var(--color-accent-text)";
  const bg = hasStale ? "var(--color-danger-bg)" : "var(--color-accent-bg)";
  return (
    <span
      data-testid="factory-worktrees-count"
      role="status"
      aria-label={`${count} árbol${count === 1 ? "" : "es"} pendiente${count === 1 ? "" : "s"}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "var(--radius-sm)",
        fontSize: "11px",
        fontWeight: 500,
        background: bg,
        color: tone,
      }}
    >
      ⎇ {count} pendiente{count === 1 ? "" : "s"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// WorktreeRow — one pending-branch card
// ---------------------------------------------------------------------------

function landCommand(item: PendingItem): string {
  if (item.worktree) return `cd ${item.worktree} && bash .pandacorp/merge-queue.sh`;
  return `git checkout ${item.branch} && bash .pandacorp/merge-queue.sh`;
}

function WorktreeRow({ item }: { item: PendingItem }): React.JSX.Element {
  const visual = STATUS_VISUALS[item.status];
  const cmd = landCommand(item);

  return (
    <li data-testid="factory-worktrees-row" style={CARD_STYLE}>
      {/* Icon tile */}
      <span
        aria-hidden="true"
        style={{ ...ICON_TILE_BASE, background: visual.bg, color: visual.fg }}
      >
        <i className={`ti ${visual.icon}`} style={{ fontSize: "18px" }} />
      </span>

      {/* Middle: branch + task + meta */}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={BRANCH_STYLE}>{item.branch}</span>
        {item.task && (
          <span style={{ ...TASK_STYLE, display: "block" }} data-testid="factory-worktrees-task">
            {item.task}
          </span>
        )}
        <span style={{ ...META_STYLE, display: "block" }}>
          <span data-testid="factory-worktrees-status">{visual.label}</span>
          {" · "}+{item.ahead} commit{item.ahead === 1 ? "" : "s"} · {item.ageHours}h
        </span>
      </span>

      {/* Right: copyable land command */}
      <span style={CMD_CHIP_STYLE}>
        <span style={CMD_TEXT_STYLE} title={cmd}>
          {cmd}
        </span>
        <CopyButton value={cmd} />
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// FactoryWorktrees — the section
// ---------------------------------------------------------------------------

export interface FactoryWorktreesProps {
  /** Pending-merge result for the factory repo, from getPendingMerge(). */
  result: PendingResult;
}

/**
 * FactoryWorktrees — dashboard section showing un-merged worktrees of the factory repo.
 *
 * Renders a SectionHead + one row-card per pending branch, ordered stale-first. Empty and
 * error states are distinct. Placed between Cartera and Progreso on the Inicio dashboard.
 *
 * @param result - PendingResult from getPendingMerge() (the single factory-repo source).
 */
export function FactoryWorktrees({ result }: FactoryWorktreesProps): React.JSX.Element {
  const hasItems = result.kind === "ok";
  const hasStale = hasItems && result.items.some((i) => i.status === "stale");
  const count = hasItems ? result.items.length : 0;

  const rightSlot =
    result.kind === "ok" ? (
      <CountChip count={count} hasStale={hasStale} />
    ) : (
      <span
        data-testid="factory-worktrees-al-dia"
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "2px 8px",
          borderRadius: "var(--radius-sm)",
          fontSize: "11px",
          fontWeight: 500,
          background: "var(--color-ok-bg)",
          color: "var(--color-ok)",
        }}
      >
        al día
      </span>
    );

  return (
    <section aria-labelledby="factory-worktrees-heading-id" data-testid="factory-worktrees">
      {/* Hidden heading for aria-labelledby */}
      <h2
        id="factory-worktrees-heading-id"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
        }}
      >
        Árboles de trabajo
      </h2>

      <SectionHead icon="ti-git-branch" label="Árboles de trabajo" rightHtml={rightSlot} />

      {result.kind === "error" && (
        <div
          data-testid="factory-worktrees-error"
          role="status"
          style={{ ...CALM_PANEL_STYLE, color: "var(--color-danger)" }}
        >
          <i className="ti ti-alert-triangle" style={{ fontSize: "18px" }} aria-hidden="true" />
          <div style={{ marginTop: "6px" }}>
            No se pudo leer el estado de git. Verifica que la fábrica sea un repo válido.
          </div>
        </div>
      )}

      {result.kind === "empty" && (
        <div data-testid="factory-worktrees-empty" role="status" style={CALM_PANEL_STYLE}>
          <i
            className="ti ti-circle-check"
            style={{ fontSize: "20px", color: "var(--color-ok)" }}
            aria-hidden="true"
          />
          <div style={{ marginTop: "6px" }}>Sin árboles de trabajo pendientes — todo en main.</div>
        </div>
      )}

      {result.kind === "ok" && (
        <ul
          data-testid="factory-worktrees-list"
          aria-label="Árboles de trabajo pendientes"
          style={{ ...SECTION_STYLE, listStyle: "none", margin: 0, padding: 0 }}
        >
          {result.items.map((item) => (
            <WorktreeRow key={item.branch} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
