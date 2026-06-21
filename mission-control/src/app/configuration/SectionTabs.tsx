"use client";
/**
 * WO-07-005 — SectionTabs (CMP-07-config-page, tab bar portion)
 *
 * DR-057/DR-062 compliant: delegates entirely to the ONE shared SubTabs
 * primitive (src/components/core/Tabs/Tabs.tsx) — no bespoke role="tablist".
 *
 * Reopen pass (2026-06-21): converged onto SubTabs per gate requirement.
 * Keeps all downstream test-ids stable (testIdPrefix="config-tab-") and
 * stable HTML ids (tabIdPrefix="config-tab-id-") for aria-labelledby panels.
 *
 *   - Four sections in exact order: Habilidades · Agentes · Reglas de decisión · Estándares
 *     (AC-07-005.1).
 *   - Controlled: receives activeSection + onSectionChange callback (AC-07-005.2).
 *   - role="tablist" (provided by SubTabs), aria-selected on the active tab (AC-07-005.4).
 *   - Spanish labels and aria-label (architecture §7 — UI copy in Spanish, AC-07-005.4).
 *   - Active state paired with data-active + aria-selected, NOT color alone (AC-07-005.3 a11y).
 *   - Keyboard-navigable: Arrow keys cycle focus; Enter/Space activate (WAI-ARIA, AC-07-005.4).
 *   - ZERO hardcoded colors — CSS custom properties only (FRD-13 / AC-07-005.3).
 *   - data-testid="config-section-tabs" on wrapper; "config-tab-<id>" on each tab button.
 *   - Stable HTML id="config-tab-id-<id>" on each button for aria-labelledby pairing.
 *
 * Traceability:
 *   CMP-07-config-page → FRD-07
 *   AC-07-005.1, AC-07-005.2, AC-07-005.3, AC-07-005.4
 *   DR-057 (reuse-before-create), DR-062 (ONE tab pattern)
 */

import type React from "react";
import { SubTabs } from "@/components/core/Tabs/Tabs";

// ---------------------------------------------------------------------------
// Section definitions (AC-07-005.1 — four sections in exact order)
// ---------------------------------------------------------------------------

export type SectionId = "skills" | "agents" | "rules" | "standards";

const SECTION_TABS = [
  { id: "skills", label: "Habilidades" },
  { id: "agents", label: "Agentes" },
  { id: "rules", label: "Reglas de decisión" },
  { id: "standards", label: "Estándares" },
] as const satisfies ReadonlyArray<{ id: SectionId; label: string }>;

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
// Wrapper style — zero hardcoded colors (FRD-13)
// ---------------------------------------------------------------------------

const WRAPPER_STYLE: React.CSSProperties = {
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  background: "var(--color-surface, Canvas)",
  overflowX: "auto",
  scrollbarWidth: "none",
  padding: "0 calc(var(--spacing, 0.25rem) * 8)",
};

// ---------------------------------------------------------------------------
// SectionTabs component
// ---------------------------------------------------------------------------

/**
 * CMP-07-config-page (tab bar) — controlled section tab list for Configuration.
 *
 * "use client" — parent ConfigurationShell is a client component; this is
 * a pure presentation delegation to SubTabs. The nav wrapper keeps the
 * data-testid="config-section-tabs" testid that existing tests rely on.
 *
 * DR-057/DR-062: uses the ONE shared SubTabs primitive, NOT a hand-rolled tablist.
 */
export function SectionTabs({
  activeSection,
  onSectionChange,
}: SectionTabsProps): React.JSX.Element {
  return (
    <nav
      data-testid="config-section-tabs"
      aria-label="Secciones de configuración"
      style={WRAPPER_STYLE}
    >
      <SubTabs
        tabs={SECTION_TABS as unknown as Array<{ id: string; label: string }>}
        active={activeSection}
        onChange={(id) => onSectionChange(id as SectionId)}
        ariaLabel="Secciones de configuración"
        testIdPrefix="config-tab-"
        tabIdPrefix="config-tab-id-"
      />
    </nav>
  );
}
