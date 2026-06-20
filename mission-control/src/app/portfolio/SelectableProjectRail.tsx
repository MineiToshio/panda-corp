/**
 * SelectableProjectRail — URL-driven project rail with clickable rows.
 *
 * Wraps each project row in a Next.js <Link href="?project=<name>"> so
 * clicking a row navigates to that project's URL param (Server-rendered,
 * no client selection state, no flash — WO-03-002 design).
 *
 * Layout (from prototype portfolioView(), FDD-03):
 *   - One .rail item per building/shipped project
 *   - .rail.on = selected: accent-bg fill + accent border + inset ring
 *   - Each item: status icon (ti-player-play ok / ti-player-pause text3) + title +
 *     count badges (decisions/bugs) + stage line (text3, margin-left 22px)
 *
 * HTML nesting invariant (WO-03-004 fix):
 *   The <article> is the ROW CONTAINER. The <Link> wraps ONLY the navigational
 *   chrome (icon + name + stage). StatusChips, RecoveryHint (which renders Banner
 *   with CopyButton) are SIBLINGS of the link — never descendants — so no <button>
 *   is nested inside an <a> (invalid interactive-content, HTML spec / WCAG 4.1.2).
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - data-testid on every significant element.
 *   - Spanish aria-labels and user-facing copy.
 *   - Indicators are NOT color-only (icon + text label, AC-13-003 / FRD-13).
 *
 * Traceability:
 *   CMP-03-rail, CMP-03-row → REQ-03-001, REQ-03-002
 *   CMP-03-workspace-slot (selection) → REQ-03-004, REQ-03-005
 *   AC-03-001, AC-03-002, AC-03-004, AC-03-005
 *   WO-03-002
 */

import Link from "next/link";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import { BusinessSnapshot } from "./_components/BusinessSnapshot/BusinessSnapshot";
import { RecoveryHint } from "./_components/RecoveryHint/RecoveryHint";
import { StatusChips } from "./_components/status-chips/status-chips";

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded hex/rgb/hsl values.
// Mirrors the prototype .rail / .rail.on from index.html:
//   .rail { padding:9px 11px; border-radius:var(--rmd); cursor:pointer;
//           margin-bottom:6px; border:.5px solid transparent }
//   .rail.on { background:var(--accent-bg); border-color:var(--accent);
//              box-shadow:inset 0 0 0 1px var(--accent) }
// ---------------------------------------------------------------------------

const RAIL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

const ROW_BASE_STYLE: React.CSSProperties = {
  padding: "9px 11px",
  borderRadius: "var(--radius, 0.5rem)",
  cursor: "pointer",
  marginBottom: "6px",
  border: "0.5px solid transparent",
  minWidth: 0,
};

const ROW_SELECTED_STYLE: React.CSSProperties = {
  ...ROW_BASE_STYLE,
  background: "var(--color-accent-bg)",
  borderColor: "var(--color-accent)",
  boxShadow: "inset 0 0 0 1px var(--color-accent)",
};

const ROW_DEFAULT_STYLE: React.CSSProperties = {
  ...ROW_BASE_STYLE,
  background: "transparent",
};

const LINK_STYLE: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: "inherit",
};

const ROW_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minWidth: 0,
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  flex: 1,
  minWidth: 0,
  margin: 0,
  wordBreak: "break-word",
  color: "var(--color-text)",
};

/** Count badges wrapper — trailing, flex:0 0 auto so it doesn't shrink */
const BADGES_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "4px",
  flex: "0 0 auto",
};

/** Stage line: 11px text3, margin-top 3px, margin-left 22px (icon 14px + gap 8px) */
const STAGE_LINE_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3, var(--color-text))",
  marginTop: "3px",
  marginLeft: "22px",
  lineHeight: 1.4,
};

/** Rethink chip wrapper */
const RETHINK_WRAP_STYLE: React.CSSProperties = {
  marginTop: "4px",
  marginLeft: "22px",
};

const RETHINK_CHIP_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "3px",
  background: "var(--color-accent-bg)",
  color: "var(--color-accent-text, var(--color-accent))",
  fontSize: "10px",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  padding: "0 5px",
  height: "17px",
};

const COUNT_BADGE_WARN_STYLE: React.CSSProperties = {
  background: "var(--color-warn)",
  color: "var(--color-canvas, Canvas)",
  borderRadius: "99px",
  fontSize: "10px",
  fontWeight: 500,
  minWidth: "17px",
  height: "17px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 5px",
  flex: "0 0 auto",
  fontVariantNumeric: "tabular-nums",
};

const COUNT_BADGE_DANGER_STYLE: React.CSSProperties = {
  ...COUNT_BADGE_WARN_STYLE,
  background: "var(--color-danger)",
};

/** Empty state text */
const EMPTY_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text3, var(--color-text))",
  padding: "8px 6px",
};

// ---------------------------------------------------------------------------
// Derived row view — extracted from the map callback to reduce complexity
// ---------------------------------------------------------------------------

interface RowCounts {
  pendingDecisions: number | undefined;
  pendingBugs: number | undefined;
  rethinkPending: true | undefined;
}

/** Derive the status counts from a ProjectListItem (fail-soft). */
function deriveRowCounts(item: ProjectListItem): RowCounts {
  const statusFields = item.status.present && item.status.status !== null ? item.status.status : {};
  return {
    pendingDecisions:
      typeof statusFields.pendingDecisions === "number" ? statusFields.pendingDecisions : undefined,
    pendingBugs:
      typeof statusFields.pendingBugs === "number" ? statusFields.pendingBugs : undefined,
    rethinkPending: statusFields.rethinkPending === true ? true : undefined,
  };
}

// ---------------------------------------------------------------------------
// RailItem — one project row (extracted from map() to keep complexity ≤15)
// ---------------------------------------------------------------------------

interface RailItemProps {
  item: ProjectListItem;
  isSelected: boolean;
}

/**
 * RailItem — one selectable project row in the rail.
 *
 * The <article> is the block container; <Link> wraps only the navigational chrome
 * (icon + title + stage). StatusChips / BusinessSnapshot / RecoveryHint are siblings
 * of <Link>, never descendants, so no <button> nests inside <a> (WO-03-004 fix).
 */
function RailItem({ item, isSelected }: RailItemProps): React.JSX.Element {
  const isRunning = item.running === true;
  const { pendingDecisions, pendingBugs, rethinkPending } = deriveRowCounts(item);

  return (
    <article
      data-testid="selectable-project-row"
      data-selected={String(isSelected)}
      style={isSelected ? ROW_SELECTED_STYLE : ROW_DEFAULT_STYLE}
      aria-label={`Proyecto: ${item.name}`}
    >
      {/* Navigation link: icon + title + count badges + stage line */}
      <Link
        href={`?project=${encodeURIComponent(item.name)}`}
        style={LINK_STYLE}
        aria-label={`Seleccionar proyecto: ${item.name}`}
        aria-current={isSelected ? "page" : undefined}
      >
        {/* Header row: status indicator + title + count badges */}
        <div style={ROW_HEADER_STYLE}>
          {/* Status icon + text label. Not color-only (FRD-13 a11y). */}
          {item.running !== undefined && item.exists ? (
            <StatusIndicator isRunning={isRunning} />
          ) : null}

          {/* Project title */}
          <span style={TITLE_STYLE}>{item.name}</span>

          {/* Count badges: decisions + bugs (inline, trailing) */}
          <span style={BADGES_STYLE}>
            {pendingDecisions !== undefined && pendingDecisions > 0 && (
              <span
                data-testid="rail-badge-decisions"
                title={`${pendingDecisions} decisión(es) pendiente(s)`}
                style={COUNT_BADGE_WARN_STYLE}
              >
                {pendingDecisions}
              </span>
            )}
            {pendingBugs !== undefined && pendingBugs > 0 && (
              <span
                data-testid="rail-badge-bugs"
                title={`${pendingBugs} bug(s) por procesar`}
                style={COUNT_BADGE_DANGER_STYLE}
              >
                {pendingBugs}
              </span>
            )}
          </span>
        </div>

        {/* Stage line: text3, margin-left 22px (aligns under icon) */}
        {item.stage !== undefined && (
          <div data-testid="selectable-row-stage" style={STAGE_LINE_STYLE}>
            {item.stage}
          </div>
        )}

        {/* Rethink chip */}
        {rethinkPending && (
          <div style={RETHINK_WRAP_STYLE}>
            <span data-testid="selectable-row-rethink" style={RETHINK_CHIP_STYLE}>
              <i className="ti ti-refresh-dot" style={{ fontSize: "10px" }} aria-hidden="true" />
              {" replanteo en curso"}
            </span>
          </div>
        )}
      </Link>

      {/* Status chips (non-navigational metadata) — sibling of link, not descendant */}
      <StatusChips
        pendingDecisions={pendingDecisions}
        pendingBugs={pendingBugs}
        rethinkPending={rethinkPending}
      />

      {/* Business snapshot for shipped/operation rows — sibling of link */}
      {item.snapshot !== undefined && (
        <BusinessSnapshot
          users={item.snapshot.users}
          returnMetric={item.snapshot.returnMetric}
          verdict={item.snapshot.verdict}
        />
      )}

      {/* Path-not-found recovery (Banner) — sibling of link so CopyButton
          never nests inside <a> (valid interactive-content nesting, WO-03-004) */}
      <RecoveryHint exists={item.exists} path={item.path} repo={item.repo} />
    </article>
  );
}

// ---------------------------------------------------------------------------
// StatusIndicator — play/pause icon + text label (not color-only)
// ---------------------------------------------------------------------------

interface StatusIndicatorProps {
  isRunning: boolean;
}

/**
 * StatusIndicator — play/pause icon with text label.
 * Not color-only: icon + text always present (FRD-13 / WCAG 1.4.1).
 */
function StatusIndicator({ isRunning }: StatusIndicatorProps): React.JSX.Element {
  return (
    <span
      data-testid="selectable-row-indicator"
      role="status"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        flexShrink: 0,
        fontSize: "12px",
        color: isRunning ? "var(--color-ok)" : "var(--color-text3, var(--color-text))",
      }}
      aria-label={isRunning ? "Construcción activa" : "Proceso detenido"}
    >
      <i
        className={`ti ${isRunning ? "ti-player-play" : "ti-player-pause"}`}
        data-testid="rail-status-icon"
        style={{ fontSize: "14px", flexShrink: 0 }}
        aria-hidden="true"
      />
      <span style={{ fontSize: "11px", fontWeight: 500 }}>
        {isRunning ? "Construyendo" : "Parado"}
      </span>
    </span>
  );
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
// SelectableProjectRail (main export)
// ---------------------------------------------------------------------------

/**
 * SelectableProjectRail — vertical rail with URL-driven project selection.
 *
 * Each row is a RailItem with a Link to `?project=<name>`. The selected row gets
 * `data-selected="true"` and the .rail.on accent treatment (FDD-03).
 */
export function SelectableProjectRail({
  items,
  selectedSlug,
}: SelectableProjectRailProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <nav data-testid="selectable-project-rail" style={RAIL_STYLE} aria-label="Proyectos activos">
        <div data-testid="selectable-project-rail-empty" style={EMPTY_STYLE} aria-live="polite">
          Sin proyectos aún.
        </div>
      </nav>
    );
  }

  return (
    <nav data-testid="selectable-project-rail" style={RAIL_STYLE} aria-label="Proyectos activos">
      {items.map((item) => (
        <RailItem key={item.name} item={item} isSelected={item.name === selectedSlug} />
      ))}
    </nav>
  );
}
