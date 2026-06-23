/**
 * WO-04-004 — WorkspaceHeader (CMP-04-header)
 *
 * Server Component: the compact light header for the project workspace.
 * Matches the prototype's compactProjectHeader() — NOT a PageTitle or heavy panel.
 *
 *   - title as H1 at 16px/500 — the project name (AC-04-002.1, DR-062)
 *   - running pip: ti-player-play icon in var(--color-ok) when running
 *   - stage Chip (accent tone, reusing shared Chip primitive, WO-13-007)
 *   - version string at 12px/text2 (AC-04-002.1)
 *   - optional progress line; omitted when absent or empty (AC-04-002.1)
 *   - visible regardless of the active tab (AC-04-002.3) — structural invariant
 *     enforced by page.tsx, not this component
 *
 * Prototype reference: compactProjectHeader() in docs/design/prototype/index.html
 *   .panel { padding: 10px 14px }
 *   title: font-size:16px; font-weight:500
 *   chip2(status): the shared Chip at accent/ok/warn tone
 *   version: font-size:12px; color:var(--text2)
 *   progreso: font-size:12px; color:var(--text2); margin-top:4px
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

import { Chip } from "@/components/core/Chip/Chip";
import type { DeployTarget, Phase } from "@/lib/status/status";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceHeaderProps {
  /** Project title (H1). */
  title: string;
  /** Current phase from status.yaml. */
  stage: Phase;
  /** Deploy target (DR-085) — shown next to the stage chip when launched (release). */
  deployTarget?: DeployTarget;
  /** Version string, e.g. "1.2.0". */
  version: string;
  /** Optional progress string from status.yaml; omitted when absent/empty. */
  progress?: string;
  /** Whether the project build is currently running (shows ti-player-play pip). */
  running?: boolean;
  /**
   * Heading level for the title. 1 (default) on the standalone /projects page where it IS the page
   * heading; 2 when embedded in the Portfolio pane (whose "Portfolio" PageTitle owns the single h1).
   */
  headingLevel?: 1 | 2;
  /**
   * Optional content rendered inside the same rounded panel, below the title row — the objectives
   * bar (prototype compactProjectHeader keeps the progress bar in the SAME panel as the title).
   */
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Spanish stage labels (i18n per architecture §7 — UI copy in Spanish)
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<Phase, string> = {
  product: "Producto",
  design: "Diseño",
  architecture: "Arquitectura",
  implementation: "Implementación",
  release: "Release",
};

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// Matches prototype compactProjectHeader(): a rounded `.panel`
//   .panel { background:var(--primary); border:.5px solid var(--bd);
//            border-radius:var(--rlg /* = --radius-md */); }
//   compactProjectHeader override: padding:10px 14px
// ---------------------------------------------------------------------------

const HEADER_STYLE: React.CSSProperties = {
  padding: "10px 14px",
  border: "0.5px solid var(--color-border, currentColor)",
  borderRadius: "var(--radius-md, 0.75rem)",
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
};

/** Objectives slot — sits inside the same rounded panel, just below the title row. */
const OBJECTIVES_SLOT_STYLE: React.CSSProperties = {
  marginTop: "8px",
};

const TITLE_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
};

/** H1 matches prototype: font-size:16px; font-weight:500 (compact, not bold). */
const TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 500,
  lineHeight: 1.3,
  color: "var(--color-text, currentColor)",
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const VERSION_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text2, currentColor)",
  fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, monospace)",
};

const PROGRESS_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text2, currentColor)",
  margin: "4px 0 0",
};

// ---------------------------------------------------------------------------
// WorkspaceHeader component
// ---------------------------------------------------------------------------

/**
 * CMP-04-header — compact light project workspace header (DR-062).
 *
 * Server Component (no "use client"). Rendered above all tabs on every tab
 * (AC-04-002.3 is a structural invariant of the page layout, not this component).
 *
 * NOT a PageTitle (that is for top-level nav surfaces); this is the workspace's
 * own compactProjectHeader per the prototype and DR-062 — a rounded panel that also
 * hosts the objectives bar (passed as children) in the SAME block, like the prototype.
 */
export function WorkspaceHeader({
  title,
  stage,
  deployTarget,
  version,
  progress,
  running = false,
  headingLevel = 1,
  children,
}: WorkspaceHeaderProps): React.JSX.Element {
  const stageLabel = STAGE_LABELS[stage] ?? stage;
  const hasProgress = progress !== undefined && progress.trim().length > 0;
  const TitleTag = headingLevel === 2 ? "h2" : "h1";

  return (
    <header data-testid="workspace-header" style={HEADER_STYLE}>
      {/* Title row: title + running pip + stage Chip + version */}
      <div style={TITLE_ROW_STYLE}>
        <TitleTag data-testid="workspace-header-title" style={TITLE_STYLE}>
          {title}
          {running && (
            <i
              className="ti ti-player-play"
              style={{ fontSize: "13px", color: "var(--color-ok)" }}
              aria-hidden="true"
              title="construyendo"
            />
          )}
        </TitleTag>

        {/* Stage chip — shared Chip primitive (WO-13-007, DR-057) */}
        <span data-testid="workspace-header-stage">
          <Chip tone="accent">{stageLabel}</Chip>
        </span>

        {/* Deploy target chip — only for launched (release) projects (DR-085) */}
        {stage === "release" && deployTarget !== undefined && (
          <span data-testid="workspace-header-deploy">
            <Chip tone="info">{deployTarget === "internal" ? "interno" : "externo"}</Chip>
          </span>
        )}

        {/* Version string */}
        <span data-testid="workspace-header-version" style={VERSION_STYLE}>
          {version}
        </span>
      </div>

      {/* Optional progress line (AC-04-002.1 — omitted when absent/empty) */}
      {hasProgress && (
        <p data-testid="workspace-header-progress" style={PROGRESS_STYLE}>
          <i
            className="ti ti-hammer"
            style={{ fontSize: "12px", verticalAlign: "-1px", color: "var(--color-accent)" }}
            aria-hidden="true"
          />{" "}
          {progress}
        </p>
      )}

      {/* Objectives bar — inside the SAME rounded panel as the title (prototype). */}
      {children !== undefined && <div style={OBJECTIVES_SLOT_STYLE}>{children}</div>}
    </header>
  );
}
