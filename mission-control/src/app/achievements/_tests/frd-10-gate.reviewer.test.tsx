/**
 * FRD-10 [reviewer · powerful gate] — second-pass adversarial integration tests.
 *
 * Written by the FRD-gate reviewer (DR-015/DR-050), a different model from the
 * implementers. Complements the first-pass reviewer file
 * (frd-10-integration.reviewer.test.tsx) with edge/abuse cases the implementers'
 * own suites do NOT cover, anchored in the FRD EARS criteria + blueprint §5
 * honesty contract, exercising the work orders TOGETHER (engine → components).
 *
 * Gaps targeted (not covered by existing tests):
 *   - Stat counters must survive MALFORMED/partial reader data without NaN poison
 *     or fabricated values (AC-10-001.2/.3 only-grow + honest).
 *   - `speed` (lower-is-better) MAXED → 100% + top tier, never stuck (AC-10-002.3/.4).
 *   - Higher-is-better chain MAXED → 100%, never artificially stuck (AC-10-002.3).
 *   - `_buildShippedUnlocks` honesty: a shipped project with NO timestamp must NOT
 *     emit a fabricated empty-date unlock row (AC-10-002.2 verifiable date).
 *   - `void` secret must NOT unlock while the idea base still has active ideas
 *     (AC-10-004.3 verifiable, no false trophy).
 *   - Engine purity: identical input → identical output (AC-10-001.4 pure/no clock).
 *   - ChainCard renders a maxed chain at 100% with no next-tier label (no stuck bar).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { computeChains, computeSecrets, computeUniques } from "@/lib/achievements/achievements";
import { computeStats, type ReaderData } from "@/lib/achievements/stats";
import type { Event, EventsSnapshot } from "@/lib/events/events";
import type { IdeaCard } from "@/lib/ideas/ideas";
import type { ProjectStatus, StatusResult } from "@/lib/status/status";
import { ChainCard } from "../ChainCard/ChainCard";

// ─── Fixture builders ─────────────────────────────────────────────────────────

function mkIdea(status: IdeaCard["status"], slug: string): IdeaCard {
  return { slug, title: "Idea", status, body: "" };
}

function mkEvent(overrides: Partial<Event>): Event {
  return { event: "read", at: "2026-06-01T12:00:00Z", ...overrides };
}

function mkSnapshot(events: Event[]): EventsSnapshot {
  return { events, lastEventAt: events.at(-1)?.at ?? null, byProject: {} };
}

function mkStatus(partial: Partial<ProjectStatus>): StatusResult {
  return { present: true, malformed: false, status: partial };
}

const EMPTY: ReaderData = { ideas: [], statuses: [], eventsSnapshot: mkSnapshot([]) };

function withStat(data: ReaderData, key: string, value: number) {
  return computeStats(data).map((s) => (s.key === key ? { ...s, value } : s));
}

// ─── AC-10-001.2/.3 — malformed/partial reader data is honest, never NaN ──────

describe("FRD-10 [reviewer]: stats survive malformed/partial status without NaN or fabrication", () => {
  it("a malformed status with NaN/missing workOrdersDone does not poison the counter", () => {
    const data: ReaderData = {
      ideas: [],
      statuses: [
        // malformed partial: workOrdersDone is NaN (a real parse hazard)
        { present: true, malformed: true, status: { workOrdersDone: Number.NaN } },
        // valid status contributing 7
        mkStatus({ phase: "implementation", workOrdersDone: 7 }),
        // partial with no workOrdersDone at all
        mkStatus({ phase: "design" }),
      ],
      eventsSnapshot: mkSnapshot([]),
    };
    const stats = computeStats(data);
    const wo = stats.find((s) => s.key === "workorders");
    // Honest: only the verifiable 7 counts; NaN/missing contribute 0, never NaN.
    expect(wo?.value).toBe(7);
    expect(Number.isNaN(wo?.value)).toBe(false);
    // Every counter is a finite, non-negative integer (only-grow invariant).
    for (const s of stats) {
      expect(Number.isFinite(s.value)).toBe(true);
      expect(s.value).toBeGreaterThanOrEqual(0);
    }
  });

  it("an absent (present:false) status contributes nothing — no fabricated trophies", () => {
    const data: ReaderData = {
      ideas: [],
      statuses: [{ present: false, malformed: false, status: null }],
      eventsSnapshot: mkSnapshot([]),
    };
    const stats = computeStats(data);
    expect(stats.every((s) => s.value === 0)).toBe(true);
  });
});

// ─── AC-10-002.3/.4 — endowed progress: maxed chains report 100, never stuck ──

describe("FRD-10 [reviewer]: maxed chains report 100%, never an artificially stuck bar", () => {
  it("lower-is-better (speed) at/below the best tier is maxed at 100% and top tier", () => {
    // speed tiers: 30, 14, 7, 3 (lower is better). value=2 beats the legend tier (3).
    const speedMaxed = computeChains(withStat(EMPTY, "speed", 2)).find(
      (c) => c.statKey === "speed",
    );
    expect(speedMaxed?.currentTierIndex).toBe(3); // top tier
    expect(speedMaxed?.nextTier).toBeNull(); // nothing better to reach
    expect(speedMaxed?.pctToNext).toBe(100); // honest full, NOT stuck below
    // exactly AT the best tier (3) is also maxed
    const at3 = computeChains(withStat(EMPTY, "speed", 3)).find((c) => c.statKey === "speed");
    expect(at3?.currentTierIndex).toBe(3);
    expect(at3?.pctToNext).toBe(100);
  });

  it("higher-is-better (shipped) far past the legend threshold is maxed at 100%", () => {
    // shipped tiers top out at 50. value=999 → maxed, not a >100 overflow or stuck value.
    const shipped = computeChains(withStat(EMPTY, "shipped", 999)).find(
      (c) => c.statKey === "shipped",
    );
    expect(shipped?.currentTierIndex).toBe(4); // legend
    expect(shipped?.nextTier).toBeNull();
    expect(shipped?.pctToNext).toBe(100);
  });

  it("a value just one short of a tier reports <100 (honest, not rounded up to full)", () => {
    // shipped tier1=1, tier2=5. value=4 → 3/4 of the way (between 1 and 5).
    const shipped = computeChains(withStat(EMPTY, "shipped", 4)).find(
      (c) => c.statKey === "shipped",
    );
    expect(shipped?.currentTierIndex).toBe(0); // crossed tier1 only
    expect(shipped?.pctToNext).toBeGreaterThan(0);
    expect(shipped?.pctToNext).toBeLessThan(100); // NOT prematurely 100
  });
});

// ─── AC-10-002.2 — unlock dates must be verifiable, never fabricated ──────────

describe("FRD-10 [reviewer]: shipped unlock dates are verifiable, never fabricated empties", () => {
  it("a shipped project with NO updatedAt emits NO fabricated empty-date unlock row", () => {
    const data: ReaderData = {
      ideas: [],
      // one shipped project, but with no updatedAt timestamp at all
      statuses: [mkStatus({ phase: "release", project: "ghost" })],
      eventsSnapshot: mkSnapshot([]),
    };
    const shipped = computeChains(computeStats(data)).find((c) => c.statKey === "shipped");
    // Tier 1 IS crossed (1 shipped product) …
    expect(shipped?.currentTierIndex).toBe(0);
    // … but with no verifiable date, the engine must NOT emit an unlock with date:"".
    expect(shipped?.unlocks.every((u) => u.date.length > 0)).toBe(true);
  });

  it("ChainCard never renders an empty/blank date for a dated-less shipped unlock", () => {
    const data: ReaderData = {
      ideas: [],
      statuses: [mkStatus({ phase: "release", project: "ghost" })],
      eventsSnapshot: mkSnapshot([]),
    };
    const shipped = computeChains(computeStats(data)).find((c) => c.statKey === "shipped");
    if (!shipped) throw new Error("shipped chain missing");
    render(<ChainCard chain={shipped} />);
    // No unlock row claims an empty/fabricated date.
    for (const row of screen.queryAllByTestId("chain-unlock-item")) {
      expect(row.textContent?.trim().length).toBeGreaterThan(0);
    }
  });
});

// ─── AC-10-004.3 — secret 'void' must not unlock while active ideas exist ─────

describe("FRD-10 [reviewer]: 'void' secret does not fire while the idea base is alive", () => {
  it("does NOT unlock when at least one active (in-pipeline) idea remains", () => {
    const data: ReaderData = {
      ideas: [mkIdea("discarded", "a"), mkIdea("in-pipeline", "live")],
      statuses: [],
      eventsSnapshot: mkSnapshot([]),
    };
    const voidSecret = computeSecrets(data).find((s) => s.hint.toLowerCase().includes("vac"));
    expect(voidSecret?.unlocked).toBe(false);
    // Locked → criterion stays hidden (anti-loot-box).
    expect(voidSecret?.criterion).toBeUndefined();
  });

  it("unlocks honestly when the base is non-empty but fully inactive, with a provable project and no fabricated date", () => {
    const data: ReaderData = {
      ideas: [mkIdea("discarded", "alpha"), mkIdea("discarded", "zeta")],
      statuses: [],
      eventsSnapshot: mkSnapshot([]),
    };
    const voidSecret = computeSecrets(data).find((s) => s.hint.toLowerCase().includes("vac"));
    expect(voidSecret?.unlocked).toBe(true);
    expect(voidSecret?.date).toBeUndefined(); // no source timestamp → honestly omitted
    // project is one of the real discarded slugs, never invented
    expect(["alpha", "zeta"]).toContain(voidSecret?.project);
    expect(typeof voidSecret?.criterion).toBe("string"); // criterion revealed on unlock
  });
});

// ─── AC-10-001.4 / .003.4 / .004.4 — engine is pure (no hidden clock) ─────────

describe("FRD-10 [reviewer]: engine is pure — identical input yields identical output", () => {
  it("computeStats/computeChains/computeUniques/computeSecrets are deterministic", () => {
    const at = "2026-06-15T09:30:00Z";
    const data: ReaderData = {
      ideas: [mkIdea("discovered", "i1"), mkIdea("discarded", "d1")],
      statuses: [mkStatus({ phase: "release", project: "p", updatedAt: at })],
      eventsSnapshot: mkSnapshot([
        mkEvent({ event: "review", at, status: "ok", agent: "frd-reviewer", project: "p" }),
        mkEvent({ event: "achievement", at, status: "ok", task: "prd", project: "p" }),
      ]),
    };
    expect(computeStats(data)).toStrictEqual(computeStats(data));
    expect(computeChains(computeStats(data))).toStrictEqual(computeChains(computeStats(data)));
    expect(computeUniques(data)).toStrictEqual(computeUniques(data));
    expect(computeSecrets(data)).toStrictEqual(computeSecrets(data));
  });
});

// ─── ChainCard: maxed chain has no next-tier label and a full bar ─────────────

describe("FRD-10 [reviewer]: ChainCard renders a maxed chain honestly", () => {
  it("a maxed shipped chain shows no 'Siguiente' label and a non-empty tier badge", () => {
    const shipped = computeChains(withStat(EMPTY, "shipped", 999)).find(
      (c) => c.statKey === "shipped",
    );
    if (!shipped) throw new Error("shipped chain missing");
    render(<ChainCard chain={shipped} />);
    // Maxed → next-tier-name node absent (AC-10-006.1 boundary).
    expect(screen.queryByTestId("chain-next-tier-name")).toBeNull();
    // Tier badge present with the legend label (state not by color alone).
    const badge = screen.getByTestId("chain-tier-badge");
    expect(badge.getAttribute("data-tier")).toBe("5");
    expect(badge.textContent?.trim().length).toBeGreaterThan(0);
  });
});
