/**
 * RecoveryHint — Path-not-found signal + copyable recovery command (CMP-03-recovery).
 *
 * Refactored (WO-03-002, DR-057) to delegate visual structure to the shared
 * Banner primitive (CMP-13-banner) and CmdRow (CMP-13-cmdrow) — no bespoke
 * banner box style. The visual shell is Banner (tone="danger", role="alert");
 * the recovery command uses CmdRow (the THE command-chip primitive).
 *
 * Rendered on a project row whose `exists === false`. Shows the ⚠️ path not
 * found signal and either:
 *   - a copyable `git clone <repo> <path> && /pandacorp:sync-portfolio` via CmdRow
 *   - a no-remote warning with /pandacorp:spec suggestion (no repo)
 *
 * When `exists === true`, renders nothing (badge cleared automatically on next
 * read — no stored state, AC-03-006.6).
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — Banner + CmdRow own all color tokens.
 *   - Spanish user-facing copy.
 *   - Server Component safe — no hooks, no browser APIs.
 *   - data-testid="recovery-hint" on root wrapper.
 *
 * Traceability:
 *   CMP-03-recovery → AC-03-006.2, AC-03-006.3, AC-03-006.4, AC-03-006.5, AC-03-006.6
 *   REQ-03-006
 *   Reuses CMP-13-banner (Banner) + CMP-13-cmdrow (CmdRow) — DR-057.
 */

import { Banner } from "@/components/core/Banner/Banner";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";

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
// Styles — root wrapper only; visual chrome delegated to Banner.
// ---------------------------------------------------------------------------

/** Root wrapper — no visual chrome (Banner owns it). */
const HINT_WRAPPER_STYLE: React.CSSProperties = {
  marginTop: "calc(var(--space-base, 1rem) * 0.375)",
};

/** No-repo warning text (inside Banner children). */
const NO_REPO_STYLE: React.CSSProperties = {
  margin: "calc(var(--space-base, 1rem) * 0.25) 0 0",
  fontSize: "0.75rem",
  color: "var(--color-text, currentColor)",
  lineHeight: 1.5,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * RecoveryHint — path-not-found Banner + recovery CmdRow.
 *
 * Uses the shared Banner (CMP-13-banner, tone="danger") for the visual shell
 * and CmdRow (CMP-13-cmdrow) for the copyable recovery command.
 * DR-057: no bespoke banner box — one Banner in the app.
 *
 * Renders nothing when `exists === true` (AC-03-006.6: badge clears once the
 * path reappears — no state stored, re-derived on next read).
 *
 * Read-only (AC-03-006.5): recovery is copyable text only. MC never clones,
 * never writes the portfolio, never calls Claude.
 */
export function RecoveryHint({ exists, path, repo }: RecoveryHintProps): React.JSX.Element | null {
  // Badge clears automatically when path exists again (AC-03-006.6).
  if (exists) return null;

  // Treat empty string repo as absent (same as undefined).
  const hasRepo = repo !== undefined && repo.trim() !== "";
  const cloneCommand = hasRepo ? `git clone ${repo} ${path} && /pandacorp:sync-portfolio` : null;

  return (
    <div data-testid="recovery-hint" style={HINT_WRAPPER_STYLE}>
      {hasRepo && cloneCommand !== null ? (
        /*
         * repo present → Banner (danger) + CmdRow for the clone+sync command.
         * AC-03-006.2: ⚠ ruta no encontrada signal via Banner heading (role="alert").
         * AC-03-006.3: copyable git clone + sync command via CmdRow.
         */
        <Banner
          tone="danger"
          kind="error"
          heading="⚠ ruta no encontrada"
          detail="Recuperación (solo lectura):"
        >
          <CmdRow command={cloneCommand} />
        </Banner>
      ) : (
        /*
         * no repo → Banner (danger) with no-remote warning in children.
         * AC-03-006.4: warning shown when no remote registered.
         */
        <Banner tone="danger" kind="error" heading="⚠ ruta no encontrada">
          <p data-testid="recovery-hint-no-repo" style={NO_REPO_STYLE}>
            Sin repositorio registrado — revisa un respaldo local o recrea con{" "}
            <code style={{ fontFamily: "monospace" }}>/pandacorp:spec</code>.
          </p>
        </Banner>
      )}
    </div>
  );
}
