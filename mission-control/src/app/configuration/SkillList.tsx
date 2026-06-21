"use client";
/**
 * WO-07-006 — SkillList (CMP-07-skill-list)
 *
 * Skills section list view: two groups (En la fábrica / En el proyecto),
 * derived from runsIn. Each card shows name (/pandacorp:<slug>) + description.
 * Clicking a card calls onSelect with the full SkillRef.
 *
 * AC-07-006.1: list grouped by runsIn ("factory" | "project" | "unknown").
 * AC-07-006.2: clicking triggers onSelect callback.
 * AC-07-006.5: read-only — no edit affordance.
 *
 * Skills with runsIn="unknown" are rendered in an "others" group (no invented group).
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - Zero hardcoded colors — CSS custom properties only.
 *   - data-testid on every structural/interactive element.
 *   - Spanish copy.
 *   - shadcn/ui is not available; use pure CSS custom properties.
 *
 * Traceability:
 *   CMP-07-skill-list → FRD-07
 *   AC-07-006.1, AC-07-006.2, AC-07-006.5
 */

import type React from "react";

import { Chip } from "@/components/core/Chip/Chip";
import { ItemSlot } from "@/components/core/ItemSlot/ItemSlot";
import { Panel } from "@/components/core/Panel/Panel";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import type { RunsIn, SkillRef } from "@/lib/reference/reference";

// ---------------------------------------------------------------------------
// Group definitions (AC-07-006.1 — grouped by runsIn)
// ---------------------------------------------------------------------------

type GroupId = "factory" | "project" | "unknown";

const GROUP_LABELS: Record<GroupId, string> = {
  factory: "En la fábrica",
  project: "En el proyecto",
  unknown: "Otros",
};

const GROUP_ORDER: GroupId[] = ["factory", "project", "unknown"];

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors (FRD-13)
// ---------------------------------------------------------------------------

const LIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 8)",
};

const GROUP_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
};

const CARDS_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
  gap: "9px",
};

const CARD_BTN_STYLE: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontFamily: "inherit",
  color: "inherit",
};

const CARD_INNER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
};

const CARD_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
};

const CARD_TEXT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
  flex: 1,
  minWidth: 0,
};

const CARD_NAME_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

const CARD_NAME_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "0.8125rem",
  fontWeight: 700,
  color: "var(--color-accent-text, currentColor)",
  margin: 0,
  lineHeight: 1.2,
};

const CARD_DESC_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text2, currentColor)",
  lineHeight: 1.5,
  margin: 0,
  /* Clamp to 3 lines for uniform card height in grid */
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const EMPTY_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "calc(var(--spacing, 0.25rem) * 10)",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
  fontSize: "0.875rem",
  textAlign: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

// ---------------------------------------------------------------------------
// SkillCard subcomponent (gxSkillCard — Panel + ItemSlot wand tile)
// ---------------------------------------------------------------------------

/** Wand icon for the skill itemslot (prototype: ti-wand) */
const WAND_ICON = <i className="ti ti-wand" aria-hidden="true" style={{ fontSize: "20px" }} />;

interface SkillCardProps {
  skill: SkillRef;
  onSelect: (skill: SkillRef) => void;
}

function SkillCard({ skill, onSelect }: SkillCardProps): React.JSX.Element {
  const skillName = `/pandacorp:${skill.slug}`;
  return (
    <button
      type="button"
      data-testid={`skill-card-${skill.slug}`}
      style={CARD_BTN_STYLE}
      onClick={() => onSelect(skill)}
    >
      {/* Panel provides the RPG embossed skin (prototype .rpgpanel) */}
      <Panel variant="rpgpanel">
        <div style={CARD_INNER_STYLE}>
          <div style={CARD_HEADER_STYLE}>
            {/* 38×38 accent itemslot with wand (gxSkillCard pattern) */}
            <ItemSlot
              icon={WAND_ICON}
              size={38}
              tone="accent"
              aria-label={`Habilidad ${skillName}`}
            />
            <div style={CARD_TEXT_STYLE}>
              <span style={CARD_NAME_ROW_STYLE}>
                <span data-testid="skill-card-name" style={CARD_NAME_STYLE}>
                  {skillName}
                </span>
                {/* "interno" flag — internal skills are invoked by another skill (EARS) */}
                {skill.internal && (
                  <span data-testid={`skill-card-internal-${skill.slug}`} title="Skill interno">
                    <Chip tone="secondary">interno</Chip>
                  </span>
                )}
              </span>
              <span data-testid="skill-card-description" style={CARD_DESC_STYLE}>
                {skill.description}
              </span>
            </div>
          </div>
        </div>
      </Panel>
    </button>
  );
}

// ---------------------------------------------------------------------------
// SkillGroup subcomponent (uses SectionHead — the ONE shared section heading)
// ---------------------------------------------------------------------------

interface SkillGroupProps {
  groupId: GroupId;
  skills: SkillRef[];
  onSelect: (skill: SkillRef) => void;
}

function SkillGroup({ groupId, skills, onSelect }: SkillGroupProps): React.JSX.Element {
  return (
    <div data-testid={`skill-group-${groupId}`} style={GROUP_STYLE}>
      {/* SectionHead = the shared section heading (DR-062, CMP-13-sectionhead) */}
      <div data-testid={`skill-group-${groupId}-heading`}>
        <SectionHead label={GROUP_LABELS[groupId]} count={skills.length} />
      </div>
      <div style={CARDS_GRID_STYLE}>
        {skills.map((skill) => (
          <SkillCard key={skill.slug} skill={skill} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SkillListProps {
  /** All skills to display, grouped internally by runsIn. */
  skills: SkillRef[];
  /** Called when the user clicks a skill card. */
  onSelect: (skill: SkillRef) => void;
}

// ---------------------------------------------------------------------------
// SkillList component (CMP-07-skill-list)
// ---------------------------------------------------------------------------

/**
 * Skills section list view: grouped by runsIn.
 *
 * Two primary groups:
 *   - "factory"  → "En la fábrica"
 *   - "project"  → "En el proyecto"
 *   - "unknown"  → "Otros" (when runsIn could not be inferred)
 *
 * Groups are only rendered when they have at least one skill.
 * Empty list → shows empty state (data-testid="skill-list-empty").
 *
 * All cards are buttons (keyboard accessible, AC-07-006.2).
 * No edit affordance (AC-07-006.5).
 */
export function SkillList({ skills, onSelect }: SkillListProps): React.JSX.Element {
  if (skills.length === 0) {
    return (
      <div data-testid="skill-list" style={LIST_STYLE}>
        <div data-testid="skill-list-empty" style={EMPTY_STYLE}>
          <span>No hay habilidades registradas.</span>
          <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>
            Las habilidades se derivan de plugin/skills/.
          </span>
        </div>
      </div>
    );
  }

  // Partition skills by runsIn group.
  const grouped: Record<GroupId, SkillRef[]> = {
    factory: [],
    project: [],
    unknown: [],
  };

  for (const skill of skills) {
    const gid = skill.runsIn as RunsIn;
    if (gid === "factory" || gid === "project") {
      grouped[gid].push(skill);
    } else {
      grouped.unknown.push(skill);
    }
  }

  // Only render groups that have skills.
  const activeGroups = GROUP_ORDER.filter((gid) => grouped[gid].length > 0);

  return (
    <div data-testid="skill-list" style={LIST_STYLE}>
      {activeGroups.map((gid) => (
        <SkillGroup key={gid} groupId={gid} skills={grouped[gid]} onSelect={onSelect} />
      ))}
    </div>
  );
}
