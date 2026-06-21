/**
 * FRD-07 GATE — reverse cross-navigation anchor test (opus reviewer, DR-015).
 *
 * EARS: "The Skills and Agents sections SHALL support cross-navigation: from a
 *        skill's detail the owner SHALL be able to jump to any agent it uses,
 *        AND FROM AN AGENT'S DETAIL TO ANY SKILL THAT USES IT (clicking the
 *        linked chip opens the other item's detail)."
 *
 * This file probes ONLY the reverse clause (agent → skill), which was genuinely
 * absent in prior passes. It is RED against the current code (pre-fix).
 *
 * Wired to the real factory tree (readSkills/readAgents) so the inversion is
 * verified against real data edges, not a mock.
 */

import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readSkills } from "@/lib/reference/reference";

const FACTORY_ROOT = path.resolve(__dirname, "../../../../../");

let prevFactoryRoot: string | undefined;

beforeEach(() => {
  prevFactoryRoot = process.env.PANDACORP_FACTORY_ROOT;
  process.env.PANDACORP_FACTORY_ROOT = FACTORY_ROOT;
});

afterEach(() => {
  if (prevFactoryRoot === undefined) {
    delete process.env.PANDACORP_FACTORY_ROOT;
  } else {
    process.env.PANDACORP_FACTORY_ROOT = prevFactoryRoot;
  }
  cleanup();
});

async function renderRealPage() {
  const { default: ConfigurationPage } = await import("../page");
  return render(ConfigurationPage());
}

/**
 * Find an agent id that is referenced by at least one skill (so the inversion
 * produces a non-empty using-skills list). Uses readSkills() agent extraction.
 */
function findAgentWithUsingSkills(): { agentId: string; skillSlug: string } | null {
  const skills = readSkills();
  for (const skill of skills) {
    const agents = skill.agents ?? [];
    if (agents.length > 0 && agents[0]) {
      return { agentId: agents[0], skillSlug: skill.slug };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// EARS reverse clause: agent detail shows chips for skills that use it
// ---------------------------------------------------------------------------

describe("FRD-07 gate (opus) — reverse cross-navigation: agent detail lists using-skills", () => {
  it("agent detail exposes clickable chips for each skill that references the agent", async () => {
    const target = findAgentWithUsingSkills();
    if (!target) {
      // If no skill declares agents in the real factory, the test is vacuously skipped
      // (the EARS obligation only arises when the data edge exists).
      return;
    }

    await renderRealPage();

    // Navigate to the Agents tab
    fireEvent.click(screen.getByTestId("config-tab-agents"));

    // Click the agent card for the target agent
    // AgentList renders data-testid="agent-card" + data-agent-id="${id}" on each card.
    const allAgentCards = screen.queryAllByTestId("agent-card");
    const agentCard = allAgentCards.find(
      (el) => el.getAttribute("data-agent-id") === target.agentId,
    );
    expect(
      agentCard,
      `agent card for '${target.agentId}' must be visible in the Agents panel`,
    ).not.toBeUndefined();
    fireEvent.click(agentCard as HTMLElement);

    // The agent detail must show at least one using-skill chip
    const agentDetail = screen.queryByTestId("agent-detail");
    expect(
      agentDetail,
      "agent-detail must be rendered after clicking an agent card",
    ).not.toBeNull();

    const usingSkillChip = screen.queryByTestId(`agent-skill-chip-${target.skillSlug}`);
    expect(
      usingSkillChip,
      `agent detail must show a chip for skill '${target.skillSlug}' that references this agent (EARS reverse cross-nav)`,
    ).not.toBeNull();
  });

  it("clicking a using-skill chip from agent detail opens that skill's detail", async () => {
    const target = findAgentWithUsingSkills();
    if (!target) return;

    await renderRealPage();

    // Navigate to Agents tab and open the agent detail
    fireEvent.click(screen.getByTestId("config-tab-agents"));
    const allCards = screen.queryAllByTestId("agent-card");
    const agentCard = allCards.find((el) => el.getAttribute("data-agent-id") === target.agentId);
    if (!agentCard) return;
    fireEvent.click(agentCard);

    // Click the using-skill chip
    const chip = screen.queryByTestId(`agent-skill-chip-${target.skillSlug}`);
    expect(chip, "agent-skill-chip must be present before clicking").not.toBeNull();
    fireEvent.click(chip as HTMLElement);

    // We should now be on the Skills tab with the skill detail open
    const skillDetail = screen.queryByTestId("skill-detail");
    expect(
      skillDetail,
      `clicking using-skill chip '${target.skillSlug}' must open that skill's detail (EARS reverse cross-nav)`,
    ).not.toBeNull();

    // Confirm it's the RIGHT skill's detail
    const skillName = screen.queryByTestId("skill-detail-name");
    expect(
      skillName?.textContent,
      "the opened skill detail must match the clicked chip's slug",
    ).toContain(target.skillSlug);
  });
});
