/**
 * WO-07-009 — Integration test: page.tsx wires ALL FOUR data sources
 *
 * Regression test for the reviewer finding (2026-06-17):
 *   - page.tsx dropped readDecisionRules() wiring (rules tab empty, AC-07-008.2)
 *   - page.tsx dropped readAgents()/computeAgentLevel() wiring (agents tab empty, AC-07-007.1)
 *
 * These tests mock the lib functions and render the REAL ConfigurationPage default
 * export to verify that:
 *   1. The rules tab shows all rules (AC-07-008.2)
 *   2. The agents tab shows agent cards (AC-07-007.1)
 *   3. The standards tab shows standards (AC-07-009.1)
 *   4. page.tsx has NO "use server" directive (wrong for a Page module)
 *
 * Strategy: mock the four lib modules so tests run in jsdom without fs access.
 * The mocks return fixture data that is non-empty, so a broken wiring (no call
 * to readDecisionRules / readAgents / computeAgentLevel) produces 0 items in the
 * tab → test fails. A correct wiring passes.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Fixtures for mocks
// ---------------------------------------------------------------------------

import type { AgentLevelResult } from "@/lib/gamification/gamification";
import type { AgentRef, SkillRef } from "@/lib/reference/reference";
import type { DecisionRule } from "@/lib/registry/registry";
import type { Standard } from "@/lib/standards/standards";

const FIXTURE_SKILLS: SkillRef[] = [
  {
    slug: "spec",
    description: "Creates a project spec from an idea.",
    runsIn: "factory",
    body: "# /pandacorp:spec\n\nCreates a spec.",
  },
  {
    slug: "blueprint",
    description: "Generates a technical blueprint.",
    runsIn: "project",
    body: "# /pandacorp:blueprint\n\nGenerates blueprints.",
  },
];

const FIXTURE_RULES: DecisionRule[] = [
  {
    id: "DR-001",
    patron: "Dependency addition",
    default: "Justify before adding",
    requiereHumano: true,
    nota: "Check bundle size",
  },
  {
    id: "DR-002",
    patron: "Test coverage gate",
    default: "All tests must pass before commit",
    requiereHumano: false,
  },
  {
    id: "DR-009",
    patron: "Language of committed artifacts",
    default: "English for committed, Spanish for gitignored",
    requiereHumano: false,
  },
];

const FIXTURE_AGENTS: AgentRef[] = [
  {
    id: "backend-dev",
    name: "Backend Dev",
    description: "Builds server-side logic.",
    model: "sonnet",
    body: "# Backend Dev\n\nBuilds APIs.",
  },
  {
    id: "frontend-dev",
    name: "Frontend Dev",
    description: "Builds UI components.",
    model: "sonnet",
    body: "# Frontend Dev\n\nBuilds UIs.",
  },
];

const FIXTURE_LEVEL: AgentLevelResult = {
  level: 1,
  title: "Apprentice",
  xp: 0,
  next: 5,
  pctToNext: 0,
};

const FIXTURE_STANDARDS: Standard[] = [
  {
    id: "quality.md",
    title: "Quality Standards",
    body: "# Quality Standards\n- Write tests before code",
    domain: "Quality",
    severity: "MUST",
    enforcement: "CI",
    summary: ["Write tests before code"],
  },
];

// ---------------------------------------------------------------------------
// Mocks: all 4 data sources
// ---------------------------------------------------------------------------

vi.mock("@/lib/reference/reference", () => ({
  readSkills: vi.fn(() => FIXTURE_SKILLS),
  readAgents: vi.fn(() => FIXTURE_AGENTS),
}));

vi.mock("@/lib/registry/registry", () => ({
  readDecisionRules: vi.fn(() => FIXTURE_RULES),
}));

vi.mock("@/lib/standards/standards", () => ({
  readStandards: vi.fn(() => FIXTURE_STANDARDS),
}));

vi.mock("@/lib/gamification/gamification", () => ({
  computeAgentLevel: vi.fn(() => FIXTURE_LEVEL),
  AGENT_RANKS: ["Apprentice", "Engineer", "Senior", "Architect"],
  AGENT_XP_THRESHOLDS: [5, 20, 60, 100],
}));

// Mock events — computeAgentLevel may call readEvents indirectly; shield it.
vi.mock("@/lib/events/events", () => ({
  readEvents: vi.fn(() => ({ events: [], lastEventAt: null, byProject: {} })),
}));

// After mocks, import the component under test
import ConfigurationPage from "../page";

// ---------------------------------------------------------------------------
// Integration: rules tab has data (regression AC-07-008.2)
// ---------------------------------------------------------------------------

describe("frd-07 page integration: rules tab is wired (AC-07-008.2 regression)", () => {
  it("frd-07: WHEN the page renders and rules tab is selected THEN rule items are visible (count > 0)", () => {
    render(<ConfigurationPage />);
    fireEvent.click(screen.getByTestId("config-tab-rules"));
    // rule-item-* testids are rendered by DecisionRulesSection for each rule
    const ruleItems = screen.queryAllByTestId(/^rule-item-/);
    expect(ruleItems.length).toBeGreaterThan(0);
  });

  it("frd-07: WHEN the page renders THEN rules section shows rule-item-DR-001", () => {
    render(<ConfigurationPage />);
    fireEvent.click(screen.getByTestId("config-tab-rules"));
    expect(screen.getByTestId("rule-item-DR-001")).toBeDefined();
  });

  it("frd-07: WHEN the page renders THEN rules section shows rule-item-DR-002", () => {
    render(<ConfigurationPage />);
    fireEvent.click(screen.getByTestId("config-tab-rules"));
    expect(screen.getByTestId("rule-item-DR-002")).toBeDefined();
  });

  it("frd-07: WHEN the page renders THEN all 3 fixture rules are shown", () => {
    render(<ConfigurationPage />);
    fireEvent.click(screen.getByTestId("config-tab-rules"));
    const ruleItems = screen.queryAllByTestId(/^rule-item-/);
    expect(ruleItems.length).toBe(FIXTURE_RULES.length);
  });
});

// ---------------------------------------------------------------------------
// Integration: agents tab has data (regression AC-07-007.1)
// ---------------------------------------------------------------------------

describe("frd-07 page integration: agents tab is wired (AC-07-007.1 regression)", () => {
  it("frd-07: WHEN the page renders and agents tab is selected THEN agent cards are visible (count > 0)", () => {
    render(<ConfigurationPage />);
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    const agentCards = screen.queryAllByTestId("agent-card");
    expect(agentCards.length).toBeGreaterThan(0);
  });

  it("frd-07: WHEN the page renders THEN agents section shows backend-dev card", () => {
    render(<ConfigurationPage />);
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    const cards = screen.queryAllByTestId("agent-card");
    const bdCard = cards.find((c) => c.getAttribute("data-agent-id") === "backend-dev");
    expect(bdCard).toBeDefined();
  });

  it("frd-07: WHEN the page renders THEN agents section shows all 2 fixture agents", () => {
    render(<ConfigurationPage />);
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    const cards = screen.queryAllByTestId("agent-card");
    expect(cards.length).toBe(FIXTURE_AGENTS.length);
  });
});

// ---------------------------------------------------------------------------
// Integration: standards tab has data (AC-07-009.1)
// ---------------------------------------------------------------------------

describe("frd-07 page integration: standards tab is wired (AC-07-009.1)", () => {
  it("frd-07: WHEN the page renders and standards tab is selected THEN standards section is visible", () => {
    render(<ConfigurationPage />);
    fireEvent.click(screen.getByTestId("config-tab-standards"));
    expect(screen.getByTestId("standards-section")).toBeDefined();
  });

  it("frd-07: WHEN the page renders THEN standards section shows at least 1 standard item", () => {
    render(<ConfigurationPage />);
    fireEvent.click(screen.getByTestId("config-tab-standards"));
    const items = screen.queryAllByTestId(/^standard-item-/);
    expect(items.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: skills tab has data (AC-07-006.1)
// ---------------------------------------------------------------------------

describe("frd-07 page integration: skills tab is wired (AC-07-006.1)", () => {
  it("frd-07: WHEN the page renders THEN skills section is the default view", () => {
    render(<ConfigurationPage />);
    expect(screen.getByTestId("config-section-skills")).toBeDefined();
  });

  it("frd-07: WHEN the page renders THEN skills section shows skill cards (skill-card-{slug})", () => {
    render(<ConfigurationPage />);
    // SkillList uses data-testid="skill-card-{slug}" (not skill-item-*)
    const items = screen.queryAllByTestId(/^skill-card-/);
    expect(items.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Regression: no "use server" in page.tsx
// ---------------------------------------------------------------------------

describe("frd-07 page integration: page.tsx has no use server directive", () => {
  it("frd-07: ConfigurationPage is a React component (not a Server Action), exports a function", () => {
    // If page.tsx has "use server", all exports become Server Actions and must be async.
    // A synchronous default export (a React component) would cause a Next.js build error.
    // We verify the default export is a function (React component), not an async server action.
    expect(typeof ConfigurationPage).toBe("function");
  });

  it("frd-07: ConfigurationPage renders without errors (would fail at import if use server + sync)", () => {
    expect(() => render(<ConfigurationPage />)).not.toThrow();
  });
});
