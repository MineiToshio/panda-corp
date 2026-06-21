"use client";
/**
 * WO-07-005 — SectionTabs (CMP-07-config-page, tab bar portion)
 *
 * Delegates entirely to the shared SubTabs primitive (DR-057 / DR-062).
 * THE one tab pattern is src/components/core/Tabs/Tabs.tsx — no bespoke
 * per-screen tablist (a hand-rolled role="tablist" is a DR-062 defect).
 *
 * Four sections in exact order: Habilidades · Agentes · Reglas de decisión · Estándares
 * (AC-07-005.1). Controlled: receives activeSection + onSectionChange (AC-07-005.2).
 *
 * testIdPrefix="config-tab-"  → data-testid="config-tab-skills" etc. (all downstream
 *   tests keep stable config-tab-{id} testids).
 * tabIdPrefix="config-tab-id-" → id="config-tab-id-skills" etc. so the paired
 *   role="tabpanel" elements can use aria-labelledby (AC-07-005.4).
 *
 * Traceability:
 *   CMP-07-config-page → FRD-07
 *   AC-07-005.1, AC-07-005.2, AC-07-005.3, AC-07-005.4
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
] as const;

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
// Container style — wraps the SubTabs with the section-specific chrome
// (bottom border, scrollable overflow)
// ---------------------------------------------------------------------------

const CONTAINER_STYLE: React.CSSProperties = {
  flexShrink: 0,
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  background: "var(--color-surface, Canvas)",
  overflowX: "auto",
  scrollbarWidth: "none",
  padding: "calc(var(--spacing, 0.25rem) * 2) calc(var(--spacing, 0.25rem) * 8)",
};

// ---------------------------------------------------------------------------
// SectionTabs component — thin wrapper that delegates to SubTabs (DR-057)
// ---------------------------------------------------------------------------

/**
 * CMP-07-config-page (tab bar) — delegates to SubTabs (DR-057/DR-062).
 *
 * "use client" — inherited from SubTabs (client boundary for onClick/onKeyDown).
 * Parent (ConfigurationShell) owns the state.
 */
export function SectionTabs({
  activeSection,
  onSectionChange,
}: SectionTabsProps): React.JSX.Element {
  return (
    <nav
      data-testid="config-section-tabs"
      aria-label="Secciones de configuración"
      style={CONTAINER_STYLE}
    >
      <SubTabs
        tabs={SECTION_TABS as unknown as { id: string; label: string }[]}
        active={activeSection}
        onChange={(id) => onSectionChange(id as SectionId)}
        ariaLabel="Secciones de configuración"
        testIdPrefix="config-tab-"
        tabIdPrefix="config-tab-id-"
      />
    </nav>
  );
}
