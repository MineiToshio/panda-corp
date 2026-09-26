/**
 * FRD-03 gate (reviewer-authored, DR-080) — REQ-03-007 on the REAL, mounted Portfolio rail.
 *
 * REQ-03-007: "WHEN a portfolio entry carries a `last sync` date, its project row SHALL show a
 * chip with the relative time since that sync in Spanish (...); an unparseable date SHALL be
 * shown as an explicit invalid-date chip, never hidden silently."
 *
 * The project row the owner actually sees on /portfolio is the selectable row of the shared
 * `ProjectRail`, fed by `activeProjects()` (src/app/portfolio/page.tsx). These tests mount that
 * exact production path (same wiring as page.tsx: activeProjects → deriveSelectedSlug →
 * <ProjectRail selectedSlug>) with an inline portfolio table that carries a `last sync` column —
 * the same column the real factory portfolio (`Última sync`) and the e2e fixture (`Last sync`) carry.
 *
 * Assertions are on visible text within each row (not on a testid) so any correct placement of
 * the chip inside the row satisfies them.
 */

import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectRail } from "@/components/modules/ProjectRail/ProjectRail";
import { activeProjects } from "@/lib/portfolio/portfolio";
import { deriveSelectedSlug } from "../selection";

const NOW = new Date("2026-09-24T12:00:00.000Z");

const PORTFOLIO_MD = [
  "| name | path | phase | last sync |",
  "|---|---|---|---|",
  "| Alfa | ../nonexistent-reviewer-alfa-7b44/ | implementation | 2026-09-22 |",
  "| Beta | ../nonexistent-reviewer-beta-7b44/ | implementation | not-a-date |",
  "| Gamma | ../nonexistent-reviewer-gamma-7b44/ | implementation | — |",
  "",
].join("\n");

function mountRailLikePage(): HTMLElement[] {
  const items = activeProjects(PORTFOLIO_MD);
  const selectedSlug = deriveSelectedSlug(items, undefined);
  render(<ProjectRail items={items} selectedSlug={selectedSlug ?? ""} />);
  return screen.getAllByTestId("selectable-project-row");
}

function rowNamed(rows: HTMLElement[], name: string): HTMLElement {
  const row = rows.find((r) => r.getAttribute("aria-label") === `Proyecto: ${name}`);
  if (row === undefined) throw new Error(`row ${name} not mounted`);
  return row;
}

describe("REQ-03-007 — last-sync chip reaches the mounted /portfolio rail (integration)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("activeProjects() carries the portfolio row's lastSync through to the rail item", () => {
    const [alfa] = activeProjects(PORTFOLIO_MD);
    expect(alfa?.name).toBe("Alfa");
    expect((alfa as unknown as { lastSync?: string }).lastSync).toBe("2026-09-22");
  });

  it("the mounted rail row of an entry with a last sync shows its relative time in Spanish", () => {
    const rows = mountRailLikePage();
    expect(within(rowNamed(rows, "Alfa")).getByText(/hace 2 días/)).toBeDefined();
  });

  it("an unparseable last sync shows an explicit invalid-date chip on the mounted row, never hidden", () => {
    const rows = mountRailLikePage();
    expect(within(rowNamed(rows, "Beta")).getByText(/inválid/i)).toBeDefined();
  });

  it("an entry without a last sync (placeholder cell) shows no sync chip on the mounted row", () => {
    const rows = mountRailLikePage();
    const gamma = rowNamed(rows, "Gamma");
    expect(within(gamma).queryByText(/hace \d+|inválid/i)).toBeNull();
  });
});
