/**
 * FRD-11 / FRD-04 gate: the Comandos tab through `TabCommands` mounting the shared
 * `BuildModePicker` over the real mode store and `workspaceCommands`.
 *
 *   A. REQ-04-006 four cards in the drawn reading order, in every phase.
 *   B. REQ-04-006 next step then phase commands, deduped, each with its «when» line.
 *   C. REQ-11-003 a pick persists per project; remount and project switch honour it.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRememberedMode } from "@/lib/build-mode-store";
import { BUILD_MODES, DEFAULT_BUILD_MODE } from "@/lib/constants";
import { workspaceCommands } from "@/lib/next-step/next-step";
import type { Phase } from "@/lib/status/status";
import { TabCommands } from "../tab-commands";

const ALL_PHASES: readonly Phase[] = [
  "product",
  "design",
  "architecture",
  "implementation",
  "release",
];
const CARD_TITLES = [
  "Siguiente paso",
  "Modo de construcción",
  "Construir un objetivo concreto",
  "Cambios y decisiones",
];
const NO_COMMANDS = "No hay comandos de fase para este proyecto.";

function modeButton(name: RegExp): HTMLElement {
  const slot = screen.getByTestId("mode-selector-slot");
  return within(slot).getByRole("button", { name });
}
function modeCommand(): string {
  return screen.getByTestId("mode-cmd").textContent ?? "";
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("REQ-04-006: four cards in every phase", () => {
  for (const phase of ALL_PHASES) {
    it(`phase=${phase} draws the four cards in order and every phase-independent command`, () => {
      render(<TabCommands phase={phase} slug="mc" />);

      expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual(
        CARD_TITLES,
      );
      expect(screen.getByRole("combobox", { name: "Objetivo del build" })).toBeInTheDocument();
      for (const command of ["/pandacorp:change", "/pandacorp:decide", "/pandacorp:new-version"])
        expect(screen.getAllByRole("button", { name: `Copiar ${command}` })).not.toHaveLength(0);
      expect(screen.queryByRole("main")).not.toBeInTheDocument();
      expect(screen.getAllByTestId("mode-selector-slot")).toHaveLength(1);
    });
  }
});

describe("REQ-04-006: Siguiente paso", () => {
  for (const phase of ALL_PHASES) {
    it(`phase=${phase} shows each phase command with its when line`, () => {
      render(<TabCommands phase={phase} slug="mc" />);
      for (const row of workspaceCommands(phase)) {
        expect(screen.getAllByRole("button", { name: `Copiar ${row.command}` })).not.toHaveLength(
          0,
        );
        expect(screen.getByText(row.when)).toBeInTheDocument();
      }
    });
  }

  it("the next step comes first and a command it shares with the phase appears once", () => {
    render(
      <TabCommands
        phase="implementation"
        slug="mc"
        nextStep={{ command: "/pandacorp:release", sentence: "Quedan 2 work orders." }}
      />,
    );
    expect(screen.getAllByRole("button", { name: "Copiar /pandacorp:release" })).toHaveLength(1);
    expect(screen.getByText("Quedan 2 work orders.")).toBeInTheDocument();
  });

  it("a next step with no sentence keeps the when line of the phase command it dedupes with", () => {
    const [row] = workspaceCommands("design");
    render(
      <TabCommands
        phase="design"
        slug="mc"
        nextStep={{ command: row?.command ?? "", sentence: null }}
      />,
    );
    expect(screen.getByText(row?.when ?? "")).toBeInTheDocument();
  });

  it("no phase is the catalogue sentence, never a crash nor a misleading command", () => {
    render(
      <TabCommands
        phase={undefined}
        slug="mc"
        nextStep={{ command: "/pandacorp:spec", sentence: null }}
      />,
    );
    expect(screen.getByText(NO_COMMANDS)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copiar /pandacorp:spec" })).toBeNull();
  });
});

describe("REQ-11-003: the mode is remembered per project through the real mount", () => {
  it("a pick writes this project's preference and shows the catalog command", () => {
    render(<TabCommands phase="implementation" slug="reload-proj" />);
    const labels = { pro: /^Pro\b/, powerful: /^Potente/, deep: /^Profundo/ } as const;
    for (const mode of BUILD_MODES.filter((item) => item.id !== "balanced")) {
      fireEvent.click(modeButton(labels[mode.id as keyof typeof labels]));
      expect(getRememberedMode("reload-proj")).toBe(mode.id);
      expect(modeCommand()).toContain(mode.command);
    }
  });

  it("slug A's mode never selects for slug B, and a remount restores A", () => {
    render(<TabCommands phase="implementation" slug="A" />);
    fireEvent.click(modeButton(/^Profundo/));
    cleanup();

    render(<TabCommands phase="implementation" slug="B" />);
    expect(modeButton(/^Equilibrado/)).toHaveAttribute("aria-pressed", "true");
    expect(getRememberedMode("B")).toBe(DEFAULT_BUILD_MODE);
    cleanup();

    render(<TabCommands phase="release" slug="A" />);
    expect(modeButton(/^Profundo/)).toHaveAttribute("aria-pressed", "true");
  });

  it("a client-side project switch on the same mount follows the new project", () => {
    const { rerender } = render(<TabCommands phase="implementation" slug="A" />);
    fireEvent.click(modeButton(/^Potente/));
    rerender(<TabCommands phase="implementation" slug="B" />);
    expect(modeButton(/^Equilibrado/)).toHaveAttribute("aria-pressed", "true");
    rerender(<TabCommands phase="implementation" slug="A" />);
    expect(modeButton(/^Potente/)).toHaveAttribute("aria-pressed", "true");
  });
});
