/**
 * FRD-10 gate (opus), reconciled for WO-10-016: the shared Tabs and the category FilterChips are
 * WIRED through the URL, not decorative. Panels are now mounted per tab, so the assertions follow
 * the selected panel rather than a `hidden` attribute.
 */
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChainState, Secret, Unique } from "@/lib/achievements/achievements";
import type { ReaderData } from "@/lib/achievements/stats";
import { HallTabs } from "../_components/HallTabs";

const CHAIN: ChainState = {
  statKey: "shipped",
  label: "Productos lanzados",
  currentTierIndex: 0,
  currentTierName: "Bronce",
  nextTier: { name: "Plata", threshold: 3 },
  pctToNext: 40,
  lowerIsBetter: false,
  unlocks: [{ tier: 0, date: "2026-01-15", project: "demo" }],
};
const DISCOVERY: Unique = {
  name: "El explorador",
  category: "Discovery",
  rarity: "Común",
  unlocked: false,
  condition: "Crea tu primera idea.",
};
const SPEED: Unique = {
  name: "El rápido",
  category: "Speed",
  rarity: "Poco común",
  unlocked: false,
  condition: "Lanza en 48 horas.",
};
const SECRET: Secret = { hint: "Una sombra entre las ideas…", unlocked: false };
const READER_DATA: ReaderData = { ideas: [], statuses: [], eventsSnapshot: null };

function renderHall(uniques: readonly Unique[] = [DISCOVERY, SPEED]) {
  return render(
    <HallTabs
      chains={[CHAIN]}
      uniques={uniques}
      secrets={[SECRET]}
      readerData={READER_DATA}
      trophiesCount={0}
      trophiesTotal={uniques.length}
      missionsActive={1}
      hero={<div data-testid="guild-hero" />}
      level={{ level: 3, title: "Buscador del Alba II", xp: 200, next: 450, pctToNext: 30 }}
    />,
  );
}
function visit(href: string): void {
  act(() => {
    window.history.replaceState(null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

beforeEach(() => visit("/achievements"));
afterEach(cleanup);

describe("FRD-10 GATE [opus]: the shared Tabs primitive is wired", () => {
  it("clicking a tab swaps the panel and writes the URL", async () => {
    const user = userEvent.setup();
    renderHall();
    expect(document.getElementById("logros-panel-resumen")).not.toBeNull();
    await user.click(screen.getByTestId("logros-tab-trofeos"));
    expect(document.getElementById("logros-panel-resumen")).toBeNull();
    const panel = document.getElementById("logros-panel-trofeos") as HTMLElement;
    expect(within(panel).getByText(/trofeos conquistados/i)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/achievements/trophies");
  });

  it("FRD-10 five tabs, each selected state exposed, a count on Trofeos only", async () => {
    const user = userEvent.setup();
    renderHall();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent?.replace(/\d+/g, "").trim())).toEqual([
      "Resumen",
      "Misiones",
      "Trofeos",
      "Estadísticas",
      "Rangos",
    ]);
    expect(tabs.filter((tab) => /\d/.test(tab.textContent ?? ""))).toEqual([tabs[2]]);
    await user.click(tabs[1] as HTMLElement);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("aria-selected", "false");
  });

  it("arrow keys rove focus and wrap", async () => {
    const user = userEvent.setup();
    renderHall();
    const first = screen.getByTestId("logros-tab-resumen");
    const last = screen.getByTestId("logros-tab-rangos");
    expect(first).toHaveAttribute("tabindex", "0");
    expect(last).toHaveAttribute("tabindex", "-1");
    first.focus();
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(last);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(first);
  });
});

describe("FRD-10 GATE [opus]: the category filter is wired", () => {
  it("AC-10-028.3 a chip narrows the list through the URL and «Todos» restores it", async () => {
    visit("/achievements/trophies");
    const user = userEvent.setup();
    renderHall();
    const group = screen.getByRole("group", { name: "Categoría" });
    await user.click(within(group).getByRole("button", { name: /Velocidad/ }));
    expect(window.location.search).toBe("?category=Speed");
    expect(document.querySelector('[data-trophy="El explorador"]')).toBeNull();
    expect(document.querySelector('[data-trophy="El rápido"]')).not.toBeNull();
    await user.click(within(group).getByRole("button", { name: /^Todos/ }));
    expect(document.querySelector('[data-trophy="El explorador"]')).not.toBeNull();
  });
});
