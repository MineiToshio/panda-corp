/**
 * `countIdeas` / `getIdeaCounts` — THE single source of truth for idea counts
 * (DR-092/DR-115). Before this resolver, `page.tsx` (Pulso) and `funnel.ts`
 * (`funnelAndFlow`) each re-filtered `IdeaCard[]` by status independently.
 *
 * `countIdeas` is pure over an already-read `IdeaCard[]` (no I/O); `getIdeaCounts`
 * additionally wraps `readIdeas()` in React's request-scoped `cache()`.
 */

import { describe, expect, it } from "vitest";
import { FIXTURE_FRESH, FIXTURE_FULL, withFactoryRoot } from "../../../tests/fixtures";
import type { Phase, StatusResult } from "../../status/status";
import { countIdeas, countLaunched, getIdeaCounts, type IdeaCard, type IdeaStatus } from "../ideas";

function idea(status: IdeaStatus, slug: string, over: Partial<IdeaCard> = {}): IdeaCard {
  return { slug, title: "t", status, body: "", ...over };
}

function statusAt(phase: Phase): StatusResult {
  return { present: true, malformed: false, status: { phase } };
}

describe("countIdeas — pure derivation over an IdeaCard[]", () => {
  it("counts total/alive/shipped/discarded and the full per-status breakdown", () => {
    const ideas: IdeaCard[] = [
      idea("discovered", "a"),
      idea("discovered", "b"),
      idea("recommended", "c"),
      idea("in-pipeline", "d"),
      idea("shipped", "e"),
      idea("shipped", "f"),
      idea("discarded", "g"),
    ];

    const counts = countIdeas(ideas);

    expect(counts.totalIdeas).toBe(7);
    // Alive excludes shipped (2) and discarded (1): 7 - 2 - 1 = 4.
    expect(counts.ideasAlive).toBe(4);
    expect(counts.ideasShipped).toBe(2);
    expect(counts.ideasDiscarded).toBe(1);
    expect(counts.byStatus).toEqual({
      discovered: 2,
      recommended: 1,
      "in-pipeline": 1,
      shipped: 2,
      discarded: 1,
    });
  });

  it("empty ideas → every count 0, every status bucket present (no divide-by-zero/undefined)", () => {
    const counts = countIdeas([]);
    expect(counts.totalIdeas).toBe(0);
    expect(counts.ideasAlive).toBe(0);
    expect(counts.ideasShipped).toBe(0);
    expect(counts.ideasDiscarded).toBe(0);
    expect(counts.byStatus).toEqual({
      discovered: 0,
      recommended: 0,
      "in-pipeline": 0,
      shipped: 0,
      discarded: 0,
    });
  });
});

describe("getIdeaCounts — request-cached resolver over readIdeas()", () => {
  it("factory-full fixture: 5 valid cards, 1 shipped, 1 discarded, 3 alive", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const counts = getIdeaCounts();
      expect(counts.totalIdeas).toBe(5);
      expect(counts.ideasShipped).toBe(1);
      expect(counts.ideasDiscarded).toBe(1);
      expect(counts.ideasAlive).toBe(3);
    });
  });

  it("factory-fresh fixture: empty ideas folder → all counts 0", async () => {
    await withFactoryRoot(FIXTURE_FRESH, () => {
      const counts = getIdeaCounts();
      expect(counts.totalIdeas).toBe(0);
      expect(counts.ideasAlive).toBe(0);
      expect(counts.ideasShipped).toBe(0);
      expect(counts.ideasDiscarded).toBe(0);
    });
  });
});

// ===========================================================================
// countLaunched — THE single bridge resolver for "how many launches"
// (DR-085/DR-115). Regression anchor: Inicio's Pulso showed "Lanzados 0" while
// Logros' Informe showed "Lanzados 2" for the SAME factory state, because each
// surface re-derived the fact independently (shipped-cards-only vs
// release-phase-only). This helper is the single fix for both.
// ===========================================================================

describe("countLaunched — DR-085 bridge (shipped cards ∪ release-phase projects, no double count)", () => {
  it("empty factory → 0, never throws", () => {
    expect(countLaunched([], [])).toBe(0);
  });

  it("shipped-only: a legacy shipped card with no linked project counts", () => {
    const ideas = [idea("shipped", "old-launch")];
    expect(countLaunched(ideas, [])).toBe(1);
  });

  it("release-only: a portfolio project at phase release counts even with zero shipped cards", () => {
    const ideas = [idea("in-pipeline", "mission-control", { project: "mission-control" })];
    const statuses = [statusAt("release")];
    expect(countLaunched(ideas, statuses)).toBe(1);
  });

  it("both present, no overlap: a shipped card with no project PLUS a separate released project sum to 2", () => {
    const ideas = [
      idea("shipped", "old-launch"),
      idea("in-pipeline", "mission-control", { project: "mission-control" }),
    ];
    const statuses = [statusAt("release")];
    expect(countLaunched(ideas, statuses)).toBe(2);
  });

  it("overlap guard: a shipped card that DOES carry a project pointer is not double-counted against its (already-counted) released project", () => {
    // DR-085: once a card has a linked project, that project's own status.yaml phase
    // is the authoritative record — the ideas side must not also count it.
    const ideas = [idea("shipped", "mission-control", { project: "mission-control" })];
    const statuses = [statusAt("release")];
    expect(countLaunched(ideas, statuses)).toBe(1);
  });

  it("non-release phases and non-shipped statuses contribute nothing", () => {
    const ideas = [
      idea("discovered", "a"),
      idea("recommended", "b"),
      idea("in-pipeline", "c", { project: "c" }),
      idea("discarded", "d"),
    ];
    const statuses = [
      statusAt("product"),
      statusAt("design"),
      statusAt("architecture"),
      statusAt("implementation"),
    ];
    expect(countLaunched(ideas, statuses)).toBe(0);
  });

  it("an absent or malformed status entry is never counted as released", () => {
    const absent: StatusResult = { present: false, malformed: false, status: null };
    const malformed: StatusResult = { present: true, malformed: true, status: {} };
    expect(countLaunched([], [absent, malformed])).toBe(0);
  });

  it("multiple released projects and multiple shipped-without-project cards all count", () => {
    const ideas = [idea("shipped", "a"), idea("shipped", "b")];
    const statuses = [statusAt("release"), statusAt("release"), statusAt("implementation")];
    expect(countLaunched(ideas, statuses)).toBe(4);
  });
});
