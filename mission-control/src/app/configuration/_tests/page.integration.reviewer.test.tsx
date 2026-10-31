/**
 * FRD-07 reviewer integration, reconciled for WO-07-006: page -> resolver -> shell over the REAL
 * factory, unmocked. The strict catalog readers must accept the production tree, because one
 * rejected file replaces a whole catalog with its error notice (DR-078).
 */
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readAgents } from "@/lib/reference/reference";
import { renderRealPage, useRealFactory, visit } from "./_realFactory";

beforeEach(() => useRealFactory());
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("frd-07 page integration over the real factory", () => {
  it("opens on the Resumen with four tiles and no read error", async () => {
    await renderRealPage();
    expect(screen.getByRole("tab", { name: "Resumen", selected: true })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("REQ-07-011 lists every real agent with its avatar and no XP", async () => {
    visit("/configuration/agents");
    await renderRealPage();
    const agents = readAgents();
    expect(agents.length).toBeGreaterThan(10);
    for (const agent of agents) {
      expect(screen.getAllByText(agent.name ?? agent.id).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("agent-card-level")).not.toBeInTheDocument();
  });

  it("REQ-07-003 opens an agent in a dialog without level, title or XP bar", async () => {
    visit("/configuration/agents");
    await renderRealPage();
    const [first] = readAgents();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(first?.name ?? "") }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Herramientas:")).toBeInTheDocument();
    expect(within(dialog).queryByTestId("xp-bar")).not.toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/nivel|work orders? cerrad/i);
  });
});
