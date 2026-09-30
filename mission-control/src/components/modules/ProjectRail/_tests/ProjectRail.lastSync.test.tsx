/**
 * ProjectRail — relative "last sync" chip on the MOUNTED selectable row (REQ-03-007, AC-03-007.3).
 *
 * The chip first shipped on a component no route mounted; the rail is the surface
 * the owner actually sees, so the chip is asserted here, through the rail's public output.
 */

import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectRail } from "@/components/modules/ProjectRail/ProjectRail";
import { activeProjects, type ProjectListItem } from "@/lib/portfolio/portfolio";
import type { StatusResult } from "@/lib/status/status";

const NOW = new Date("2026-09-24T12:00:00.000Z");

const STATUS: StatusResult = {
  present: true,
  malformed: false,
  status: { phase: "implementation", running: true },
};

function makeItem(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    name: "proj-alpha",
    path: "/projects/proj-alpha",
    status: STATUS,
    exists: true,
    stage: "implementation",
    running: true,
    ...overrides,
  };
}

function rowOf(name: string): HTMLElement {
  return screen.getByRole("article", { name: `Proyecto: ${name}` });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ProjectRail selectable row — last-sync chip (REQ-03-007)", () => {
  it("AC-03-007.3 — shows the relative time since the last sync, in Spanish", () => {
    render(
      <ProjectRail items={[makeItem({ lastSync: "2026-09-22" })]} selectedSlug="proj-alpha" />,
    );

    const chip = within(rowOf("proj-alpha")).getByTestId("portfolio-row-last-sync");
    expect(chip.textContent).toBe("sync: hace 2 días");
    expect(chip.getAttribute("title")).toBe("2026-09-22");
  });

  it("AC-03-007.1 — 'hoy' and 'ayer' for the two most recent days", () => {
    render(
      <ProjectRail
        items={[
          makeItem({ name: "a", lastSync: "2026-09-24" }),
          makeItem({ name: "b", lastSync: "2026-09-23" }),
        ]}
        selectedSlug="a"
      />,
    );

    expect(within(rowOf("a")).getByTestId("portfolio-row-last-sync").textContent).toBe("sync: hoy");
    expect(within(rowOf("b")).getByTestId("portfolio-row-last-sync").textContent).toBe(
      "sync: ayer",
    );
  });

  it("renders no chip when the entry has no last sync", () => {
    render(<ProjectRail items={[makeItem()]} selectedSlug="proj-alpha" />);

    expect(within(rowOf("proj-alpha")).queryByTestId("portfolio-row-last-sync")).toBeNull();
  });

  it("AC-03-007.2 — an unparseable date is an explicit invalid-date chip, never hidden or invented", () => {
    render(<ProjectRail items={[makeItem({ lastSync: "N/A 3" })]} selectedSlug="proj-alpha" />);

    const chip = within(rowOf("proj-alpha")).getByTestId("portfolio-row-last-sync");
    expect(chip.textContent).toBe("sync: fecha inválida");
    expect(chip.getAttribute("title")).toBe("N/A 3");
  });

  it("keeps the chip inside the row's navigation link (one click target, no nested control)", () => {
    render(
      <ProjectRail items={[makeItem({ lastSync: "2026-09-22" })]} selectedSlug="proj-alpha" />,
    );

    const link = within(rowOf("proj-alpha")).getByRole("link", {
      name: "Seleccionar proyecto: proj-alpha",
    });
    expect(within(link).getByTestId("portfolio-row-last-sync")).toBeTruthy();
  });

  it("real chain: a Spanish 'Última sync' table reaches the rail; prose and impossible dates are explicit invalid chips", () => {
    const prose = "**Re-check 2026-09-21 (rutina programada):** SIN VEREDICTO NUEVO";
    const table = [
      "| Proyecto | Ruta | Repo | Idea origen | Fase | Usuarios | Retorno | Veredicto | Última sync |",
      "|---|---|---|---|---|---|---|---|---|",
      "| Alfa | `/nonexistent/alfa/` | — | i | implementation | — | personal | — | 2026-09-22 |",
      "| Beta | `/nonexistent/beta/` | — | i | implementation | — | personal | — | — |",
      `| Gamma | \`/nonexistent/gamma/\` | — | i | implementation | — | personal | — | ${prose} |`,
      "| Delta | `/nonexistent/delta/` | — | i | implementation | — | personal | — | 2026-02-30 |",
      "",
    ].join("\n");

    render(<ProjectRail items={activeProjects(table)} selectedSlug="Alfa" />);

    expect(within(rowOf("Alfa")).getByTestId("portfolio-row-last-sync").textContent).toBe(
      "sync: hace 2 días",
    );
    expect(within(rowOf("Beta")).queryByTestId("portfolio-row-last-sync")).toBeNull();
    expect(within(rowOf("Gamma")).getByTestId("portfolio-row-last-sync").textContent).toBe(
      "sync: fecha inválida",
    );
    expect(within(rowOf("Delta")).getByTestId("portfolio-row-last-sync").textContent).toBe(
      "sync: fecha inválida",
    );
  });
});
