/**
 * CMP-09-rank-ladder — RankLadder ("Rangos" tab) tests (FRD-09 rank ladder).
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { GuildLevel } from "@/lib/gamification/gamification";
import { RANKS } from "@/lib/gamification/gamification";
import { RankLadder } from "../RankLadder";

afterEach(cleanup);

function mkLevel(level: number): GuildLevel {
  return { level, title: RANKS[level - 1]?.title ?? "?", xp: 1040, next: 1540, pctToNext: 40 };
}

describe("RankLadder", () => {
  it("renders one row per rank in the ladder (40)", () => {
    render(<RankLadder level={mkLevel(6)} />);
    expect(screen.getAllByTestId("rank-row")).toHaveLength(RANKS.length);
  });

  it("marks the row at the guild level as current ('ESTÁS AQUÍ')", () => {
    render(<RankLadder level={mkLevel(6)} />);
    const currentRows = screen
      .getAllByTestId("rank-row")
      .filter((r) => r.getAttribute("data-state") === "current");
    expect(currentRows).toHaveLength(1);
    expect(currentRows[0]?.getAttribute("data-level")).toBe("6");
    expect(within(currentRows[0] as HTMLElement).getByText(/estás aquí/i)).toBeDefined();
  });

  it("rows below the level are done, rows above are locked", () => {
    render(<RankLadder level={mkLevel(6)} />);
    const rows = screen.getAllByTestId("rank-row");
    const below = rows.find((r) => r.getAttribute("data-level") === "3");
    const above = rows.find((r) => r.getAttribute("data-level") === "20");
    expect(below?.getAttribute("data-state")).toBe("done");
    expect(above?.getAttribute("data-state")).toBe("locked");
  });

  it("shows the rank names (Humano at level 1, top rank at level 40)", () => {
    render(<RankLadder level={mkLevel(1)} />);
    expect(screen.getByText("Humano")).toBeDefined();
    expect(screen.getByText("Portador del Juramento Eterno")).toBeDefined();
  });
});
