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

import type { RunsIn, SkillRef } from "@/lib/reference";

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

const GROUP_HEADING_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
  margin: 0,
};

const CARDS_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
};

const CARD_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  borderRadius: "var(--radius, 0.375rem)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  background: "var(--color-surface-raised, Canvas)",
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
  color: "inherit",
  transition: "border-color var(--duration-fast, 150ms) var(--easing-standard, ease)",
};

const CARD_NAME_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "0.8125rem",
  fontWeight: 700,
  color: "var(--color-accent, currentColor)",
  margin: 0,
};

const CARD_DESC_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text-muted, currentColor)",
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
// SkillCard subcomponent
// ---------------------------------------------------------------------------

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
      style={CARD_STYLE}
      onClick={() => onSelect(skill)}
    >
      <span data-testid="skill-card-name" style={CARD_NAME_STYLE}>
        {skillName}
      </span>
      <span data-testid="skill-card-description" style={CARD_DESC_STYLE}>
        {skill.description}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// SkillGroup subcomponent
// ---------------------------------------------------------------------------

interface SkillGroupProps {
  groupId: GroupId;
  skills: SkillRef[];
  onSelect: (skill: SkillRef) => void;
}

function SkillGroup({ groupId, skills, onSelect }: SkillGroupProps): React.JSX.Element {
  return (
    <div data-testid={`skill-group-${groupId}`} style={GROUP_STYLE}>
      <h3 data-testid={`skill-group-${groupId}-heading`} style={GROUP_HEADING_STYLE}>
        {GROUP_LABELS[groupId]}
      </h3>
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
