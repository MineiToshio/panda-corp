/**
 * RecoveryHint — Path-not-found badge + copyable recovery command (CMP-03-recovery).
 *
 * Rendered on a project row whose `exists === false`. Reuses the shared `Banner`
 * component (DR-057: one Banner for all app banners; no duplicate markup).
 * Shows either:
 *   - a copyable `git clone <repo> <path> && /pandacorp:sync-portfolio` command (repo present)
 *   - a no-remote warning with /pandacorp:spec suggestion (no repo)
 *
 * When `exists === true`, renders nothing (badge cleared automatically on next read — no
 * stored state, AC-03-006.6).
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - Reuses shared `Banner` (DR-057) — NOT a second banner component.
 *   - ZERO hardcoded colors — all values via CSS custom properties (Banner handles this).
 *   - Spanish user-facing copy.
 *   - Server Component safe — no hooks, no browser APIs.
 *   - data-testid="recovery-hint" on root wrapper.
 *
 * Traceability:
 *   CMP-03-recovery → AC-03-006.2, AC-03-006.3, AC-03-006.4, AC-03-006.5, AC-03-006.6
 *   REQ-03-006
 *   DR-057 (reuse shared Banner — no second banner/alert is a defect)
 */

import { Banner } from "@/components/core/Banner/Banner";

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
// Component
// ---------------------------------------------------------------------------

/**
 * RecoveryHint — path-not-found badge + recovery command, via the shared Banner.
 *
 * Renders nothing when `exists === true` (AC-03-006.6: badge clears once the path
 * reappears — no state stored, re-derived on next read).
 *
 * Read-only (AC-03-006.5): the recovery is copyable text only. MC never clones,
 * never writes the portfolio, never calls Claude.
 *
 * DR-057: reuses the ONE shared `Banner` — a second banner/alert is a defect.
 */
export function RecoveryHint({ exists, path, repo }: RecoveryHintProps): React.JSX.Element | null {
  // Badge clears automatically when path exists again (AC-03-006.6).
  if (exists) return null;

  // Treat empty string repo as absent (same as undefined).
  const hasRepo = repo !== undefined && repo.trim() !== "";
  const cloneCommand = hasRepo
    ? `git clone ${repo} ${path} && /pandacorp:sync-portfolio`
    : undefined;

  if (hasRepo && cloneCommand !== undefined) {
    // repo present → Banner with copyable git clone + sync command (AC-03-006.3)
    return (
      <div data-testid="recovery-hint">
        <Banner
          tone="danger"
          kind="error"
          heading="⚠ ruta no encontrada"
          detail={`No encuentro la carpeta esperada: ${path}`}
          commandRow={cloneCommand}
        />
      </div>
    );
  }

  // no repo → Banner with no-remote warning (AC-03-006.4)
  return (
    <div data-testid="recovery-hint">
      <Banner
        tone="warn"
        kind="inline"
        heading="⚠ ruta no encontrada"
        detail={`Sin repositorio registrado — revisa un respaldo local o recrea con /pandacorp:spec.`}
      />
    </div>
  );
}
