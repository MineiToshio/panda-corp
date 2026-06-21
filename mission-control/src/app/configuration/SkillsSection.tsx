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
   * Controlled selection (FRD-07 EARS, reverse cross-nav): when provided, the
   * open skill is driven by the parent (the shell sets it when the owner clicks a
   * using-skill chip in an agent's detail). When `undefined`, the section is
   * uncontrolled and owns its own list↔detail state.
   */
  selectedSlug?: string | null;
  /**
   * Called when the selected skill changes (controlled mode): the slug of the
   * skill to open, or `null` when returning to the list. Required to keep the
   * parent's `selectedSlug` in sync (back button, picking another skill).
   */
  onSelectedSlugChange?: (slug: string | null) => void;
}

// ---------------------------------------------------------------------------
// SkillsSection component
// ---------------------------------------------------------------------------

/**
 * Owns the list↔detail navigation for the Skills tab panel.
 *
 * Uncontrolled (default): owns its own `selectedSkill` state.
 *   selectedSkill === null → SkillList
 *   selectedSkill !== null → SkillDetail (with back button to return to list)
 *
 * Controlled (when `selectedSlug` is provided): the open skill is resolved from
 * the parent-supplied slug and changes flow back through `onSelectedSlugChange`.
 * This powers the reverse cross-navigation (agent detail → skill detail).
 */
export function SkillsSection({
  skills,
  onAgentClick,
  selectedSlug,
  onSelectedSlugChange,
}: SkillsSectionProps): React.JSX.Element {
  const [internalSelectedSlug, setInternalSelectedSlug] = useState<string | null>(null);

  // Controlled when the parent passes `selectedSlug`; otherwise self-managed.
  const isControlled = selectedSlug !== undefined;
  const activeSlug = isControlled ? selectedSlug : internalSelectedSlug;
  const selectedSkill = activeSlug ? (skills.find((s) => s.slug === activeSlug) ?? null) : null;

  function select(slug: string | null): void {
    if (!isControlled) setInternalSelectedSlug(slug);
    onSelectedSlugChange?.(slug);
  }

  return (
    <div data-testid="skills-section">
      {selectedSkill === null ? (
        <SkillList skills={skills} onSelect={(skill) => select(skill.slug)} />
      ) : (
        <SkillDetail
          skill={selectedSkill}
          onBack={() => select(null)}
          onAgentClick={onAgentClick}
        />
      )}
    </div>
  );
}
