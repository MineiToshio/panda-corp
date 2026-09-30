/**
 * ProjectRail — the Portfolio's vertical rail of projects (CMP-03-rail).
 *
 * Consumes the IF-03-activeProjects contract (lib/portfolio/portfolio.ts → railProjects()) and is
 * the ONE portfolio list (DR-057): URL-driven selection, every row a Next.js <Link> to
 * ?project=<name>; the selected row gets data-selected="true" and an accent ring.
 *
 * Faithful to the prototype `.rail` item: [status icon] name + pending-decisions/bugs dots
 * (right-aligned, no text label) + Spanish stage line + last-sync chip + optional "replanteo en
 * curso" line. No business snapshot in the rail (FRD-03 defers it). RecoveryHint is a sibling of the
 * Link (never a descendant) so no <button> is nested inside an <a> (WCAG 4.1.2).
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - data-testid on every interactive/significant element (test-writer contract).
 *   - Spanish aria-labels and user-facing copy.
 *   - Server Component safe — no hooks, no browser APIs.
 *
 * Traceability:
 *   CMP-03-rail, CMP-03-row, CMP-03-empty, CMP-03-recovery
 *   IF-03-activeProjects (docs/api.md WO-03-001)
 *   REQ-03-001, REQ-03-002, REQ-03-004, REQ-03-005, REQ-03-006, REQ-03-007
 *   DR-057 (reuse-before-create): ONE rail primitive, not two
 */

import Link from "next/link";
import { RecoveryHint } from "@/app/portfolio/_components/RecoveryHint/RecoveryHint";
import { CountBadge } from "@/components/core/CountBadge/CountBadge";
import { LastSyncChip } from "@/components/modules/ProjectRail/LastSyncChip";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProjectRailProps {
  /** Rail project list from railProjects(). */
  items: ProjectListItem[];
  /**
   * The selected project's name (URL-driven selection). The matching row gets data-selected="true"
   * and the accent fill; pass "" when nothing is selectable (empty list).
   */
  selectedSlug: string;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded hex/rgb/hsl values.
// Fallbacks use system semantic values so the component renders before
// design tokens are frozen (WO-13-002, globals.css).
// ---------------------------------------------------------------------------

/** Rail container layout — flex column, token-based gap + padding. */
const RAIL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.5)",
  padding: "calc(var(--space-base, 1rem) * 0.75)",
  minWidth: 0,
};

const ROW_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--space-base, 1rem) * 0.375)",
  flexWrap: "wrap",
  minWidth: 0,
};

const PROJECT_NAME_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 600,
  lineHeight: 1.4,
  color: "var(--color-text, currentColor)",
  margin: 0,
  wordBreak: "break-word",
  flex: 1,
  minWidth: 0,
};

/** Stage line — second line below icon+title row (indented 22px). */
const STAGE_LINE_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3, currentColor)",
  marginTop: "3px",
  marginLeft: "22px",
};

/** Spanish phase labels (UI copy in Spanish, architecture §7) — never show the raw English phase. */
const PHASE_LABELS: Record<string, string> = {
  product: "Producto",
  design: "Diseño",
  architecture: "Arquitectura",
  implementation: "En construcción",
  release: "Lanzamiento",
};

/** Status icon: ok (play) / text3 (pause). */
const ICON_RUNNING_STYLE: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--color-ok, currentColor)",
  flexShrink: 0,
};

const ICON_STOPPED_STYLE: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--color-text3, currentColor)",
  flexShrink: 0,
};

/** Link wrapper for selectable rows — full-row click target; no visual chrome. */
const LINK_STYLE: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: "inherit",
  borderRadius: "var(--radius, 0.5rem)",
  margin: "calc(var(--space-base, 1rem) * -0.25) calc(var(--space-base, 1rem) * -0.375)",
  padding: "calc(var(--space-base, 1rem) * 0.25) calc(var(--space-base, 1rem) * 0.375)",
};

// ---------------------------------------------------------------------------
// Selectable-row styles — faithful to the prototype `.rail` item (index.html):
//   .rail   { padding:9px 11px; border-radius:var(--rmd); border:.5px solid transparent }
//   .rail.on{ background:var(--accent-bg); border-color:var(--accent); box-shadow:inset 0 0 0 1px var(--accent) }
// The rail item has NO per-row card chrome (no surface fill, no 1px border, no
// drop shadow) — only the selected state draws an accent ring.
// ---------------------------------------------------------------------------

/** Selectable rail item — transparent hairline border, radius-md, compact padding (.rail). */
const SELECTABLE_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.1875)",
  padding: "9px 11px",
  borderRadius: "var(--radius-md, 0.75rem)",
  border: "0.5px solid transparent",
  minWidth: 0,
};

/** Selected selectable rail item (.rail.on): accent-bg fill + accent border + inset ring. */
const SELECTABLE_ROW_SELECTED_STYLE: React.CSSProperties = {
  ...SELECTABLE_ROW_STYLE,
  background: "var(--color-accent-bg, currentColor)",
  border: "0.5px solid var(--color-accent, currentColor)",
  boxShadow: "inset 0 0 0 1px var(--color-accent, currentColor)",
};

/** Right-aligned inline group holding the pending-decisions / bugs dots (no text label). */
const RAIL_DOTS_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  flex: "0 0 auto",
  marginLeft: "auto",
};

/** Rethink "replanteo en curso" line — indented accent chip below the stage (prototype). */
const RETHINK_LINE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  marginTop: "4px",
  marginLeft: "22px",
  padding: "2px 8px",
  borderRadius: "var(--radius-md, 0.75rem)",
  fontSize: "10px",
  fontWeight: 500,
  background: "var(--color-accent-bg, currentColor)",
  color: "var(--color-accent-text, currentColor)",
};

const EMPTY_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "calc(var(--space-base, 1rem) * 0.5)",
  padding: "calc(var(--space-base, 1rem) * 2)",
  textAlign: "center",
  color: "var(--color-text, currentColor)",
  opacity: 0.7,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SelectableEmptyState(): React.JSX.Element {
  return (
    <div data-testid="selectable-project-rail-empty" style={EMPTY_STYLE} aria-live="polite">
      <p style={{ margin: 0, fontSize: "0.875rem" }}>Sin proyectos activos.</p>
      <p style={{ margin: 0, fontSize: "0.75rem" }}>
        Usa <code style={{ fontFamily: "monospace" }}>/pandacorp:spec</code> para crear uno.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-row derivation helpers
// ---------------------------------------------------------------------------

interface SelectableRowView {
  rowStyle: React.CSSProperties;
  indicatorLabel: string;
  indicatorAriaLabel: string;
  pendingDecisions: number | undefined;
  pendingBugs: number | undefined;
  rethinkPending: true | undefined;
}

/** Compute derived view fields for a selectable row. */
function deriveSelectableRowView(item: ProjectListItem, isSelected: boolean): SelectableRowView {
  const isRunning = item.running === true;
  const statusFields = item.status.present && item.status.status !== null ? item.status.status : {};

  return {
    rowStyle: isSelected ? SELECTABLE_ROW_SELECTED_STYLE : SELECTABLE_ROW_STYLE,
    indicatorLabel: isRunning ? "Construyendo" : "Parado",
    indicatorAriaLabel: isRunning ? "Construcción activa" : "Proceso detenido",
    pendingDecisions:
      typeof statusFields.pendingDecisions === "number" ? statusFields.pendingDecisions : undefined,
    pendingBugs:
      typeof statusFields.pendingBugs === "number" ? statusFields.pendingBugs : undefined,
    rethinkPending: statusFields.rethinkPending === true ? true : undefined,
  };
}

// ---------------------------------------------------------------------------
// Selectable row (URL-driven, with Link navigation)
// ---------------------------------------------------------------------------

/**
 * SelectableRow — one project row (DR-057).
 *
 * Faithful to the prototype `.rail` item (portfolioView in index.html):
 *   [icon] [name ........] [dot dot]   ← decisions/bugs as bare dots, right-aligned
 *   stage label (indented)
 *   [replanteo en curso] (indented, when rethinkPending)
 *
 * NO business snapshot and NO "N decisiones" text label — the rail item is just
 * name + stage + count dots. The dots are non-interactive spans, so they sit
 * inside the navigation Link's title row (matching the prototype, where the whole
 * rail item is the click target). RecoveryHint is a SIBLING of the Link (its
 * CopyButton must not be a <button> nested inside <a>; WCAG 4.1.2).
 */
function SelectableRow({
  item,
  isSelected,
}: {
  item: ProjectListItem;
  isSelected: boolean;
}): React.JSX.Element {
  const {
    rowStyle,
    indicatorLabel,
    indicatorAriaLabel,
    pendingDecisions,
    pendingBugs,
    rethinkPending,
  } = deriveSelectableRowView(item, isSelected);

  const hasDecisions = typeof pendingDecisions === "number" && pendingDecisions > 0;
  const hasBugs = typeof pendingBugs === "number" && pendingBugs > 0;

  return (
    <article
      key={item.name}
      data-testid="selectable-project-row"
      data-selected={String(isSelected)}
      style={rowStyle}
      aria-label={`Proyecto: ${item.name}`}
    >
      {/* Navigation Link — wraps the row's visual chrome (icon + title + dots + stage).
          The count dots are plain spans (non-interactive), so they are valid inside <a>.
          RecoveryHint (with its CopyButton) is a sibling, never a descendant. */}
      <Link
        href={`?project=${encodeURIComponent(item.name)}`}
        style={LINK_STYLE}
        aria-label={`Seleccionar proyecto: ${item.name}`}
        aria-current={isSelected ? "page" : undefined}
      >
        {/* Title row: [status icon] [name] [dots →] — matches prototype rail item layout */}
        <div style={ROW_HEADER_STYLE}>
          {/* Status icon — ti-player-play (ok) or ti-player-pause (text3).
              Only shown when the path exists; a missing path has no running state. */}
          {item.exists && item.running !== undefined && (
            <i
              data-testid="rail-item-status-icon"
              className={`ti ${item.running ? "ti-player-play" : "ti-player-pause"}`}
              style={item.running ? ICON_RUNNING_STYLE : ICON_STOPPED_STYLE}
              aria-hidden="true"
            />
          )}

          {/* Project name (500 weight, matches prototype font-weight:500) */}
          <h3 style={PROJECT_NAME_STYLE}>{item.name}</h3>

          {/* Pending-decisions / bugs dots — right-aligned, inline, NO text label
              (prototype dchip/bchip). Each carries the title for a11y instead of a label. */}
          {(hasDecisions || hasBugs) && (
            <span style={RAIL_DOTS_STYLE}>
              {hasDecisions && typeof pendingDecisions === "number" && (
                <span
                  data-testid="status-chip-decisions"
                  title={`Decisiones pendientes: ${pendingDecisions}`}
                  role="status"
                >
                  <CountBadge count={pendingDecisions} tone="warn" />
                </span>
              )}
              {hasBugs && typeof pendingBugs === "number" && (
                <span
                  data-testid="status-chip-bugs"
                  title={`Bugs pendientes: ${pendingBugs}`}
                  role="status"
                >
                  <CountBadge count={pendingBugs} tone="danger" />
                </span>
              )}
            </span>
          )}
        </div>

        {/* Stage line — second line below icon+title, indented (prototype stage label) */}
        {item.stage !== undefined && (
          <div data-testid="selectable-row-stage" style={STAGE_LINE_STYLE}>
            {PHASE_LABELS[item.stage] ?? item.stage}
          </div>
        )}

        {/* Last-sync chip — relative time since the portfolio row's last sync (REQ-03-007) */}
        {item.lastSync !== undefined && <LastSyncChip lastSync={item.lastSync} />}

        {/* Rethink indicator — indented chip line below the stage (prototype rethink row) */}
        {rethinkPending === true && (
          <div data-testid="status-chip-rethink" style={RETHINK_LINE_STYLE}>
            <i
              className="ti ti-refresh-dot"
              style={{ fontSize: "10px", verticalAlign: "-1px" }}
              aria-hidden="true"
            />{" "}
            replanteo en curso
          </div>
        )}

        {/* Running indicator — sr-only; preserved for existing tests */}
        {item.running !== undefined && item.exists && (
          <span
            data-testid="selectable-row-indicator"
            role="status"
            aria-label={indicatorAriaLabel}
            className="sr-only"
          >
            {indicatorLabel}
          </span>
        )}
      </Link>

      {/* RecoveryHint — sibling of Link; renders when exists===false
          (CMP-03-recovery, AC-03-006.2/.3). Its CopyButton is NOT inside <a>. */}
      <RecoveryHint exists={item.exists} path={item.path} repo={item.repo} />
    </article>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * ProjectRail — vertical rail listing the Portfolio's projects from railProjects().
 * Server Component safe — no hooks, no browser APIs.
 *
 * Each row is a Link to ?project=<name>; the selected row is highlighted (accent-bg fill + accent
 * border) and each row carries the pending-decisions/bugs dots (right-aligned) + a RecoveryHint sibling.
 *
 * Traceability:
 *   CMP-03-rail → REQ-03-001, REQ-03-002, REQ-03-004, REQ-03-005, REQ-03-006, REQ-03-007
 *   IF-03-activeProjects (docs/api.md WO-03-001)
 *   DR-057 (reuse-before-create): ONE rail, not two
 */
export function ProjectRail({ items, selectedSlug }: ProjectRailProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <nav data-testid="selectable-project-rail" style={RAIL_STYLE} aria-label="Proyectos activos">
        <SelectableEmptyState />
      </nav>
    );
  }

  return (
    <nav data-testid="selectable-project-rail" style={RAIL_STYLE} aria-label="Proyectos activos">
      {items.map((item) => (
        <SelectableRow key={item.name} item={item} isSelected={item.name === selectedSlug} />
      ))}
    </nav>
  );
}
