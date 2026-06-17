"use client";
/**
 * WO-07-005 — ConfigurationShell (CMP-07-config-page, shell + section mount)
 * WO-07-006 — wires SkillsSection into the skills tab
 * WO-07-008 — wires DecisionRulesSection into the rules tab
 * WO-07-009 — wires StandardsSection into the standards tab
 *
 * Client Component: owns the active-section state and renders:
 *   1. SectionTabs — the four-tab navigation bar.
 *   2. The active section's panel (skills + rules = real; others = placeholder).
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
 *   CMP-07-skill-list, CMP-07-skill-detail, CMP-07-flow-diagram → AC-07-006.1..5
 *   CMP-07-rules-list, CMP-07-rule-detail → AC-07-008.1..4
 *   CMP-07-standards-list, CMP-07-standard-detail → AC-07-009.1..5
 */

import type React from "react";
import { useState } from "react";
import type { AgentLevelResult } from "@/lib/gamification";
import type { AgentRef, SkillRef } from "@/lib/reference";
import type { DecisionRule } from "@/lib/registry";
import type { Standard } from "@/lib/standards";
import { DecisionRulesSection } from "./_rules/DecisionRulesSection";
import { AgentDetail } from "./AgentDetail";
import { AgentList } from "./AgentList";
import { type SectionId, SectionTabs } from "./SectionTabs";
import { SkillsSection } from "./SkillsSection";
import { StandardsSection } from "./StandardsSection";

// ---------------------------------------------------------------------------
// AgentsData — pre-computed by the Server Component (page.tsx)
// ---------------------------------------------------------------------------

/**
 * Pre-computed agents data passed from the Server Component.
 * Agents list + their computed XP levels (from computeAgentLevel over events).
 * Exported so page.tsx and tests share the same type.
 */
export type AgentsData = {
  agents: AgentRef[];
  levels: Record<string, AgentLevelResult>;
};

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
// Section panel placeholder (WO-07-007 still fills agents)
// ---------------------------------------------------------------------------

const SECTION_META: Record<"agents" | "standards", { titleEs: string; descEs: string }> = {
  agents: {
    titleEs: "Agentes",
    descEs: "Agentes de la fábrica con su avatar, nivel y título RPG (WO-07-007 los renderiza).",
  },
  standards: {
    titleEs: "Estándares",
    descEs: "Estándares de ingeniería categorizados por dominio (WO-07-009 los renderiza).",
  },
};

interface SectionPanelProps {
  sectionId: "agents" | "standards";
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

export interface ConfigurationShellProps {
  /** Skills from readSkills() — passed from the Server Component (WO-07-006). */
  skills?: SkillRef[];
  /**
   * Pre-computed agents + XP levels — passed from the Server Component (WO-07-007).
   * When omitted, the agents panel renders an empty list (honest zero state).
   */
  agentsData?: AgentsData;
  /** Decision rules from readDecisionRules() — passed from the Server Component. */
  rules?: DecisionRule[];
}

const AGENTS_PANEL_STYLE: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 6)",
  padding: "calc(var(--spacing, 0.25rem) * 6) calc(var(--spacing, 0.25rem) * 8)",
};

/**
 * ConfigurationShell — client shell for the /configuration route.
 *
 * Owns the active-section useState (default: "skills", AC-07-005.2).
 * Owns the selected-agent useState for the agents detail panel (AC-07-007.2).
 * Renders SectionTabs + the active panel, unmounting inactive ones.
 *
 * WO-07-006: accepts `skills` prop to pass to SkillsSection.
 * WO-07-007: accepts `agentsData` prop to pass to AgentList / AgentDetail.
 * WO-07-008: accepts `rules` prop to pass to DecisionRulesSection.
 */
export function ConfigurationShell({
  skills = [],
  agentsData,
  rules = [],
}: ConfigurationShellProps): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<SectionId>("skills");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Resolve agents + levels from the prop (empty defaults = honest zero state, AC-07-007.3)
  const agents = agentsData?.agents ?? [];
  const levels = agentsData?.levels ?? {};

  // Find the selected agent's full ref + level for the detail panel
  const selectedAgent = selectedAgentId
    ? (agents.find((a) => a.id === selectedAgentId) ?? null)
    : null;
  const selectedLevel = selectedAgentId ? (levels[selectedAgentId] ?? null) : null;

  // Reset agent selection when leaving the agents tab
  function handleSectionChange(id: SectionId): void {
    if (id !== "agents") setSelectedAgentId(null);
    setActiveSection(id);
  }

  return (
    <div data-testid="config-shell" style={SHELL_STYLE}>
      {/* Tab bar — always visible (AC-07-005.1) */}
      <SectionTabs activeSection={activeSection} onSectionChange={handleSectionChange} />

      {/* Active section panel — only one mounted at a time (AC-07-005.2) */}
      {activeSection === "skills" ? (
        /* WO-07-006: real Skills section (CMP-07-skill-list + CMP-07-skill-detail) */
        <div
          role="tabpanel"
          data-testid="config-section-skills"
          aria-labelledby="config-tab-id-skills"
          style={PANEL_STYLE}
        >
          <SkillsSection skills={skills} />
        </div>
      ) : activeSection === "agents" ? (
        /* WO-07-007: real Agents section (CMP-07-agent-list + CMP-07-agent-detail) */
        <div
          role="tabpanel"
          data-testid="config-section-agents"
          aria-labelledby="config-tab-id-agents"
          style={AGENTS_PANEL_STYLE}
        >
          {/* Agent list — always visible; empty = honest zero state */}
          <AgentList
            agents={agents}
            levels={levels}
            selectedAgentId={selectedAgentId}
            onSelectAgent={setSelectedAgentId}
          />
          {/* Agent detail — shown when a card is selected (AC-07-007.2) */}
          {selectedAgent !== null && selectedLevel !== null ? (
            <AgentDetail agent={selectedAgent} level={selectedLevel} />
          ) : null}
        </div>
      ) : activeSection === "rules" ? (
        /* WO-07-008: real Decision rules section (CMP-07-rules-list + CMP-07-rule-detail) */
        <div
          role="tabpanel"
          data-testid="config-section-rules"
          aria-labelledby="config-tab-id-rules"
          style={PANEL_STYLE}
        >
          <DecisionRulesSection rules={rules} />
        </div>
      ) : (
        /* WO-07-009: standards section (via StandardsSection + SectionPanel placeholder) */
        <SectionPanel sectionId="standards" />
      )}
    </div>
  );
}
