/**
 * FRD-11 gate, second pass: the mode command, the scoped target and the read-only contract
 * through the mounted tab.
 *
 *   F. REQ-11-002/004 exact command per mode; Equilibrado carries no argument.
 *   G. AC-11-005.1 card anatomy.
 *   H. FRD-11 exclusion: copy only, nothing launches a build.
 *   I. Edge: corrupt or unknown stored value opens on Equilibrado.
 *   J. AC-11-005.2 the worked example, clearing, forged values and the project reset.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BUILD_MODES } from "@/lib/constants";
import { TabCommands } from "../tab-commands";

const TARGETS = [
  { value: "FRD-01", label: "FRD-01 · Lectura" },
  { value: "WO-01-003", label: "WO-01-003 · Board" },
  { value: "change:mc-fix-dates", label: "Cambio · Fechas" },
];
const keyFor = (slug: string) => `mc:build-mode:${slug}`;
const select = () => screen.getByRole("combobox", { name: "Objetivo del build" });
const copy = (command: string) => screen.queryByRole("button", { name: `Copiar ${command}` });
const pressed = (name: RegExp) =>
  within(screen.getByTestId("mode-selector-slot")).getByRole("button", { name });

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("REQ-11-002/004: exact command per mode", () => {
  it("Equilibrado preselected, no argument, no mode token leaks into the box", () => {
    render(<TabCommands phase="architecture" slug="exact" />);
    expect(pressed(/^Equilibrado/)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("mode-cmd").textContent).not.toMatch(/balanced/);
    expect(BUILD_MODES.find((mode) => mode.id === "balanced")?.command).toBe(
      "/pandacorp:implement",
    );
  });

  it.each([
    ["Pro", "pro"],
    ["Potente", "powerful"],
    ["Profundo", "deep"],
  ])("%s shows /pandacorp:implement %s, and Equilibrado drops it again", (label, argument) => {
    render(<TabCommands phase="architecture" slug="exact2" />);
    fireEvent.click(pressed(new RegExp(`^${label}\\b`)));
    expect(screen.getByTestId("mode-cmd")).toHaveTextContent(`/pandacorp:implement ${argument}`);
    fireEvent.click(pressed(/^Equilibrado/));
    expect(screen.getByTestId("mode-cmd").textContent).not.toContain(argument);
  });
});

describe("AC-11-005.1: four selectable cards", () => {
  it("each card has its tag and a 1 to 4 power meter", () => {
    render(<TabCommands phase="implementation" slug="cards" />);
    const slot = within(screen.getByTestId("mode-selector-slot"));
    expect(slot.getByRole("button", { name: /^Pro\b.*pro/s })).toBeInTheDocument();
    expect(slot.getByRole("button", { name: /^Equilibrado.*por defecto/s })).toBeInTheDocument();
    expect(slot.getByRole("button", { name: /^Potente.*powerful/s })).toBeInTheDocument();
    expect(slot.getByRole("button", { name: /^Profundo.*deep/s })).toBeInTheDocument();
    for (const power of [1, 2, 3, 4])
      expect(slot.getAllByLabelText(new RegExp(`${power} de 4`)).length).toBeGreaterThan(0);
  });
});

describe("FRD-11 exclusion: the tab never launches a build", () => {
  it("no form, submit or run affordance anywhere in the tab", () => {
    render(<TabCommands phase="implementation" slug="readonly" targets={TARGETS} />);
    const body = screen.getByTestId("tab-commands-body");
    expect(within(body).queryByRole("form")).toBeNull();
    for (const button of within(body).getAllByRole("button")) {
      const label = button.getAttribute("aria-label") ?? button.textContent ?? "";
      expect(label).not.toMatch(/ejecut|lanza|iniciar|\brun\b/i);
      expect(button.getAttribute("type")).not.toBe("submit");
    }
  });
});

describe("Edge: a project with no valid remembered mode", () => {
  it.each([
    '{"not":"a-mode"}<script>',
    "ultra-deep",
    "",
  ])("stored %j opens on Equilibrado", (raw) => {
    localStorage.setItem(keyFor("corrupt"), raw);
    expect(() => render(<TabCommands phase="design" slug="corrupt" />)).not.toThrow();
    expect(pressed(/^Equilibrado/)).toHaveAttribute("aria-pressed", "true");
  });
});

describe("AC-11-005.2: scoped target", () => {
  it("the placeholder box reads <id>; each pick scopes the command", () => {
    render(<TabCommands phase="release" slug="target" targets={TARGETS} />);
    expect(copy("/pandacorp:implement <id>")).toBeInTheDocument();
    expect(within(select()).getAllByRole("option")[0]).toHaveTextContent(
      "Elige un FRD o work order…",
    );
    for (const { value } of TARGETS) {
      fireEvent.change(select(), { target: { value } });
      expect(copy(`/pandacorp:implement ${value}`)).toBeInTheDocument();
    }
    fireEvent.change(select(), { target: { value: "" } });
    expect(copy("/pandacorp:implement <id>")).toBeInTheDocument();
  });

  it("the mode never joins the target command (worked example)", () => {
    render(<TabCommands phase="implementation" slug="worked" targets={TARGETS} />);
    fireEvent.click(pressed(/^Potente/));
    fireEvent.change(select(), { target: { value: "change:mc-fix-dates" } });
    expect(copy("/pandacorp:implement change:mc-fix-dates")).toBeInTheDocument();
    expect(copy("/pandacorp:implement powerful")).toBeInTheDocument();
    fireEvent.click(pressed(/^Equilibrado/));
    expect(copy("/pandacorp:implement change:mc-fix-dates")).toBeInTheDocument();
  });

  it("a target that vanished from the options falls back to the placeholder", () => {
    const { rerender } = render(
      <TabCommands phase="implementation" slug="gone" targets={TARGETS} />,
    );
    fireEvent.change(select(), { target: { value: "WO-01-003" } });
    rerender(<TabCommands phase="implementation" slug="gone" targets={TARGETS.slice(0, 1)} />);
    expect(copy("/pandacorp:implement <id>")).toBeInTheDocument();
    expect(copy("/pandacorp:implement WO-01-003")).toBeNull();
  });

  it("switching project resets the view-local target; no targets leaves only the placeholder", () => {
    const { rerender } = render(<TabCommands phase="implementation" slug="a" targets={TARGETS} />);
    fireEvent.change(select(), { target: { value: "FRD-01" } });
    rerender(<TabCommands phase="implementation" slug="b" targets={TARGETS} />);
    expect(select()).toHaveValue("");
    rerender(<TabCommands phase="implementation" slug="c" />);
    expect(within(select()).getAllByRole("option")).toHaveLength(1);
  });
});
