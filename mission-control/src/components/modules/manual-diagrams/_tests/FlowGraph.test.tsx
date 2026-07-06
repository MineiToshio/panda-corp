/**
 * FlowGraph (FRD-08) — the interactive step-by-step skill flow.
 *
 * Covers: ordered step nodes by kind, the "en paralelo" tag, the loop badge, and the CLICKABLE
 * skill/agent nodes wired to ManualNavContext (the navigable doc graph the owner asked for).
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ManualNav } from "@/app/manual/ManualNavContext";
import { ManualNavProvider } from "@/app/manual/ManualNavContext";
import type { SkillFlow } from "@/lib/manual/skill-flows";
import { FlowGraph } from "../FlowGraph";

const SAMPLE: SkillFlow = {
  slug: "demo",
  explainer: "demo",
  runsIn: "project",
  steps: [
    {
      title: "Preflight",
      kind: "gate",
      detail: "checks the marker",
      calls: [{ ref: "upgrade", as: "skill" }],
    },
    {
      title: "Build in parallel",
      kind: "loop",
      detail: "builds the work orders",
      parallel: true,
      calls: [
        { ref: "backend-dev", as: "agent" },
        { ref: "frontend-dev", as: "agent" },
      ],
    },
    { title: "Commit", kind: "safe", detail: "safe point" },
  ],
  loop: "repeats per FRD",
};

function renderWithNav(nav: Pick<ManualNav, "goToSkill" | "goToAgent">) {
  return render(
    <ManualNavProvider value={{ ...nav, goToManual: vi.fn() }}>
      <FlowGraph flow={SAMPLE} />
    </ManualNavProvider>,
  );
}

describe("FlowGraph", () => {
  it("renders one node per step, in order, tagged by kind", () => {
    renderWithNav({ goToSkill: vi.fn(), goToAgent: vi.fn() });
    expect(screen.getByTestId("flow-step-0").getAttribute("data-flow-kind")).toBe("gate");
    expect(screen.getByTestId("flow-step-1").getAttribute("data-flow-kind")).toBe("loop");
    expect(screen.getByTestId("flow-step-2").getAttribute("data-flow-kind")).toBe("safe");
  });

  it("shows the 'en paralelo' tag on a parallel step and the loop badge", () => {
    renderWithNav({ goToSkill: vi.fn(), goToAgent: vi.fn() });
    expect(within(screen.getByTestId("flow-step-1")).getByText("en paralelo")).toBeDefined();
    expect(screen.getByTestId("flow-loop").textContent).toContain("repeats per FRD");
  });

  it("a skill node click navigates to that skill's doc (goToSkill)", () => {
    const goToSkill = vi.fn();
    renderWithNav({ goToSkill, goToAgent: vi.fn() });
    fireEvent.click(screen.getByTestId("flow-call-skill-upgrade"));
    expect(goToSkill).toHaveBeenCalledWith("upgrade");
  });

  it("an agent node click navigates to that agent's card (goToAgent)", () => {
    const goToAgent = vi.fn();
    renderWithNav({ goToSkill: vi.fn(), goToAgent });
    fireEvent.click(screen.getByTestId("flow-call-agent-backend-dev"));
    expect(goToAgent).toHaveBeenCalledWith("backend-dev");
  });
});
