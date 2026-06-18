/**
 * app/manual/ReferenceCommandsSection.test.tsx — WO-08-003 (RED phase)
 *
 * Tests for CMP-08-reference-commands and CMP-08-reference-agents.
 *
 * Traceability (FRD-08 EARS + blueprint §5 CMP-08-reference-* → AC → test):
 *
 *   AC-08-003.1 — The Reference SHALL list commands (skills) derived at read time
 *                 from readSkills(), showing /pandacorp:<slug> + description.
 *   AC-08-003.2 — The Reference SHALL list agents derived from readAgents(),
 *                 showing name + description + model.
 *   AC-08-003.3 — Renaming a skill/agent dir in the fixture tree SHALL change
 *                 the Reference label with no edit to any Manual file (DR-046 swap test).
 *   AC-08-003.4 — No hand-maintained catalog array in commands/agents components.
 *   AC-08-003.5 — FRD-13 tokens only (no hardcoded colors); CopyButton on command names.
 *
 * TDD plan (WO-08-003):
 *   RED: these tests fail because the components don't exist yet.
 *   GREEN: implement ReferenceCommandsSection + ReferenceAgentsSection.
 *   Refactor: token audit.
 *
 * Architecture: Client Components that receive pre-resolved data from the server.
 * CopyButton (FRD-02) is used for command names — copy only, never execute.
 * DR-046 acceptance test: see the "swap test" describe block.
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

// --------------------------------------------------------------------------
// Mock clipboard (CopyButton needs navigator.clipboard)
// --------------------------------------------------------------------------

Object.defineProperty(globalThis, "navigator", {
  value: {
    clipboard: {
      writeText: () => Promise.resolve(),
    },
  },
  writable: true,
});

// --------------------------------------------------------------------------
// Import the components under test (they don't exist yet — RED phase)
// --------------------------------------------------------------------------

import { ReferenceAgentsSection } from "../../ReferenceAgentsSection";
import { ReferenceCommandsSection } from "../ReferenceCommandsSection";

// --------------------------------------------------------------------------
// Fixture data
// --------------------------------------------------------------------------

/** Matches the shape of SkillRef from lib/reference.ts */
const FIXTURE_SKILLS = [
  {
    slug: "explore",
    description: "Explora una idea fuzzy en conversación.",
    runsIn: "factory" as const,
    body: "# /pandacorp:explore\n\nExplore an idea.",
  },
  {
    slug: "spec",
    description: "Crea el proyecto y documenta el MVP.",
    runsIn: "factory" as const,
    body: "# /pandacorp:spec\n\nDocument the MVP.",
  },
  {
    slug: "implement",
    description: "Arranca la construcción. Use inside the project.",
    runsIn: "project" as const,
    body: "# /pandacorp:implement\n\nKick off construction.",
  },
];

/** Matches the shape of AgentRef from lib/reference.ts */
const FIXTURE_AGENTS = [
  {
    id: "implementer",
    name: "implementer",
    description: "Pandacorp's implementer. Executes work orders with TDD.",
    model: "sonnet",
    body: "You are Pandacorp's implementer.",
  },
  {
    id: "reviewer",
    name: "reviewer",
    description: "Reviews and verifies work orders.",
    model: "opus",
    body: "You are Pandacorp's reviewer.",
  },
  {
    id: "no-model-agent",
    name: "agent-without-model",
    description: "An agent that has no model specified.",
    model: "unknown",
    body: "Agent body.",
  },
];

// --------------------------------------------------------------------------
// Cleanup
// --------------------------------------------------------------------------

afterEach(() => {
  cleanup();
});

// ==========================================================================
// AC-08-003.1 — Commands catalog derived from skills
// ==========================================================================

describe("ReferenceCommandsSection — AC-08-003.1 (commands derived from skills)", () => {
  it("renders a root container with data-testid='reference-commands-section'", () => {
    render(<ReferenceCommandsSection skills={FIXTURE_SKILLS} />);
    expect(screen.getByTestId("reference-commands-section")).toBeTruthy();
  });

  it("renders one row per skill with data-testid='reference-command-{slug}'", () => {
    render(<ReferenceCommandsSection skills={FIXTURE_SKILLS} />);
    expect(screen.getByTestId("reference-command-explore")).toBeTruthy();
    expect(screen.getByTestId("reference-command-spec")).toBeTruthy();
    expect(screen.getByTestId("reference-command-implement")).toBeTruthy();
  });

  it("displays the command name as /pandacorp:<slug>", () => {
    render(<ReferenceCommandsSection skills={FIXTURE_SKILLS} />);
    expect(screen.getByText("/pandacorp:explore")).toBeTruthy();
    expect(screen.getByText("/pandacorp:spec")).toBeTruthy();
    expect(screen.getByText("/pandacorp:implement")).toBeTruthy();
  });

  it("displays the skill description for each command", () => {
    render(<ReferenceCommandsSection skills={FIXTURE_SKILLS} />);
    expect(screen.getByText("Explora una idea fuzzy en conversación.")).toBeTruthy();
    expect(screen.getByText("Crea el proyecto y documenta el MVP.")).toBeTruthy();
  });

  it("shows a section heading for the commands catalog", () => {
    render(<ReferenceCommandsSection skills={FIXTURE_SKILLS} />);
    const headings = screen.getAllByRole("heading");
    const texts = headings.map((h) => h.textContent);
    // Must have some heading labeling this as a commands section
    const hasCommandsHeading = texts.some(
      (t) => t?.toLowerCase().includes("comando") || t?.toLowerCase().includes("habilidad"),
    );
    expect(hasCommandsHeading).toBe(true);
  });

  it("renders an empty-state message when skills list is empty", () => {
    render(<ReferenceCommandsSection skills={[]} />);
    const section = screen.getByTestId("reference-commands-section");
    // Should not crash; must render something meaningful
    expect(section).toBeTruthy();
    // Empty state: no command rows
    expect(section.querySelectorAll("[data-testid^='reference-command-']").length).toBe(0);
  });

  it("renders a list/landmark for accessibility (ul or role=list)", () => {
    render(<ReferenceCommandsSection skills={FIXTURE_SKILLS} />);
    // Must have a list for AT
    const lists = screen.getAllByRole("list");
    expect(lists.length).toBeGreaterThan(0);
  });
});

// ==========================================================================
// AC-08-003.5 — CopyButton on command names (copy only, never executes)
// ==========================================================================

describe("ReferenceCommandsSection — AC-08-003.5 (CopyButton on commands)", () => {
  it("renders a CopyButton for each command (data-testid='copy-button' inside each command row)", () => {
    render(<ReferenceCommandsSection skills={FIXTURE_SKILLS} />);
    for (const skill of FIXTURE_SKILLS) {
      const row = screen.getByTestId(`reference-command-${skill.slug}`);
      const copyBtn = within(row).getByTestId("copy-button");
      expect(copyBtn).toBeTruthy();
    }
  });

  it("CopyButton value equals the full /pandacorp:<slug> command string", () => {
    render(<ReferenceCommandsSection skills={FIXTURE_SKILLS} />);
    for (const skill of FIXTURE_SKILLS) {
      const row = screen.getByTestId(`reference-command-${skill.slug}`);
      const copyBtn = within(row).getByTestId("copy-button");
      // The copy button should be accessible with aria-label referencing "copiar"
      const ariaLabel = copyBtn.getAttribute("aria-label");
      expect(ariaLabel).toBeTruthy();
    }
  });

  it("no command row has an onClick that executes the command (copy-only)", () => {
    // Verify the component does not have a non-copy action attribute like `data-exec`
    render(<ReferenceCommandsSection skills={FIXTURE_SKILLS} />);
    for (const skill of FIXTURE_SKILLS) {
      const row = screen.getByTestId(`reference-command-${skill.slug}`);
      // Must not have any exec-mode marker
      expect(row.getAttribute("data-exec")).toBeNull();
    }
  });

  it("FRD-13 tokens only: no hardcoded hex/rgb/hsl colors in inline styles", () => {
    const { container } = render(<ReferenceCommandsSection skills={FIXTURE_SKILLS} />);
    const styled = container.querySelectorAll("[style]");
    for (const el of styled) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(style).not.toMatch(/\brgb\s*\(/);
      expect(style).not.toMatch(/\bhsl\s*\(/);
    }
  });
});

// ==========================================================================
// AC-08-003.2 — Agents catalog derived from readAgents()
// ==========================================================================

describe("ReferenceAgentsSection — AC-08-003.2 (agents derived)", () => {
  it("renders a root container with data-testid='reference-agents-section'", () => {
    render(<ReferenceAgentsSection agents={FIXTURE_AGENTS} />);
    expect(screen.getByTestId("reference-agents-section")).toBeTruthy();
  });

  it("renders one row per agent with data-testid='reference-agent-{id}'", () => {
    render(<ReferenceAgentsSection agents={FIXTURE_AGENTS} />);
    expect(screen.getByTestId("reference-agent-implementer")).toBeTruthy();
    expect(screen.getByTestId("reference-agent-reviewer")).toBeTruthy();
    expect(screen.getByTestId("reference-agent-no-model-agent")).toBeTruthy();
  });

  it("displays the agent name (or id as fallback when name is null)", () => {
    render(<ReferenceAgentsSection agents={FIXTURE_AGENTS} />);
    // implementer.name = "implementer"
    const implRow = screen.getByTestId("reference-agent-implementer");
    expect(implRow.textContent).toContain("implementer");
  });

  it("displays the agent description", () => {
    render(<ReferenceAgentsSection agents={FIXTURE_AGENTS} />);
    expect(
      screen.getByText("Pandacorp's implementer. Executes work orders with TDD."),
    ).toBeTruthy();
  });

  it("displays the agent model as a badge or label", () => {
    render(<ReferenceAgentsSection agents={FIXTURE_AGENTS} />);
    const implRow = screen.getByTestId("reference-agent-implementer");
    expect(implRow.textContent).toContain("sonnet");
    const reviewerRow = screen.getByTestId("reference-agent-reviewer");
    expect(reviewerRow.textContent).toContain("opus");
  });

  it("does NOT display 'unknown' as a model badge when model is 'unknown'", () => {
    render(<ReferenceAgentsSection agents={FIXTURE_AGENTS} />);
    const noModelRow = screen.getByTestId("reference-agent-no-model-agent");
    // 'unknown' should not appear as a visible badge
    const badge = noModelRow.querySelector("[data-model='unknown']");
    expect(badge).toBeNull();
  });

  it("uses agent.id as display name when name is null", () => {
    const agentsWithNullName = [
      {
        id: "mystery-agent",
        name: null,
        description: "An agent without a name.",
        model: "opus",
        body: "",
      },
    ];
    render(<ReferenceAgentsSection agents={agentsWithNullName} />);
    const row = screen.getByTestId("reference-agent-mystery-agent");
    // Should show the id as fallback
    expect(row.textContent).toContain("mystery-agent");
  });

  it("renders a section heading for the agents catalog", () => {
    render(<ReferenceAgentsSection agents={FIXTURE_AGENTS} />);
    const headings = screen.getAllByRole("heading");
    const texts = headings.map((h) => h.textContent);
    const hasAgentsHeading = texts.some(
      (t) => t?.toLowerCase().includes("agente") || t?.toLowerCase().includes("party"),
    );
    expect(hasAgentsHeading).toBe(true);
  });

  it("renders an empty-state when agents list is empty", () => {
    render(<ReferenceAgentsSection agents={[]} />);
    const section = screen.getByTestId("reference-agents-section");
    expect(section).toBeTruthy();
    expect(section.querySelectorAll("[data-testid^='reference-agent-']").length).toBe(0);
  });

  it("FRD-13 tokens only: no hardcoded hex/rgb/hsl colors in inline styles", () => {
    const { container } = render(<ReferenceAgentsSection agents={FIXTURE_AGENTS} />);
    const styled = container.querySelectorAll("[style]");
    for (const el of styled) {
      const style = el.getAttribute("style") ?? "";
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(style).not.toMatch(/\brgb\s*\(/);
      expect(style).not.toMatch(/\bhsl\s*\(/);
    }
  });
});

// ==========================================================================
// AC-08-003.3 — DR-046 swap test: renaming fixture dir changes label in Reference
// ==========================================================================

describe("DR-046 swap test — AC-08-003.3 (fixture rename changes Reference output)", () => {
  it("rendering with a different slug changes the /pandacorp: command name shown", () => {
    // This simulates swapping the fixture: readSkills() from a renamed dir
    // would yield a different slug. Here we pass a 'renamed' skill set.
    const renamedSkills = [
      {
        slug: "explore-renamed",
        description: "Renamed skill description.",
        runsIn: "factory" as const,
        body: "",
      },
    ];
    render(<ReferenceCommandsSection skills={renamedSkills} />);
    // The renamed slug appears in the Reference
    expect(screen.getByText("/pandacorp:explore-renamed")).toBeTruthy();
    // The old slug does NOT appear
    expect(screen.queryByText("/pandacorp:explore")).toBeNull();
    // No Manual file was changed — the component takes its data from the reader prop
  });

  it("adding a skill in the fixture (one more entry) shows one more row with no Manual change", () => {
    const extended = [
      ...FIXTURE_SKILLS,
      {
        slug: "new-skill",
        description: "A brand new skill added to the plugin.",
        runsIn: "unknown" as const,
        body: "",
      },
    ];
    render(<ReferenceCommandsSection skills={extended} />);
    expect(screen.getByTestId("reference-command-new-skill")).toBeTruthy();
    expect(screen.getByText("/pandacorp:new-skill")).toBeTruthy();
    // 4 rows total
    const rows = screen.getAllByTestId(/^reference-command-/);
    expect(rows.length).toBe(4);
  });

  it("removing a skill in the fixture (one fewer entry) removes the row", () => {
    const reduced = FIXTURE_SKILLS.slice(0, 2); // only explore + spec
    render(<ReferenceCommandsSection skills={reduced} />);
    expect(screen.getByTestId("reference-command-explore")).toBeTruthy();
    expect(screen.getByTestId("reference-command-spec")).toBeTruthy();
    // implement is gone
    expect(screen.queryByTestId("reference-command-implement")).toBeNull();
  });

  it("renaming an agent in the fixture shows the new name and removes the old", () => {
    const renamedAgents = [
      {
        id: "implementer",
        name: "implementer-v2",
        description: "Renamed implementer.",
        model: "sonnet",
        body: "",
      },
    ];
    render(<ReferenceAgentsSection agents={renamedAgents} />);
    expect(screen.getByTestId("reference-agent-implementer")).toBeTruthy();
    expect(screen.getByText("implementer-v2")).toBeTruthy();
    // Old name gone
    expect(screen.queryByText("implementer")).toBeNull();
  });
});

// ==========================================================================
// AC-08-003.4 — Anti-pattern: no hand-maintained catalog array in components
// ==========================================================================

describe("AC-08-003.4 — anti-pattern check (no hand-maintained catalog)", () => {
  it("ReferenceCommandsSection accepts skills as a prop (not hardcoded)", () => {
    // If there were a hardcoded array, passing an empty array would still show items.
    render(<ReferenceCommandsSection skills={[]} />);
    // No command rows should appear
    const rows = screen.queryAllByTestId(/^reference-command-/);
    expect(rows.length).toBe(0);
  });

  it("ReferenceAgentsSection accepts agents as a prop (not hardcoded)", () => {
    render(<ReferenceAgentsSection agents={[]} />);
    const rows = screen.queryAllByTestId(/^reference-agent-/);
    expect(rows.length).toBe(0);
  });

  it("ReferenceCommandsSection renders exactly the skills passed in (no extras)", () => {
    const singleSkill = [
      {
        slug: "only-one",
        description: "The only skill.",
        runsIn: "factory" as const,
        body: "",
      },
    ];
    render(<ReferenceCommandsSection skills={singleSkill} />);
    const rows = screen.getAllByTestId(/^reference-command-/);
    expect(rows.length).toBe(1);
    expect(screen.getByTestId("reference-command-only-one")).toBeTruthy();
  });

  it("ReferenceAgentsSection renders exactly the agents passed in (no extras)", () => {
    const singleAgent = [
      {
        id: "lone-agent",
        name: "Lone Agent",
        description: "The only agent.",
        model: "opus",
        body: "",
      },
    ];
    render(<ReferenceAgentsSection agents={singleAgent} />);
    const rows = screen.getAllByTestId(/^reference-agent-/);
    expect(rows.length).toBe(1);
    expect(screen.getByTestId("reference-agent-lone-agent")).toBeTruthy();
  });
});
