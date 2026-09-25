/**
 * FRD-03 gate — reviewer-authored integration suite for the relative "last sync" chip
 * (REQ-03-007, WO-03-006), exercised TOGETHER with the VERIFIED FRD-01/03 portfolio reader.
 *
 * Builder-blind (DR-080). The chain under test is the real one: a production-shaped Spanish
 * `factory/portfolio.md` table ("Última sync" header, DR-009) → `readPortfolio()` →
 * `PortfolioEntry.lastSync` → `PortfolioTable` row → chip. Time is pinned with fake timers because
 * the component formats against the real clock.
 *
 * Traceability:
 *   REQ-03-007 / AC-03-007.3  chip present with a date, absent without one, shared CHIP_STYLE.
 *   REQ-03-007 error clause    an unparseable cell is an explicit invalid-date chip, never a
 *                              fabricated age and never hidden (DR-078).
 */

import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PortfolioTableEntry } from "@/components/modules/PortfolioTable/PortfolioTable";
import { PortfolioTable } from "@/components/modules/PortfolioTable/PortfolioTable";
import { readPortfolio } from "@/lib/portfolio/portfolio";

const NOW = new Date("2026-09-24T12:00:00.000Z");

const PROSE_CELL =
  "**Re-check 2026-09-21 (rutina programada):** SIN VEREDICTO NUEVO — precondición no cumplida";

/** Production-shaped Spanish portfolio (same header row as the real gitignored file). */
const SPANISH_PORTFOLIO = [
  "# Portfolio Pandacorp",
  "",
  "| Proyecto | Ruta | Repo | Idea origen | Fase | Usuarios | Retorno | Veredicto | Última sync |",
  "|---|---|---|---|---|---|---|---|---|",
  "| Alfa | `../alfa/` | — | idea-a | implementation | — | personal | — | 2026-09-22 |",
  "| Beta | `../beta/` | — | idea-b | implementation | — | personal | — | — |",
  `| Gamma | \`../gamma/\` | — | idea-c | implementation | — | personal | — | ${PROSE_CELL} |`,
  "| Delta | `../delta/` | — | idea-d | implementation | — | personal | — | N/A 3 |",
  "| Epsilon | `../epsilon/` | — | idea-e | implementation | — | personal | — | 2026-02-30 |",
  "",
].join("\n");

function entriesFromPortfolio(markdown: string): PortfolioTableEntry[] {
  return readPortfolio(markdown).map((entry) => ({ ...entry, exists: true, isRunning: false }));
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

describe("FRD-03 last-sync chip — real portfolio reader → PortfolioTable (REQ-03-007)", () => {
  it("the Spanish 'Última sync' header reaches the row as a relative chip", () => {
    render(<PortfolioTable entries={entriesFromPortfolio(SPANISH_PORTFOLIO)} />);
    const chip = within(rowOf("Alfa")).getByText("sync: hace 2 días");
    expect(chip.getAttribute("title")).toBe("2026-09-22");
  });

  it("a placeholder '—' cell renders no chip for that row (and does not leak one from a sibling)", () => {
    render(<PortfolioTable entries={entriesFromPortfolio(SPANISH_PORTFOLIO)} />);
    expect(within(rowOf("Beta")).queryByText(/^sync:/)).toBeNull();
  });

  it("the real prose-in-the-date-cell shape is an explicit invalid-date chip carrying the raw cell", () => {
    render(<PortfolioTable entries={entriesFromPortfolio(SPANISH_PORTFOLIO)} />);
    const chip = within(rowOf("Gamma")).getByText("sync: fecha inválida");
    expect(chip.getAttribute("title")).toBe(PROSE_CELL);
  });

  it("a non-date cell V8 would leniently parse ('N/A 3') is shown as invalid, never a fabricated age", () => {
    render(<PortfolioTable entries={entriesFromPortfolio(SPANISH_PORTFOLIO)} />);
    const row = rowOf("Delta");
    expect(within(row).getByText(/^sync:/).textContent).toBe("sync: fecha inválida");
    expect(within(row).queryByText(/años/)).toBeNull();
  });

  it("an impossible calendar day ('2026-02-30') is shown as invalid, not silently rolled to March", () => {
    render(<PortfolioTable entries={entriesFromPortfolio(SPANISH_PORTFOLIO)} />);
    expect(within(rowOf("Epsilon")).getByText(/^sync:/).textContent).toBe("sync: fecha inválida");
  });

  it("an invalid date never hides or breaks the rest of the row (name, phase, indicator stay)", () => {
    render(<PortfolioTable entries={entriesFromPortfolio(SPANISH_PORTFOLIO)} />);
    const row = rowOf("Gamma");
    expect(within(row).getByRole("heading", { name: "Gamma" })).toBeDefined();
    expect(within(row).getByTitle("Fase: implementation")).toBeDefined();
    expect(within(row).getByRole("status", { name: "Parado" })).toBeDefined();
  });

  it("the chip reuses the phase chip's exact style (DR-057: one chip treatment, no fork)", () => {
    render(<PortfolioTable entries={entriesFromPortfolio(SPANISH_PORTFOLIO)} />);
    const row = rowOf("Alfa");
    const phaseChip = within(row).getByTitle("Fase: implementation");
    const syncChip = within(row).getByText("sync: hace 2 días");
    expect(syncChip.getAttribute("style")).toBe(phaseChip.getAttribute("style"));
    expect(syncChip.parentElement).toBe(phaseChip.parentElement);
  });

  it("the invalid-date chip uses the same shared style too (conveyed by text, not a new color)", () => {
    render(<PortfolioTable entries={entriesFromPortfolio(SPANISH_PORTFOLIO)} />);
    const row = rowOf("Gamma");
    const phaseChip = within(row).getByTitle("Fase: implementation");
    const syncChip = within(row).getByText("sync: fecha inválida");
    expect(syncChip.getAttribute("style")).toBe(phaseChip.getAttribute("style"));
  });

  it("exactly one chip per dated row — five rows, four dated cells, four chips", () => {
    render(<PortfolioTable entries={entriesFromPortfolio(SPANISH_PORTFOLIO)} />);
    expect(screen.getAllByText(/^sync:/)).toHaveLength(4);
  });

  it("an English 'last sync' header feeds the same chip (header-name mapping, not position)", () => {
    const english = [
      "| name | path | last sync | phase |",
      "|---|---|---|---|",
      "| Zeta | ../zeta | 2026-09-23 | implementation |",
      "",
    ].join("\n");
    render(<PortfolioTable entries={entriesFromPortfolio(english)} />);
    expect(within(rowOf("Zeta")).getByText("sync: ayer")).toBeDefined();
  });
});

describe("FRD-03 last-sync chip — non-row states never render a chip", () => {
  it("loading, error and empty states render no last-sync chip", () => {
    const { rerender } = render(<PortfolioTable entries={[]} isLoading />);
    expect(screen.queryByText(/^sync:/)).toBeNull();
    rerender(<PortfolioTable entries={[]} error="No se pudo leer el portafolio" />);
    expect(screen.queryByText(/^sync:/)).toBeNull();
    rerender(<PortfolioTable entries={[]} />);
    expect(screen.queryByText(/^sync:/)).toBeNull();
  });
});
