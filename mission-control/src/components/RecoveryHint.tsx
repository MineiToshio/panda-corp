/**
 * RecoveryHint — Path-not-found badge + copyable recovery command (CMP-03-recovery).
 *
 * Rendered on a project row whose `exists === false`. Shows the ⚠️ path not found badge
 * and either:
 *   - a copyable `git clone <repo> <path> && /pandacorp:sync-portfolio` command (repo present)
 *   - a no-remote warning with /pandacorp:spec suggestion (no repo)
 *
 * When `exists === true`, renders nothing (badge cleared automatically on next read — no
 * stored state, AC-03-006.6).
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all values via CSS custom properties.
 *   - Spanish user-facing copy.
 *   - Server Component safe — no hooks, no browser APIs.
 *   - data-testid="recovery-hint" on root; "recovery-hint-badge", "recovery-hint-command",
 *     "recovery-hint-no-repo" on sub-elements.
 *
 * Traceability:
 *   CMP-03-recovery → AC-03-006.2, AC-03-006.3, AC-03-006.4, AC-03-006.5, AC-03-006.6
 *   REQ-03-006
 *   Reuses CMP-02-copy-button (components/CopyButton.tsx).
 */

import { CopyButton } from "@/components/CopyButton";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RecoveryHintProps {
  /** Whether the project path currently exists on disk. When true, renders nothing. */
  exists: boolean;
  /** The project's local path (used in the clone command). */
  path: string;
  /** Optional repo URL from the portfolio. Present → show clone command; absent → warning. */
  repo?: string;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded hex/rgb/hsl values.
// ---------------------------------------------------------------------------

const BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.125rem 0.375rem",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  fontSize: "0.6875rem",
  fontWeight: 700,
  background: "var(--color-error, currentColor)",
  color: "var(--color-on-error, Canvas)",
  border: "none",
};

const HINT_BOX_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.375)",
  padding: "calc(var(--space-base, 1rem) * 0.5)",
  background: "var(--color-surface, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.75)",
  fontSize: "0.75rem",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  color: "var(--color-text, currentColor)",
  opacity: 0.65,
  margin: 0,
};

const COMMAND_ROW_STYLE: React.CSSProperties = {
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
  color: "var(--color-error, currentColor)",
  margin: 0,
  lineHeight: 1.5,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * RecoveryHint — path-not-found badge + recovery command.
 *
 * Renders nothing when `exists === true` (AC-03-006.6: badge clears once the path
 * reappears — no state stored, re-derived on next read).
 *
 * Read-only (AC-03-006.5): the recovery is copyable text only. MC never clones,
 * never writes the portfolio, never calls Claude.
 */
export function RecoveryHint({ exists, path, repo }: RecoveryHintProps): React.JSX.Element | null {
  // Badge clears automatically when path exists again (AC-03-006.6).
  if (exists) return null;

  // Treat empty string repo as absent (same as undefined).
  const hasRepo = repo !== undefined && repo.trim() !== "";
  const cloneCommand = hasRepo ? `git clone ${repo} ${path} && /pandacorp:sync-portfolio` : null;

  return (
    <div data-testid="recovery-hint" style={HINT_BOX_STYLE}>
      {/* ⚠️ path not found badge (AC-03-006.2) */}
      <span
        data-testid="recovery-hint-badge"
        style={BADGE_STYLE}
        role="status"
        aria-label="Ruta no encontrada en disco"
      >
        ⚠ ruta no encontrada
      </span>

      {hasRepo && cloneCommand !== null ? (
        /* repo present → copyable git clone + sync command (AC-03-006.3) */
        <>
          <p style={LABEL_STYLE}>Recuperación (solo lectura):</p>
          <div style={COMMAND_ROW_STYLE}>
            <code data-testid="recovery-hint-command" style={CODE_STYLE}>
              {cloneCommand}
            </code>
            <CopyButton value={cloneCommand} label="Copiar" />
          </div>
        </>
      ) : (
        /* no repo → no-remote warning (AC-03-006.4) */
        <p data-testid="recovery-hint-no-repo" style={WARNING_STYLE}>
          Sin repositorio registrado — revisa un respaldo local o recrea con{" "}
          <code style={{ fontFamily: "monospace" }}>/pandacorp:spec</code>.
        </p>
      )}
    </div>
  );
}
