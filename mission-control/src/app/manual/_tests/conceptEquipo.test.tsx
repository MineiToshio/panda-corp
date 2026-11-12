/**
 * "El equipo" Manual page (FRD-08): the roster the owner reads must be the roster the
 * plugin ships. The page keeps its own Spanish bios (the catalog under Referencia
 * only shows the English agent descriptions), so this guard fails when an agent is
 * added to `plugin/agents/` without a card here.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readAgents } from "@/lib/reference/reference";
import { getManualPageComponent } from "../manualPages";

function renderTeamPage(): void {
  const Page = getManualPageComponent("el-equipo");
  if (Page === null) throw new Error("expected a bespoke renderer for el-equipo");
  render(<Page />);
}

describe("el-equipo page", () => {
  it("has a bio card for every agent in plugin/agents (single roster)", () => {
    renderTeamPage();
    const shipped = readAgents().map((agent) => agent.id);
    expect(shipped.length).toBeGreaterThan(10);
    for (const id of shipped) {
      expect(
        screen.queryByRole("region", { name: id }),
        `agent "${id}" ships in plugin/agents but has no card on the team page`,
      ).not.toBeNull();
    }
  });

  it("REQ-08-019 has no extra or retired bio cards", () => {
    renderTeamPage();
    expect(
      screen
        .getAllByRole("region")
        .map((region) => region.getAttribute("aria-labelledby")?.replace("team-bio-", ""))
        .sort(),
    ).toEqual(
      readAgents()
        .map((agent) => agent.id)
        .sort(),
    );
    expect(screen.queryByRole("region", { name: "drift-finder" })).toBeNull();
    expect(screen.queryByRole("region", { name: "mech" })).toBeNull();
  });

  it("keeps the phase-grouped diagram (one avatar card per agent)", () => {
    renderTeamPage();
    expect(screen.getByTestId("manual-diagram-team")).toBeTruthy();
  });
});
