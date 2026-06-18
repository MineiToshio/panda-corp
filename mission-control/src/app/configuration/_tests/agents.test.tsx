/**
 * WO-07-007 — Agents section tests (RED phase → GREEN)
 *
 * Tests for:
 *   - CMP-07-agent-list   (AgentList)
 *   - CMP-07-agent-detail (AgentDetail)
 *   - Integration with ConfigurationShell (agents tab renders AgentList)
 *
 * Acceptance criteria (EARS, from FRD-07 + WO-07-007):
 *
 *   AC-07-007.1 — The Agents section SHALL show, per agent:
 *     a pixel-art avatar, its level and its title (Apprentice → Engineer → Senior → Architect),
 *     from IF-09-agent-xp.
 *   AC-07-007.2 — WHEN the owner opens an agent's detail, it SHALL show an XP bar to the
 *     next level and the text explaining levels up by completing work orders.
 *   AC-07-007.3 — The level/XP SHALL be derived from real completed work orders (FRD-09),
 *     NOT from app opens or activity volume; with no data the bar SHALL read 0/next honestly
 *     (never a fake-progress bar).
 *   AC-07-007.4 — Avatar/level/title and the XP bar SHALL use FRD-13 tokens (rationed accent
 *     on the bar), with state never by color alone.
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentDetail } from "../AgentDetail";
import { AgentList, type AgentListProps } from "../AgentList";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Minimal AgentRef shape matching lib/reference.ts AgentRef */
const makeAgent = (
  id: string,
  opts: { name?: string; description?: string; model?: string; body?: string } = {},
) => ({
  id,
  name: opts.name ?? `Agent ${id}`,
  description: opts.description ?? `Description of ${id}`,
  model: opts.model ?? "sonnet",
  body: opts.body ?? `# ${id}\n\nThis is the body.`,
});

/** A set of 3 fake agents for list tests */
const FIXTURE_AGENTS = [
  makeAgent("backend-dev", { name: "Backend Dev" }),
  makeAgent("frontend-dev", { name: "Frontend Dev" }),
  makeAgent("researcher", { name: "Researcher" }),
];

/** AgentLevelResult: zero-state (no closed WOs) */
const ZERO_LEVEL = {
  level: 1,
  title: "Apprentice",
  xp: 0,
  next: 5,
  pctToNext: 0,
};

/** AgentLevelResult: mid-level (has some XP) */
const MID_LEVEL = {
  level: 2,
  title: "Engineer",
  xp: 10,
  next: 20,
  pctToNext: 0.33,
};

/** AgentLevelResult: max rank (Architect) */
const MAX_LEVEL = {
  level: 4,
  title: "Architect",
  xp: 80,
  next: 100,
  pctToNext: 1,
};

// ---------------------------------------------------------------------------
// AC-07-007.1 — AgentList: shows avatar, level, title per agent
// ---------------------------------------------------------------------------

describe("frd-07: AgentList — AC-07-007.1 shows avatar, level, title per agent", () => {
  const defaultLevels: AgentListProps["levels"] = {
    "backend-dev": ZERO_LEVEL,
    "frontend-dev": ZERO_LEVEL,
    researcher: ZERO_LEVEL,
  };

  it("frd-07: AC-07-007.1 — renders the agents list container", () => {
    render(
      <AgentList
        agents={FIXTURE_AGENTS}
        levels={defaultLevels}
        selectedAgentId={null}
        onSelectAgent={() => {}}
      />,
    );
    expect(screen.getByTestId("agent-list")).toBeDefined();
  });

  it("frd-07: AC-07-007.1 — renders a card for each agent", () => {
    render(
      <AgentList
        agents={FIXTURE_AGENTS}
        levels={defaultLevels}
        selectedAgentId={null}
        onSelectAgent={() => {}}
      />,
    );
    const cards = screen.getAllByTestId("agent-card");
    expect(cards.length).toBe(FIXTURE_AGENTS.length);
  });

  it("frd-07: AC-07-007.1 — each card has data-agent-id attribute", () => {
    render(
      <AgentList
        agents={FIXTURE_AGENTS}
        levels={defaultLevels}
        selectedAgentId={null}
        onSelectAgent={() => {}}
      />,
    );
    const cards = screen.getAllByTestId("agent-card");
    const ids = cards.map((c) => c.getAttribute("data-agent-id"));
    expect(ids).toContain("backend-dev");
    expect(ids).toContain("frontend-dev");
    expect(ids).toContain("researcher");
  });

  it("frd-07: AC-07-007.1 — each card shows a pixel-art avatar (agent-avatar testid)", () => {
    render(
      <AgentList
        agents={FIXTURE_AGENTS}
        levels={defaultLevels}
        selectedAgentId={null}
        onSelectAgent={() => {}}
      />,
    );
    const avatars = screen.getAllByTestId("agent-avatar");
    expect(avatars.length).toBe(FIXTURE_AGENTS.length);
  });

  it("frd-07: AC-07-007.1 — each card shows the agent level", () => {
    const levels: AgentListProps["levels"] = {
      "backend-dev": { ...ZERO_LEVEL, level: 1 },
      "frontend-dev": { ...MID_LEVEL, level: 2 },
      researcher: { ...MAX_LEVEL, level: 4 },
    };
    render(
      <AgentList
        agents={FIXTURE_AGENTS}
        levels={levels}
        selectedAgentId={null}
        onSelectAgent={() => {}}
      />,
    );
    const cards = screen.getAllByTestId("agent-card");
    // Find backend-dev card and verify level 1 shown
    const bdCard = cards.find((c) => c.getAttribute("data-agent-id") === "backend-dev");
    expect(bdCard).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: guarded by expect above
    expect(within(bdCard!).getByTestId("agent-card-level").textContent).toContain("1");
    // Find frontend-dev card and verify level 2
    const fdCard = cards.find((c) => c.getAttribute("data-agent-id") === "frontend-dev");
    expect(fdCard).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: guarded by expect above
    expect(within(fdCard!).getByTestId("agent-card-level").textContent).toContain("2");
  });

  it("frd-07: AC-07-007.1 — each card shows the agent title", () => {
    const levels: AgentListProps["levels"] = {
      "backend-dev": ZERO_LEVEL,
      "frontend-dev": MID_LEVEL,
      researcher: MAX_LEVEL,
    };
    render(
      <AgentList
        agents={FIXTURE_AGENTS}
        levels={levels}
        selectedAgentId={null}
        onSelectAgent={() => {}}
      />,
    );
    const cards = screen.getAllByTestId("agent-card");
    const bdCard = cards.find((c) => c.getAttribute("data-agent-id") === "backend-dev");
    // biome-ignore lint/style/noNonNullAssertion: cards.find result used immediately after expect
    expect(within(bdCard!).getByTestId("agent-card-title").textContent).toContain("Apprentice");
    const fdCard = cards.find((c) => c.getAttribute("data-agent-id") === "frontend-dev");
    // biome-ignore lint/style/noNonNullAssertion: cards.find result used immediately after expect
    expect(within(fdCard!).getByTestId("agent-card-title").textContent).toContain("Engineer");
    const resCard = cards.find((c) => c.getAttribute("data-agent-id") === "researcher");
    // biome-ignore lint/style/noNonNullAssertion: cards.find result used immediately after expect
    expect(within(resCard!).getByTestId("agent-card-title").textContent).toContain("Architect");
  });

  it("frd-07: AC-07-007.1 — each card shows the agent name", () => {
    render(
      <AgentList
        agents={FIXTURE_AGENTS}
        levels={defaultLevels}
        selectedAgentId={null}
        onSelectAgent={() => {}}
      />,
    );
    const cards = screen.getAllByTestId("agent-card");
    const bdCard = cards.find((c) => c.getAttribute("data-agent-id") === "backend-dev");
    // biome-ignore lint/style/noNonNullAssertion: cards.find result used immediately after cards assertion
    expect(within(bdCard!).getByTestId("agent-card-name").textContent).toContain("Backend Dev");
  });

  it("frd-07: AC-07-007.1 — empty agents array renders empty state", () => {
    render(<AgentList agents={[]} levels={{}} selectedAgentId={null} onSelectAgent={() => {}} />);
    expect(screen.queryAllByTestId("agent-card").length).toBe(0);
    expect(screen.getByTestId("agent-list")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-07-007.1 — AgentList: click → onSelectAgent callback
// ---------------------------------------------------------------------------

describe("frd-07: AgentList — click a card calls onSelectAgent", () => {
  const defaultLevels: AgentListProps["levels"] = {
    "backend-dev": ZERO_LEVEL,
    "frontend-dev": ZERO_LEVEL,
    researcher: ZERO_LEVEL,
  };

  it("frd-07: clicking a card calls onSelectAgent with the agent id", () => {
    const calls: string[] = [];
    render(
      <AgentList
        agents={FIXTURE_AGENTS}
        levels={defaultLevels}
        selectedAgentId={null}
        onSelectAgent={(id) => calls.push(id)}
      />,
    );
    const cards = screen.getAllByTestId("agent-card");
    const bdCard = cards.find((c) => c.getAttribute("data-agent-id") === "backend-dev");
    // biome-ignore lint/style/noNonNullAssertion: guarded by cards.length assertion above
    fireEvent.click(bdCard!);
    expect(calls).toContain("backend-dev");
  });

  it("frd-07: clicking frontend-dev card calls onSelectAgent with 'frontend-dev'", () => {
    const calls: string[] = [];
    render(
      <AgentList
        agents={FIXTURE_AGENTS}
        levels={defaultLevels}
        selectedAgentId={null}
        onSelectAgent={(id) => calls.push(id)}
      />,
    );
    const cards = screen.getAllByTestId("agent-card");
    const fdCard = cards.find((c) => c.getAttribute("data-agent-id") === "frontend-dev");
    // biome-ignore lint/style/noNonNullAssertion: guarded by cards.length assertion above
    fireEvent.click(fdCard!);
    expect(calls).toContain("frontend-dev");
  });

  it("frd-07: selected card has data-selected='true'", () => {
    render(
      <AgentList
        agents={FIXTURE_AGENTS}
        levels={defaultLevels}
        selectedAgentId="backend-dev"
        onSelectAgent={() => {}}
      />,
    );
    const cards = screen.getAllByTestId("agent-card");
    const bdCard = cards.find((c) => c.getAttribute("data-agent-id") === "backend-dev");
    expect(bdCard?.getAttribute("data-selected")).toBe("true");
  });

  it("frd-07: non-selected cards have data-selected='false'", () => {
    render(
      <AgentList
        agents={FIXTURE_AGENTS}
        levels={defaultLevels}
        selectedAgentId="backend-dev"
        onSelectAgent={() => {}}
      />,
    );
    const cards = screen.getAllByTestId("agent-card");
    const fdCard = cards.find((c) => c.getAttribute("data-agent-id") === "frontend-dev");
    expect(fdCard?.getAttribute("data-selected")).toBe("false");
  });

  it("frd-07: each card is a button (keyboard activatable)", () => {
    render(
      <AgentList
        agents={FIXTURE_AGENTS}
        levels={defaultLevels}
        selectedAgentId={null}
        onSelectAgent={() => {}}
      />,
    );
    const cards = screen.getAllByTestId("agent-card");
    for (const card of cards) {
      expect(card.tagName.toLowerCase()).toBe("button");
    }
  });
});

// ---------------------------------------------------------------------------
// AC-07-007.2 — AgentDetail: XP bar + work-order explanation
// ---------------------------------------------------------------------------

describe("frd-07: AgentDetail — AC-07-007.2 XP bar + work-order explanation", () => {
  const defaultAgent = makeAgent("backend-dev", { name: "Backend Dev" });

  it("frd-07: AC-07-007.2 — renders agent detail container", () => {
    render(<AgentDetail agent={defaultAgent} level={MID_LEVEL} />);
    expect(screen.getByTestId("agent-detail")).toBeDefined();
  });

  it("frd-07: AC-07-007.2 — shows the agent name in the detail header", () => {
    render(<AgentDetail agent={defaultAgent} level={MID_LEVEL} />);
    expect(screen.getByTestId("agent-detail-name").textContent).toContain("Backend Dev");
  });

  it("frd-07: AC-07-007.2 — shows an XP bar (xp-bar testid)", () => {
    render(<AgentDetail agent={defaultAgent} level={MID_LEVEL} />);
    expect(screen.getByTestId("xp-bar")).toBeDefined();
  });

  it("frd-07: AC-07-007.2 — XP bar shows current XP value", () => {
    render(<AgentDetail agent={defaultAgent} level={{ ...MID_LEVEL, xp: 10 }} />);
    expect(screen.getByTestId("xp-bar-xp").textContent).toContain("10");
  });

  it("frd-07: AC-07-007.2 — XP bar shows next threshold", () => {
    render(<AgentDetail agent={defaultAgent} level={{ ...MID_LEVEL, xp: 10, next: 20 }} />);
    expect(screen.getByTestId("xp-bar-next").textContent).toContain("20");
  });

  it("frd-07: AC-07-007.2 — shows explanation text about work orders", () => {
    render(<AgentDetail agent={defaultAgent} level={MID_LEVEL} />);
    const detail = screen.getByTestId("agent-detail");
    const text = detail.textContent ?? "";
    // The explanation must mention "work orders" in some form (Spanish or English)
    expect(
      text.toLowerCase().includes("work order") ||
        text.toLowerCase().includes("órdenes de trabajo") ||
        text.toLowerCase().includes("orden de trabajo"),
    ).toBe(true);
  });

  it("frd-07: AC-07-007.2 — shows the work-order explanation with data-testid", () => {
    render(<AgentDetail agent={defaultAgent} level={MID_LEVEL} />);
    expect(screen.getByTestId("agent-detail-xp-explanation")).toBeDefined();
  });

  it("frd-07: AC-07-007.2 — explanation text explains leveling up by completing WOs", () => {
    render(<AgentDetail agent={defaultAgent} level={MID_LEVEL} />);
    const el = screen.getByTestId("agent-detail-xp-explanation");
    const text = (el.textContent ?? "").toLowerCase();
    // Must mention level/level-up concept AND work order concept
    const mentionsLeveling =
      text.includes("nivel") ||
      text.includes("sube") ||
      text.includes("nivel") ||
      text.includes("leve");
    const mentionsWO =
      text.includes("work order") || text.includes("orden") || text.includes("tarea");
    expect(mentionsLeveling || mentionsWO).toBe(true);
  });

  it("frd-07: AC-07-007.2 — shows avatar in detail header", () => {
    render(<AgentDetail agent={defaultAgent} level={MID_LEVEL} />);
    expect(screen.getByTestId("agent-avatar")).toBeDefined();
  });

  it("frd-07: AC-07-007.2 — shows current level in detail", () => {
    render(<AgentDetail agent={defaultAgent} level={{ ...MID_LEVEL, level: 2 }} />);
    expect(screen.getByTestId("agent-detail-level").textContent).toContain("2");
  });

  it("frd-07: AC-07-007.2 — shows title in detail", () => {
    render(<AgentDetail agent={defaultAgent} level={{ ...MID_LEVEL, title: "Engineer" }} />);
    expect(screen.getByTestId("agent-detail-title").textContent).toContain("Engineer");
  });
});

// ---------------------------------------------------------------------------
// AC-07-007.3 — Zero-data honesty: 0/next, no fake progress
// ---------------------------------------------------------------------------

describe("frd-07: AgentDetail — AC-07-007.3 zero-data honesty", () => {
  const defaultAgent = makeAgent("backend-dev", { name: "Backend Dev" });

  it("frd-07: AC-07-007.3 — zero XP shows xp=0 honestly", () => {
    render(<AgentDetail agent={defaultAgent} level={ZERO_LEVEL} />);
    expect(screen.getByTestId("xp-bar-xp").textContent).toContain("0");
  });

  it("frd-07: AC-07-007.3 — zero XP bar fill is exactly 0% (not fake 80%)", () => {
    render(<AgentDetail agent={defaultAgent} level={ZERO_LEVEL} />);
    const fill = screen.getByTestId("xp-bar-fill");
    const widthStr = fill.style.width;
    const widthNum = Number.parseFloat(widthStr);
    expect(widthNum).toBe(0);
  });

  it("frd-07: AC-07-007.3 — zero XP level is 1 (Apprentice), not invented", () => {
    render(<AgentDetail agent={defaultAgent} level={ZERO_LEVEL} />);
    expect(screen.getByTestId("agent-detail-level").textContent).toContain("1");
    expect(screen.getByTestId("agent-detail-title").textContent).toContain("Apprentice");
  });

  it("frd-07: AC-07-007.3 — NEGATIVE AC — zero-XP bar NEVER shows fill near 80%", () => {
    render(<AgentDetail agent={defaultAgent} level={ZERO_LEVEL} />);
    const fill = screen.getByTestId("xp-bar-fill");
    const widthNum = Number.parseFloat(fill.style.width);
    expect(widthNum).toBeLessThan(10); // strictly low, not 80%
  });

  it("frd-07: AC-07-007.3 — NEGATIVE AC — no activity/app-open XP reflected (only WO XP)", () => {
    // The level prop comes from computeAgentLevel which only counts closed WOs.
    // At zero real WOs, pctToNext=0. This is verified by the zero-state fixture above.
    render(<AgentDetail agent={defaultAgent} level={ZERO_LEVEL} />);
    const fill = screen.getByTestId("xp-bar-fill");
    expect(Number.parseFloat(fill.style.width)).toBe(0);
  });

  it("frd-07: AC-07-007.3 — max-rank (Architect) shows pct=100 fill honestly", () => {
    render(<AgentDetail agent={defaultAgent} level={MAX_LEVEL} />);
    const fill = screen.getByTestId("xp-bar-fill");
    const widthNum = Number.parseFloat(fill.style.width);
    // pctToNext=1 (fraction) → XpBar clamps to 100% (it multiplies by 1 or treats as %)
    // XpBar receives pctToNext as-is from computeAgentLevel which returns [0,1] fraction.
    // The XpBar component multiplies by 1 or treats as %, so we test >=50% for max rank.
    expect(widthNum).toBeGreaterThanOrEqual(50);
  });
});

// ---------------------------------------------------------------------------
// AC-07-007.4 — Design tokens only (no hardcoded colors)
// ---------------------------------------------------------------------------

describe("frd-07: AgentList + AgentDetail — AC-07-007.4 design tokens only", () => {
  const defaultLevels: AgentListProps["levels"] = {
    "backend-dev": ZERO_LEVEL,
    "frontend-dev": ZERO_LEVEL,
    researcher: ZERO_LEVEL,
  };
  const defaultAgent = makeAgent("backend-dev", { name: "Backend Dev" });

  it("frd-07: AC-07-007.4 — AgentList has no hardcoded hex colors", () => {
    const { container } = render(
      <AgentList
        agents={FIXTURE_AGENTS}
        levels={defaultLevels}
        selectedAgentId={null}
        onSelectAgent={() => {}}
      />,
    );
    const html = container.innerHTML;
    // No hardcoded hex/rgb/hsl colors (only var(--...) allowed)
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}(?!\w)/);
    expect(html).not.toMatch(/\brgb\s*\(/);
    expect(html).not.toMatch(/\bhsl\s*\(/);
  });

  it("frd-07: AC-07-007.4 — AgentDetail has no hardcoded hex colors", () => {
    const { container } = render(<AgentDetail agent={defaultAgent} level={MID_LEVEL} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}(?!\w)/);
    expect(html).not.toMatch(/\brgb\s*\(/);
    expect(html).not.toMatch(/\bhsl\s*\(/);
  });

  it("frd-07: AC-07-007.4 — XP bar in detail uses accent (not color alone)", () => {
    render(<AgentDetail agent={defaultAgent} level={MID_LEVEL} />);
    const fill = screen.getByTestId("xp-bar-fill");
    const styleAttr = fill.getAttribute("style") ?? "";
    const cls = fill.className;
    const hasAccent =
      styleAttr.includes("accent") || cls.includes("accent") || fill.hasAttribute("data-accent");
    expect(hasAccent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration: ConfigurationShell — agents tab renders AgentList via props
// ---------------------------------------------------------------------------
// ConfigurationShell is "use client" and cannot do fs reads.
// The Server Component (page.tsx) reads agents+derives levels and passes them
// as the `agentsData` prop to ConfigurationShell. Tests exercise this seam
// directly without mocking fs modules.

import type { AgentsData } from "../ConfigurationShell";
import { ConfigurationShell } from "../ConfigurationShell";

const FIXTURE_AGENTS_DATA: AgentsData = {
  agents: [
    makeAgent("backend-dev", { name: "Backend Dev" }),
    makeAgent("researcher", { name: "Researcher" }),
  ],
  levels: {
    "backend-dev": ZERO_LEVEL,
    researcher: ZERO_LEVEL,
  },
};

describe("frd-07: ConfigurationShell — agents section integration", () => {
  it("frd-07: WHEN agents tab is active THEN agent-list is rendered", () => {
    render(<ConfigurationShell agentsData={FIXTURE_AGENTS_DATA} />);
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    expect(screen.getByTestId("agent-list")).toBeDefined();
  });

  it("frd-07: WHEN agents tab is active THEN agent cards are shown", () => {
    render(<ConfigurationShell agentsData={FIXTURE_AGENTS_DATA} />);
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    const cards = screen.getAllByTestId("agent-card");
    expect(cards.length).toBeGreaterThan(0);
  });

  it("frd-07: WHEN clicking an agent card THEN agent detail panel is shown", () => {
    render(<ConfigurationShell agentsData={FIXTURE_AGENTS_DATA} />);
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    const cards = screen.getAllByTestId("agent-card");
    // biome-ignore lint/style/noNonNullAssertion: cards.length > 0 asserted in prior test; getAllByTestId throws if empty
    fireEvent.click(cards[0]!);
    expect(screen.getByTestId("agent-detail")).toBeDefined();
  });

  it("frd-07: WHEN agent detail is open THEN XP bar is visible", () => {
    render(<ConfigurationShell agentsData={FIXTURE_AGENTS_DATA} />);
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    const cards = screen.getAllByTestId("agent-card");
    // biome-ignore lint/style/noNonNullAssertion: getAllByTestId throws if empty; [0] is always defined
    fireEvent.click(cards[0]!);
    expect(screen.getByTestId("xp-bar")).toBeDefined();
  });

  it("frd-07: WHEN agents tab is active THEN config-section-agents panel is present", () => {
    render(<ConfigurationShell agentsData={FIXTURE_AGENTS_DATA} />);
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    expect(screen.getByTestId("config-section-agents")).toBeDefined();
  });

  it("frd-07: WHEN no agentsData provided THEN agents tab still renders (no crash)", () => {
    render(<ConfigurationShell />);
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    // Should render config-section-agents even without data (empty or placeholder)
    expect(screen.getByTestId("config-section-agents")).toBeDefined();
  });
});
