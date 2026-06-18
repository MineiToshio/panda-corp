"use client";

/**
 * WO-11-002 — ModeSelector (CMP-11-mode-selector)
 *
 * Client Component: per-project build mode selector for the Commands tab.
 *   - Semantic radiogroup via <fieldset>/<legend> + <input type="radio"> (AC-11-001.1).
 *   - Each option shows its description (AC-11-001.2).
 *   - Defaults to Balanced (AC-11-001.3).
 *   - WHEN a mode is selected, shows the exact command + copy button (AC-11-002.1).
 *   - Shows the active mode's description alongside the command (AC-11-002.2).
 *   - Remembers the choice per project via localStorage (AC-11-003.1/.2).
 *   - Active mode indicated by aria-checked (native radio) + checkmark icon (a11y, blueprint §4).
 *
 * Design rules (AGENTS.md / FRD-13):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on all interactive elements.
 *   - Spanish aria-labels and copy.
 *   - "use client" — interaction and localStorage require the browser.
 *
 * Traceability:
 *   CMP-11-mode-selector → REQ-11-001, REQ-11-002, REQ-11-003
 *   AC-11-001.1 — four modes in order
 *   AC-11-001.2 — each option shows its description
 *   AC-11-001.3 — defaults to Balanced
 *   AC-11-002.1 — command + copy button on selection
 *   AC-11-002.2 — active description alongside command
 *   AC-11-003.1/.2 — remembered per project, restored on re-mount
 *
 * Integration seam: TabCommands mounts this component at data-testid="mode-selector-slot"
 * (AC-04-005.2). The root element of this component carries that testid.
 */

import { useState } from "react";

import { CopyButton } from "@/components/CopyButton";
import { getRememberedMode, rememberMode } from "@/lib/build-mode-store";
import { BUILD_MODES, type BuildMode, type BuildModeInfo } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ModeSelectorProps {
  /**
   * The project slug — used to scope per-project mode memory (IF-11-mode-store).
   */
  slug: string;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

const ROOT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 4)",
  background: "var(--color-surface-panel, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  padding: "calc(var(--spacing, 0.25rem) * 5) calc(var(--spacing, 0.25rem) * 6)",
  boxShadow: "var(--shadow-panel, none)",
};

const LEGEND_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.65,
  padding: 0,
};

const RADIOGROUP_INNER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
};

const LABEL_STYLE_BASE: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
  padding: "calc(var(--spacing, 0.25rem) * 3)",
  borderRadius: "var(--radius-sm, 0.375rem)",
  cursor: "pointer",
  border: "var(--hairline, 1px) solid transparent",
  background: "transparent",
  color: "var(--color-text, currentColor)",
};

const LABEL_ACTIVE_STYLE: React.CSSProperties = {
  ...LABEL_STYLE_BASE,
  background: "var(--color-accent-subtle, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-accent, currentColor)",
};

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

const CHECK_VISIBLE_STYLE: React.CSSProperties = {
  flexShrink: 0,
  marginTop: "0.125rem",
  width: "1rem",
  height: "1rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--color-accent, currentColor)",
  fontWeight: 700,
};

const CHECK_HIDDEN_STYLE: React.CSSProperties = {
  ...CHECK_VISIBLE_STYLE,
  visibility: "hidden",
};

const OPTION_BODY_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 0.5)",
  flexGrow: 1,
};

const OPTION_LABEL_TEXT_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "var(--color-text, currentColor)",
};

const OPTION_DESC_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.8,
  lineHeight: 1.4,
};

const COMMAND_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  borderTop: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  paddingTop: "calc(var(--spacing, 0.25rem) * 4)",
};

const COMMAND_TOP_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
};

const COMMAND_TEXT_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "var(--color-text, currentColor)",
  flexGrow: 1,
  wordBreak: "break-all",
};

const COMMAND_DESC_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.8,
  lineHeight: 1.5,
  margin: 0,
};

// ---------------------------------------------------------------------------
// i18n copy (Spanish, DR-009)
// ---------------------------------------------------------------------------

const COPY = {
  sectionTitle: "Modo de construcción",
  radioGroupLabel: "Selector de modo de construcción",
  modeLabels: {
    pro: "Pro / Económico",
    balanced: "Balanceado",
    powerful: "Potente",
    deep: "Profundo",
  } as Record<BuildMode, string>,
  modeDescriptions: {
    pro: "1 agente, modelos económicos (sonnet/haiku). Más lento, consumo mínimo. Para el plan Pro.",
    balanced: "Equipo de ≤3 agentes; líder opus, workers sonnet/haiku. Diseñado para Max 5x.",
    powerful: "Hasta 5 agentes en paralelo, avanza más rápido. Para Max 20x.",
    deep: "Los mejores modelos en todo el stack + revisión adversarial extra. Para proyectos especiales.",
  } as Record<BuildMode, string>,
  checkmark: "✓",
};

// ---------------------------------------------------------------------------
// ModeOption — a single radio option inside the fieldset
// ---------------------------------------------------------------------------

interface ModeOptionProps {
  mode: BuildModeInfo;
  isActive: boolean;
  groupName: string;
  onSelect: (id: BuildMode) => void;
}

function ModeOption({ mode, isActive, groupName, onSelect }: ModeOptionProps): React.JSX.Element {
  const label = COPY.modeLabels[mode.id] ?? mode.label;
  const description = COPY.modeDescriptions[mode.id] ?? mode.description;
  const inputId = `mode-radio-${mode.id}`;

  return (
    // data-testid on the label so within(option) can find child elements (AC tests)
    <label
      htmlFor={inputId}
      data-testid={`mode-option-${mode.id}`}
      style={isActive ? LABEL_ACTIVE_STYLE : LABEL_STYLE_BASE}
    >
      {/* Visually hidden native radio — keeps keyboard/AT semantics intact.
          aria-checked mirrors checked for tests that use getAttribute("aria-checked"). */}
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

      {/* Checkmark — visible when active, hidden (not absent) when inactive so layout is stable */}
      <span
        data-testid={`mode-check-${mode.id}`}
        aria-hidden={!isActive}
        style={isActive ? CHECK_VISIBLE_STYLE : CHECK_HIDDEN_STYLE}
      >
        {COPY.checkmark}
      </span>

      {/* Option body: label + description */}
      <span style={OPTION_BODY_STYLE}>
        <span style={OPTION_LABEL_TEXT_STYLE}>{label}</span>
        <span data-testid={`mode-description-${mode.id}`} style={OPTION_DESC_STYLE}>
          {description}
        </span>
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// ModeSelector — main export (CMP-11-mode-selector)
// ---------------------------------------------------------------------------

/**
 * Per-project build mode selector.
 *
 * "use client" — requires browser APIs:
 *   - useState for local selection state.
 *   - localStorage (via getRememberedMode / rememberMode) for persistence.
 *   - Clipboard (via CopyButton) for the copy action.
 *
 * The root element carries data-testid="mode-selector-slot" — the integration
 * seam that TabCommands (CMP-04-tab-commands) expects at AC-04-005.2.
 */
export function ModeSelector({ slug }: ModeSelectorProps): React.JSX.Element {
  // Initialize from localStorage — restores remembered mode (AC-11-003.2).
  const [activeMode, setActiveMode] = useState<BuildMode>(() => getRememberedMode(slug));

  // Stable group name scoped to slug so multiple selectors on the same page don't collide.
  const groupName = `build-mode-${slug}`;

  const activeInfo = BUILD_MODES.find((m) => m.id === activeMode) ?? BUILD_MODES[1];
  // biome-ignore lint/style/noNonNullAssertion: BUILD_MODES always has at least 2 entries (catalog invariant)
  const resolvedInfo = activeInfo!;
  const activeDescription = COPY.modeDescriptions[resolvedInfo.id] ?? resolvedInfo.description;

  function handleSelect(id: BuildMode): void {
    setActiveMode(id);
    rememberMode(slug, id);
  }

  return (
    <section data-testid="mode-selector-slot" aria-label={COPY.sectionTitle} style={ROOT_STYLE}>
      {/* Radiogroup — four mode options (AC-11-001.1).
          <div role="radiogroup"> provides the ARIA semantics; the inner <fieldset>
          keeps the legend/accessible-name association for native AT. We cannot put
          role="radiogroup" on the <fieldset> itself because biome's
          noNoninteractiveElementToInteractiveRole rule (correctly) rejects it. */}
      <div role="radiogroup" aria-label={COPY.radioGroupLabel} style={RADIOGROUP_INNER_STYLE}>
        <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
          <legend style={LEGEND_STYLE}>{COPY.sectionTitle}</legend>

          {BUILD_MODES.map((mode) => (
            <ModeOption
              key={mode.id}
              mode={mode}
              isActive={mode.id === activeMode}
              groupName={groupName}
              onSelect={handleSelect}
            />
          ))}
        </fieldset>
      </div>

      {/* Command row — shown for the active mode (AC-11-002.1/.2) */}
      <div data-testid="mode-command-row" style={COMMAND_ROW_STYLE}>
        <div style={COMMAND_TOP_STYLE}>
          <code data-testid="mode-command-text" style={COMMAND_TEXT_STYLE}>
            {resolvedInfo.command}
          </code>
          {/* CopyButton is "use client" — handles clipboard (AC-11-002.1) */}
          <span data-testid="mode-command-copy">
            <CopyButton value={resolvedInfo.command} />
          </span>
        </div>
        {/* Active mode description alongside command (AC-11-002.2) */}
        <p data-testid="mode-active-description" style={COMMAND_DESC_STYLE}>
          {activeDescription}
        </p>
      </div>
    </section>
  );
}
