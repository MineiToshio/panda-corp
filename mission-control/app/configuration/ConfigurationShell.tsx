"use client";
/**
 * WO-07-005 — ConfigurationShell (CMP-07-config-page, shell + section mount)
 *
 * Client Component: owns the active-section state and renders:
 *   1. SectionTabs — the four-tab navigation bar.
 *   2. The active section's panel placeholder (sections 006–009 replace these).
 *
 * State: `activeSection` — defaults to "skills" (AC-07-005.2).
 * Renders one panel at a time; the others are unmounted (not just hidden) so
 * future section components can initialize their own data reads on mount.
 *
 * Each panel:
 *   - role="tabpanel" (a11y)
 *   - aria-labelledby="config-tab-id-<sectionId>" (links to the tab button's id)
 *   - data-testid="config-section-<sectionId>"
 *   - ZERO hardcoded colors — CSS custom properties only (FRD-13 / AC-07-005.3)
 *
 * Traceability:
 *   CMP-07-config-page → FRD-07
 *   AC-07-005.1, AC-07-005.2, AC-07-005.3, AC-07-005.4
 */

import type React from "react";
import { useState } from "react";
import { type SectionId, SectionTabs } from "./SectionTabs";

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors (FRD-13)
// ---------------------------------------------------------------------------

const SHELL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
};

const PANEL_STYLE: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "calc(var(--spacing, 0.25rem) * 6) calc(var(--spacing, 0.25rem) * 8)",
};

const PLACEHOLDER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
};

const PLACEHOLDER_TITLE_STYLE: React.CSSProperties = {
  fontSize: "1.125rem",
  fontWeight: 600,
  color: "var(--color-text, currentColor)",
  margin: 0,
};

const PLACEHOLDER_DESC_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.7,
  margin: 0,
};

// ---------------------------------------------------------------------------
// Section panel placeholders (WO-07-006 through WO-07-009 fill these)
// ---------------------------------------------------------------------------

const SECTION_META: Record<SectionId, { titleEs: string; descEs: string }> = {
  skills: {
    titleEs: "Habilidades",
    descEs: "Lista de habilidades del plugin de Pandacorp (WO-07-006 las renderiza).",
  },
  agents: {
    titleEs: "Agentes",
    descEs: "Agentes de la fábrica con su avatar, nivel y título RPG (WO-07-007 los renderiza).",
  },
  rules: {
    titleEs: "Reglas de decisión",
    descEs: "Todas las reglas del registro de decisiones de la fábrica (WO-07-008 las renderiza).",
  },
  standards: {
    titleEs: "Estándares",
    descEs: "Estándares de ingeniería categorizados por dominio (WO-07-009 los renderiza).",
  },
};

interface SectionPanelProps {
  sectionId: SectionId;
}

function SectionPanel({ sectionId }: SectionPanelProps): React.JSX.Element {
  const meta = SECTION_META[sectionId];
  return (
    <div
      role="tabpanel"
      data-testid={`config-section-${sectionId}`}
      aria-labelledby={`config-tab-id-${sectionId}`}
      style={PANEL_STYLE}
    >
      <div style={PLACEHOLDER_STYLE}>
        <h2 style={PLACEHOLDER_TITLE_STYLE}>{meta.titleEs}</h2>
        <p style={PLACEHOLDER_DESC_STYLE}>{meta.descEs}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfigurationShell — main export (CMP-07-config-page)
// ---------------------------------------------------------------------------

/**
 * ConfigurationShell — client shell for the /configuration route.
 *
 * Owns the active-section useState (default: "skills", AC-07-005.2).
 * Renders SectionTabs + the active panel, unmounting inactive ones.
 */
export function ConfigurationShell(): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<SectionId>("skills");

  return (
    <div data-testid="config-shell" style={SHELL_STYLE}>
      {/* Tab bar — always visible (AC-07-005.1) */}
      <SectionTabs activeSection={activeSection} onSectionChange={setActiveSection} />

      {/* Active section panel — only one mounted at a time (AC-07-005.2) */}
      <SectionPanel sectionId={activeSection} />
    </div>
  );
}
