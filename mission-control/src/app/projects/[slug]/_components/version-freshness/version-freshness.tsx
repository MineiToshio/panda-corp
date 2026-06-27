/**
 * WO-20-002 — VersionFreshness (CMP-20-badge)
 *
 * Resumen badge that tells the owner whether this project's Pandacorp overlay is at
 * the factory's current version or behind it. Consumer of the ONE shared Banner
 * primitive (DR-057) — NOT a new banner:
 *   - "behind"     → tone="warn", with the copyable `/pandacorp:upgrade` command row.
 *   - "up-to-date" → tone="ok", a quiet "al día" confirmation.
 *   - "unknown"    → renders nothing (no false alarm — same policy as FRD-15).
 *
 * The verdict is computed server-side (getOverlayFreshness) and passed in; this
 * component is purely presentational. The app never runs the command — it only
 * shows it so the owner can copy and run it in the project's folder (read-only).
 *
 * Traceability:
 *   CMP-20-badge   → AC-20-001.1, AC-20-001.2, AC-20-002.1, AC-20-002.2
 *   IF-20-freshness → lib/overlay-freshness.ts :: OverlayFreshnessState
 *   Banner         → src/components/core/Banner/Banner.tsx (DR-057)
 */

import { Banner } from "@/components/core/Banner/Banner";
import type { OverlayFreshnessState } from "@/lib/overlay-freshness/overlay-freshness";

export interface VersionFreshnessProps {
  /** The computed overlay-freshness verdict (getOverlayFreshness). */
  state: OverlayFreshnessState;
}

/** Heading shown when the project's overlay is behind the factory. */
const BEHIND_HEADING = "Versión desfasada de Pandacorp";

/** Recall line under the behind banner — how to apply the upgrade. */
const BEHIND_RECALL =
  "Corre el comando en la carpeta del proyecto para actualizar el motor de Pandacorp.";

/** Heading shown when the project's overlay matches the factory's latest. */
const UP_TO_DATE_HEADING = "Última versión de Pandacorp";

/**
 * VersionFreshness — CMP-20-badge.
 *
 * Renders through the shared Banner. Returns null on the "unknown" verdict so a
 * project whose version can't be determined shows nothing (REQ-20-001).
 */
export function VersionFreshness({ state }: VersionFreshnessProps): React.JSX.Element | null {
  if (state.reason === "unknown") {
    return null;
  }

  if (state.reason === "behind") {
    return (
      <section
        data-testid="version-freshness"
        data-reason="behind"
        aria-label="Versión de Pandacorp desfasada"
      >
        <Banner
          tone="warn"
          kind="drift"
          icon="ti-alert-triangle"
          heading={BEHIND_HEADING}
          detail={state.detail}
          commandRow={state.upgradeCommand}
        >
          <p
            data-testid="version-freshness-recall"
            style={{
              fontSize: "0.6875rem",
              opacity: 0.8,
              margin: "calc(var(--space-base, 1rem) * 0.375) 0 0",
            }}
          >
            {BEHIND_RECALL}
          </p>
        </Banner>
      </section>
    );
  }

  // up-to-date — quiet confirmation (the "Última versión verificada · segura para probar" vibe).
  return (
    <section
      data-testid="version-freshness"
      data-reason="up-to-date"
      aria-label="Versión de Pandacorp al día"
    >
      <Banner
        tone="ok"
        kind="inline"
        icon="ti-rosette-discount-check"
        heading={UP_TO_DATE_HEADING}
        detail={state.detail}
      />
    </section>
  );
}
