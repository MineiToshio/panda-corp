/**
 * CMP-09-rank-ladder — RankLadder ("Rangos" tab) tests (FRD-09 rank ladder).
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { GuildLevel } from "@/lib/gamification/gamification";
import { RANKS, rankForLevel, xpForLevel } from "@/lib/gamification/gamification";
import { RankLadder } from "../RankLadder";

afterEach(cleanup);

function mkLevel(level: number): GuildLevel {
  const rankIndex = rankForLevel(level);
  return {
    level,
    rankIndex,
    title: RANKS[rankIndex]?.title ?? "?",
    xp: xpForLevel(level),
    next: xpForLevel(level + 1),
    pctToNext: 40,
  };
}

describe("RankLadder", () => {
  it("renders one row per rank in the ladder (40)", () => {
    render(<RankLadder level={mkLevel(6)} />);
    expect(screen.getAllByTestId("rank-row")).toHaveLength(RANKS.length);
  });

  it("marks the rank-BAND containing the level as current ('ESTÁS AQUÍ')", () => {
    // Level 6 sits in the Buscador del Alba I band (rank index 1).
    render(<RankLadder level={mkLevel(6)} />);
    const currentRows = screen
      .getAllByTestId("rank-row")
      .filter((r) => r.getAttribute("data-state") === "current");
    expect(currentRows).toHaveLength(1);
    expect(currentRows[0]?.getAttribute("data-rank")).toBe(String(rankForLevel(6) + 1));
    expect(within(currentRows[0] as HTMLElement).getByText(/estás aquí/i)).toBeDefined();
  });

  it("ranks below the current band are done, ranks above are locked", () => {
    render(<RankLadder level={mkLevel(6)} />); // current rank index 1
    const rows = screen.getAllByTestId("rank-row");
    const below = rows.find((r) => r.getAttribute("data-rank") === "1"); // Humano
    const above = rows.find((r) => r.getAttribute("data-rank") === "20");
    expect(below?.getAttribute("data-state")).toBe("done");
    expect(above?.getAttribute("data-state")).toBe("locked");
  });

  it("shows the rank names (Humano + the top rank) with level bands", () => {
    render(<RankLadder level={mkLevel(1)} />);
    expect(screen.getByText("Humano")).toBeDefined();
    expect(screen.getByText("Portador del Juramento Eterno")).toBeDefined();
    expect(screen.getByText(/Nv 1–/)).toBeDefined(); // Humano's level band
  });
});
