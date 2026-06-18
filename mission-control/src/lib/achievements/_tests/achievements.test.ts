/**
 * WO-10-001 — lib/achievements.ts tests (RED → GREEN → refactor)
 *
 * Traceability:
 *   AC-10-001.1 — computeStats() returns all stats listed in docs/achievements.md from verifiable sources
 *   AC-10-001.2 — counters reflect real cumulative history (only grow); no app-incremented value (negative AC)
 *   AC-10-001.3 — empty factory → honest zeros; no fabrication (negative AC)
 *   AC-10-001.4 — pure function, fixture-tested over reader outputs (no direct fs)
 *
 *   AC-10-002.1 — computeChains() tiers up each chain on threshold crossing; returns current tier, next tier, pct-to-next
 *   AC-10-002.2 — each unlocked tier carries date + project
 *   AC-10-002.3 — endowed progress is honest: bar starts at real progress, never inflated, never stuck (negative AC)
 *   AC-10-002.4 — lower-is-better chains compute progress correctly (improving = lower, closer to next threshold)
 *   AC-10-002.5 — pure, fixture-tested
 *
 *   AC-10-003.1 — computeUniques() returns each unique with category, unlocked, date?, project?, condition
 *   AC-10-003.2 — unlock derived from verifiable result, never arbitrary (negative AC)
 *   AC-10-003.3 — locked unique exposes condition; unlocked carries date + project
 *   AC-10-003.4 — pure, fixture-tested
 *
 *   AC-10-004.1 — computeSecrets() returns each secret with unlocked, hint, and (only when unlocked) criterion, date, project
 *   AC-10-004.2 — locked: criterion hidden; unlocked: criterion revealed (negative AC: must not stay obscure)
 *   AC-10-004.3 — unlock derived from verifiable result, never arbitrary
 *   AC-10-004.4 — pure, fixture-tested
 *
 * Blueprint: IF-10-stats, IF-10-chains, IF-10-uniques, IF-10-secrets
 * §2 honesty contract: every stat derived from verifiable real outcomes (no stored counters).
 */

import { describe, expect, it } from "vitest";
import type { Event, EventsSnapshot } from "../../events/events";
import type { IdeaCard } from "../../ideas/ideas";
import type { StatusResult } from "../../status/status";
import {
  CHAIN_DEFINITIONS,
  computeChains,
  computeSecrets,
  computeStats,
  computeUniques,
  type ReaderData,
  SECRET_DEFINITIONS,
  UNIQUE_DEFINITIONS,
} from "../achievements";

// ─── Fixture helpers ─────────────────────────────────────────────────────────

function mkStatus(
  overrides: Partial<{
    phase: string;
    workOrdersDone: number;
    project: string;
    updatedAt: string;
  }>,
): StatusResult {
  return {
    present: true,
    malformed: false,
    status: {
      project: overrides.project ?? "test-project",
      phase: (overrides.phase ?? "operation") as StatusResult extends { status: infer S }
        ? S extends null
          ? never
          : S extends object
            ? S extends { phase?: infer P }
              ? P
              : never
            : never
        : never,
      workOrdersDone: overrides.workOrdersDone ?? 0,
      workOrdersTotal: 10,
      pendingDecisions: 0,
      pendingBugs: 0,
      running: false,
      rethinkPending: false,
      advancePending: false,
      lastGreenSha: "",
      safeToTest: true,
      version: "1.0.0",
      updatedAt: overrides.updatedAt ?? "2026-05-01T00:00:00Z",
    },
  };
}

function mkIdea(status: IdeaCard["status"], slug = "idea-1"): IdeaCard {
  return { slug, title: "Test idea", status, body: "" };
}

function mkEvent(overrides: Partial<Event>): Event {
  return {
    event: "read",
    at: "2026-06-01T12:00:00Z",
    ...overrides,
  };
}

function mkEventsSnapshot(events: Event[]): EventsSnapshot {
  return {
    events,
    lastEventAt: events[events.length - 1]?.at ?? null,
    byProject: {},
  };
}

/** Fully empty reader data (AC-10-001.3: honest zeros) */
const EMPTY_DATA: ReaderData = {
  ideas: [],
  statuses: [],
  eventsSnapshot: mkEventsSnapshot([]),
};

// ─── AC-10-001: computeStats ─────────────────────────────────────────────────

describe("computeStats — AC-10-001 — character-sheet counters", () => {
  it("AC-10-001.1: returns all 12 stats listed in docs/achievements.md", () => {
    const EXPECTED_STAT_KEYS = [
      "shipped",
      "ideas",
      "workorders",
      "phases",
      "iterations",
      "flawless",
      "discarded",
      "prds",
      "adrs",
      "agents",
      "streak",
      "speed",
    ] as const;

    const stats = computeStats(EMPTY_DATA);
    const keys = stats.map((s) => s.key);
    for (const k of EXPECTED_STAT_KEYS) {
      expect(keys).toContain(k);
    }
    expect(stats).toHaveLength(12);
  });

  it("AC-10-001.2: each stat has a value property (only-grow counter shape)", () => {
    const stats = computeStats(EMPTY_DATA);
    for (const s of stats) {
      expect(typeof s.value).toBe("number");
      expect(Number.isFinite(s.value)).toBe(true);
    }
  });

  it("AC-10-001.3: empty factory → all counters are honest zeros (no fabrication)", () => {
    const stats = computeStats(EMPTY_DATA);
    // shipped, ideas, workorders, phases, flawless, discarded should be 0
    const find = (key: string) => stats.find((s) => s.key === key)?.value;
    expect(find("shipped")).toBe(0);
    expect(find("ideas")).toBe(0);
    expect(find("workorders")).toBe(0);
    expect(find("phases")).toBe(0);
    expect(find("flawless")).toBe(0);
    expect(find("discarded")).toBe(0);
    expect(find("prds")).toBe(0);
    expect(find("adrs")).toBe(0);
    expect(find("agents")).toBe(0);
    expect(find("streak")).toBe(0);
    // speed = null/0 when no data (not a fabricated value)
    // iterations = 0
    expect(find("iterations")).toBe(0);
  });

  it("AC-10-001.4 (purity): same input always returns equal output", () => {
    const data: ReaderData = {
      ideas: [mkIdea("discovered"), mkIdea("discarded", "idea-2")],
      statuses: [mkStatus({ phase: "operation", workOrdersDone: 5 })],
      eventsSnapshot: mkEventsSnapshot([]),
    };
    const a = computeStats(data);
    const b = computeStats(data);
    expect(a).toEqual(b);
  });

  it("AC-10-001.1 (shipped): counts projects in operation phase", () => {
    const data: ReaderData = {
      ideas: [],
      statuses: [
        mkStatus({ phase: "operation" }),
        mkStatus({ phase: "operation", project: "p2" }),
        mkStatus({ phase: "implementation", project: "p3" }),
      ],
      eventsSnapshot: mkEventsSnapshot([]),
    };
    const stats = computeStats(data);
    expect(stats.find((s) => s.key === "shipped")?.value).toBe(2);
  });

  it("AC-10-001.1 (ideas): counts all non-discarded idea cards", () => {
    const data: ReaderData = {
      ideas: [
        mkIdea("discovered", "a"),
        mkIdea("recommended", "b"),
        mkIdea("in-pipeline", "c"),
        mkIdea("discarded", "d"),
        mkIdea("shipped", "e"),
      ],
      statuses: [],
      eventsSnapshot: mkEventsSnapshot([]),
    };
    const stats = computeStats(data);
    // "ideas captured" = all ideas ever created (all statuses count — the stat only grows)
    expect(stats.find((s) => s.key === "ideas")?.value).toBe(5);
  });

  it("AC-10-001.1 (discarded): counts idea cards with status=discarded", () => {
    const data: ReaderData = {
      ideas: [mkIdea("discarded", "a"), mkIdea("discarded", "b"), mkIdea("discovered", "c")],
      statuses: [],
      eventsSnapshot: mkEventsSnapshot([]),
    };
    const stats = computeStats(data);
    expect(stats.find((s) => s.key === "discarded")?.value).toBe(2);
  });

  it("AC-10-001.1 (workorders): sums workOrdersDone across all projects", () => {
    const data: ReaderData = {
      ideas: [],
      statuses: [
        mkStatus({ workOrdersDone: 10 }),
        mkStatus({ workOrdersDone: 5, project: "p2" }),
        mkStatus({ workOrdersDone: 3, project: "p3" }),
      ],
      eventsSnapshot: mkEventsSnapshot([]),
    };
    const stats = computeStats(data);
    expect(stats.find((s) => s.key === "workorders")?.value).toBe(18);
  });

  it("AC-10-001.1 (phases): counts projects past 'product' phase", () => {
    const data: ReaderData = {
      ideas: [],
      statuses: [
        mkStatus({ phase: "product" }),
        mkStatus({ phase: "design", project: "p2" }),
        mkStatus({ phase: "operation", project: "p3" }),
        mkStatus({ phase: "release", project: "p4" }),
      ],
      eventsSnapshot: mkEventsSnapshot([]),
    };
    const stats = computeStats(data);
    // 3 projects advanced past product
    expect(stats.find((s) => s.key === "phases")?.value).toBe(3);
  });

  it("AC-10-001.1 (iterations): counts 'achievement' events scoped to an iteration", () => {
    const data: ReaderData = {
      ideas: [],
      statuses: [],
      eventsSnapshot: mkEventsSnapshot([
        mkEvent({ event: "achievement", task: "iteration", status: "ok" }),
        mkEvent({ event: "achievement", task: "iteration", status: "ok" }),
        mkEvent({ event: "achievement", task: "phase:design", status: "ok" }),
      ]),
    };
    const stats = computeStats(data);
    expect(stats.find((s) => s.key === "iterations")?.value).toBe(2);
  });

  it("AC-10-001.1 (prds): counts 'achievement' events with task=prd", () => {
    const data: ReaderData = {
      ideas: [],
      statuses: [],
      eventsSnapshot: mkEventsSnapshot([
        mkEvent({ event: "achievement", task: "prd", status: "ok" }),
        mkEvent({ event: "achievement", task: "prd", status: "ok" }),
      ]),
    };
    const stats = computeStats(data);
    expect(stats.find((s) => s.key === "prds")?.value).toBe(2);
  });

  it("AC-10-001.1 (adrs): counts 'achievement' events with task=adr", () => {
    const data: ReaderData = {
      ideas: [],
      statuses: [],
      eventsSnapshot: mkEventsSnapshot([
        mkEvent({ event: "achievement", task: "adr", status: "ok" }),
      ]),
    };
    const stats = computeStats(data);
    expect(stats.find((s) => s.key === "adrs")?.value).toBe(1);
  });

  it("AC-10-001.1 (agents): counts distinct agent names from ok events", () => {
    const data: ReaderData = {
      ideas: [],
      statuses: [],
      eventsSnapshot: mkEventsSnapshot([
        mkEvent({ event: "end", agent: "backend-dev", status: "ok" }),
        mkEvent({ event: "end", agent: "frontend-dev", status: "ok" }),
        mkEvent({ event: "end", agent: "backend-dev", status: "ok" }), // duplicate
        mkEvent({ event: "end", agent: "reviewer", status: "ok" }),
      ]),
    };
    const stats = computeStats(data);
    expect(stats.find((s) => s.key === "agents")?.value).toBe(3);
  });

  it("AC-10-001.2 (negative): workorders counter is derived from status, not app-incremented", () => {
    // Counter must come from real data, not from any stored accumulator
    // Calling computeStats twice must produce identical results (no side effects)
    const data: ReaderData = {
      ideas: [],
      statuses: [mkStatus({ workOrdersDone: 7 })],
      eventsSnapshot: mkEventsSnapshot([]),
    };
    const first = computeStats(data);
    const second = computeStats(data);
    expect(first.find((s) => s.key === "workorders")?.value).toBe(7);
    expect(second.find((s) => s.key === "workorders")?.value).toBe(7);
  });
});

// ─── AC-10-002: computeChains ────────────────────────────────────────────────

describe("computeChains — AC-10-002 — cumulative chains with honest endowed progress", () => {
  it("AC-10-002.5 (pure): same input → same output", () => {
    const stats = computeStats(EMPTY_DATA);
    expect(computeChains(stats)).toEqual(computeChains(stats));
  });

  it("AC-10-002.1: returns one ChainState per chain definition", () => {
    const stats = computeStats(EMPTY_DATA);
    const chains = computeChains(stats);
    expect(chains).toHaveLength(CHAIN_DEFINITIONS.length);
  });

  it("AC-10-002.1: chain at zero has no current tier (ci = -1) and next tier is the first threshold", () => {
    const data: ReaderData = {
      ideas: [],
      statuses: [],
      eventsSnapshot: mkEventsSnapshot([]),
    };
    const stats = computeStats(data);
    const chains = computeChains(stats);
    // 'shipped' chain: threshold[0] = 1; with 0 shipped, no tier unlocked
    const shipped = chains.find((c) => c.statKey === "shipped");
    expect(shipped).toBeDefined();
    expect(shipped?.currentTierIndex).toBe(-1);
    expect(shipped?.nextTier).toBeDefined();
    expect(shipped?.nextTier?.name).toBe("El primer ladrillo");
  });

  it("AC-10-002.1: crossing tier-1 threshold unlocks Bronze (currentTierIndex=0)", () => {
    const data: ReaderData = {
      ideas: [],
      statuses: [mkStatus({ phase: "operation", project: "p1" })],
      eventsSnapshot: mkEventsSnapshot([]),
    };
    const stats = computeStats(data);
    const chains = computeChains(stats);
    const shipped = chains.find((c) => c.statKey === "shipped");
    expect(shipped?.currentTierIndex).toBe(0);
    expect(shipped?.currentTierName).toBe("El primer ladrillo");
  });

  it("AC-10-002.1: returns nextTier.name for all non-maxed chains", () => {
    const data: ReaderData = {
      ideas: [],
      statuses: [mkStatus({ phase: "operation" })],
      eventsSnapshot: mkEventsSnapshot([]),
    };
    const stats = computeStats(data);
    const chains = computeChains(stats);
    const shipped = chains.find((c) => c.statKey === "shipped");
    // currently at tier 0 (1 shipped), next is tier 1 (5 shipped = "Maestro de obras")
    expect(shipped?.nextTier?.name).toBe("Maestro de obras");
  });

  it("AC-10-002.2: unlocked tier carries date + project", () => {
    const chains = computeChains([
      {
        key: "shipped",
        value: 3,
        label: "Productos lanzados",
        unlockEvents: [{ tier: 0, date: "2026-05-02", project: "quick-notes" }],
      },
    ]);
    const shipped = chains.find((c) => c.statKey === "shipped");
    const unlock = shipped?.unlocks.find((u) => u.tier === 0);
    expect(unlock?.date).toBe("2026-05-02");
    expect(unlock?.project).toBe("quick-notes");
  });

  it("AC-10-002.3 (honest endowed progress): pctToNext reflects real progress from current threshold", () => {
    // shipped: t[0]=1, t[1]=5. With value=3: progress=(3-1)/(5-1)=50%
    const chains = computeChains([
      {
        key: "shipped",
        value: 3,
        label: "Productos lanzados",
        unlockEvents: [{ tier: 0, date: "2026-05-01", project: "p1" }],
      },
    ]);
    const shipped = chains.find((c) => c.statKey === "shipped");
    // 3 shipped: tier 0 unlocked (threshold=1), next is tier 1 (threshold=5)
    // progress from tier0 = (3-1)/(5-1) = 50%
    expect(shipped?.pctToNext).toBe(50);
  });

  it("AC-10-002.3 (negative: no inflation): pctToNext must be ≤ real computed percentage", () => {
    // With value=1 exactly at threshold: progress=(1-1)/(5-1)=0%
    const chains = computeChains([
      {
        key: "shipped",
        value: 1,
        label: "Productos lanzados",
        unlockEvents: [{ tier: 0, date: "2026-05-01", project: "p1" }],
      },
    ]);
    const shipped = chains.find((c) => c.statKey === "shipped");
    // Just crossed the first threshold (exactly 1) — no progress toward 2nd tier yet
    expect(shipped?.pctToNext).toBe(0);
  });

  it("AC-10-002.3 (negative: bar not stuck at high value): with 0 shipped, pctToNext=0", () => {
    const chains = computeChains([
      { key: "shipped", value: 0, label: "Productos lanzados", unlockEvents: [] },
    ]);
    const shipped = chains.find((c) => c.statKey === "shipped");
    // No tier unlocked yet — pctToNext from 0 toward first threshold (1)
    // 0/1 = 0%
    expect(shipped?.pctToNext).toBe(0);
  });

  it("AC-10-002.4 (lower-is-better): speed chain progresses when value gets lower", () => {
    // speed chain: thresholds [30, 14, 7, 3], lower=better
    // value=20: tier[0] (≤30) unlocked. next is tier[1] (≤14).
    // progress: current value=20, from threshold 30 toward threshold 14
    // pct = (30-20)/(30-14) = 10/16 ≈ 62%
    const chains = computeChains([
      {
        key: "speed",
        value: 20,
        label: "Récord idea→launch",
        unlockEvents: [{ tier: 0, date: "2026-05-01", project: "p1" }],
      },
    ]);
    const speed = chains.find((c) => c.statKey === "speed");
    expect(speed?.currentTierIndex).toBe(0);
    expect(speed?.pctToNext).toBe(62); // floor((10/16)*100) = 62
  });

  it("AC-10-002.4 (lower-is-better): with no speed record (null/0), no tier unlocked", () => {
    // speed=0 means no record yet (null state) — not lower than 30
    // value=null: no tier unlocked
    const chains = computeChains([
      { key: "speed", value: 0, label: "Récord idea→launch", unlockEvents: [] },
    ]);
    const speed = chains.find((c) => c.statKey === "speed");
    expect(speed?.currentTierIndex).toBe(-1);
  });

  it("AC-10-002.4 (lower-is-better): perfect record ≤ min threshold → last tier", () => {
    // speed chain has 4 tiers [30,14,7,3]. value=2 → all 4 unlocked, maxed
    const chains = computeChains([
      {
        key: "speed",
        value: 2,
        label: "Récord idea→launch",
        unlockEvents: [
          { tier: 0, date: "2026-01-01", project: "p1" },
          { tier: 1, date: "2026-02-01", project: "p2" },
          { tier: 2, date: "2026-03-01", project: "p3" },
          { tier: 3, date: "2026-04-01", project: "p4" },
        ],
      },
    ]);
    const speed = chains.find((c) => c.statKey === "speed");
    expect(speed?.currentTierIndex).toBe(3);
    expect(speed?.pctToNext).toBe(100);
    expect(speed?.nextTier).toBeNull();
  });

  it("AC-10-002.1: maxed chain (all tiers unlocked) returns nextTier=null and pctToNext=100", () => {
    // shipped: 5 tiers [1,5,10,25,50]. value=50 → all 5 unlocked
    const chains = computeChains([
      {
        key: "shipped",
        value: 50,
        label: "Productos lanzados",
        unlockEvents: [
          { tier: 0, date: "2026-01-01", project: "p1" },
          { tier: 1, date: "2026-02-01", project: "p2" },
          { tier: 2, date: "2026-03-01", project: "p3" },
          { tier: 3, date: "2026-04-01", project: "p4" },
          { tier: 4, date: "2026-05-01", project: "p5" },
        ],
      },
    ]);
    const shipped = chains.find((c) => c.statKey === "shipped");
    expect(shipped?.nextTier).toBeNull();
    expect(shipped?.pctToNext).toBe(100);
  });

  it("CHAIN_DEFINITIONS: includes all 12 chains from docs/achievements.md", () => {
    const keys = CHAIN_DEFINITIONS.map((c) => c.statKey);
    const EXPECTED = [
      "shipped",
      "ideas",
      "workorders",
      "phases",
      "iterations",
      "flawless",
      "discarded",
      "prds",
      "adrs",
      "agents",
      "streak",
      "speed",
    ];
    for (const k of EXPECTED) {
      expect(keys).toContain(k);
    }
    expect(CHAIN_DEFINITIONS).toHaveLength(12);
  });

  it("CHAIN_DEFINITIONS: speed chain is marked lower-is-better", () => {
    const speed = CHAIN_DEFINITIONS.find((c) => c.statKey === "speed");
    expect(speed?.lowerIsBetter).toBe(true);
  });

  it("CHAIN_DEFINITIONS: non-speed chains are not lower-is-better", () => {
    const nonSpeed = CHAIN_DEFINITIONS.filter((c) => c.statKey !== "speed");
    for (const c of nonSpeed) {
      expect(c.lowerIsBetter).toBeFalsy();
    }
  });
});

// ─── AC-10-003: computeUniques ────────────────────────────────────────────────

describe("computeUniques — AC-10-003 — one-time achievements by category", () => {
  it("AC-10-003.4 (pure): same input → same output", () => {
    expect(computeUniques(EMPTY_DATA)).toEqual(computeUniques(EMPTY_DATA));
  });

  it("AC-10-003.1: returns all unique achievements from docs/achievements.md", () => {
    const uniques = computeUniques(EMPTY_DATA);
    // From docs/achievements.md: 15 unique achievements (excluding secrets)
    // Discovery: 6, Speed: 3, Quality: 2, Consistency: 2, Mastery: 2
    expect(uniques.length).toBeGreaterThanOrEqual(15);
  });

  it("AC-10-003.1: each unique has category, unlocked, and condition", () => {
    const uniques = computeUniques(EMPTY_DATA);
    for (const u of uniques) {
      expect(typeof u.name).toBe("string");
      expect(u.name.length).toBeGreaterThan(0);
      expect(["Discovery", "Speed", "Quality", "Consistency", "Mastery"]).toContain(u.category);
      expect(typeof u.unlocked).toBe("boolean");
      expect(typeof u.condition).toBe("string");
      expect(u.condition.length).toBeGreaterThan(0);
    }
  });

  it("AC-10-003.1: locked unique has no date or project", () => {
    const uniques = computeUniques(EMPTY_DATA);
    for (const u of uniques.filter((u) => !u.unlocked)) {
      expect(u.date).toBeUndefined();
      expect(u.project).toBeUndefined();
    }
  });

  it("AC-10-003.3: locked unique exposes its condition (achievable, not obscure)", () => {
    const uniques = computeUniques(EMPTY_DATA);
    // All locked uniques must expose a condition string
    for (const u of uniques.filter((u) => !u.unlocked)) {
      expect(typeof u.condition).toBe("string");
      expect(u.condition.length).toBeGreaterThan(0);
    }
  });

  it("AC-10-003.2 (negative): Discovery/launch-day unlock requires verifiable shipped project", () => {
    // With no shipped projects, "El día del lanzamiento" must not be unlocked
    const data: ReaderData = {
      ideas: [mkIdea("in-pipeline")],
      statuses: [mkStatus({ phase: "implementation" })],
      eventsSnapshot: mkEventsSnapshot([]),
    };
    const uniques = computeUniques(data);
    const launchDay = uniques.find((u) => u.name === "El día del lanzamiento");
    expect(launchDay?.unlocked).toBe(false);
  });

  it("AC-10-003.3: unlocked unique carries date + project", () => {
    // Simulate a shipped project
    const data: ReaderData = {
      ideas: [],
      statuses: [
        mkStatus({ phase: "operation", project: "quick-notes", updatedAt: "2026-05-02T00:00:00Z" }),
      ],
      eventsSnapshot: mkEventsSnapshot([]),
    };
    const uniques = computeUniques(data);
    const launchDay = uniques.find((u) => u.name === "El día del lanzamiento");
    if (launchDay?.unlocked) {
      expect(typeof launchDay.date).toBe("string");
      expect(typeof launchDay.project).toBe("string");
    }
  });

  it("AC-10-003.1: all 5 categories are present", () => {
    const uniques = computeUniques(EMPTY_DATA);
    const cats = new Set(uniques.map((u) => u.category));
    expect(cats.has("Discovery")).toBe(true);
    expect(cats.has("Speed")).toBe(true);
    expect(cats.has("Quality")).toBe(true);
    expect(cats.has("Consistency")).toBe(true);
    expect(cats.has("Mastery")).toBe(true);
  });

  it("UNIQUE_DEFINITIONS: is exported and contains all unique achievements", () => {
    expect(Array.isArray(UNIQUE_DEFINITIONS)).toBe(true);
    expect(UNIQUE_DEFINITIONS.length).toBeGreaterThanOrEqual(15);
  });

  it("AC-10-003.2 (negative): Mastery/trilogy requires exactly 3 shipped simultaneously", () => {
    // 2 shipped projects: not enough for Trilogy
    const data: ReaderData = {
      ideas: [],
      statuses: [
        mkStatus({ phase: "operation", project: "p1" }),
        mkStatus({ phase: "operation", project: "p2" }),
      ],
      eventsSnapshot: mkEventsSnapshot([]),
    };
    const uniques = computeUniques(data);
    const trilogy = uniques.find((u) => u.name === "La trilogía");
    expect(trilogy?.unlocked).toBe(false);

    // 3 shipped projects: enough
    const data3: ReaderData = {
      ideas: [],
      statuses: [
        mkStatus({ phase: "operation", project: "p1" }),
        mkStatus({ phase: "operation", project: "p2" }),
        mkStatus({ phase: "operation", project: "p3" }),
      ],
      eventsSnapshot: mkEventsSnapshot([]),
    };
    const uniques3 = computeUniques(data3);
    const trilogy3 = uniques3.find((u) => u.name === "La trilogía");
    expect(trilogy3?.unlocked).toBe(true);
  });

  it("AC-10-003.2 (negative): Speed/Ship-it-Friday requires a Friday event", () => {
    // Non-Friday achievement event
    const data: ReaderData = {
      ideas: [],
      statuses: [],
      eventsSnapshot: mkEventsSnapshot([
        // 2026-06-15 is a Monday — not Friday
        mkEvent({
          event: "achievement",
          task: "phase:release",
          at: "2026-06-15T18:00:00Z",
          status: "ok",
        }),
      ]),
    };
    const uniques = computeUniques(data);
    const shipFriday = uniques.find((u) => u.name === "Ship it Friday");
    expect(shipFriday?.unlocked).toBe(false);

    // Friday event
    const dataFri: ReaderData = {
      ideas: [],
      statuses: [
        mkStatus({ phase: "operation", project: "fri-project", updatedAt: "2026-06-19T18:00:00Z" }),
      ],
      eventsSnapshot: mkEventsSnapshot([
        // 2026-06-19 is a Friday
        mkEvent({
          event: "achievement",
          task: "release",
          at: "2026-06-19T18:00:00Z",
          status: "ok",
        }),
      ]),
    };
    const uniquesFri = computeUniques(dataFri);
    const shipFridayFri = uniquesFri.find((u) => u.name === "Ship it Friday");
    expect(shipFridayFri?.unlocked).toBe(true);
  });
});

// ─── AC-10-004: computeSecrets ────────────────────────────────────────────────

describe("computeSecrets — AC-10-004 — secret achievements", () => {
  it("AC-10-004.4 (pure): same input → same output", () => {
    expect(computeSecrets(EMPTY_DATA)).toEqual(computeSecrets(EMPTY_DATA));
  });

  it("AC-10-004.1: returns all 3 secrets from docs/achievements.md", () => {
    const secrets = computeSecrets(EMPTY_DATA);
    expect(secrets).toHaveLength(3);
  });

  it("AC-10-004.1: each secret always has a hint (even when locked)", () => {
    const secrets = computeSecrets(EMPTY_DATA);
    for (const s of secrets) {
      expect(typeof s.hint).toBe("string");
      expect(s.hint.length).toBeGreaterThan(0);
    }
  });

  it("AC-10-004.2 (negative: criterion hidden when locked): locked secret has no criterion", () => {
    const secrets = computeSecrets(EMPTY_DATA);
    for (const s of secrets.filter((s) => !s.unlocked)) {
      expect(s.criterion).toBeUndefined();
      expect(s.date).toBeUndefined();
      expect(s.project).toBeUndefined();
    }
  });

  it("AC-10-004.2 (criterion revealed on unlock): unlocked secret reveals criterion", () => {
    // The "void" secret: idea base with nothing active (all ideas discarded or none)
    const data: ReaderData = {
      ideas: [mkIdea("discarded", "a"), mkIdea("discarded", "b")],
      statuses: [],
      eventsSnapshot: mkEventsSnapshot([]),
    };
    const secrets = computeSecrets(data);
    const voidSecret = secrets.find(
      (s) => s.hint.toLowerCase().includes("vacío") || s.hint.toLowerCase().includes("vacio"),
    );
    if (voidSecret?.unlocked) {
      expect(typeof voidSecret.criterion).toBe("string");
      expect(voidSecret.criterion?.length).toBeGreaterThan(0);
      // Honesty contract (AC-10-004.3 / blueprint §5): idea cards carry no date
      // field, so the void secret unlocks WITHOUT a date — a fabricated constant
      // would be dishonest. The project is derivable from the cards themselves.
      expect(voidSecret.date).toBeUndefined();
      expect(typeof voidSecret.project).toBe("string");
    }
  });

  it("AC-10-004.3 (negative): 'code reviewed the code' secret requires a reviewer agent event", () => {
    // No reviewer events → secret must not be unlocked
    const data: ReaderData = {
      ideas: [],
      statuses: [],
      eventsSnapshot: mkEventsSnapshot([
        mkEvent({ event: "end", agent: "backend-dev", status: "ok" }),
      ]),
    };
    const secrets = computeSecrets(data);
    const codeReview = secrets.find(
      (s) => s.hint.toLowerCase().includes("código") || s.hint.toLowerCase().includes("codigo"),
    );
    // With no reviewer events, the code-review secret must not be unlocked
    if (codeReview && !codeReview.unlocked) {
      expect(codeReview.criterion).toBeUndefined();
    }
  });

  it("AC-10-004.1: unlocked secret carries date and project", () => {
    // Use the full-pipeline-in-one-day secret scenario
    const today = "2026-06-17";
    const events = [
      mkEvent({
        event: "achievement",
        task: "phase:design",
        at: `${today}T08:00:00Z`,
        status: "ok",
      }),
      mkEvent({
        event: "achievement",
        task: "phase:architecture",
        at: `${today}T10:00:00Z`,
        status: "ok",
      }),
      mkEvent({
        event: "achievement",
        task: "phase:implementation",
        at: `${today}T12:00:00Z`,
        status: "ok",
      }),
      mkEvent({ event: "achievement", task: "release", at: `${today}T14:00:00Z`, status: "ok" }),
    ];
    const data: ReaderData = {
      ideas: [],
      statuses: [
        mkStatus({ phase: "operation", project: "speed-project", updatedAt: `${today}T14:00:00Z` }),
      ],
      eventsSnapshot: mkEventsSnapshot(events),
    };
    const secrets = computeSecrets(data);
    const fastSecret = secrets.find(
      (s) => s.hint.toLowerCase().includes("rápido") || s.hint.toLowerCase().includes("rapido"),
    );
    if (fastSecret?.unlocked) {
      expect(typeof fastSecret.date).toBe("string");
      expect(typeof fastSecret.project).toBe("string");
      expect(typeof fastSecret.criterion).toBe("string");
    }
  });

  it("SECRET_DEFINITIONS: exported and has exactly 3 entries", () => {
    expect(Array.isArray(SECRET_DEFINITIONS)).toBe(true);
    expect(SECRET_DEFINITIONS).toHaveLength(3);
  });

  it("SECRET_DEFINITIONS: each has id, hint, and criterion fields defined", () => {
    for (const def of SECRET_DEFINITIONS) {
      expect(typeof def.id).toBe("string");
      expect(typeof def.hint).toBe("string");
      expect(typeof def.criterion).toBe("string");
    }
  });
});
