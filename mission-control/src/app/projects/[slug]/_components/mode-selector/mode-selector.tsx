"use client";

/**
 * WO-11-002 — ModeSelector (CMP-11-mode-selector)
 *
 * Client Component: per-project build mode selector for the Commands tab.
 *
 * The mode picker is the shared CmdRow inline `<select>` (DR-095/AC-02-010.9 control,
 * reused here): one compact `/pandacorp:implement` row whose select carries the build
 * modes (Pro / Potente / Profundo; balanced = the "no flag" default). Picking a mode
 * folds its flag into the copied command AND is remembered per project (IF-11-mode-store).
 * Replaced the prototype's 4-chip radio panel — the owner chose the compact select so the
 * control stays tidy (decision-log 2026-06-27); the modes still come from the canonical
 * BUILD_MODES catalog via the shared command-modes module (DR-092).
 *
 * Reuses shared primitives (DR-057): Panel + CmdRow (no bespoke forks).
 *
 * Traceability:
 *   CMP-11-mode-selector → REQ-11-001, REQ-11-002, REQ-11-003
 *   AC-11-001.x — the build modes, in order, each with its description (select options + hint)
 *   AC-11-002.x — command + copy on selection (via shared CmdRow), active description as the hint
 *   AC-11-003.x — remembered per project, restored on re-mount
 *   DR-057 — Panel + CmdRow reused
 *
 * Integration seam: TabCommands mounts this at data-testid="mode-selector-slot" (AC-04-005.2).
 */

import { useEffect, useState } from "react";

import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Panel } from "@/components/core/Panel/Panel";
import { getRememberedMode, rememberMode } from "@/lib/build-mode-store";
import {
  buildModeFlag,
  buildModeFromFlag,
  IMPLEMENT_BASE_COMMAND,
  IMPLEMENT_DEFAULT_HINT,
  IMPLEMENT_MODE_DEFAULT_LABEL,
  IMPLEMENT_MODE_TITLE,
  IMPLEMENT_MODES,
} from "@/lib/command-modes";
import { type BuildMode, DEFAULT_BUILD_MODE } from "@/lib/constants";
import type { Phase } from "@/lib/status/status";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ModeSelectorProps {
  /** The project slug — used to scope per-project mode memory (IF-11-mode-store). */
  slug: string;
  /**
   * The project phase — when implementation or release, the panel also shows the
   * targeted build variants (implement <frd> and implement change:<slug>).
   */
  phase?: Phase;
}

// ---------------------------------------------------------------------------
// i18n copy (Spanish, DR-009)
// ---------------------------------------------------------------------------

/** Phases where targeted build variants are relevant. */
const BUILD_PHASES: ReadonlySet<string> = new Set(["implementation", "release"]);

const COPY = {
  heading: "Modo de construcción",
  subtitle:
    "Con cuánta potencia construir ESTE proyecto. Por defecto Equilibrado (Max 5x). Elige el modo y copia el comando que toca.",
  variantFrdWhen:
    "Construye solo el FRD indicado (sus deps deben estar VERIFIED; ej: frd-05-settings)",
  variantChangeWhen:
    "Procesa una change de la cola y construye solo los FRDs afectados (ej: change:mc-fix-pagination)",
};

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

const HEADING_STYLE: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  margin: "0 0 4px",
  color: "var(--color-text2)",
  display: "flex",
  alignItems: "center",
  gap: "5px",
};

const SUBTITLE_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text3)",
  margin: "0 0 10px",
};

const VARIANT_ROW_STYLE: React.CSSProperties = {
  marginTop: "8px",
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const VARIANT_DESC_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text2)",
  opacity: 0.8,
  lineHeight: 1.5,
  margin: "2px 0 0",
  paddingLeft: "2px",
};

// ---------------------------------------------------------------------------
// ModeSelector — main export (CMP-11-mode-selector)
// ---------------------------------------------------------------------------

/**
 * Per-project build mode selector. The build mode lives in the shared CmdRow select
 * (controlled here so the choice persists via build-mode-store).
 *
 * "use client" — needs useState + localStorage (persistence) + clipboard (via CmdRow).
 * Root <section> carries data-testid="mode-selector-slot" (AC-04-005.2 seam).
 */
export function ModeSelector({ slug, phase }: ModeSelectorProps): React.JSX.Element {
  const showVariants = phase !== undefined && BUILD_PHASES.has(phase);
  // Start with the default so SSR and first client render match (avoids hydration mismatch).
  // After mount, restore from localStorage (AC-11-003.2).
  const [activeMode, setActiveMode] = useState<BuildMode>(DEFAULT_BUILD_MODE);

  useEffect(() => {
    const remembered = getRememberedMode(slug);
    if (remembered !== DEFAULT_BUILD_MODE) setActiveMode(remembered);
  }, [slug]);

  const handleModeChange = (flag: string): void => {
    const mode = buildModeFromFlag(flag);
    setActiveMode(mode);
    rememberMode(slug, mode);
  };

  return (
    <section data-testid="mode-selector-slot" aria-label={COPY.heading}>
      <Panel>
        {/* Heading "Modo de construcción" with icon */}
        <p style={HEADING_STYLE}>
          <i
            className="ti ti-adjustments"
            style={{ fontSize: "14px", verticalAlign: "-2px" }}
            aria-hidden="true"
          />
          {COPY.heading}
        </p>
        <p style={SUBTITLE_STYLE}>{COPY.subtitle}</p>

        {/* The build-mode picker IS the CmdRow select (AC-11-001.x / AC-11-002.x).
            Controlled + persisted per project (AC-11-003.x). */}
        <div data-testid="mode-command-row">
          <CmdRow
            command={IMPLEMENT_BASE_COMMAND}
            modes={IMPLEMENT_MODES}
            modeDefaultLabel={IMPLEMENT_MODE_DEFAULT_LABEL}
            modeTitle={IMPLEMENT_MODE_TITLE}
            modeHint={IMPLEMENT_DEFAULT_HINT}
            modeValue={buildModeFlag(activeMode)}
            onModeChange={handleModeChange}
          />
        </div>

        {/* Targeted build variants — implementation and release phases only.
            Same implement command, different scope: by FRD or by change-queue entry. */}
        {showVariants && (
          <>
            <div data-testid="mode-variant-frd-row" style={VARIANT_ROW_STYLE}>
              <CmdRow command="/pandacorp:implement <frd>" />
              <p style={VARIANT_DESC_STYLE}>{COPY.variantFrdWhen}</p>
            </div>
            <div data-testid="mode-variant-change-row" style={VARIANT_ROW_STYLE}>
              <CmdRow command="/pandacorp:implement change:<slug>" />
              <p style={VARIANT_DESC_STYLE}>{COPY.variantChangeWhen}</p>
            </div>
          </>
        )}
      </Panel>
    </section>
  );
}
