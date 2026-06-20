/**
 * SelectableProjectRail — URL-driven project rail with clickable rows.
 *
 * Wraps each project row in a Next.js <Link href="?project=<name>"> so
 * clicking a row navigates to that project's URL param (Server-rendered,
 * no client selection state, no flash — WO-03-004 design).
 *
 * The currently-selected row is marked with `data-selected="true"`.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - data-testid on every significant element.
 *   - Spanish aria-labels and user-facing copy.
 *   - Indicators are NOT color-only (icon + text label).
 *
 * Traceability:
 *   CMP-03-workspace-slot (selection behaviour) → REQ-03-004, REQ-03-005
 *   CMP-03-rail (rail container) → REQ-03-001
 *   CMP-03-row (row display) → REQ-03-002
 *   AC-03-004.1, AC-03-005.1
 *   WO-03-004
 */

import Link from "next/link";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import { BusinessSnapshot } from "./_components/BusinessSnapshot/BusinessSnapshot";
import { RecoveryHint } from "./_components/RecoveryHint/RecoveryHint";
import { StatusChips } from "./_components/status-chips/status-chips";

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded hex/rgb/hsl values.
// ---------------------------------------------------------------------------

const RAIL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.375)",
  padding: "calc(var(--space-base, 1rem) * 0.75)",
};

const LINK_STYLE: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: "inherit",
  borderRadius: "var(--radius, 0.5rem)",
  // Negative margin so the link's hit-target spans the row's horizontal padding
  // while the row container owns the block-level chrome (border, shadow).
  margin: "calc(var(--space-base, 1rem) * -0.25) calc(var(--space-base, 1rem) * -0.375)",
  padding: "calc(var(--space-base, 1rem) * 0.25) calc(var(--space-base, 1rem) * 0.375)",
};

/**
 * Rail item base style — matches prototype `.rail`:
 * padding 9px 11px, transparent border (appears on hover/selected),
 * no background in resting state (hover → secondary, selected → accent-bg).
 */
const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.25)",
  padding: "9px 11px",
  border: "0.5px solid transparent",
  borderRadius: "var(--radius-md, var(--radius, 0.5rem))",
  cursor: "pointer",
  marginBottom: "6px",
  minWidth: 0,
};

/**
 * Rail item selected style — matches prototype `.rail.on`:
 * accent-bg fill + accent border + inset accent ring.
 */
const ROW_SELECTED_STYLE: React.CSSProperties = {
  ...ROW_STYLE,
  background: "var(--color-accent-bg, currentColor)",
  borderColor: "var(--color-accent, currentColor)",
  boxShadow: "inset 0 0 0 1px var(--color-accent, currentColor)",
};

const ROW_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--space-base, 1rem) * 0.375)",
  flexWrap: "wrap",
  minWidth: 0,
};

const NAME_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 600,
  lineHeight: 1.4,
  color: "var(--color-text, currentColor)",
  margin: 0,
  wordBreak: "break-word",
  flex: 1,
  minWidth: 0,
};

const CHIP_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.125rem 0.375rem",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  fontSize: "0.6875rem",
  fontWeight: 500,
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const CHIP_BUILDING_STYLE: React.CSSProperties = {
  ...CHIP_STYLE,
  background: "var(--color-agent-frontend-dev, currentColor)",
  color: "var(--color-contrast, Canvas)",
  border: "none",
  fontWeight: 600,
};

const CHIP_STOPPED_STYLE: React.CSSProperties = {
  ...CHIP_STYLE,
  opacity: 0.55,
};

/** Status icon: play (running) or pause (stopped). Matches prototype ti-player-* icons. */
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

/** Stage line — second line below icon+title row, indented 22px (matches prototype stage label). */
const STAGE_LINE_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3, currentColor)",
  marginTop: "3px",
  marginLeft: "22px",
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
// Per-row derivation — pull the status/indicator computation out of the map
// callback so the render stays flat and under the complexity budget.
// ---------------------------------------------------------------------------

interface RowView {
  rowStyle: React.CSSProperties;
  indicatorStyle: React.CSSProperties;
  indicatorLabel: string;
  indicatorAriaLabel: string;
  pendingDecisions: number | undefined;
  pendingBugs: number | undefined;
  rethinkPending: true | undefined;
}

/** Compute the derived view fields (styles, indicator copy, status counts) for one row. */
function deriveRowView(item: ProjectListItem, isSelected: boolean): RowView {
  const isRunning = item.running === true;

  // Extract pending fields from status.status (Partial<ProjectStatus>).
  // Absent / malformed status → undefined → StatusChips renders nothing.
  const statusFields = item.status.present && item.status.status !== null ? item.status.status : {};

  return {
    rowStyle: isSelected ? ROW_SELECTED_STYLE : ROW_STYLE,
    indicatorStyle: isRunning ? CHIP_BUILDING_STYLE : CHIP_STOPPED_STYLE,
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
// Props
// ---------------------------------------------------------------------------

export interface SelectableProjectRailProps {
  /** Active project list from activeProjects(). */
  items: ProjectListItem[];
  /** The currently-selected project name (from URL param or default-select). */
  selectedSlug: string | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SelectableProjectRail — vertical rail with URL-driven project selection.
 *
 * Each row is a Link to `?project=<name>`. The selected row gets
 * `data-selected="true"` and a distinct visual treatment.
 */
export function SelectableProjectRail({
  items,
  selectedSlug,
}: SelectableProjectRailProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <nav data-testid="selectable-project-rail" style={RAIL_STYLE} aria-label="Proyectos activos">
        <div data-testid="selectable-project-rail-empty" style={EMPTY_STYLE} aria-live="polite">
          <p style={{ margin: 0, fontSize: "0.875rem" }}>Sin proyectos activos.</p>
          <p style={{ margin: 0, fontSize: "0.75rem" }}>
            Usa <code style={{ fontFamily: "monospace" }}>/pandacorp:spec</code> para crear uno.
          </p>
        </div>
      </nav>
    );
  }

  return (
    <nav data-testid="selectable-project-rail" style={RAIL_STYLE} aria-label="Proyectos activos">
      {items.map((item) => {
        const isSelected = item.name === selectedSlug;
        const {
          rowStyle,
          indicatorStyle,
          indicatorLabel,
          indicatorAriaLabel,
          pendingDecisions,
          pendingBugs,
          rethinkPending,
        } = deriveRowView(item, isSelected);

        return (
          // The <article> is the ROW CONTAINER (block-level chrome). The navigation
          // <Link> wraps ONLY the row's chrome (name + stage + indicator); the
          // recovery hint — which renders a <button> (CopyButton) — is a SIBLING of
          // the link, never a descendant, so no <button> is nested inside an <a>
          // (invalid interactive-content nesting; HTML spec / WCAG 4.1.2). WO-03-004.
          <article
            key={item.name}
            data-testid="selectable-project-row"
            data-selected={String(isSelected)}
            style={rowStyle}
            aria-label={`Proyecto: ${item.name}`}
          >
            <Link
              href={`?project=${encodeURIComponent(item.name)}`}
              style={LINK_STYLE}
              aria-label={`Seleccionar proyecto: ${item.name}`}
              aria-current={isSelected ? "page" : undefined}
            >
              {/* Title row: [status icon] [name] [count badges] — matches prototype rail item */}
              <div style={ROW_HEADER_STYLE}>
                {/* Status icon (AC-03-002.1) — ti-player-play (ok) or ti-player-pause (text3).
                    Only shown when the path exists; a missing path has no running state. */}
                {item.exists && item.running !== undefined && (
                  <i
                    data-testid="rail-item-status-icon"
                    className={`ti ${item.running ? "ti-player-play" : "ti-player-pause"}`}
                    style={item.running ? ICON_RUNNING_STYLE : ICON_STOPPED_STYLE}
                    aria-hidden="true"
                  />
                )}

                {/* Project name (500 weight, matches prototype `font-weight:500`) */}
                <h3 style={NAME_STYLE}>{item.name}</h3>

                {/* Count badges slot — StatusChips renders inline here on the title row */}
              </div>

              {/* Stage line — second line below icon+title, indented (prototype stage label) */}
              {item.stage !== undefined && (
                <div data-testid="selectable-row-stage" style={STAGE_LINE_STYLE}>
                  {item.stage}
                </div>
              )}

              {/* Running indicator — kept for existing tests that query selectable-row-indicator */}
              {item.running !== undefined && item.exists && (
                <span
                  data-testid="selectable-row-indicator"
                  style={indicatorStyle}
                  role="status"
                  aria-label={indicatorAriaLabel}
                  className="sr-only"
                >
                  {indicatorLabel}
                </span>
              )}
            </Link>

            {/* Status chips: decisions / bugs / rethink (CMP-14-status-chips, WO-14-003).
                Sibling of the link — chips are non-navigational metadata. */}
            <StatusChips
              pendingDecisions={pendingDecisions}
              pendingBugs={pendingBugs}
              rethinkPending={rethinkPending}
            />

            {/* Business snapshot for shipped/operation rows (CMP-03-snapshot, AC-03-003.1).
                Renders nothing when no snapshot fields are present. */}
            {item.snapshot !== undefined && (
              <BusinessSnapshot
                users={item.snapshot.users}
                returnMetric={item.snapshot.returnMetric}
                verdict={item.snapshot.verdict}
              />
            )}

            {/* Path-not-found recovery (CMP-03-recovery, AC-03-006.2/.3). Renders nothing
                when the path exists; otherwise shows the badge + copyable command.
                Sibling of the link so its CopyButton (<button>) is NOT nested in the <a>. */}
            <RecoveryHint exists={item.exists} path={item.path} repo={item.repo} />
          </article>
        );
      })}
    </nav>
  );
}
