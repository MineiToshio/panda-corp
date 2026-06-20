/**
 * FRD-10 [reviewer] — Achievements Hall integration + honesty adversarial gate.
 *
 * Written by the FRD-gate reviewer (DR-015/DR-050), a different model from the
 * implementers. Exercises the work orders TOGETHER (engine → components), with
 * edge/abuse cases the implementers did not cover, anchored in the FRD EARS
 * criteria and the blueprint §5 honesty contract.
 *
 * Focus:
 *   - AC-10-004.3 (secrets): an unlock MUST be derived from a VERIFIABLE result,
 *     never fabricated. The implementer's own secret tests are vacuous (guarded by
 *     `if (secret?.unlocked)`), so they never assert the unlock is honest.
 *   - AC-10-001.3 / §5: empty factory → honest empty, never fabricated trophies.
 *   - AC-10-002.3: endowed progress is honest (real achieved, never inflated/stuck).
 *   - Real integration: computeStats → computeChains → ChainCard / AlmostThere,
 *     computeSecrets → SecretsPanel.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { computeChains, computeSecrets } from "@/lib/achievements/achievements";
import { computeStats, type ReaderData } from "@/lib/achievements/stats";
import type { Event, EventsSnapshot } from "@/lib/events/events";
import type { IdeaCard } from "@/lib/ideas/ideas";
import type { StatusResult } from "@/lib/status/status";
import { AlmostThere } from "../AlmostThere";
import { ChainCard } from "../ChainCard/ChainCard";
import { SecretsPanel } from "../SecretsPanel/SecretsPanel";

// ─── Fixture builders (mirror the real reader shapes) ────────────────────────

function mkIdea(status: IdeaCard["status"], slug: string): IdeaCard {
  return { slug, title: "Idea", status, body: "" };
}

function mkEvent(overrides: Partial<Event>): Event {
  return { event: "read", at: "2026-06-01T12:00:00Z", ...overrides };
}

function mkSnapshot(events: Event[]): EventsSnapshot {
  return { events, lastEventAt: events.at(-1)?.at ?? null, byProject: {} };
}

function mkStatus(phase: string, project: string, updatedAt: string): StatusResult {
  return {
    present: true,
    malformed: false,
    status: {
      project,
      // biome-ignore lint/suspicious/noExplicitAny: test fixture narrows the phase enum
      phase: phase as any,
      workOrdersDone: 0,
      workOrdersTotal: 10,
      pendingDecisions: 0,
      pendingBugs: 0,
      running: false,
      rethinkPending: false,
      advancePending: false,
      lastGreenSha: "",
      safeToTest: true,
      version: "1.0.0",
      updatedAt,
    },
  };
}

const EMPTY: ReaderData = { ideas: [], statuses: [], eventsSnapshot: mkSnapshot([]) };

// ─── AC-10-004.3 — secret unlocks must be honest (NOT fabricated) ────────────

describe("FRD-10 [reviewer]: secret unlocks are verifiable, never fabricated (AC-10-004.3)", () => {
  it("the 'void' secret must NOT fabricate an unlock date that no source can prove", () => {
    // The only way to unlock 'void' is an idea base that is non-empty but has no
    // active ideas. IdeaCard carries NO date field, so the unlock date can only be
    // honest if derived from a real timestamp — never an invented constant.
    const data: ReaderData = {
      ideas: [mkIdea("discarded", "a"), mkIdea("discarded", "b")],
      statuses: [],
      eventsSnapshot: mkSnapshot([]),
    };
    const secrets = computeSecrets(data);
    const voidSecret = secrets.find((s) => s.hint.toLowerCase().includes("vac"));
    expect(voidSecret).toBeDefined();

    if (voidSecret?.unlocked) {
      // No verifiable timestamp exists in the input, so a hardcoded date is a
      // fabrication — exactly what AC-10-004.3 + blueprint §5 forbid.
      // (Discovered bug: predicates.ts returns date: "2026-01-01".)
      expect(voidSecret.date).not.toBe("2026-01-01");
      // Stronger: the unlock date, if present, must appear somewhere in the source.
      const sourceDates = new Set<string>(); // no events, no status timestamps here
      expect(
        voidSecret.date === undefined || sourceDates.has(voidSecret.date),
        `void secret unlocked with date "${voidSecret.date}" not traceable to any source (fabricated)`,
      ).toBe(true);
    }
  });

  it("an honestly unlockable secret derives its date from a real event timestamp", () => {
    // 'code reviewed the code': a reviewer agent review event. Its unlock date
    // MUST equal the triggering event's `at` (a verifiable source) — not invented.
    const at = "2026-06-15T09:30:00Z";
    const data: ReaderData = {
      ideas: [],
      statuses: [],
      eventsSnapshot: mkSnapshot([
        mkEvent({ event: "review", at, status: "ok", agent: "frd-gate-reviewer", project: "mc" }),
      ]),
    };
    const secrets = computeSecrets(data);
    const codeReview = secrets.find((s) => s.hint.toLowerCase().includes("código"));
    expect(codeReview?.unlocked).toBe(true);
    expect(codeReview?.date).toBe(at); // traceable to the real event
    expect(codeReview?.project).toBe("mc");
    expect(typeof codeReview?.criterion).toBe("string"); // revealed on unlock
  });
});

// ─── AC-10-001.3 / §5 — empty factory: honest, no fabricated trophies ────────

describe("FRD-10 [reviewer]: empty factory is honest (AC-10-001.3, §5)", () => {
  it("no secret unlocks on a fully empty factory", () => {
    const secrets = computeSecrets(EMPTY);
    expect(secrets.every((s) => !s.unlocked)).toBe(true);
    // and locked secrets must NOT leak a criterion (anti-loot-box stays closed)
    expect(secrets.every((s) => s.criterion === undefined)).toBe(true);
  });

  it("all stat counters are honest zeros and all chains have no tier", () => {
    const stats = computeStats(EMPTY);
    expect(stats.every((s) => s.value === 0)).toBe(true);
    const chains = computeChains(stats);
    expect(chains.every((c) => c.currentTierIndex === -1)).toBe(true);
    // honest empty: no chain claims progress it didn't earn beyond endowed start
    expect(chains.every((c) => c.pctToNext >= 0 && c.pctToNext <= 100)).toBe(true);
  });
});

// ─── AC-10-002.3 — endowed progress honest (never inflated, never stuck) ─────

describe("FRD-10 [reviewer]: endowed progress is honest (AC-10-002.3)", () => {
  it("a higher-is-better chain at exactly half-way between tiers reports a mid bar, not 0 or 100", () => {
    // workorders chain: tier1=10, tier2=50. value=30 → 20/40 = 50%.
    const data: ReaderData = {
      ideas: [],
      statuses: [mkStatus("operation", "p", "2026-01-01T00:00:00Z")],
      eventsSnapshot: mkSnapshot([]),
    };
    // override the workorders stat directly via a synthetic stat array
    const stats = computeStats(data).map((s) => (s.key === "workorders" ? { ...s, value: 30 } : s));
    const chains = computeChains(stats);
    const wo = chains.find((c) => c.statKey === "workorders");
    expect(wo?.currentTierIndex).toBe(0); // crossed tier1 (10)
    expect(wo?.pctToNext).toBeGreaterThan(0);
    expect(wo?.pctToNext).toBeLessThan(100);
    expect(wo?.pctToNext).toBe(50); // honest: real achieved fraction, not inflated
  });

  it("lower-is-better (speed) improves as the value drops toward the next threshold", () => {
    const mk = (speed: number) =>
      computeChains(
        computeStats(EMPTY).map((s) => (s.key === "speed" ? { ...s, value: speed } : s)),
      ).find((c) => c.statKey === "speed");
    // tiers: 30, 14, 7, 3 (lower is better)
    const at30 = mk(30); // just crossed tier1
    const at22 = mk(22); // partway 30→14
    expect(at30?.pctToNext).toBe(0);
    expect(at22?.pctToNext).toBeGreaterThan(0);
    expect(at22?.pctToNext).toBeLessThan(100);
    // a value of 0 = "no record" → not a fabricated best, 0% progress
    expect(mk(0)?.pctToNext).toBe(0);
    expect(mk(0)?.currentTierIndex).toBe(-1);
  });
});

// ─── Real integration: engine output renders honestly in the components ──────

describe("FRD-10 [reviewer]: engine → component integration", () => {
  it("ChainCard renders the real unlock date+project from computeStats(shipped)", () => {
    const data: ReaderData = {
      ideas: [],
      statuses: [
        mkStatus("operation", "alpha", "2026-02-01T00:00:00Z"),
        mkStatus("operation", "beta", "2026-03-01T00:00:00Z"),
      ],
      eventsSnapshot: mkSnapshot([]),
    };
    const chains = computeChains(computeStats(data));
    const shipped = chains.find((c) => c.statKey === "shipped");
    expect(shipped).toBeDefined();
    if (!shipped) return;

    render(<ChainCard chain={shipped} />);
    const unlocks = screen.getAllByTestId("chain-unlock-item");
    expect(unlocks.length).toBeGreaterThanOrEqual(1);
    // The first tier (1 shipped) unlocked by the EARLIEST shipped project — honest.
    expect(unlocks[0]?.textContent).toContain("alpha");
    expect(unlocks[0]?.textContent).toContain("2026-02-01");
  });

  it("AlmostThere never shows a maxed chain and uses no false-urgency language", () => {
    const data: ReaderData = {
      ideas: [mkIdea("discovered", "i1"), mkIdea("discovered", "i2"), mkIdea("discovered", "i3")],
      statuses: [],
      eventsSnapshot: mkSnapshot([]),
    };
    const chains = computeChains(computeStats(data));
    render(<AlmostThere chains={chains} />);
    const section = screen.getByTestId("almost-there");
    const text = section.textContent ?? "";
    // No countdowns / urgency (AC-10-006.4 negative AC).
    expect(/urgente|¡rápido|ahora mismo|hoy|countdown|cuenta atrás/i.test(text)).toBe(false);
    // Items shown must not be maxed.
    for (const item of screen.queryAllByTestId("almost-there-item")) {
      const key = item.getAttribute("data-stat-key");
      const chain = chains.find((c) => c.statKey === key);
      expect(chain?.pctToNext).toBeLessThan(100);
    }
  });

  it("SecretsPanel keeps a locked secret's criterion hidden end-to-end", () => {
    const secrets = computeSecrets(EMPTY);
    render(<SecretsPanel secrets={secrets} />);
    // every rendered item is locked → silhouette shown, no criterion node
    const items = screen.getAllByTestId("secret-item");
    expect(items.length).toBe(secrets.length);
    expect(items.every((i) => i.getAttribute("data-locked") === "true")).toBe(true);
    expect(screen.queryByTestId("secret-criterion")).toBeNull();
    expect(screen.getAllByTestId("secret-silhouette").length).toBe(secrets.length);
  });
});
