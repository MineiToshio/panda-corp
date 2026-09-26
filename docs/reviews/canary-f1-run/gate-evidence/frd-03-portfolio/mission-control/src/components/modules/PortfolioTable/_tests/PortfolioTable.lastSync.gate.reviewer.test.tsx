/**
 * FRD-03 gate — reviewer-authored integration suite for the last-sync chip (REQ-03-007,
 * AC-03-007.3). Builder-blind (DR-080, constitution §22).
 *
 * Exercises the feature's work orders TOGETHER on a production-shaped fixture: the factory's
 * Spanish portfolio table (`Última sync` header, date-only cells, the "—" placeholder, a
 * hand-typed malformed cell) is read by `readPortfolio` (FRD-01) and rendered by
 * `PortfolioTable`'s `ProjectRow` (WO-03-002 + WO-03-006). Clock pinned via fake `Date` in the
 * owner's timezone (America/Lima, UTC-5), where Mission Control runs.
 */

import { render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  PortfolioTable,
  type PortfolioTableEntry,
} from "@/components/modules/PortfolioTable/PortfolioTable";
import { readPortfolio } from "@/lib/portfolio/portfolio";

const ORIGINAL_TZ = process.env.TZ;

beforeAll(() => {
  process.env.TZ = "America/Lima";
});

afterAll(() => {
  if (ORIGINAL_TZ === undefined) Reflect.deleteProperty(process.env, "TZ");
  else process.env.TZ = ORIGINAL_TZ;
});

afterEach(() => {
  vi.useRealTimers();
});

const SPANISH_PORTFOLIO = [
  "# Portfolio Pandacorp",
  "",
  "| Proyecto | Ruta | Repo | Idea origen | Fase | Usuarios | Retorno | Veredicto | Última sync |",
  "|---|---|---|---|---|---|---|---|---|",
  "| Synced | `../synced/` | — | idea-a | implementation | — | personal | — | 2026-09-07 |",
  "| Never | `../never/` | — | idea-b | implementation | — | personal | — | — |",
  "| Typo | `../typo/` | — | idea-c | release | — | personal | — | pendiente |",
  "| Today | `../today/` | — | idea-d | implementation | — | personal | — | 2026-09-10 |",
  "",
].join("\n");

function renderFromPortfolio(): void {
  const entries: PortfolioTableEntry[] = readPortfolio(SPANISH_PORTFOLIO).map((entry) => ({
    ...entry,
    exists: true,
    isRunning: false,
  }));
  render(<PortfolioTable entries={entries} />);
}

function rowOf(name: string): HTMLElement {
  return screen.getByRole("article", { name: `Proyecto: ${name}` });
}

describe("REQ-03-007 integration — readPortfolio → PortfolioTable last-sync chip", () => {
  it("the Spanish 'Última sync' cell reaches the row as a relative chip carrying the raw date", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-10T12:00:00-05:00"));
    renderFromPortfolio();

    const chip = within(rowOf("Synced")).getByTitle("2026-09-07");
    expect(chip).toHaveTextContent(/^sync: hace 3 días$/);
  });

  it("a placeholder '—' cell renders NO chip — absence is not an invalid date", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-10T12:00:00-05:00"));
    renderFromPortfolio();

    expect(within(rowOf("Never")).queryByText(/^sync:/)).toBeNull();
  });

  it("a hand-typed malformed cell renders an explicit text invalid-date chip, never hidden (DR-078)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-10T12:00:00-05:00"));
    renderFromPortfolio();

    const chip = within(rowOf("Typo")).getByTitle("pendiente");
    expect(chip).toHaveTextContent("sync: fecha inválida");
  });

  it("the chip reuses the row's shared chip style verbatim (DR-057) — identical to the phase chip", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-10T12:00:00-05:00"));
    renderFromPortfolio();

    const row = rowOf("Synced");
    const syncChip = within(row).getByTitle("2026-09-07");
    const phaseChip = within(row).getByTitle("Fase: implementation");
    expect(syncChip.getAttribute("style")).toBe(phaseChip.getAttribute("style"));
  });

  it("each row carries only its own chip — no cross-row leakage", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-10T12:00:00-05:00"));
    renderFromPortfolio();

    expect(within(rowOf("Synced")).getAllByText(/^sync:/)).toHaveLength(1);
    expect(within(rowOf("Today")).getAllByText(/^sync:/)).toHaveLength(1);
    expect(within(rowOf("Today")).getByTitle("2026-09-10")).toHaveTextContent(/^sync: hoy$/);
  });

  it("at 23:26 in the owner's evening, a row synced today still reads 'sync: hoy' (AC-03-007.1)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-10T23:26:00-05:00"));
    renderFromPortfolio();

    expect(within(rowOf("Today")).getByTitle("2026-09-10")).toHaveTextContent(/^sync: hoy$/);
  });
});
