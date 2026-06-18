"use client";
/**
 * WO-07-005 — SectionTabs (CMP-07-config-page, tab bar portion)
 *
 * Client Component: section tab bar for the Configuration page.
 *   - Four sections in exact order: Habilidades · Agentes · Reglas de decisión · Estándares
 *     (AC-07-005.1).
 *   - Controlled: receives activeSection + onSectionChange callback (AC-07-005.2).
 *   - role="tablist" with aria-selected on the active tab (AC-07-005.4).
 *   - Spanish labels and aria-label (architecture §7 — UI copy in Spanish, AC-07-005.4).
 *   - Active state paired with data-active + aria-selected, NOT color alone (AC-07-005.3 a11y).
 *   - Keyboard-navigable: Enter / Space activate the focused tab (AC-07-005.4).
 *   - ZERO hardcoded colors — CSS custom properties only (FRD-13 / AC-07-005.3).
 *   - data-testid="config-section-tabs" on container; "config-tab-<id>" on each tab.
 *   - Stable id on each tab for aria-labelledby pairing with panels.
 *
 * Traceability:
 *   CMP-07-config-page → FRD-07
 *   AC-07-005.1, AC-07-005.2, AC-07-005.3, AC-07-005.4
 */

import type React from "react";
import { useCallback } from "react";

// ---------------------------------------------------------------------------
// Section definitions (AC-07-005.1 — four sections in exact order)
// ---------------------------------------------------------------------------

export type SectionId = "skills" | "agents" | "rules" | "standards";

interface SectionDef {
  id: SectionId;
  label: string; // Spanish label (AC-07-005.4)
}

const SECTIONS: SectionDef[] = [
  { id: "skills", label: "Habilidades" },
  { id: "agents", label: "Agentes" },
  { id: "rules", label: "Reglas de decisión" },
  { id: "standards", label: "Estándares" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SectionTabsProps {
  /** Currently active section id. */
  activeSection: SectionId;
  /** Called when the user selects a different section. */
  onSectionChange: (id: SectionId) => void;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors (FRD-13)
// ---------------------------------------------------------------------------

const TABLIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  gap: 0,
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  background: "var(--color-surface, Canvas)",
  overflowX: "auto",
  scrollbarWidth: "none",
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "calc(var(--spacing, 0.25rem) * 3) calc(var(--spacing, 0.25rem) * 5)",
    fontSize: "0.8125rem",
    fontWeight: active ? 600 : 400,
    color: active ? "var(--color-accent, currentColor)" : "var(--color-text-muted, currentColor)",
    textDecoration: "none",
    /* Active underline: 2px accent bottom border (shape indicator, not color alone) */
    borderBottom: active ? "2px solid var(--color-accent, currentColor)" : "2px solid transparent",
    marginBottom: "-1px", // overlap container bottom border
    background: "none",
    border: "none",
    borderBottomColor: active ? "var(--color-accent, currentColor)" : "transparent",
    borderBottomWidth: "2px",
    borderBottomStyle: "solid",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition:
      "color var(--duration-fast, 150ms) var(--easing-standard, ease), border-color var(--duration-fast, 150ms) var(--easing-standard, ease)",
    outline: "none",
  };
}

// ---------------------------------------------------------------------------
// SectionTabs component
// ---------------------------------------------------------------------------

/**
 * CMP-07-config-page (tab bar) — controlled section tab list for Configuration.
 *
 * "use client" — receives callbacks; needs onClick / onKeyDown handlers.
 * Parent (ConfigurationShell) owns the state.
 */
export function SectionTabs({
  activeSection,
  onSectionChange,
}: SectionTabsProps): React.JSX.Element {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, id: SectionId) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSectionChange(id);
      }
    },
    [onSectionChange],
  );

  return (
    <nav
      data-testid="config-section-tabs"
      aria-label="Secciones de configuración"
      style={TABLIST_STYLE}
    >
      <div role="tablist" aria-label="Secciones de configuración" style={{ display: "contents" }}>
        {SECTIONS.map(({ id, label }) => {
          const isActive = id === activeSection;
          return (
            <button
              key={id}
              id={`config-tab-id-${id}`}
              role="tab"
              type="button"
              data-testid={`config-tab-${id}`}
              data-active={isActive ? "true" : "false"}
              aria-selected={isActive ? "true" : "false"}
              tabIndex={isActive ? 0 : -1}
              style={tabStyle(isActive)}
              onClick={() => onSectionChange(id)}
              onKeyDown={(e) => handleKeyDown(e, id)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
