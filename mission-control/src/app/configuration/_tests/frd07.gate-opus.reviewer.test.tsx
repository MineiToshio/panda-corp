/**
 * FRD-07 gate (opus), reconciled for WO-07-006: command copy, the internal marker, forward
 * cross-navigation and the model explanation that REQ-07-012 moved to the tier header.
 */
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSkills } from "@/lib/reference/reference";
import { renderRealPage, useRealFactory, visit } from "./_realFactory";

beforeEach(() => useRealFactory());
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const owner = () => readSkills().find((skill) => !skill.internal);

describe("FRD-07 gate (opus)", () => {
  it("REQ-07-004 the dialog command copies the exact string and nothing else", async () => {
    const skill = owner();
    visit(`/configuration/skills/${skill?.slug}`);
    const user = userEvent.setup();
    await renderRealPage();
    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: `Copiar /pandacorp:${skill?.slug}` }),
    );
    expect(await navigator.clipboard.readText()).toBe(`/pandacorp:${skill?.slug}`);
  });

  it("REQ-07-006 internal skills carry «Motor interno» on the row and in the dialog", async () => {
    const internal = readSkills().find((skill) => skill.internal);
    expect(internal).toBeDefined();
    visit("/configuration/skills");
    await renderRealPage();
    const row = screen.getByText(`/pandacorp:${internal?.slug}`).closest("li");
    expect(within(row as HTMLElement).getByText("Motor interno")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`^(?!Copiar ).*:${internal?.slug}\\b`) }),
    );
    expect(within(screen.getByRole("dialog")).getByText("Motor interno")).toBeInTheDocument();
  });

  it("REQ-07-007 the dialog names where a skill runs, with no mini-flow", async () => {
    const skill = readSkills().find((entry) => entry.runsIn === "project");
    visit(`/configuration/skills/${skill?.slug}`);
    await renderRealPage();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Dentro de un proyecto")).toBeInTheDocument();
    expect(within(dialog).queryByTestId("flow-graph")).toBeNull();
    expect(within(dialog).queryByTestId("flow-diagram")).toBeNull();
  });

  it("REQ-07-008 an agent chip in a skill dialog opens that agent", async () => {
    const skill = readSkills().find((entry) => (entry.agents ?? []).includes("reviewer"));
    visit(`/configuration/skills/${skill?.slug}`);
    await renderRealPage();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "reviewer" }));
    expect(window.location.pathname).toBe("/configuration/agents/reviewer");
    expect(within(screen.getByRole("dialog")).getByText("Herramientas:")).toBeInTheDocument();
  });

  it("REQ-07-012 explains each model tier once, in its group header", async () => {
    visit("/configuration/agents");
    await renderRealPage();
    expect(screen.getByText(/Juicio y diseño/)).toBeInTheDocument();
    expect(screen.getByText("Usa el modelo de la sesión que lo llama.")).toBeInTheDocument();
  });
});
