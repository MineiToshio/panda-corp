/**
 * WO-14-002 — SnapshotPanel (CMP-14-snapshot-panel)
 *
 * Server Component: renders the FRD-14 snapshot panel inside the FRD-04
 * workspace. Shows the last probable point (last green SHA + worktree command),
 * a "building now" notice when a work order is in progress, and a staleness
 * warning when the snapshot is far behind HEAD.
 *
 * Design rules:
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on every significant element.
 *   - Spanish UI copy per architecture §7.
 *   - Server Component (no "use client") — CopyButton is its own "use client".
 *   - Green badge and staleness warning use icon + text (not color alone).
 *   - tabular-nums on the SHA for numeric alignment.
 *
 * Traceability:
 *   CMP-14-snapshot-panel → REQ-14-001, REQ-14-002, REQ-14-003
 *   AC-14-001.1 — probable point label + green badge + sha
 *   AC-14-001.2 — worktree command + copy button
 *   AC-14-001.3 — absent snapshot → panel omitted entirely
 *   AC-14-002.1 — building now block (visually distinct from probable point)
 *   AC-14-003.1 — staleness warning (icon + text)
 *   IF-14-snapshot (lib/snapshot.ts, WO-14-001)
 */

import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import type { SnapshotInfo } from "@/lib/snapshot/snapshot";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SnapshotPanelProps {
  /**
   * The project slug — used to distinguish this panel in the layout;
   * the worktree command itself is already pre-built in snapshot.worktreeCommand.
   */
  slug: string;
  /**
   * Pre-built snapshot info from buildSnapshot() (WO-14-001).
   * null when last_green_sha is absent → panel is omitted entirely (AC-14-001.3).
   */
  snapshot: SnapshotInfo | null;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

const PANEL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  padding: "calc(var(--spacing, 0.25rem) * 5) calc(var(--spacing, 0.25rem) * 6)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  background: "var(--color-surface-panel, var(--color-surface, Canvas))",
  color: "var(--color-text, currentColor)",
  boxShadow: "var(--shadow-panel, none)",
};

const SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.65,
  margin: 0,
};

const PROBABLE_POINT_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  flexWrap: "wrap",
};

const GREEN_BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  background: "var(--color-success-bg, oklch(0.3 0.08 150 / 0.15))",
  color: "var(--color-success, oklch(0.65 0.18 150))",
  border: "var(--hairline, 1px) solid var(--color-success, oklch(0.65 0.18 150))",
};

const SHA_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace)",
  fontSize: "0.875rem",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-text, currentColor)",
};

const WORKTREE_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  flexWrap: "wrap",
  padding: "calc(var(--spacing, 0.25rem) * 2) calc(var(--spacing, 0.25rem) * 3)",
  background: "var(--color-code-bg, oklch(0.08 0.01 230 / 0.6))",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const WORKTREE_CMD_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace)",
  fontSize: "0.8125rem",
  color: "var(--color-text, currentColor)",
  flexGrow: 1,
  wordBreak: "break-all",
};

const BUILDING_NOW_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
  padding: "calc(var(--spacing, 0.25rem) * 3) calc(var(--spacing, 0.25rem) * 4)",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  background: "var(--color-accent-bg, oklch(0.35 0.05 250 / 0.12))",
  border: "var(--hairline, 1px) solid var(--color-accent, oklch(0.65 0.18 250))",
  color: "var(--color-text, currentColor)",
};

const BUILDING_NOW_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
  fontWeight: 600,
  fontSize: "0.875rem",
};

const BUILDING_NOW_NOTICE_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.8,
  margin: 0,
};

const STALE_WARNING_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  padding: "calc(var(--spacing, 0.25rem) * 2.5) calc(var(--spacing, 0.25rem) * 3)",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  background: "var(--color-warning-bg, oklch(0.35 0.05 90 / 0.12))",
  border: "var(--hairline, 1px) solid var(--color-warning, oklch(0.72 0.18 80))",
  color: "var(--color-warning-text, var(--color-text-muted, currentColor))",
  fontSize: "0.8125rem",
};

// ---------------------------------------------------------------------------
// SnapshotPanel — CMP-14-snapshot-panel
// ---------------------------------------------------------------------------

/**
 * CMP-14-snapshot-panel — snapshot panel for the FRD-04 workspace.
 *
 * Renders only when snapshot is non-null (AC-14-001.3).
 * Server Component (no "use client"). CopyButton is its own client island.
 */
export function SnapshotPanel({ snapshot }: SnapshotPanelProps): React.JSX.Element | null {
  // AC-14-001.3 — absent snapshot → omit panel entirely
  if (snapshot === null) {
    return null;
  }

  const { sha, worktreeCommand, buildingNow, stale } = snapshot;

  return (
    <section data-testid="snapshot-panel" aria-label="Snapshot del proyecto" style={PANEL_STYLE}>
      {/* Probable point section (AC-14-001.1) */}
      <div data-testid="snapshot-panel-probable-point" style={SECTION_STYLE}>
        <p data-testid="snapshot-panel-label" style={LABEL_STYLE}>
          Último punto probable
        </p>

        <div style={PROBABLE_POINT_ROW_STYLE}>
          {/* Green badge — icon + text, not color alone (a11y requirement) */}
          <span
            data-testid="snapshot-panel-green-badge"
            role="status"
            aria-label="Snapshot verde — seguro para probar"
            style={GREEN_BADGE_STYLE}
          >
            {/* Checkmark icon (unicode) — decorative but additive to the text */}
            <span aria-hidden="true">✓</span>
            <span>Verde</span>
          </span>

          {/* SHA value (tabular-nums for numeric alignment) */}
          <code
            data-testid="snapshot-panel-sha"
            className="tabular-nums"
            style={SHA_STYLE}
            title={sha}
          >
            {sha}
          </code>
        </div>

        {/* Worktree command + copy button (AC-14-001.2) */}
        <div style={WORKTREE_ROW_STYLE}>
          <code data-testid="snapshot-panel-worktree-cmd" style={WORKTREE_CMD_STYLE}>
            {worktreeCommand}
          </code>
          <CopyButton value={worktreeCommand} />
        </div>
      </div>

      {/* Staleness warning (AC-14-003.1) — shown only when stale */}
      {stale && (
        <div
          data-testid="snapshot-panel-stale-warning"
          role="alert"
          aria-live="polite"
          style={STALE_WARNING_STYLE}
        >
          <span data-testid="snapshot-panel-stale-icon" aria-hidden="true">
            ⚠
          </span>
          <span>
            El snapshot está desactualizado — el último punto probable se está quedando atrás de
            HEAD
          </span>
        </div>
      )}

      {/* Building now block (AC-14-002.1) — shown only when running */}
      {buildingNow !== undefined && (
        <div data-testid="snapshot-panel-building-now" style={BUILDING_NOW_STYLE}>
          <div style={BUILDING_NOW_HEADER_STYLE}>
            {/* Pulse icon to indicate active work */}
            <span aria-hidden="true">⚙</span>
            <span>{buildingNow}</span>
          </div>
          <p style={BUILDING_NOW_NOTICE_STYLE}>
            No lo pruebes aún — hay un work order en progreso en este momento.
          </p>
        </div>
      )}
    </section>
  );
}
