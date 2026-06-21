"use client";
/**
 * WO-07-006 — SkillsSection (CMP-07-skill-list + CMP-07-skill-detail coordinator)
 *
 * Client Component: owns the list↔detail navigation state for the Skills tab.
 *
 * State:
 *   - selectedSkill: SkillRef | null
 *     null  → show SkillList (all skills grouped by runsIn)
 *     skill → show SkillDetail (detail + mini-flow for that skill)
 *
 * AC-07-006.1: list grouped by runsIn.
 * AC-07-006.2: click → detail view.
 * AC-07-006.3: detail view has FlowDiagram.
 * AC-07-006.4: FlowDiagram degrades gracefully when no agents declared.
 * AC-07-006.5: read-only; no edit affordance.
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - Zero hardcoded colors — CSS custom properties only.
 *   - data-testid on root.
 *   - Spanish copy.
 *
 * Traceability:
 *   CMP-07-skill-list + CMP-07-skill-detail → FRD-07
 *   AC-07-006.1..5
 */

import type React from "react";
import { useState } from "react";

import type { AgentRole } from "@/app/_design/tokens/tokens";
import type { SkillRef } from "@/lib/reference/reference";
import { SkillDetail } from "./SkillDetail";
import { SkillList } from "./SkillList";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SkillsSectionProps {
  /** Skills catalog from readSkills() — passed from the Server Component. */
  skills: SkillRef[];
  /**
   * Cross-navigation (FRD-07 EARS): called with an agent role when the owner
   * clicks an agent chip in a skill's mini-flow, to jump to that agent's detail.
   */
  onAgentClick?: (role: AgentRole) => void;
  /**
   * Reverse cross-navigation (FRD-07 EARS): when set, opens the detail of the
   * skill with this slug immediately (used when the owner jumps from an agent
   * detail's "Usado por" chip to the corresponding skill's detail).
   */
  selectedSkillSlug?: string | null;
}

// ---------------------------------------------------------------------------
// SkillsSection component
// ---------------------------------------------------------------------------

/**
 * Owns the list↔detail navigation for the Skills tab panel.
 *
 * selectedSkill === null → SkillList
 * selectedSkill !== null → SkillDetail (with back button to return to list)
 */
export function SkillsSection({
  skills,
  onAgentClick,
  selectedSkillSlug,
}: SkillsSectionProps): React.JSX.Element {
  const [localSelectedSkill, setLocalSelectedSkill] = useState<SkillRef | null>(null);

  // Derive the displayed skill: controlled (from cross-nav) takes precedence over local selection.
  // Derive-don't-sync: compute during render, no useEffect mirror (react.md).
  const controlledSkill =
    selectedSkillSlug != null ? (skills.find((s) => s.slug === selectedSkillSlug) ?? null) : null;

  const selectedSkill = controlledSkill ?? localSelectedSkill;

  return (
    <div data-testid="skills-section">
      {selectedSkill === null ? (
        <SkillList skills={skills} onSelect={(skill) => setLocalSelectedSkill(skill)} />
      ) : (
        <SkillDetail
          skill={selectedSkill}
          onBack={() => setLocalSelectedSkill(null)}
          onAgentClick={onAgentClick}
        />
      )}
    </div>
  );
}
