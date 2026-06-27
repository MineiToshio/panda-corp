"use client";

/**
 * WO-11-002 — ModeSelector (CMP-11-mode-selector)
 *
 * Client Component: per-project build mode selector for the Commands tab.
 * Mirrors prototype `buildModePanel()` (~L916, index.html) faithfully on
 * the frozen tokens (DR-054/056).
 *
 * Visual structure (prototype buildModePanel):
 *   Panel
 *     heading "Modo de construcción" (icon ti-adjustments, 13px, text2)
 *     subtitle "Con cuánta potencia..." (12px, text3)
 *     .stab chip row (4 mode buttons)
 *     active mode description (12px, text2)
 *     CmdRow (the exact /pandacorp:implement [mode] command + copy button)
 *
 * Reuses shared primitives (DR-057):
 *   Panel  → data-testid="panel"
 *   CmdRow → data-testid="cmd-row" (not a bespoke command-row fork)
 *
 * The .stab chip row uses role="radiogroup" semantics (not role="tablist")
 * because mode selection is exclusive choice, not content-tab switching.
 * Each chip is a <button role="radio" aria-checked> — the .stab visual
 * style (subTabStyle from Tabs) applied inline.
 *
 * Traceability:
 *   CMP-11-mode-selector → REQ-11-001, REQ-11-002, REQ-11-003
 *   AC-11-001.1 — four modes in order
 *   AC-11-001.2 — each option shows its description
 *   AC-11-001.3 — defaults to Balanced
 *   AC-11-002.1 — command + copy button on selection (via shared CmdRow)
 *   AC-11-002.2 — active description alongside command
 *   AC-11-003.1/.2 — remembered per project, restored on re-mount
 *   DR-057 — Panel + CmdRow reused; no bespoke forks
 *   DR-056 — matches buildModePanel() prototype structure
 *
 * Integration seam: TabCommands mounts this at data-testid="mode-selector-slot"
 * (AC-04-005.2). The root <section> carries that testid.
 */

import { useEffect, useState } from "react";

import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Panel } from "@/components/core/Panel/Panel";
import { getRememberedMode, rememberMode } from "@/lib/build-mode-store";
import {
  BUILD_MODES,
  type BuildMode,
  type BuildModeInfo,
  DEFAULT_BUILD_MODE,
} from "@/lib/constants";
import type { Phase } from "@/lib/status/status";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ModeSelectorProps {
  /**
   * The project slug — used to scope per-project mode memory (IF-11-mode-store).
   */
  slug: string;
  /**
   * The project phase — when implementation or release, the panel also shows
   * the targeted build variants (implement <frd> and implement change:<slug>).
   */
  phase?: Phase;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

/** Visually hidden — keeps radio inputs keyboard-accessible but off-screen */
const RADIO_HIDDEN_STYLE: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: 0,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};

/** .stab style for the mode chips (mirrors prototype's .stab/.stab.on) */
function stabChipStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "6px 11px",
    borderRadius: "var(--radius-md, 12px)",
    fontSize: "13px",
    cursor: "pointer",
    border: "0.5px solid transparent",
    color: active ? "var(--color-text)" : "var(--color-text2)",
    fontWeight: active ? 500 : 400,
    background: active ? "var(--color-card2)" : "transparent",
    transition:
      "color var(--duration-fast, 150ms) var(--easing-standard, ease), " +
      "background var(--duration-fast, 150ms) var(--easing-standard, ease)",
    outline: "none",
    // Ensure ≥44px hit area (blueprint §4)
    minHeight: "44px",
  };
}

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
  margin: "0 0 8px",
};

const CHIPS_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
  marginBottom: "8px",
};

const ACTIVE_DESC_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text2)",
  margin: "0 0 6px",
};

const VARIANT_DESC_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text2)",
  opacity: 0.8,
  lineHeight: 1.5,
  margin: "2px 0 0",
  paddingLeft: "2px",
};

const VARIANT_ROW_STYLE: React.CSSProperties = {
  marginTop: "6px",
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

// ---------------------------------------------------------------------------
// i18n copy (Spanish, DR-009)
// ---------------------------------------------------------------------------

/** Phases where targeted build variants are relevant. */
const BUILD_PHASES: ReadonlySet<string> = new Set(["implementation", "release"]);

const COPY = {
  heading: "Modo de construcción",
  subtitle:
    "Con cuánta potencia construir ESTE proyecto. Por defecto Equilibrado (Max 5x). Cambia el modo y copia el comando que toca.",
  radioGroupLabel: "Selector de modo de construcción",
  whenHint: "pégalo en la carpeta del proyecto",
  variantFrdWhen:
    "Construye solo el FRD indicado (sus deps deben estar VERIFIED; ej: frd-05-settings)",
  variantChangeWhen:
    "Procesa una change de la cola y construye solo los FRDs afectados (ej: change:mc-fix-pagination)",
  // Override labels to match prototype exactly
  modeLabels: {
    pro: "Pro / económico",
    balanced: "Equilibrado",
    powerful: "Potente",
    deep: "Profundo",
  } as Record<BuildMode, string>,
  // Override descriptions to match prototype descriptions exactly
  modeDescriptions: {
    pro: "1 agente a la vez, modelos económicos (sonnet/haiku). Más lento, mínimo consumo. Para plan Pro.",
    balanced:
      "Equipo de ≤3 agentes; líder opus, obreros sonnet/haiku. Por defecto, pensado para Max 5x.",
    powerful: "Hasta 5 agentes en paralelo → avanza más rápido. Para Max 20x.",
    deep: "Mejores modelos en todos + revisión adversarial extra. Para un proyecto especial.",
  } as Record<BuildMode, string>,
};

// ---------------------------------------------------------------------------
// ModeChip — a single stab-style mode button inside the radiogroup
// ---------------------------------------------------------------------------

interface ModeChipProps {
  mode: BuildModeInfo;
  isActive: boolean;
  groupName: string;
  onSelect: (id: BuildMode) => void;
}

/**
 * ModeChip — renders a single mode option as a .stab-style label/button.
 *
 * Accessibility: the <label> wraps a visually-hidden <input type="radio">
 * (full AT/keyboard semantics). The visible stab chip is the <label> itself,
 * styled as a .stab button. No duplicate role="radio" span — using both an
 * <input type="radio"> AND a span[role="radio"] would expose 8 radios instead
 * of 4, breaking the "exactly four mode options" invariant (AC-11-001.1).
 *
 * Hit area ≥44px (blueprint §4 / WCAG 2.5.5) via minHeight on the label.
 */
function ModeChip({ mode, isActive, groupName, onSelect }: ModeChipProps): React.JSX.Element {
  const label = COPY.modeLabels[mode.id] ?? mode.label;
  const inputId = `mode-radio-${mode.id}`;

  return (
    <label htmlFor={inputId} data-testid={`mode-option-${mode.id}`} style={stabChipStyle(isActive)}>
      {/* Visually hidden native radio — full AT/keyboard semantics (AC-11-001.1) */}
      <input
        id={inputId}
        type="radio"
        name={groupName}
        value={mode.id}
        checked={isActive}
        aria-checked={isActive}
        onChange={() => onSelect(mode.id)}
        style={RADIO_HIDDEN_STYLE}
      />

      {/* Checkmark — visible on active, invisible (not absent) when inactive (a11y, AC: not color alone) */}
      <span
        data-testid={`mode-check-${mode.id}`}
        aria-hidden={!isActive}
        style={{
          visibility: isActive ? "visible" : "hidden",
          width: "0.875rem",
          fontSize: "11px",
          color: "var(--color-accent-text)",
        }}
      >
        ✓
      </span>

      {/* Chip label text */}
      {label}

      {/* Per-mode description (AC-11-001.2) — visually hidden, readable by AT */}
      <span data-testid={`mode-description-${mode.id}`} style={RADIO_HIDDEN_STYLE}>
        {COPY.modeDescriptions[mode.id] ?? mode.description}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// ModeSelector — main export (CMP-11-mode-selector)
// ---------------------------------------------------------------------------

/**
 * Per-project build mode selector. Mirrors prototype buildModePanel().
 *
 * "use client" — requires browser APIs:
 *   - useState for local selection state
 *   - localStorage (via getRememberedMode / rememberMode) for persistence
 *   - Clipboard (via CmdRow → CopyButton) for the copy action
 *
 * Root element carries data-testid="mode-selector-slot" — the integration
 * seam that TabCommands (CMP-04-tab-commands) expects at AC-04-005.2.
 *
 * Reuses shared primitives (DR-057):
 *   Panel  → the .panel wrapper (embossed RPG skin)
 *   CmdRow → the .cmd chip (mono, bd2 hairline, with CopyButton)
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

  // Stable radio group name scoped to slug so multiple selectors on same page don't collide
  const groupName = `build-mode-${slug}`;

  const activeInfo = BUILD_MODES.find((m) => m.id === activeMode) ?? BUILD_MODES[1];
  // biome-ignore lint/style/noNonNullAssertion: BUILD_MODES always has ≥2 entries (catalog invariant)
  const resolvedInfo = activeInfo!;
  const activeDescription = COPY.modeDescriptions[resolvedInfo.id] ?? resolvedInfo.description;

  function handleSelect(id: BuildMode): void {
    setActiveMode(id);
    rememberMode(slug, id);
  }

  return (
    <section data-testid="mode-selector-slot" aria-label={COPY.heading}>
      {/* Panel — the .panel primitive (DR-057, mirrors prototype's class="panel") */}
      <Panel>
        {/* Heading "Modo de construcción" with icon (prototype ~L920) */}
        <p style={HEADING_STYLE}>
          <i
            className="ti ti-adjustments"
            style={{ fontSize: "14px", verticalAlign: "-2px" }}
            aria-hidden="true"
          />
          {COPY.heading}
        </p>

        {/* Subtitle (prototype ~L920) */}
        <p style={SUBTITLE_STYLE}>{COPY.subtitle}</p>

        {/* Mode chips row — role="radiogroup" (exclusive choice, not content tabs).
            The four .stab chips: Pro / Equilibrado / Potente / Profundo (AC-11-001.1) */}
        <div role="radiogroup" aria-label={COPY.radioGroupLabel} style={CHIPS_ROW_STYLE}>
          <fieldset style={{ border: "none", margin: 0, padding: 0, display: "contents" }}>
            <legend style={RADIO_HIDDEN_STYLE}>{COPY.heading}</legend>

            {BUILD_MODES.map((mode) => (
              <ModeChip
                key={mode.id}
                mode={mode}
                isActive={mode.id === activeMode}
                groupName={groupName}
                onSelect={handleSelect}
              />
            ))}
          </fieldset>
        </div>

        {/* Active mode description (AC-11-002.2, prototype ~L920 `m[2]`) */}
        <p data-testid="mode-active-description" style={ACTIVE_DESC_STYLE}>
          {activeDescription}
        </p>

        {/* CmdRow — shared primitive (DR-057); mirrors cmdRow() from prototype.
            Shows the exact /pandacorp:implement [mode] command (AC-11-002.1) */}
        <div data-testid="mode-command-row">
          <CmdRow command={resolvedInfo.command} />
        </div>

        {/* Targeted build variants — visible in implementation and release phases only.
            Same implement command, different scope: by FRD or by change queue entry. */}
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
