"use client";
/**
 * WO-07-005 — SectionTabs (CMP-07-config-page, tab bar portion)
 *
 * Client Component: section tab bar for the Configuration page.
 *   - Four sections in exact order: Habilidades · Agentes · Reglas de decisión · Estándares
 *     (AC-07-005.1).
 *   - Controlled: receives activeSection + onSectionChange callback (AC-07-005.2).
 *   - Delegates to the shared `SubTabs` primitive (DR-057/DR-062 — ONE tab pattern).
 *     Using testIdPrefix="config-tab-" keeps all consuming test ids stable.
 *   - Active state paired with aria-selected (via Tabs) (AC-07-005.4).
 *   - Spanish labels (architecture §7).
 *   - ZERO hardcoded colors — SubTabs uses CSS custom properties only (FRD-13 / AC-07-005.3).
 *
 * Traceability:
 *   CMP-07-config-page → FRD-07
 *   AC-07-005.1, AC-07-005.2, AC-07-005.3, AC-07-005.4
 *   DR-057 / DR-062 — shared Tabs primitive; no ad-hoc tablist per screen.
 */

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
// SectionTabs component — delegates to shared SubTabs (DR-057)
// ---------------------------------------------------------------------------

/**
 * CMP-07-config-page (tab bar) — controlled section tab list for Configuration.
 *
 * Delegates to SubTabs (= Tabs level="sub", the .stab style from the prototype).
 * Uses testIdPrefix="config-tab-" so all downstream tests keep their stable ids.
 *
 * "use client" — parent (ConfigurationShell) owns the state and passes callbacks.
 */
export function SectionTabs({
  activeSection,
  onSectionChange,
}: SectionTabsProps): React.JSX.Element {
  return (
    <nav
      data-testid="config-section-tabs"
      aria-label="Secciones de configuración"
      style={{ padding: "0 calc(var(--spacing, 0.25rem) * 8)" }}
    >
      <SubTabs
        tabs={SECTION_TABS.map((s) => ({ id: s.id, label: s.label }))}
        active={activeSection}
        onChange={(id) => onSectionChange(id as SectionId)}
        ariaLabel="Secciones de configuración"
        testIdPrefix="config-tab-"
        tabIdPrefix="config-tab-id-"
      />
    </nav>
  );
}
