/**
 * WO-07-006 — Skills section: list + detail + mini-flow tests
 *
 * Traceability:
 *   AC-07-006.1 — Skills section SHALL list each skill with name (/pandacorp:<slug>)
 *                 and real description, grouped by runsIn.
 *   AC-07-006.2 — WHEN owner clicks a skill, SHALL show its detail:
 *                 what it is for, where it runs, what it produces.
 *   AC-07-006.3 — Skill detail SHALL show a mini-flow: chips of agents it uses,
 *                 colored per agent (FRD-13 per-agent tokens), with arrows.
 *   AC-07-006.4 — WHERE a skill has no machine-readable flow, diagram degrades
 *                 to the ordered agent list (no invented steps).
 *   AC-07-006.5 — Content is read-only; no edit affordance.
 *
 * Stack: Vitest + @testing-library/react + jsdom
 *
 * Components under test:
 *   CMP-07-skill-list    → SkillList (app/configuration/SkillList.tsx)
 *   CMP-07-skill-detail  → SkillDetail (app/configuration/SkillDetail.tsx)
 *   CMP-07-flow-diagram  → FlowDiagram (app/configuration/FlowDiagram.tsx)
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getSkillFlow } from "@/lib/manual/skill-flows";
import type { SkillRef } from "@/lib/reference/reference";

import { FlowDiagram } from "../FlowDiagram";
import { SkillDetail } from "../SkillDetail";
import { SkillList } from "../SkillList";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_FACTORY_SKILL: SkillRef = {
  slug: "explore",
  description: "Explores a fuzzy idea in the factory context, helping the owner think.",
  runsIn: "factory",
  body: `# /pandacorp:explore

Runs in the factory context.

## Agents used
- researcher
- product-manager

## What it produces
A refined idea ready to capture.`,
};

const FIXTURE_PROJECT_SKILL: SkillRef = {
  slug: "blueprint",
  description: "Creates the architecture blueprint inside the project.",
  runsIn: "project",
  body: `# /pandacorp:blueprint

Runs inside the project after /pandacorp:design.

## Agents used
- architect
- backend-dev`,
};

const FIXTURE_UNKNOWN_SKILL: SkillRef = {
  slug: "memory",
  description: "Manages the factory memory cross-project.",
  runsIn: "unknown",
  body: "# /pandacorp:memory\n\nMaintains lessons.",
};

const FIXTURE_NO_FLOW_SKILL: SkillRef = {
  slug: "no-flow",
  description: "A skill with no declared agents flow.",
  runsIn: "factory",
  body: "# /pandacorp:no-flow\n\nThis skill has no agents section.",
};

const ALL_SKILLS: SkillRef[] = [
  FIXTURE_FACTORY_SKILL,
  FIXTURE_PROJECT_SKILL,
  FIXTURE_UNKNOWN_SKILL,
];

// ---------------------------------------------------------------------------
// AC-07-006.1 — SkillList renders grouped by runsIn
// ---------------------------------------------------------------------------

describe("frd-07: SkillList — AC-07-006.1 list grouped by runsIn", () => {
  it("frd-07: AC-07-006.1 — renders the skill list container", () => {
    render(<SkillList skills={ALL_SKILLS} onSelect={() => {}} />);
    expect(screen.getByTestId("skill-list")).toBeDefined();
  });

  it("frd-07: AC-07-006.1 — renders a 'En la fábrica' group header", () => {
    render(<SkillList skills={ALL_SKILLS} onSelect={() => {}} />);
    expect(screen.getByTestId("skill-group-factory")).toBeDefined();
    expect(screen.getByTestId("skill-group-factory-heading")).toBeDefined();
    expect(screen.getByTestId("skill-group-factory-heading").textContent).toContain("fábrica");
  });

  it("frd-07: AC-07-006.1 — renders a 'En el proyecto' group header", () => {
    render(<SkillList skills={ALL_SKILLS} onSelect={() => {}} />);
    expect(screen.getByTestId("skill-group-project")).toBeDefined();
    expect(screen.getByTestId("skill-group-project-heading")).toBeDefined();
    expect(screen.getByTestId("skill-group-project-heading").textContent).toContain("proyecto");
  });

  it("frd-07: AC-07-006.1 — factory skill appears in factory group", () => {
    render(<SkillList skills={ALL_SKILLS} onSelect={() => {}} />);
    const group = screen.getByTestId("skill-group-factory");
    expect(within(group).getByTestId("skill-card-explore")).toBeDefined();
  });

  it("frd-07: AC-07-006.1 — project skill appears in project group", () => {
    render(<SkillList skills={ALL_SKILLS} onSelect={() => {}} />);
    const group = screen.getByTestId("skill-group-project");
    expect(within(group).getByTestId("skill-card-blueprint")).toBeDefined();
  });

  it("frd-07: AC-07-006.1 — skill name is rendered as /pandacorp:<slug>", () => {
    render(<SkillList skills={ALL_SKILLS} onSelect={() => {}} />);
    const card = screen.getByTestId("skill-card-explore");
    expect(within(card).getByTestId("skill-card-name").textContent).toBe("/pandacorp:explore");
  });

  it("frd-07: AC-07-006.1 — skill description is rendered on the card", () => {
    render(<SkillList skills={ALL_SKILLS} onSelect={() => {}} />);
    const card = screen.getByTestId("skill-card-explore");
    expect(within(card).getByTestId("skill-card-description").textContent).toBe(
      FIXTURE_FACTORY_SKILL.description,
    );
  });

  it("frd-07: AC-07-006.1 — unknown runsIn skill renders outside factory/project groups (or in its own group)", () => {
    render(<SkillList skills={ALL_SKILLS} onSelect={() => {}} />);
    // unknown should still appear somewhere in the list
    expect(screen.getByTestId("skill-card-memory")).toBeDefined();
  });

  it("frd-07: AC-07-006.1 — unknown runsIn skill does NOT appear in factory group", () => {
    render(<SkillList skills={ALL_SKILLS} onSelect={() => {}} />);
    const group = screen.getByTestId("skill-group-factory");
    expect(within(group).queryByTestId("skill-card-memory")).toBeNull();
  });

  it("frd-07: AC-07-006.1 — unknown runsIn skill does NOT appear in project group", () => {
    render(<SkillList skills={ALL_SKILLS} onSelect={() => {}} />);
    const group = screen.getByTestId("skill-group-project");
    expect(within(group).queryByTestId("skill-card-memory")).toBeNull();
  });

  it("frd-07: AC-07-006.1 — empty skills list renders empty state", () => {
    render(<SkillList skills={[]} onSelect={() => {}} />);
    expect(screen.getByTestId("skill-list-empty")).toBeDefined();
  });

  it("frd-07: AC-07-006.1 — factory group is absent when no factory skills", () => {
    render(<SkillList skills={[FIXTURE_PROJECT_SKILL]} onSelect={() => {}} />);
    expect(screen.queryByTestId("skill-group-factory")).toBeNull();
  });

  it("frd-07: AC-07-006.1 — project group is absent when no project skills", () => {
    render(<SkillList skills={[FIXTURE_FACTORY_SKILL]} onSelect={() => {}} />);
    expect(screen.queryByTestId("skill-group-project")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-07-006.2 — Clicking a skill shows its detail
// ---------------------------------------------------------------------------

describe("frd-07: SkillList — AC-07-006.2 click triggers onSelect callback", () => {
  it("frd-07: AC-07-006.2 — clicking a skill card calls onSelect with that SkillRef", () => {
    const selected: SkillRef[] = [];
    render(
      <SkillList
        skills={ALL_SKILLS}
        onSelect={(s) => {
          selected.push(s);
        }}
      />,
    );
    fireEvent.click(screen.getByTestId("skill-card-explore"));
    expect(selected.length).toBe(1);
    expect(selected[0]?.slug).toBe("explore");
  });

  it("frd-07: AC-07-006.2 — clicking a project skill calls onSelect with that SkillRef", () => {
    const selected: SkillRef[] = [];
    render(
      <SkillList
        skills={ALL_SKILLS}
        onSelect={(s) => {
          selected.push(s);
        }}
      />,
    );
    fireEvent.click(screen.getByTestId("skill-card-blueprint"));
    expect(selected.length).toBe(1);
    expect(selected[0]?.slug).toBe("blueprint");
  });

  it("frd-07: AC-07-006.2 — skill card is a button (keyboard accessible)", () => {
    render(<SkillList skills={ALL_SKILLS} onSelect={() => {}} />);
    const card = screen.getByTestId("skill-card-explore");
    expect(card.tagName.toLowerCase()).toBe("button");
  });
});

// ---------------------------------------------------------------------------
// AC-07-006.2 — SkillDetail shows purpose, where it runs, what it produces
// ---------------------------------------------------------------------------

describe("frd-07: SkillDetail — AC-07-006.2 detail view content", () => {
  it("frd-07: AC-07-006.2 — renders the detail container", () => {
    render(<SkillDetail skill={FIXTURE_FACTORY_SKILL} onBack={() => {}} />);
    expect(screen.getByTestId("skill-detail")).toBeDefined();
  });

  it("frd-07: AC-07-006.2 — shows the skill name as /pandacorp:<slug>", () => {
    render(<SkillDetail skill={FIXTURE_FACTORY_SKILL} onBack={() => {}} />);
    expect(screen.getByTestId("skill-detail-name").textContent).toBe("/pandacorp:explore");
  });

  it("frd-07: AC-07-006.2 — shows what the skill is for (curated explainer, else description)", () => {
    render(<SkillDetail skill={FIXTURE_FACTORY_SKILL} onBack={() => {}} />);
    // FRD-08: a curated Spanish explainer (for-dummies) wins over the frontmatter description.
    const expected =
      getSkillFlow(FIXTURE_FACTORY_SKILL.slug)?.explainer ?? FIXTURE_FACTORY_SKILL.description;
    expect(screen.getByTestId("skill-detail-description").textContent).toContain(expected);
  });

  it("frd-07: AC-07-006.2 — shows where it runs (factory → Spanish label)", () => {
    render(<SkillDetail skill={FIXTURE_FACTORY_SKILL} onBack={() => {}} />);
    const runsInEl = screen.getByTestId("skill-detail-runs-in");
    expect(runsInEl.textContent).toContain("fábrica");
  });

  it("frd-07: AC-07-006.2 — shows where it runs (project → Spanish label)", () => {
    render(<SkillDetail skill={FIXTURE_PROJECT_SKILL} onBack={() => {}} />);
    const runsInEl = screen.getByTestId("skill-detail-runs-in");
    expect(runsInEl.textContent).toContain("proyecto");
  });

  it("frd-07: AC-07-006.2 — shows where it runs (unknown → Spanish label)", () => {
    render(<SkillDetail skill={FIXTURE_UNKNOWN_SKILL} onBack={() => {}} />);
    const runsInEl = screen.getByTestId("skill-detail-runs-in");
    expect(runsInEl.textContent).toBeTruthy();
    expect((runsInEl.textContent ?? "").length).toBeGreaterThan(0);
  });

  it("frd-07: AC-07-006.2 — has a back button that calls onBack", () => {
    const calls: number[] = [];
    render(
      <SkillDetail
        skill={FIXTURE_FACTORY_SKILL}
        onBack={() => {
          calls.push(1);
        }}
      />,
    );
    const backBtn = screen.getByTestId("skill-detail-back");
    fireEvent.click(backBtn);
    expect(calls.length).toBe(1);
  });

  it("frd-07: AC-07-006.2 — renders the body content section", () => {
    render(<SkillDetail skill={FIXTURE_FACTORY_SKILL} onBack={() => {}} />);
    expect(screen.getByTestId("skill-detail-body")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-07-006.3 — FlowDiagram shows agent chips colored per agent
// ---------------------------------------------------------------------------

describe("frd-07: FlowDiagram — AC-07-006.3 agent chips colored per FRD-13 tokens", () => {
  it("frd-07: AC-07-006.3 — renders the flow diagram container", () => {
    render(<FlowDiagram body={FIXTURE_FACTORY_SKILL.body} />);
    expect(screen.getByTestId("flow-diagram")).toBeDefined();
  });

  it("frd-07: AC-07-006.3 — renders agent chips for agents found in body", () => {
    render(<FlowDiagram body={FIXTURE_FACTORY_SKILL.body} />);
    const chips = screen.getAllByTestId(/^flow-agent-chip-/);
    expect(chips.length).toBeGreaterThan(0);
  });

  it("frd-07: AC-07-006.3 — renders a chip for 'researcher' agent", () => {
    render(<FlowDiagram body={FIXTURE_FACTORY_SKILL.body} />);
    expect(screen.getByTestId("flow-agent-chip-researcher")).toBeDefined();
  });

  it("frd-07: AC-07-006.3 — renders a chip for 'product-manager' agent", () => {
    render(<FlowDiagram body={FIXTURE_FACTORY_SKILL.body} />);
    expect(screen.getByTestId("flow-agent-chip-product-manager")).toBeDefined();
  });

  it("frd-07: AC-07-006.3 — researcher chip uses the FRD-13 per-agent token (no hardcoded color)", () => {
    render(<FlowDiagram body={FIXTURE_FACTORY_SKILL.body} />);
    const chip = screen.getByTestId("flow-agent-chip-researcher");
    // The chip must have a data-agent-color attribute referencing the CSS token key
    const tokenKey = chip.getAttribute("data-agent-color");
    expect(tokenKey).toBeTruthy();
    expect(tokenKey).toBe("--color-agent-researcher");
  });

  it("frd-07: AC-07-006.3 — product-manager chip uses the FRD-13 per-agent token", () => {
    render(<FlowDiagram body={FIXTURE_FACTORY_SKILL.body} />);
    const chip = screen.getByTestId("flow-agent-chip-product-manager");
    const tokenKey = chip.getAttribute("data-agent-color");
    expect(tokenKey).toBe("--color-agent-product-manager");
  });

  it("frd-07: AC-07-006.3 — chips are rendered in order (researcher before product-manager)", () => {
    render(<FlowDiagram body={FIXTURE_FACTORY_SKILL.body} />);
    const chips = screen.getAllByTestId(/^flow-agent-chip-/);
    expect(chips[0]?.getAttribute("data-testid")).toBe("flow-agent-chip-researcher");
    expect(chips[1]?.getAttribute("data-testid")).toBe("flow-agent-chip-product-manager");
  });

  it("frd-07: AC-07-006.3 — renders arrow connectors between chips", () => {
    render(<FlowDiagram body={FIXTURE_FACTORY_SKILL.body} />);
    // with 2+ agents, there should be at least one arrow connector
    const arrows = screen.getAllByTestId(/^flow-arrow/);
    expect(arrows.length).toBeGreaterThan(0);
  });

  it("frd-07: AC-07-006.3 — blueprint skill chips match its agents (architect, backend-dev)", () => {
    render(<FlowDiagram body={FIXTURE_PROJECT_SKILL.body} />);
    expect(screen.getByTestId("flow-agent-chip-architect")).toBeDefined();
    expect(screen.getByTestId("flow-agent-chip-backend-dev")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-07-006.4 — Degrade to ordered agent list when no machine-readable flow
// ---------------------------------------------------------------------------

describe("frd-07: FlowDiagram — AC-07-006.4 degrade gracefully when no flow declared", () => {
  it("frd-07: AC-07-006.4 — renders container even when no agents in body", () => {
    render(<FlowDiagram body={FIXTURE_NO_FLOW_SKILL.body} />);
    expect(screen.getByTestId("flow-diagram")).toBeDefined();
  });

  it("frd-07: AC-07-006.4 — shows a no-flow fallback element when no agents found", () => {
    render(<FlowDiagram body={FIXTURE_NO_FLOW_SKILL.body} />);
    expect(screen.getByTestId("flow-diagram-empty")).toBeDefined();
  });

  it("frd-07: AC-07-006.4 — no-flow fallback has descriptive text (no invented steps)", () => {
    render(<FlowDiagram body={FIXTURE_NO_FLOW_SKILL.body} />);
    const empty = screen.getByTestId("flow-diagram-empty");
    expect((empty.textContent ?? "").length).toBeGreaterThan(0);
  });

  it("frd-07: AC-07-006.4 — no chips or arrows rendered when body has no agents section", () => {
    render(<FlowDiagram body={FIXTURE_NO_FLOW_SKILL.body} />);
    expect(screen.queryAllByTestId(/^flow-agent-chip-/).length).toBe(0);
    expect(screen.queryAllByTestId(/^flow-arrow/).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-07-006.5 — Read-only: no edit affordance
// ---------------------------------------------------------------------------

describe("frd-07: SkillDetail — AC-07-006.5 read-only (no edit affordance)", () => {
  it("frd-07: AC-07-006.5 — skill detail has no input elements", () => {
    render(<SkillDetail skill={FIXTURE_FACTORY_SKILL} onBack={() => {}} />);
    expect(screen.queryAllByRole("textbox").length).toBe(0);
  });

  it("frd-07: AC-07-006.5 — skill detail has no edit button", () => {
    render(<SkillDetail skill={FIXTURE_FACTORY_SKILL} onBack={() => {}} />);
    expect(screen.queryByTestId("skill-detail-edit")).toBeNull();
  });

  it("frd-07: AC-07-006.5 — skill list has no edit affordance on cards", () => {
    render(<SkillList skills={ALL_SKILLS} onSelect={() => {}} />);
    expect(screen.queryAllByRole("textbox").length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: SkillDetail shows FlowDiagram
// ---------------------------------------------------------------------------

describe("frd-07: SkillDetail integration — mini-flow embedded in detail view", () => {
  it("frd-07: skill detail includes the flow diagram section", () => {
    render(<SkillDetail skill={FIXTURE_FACTORY_SKILL} onBack={() => {}} />);
    expect(screen.getByTestId("skill-detail-flow")).toBeDefined();
  });

  it("frd-08: the interactive flow graph is visible inside skill detail", () => {
    render(<SkillDetail skill={FIXTURE_FACTORY_SKILL} onBack={() => {}} />);
    // A skill with a curated flow renders the interactive FlowGraph inside the flow section.
    const flowSection = screen.getByTestId("skill-detail-flow");
    expect(within(flowSection).getByTestId("flow-graph")).toBeDefined();
  });

  it("frd-08: a clickable agent node (researcher) is visible inside the flow graph", () => {
    render(<SkillDetail skill={FIXTURE_FACTORY_SKILL} onBack={() => {}} />);
    // explore's flow invokes the researcher agent → a clickable flow-call node.
    expect(screen.getByTestId("flow-call-agent-researcher")).toBeDefined();
  });

  it("frd-07: skill detail with no-flow skill shows flow-diagram-empty inside detail", () => {
    render(<SkillDetail skill={FIXTURE_NO_FLOW_SKILL} onBack={() => {}} />);
    expect(screen.getByTestId("flow-diagram-empty")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Design tokens: no hardcoded colors in chips
// ---------------------------------------------------------------------------

describe("frd-07: FlowDiagram — design tokens compliance", () => {
  it("frd-07: agent chip uses data-agent-color attribute (never inline hex/rgb)", () => {
    render(<FlowDiagram body={FIXTURE_FACTORY_SKILL.body} />);
    const chips = screen.getAllByTestId(/^flow-agent-chip-/);
    for (const chip of chips) {
      const tokenKey = chip.getAttribute("data-agent-color");
      // Must reference a CSS variable key
      expect(tokenKey).toMatch(/^--color-agent-/);
    }
  });
});
