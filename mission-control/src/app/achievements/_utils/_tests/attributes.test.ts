import { describe, expect, it } from "vitest";
import type { ChainState } from "@/lib/achievements/achievements";
import type { Stat } from "@/lib/achievements/stats";
import { attributeSummary, attributesFor, orderedMissions, recentTrophies } from "../viewRules";

const stat = (key: string, value: number): Stat => ({ key, value, label: key, unlockEvents: [] });
const chain = (value: number, currentTierIndex: number, pctToNext = 0): ChainState => ({
  statKey: String(value),
  label: String(value),
  value,
  currentTierIndex,
  pctToNext,
  currentTierName: null,
  nextTier: null,
  lowerIsBetter: false,
  unlocks: [],
});

describe("engine-derived chart attributes", () => {
  it("uses zero for absent stats rather than fabricating a speed", () => {
    expect(attributesFor([], [])).toEqual({
      produccion: 0,
      velocidad: 0,
      calidad: 0,
      constancia: 0,
      ideacion: 0,
      alcance: 0,
    });
  });
  it("scales each independent stat and counts only unlocked chains", () => {
    expect(
      attributesFor(
        [
          stat("shipped", 2),
          stat("speed", 8),
          stat("flawless", 2),
          stat("streak", 3),
          stat("ideas", 4),
        ],
        [chain(1, -1), chain(0, 0), chain(5, 2)],
      ),
    ).toEqual({
      produccion: 40,
      velocidad: 73,
      calidad: 66,
      constancia: 30,
      ideacion: 40,
      alcance: 16,
    });
  });
  it("caps all axes at 100 and floors slow delivery at zero", () => {
    const stats = [
      stat("shipped", 20),
      stat("speed", 60),
      stat("flawless", 10),
      stat("streak", 20),
      stat("ideas", 20),
    ];
    expect(
      attributesFor(
        stats,
        Array.from({ length: 20 }, () => chain(1, 0)),
      ),
    ).toEqual({
      produccion: 100,
      velocidad: 0,
      calidad: 100,
      constancia: 100,
      ideacion: 100,
      alcance: 100,
    });
    expect(attributesFor([stat("speed", -5)], []).velocidad).toBe(0);
    expect(attributesFor([stat("speed", 0.01)], []).velocidad).toBe(100);
  });
  it("preserves axis order when the strongest and weakest values tie", () => {
    expect(
      attributeSummary({
        produccion: 10,
        velocidad: 10,
        calidad: 5,
        constancia: 5,
        ideacion: 5,
        alcance: 5,
      }),
    ).toEqual({
      strong: "produccion",
      weak: "calidad",
      zero: [],
    });
  });
  it("puts an unlocked zero-valued chain ahead of untouched chains without mutating inputs", () => {
    const untouched = chain(0, -1, 99);
    const unlocked = chain(0, 0, 1);
    const input = [untouched, unlocked];
    expect(orderedMissions(input)).toEqual([unlocked, untouched]);
    expect(input).toEqual([untouched, unlocked]);
  });
  it("excludes locked trophies and caps recent dated unlocks at four", () => {
    const trophies = Array.from({ length: 6 }, (_, index) => ({
      name: String(index),
      category: "Discovery" as const,
      rarity: "Común" as const,
      condition: "Evidence",
      unlocked: index > 0,
      date: `2026-10-${20 + index}T00:00:00Z`,
    }));
    expect(recentTrophies(trophies).map((item) => item.name)).toEqual(["5", "4", "3", "2"]);
  });
});
