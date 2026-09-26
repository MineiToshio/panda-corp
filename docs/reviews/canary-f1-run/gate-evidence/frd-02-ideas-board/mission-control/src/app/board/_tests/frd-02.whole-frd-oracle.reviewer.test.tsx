/**
 * FRD-02 — Ideas board — REVIEWER whole-FRD oracle gaps (builder-blind, DR-080).
 *
 * The whole-FRD traceability sweep (WO-02-014 gate) found normative FRD-02 clauses that no test
 * pinned. These lock them against the real components:
 *
 *   1. "Board columns use La Campaña's phase names (numbered)": `1 Investigación · 2 Producto ·
 *      3 Diseño · 4 Arquitectura · 5 Construcción · 6 Release`, in that order, and no discarded
 *      column is rendered on the board.
 *   2. "Does NOT include — No mode selector / pause / reset controls in La Campaña (those are
 *      demo-only in the prototype)": the prototype's `◀ Fase anterior` / `Fase siguiente ▶` stepping
 *      and any pause/reset control never appear, for ANY active phase (research … release).
 *   3. AC-02-010.9 limits: a command with modes renders a `<select>` whose FIRST option is the
 *      neutral word `default`; its custom tooltip appears on focus, is wired as `aria-describedby`
 *      and is bounded to a max width of 240px.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/IdeaBoardView";
import { IdeaBoardView } from "@/app/board/IdeaBoardView/IdeaBoardView";
import type { CampaignPipelineProps } from "@/components/modules/CampaignPipeline/CampaignPipeline";
import { CampaignPipeline } from "@/components/modules/CampaignPipeline/CampaignPipeline";

const CARD: BoardCardEntry = {
  slug: "idea-a",
  title: "Idea A",
  status: "discovered",
  body: "Resumen.",
  boardColumn: "discovered",
};

function campaign(overrides: Partial<CampaignPipelineProps> = {}): CampaignPipelineProps {
  return { slug: "mi-idea", activePhase: 0, onEnterForge: vi.fn(), ...overrides };
}

describe("FRD-02 board columns — La Campaña's numbered phase names", () => {
  it("renders exactly the six numbered column headings in pipeline order (no discarded column)", () => {
    render(<IdeaBoardView cards={[CARD]} />);

    const headings = within(screen.getByTestId("board-scroll-container"))
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent?.trim());

    expect(headings).toEqual([
      "1 Investigación",
      "2 Producto",
      "3 Diseño",
      "4 Arquitectura",
      "5 Construcción",
      "6 Release",
    ]);
    expect(screen.queryByTestId("board-column-discarded")).toBeNull();
    expect(screen.queryByRole("heading", { name: /descartad/i })).toBeNull();
  });
});

describe("FRD-02 exclusion — no demo mode selector / pause / reset in La Campaña", () => {
  const DEMO_CONTROL = /fase anterior|fase siguiente|pausa|pausar|reanudar demo|reiniciar|reset/i;

  it.each([
    0, 1, 2, 3, 4, 5,
  ] as const)("active phase %i renders none of the prototype's demo controls", (activePhase) => {
    render(<CampaignPipeline {...campaign({ activePhase })} />);

    const buttons = screen.queryAllByRole("button");
    const demo = buttons.filter(
      (b) =>
        DEMO_CONTROL.test(b.textContent ?? "") ||
        DEMO_CONTROL.test(b.getAttribute("aria-label") ?? ""),
    );
    expect(demo).toEqual([]);
  });
});

describe("AC-02-010.9 — mode select: 'default' first, bounded custom tooltip", () => {
  it("the architecture ficha's /pandacorp:implement select starts with 'default' and shows a ≤240px described-by tooltip on focus", () => {
    // Architecture (index 3) is the phase whose advance step is /pandacorp:implement (with modes).
    render(<CampaignPipeline {...campaign({ activePhase: 3 })} />);

    const select = screen.getAllByRole("combobox", { name: "Modo del comando" })[0];
    expect(select).toBeDefined();
    if (select === undefined) return;

    const options = within(select).getAllByRole("option");
    expect(options[0]?.textContent).toBe("default");
    expect(options.length).toBeGreaterThan(1);

    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.focus(select);
    const tip = screen.getByRole("tooltip");
    expect(select.getAttribute("aria-describedby")).toBe(tip.id);
    expect(tip.style.maxWidth).toBe("240px");
    expect((tip.textContent ?? "").length).toBeGreaterThan(0);

    fireEvent.blur(select);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
