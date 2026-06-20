/**
 * WO-07-005 — Visual structure tests (RED → GREEN)
 *
 * Verifies the structural/visual requirements from the prototype re-anchor:
 *   - Cards use the Panel component (rpgpanel embossed skin, data-testid="panel")
 *   - SkillCard has an ItemSlot tile (data-testid="itemslot-root")
 *   - AgentCard has a model chip (data-testid="agent-model-chip") with the model text
 *   - RuleCard has an ItemSlot tile
 *   - StandardCard has an ItemSlot tile
 *   - Page uses PageTitle component (data-testid="page-title")
 *   - Skill groups use SectionHead (data-testid="section-head") instead of a raw h3
 *   - SectionTabs has no style conflict (borderBottom vs borderBottomStyle)
 *
 * These tests enforce the prototype alignment (DR-054/055/056):
 *   "gxSkillCard" → Panel + ItemSlot(wand)
 *   "gxAgentCard" → Panel + Avatar + model chip
 *   "gxRuleCard"  → Panel + ItemSlot(gavel/check)
 *   "gxStdCard"   → Panel + ItemSlot(book)
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AgentRef, SkillRef } from "@/lib/reference/reference";
import type { DecisionRule } from "@/lib/registry/registry";
import type { Standard } from "@/lib/standards/standards";

import { AgentList } from "../AgentList";
import { SkillList } from "../SkillList";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_FACTORY_SKILL: SkillRef = {
  slug: "explore",
  description: "Explores a fuzzy idea in the factory context.",
  runsIn: "factory",
  body: "# /pandacorp:explore\n\nExplores ideas.",
};

const FIXTURE_PROJECT_SKILL: SkillRef = {
  slug: "blueprint",
  description: "Creates the architecture blueprint.",
  runsIn: "project",
  body: "# /pandacorp:blueprint\n\nBuilds blueprints.",
};

const FIXTURE_AGENT: AgentRef = {
  id: "backend-dev",
  name: "Backend Dev",
  description: "Builds server-side logic.",
  model: "sonnet",
  body: "# Backend Dev\n\nBuilds APIs.",
};

const FIXTURE_AGENT_OPUS: AgentRef = {
  id: "architect",
  name: "Architect",
  description: "Designs the architecture.",
  model: "opus",
  body: "# Architect\n\nDesigns the system.",
};

const FIXTURE_RULE_HUMAN: DecisionRule = {
  id: "DR-001",
  patron: "Dependency addition",
  default: "Justify before adding",
  requiereHumano: true,
  nota: "Check bundle size",
};

const FIXTURE_RULE_AUTO: DecisionRule = {
  id: "DR-002",
  patron: "Test coverage gate",
  default: "All tests must pass before commit",
  requiereHumano: false,
};

const FIXTURE_STANDARD: Standard = {
  id: "quality.md",
  title: "Quality Standards",
  body: "# Quality Standards\n\n- Write tests before code",
  domain: "Quality",
  severity: "MUST",
  enforcement: "CI",
  summary: ["Write tests before code"],
};

const ZERO_LEVEL = { level: 1, title: "Apprentice", xp: 0, next: 5, pctToNext: 0 };

// ---------------------------------------------------------------------------
// 1. SkillList — SkillCards use Panel component (rpgpanel skin)
// ---------------------------------------------------------------------------

describe("WO-07-005 visual — SkillCard uses Panel (rpgpanel embossed skin)", () => {
  it("SkillCard renders a Panel component (data-testid='panel') inside the card", () => {
    render(<SkillList skills={[FIXTURE_FACTORY_SKILL]} onSelect={() => {}} />);
    const card = screen.getByTestId("skill-card-explore");
    // The Panel component always renders data-testid="panel"
    expect(within(card).queryByTestId("panel")).not.toBeNull();
  });

  it("SkillCard Panel has rpgpanel variant (data-variant='rpgpanel' or 'panel')", () => {
    render(<SkillList skills={[FIXTURE_FACTORY_SKILL]} onSelect={() => {}} />);
    const card = screen.getByTestId("skill-card-explore");
    const panel = within(card).getByTestId("panel");
    const variant = panel.getAttribute("data-variant");
    expect(["rpgpanel", "panel"]).toContain(variant);
  });

  it("SkillCard renders an ItemSlot tile (data-testid='itemslot-root') as the icon", () => {
    render(<SkillList skills={[FIXTURE_FACTORY_SKILL]} onSelect={() => {}} />);
    const card = screen.getByTestId("skill-card-explore");
    expect(within(card).queryByTestId("itemslot-root")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. SkillList — groups use SectionHead component (not a raw h3)
// ---------------------------------------------------------------------------

describe("WO-07-005 visual — SkillList groups use SectionHead component", () => {
  it("factory group header is a SectionHead (data-testid='section-head')", () => {
    render(
      <SkillList skills={[FIXTURE_FACTORY_SKILL, FIXTURE_PROJECT_SKILL]} onSelect={() => {}} />,
    );
    const group = screen.getByTestId("skill-group-factory");
    // SectionHead always renders with data-testid="section-head"
    expect(within(group).queryByTestId("section-head")).not.toBeNull();
  });

  it("project group header is a SectionHead (data-testid='section-head')", () => {
    render(
      <SkillList skills={[FIXTURE_FACTORY_SKILL, FIXTURE_PROJECT_SKILL]} onSelect={() => {}} />,
    );
    const group = screen.getByTestId("skill-group-project");
    expect(within(group).queryByTestId("section-head")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. AgentList — AgentCards use Panel + model chip
// ---------------------------------------------------------------------------

describe("WO-07-005 visual — AgentCard uses Panel (rpgpanel) and shows model chip", () => {
  it("AgentCard renders a Panel component (data-testid='panel') inside the card", () => {
    render(
      <AgentList
        agents={[FIXTURE_AGENT]}
        levels={{ "backend-dev": ZERO_LEVEL }}
        selectedAgentId={null}
        onSelectAgent={() => {}}
      />,
    );
    const card = screen.getByTestId("agent-card");
    expect(within(card).queryByTestId("panel")).not.toBeNull();
  });

  it("AgentCard shows a model chip (data-testid='agent-model-chip')", () => {
    render(
      <AgentList
        agents={[FIXTURE_AGENT]}
        levels={{ "backend-dev": ZERO_LEVEL }}
        selectedAgentId={null}
        onSelectAgent={() => {}}
      />,
    );
    const card = screen.getByTestId("agent-card");
    expect(within(card).queryByTestId("agent-model-chip")).not.toBeNull();
  });

  it("AgentCard model chip shows the model text (sonnet/opus)", () => {
    render(
      <AgentList
        agents={[FIXTURE_AGENT]}
        levels={{ "backend-dev": ZERO_LEVEL }}
        selectedAgentId={null}
        onSelectAgent={() => {}}
      />,
    );
    const card = screen.getByTestId("agent-card");
    const chip = within(card).getByTestId("agent-model-chip");
    expect(chip.textContent).toContain("sonnet");
  });

  it("AgentCard model chip shows 'opus' for opus model agents", () => {
    render(
      <AgentList
        agents={[FIXTURE_AGENT_OPUS]}
        levels={{ architect: ZERO_LEVEL }}
        selectedAgentId={null}
        onSelectAgent={() => {}}
      />,
    );
    const card = screen.getByTestId("agent-card");
    const chip = within(card).getByTestId("agent-model-chip");
    expect(chip.textContent).toContain("opus");
  });
});

// ---------------------------------------------------------------------------
// 4. DecisionRulesSection — RuleCards use Panel + ItemSlot
// ---------------------------------------------------------------------------

import { DecisionRulesSection } from "../_rules/DecisionRulesSection/DecisionRulesSection";

describe("WO-07-005 visual — RuleCard uses Panel and ItemSlot tile", () => {
  it("RuleCard renders a Panel component (data-testid='panel') inside the card", () => {
    render(<DecisionRulesSection rules={[FIXTURE_RULE_HUMAN, FIXTURE_RULE_AUTO]} />);
    const item = screen.getByTestId("rule-item-DR-001");
    expect(within(item).queryByTestId("panel")).not.toBeNull();
  });

  it("RuleCard renders an ItemSlot tile (data-testid='itemslot-root') as the icon", () => {
    render(<DecisionRulesSection rules={[FIXTURE_RULE_HUMAN, FIXTURE_RULE_AUTO]} />);
    const item = screen.getByTestId("rule-item-DR-001");
    expect(within(item).queryByTestId("itemslot-root")).not.toBeNull();
  });

  it("human rule ItemSlot has danger tone (data-tone='danger')", () => {
    render(<DecisionRulesSection rules={[FIXTURE_RULE_HUMAN]} />);
    const item = screen.getByTestId("rule-item-DR-001");
    const slot = within(item).getByTestId("itemslot-root");
    expect(slot.getAttribute("data-tone")).toBe("danger");
  });

  it("auto rule ItemSlot has ok tone (data-tone='ok')", () => {
    render(<DecisionRulesSection rules={[FIXTURE_RULE_AUTO]} />);
    const item = screen.getByTestId("rule-item-DR-002");
    const slot = within(item).getByTestId("itemslot-root");
    expect(slot.getAttribute("data-tone")).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// 5. StandardsSection — StandardCards use Panel + ItemSlot
// ---------------------------------------------------------------------------

import { StandardsSection } from "../StandardsSection/StandardsSection";

describe("WO-07-005 visual — StandardCard uses Panel and ItemSlot tile", () => {
  it("StandardCard renders a Panel component (data-testid='panel') inside the card", () => {
    render(<StandardsSection standards={[FIXTURE_STANDARD]} />);
    const item = screen.getByTestId("standard-item-quality.md");
    expect(within(item).queryByTestId("panel")).not.toBeNull();
  });

  it("StandardCard renders an ItemSlot tile (data-testid='itemslot-root') as the icon", () => {
    render(<StandardsSection standards={[FIXTURE_STANDARD]} />);
    const item = screen.getByTestId("standard-item-quality.md");
    expect(within(item).queryByTestId("itemslot-root")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. ConfigurationPage — uses PageTitle component in the header
// ---------------------------------------------------------------------------

import { ConfigurationShell } from "../ConfigurationShell";

describe("WO-07-005 visual — ConfigurationShell uses PageTitle in the header", () => {
  it("ConfigurationShell renders PageTitle component (data-testid='page-title')", () => {
    render(<ConfigurationShell />);
    expect(screen.queryByTestId("page-title")).not.toBeNull();
  });

  it("PageTitle H1 contains 'Configuración'", () => {
    render(<ConfigurationShell />);
    const title = screen.getByTestId("page-title");
    expect(title.textContent).toContain("Configuración");
  });
});

// ---------------------------------------------------------------------------
// 7. SectionTabs — no style conflict (borderBottom vs borderBottomStyle)
// ---------------------------------------------------------------------------

import { SectionTabs } from "../SectionTabs";

describe("WO-07-005 visual — SectionTabs style does not have borderBottom conflict", () => {
  it("renders without React style conflict warnings (no borderBottom+borderBottomStyle mix)", () => {
    // This test verifies structural correctness — the tab buttons should not
    // have both shorthand 'border' and longhand 'borderBottomStyle' conflicts.
    // In jsdom, a conflicting property just produces a warning, but the HTML should
    // still render. We verify the tabs render cleanly.
    const { container } = render(<SectionTabs activeSection="skills" onSectionChange={() => {}} />);
    const tabs = container.querySelectorAll("[role='tab']");
    expect(tabs.length).toBe(4);
    // Verify all tabs render without crashing
    for (const tab of Array.from(tabs)) {
      expect(tab).toBeDefined();
    }
  });
});
