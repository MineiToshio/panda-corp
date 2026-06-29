/**
 * WO-10-011 (slice A) — per-trophy rarity + NUEVO badge + Seals.
 *
 * AC-10-011.4 — Seals: an axis Seal needs ALL its trophies; Grand Seal needs all Seals.
 * AC-10-011.5 — isNew derived from the real unlock date vs an injected `now` (≤7 days).
 * Rarity — every Unique carries a rarity grade ("Común" floor when unset).
 */

import { describe, expect, it } from "vitest";
import type { Unique } from "../achievements";
import { computeSeals, computeUniques } from "../achievements";
import type { ReaderData } from "../stats";
import { rarityColor, rarityLabel } from "../tiers";

const EMPTY: ReaderData = { ideas: [], statuses: [], eventsSnapshot: null };

function mkUnique(over: Partial<Unique>): Unique {
  return {
    name: "x",
    category: "Discovery",
    rarity: "Común",
    unlocked: false,
    condition: "c",
    ...over,
  };
}

describe("rarity — every Unique carries a grade", () => {
  it("computeUniques surfaces a rarity on every trophy", () => {
    for (const u of computeUniques(EMPTY)) {
      expect(["Común", "Poco común", "Raro", "Épico", "Leyenda"]).toContain(u.rarity);
    }
  });

  it("rarityColor + rarityLabel resolve for every grade", () => {
    for (const r of ["Común", "Poco común", "Raro", "Épico", "Leyenda"] as const) {
      expect(rarityLabel(r)).toBe(r);
      expect(rarityColor(r)).toMatch(/var\(--color-/);
    }
  });
});

describe("isNew — NUEVO badge from the real unlock date (AC-10-011.5)", () => {
  it("no `now` injected → never new", () => {
    for (const u of computeUniques(EMPTY)) expect(u.isNew ?? false).toBe(false);
  });

  it("a shipped project unlocks launch-day; isNew true within 7 days, false after", () => {
    const data: ReaderData = {
      ideas: [],
      statuses: [
        {
          present: true,
          malformed: false,
          status: { phase: "release", project: "p", updatedAt: "2026-06-25T00:00:00Z" },
        },
      ],
      eventsSnapshot: null,
    };
    const within = Date.parse("2026-06-29T00:00:00Z"); // 4 days later
    const after = Date.parse("2026-07-10T00:00:00Z"); // 15 days later
    const u1 = computeUniques(data, within).find((u) => u.name === "El día del lanzamiento");
    const u2 = computeUniques(data, after).find((u) => u.name === "El día del lanzamiento");
    expect(u1?.unlocked).toBe(true);
    expect(u1?.isNew).toBe(true);
    expect(u2?.isNew).toBe(false);
  });
});

describe("computeSeals — axis Seals + Grand Seal (AC-10-011.4)", () => {
  it("an axis Seal is locked until ALL its trophies are unlocked", () => {
    const uniques: Unique[] = [
      mkUnique({ name: "a", category: "Discovery", unlocked: true }),
      mkUnique({ name: "b", category: "Discovery", unlocked: false }),
    ];
    const seals = computeSeals(uniques);
    const discovery = seals.find((s) => s.axis === "Discovery");
    expect(discovery?.unlocked).toBe(false);
    expect(discovery?.earned).toBe(1);
    expect(discovery?.total).toBe(2);
    expect(discovery?.name).toBe("El Cartógrafo");
  });

  it("an axis Seal unlocks when all its trophies are unlocked", () => {
    const uniques: Unique[] = [
      mkUnique({ name: "a", category: "Speed", unlocked: true }),
      mkUnique({ name: "b", category: "Speed", unlocked: true }),
    ];
    const seals = computeSeals(uniques);
    expect(seals.find((s) => s.axis === "Speed")?.unlocked).toBe(true);
  });

  it("the Grand Seal needs every axis Seal; always present as the last entry", () => {
    const allDone: Unique[] = [
      mkUnique({ name: "a", category: "Discovery", unlocked: true }),
      mkUnique({ name: "b", category: "Speed", unlocked: true }),
    ];
    const seals = computeSeals(allDone);
    const grand = seals[seals.length - 1];
    expect(grand?.axis).toBe("grand");
    expect(grand?.name).toBe("El Gran Sello del Gremio");
    expect(grand?.unlocked).toBe(true);

    const notAll = computeSeals([
      mkUnique({ name: "a", category: "Discovery", unlocked: true }),
      mkUnique({ name: "b", category: "Speed", unlocked: false }),
    ]);
    expect(notAll[notAll.length - 1]?.unlocked).toBe(false);
  });
});
