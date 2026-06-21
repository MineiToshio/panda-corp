"use client";
/**
 * WO-07-005 — ConfigurationShell (CMP-07-config-page, shell + section mount)
 * WO-07-006 — wires SkillsSection into the skills tab
 * WO-07-007 — wires AgentList + AgentDetail into the agents tab
 * WO-07-008 — wires DecisionRulesSection into the rules tab
 * WO-07-009 — wires StandardsSection into the standards tab
 *
 * Client Component: owns the active-section state and renders:
 *   1. SectionTabs — the four-tab navigation bar.
 *   2. The active section's panel (all four sections now real, no placeholders).
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
 *   CMP-07-config-page -> FRD-07
 *   AC-07-005.1, AC-07-005.2, AC-07-005.3, AC-07-005.4
 *   CMP-07-skill-list, CMP-07-skill-detail, CMP-07-flow-diagram -> AC-07-006.1..5
 *   CMP-07-agent-list, CMP-07-agent-detail -> AC-07-007.1..3
 *   CMP-07-rules-list, CMP-07-rule-detail -> AC-07-008.1..4
 *   CMP-07-standards-list, CMP-07-standard-detail -> AC-07-009.1..5
 */

import type React from "react";
import { useState } from "react";
import { PageTitle } from "@/components/core/PageTitle/PageTitle";
import type { AgentLevelResult } from "@/lib/gamification/agents";
import type { AgentRef, SkillRef } from "@/lib/reference/reference";
import type { DecisionRule } from "@/lib/registry/registry";
import type { Standard } from "@/lib/standards/standards";
import { DecisionRulesSection } from "./_rules/DecisionRulesSection/DecisionRulesSection";
import { AgentDetail } from "./AgentDetail";
import { AgentList } from "./AgentList";
import { type SectionId, SectionTabs } from "./SectionTabs";
import { SkillsSection } from "./SkillsSection";
import { StandardsSection } from "./StandardsSection/StandardsSection";

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

const HEADER_STYLE: React.CSSProperties = {
  flexShrink: 0,
  padding: "calc(var(--spacing, 0.25rem) * 5) calc(var(--spacing, 0.25rem) * 8)",
  borderBottom: "var(--hairline, 1px) solid var(--color-border)",
};

const PANEL_STYLE: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "calc(var(--spacing, 0.25rem) * 6) calc(var(--spacing, 0.25rem) * 8)",
};

const AGENTS_PANEL_STYLE: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 6)",
  padding: "calc(var(--spacing, 0.25rem) * 6) calc(var(--spacing, 0.25rem) * 8)",
};

// ---------------------------------------------------------------------------
// Section panels — one per tab. Module-scope helpers (hoisted, never nested)
// so the shell's render stays flat and under the complexity budget.
// ---------------------------------------------------------------------------

interface SkillsPanelProps {
  skills: SkillRef[];
  onAgentClick: (role: string) => void;
  selectedSkillSlug: string | null;
}

function SkillsPanel({
  skills,
  onAgentClick,
  selectedSkillSlug,
}: SkillsPanelProps): React.JSX.Element {
  return (
    <div
      role="tabpanel"
      data-testid="config-section-skills"
      aria-labelledby="config-tab-id-skills"
      style={PANEL_STYLE}
    >
      <SkillsSection
        skills={skills}
        onAgentClick={onAgentClick}
        selectedSkillSlug={selectedSkillSlug}
      />
    </div>
  );
}

interface AgentsPanelProps {
  agents: AgentRef[];
  levels: Record<string, AgentLevelResult>;
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
  selectedAgent: AgentRef | null;
  selectedLevel: AgentLevelResult | null;
  /** Skills that reference the currently selected agent (for reverse cross-nav). */
  usingSkills: string[];
  /** Called when the owner clicks a using-skill chip to jump to that skill's detail. */
  onSkillClick: (slug: string) => void;
}

function AgentsPanel({
  agents,
  levels,
  selectedAgentId,
  onSelectAgent,
  selectedAgent,
  selectedLevel,
  usingSkills,
  onSkillClick,
}: AgentsPanelProps): React.JSX.Element {
  return (
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
        onSelectAgent={onSelectAgent}
      />
      {/* Agent detail — shown when a card is selected (AC-07-007.2) */}
      {selectedAgent !== null && selectedLevel !== null ? (
        <AgentDetail
          agent={selectedAgent}
          level={selectedLevel}
          usingSkills={usingSkills}
          onSkillClick={onSkillClick}
        />
      ) : null}
    </div>
  );
}

function RulesPanel({ rules }: { rules: DecisionRule[] }): React.JSX.Element {
  return (
    <div
      role="tabpanel"
      data-testid="config-section-rules"
      aria-labelledby="config-tab-id-rules"
      style={PANEL_STYLE}
    >
      <DecisionRulesSection rules={rules} />
    </div>
  );
}

function StandardsPanel({ standards }: { standards: Standard[] }): React.JSX.Element {
  return (
    <div
      role="tabpanel"
      data-testid="config-section-standards"
      aria-labelledby="config-tab-id-standards"
      style={PANEL_STYLE}
    >
      <StandardsSection standards={standards} />
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
  /** Standards from readStandards() — passed from the Server Component (WO-07-009). */
  standards?: Standard[];
}

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
 * WO-07-009: accepts `standards` prop to pass to StandardsSection.
 */
export function ConfigurationShell({
  skills = [],
  agentsData,
  rules = [],
  standards = [],
}: ConfigurationShellProps): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<SectionId>("skills");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  // Reverse cross-nav state: when jumping from agent detail → skill detail,
  // store the target skill slug; cleared when the user leaves the skills tab.
  const [crossNavSkillSlug, setCrossNavSkillSlug] = useState<string | null>(null);

  // Resolve agents + levels from the prop (empty defaults = honest zero state, AC-07-007.3)
  const agents = agentsData?.agents ?? [];
  const levels = agentsData?.levels ?? {};

  // Find the selected agent's full ref + level for the detail panel
  const selectedAgent = selectedAgentId
    ? (agents.find((a) => a.id === selectedAgentId) ?? null)
    : null;
  const selectedLevel = selectedAgentId ? (levels[selectedAgentId] ?? null) : null;

  // Derive using-skills for the selected agent: invert skills[].agents (derive-don't-sync).
  // Returns only the slugs of skills that explicitly reference the selected agent.
  const usingSkills: string[] =
    selectedAgentId !== null
      ? skills.filter((s) => (s.agents ?? []).includes(selectedAgentId)).map((s) => s.slug)
      : [];

  // Reset agent selection when leaving the agents tab
  function handleSectionChange(id: SectionId): void {
    if (id !== "agents") setSelectedAgentId(null);
    if (id !== "skills") setCrossNavSkillSlug(null);
    setActiveSection(id);
  }

  // Forward cross-navigation (FRD-07 EARS): clicking an agent chip in a skill's
  // mini-flow jumps to the agents tab with that agent's detail open.
  function handleAgentCrossNav(role: string): void {
    setSelectedAgentId(role);
    setActiveSection("agents");
  }

  // Reverse cross-navigation (FRD-07 EARS): clicking a using-skill chip in an
  // agent's detail jumps to the skills tab with that skill's detail open.
  function handleSkillCrossNav(slug: string): void {
    setCrossNavSkillSlug(slug);
    setActiveSection("skills");
  }

  return (
    <div data-testid="config-shell" style={SHELL_STYLE}>
      {/* Page header — PageTitle (DR-062: ONE title block) */}
      <div style={HEADER_STYLE}>
        <PageTitle
          icon="ti-settings"
          title="Configuración"
          subtitle="Vista de lectura de la fábrica: habilidades, agentes, reglas y estándares."
        />
      </div>

      {/* Tab bar — always visible (AC-07-005.1) */}
      <SectionTabs activeSection={activeSection} onSectionChange={handleSectionChange} />

      {/* Active section panel — only one mounted at a time (AC-07-005.2) */}
      {activeSection === "skills" ? (
        <SkillsPanel
          skills={skills}
          onAgentClick={handleAgentCrossNav}
          selectedSkillSlug={crossNavSkillSlug}
        />
      ) : activeSection === "agents" ? (
        <AgentsPanel
          agents={agents}
          levels={levels}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
          selectedAgent={selectedAgent}
          selectedLevel={selectedLevel}
          usingSkills={usingSkills}
          onSkillClick={handleSkillCrossNav}
        />
      ) : activeSection === "rules" ? (
        <RulesPanel rules={rules} />
      ) : (
        <StandardsPanel standards={standards} />
      )}
    </div>
  );
}
