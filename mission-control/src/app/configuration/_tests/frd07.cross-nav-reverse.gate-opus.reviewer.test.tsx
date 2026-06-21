/**
 * FRD-07 GATE — opus reviewer adversarial test (DR-015): the REVERSE half of
 * the Skills↔Agents cross-navigation EARS.
 *
 * The prior gate test (frd07.gate-opus.reviewer.test.tsx) only asserted the
 * FORWARD direction (a skill's flow chip jumps to an agent). The EARS bullet is
 * explicit and BIDIRECTIONAL:
 *
 *   "The Skills and Agents sections SHALL support cross-navigation: from a
 *    skill's detail the owner SHALL be able to jump to any agent it uses, AND
 *    FROM AN AGENT'S DETAIL TO ANY SKILL THAT USES IT (clicking the linked chip
 *    opens the other item's detail)."  — FRD-07
 *
 * This file probes the second clause (agent → skill), which the current code
 * never implements: AgentDetail receives only { agent, level } — no list of
 * using-skills, no onSkillClick — and ConfigurationShell has no agent→skill nav.
 *
 * It is written to be RED against the current code and to go GREEN only when the
 * agent detail surfaces clickable skill chips that open the skill's detail.
 *
 * Exercises WO-07-005 (the whole Configuración UI surface) TOGETHER with the
 * VERIFIED readers (WO-07-001/003/004) through the real ConfigurationPage Server
 * Component wired to the real factory tree.
 */

import path from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSkills } from "@/lib/reference/reference";

const FACTORY_ROOT = path.resolve(__dirname, "../../../../../"); // panda-corp root

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
  vi.restoreAllMocks();
  cleanup();
});

async function renderRealPage() {
  const { default: ConfigurationPage } = await import("../page");
  return render(ConfigurationPage());
}

/**
 * Pick an agent role that at least one real factory skill actually uses, so the
 * test asserts a genuine reverse edge (not an empty case). Returns null if the
 * real factory ships no skill→agent edge at all (would itself be a data problem).
 */
function findAgentUsedBySomeSkill(): string | null {
  const skills = readSkills();
  for (const skill of skills) {
    const agents = skill.agents ?? [];
    if (agents.length > 0) return agents[0] ?? null;
  }
  return null;
}

describe("FRD-07 gate (opus) — Agents→Skills cross-navigation (reverse half)", () => {
  it("the agent detail lists the skills that use the agent as clickable chips", async () => {
    const usedRole = findAgentUsedBySomeSkill();
    expect(
      usedRole,
      "the real factory must ship at least one skill that uses an agent (cross-nav source data)",
    ).not.toBeNull();
    if (!usedRole) return;

    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-agents"));

    // Open the detail of the agent that we know at least one skill uses.
    const card = screen
      .getAllByTestId("agent-card")
      .find((el) => el.getAttribute("data-agent-id") === usedRole);
    expect(
      card,
      `the agents list must contain a card for "${usedRole}" (the agent some skill uses)`,
    ).toBeTruthy();
    fireEvent.click(card as HTMLElement);

    const detail = screen.getByTestId("agent-detail");

    // EARS: the agent detail must list the skills that use it AS LINKED CHIPS the
    // owner can click. A clickable chip is an interactive element (button / link),
    // not a flat <span>. The list of using-skills must be non-empty for an agent
    // that real skills reference.
    const skillJumpControls = within(detail).queryAllByRole("button");
    // Exclude any generic back/close affordance: a real jump-to-skill chip carries
    // the skill slug in its accessible name or a testid prefixed for skill nav.
    const looksLikeSkillJump = skillJumpControls.some((el) => {
      const label = (el.getAttribute("aria-label") ?? el.textContent ?? "").toLowerCase();
      const testId = el.getAttribute("data-testid") ?? "";
      return /\/pandacorp:|skill|habilidad/.test(label) || /skill/.test(testId);
    });

    expect(
      looksLikeSkillJump,
      "agent detail must offer clickable skill chips (EARS reverse cross-nav: from an agent's detail jump to a skill that uses it)",
    ).toBe(true);
  });

  it("clicking a using-skill chip in the agent detail opens that skill's detail", async () => {
    const usedRole = findAgentUsedBySomeSkill();
    if (!usedRole) return;

    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-agents"));

    const card = screen
      .getAllByTestId("agent-card")
      .find((el) => el.getAttribute("data-agent-id") === usedRole);
    if (!card) throw new Error(`agent card for "${usedRole}" not found`);
    fireEvent.click(card);

    const detail = screen.getByTestId("agent-detail");
    const jumpChip = within(detail)
      .queryAllByRole("button")
      .find((el) => {
        const label = (el.getAttribute("aria-label") ?? el.textContent ?? "").toLowerCase();
        const testId = el.getAttribute("data-testid") ?? "";
        return /\/pandacorp:|skill|habilidad/.test(label) || /skill/.test(testId);
      });

    expect(
      jumpChip,
      "agent detail must render at least one clickable using-skill chip to click",
    ).toBeTruthy();
    if (!jumpChip) return;

    fireEvent.click(jumpChip);

    // Clicking the chip must open the OTHER item's detail (a skill detail).
    expect(
      screen.queryByTestId("skill-detail"),
      "clicking a using-skill chip must open that skill's detail (EARS: 'opens the other item's detail')",
    ).toBeTruthy();
  });
});
