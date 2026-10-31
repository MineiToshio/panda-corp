/**
 * FRD-07 gate (opus), reconciled for WO-07-006: REQ-07-008's reverse clause over the real data
 * edges. The dialog lists exactly the skills that use the agent, and each chip opens that skill.
 */
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readAgents, readSkills } from "@/lib/reference/reference";
import { renderRealPage, useRealFactory, visit } from "./_realFactory";

beforeEach(() => useRealFactory());
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function target(): { agentId: string; users: string[] } {
  const ids = new Set(readAgents().map((agent) => agent.id));
  const skills = readSkills();
  const agentId = skills.flatMap((skill) => skill.agents ?? []).find((id) => ids.has(id));
  if (!agentId) throw new Error("the real factory declares skill-to-agent edges");
  return {
    agentId,
    users: skills.filter((skill) => skill.agents?.includes(agentId)).map((skill) => skill.slug),
  };
}

describe("FRD-07 gate (opus): reverse cross-navigation", () => {
  it("lists every using skill and jumps to one", async () => {
    const { agentId, users } = target();
    visit(`/configuration/agents/${agentId}`);
    await renderRealPage();
    const dialog = screen.getByRole("dialog");
    for (const slug of users) {
      expect(
        within(dialog).getByRole("button", { name: `/pandacorp:${slug}` }),
      ).toBeInTheDocument();
    }
    fireEvent.click(within(dialog).getByRole("button", { name: `/pandacorp:${users[0]}` }));
    expect(window.location.pathname).toBe(`/configuration/skills/${users[0]}`);
    expect(screen.getByRole("dialog", { name: `/pandacorp:${users[0]}` })).toBeInTheDocument();
  });
});
