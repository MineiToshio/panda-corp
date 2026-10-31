/**
 * FRD-10 reuse gate (DR-057/DR-062), reconciled for WO-10-016: the hall's tab bar is the ONE Tabs
 * primitive, the category filter is the shared FilterChip, and paging and dialogs reuse MoreBar
 * and the shared dialog rather than forks.
 */
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Unique } from "@/lib/achievements/achievements";
import type { ReaderData } from "@/lib/achievements/stats";
import { HallTabs } from "../_components/HallTabs";

const READER_DATA: ReaderData = { ideas: [], statuses: [], eventsSnapshot: null };
const locked = (index: number): Unique => ({
  name: `Trofeo ${index}`,
  category: "Discovery",
  rarity: "Común",
  unlocked: false,
  condition: "Condición real.",
});

function renderHall(uniques: readonly Unique[]) {
  return render(
    <HallTabs
      chains={[]}
      uniques={uniques}
      secrets={[]}
      readerData={READER_DATA}
      trophiesCount={0}
      trophiesTotal={uniques.length}
      missionsActive={0}
      hero={<div />}
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

beforeEach(() => visit("/achievements/trophies"));
afterEach(cleanup);

describe("frd-10 GATE (DR-057, DR-062)", () => {
  it("the five tabs live inside the shared Tabs root", () => {
    renderHall([locked(1)]);
    expect(within(screen.getByTestId("tabs-root")).getAllByRole("tab")).toHaveLength(5);
  });

  it("category chips are pressed-state buttons, not a second tablist", () => {
    renderHall([locked(1)]);
    const group = screen.getByRole("group", { name: "Categoría" });
    expect(within(group).queryByRole("tab")).toBeNull();
    expect(within(group).getByRole("button", { name: /^Todos/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(group).getAllByRole("button")).toHaveLength(9);
  });

  it("paging is the shared dashed MoreBar", () => {
    renderHall(Array.from({ length: 40 }, (_, index) => locked(index)));
    expect(
      screen.getByRole("button", { name: /^Mostrar \d+ más · quedan \d+$/ }).className,
    ).toContain("morebtn");
  });
});
