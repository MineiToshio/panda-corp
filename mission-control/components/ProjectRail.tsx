/**
 * ProjectRail — Vertical rail of active projects (CMP-03-rail).
 *
 * Consumes IF-03-activeProjects contract (lib/portfolio.ts → activeProjects()).
 * Displays ProjectListItem[] as a vertical list with:
 *   - Project name, stage chip, building/stopped indicator (REQ-03-002)
 *   - Business snapshot chips for operation/shipped projects (REQ-03-003)
 *   - Path-not-found badge + copyable recovery command (REQ-03-006)
 *   - Graceful empty, loading and error states (architecture §7)
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - tabular-nums on business metrics (AC-13-003).
 *   - data-testid on every interactive/significant element (test-writer contract).
 *   - Spanish aria-labels and user-facing copy.
 *   - Server Component safe — no hooks, no browser APIs.
 *
 * Traceability:
 *   CMP-03-rail, CMP-03-row, CMP-03-snapshot, CMP-03-empty, CMP-03-recovery
 *   IF-03-activeProjects (docs/api.md WO-03-001)
 *   REQ-03-001, REQ-03-002, REQ-03-003, REQ-03-006
 */

import { CopyButton } from "@/components/CopyButton";
import type { ProjectListItem } from "@/lib/portfolio";

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
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded hex/rgb/hsl values.
// Fallbacks use system semantic values so the component renders before
// design tokens are frozen (WO-13-002, globals.css).
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sub-components
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
 * Read-only: the recovery is a copyable command; MC never clones or writes.
 */
function RecoveryHint({
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
 * Renders users / returnMetric / verdict chips when present; silently omits absent fields.
 */
function BusinessSnapshot({
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
            {stage}
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
        <BusinessSnapshot
          users={snapshot.users}
          returnMetric={snapshot.returnMetric}
          verdict={snapshot.verdict}
        />
      )}

      {/* Recovery hint — only when path not found (REQ-03-006) */}
      {!exists && <RecoveryHint repo={repo} path={path} />}
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
 * Traceability:
 *   CMP-03-rail → REQ-03-001, REQ-03-002, REQ-03-003, REQ-03-006
 *   IF-03-activeProjects (docs/api.md WO-03-001)
 */
export function ProjectRail({
  items,
  isLoading = false,
  error,
}: ProjectRailProps): React.JSX.Element {
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
