/**
 * WO-04-004 — WorkspaceHeader (CMP-04-header)
 *
 * Server Component: renders the project workspace header.
 *   - title (AC-04-002.1)
 *   - stage label in Spanish (AC-04-002.1)
 *   - version string (AC-04-002.1)
 *   - optional progress line; omitted when absent or empty (AC-04-002.1)
 *   - visible regardless of the active tab (AC-04-002.3) — structural invariant
 *     enforced by page.tsx, not this component
 *
 * Design rules (AGENTS.md / FRD-13):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every significant element.
 *   - Spanish stage labels (UI copy in Spanish per architecture §7).
 *   - No "use client" — Server Component.
 *
 * Traceability:
 *   CMP-04-header → REQ-04-002
 *   AC-04-002.1, AC-04-002.3
 */

import type { Phase } from "@/lib/status/status";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceHeaderProps {
  /** Project title. */
  title: string;
  /** Current phase from status.yaml. */
  stage: Phase;
  /** Version string, e.g. "1.2.0". */
  version: string;
  /** Optional progress string from status.yaml; omitted when absent/empty. */
  progress?: string;
}

// ---------------------------------------------------------------------------
// Spanish stage labels (i18n per architecture §7 — UI copy in Spanish)
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<Phase, string> = {
  product: "Producto",
  design: "Diseño",
  architecture: "Arquitectura",
  implementation: "Implementación",
  release: "Lanzamiento",
  operation: "Operación",
};

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

const HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  padding: "calc(var(--spacing, 0.25rem) * 4) calc(var(--spacing, 0.25rem) * 6)",
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
};

const TITLE_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  flexWrap: "wrap",
};

const TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "1.125rem",
  fontWeight: 700,
  lineHeight: 1.3,
  color: "var(--color-text, currentColor)",
};

const META_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

const STAGE_BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  background: "var(--color-accent-bg, oklch(0.35 0.05 250 / 0.15))",
  color: "var(--color-accent, oklch(0.65 0.18 250))",
  border: "var(--hairline, 1px) solid var(--color-accent, oklch(0.65 0.18 250))",
};

const VERSION_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.7,
  fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
};

const SEPARATOR_STYLE: React.CSSProperties = {
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.35,
  fontSize: "0.75rem",
};

const PROGRESS_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.75,
  margin: 0,
};

// ---------------------------------------------------------------------------
// WorkspaceHeader component
// ---------------------------------------------------------------------------

/**
 * CMP-04-header — project workspace header.
 *
 * Server Component (no "use client"). Renders above the tab bar on every tab
 * (AC-04-002.3 is a structural invariant of the page layout, not this component).
 */
export function WorkspaceHeader({
  title,
  stage,
  version,
  progress,
}: WorkspaceHeaderProps): React.JSX.Element {
  const stageLabel = STAGE_LABELS[stage];
  const hasProgress = progress !== undefined && progress.trim().length > 0;

  return (
    <header data-testid="workspace-header" style={HEADER_STYLE}>
      {/* Title row: title + stage badge + version */}
      <div style={TITLE_ROW_STYLE}>
        <h1 data-testid="workspace-header-title" style={TITLE_STYLE}>
          {title}
        </h1>
        <div style={META_ROW_STYLE}>
          <span data-testid="workspace-header-stage" style={STAGE_BADGE_STYLE}>
            {stageLabel}
          </span>
          <span aria-hidden="true" style={SEPARATOR_STYLE}>
            ·
          </span>
          <span data-testid="workspace-header-version" style={VERSION_STYLE}>
            v{version}
          </span>
        </div>
      </div>

      {/* Optional progress line (AC-04-002.1 — omitted when absent/empty) */}
      {hasProgress && (
        <p data-testid="workspace-header-progress" style={PROGRESS_STYLE}>
          {progress}
        </p>
      )}
    </header>
  );
}
