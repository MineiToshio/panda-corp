import { describe, expect, it } from "vitest";
import type { ChainState, Unique } from "@/lib/achievements/achievements";
import {
  attributeSummary,
  eraCollapsed,
  nearestTrophies,
  orderedMissions,
  recentTrophies,
} from "../viewRules";

const chain = (label: string, pctToNext: number): ChainState => ({
  statKey: label,
  label,
  currentTierIndex: -1,
  currentTierName: null,
  nextTier: { name: "next", threshold: 10 },
  pctToNext,
  lowerIsBetter: false,
  unlocks: [],
  value: pctToNext,
});
const trophy = (name: string, overrides: Partial<Unique> = {}): Unique => ({
  name,
  category: "Discovery",
  rarity: "Común",
  condition: "Evidence",
  unlocked: false,
  ...overrides,
});

describe("hall view rules", () => {
  it("does not name a strongest or weakest attribute without any data", () => {
    expect(
      attributeSummary({
        produccion: 0,
        velocidad: 0,
        calidad: 0,
        constancia: 0,
        ideacion: 0,
        alcance: 0,
      }),
    ).toMatchObject({ strong: null, weak: null });
  });
  it("AC-10-028.2 orders 80%, 30%, then untouched without mutating the engine DTO", () => {
    const input = [chain("C", 0), chain("B", 30), chain("A", 80)];
    expect(orderedMissions(input).map((item) => item.label)).toEqual(["A", "B", "C"]);
    expect(input[0]?.label).toBe("C");
  });
  it("AC-10-028.3 selects lowest-rarity locked per category, stable ties, three with a category", () => {
    const input = [
      trophy("rare", { rarity: "Raro" }),
      trophy("first"),
      trophy("second"),
      trophy("third"),
      trophy("speed", { category: "Speed" }),
      trophy("won", { unlocked: true }),
    ];
    expect(nearestTrophies(input).map((item) => item.name)).toEqual(["first", "speed"]);
    expect(nearestTrophies(input, "Discovery").map((item) => item.name)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });
  it("caps the all-category targets at six while retaining rarity order", () => {
    const categories = [
      "Discovery",
      "Speed",
      "Quality",
      "Consistency",
      "Mastery",
      "Production",
      "Guild",
      "Resilience",
    ] as const;
    expect(
      nearestTrophies(categories.map((category) => trophy(category, { category }))),
    ).toHaveLength(6);
  });
  it("AC-10-028.4 collapses only eras beyond the current and its immediate successor", () => {
    expect(eraCollapsed(0, 0)).toBe(false);
    expect(eraCollapsed(1, 0)).toBe(false);
    expect(eraCollapsed(2, 0)).toBe(true);
  });
  it("AC-10-028.1 finds strongest, weakest and axes without data, and sorts real instants", () => {
    expect(
      attributeSummary({
        produccion: 80,
        velocidad: 30,
        calidad: 0,
        constancia: 0,
        ideacion: 10,
        alcance: 5,
      }),
    ).toMatchObject({ strong: "produccion", weak: "calidad", zero: ["calidad", "constancia"] });
    expect(
      recentTrophies([
        trophy("older", { unlocked: true, date: "2026-10-20T00:00:00Z" }),
        trophy("newer", { unlocked: true, date: "2026-10-20T00:00:00.920Z" }),
        trophy("undated", { unlocked: true }),
      ]).map((item) => item.name),
    ).toEqual(["newer", "older", "undated"]);
  });
});
