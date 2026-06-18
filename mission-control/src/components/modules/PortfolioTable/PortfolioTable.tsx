/**
 * PortfolioTable — Presentational portfolio entry list (CMP-03-rail / CMP-03-row).
 *
 * Consumes the IF-01-readPortfolio contract (lib/portfolio.ts, docs/api.md WO-01-004).
 * Displays the parsed portfolio entries as a vertical list with:
 *   - Project name and path
 *   - Phase chip
 *   - Repo link (or placeholder)
 *   - Business snapshot chips (users / returnMetric / verdict) when present
 *   - Path-not-found badge + recovery hint when pathExists() reports missing
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all visual values via CSS custom properties
 *     (wired in globals.css when design-tokens.json is frozen by the design phase).
 *   - tabular-nums on every number (FRD-13, AC-13-003).
 *   - data-testid on every interactive/significant element (test-writer contract).
 *   - Spanish aria-labels and copy (single operator, Spanish UI).
 *   - Server Component safe — no hooks, no browser APIs.
 *   - Empty / loading / error states all handled explicitly.
 *
 * Traceability:
 *   CMP-03-rail, CMP-03-row, CMP-03-snapshot, CMP-03-empty, CMP-03-recovery
 *   IF-01-readPortfolio (docs/api.md WO-01-004)
 *   REQ-03-001, REQ-03-002, REQ-03-003, REQ-03-006
 */

import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import type { PortfolioEntry } from "@/lib/portfolio/portfolio";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PortfolioTableEntry extends PortfolioEntry {
  /** Whether the project path exists on disk (from pathExists()). */
  exists: boolean;
  /** Whether the project is actively building (running: true in status.yaml). */
  isRunning?: boolean;
}

export interface PortfolioTableProps {
  /** Entries enriched with existence + running status. */
  entries: PortfolioTableEntry[];
  /** When true, render the loading skeleton instead of rows. */
  isLoading?: boolean;
  /** When set, render the error state with this message. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; no hardcoded color values.
// Fallbacks use system semantic values so the component renders before
// design tokens are frozen (WO-13-002, globals.css).
// ---------------------------------------------------------------------------

const RAIL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  minWidth: 0,
};

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  padding: "calc(var(--spacing, 0.25rem) * 3) calc(var(--spacing, 0.25rem) * 4)",
  background: "var(--color-surface-panel, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  boxShadow: "var(--shadow-panel, none)",
  minWidth: 0,
};

const ROW_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
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
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  opacity: 0.65,
  wordBreak: "break-all",
  margin: 0,
};

const CHIPS_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  alignItems: "center",
};

const CHIP_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.125rem 0.375rem",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  fontSize: "0.75rem",
  fontWeight: 500,
  background:
    "var(--color-chip-bg, var(--color-surface, color-mix(in oklch, currentColor 10%, transparent)))",
  color: "var(--color-chip-text, currentColor)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const CHIP_RUNNING_STYLE: React.CSSProperties = {
  ...CHIP_STYLE,
  background: "var(--color-agent-frontend-dev, var(--color-accent, currentColor))",
  color: "var(--color-on-accent, Canvas)",
  border: "none",
  fontWeight: 600,
};

const CHIP_STOPPED_STYLE: React.CSSProperties = {
  ...CHIP_STYLE,
  opacity: 0.55,
};

const BADGE_NOT_FOUND_STYLE: React.CSSProperties = {
  ...CHIP_STYLE,
  background: "var(--color-error, var(--color-accent, currentColor))",
  color: "var(--color-on-error, var(--color-on-accent, Canvas))",
  border: "none",
  fontWeight: 700,
};

const SNAPSHOT_ROW_STYLE: React.CSSProperties = {
  ...CHIPS_ROW_STYLE,
  fontVariantNumeric: "tabular-nums",
};

const RECOVERY_BOX_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  padding: "calc(var(--spacing, 0.25rem) * 3)",
  background: "var(--color-surface-code, color-mix(in oklch, currentColor 5%, transparent))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.75)",
  fontSize: "0.75rem",
};

const RECOVERY_LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "var(--color-text-muted, currentColor)",
  margin: 0,
};

const RECOVERY_COMMAND_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  flexWrap: "wrap",
};

const CODE_STYLE: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "var(--color-accent, var(--color-text, currentColor))",
  flex: 1,
  wordBreak: "break-all",
  minWidth: 0,
};

const WARNING_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--color-error, currentColor)",
  margin: 0,
  lineHeight: 1.5,
};

const STATE_BOX_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  padding: "calc(var(--spacing, 0.25rem) * 8)",
  textAlign: "center",
  color: "var(--color-text-muted, currentColor)",
};

const ERROR_BOX_STYLE: React.CSSProperties = {
  ...STATE_BOX_STYLE,
  color: "var(--color-error, currentColor)",
  border: "var(--hairline, 1px) solid var(--color-error, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  opacity: 0.8,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState(): React.JSX.Element {
  return (
    <div data-testid="portfolio-empty-state" style={STATE_BOX_STYLE} aria-live="polite">
      <p style={{ margin: 0, fontSize: "0.875rem" }}>Sin proyectos activos.</p>
      <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.6 }}>
        Usa <code style={{ fontFamily: "monospace" }}>/pandacorp:spec</code> para crear uno.
      </p>
    </div>
  );
}

function LoadingState(): React.JSX.Element {
  return (
    <div data-testid="portfolio-loading-state" style={STATE_BOX_STYLE} aria-live="polite" aria-busy>
      <p style={{ margin: 0, fontSize: "0.875rem" }}>Cargando proyectos…</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }): React.JSX.Element {
  return (
    <div
      data-testid="portfolio-error-state"
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
 * Read-only: the recovery is a copyable command, MC never clones or writes.
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
      <div data-testid="portfolio-recovery-hint" style={RECOVERY_BOX_STYLE}>
        <p style={RECOVERY_LABEL_STYLE}>Recuperación (solo lectura):</p>
        <div style={RECOVERY_COMMAND_ROW_STYLE}>
          <code data-testid="portfolio-recovery-command" style={CODE_STYLE}>
            {cloneCommand}
          </code>
          <CopyButton value={cloneCommand} label="Copiar" />
        </div>
      </div>
    );
  }

  return (
    <div data-testid="portfolio-recovery-hint" style={RECOVERY_BOX_STYLE}>
      <p data-testid="portfolio-recovery-no-repo" style={WARNING_STYLE}>
        Sin repositorio registrado — revisa un respaldo local o recrea con{" "}
        <code style={{ fontFamily: "monospace" }}>/pandacorp:spec</code>.
      </p>
    </div>
  );
}

/**
 * Business snapshot chips for shipped projects (REQ-03-003 / CMP-03-snapshot).
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
    <div data-testid="portfolio-snapshot" style={SNAPSHOT_ROW_STYLE}>
      {users !== undefined && (
        <span
          data-testid="portfolio-snapshot-users"
          style={CHIP_STYLE}
          title={`Usuarios: ${users}`}
        >
          {users} usuarios
        </span>
      )}
      {returnMetric !== undefined && (
        <span
          data-testid="portfolio-snapshot-return"
          style={CHIP_STYLE}
          title={`Retorno: ${returnMetric}`}
        >
          {returnMetric}
        </span>
      )}
      {verdict !== undefined && (
        <span
          data-testid="portfolio-snapshot-verdict"
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
 * Single project row (CMP-03-row): name, phase, running indicator, snapshot, not-found badge.
 */
function ProjectRow({ entry }: { entry: PortfolioTableEntry }): React.JSX.Element {
  const { name, path, repo, phase, users, returnMetric, verdict, exists, isRunning } = entry;
  const isShipped = phase === "operation" || phase === "shipped";

  return (
    <article data-testid="portfolio-row" style={ROW_STYLE} aria-label={`Proyecto: ${name}`}>
      {/* Header: name + phase + indicators */}
      <div style={ROW_HEADER_STYLE}>
        <h3 data-testid="portfolio-row-name" style={PROJECT_NAME_STYLE}>
          {name}
        </h3>

        {/* Path-not-found badge (REQ-03-006) */}
        {!exists && (
          <span
            data-testid="portfolio-row-not-found-badge"
            style={BADGE_NOT_FOUND_STYLE}
            role="status"
            aria-label="Ruta no encontrada en disco"
          >
            ⚠ ruta no encontrada
          </span>
        )}

        {/* Phase chip */}
        {phase !== undefined && (
          <span data-testid="portfolio-row-phase" style={CHIP_STYLE} title={`Fase: ${phase}`}>
            {phase}
          </span>
        )}

        {/* Running indicator (REQ-03-002): building / stopped */}
        {exists && (
          <span
            data-testid="portfolio-row-indicator"
            style={isRunning === true ? CHIP_RUNNING_STYLE : CHIP_STOPPED_STYLE}
            role="status"
            aria-label={isRunning === true ? "Construcción activa" : "Parado"}
          >
            {isRunning === true ? "Construyendo" : "Parado"}
          </span>
        )}
      </div>

      {/* Path */}
      <p data-testid="portfolio-row-path" style={PATH_STYLE}>
        {path}
      </p>

      {/* Business snapshot — shipped only (REQ-03-003) */}
      {isShipped && (
        <BusinessSnapshot users={users} returnMetric={returnMetric} verdict={verdict} />
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
 * Presentational portfolio rail.
 * Accepts pre-resolved entries (readPortfolio + pathExists + readStatus enrichment)
 * from the Server Component. Server Component safe — no hooks, no browser APIs.
 *
 * Traceability:
 *   CMP-03-rail → REQ-03-001, REQ-03-002, REQ-03-003, REQ-03-006
 */
export function PortfolioTable({
  entries,
  isLoading = false,
  error,
}: PortfolioTableProps): React.JSX.Element {
  // Loading state takes priority
  if (isLoading) {
    return (
      <section
        data-testid="portfolio-table"
        style={RAIL_STYLE}
        aria-label="Portafolio de proyectos"
      >
        <LoadingState />
      </section>
    );
  }

  // Error state
  if (error !== undefined) {
    return (
      <section
        data-testid="portfolio-table"
        style={RAIL_STYLE}
        aria-label="Portafolio de proyectos"
      >
        <ErrorState message={error} />
      </section>
    );
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <section
        data-testid="portfolio-table"
        style={RAIL_STYLE}
        aria-label="Portafolio de proyectos"
      >
        <EmptyState />
      </section>
    );
  }

  return (
    <section data-testid="portfolio-table" style={RAIL_STYLE} aria-label="Portafolio de proyectos">
      {entries.map((entry) => (
        <ProjectRow key={entry.name} entry={entry} />
      ))}
    </section>
  );
}
