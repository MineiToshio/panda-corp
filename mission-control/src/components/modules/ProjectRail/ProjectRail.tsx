/**
 * ProjectRail — Vertical rail of active projects (CMP-03-rail).
 *
 * Consumes IF-03-activeProjects contract (lib/portfolio.ts → activeProjects()).
 * Displays ProjectListItem[] as a vertical list with:
 *   - Project name, stage chip, building/stopped indicator (REQ-03-002)
 *   - Business snapshot chips for operation/shipped projects (REQ-03-003)
 *   - Path-not-found badge + copyable recovery command (REQ-03-006)
 *   - Graceful empty, loading and error states (architecture §7)
 *   - URL-driven selection mode (selectedSlug prop) — DR-057 reuse-before-create:
 *     the selectable variant is a PROP of this ONE shared rail, not a forked component.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - tabular-nums on business metrics (AC-13-003).
 *   - data-testid on every interactive/significant element (test-writer contract).
 *   - Spanish aria-labels and user-facing copy.
 *   - Server Component safe — no hooks, no browser APIs.
 *
 * Selectable mode (selectedSlug prop):
 *   - When selectedSlug is defined, each row becomes a Next.js <Link> to
 *     ?project=<name>; the selected row gets data-selected="true".
 *   - Testids switch to selectable-* so the integration seam used by
 *     app/portfolio/page.tsx tests stays valid.
 *   - StatusChips, BusinessSnapshot, RecoveryHint are siblings of the Link
 *     (never descendants) so no <button> is nested inside an <a> (WCAG 4.1.2).
 *
 * Traceability:
 *   CMP-03-rail, CMP-03-row, CMP-03-snapshot, CMP-03-empty, CMP-03-recovery
 *   IF-03-activeProjects (docs/api.md WO-03-001)
 *   REQ-03-001, REQ-03-002, REQ-03-003, REQ-03-004, REQ-03-005, REQ-03-006
 *   DR-057 (reuse-before-create): ONE rail primitive, not two
 */

import Link from "next/link";
import { BusinessSnapshot } from "@/app/portfolio/_components/BusinessSnapshot/BusinessSnapshot";
import { RecoveryHint } from "@/app/portfolio/_components/RecoveryHint/RecoveryHint";
import { StatusChips } from "@/app/portfolio/_components/status-chips/status-chips";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProjectRailProps {
  /** Active project list from activeProjects(). */
  items: ProjectListItem[];
  /** When true, render the loading skeleton instead of rows. */
  isLoading?: boolean;
  /** When set, render the error state with this message. */
  error?: string;
  /**
   * URL-driven selection mode (DR-057 selectable variant).
   * When provided, each row becomes a Link to ?project=<name>;
   * the matching row gets data-selected="true" and the accent fill.
   * Testids switch to selectable-* for integration-test compatibility.
   */
  selectedSlug?: string;
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

const STATE_BOX_STYLE: React.CSSProperties = {
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

const ERROR_BOX_STYLE: React.CSSProperties = {
  ...STATE_BOX_STYLE,
  color: "var(--color-error, currentColor)",
  border: "var(--hairline, 1px) solid var(--color-error, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  opacity: 0.85,
};

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.375)",
  padding: "calc(var(--space-base, 1rem) * 0.625) calc(var(--space-base, 1rem) * 0.75)",
  background: "var(--color-surface, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  boxShadow: "var(--shadow-1, none)",
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

const PATH_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
  color: "var(--color-text, currentColor)",
  opacity: 0.6,
  wordBreak: "break-all",
  margin: 0,
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

const BADGE_NOT_FOUND_STYLE: React.CSSProperties = {
  ...CHIP_STYLE,
  background: "var(--color-agent-security-auditor, currentColor)",
  color: "var(--color-contrast, Canvas)",
  border: "none",
  fontWeight: 700,
};

const SNAPSHOT_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "calc(var(--space-base, 1rem) * 0.25)",
  alignItems: "center",
  fontVariantNumeric: "tabular-nums",
};

const RECOVERY_BOX_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.375)",
  padding: "calc(var(--space-base, 1rem) * 0.5)",
  background: "var(--color-surface, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.75)",
  fontSize: "0.75rem",
};

const RECOVERY_LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  color: "var(--color-text, currentColor)",
  opacity: 0.65,
  margin: 0,
};

const RECOVERY_COMMAND_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--space-base, 1rem) * 0.375)",
  flexWrap: "wrap",
};

const CODE_STYLE: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "var(--color-accent, currentColor)",
  flex: 1,
  wordBreak: "break-all",
  minWidth: 0,
};

const WARNING_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--color-agent-security-auditor, currentColor)",
  margin: 0,
  lineHeight: 1.5,
};

/** Stage line — second line below icon+title row (selectable mode: indented 22px). */
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
  operation: "Operación",
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

/** Selected row treatment: accent-bg fill + accent border + inset ring (.rail.on). */
const ROW_SELECTED_STYLE: React.CSSProperties = {
  ...ROW_STYLE,
  background: "var(--color-accent-bg, currentColor)",
  borderColor: "var(--color-accent, currentColor)",
  boxShadow: "inset 0 0 0 1px var(--color-accent, currentColor)",
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
// Sub-components (non-selectable / shared)
// ---------------------------------------------------------------------------

function EmptyState(): React.JSX.Element {
  return (
    <div data-testid="project-rail-empty" style={STATE_BOX_STYLE} aria-live="polite">
      <p style={{ margin: 0, fontSize: "0.875rem" }}>Sin proyectos activos.</p>
      <p style={{ margin: 0, fontSize: "0.75rem" }}>
        Usa <code style={{ fontFamily: "monospace" }}>/pandacorp:spec</code> para crear uno.
      </p>
    </div>
  );
}

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

function LoadingState(): React.JSX.Element {
  return (
    <div
      data-testid="project-rail-loading"
      style={STATE_BOX_STYLE}
      aria-live="polite"
      aria-busy="true"
    >
      <p style={{ margin: 0, fontSize: "0.875rem" }}>Cargando proyectos…</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }): React.JSX.Element {
  return (
    <div
      data-testid="project-rail-error"
      style={ERROR_BOX_STYLE}
      role="alert"
      aria-live="assertive"
    >
      <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem" }}>
        Error al cargar el portafolio
      </p>
      <p style={{ margin: 0, fontSize: "0.75rem" }}>{message}</p>
    </div>
  );
}

/**
 * Recovery hint for path-not-found entries (REQ-03-006 / CMP-03-recovery).
 * Used by the non-selectable ProjectRow. Read-only: copyable command only.
 */
function InlineRecoveryHint({
  repo,
  path,
}: {
  repo: string | undefined;
  path: string;
}): React.JSX.Element {
  if (repo !== undefined) {
    const cloneCommand = `git clone ${repo} ${path} && /pandacorp:sync-portfolio`;
    return (
      <div data-testid="project-rail-recovery" style={RECOVERY_BOX_STYLE}>
        <p style={RECOVERY_LABEL_STYLE}>Recuperación (solo lectura):</p>
        <div style={RECOVERY_COMMAND_ROW_STYLE}>
          <code data-testid="project-rail-recovery-command" style={CODE_STYLE}>
            {cloneCommand}
          </code>
          <CopyButton value={cloneCommand} label="Copiar" />
        </div>
      </div>
    );
  }

  return (
    <div data-testid="project-rail-recovery" style={RECOVERY_BOX_STYLE}>
      <p data-testid="project-rail-recovery-no-repo" style={WARNING_STYLE}>
        Sin repositorio registrado — revisa un respaldo local o recrea con{" "}
        <code style={{ fontFamily: "monospace" }}>/pandacorp:spec</code>.
      </p>
    </div>
  );
}

/**
 * Business snapshot chips for operation (shipped) projects (REQ-03-003 / CMP-03-snapshot).
 * Used by the non-selectable ProjectRow. Renders users / returnMetric / verdict chips.
 */
function InlineBusinessSnapshot({
  users,
  returnMetric,
  verdict,
}: {
  users?: string;
  returnMetric?: string;
  verdict?: string;
}): React.JSX.Element | null {
  const hasAny = users !== undefined || returnMetric !== undefined || verdict !== undefined;
  if (!hasAny) return null;

  return (
    <div data-testid="project-rail-snapshot" style={SNAPSHOT_ROW_STYLE}>
      {users !== undefined && (
        <span
          data-testid="project-rail-snapshot-users"
          style={CHIP_STYLE}
          title={`Usuarios: ${users}`}
        >
          {users} usuarios
        </span>
      )}
      {returnMetric !== undefined && (
        <span
          data-testid="project-rail-snapshot-return"
          style={CHIP_STYLE}
          title={`Retorno: ${returnMetric}`}
        >
          {returnMetric}
        </span>
      )}
      {verdict !== undefined && (
        <span
          data-testid="project-rail-snapshot-verdict"
          style={CHIP_STYLE}
          title={`Veredicto: ${verdict}`}
        >
          {verdict}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Non-selectable row (original ProjectRow)
// ---------------------------------------------------------------------------

/**
 * Single project row (CMP-03-row): name, stage chip, running indicator, snapshot, not-found badge.
 * REQ-03-002: indicator is not color-only — icon signal via aria-label + text label.
 */
function ProjectRow({ item }: { item: ProjectListItem }): React.JSX.Element {
  const { name, path, repo, stage, running, exists, snapshot } = item;
  const isOperation = stage === "operation";
  const indicatorStyle = running === true ? CHIP_BUILDING_STYLE : CHIP_STOPPED_STYLE;
  const indicatorLabel = running === true ? "Construyendo" : "Parado";
  const indicatorAriaLabel = running === true ? "Construcción activa" : "Proceso detenido";

  return (
    <article data-testid="project-rail-row" style={ROW_STYLE} aria-label={`Proyecto: ${name}`}>
      {/* Header: name + stage + indicators */}
      <div style={ROW_HEADER_STYLE}>
        <h3 data-testid="project-rail-row-name" style={PROJECT_NAME_STYLE}>
          {name}
        </h3>

        {/* Path-not-found badge (REQ-03-006) */}
        {!exists && (
          <span
            data-testid="project-rail-row-not-found-badge"
            style={BADGE_NOT_FOUND_STYLE}
            role="status"
            aria-label="Ruta no encontrada en disco"
          >
            ⚠ ruta no encontrada
          </span>
        )}

        {/* Stage chip */}
        {stage !== undefined && (
          <span data-testid="project-rail-row-stage" style={CHIP_STYLE} title={`Fase: ${stage}`}>
            {PHASE_LABELS[stage] ?? stage}
          </span>
        )}

        {/* Running indicator (REQ-03-002): building / stopped. Not color-only: text label. */}
        {running !== undefined && exists && (
          <span
            data-testid="project-rail-row-indicator"
            style={indicatorStyle}
            role="status"
            aria-label={indicatorAriaLabel}
          >
            {indicatorLabel}
          </span>
        )}
      </div>

      {/* Path */}
      <p data-testid="project-rail-row-path" style={PATH_STYLE}>
        {path}
      </p>

      {/* Business snapshot — operation only (REQ-03-003) */}
      {isOperation && snapshot !== undefined && (
        <InlineBusinessSnapshot
          users={snapshot.users}
          returnMetric={snapshot.returnMetric}
          verdict={snapshot.verdict}
        />
      )}

      {/* Recovery hint — only when path not found (REQ-03-006) */}
      {!exists && <InlineRecoveryHint repo={repo} path={path} />}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Per-row derivation helpers (selectable mode)
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
    rowStyle: isSelected ? ROW_SELECTED_STYLE : ROW_STYLE,
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
 * SelectableRow — one project row in selectable mode (DR-057 rail variant).
 *
 * Each row is a Next.js <Link> for URL-driven navigation. StatusChips,
 * BusinessSnapshot and RecoveryHint are SIBLINGS of the Link (never
 * descendants) — this prevents <button> nested inside <a> (WCAG 4.1.2).
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

  return (
    <article
      key={item.name}
      data-testid="selectable-project-row"
      data-selected={String(isSelected)}
      style={rowStyle}
      aria-label={`Proyecto: ${item.name}`}
    >
      {/* Navigation Link — wraps ONLY the row's visual chrome (icon + title + stage).
          CopyButton (in RecoveryHint) is a sibling, never a descendant, so no
          <button> is nested inside <a> (invalid interactive-content; WCAG 4.1.2). */}
      <Link
        href={`?project=${encodeURIComponent(item.name)}`}
        style={LINK_STYLE}
        aria-label={`Seleccionar proyecto: ${item.name}`}
        aria-current={isSelected ? "page" : undefined}
      >
        {/* Title row: [status icon] [name] — matches prototype rail item layout */}
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
        </div>

        {/* Stage line — second line below icon+title, indented (prototype stage label) */}
        {item.stage !== undefined && (
          <div data-testid="selectable-row-stage" style={STAGE_LINE_STYLE}>
            {PHASE_LABELS[item.stage] ?? item.stage}
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

      {/* StatusChips — sibling of the Link (not nested inside it).
          Renders pending-decisions / bugs / rethink count badges. */}
      <StatusChips
        pendingDecisions={pendingDecisions}
        pendingBugs={pendingBugs}
        rethinkPending={rethinkPending}
      />

      {/* BusinessSnapshot — sibling of Link; renders for shipped/operation rows
          (CMP-03-snapshot, AC-03-003.1). */}
      {item.snapshot !== undefined && (
        <BusinessSnapshot
          users={item.snapshot.users}
          returnMetric={item.snapshot.returnMetric}
          verdict={item.snapshot.verdict}
        />
      )}

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
 * ProjectRail — vertical rail listing active projects from activeProjects().
 * Server Component safe — no hooks, no browser APIs.
 *
 * When `selectedSlug` is provided, activates selectable mode:
 *   - Each row is a Link to ?project=<name>
 *   - Selected row highlighted (accent-bg fill + accent border)
 *   - Testids switch to selectable-* for page-level integration compatibility
 *   - StatusChips / BusinessSnapshot / RecoveryHint rendered per row
 *
 * Traceability:
 *   CMP-03-rail → REQ-03-001, REQ-03-002, REQ-03-003, REQ-03-004, REQ-03-005, REQ-03-006
 *   IF-03-activeProjects (docs/api.md WO-03-001)
 *   DR-057 (reuse-before-create): ONE rail, not two
 */
export function ProjectRail({
  items,
  isLoading = false,
  error,
  selectedSlug,
}: ProjectRailProps): React.JSX.Element {
  // Selectable mode: render the URL-driven selectable variant.
  if (selectedSlug !== undefined) {
    if (items.length === 0) {
      return (
        <nav
          data-testid="selectable-project-rail"
          style={RAIL_STYLE}
          aria-label="Proyectos activos"
        >
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

  // Non-selectable mode (original behavior).

  // Loading state takes priority
  if (isLoading) {
    return (
      <nav data-testid="project-rail" style={RAIL_STYLE} aria-label="Proyectos activos">
        <LoadingState />
      </nav>
    );
  }

  // Error state
  if (error !== undefined) {
    return (
      <nav data-testid="project-rail" style={RAIL_STYLE} aria-label="Proyectos activos">
        <ErrorState message={error} />
      </nav>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <nav data-testid="project-rail" style={RAIL_STYLE} aria-label="Proyectos activos">
        <EmptyState />
      </nav>
    );
  }

  return (
    <nav data-testid="project-rail" style={RAIL_STYLE} aria-label="Proyectos activos">
      {items.map((item) => (
        <ProjectRow key={item.name} item={item} />
      ))}
    </nav>
  );
}
