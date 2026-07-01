/**
 * FRD-17 — REVIEWER gate test for the OPEN integration items (DR-015 / DR-050).
 *
 * The prior gate composed the orphaned MemoryHealth + PromotionsQueue panels into
 * the page (proposals-composition.reviewer.test.tsx — now GREEN). But the repair
 * note for WO-17-004 explicitly LEFT TWO ITEMS OPEN, with no RED test guarding them:
 *
 *   (1) REQ-17-008 / AC-17-007.3 — proposals SHALL be dismissible. The dismiss store
 *       (proposalsDismissStore) exists and is unit-tested, but it is wired into NO
 *       rendered surface: the page exposes no dismiss affordance, so the owner cannot
 *       dismiss anything in the running app. A "SHALL be dismissible" criterion is
 *       unmet by a store that mounts nowhere.
 *
 *   (2) REQ-17-004 — Mission Control SHALL compute self-suggestions from data it
 *       already reads: bottlenecks, velocity, unused-capability, policy-friction,
 *       recurring-lesson, launch-review. The page calls computeSuggestions() with
 *       HARDCODED EMPTY inputs (boardColumnCounts:{}, portfolioItems:[], events:[],
 *       capabilities:[], decisionRules:[], inboxDecisionLines:[]), so only
 *       `recurring-lesson` (fed by `lessons`) can ever fire. The other FIVE
 *       derivations are dead production code — the FRD's "SHALL compute … bottlenecks,
 *       velocity, unused capability, policy friction, … a shipped project" is unmet.
 *
 * These exercise the REAL ProposalsPage. They are EXPECTED TO FAIL against the
 * current page and are the RED tests the WO-17-004 rebuild must turn GREEN.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Lesson } from "@/lib/memory/memory";

const CANDIDATE_LESSON: Lesson = {
  id: "LESSON-0009",
  type: "gotcha",
  domain: "testing",
  context: "resumen de una línea de la lección",
  status: "candidate",
  promotion: "none",
  source: "proj-alpha (WO-01-001)",
  links: [],
  projects: ["proj-alpha"],
  body: "**Situation:** S.\n\n**Lesson:** L.\n\n**Apply next time:** A.",
  evalGate: "awaiting-2nd",
};

vi.mock("@/lib/memory/memory", () => ({
  candidateLessons: vi.fn(() => [CANDIDATE_LESSON]),
  promotionQueue: vi.fn(() => []),
  prunable: vi.fn(() => []),
}));

vi.mock("@/lib/memory/memory-health", () => ({
  memoryHealth: vi.fn(() => ({
    rawNotes: 3,
    candidates: 1,
    lastMemoryRunAt: "2026-06-17T00:00:00.000Z",
    staleDays: 1,
  })),
}));

// Spy on the real computeSuggestions so we can inspect what inputs the PAGE passes.
const computeSuggestionsSpy = vi.fn((input: unknown): unknown[] => {
  void input;
  return [];
});

vi.mock("@/lib/self-suggest/self-suggest", () => ({
  computeSuggestions: (input: unknown) => computeSuggestionsSpy(input),
}));

async function renderPage(): Promise<void> {
  const { default: ProposalsPage } = await import("../page");
  render(<ProposalsPage />);
}

describe("FRD-17 gate: the open integration items (REQ-17-008 dismiss, REQ-17-004 self-suggest wiring)", () => {
  it("REQ-17-008 / AC-17-007.3 — the page exposes a dismiss affordance for a proposal", async () => {
    await renderPage();
    // A candidate lesson is rendered; the owner must be able to dismiss it.
    // The affordance is an accessible control whose name mentions dismissing
    // (descartar / ocultar). Today there is none — the dismiss store is orphaned.
    const dismissControls = screen.queryAllByRole("button", {
      name: /descartar|ocultar|dismiss/i,
    });
    expect(dismissControls.length).toBeGreaterThan(0);
  });

  it("REQ-17-004 — the page feeds computeSuggestions REAL reader data, not hardcoded empty inputs", async () => {
    await renderPage();
    expect(computeSuggestionsSpy).toHaveBeenCalled();
    const input = computeSuggestionsSpy.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(input).toBeDefined();

    // The five non-lesson derivations (bottleneck, velocity, unused-capability,
    // policy-friction, launch-review) can ONLY fire if their inputs are non-empty.
    // If the page wires the real readers (lib/board, lib/portfolio, lib/events,
    // lib/reference, lib/registry, inbox decisions), at least these source fields
    // must NOT all be empty literals. Today every one is hardcoded empty.
    const boardCounts = (input?.boardColumnCounts ?? {}) as Record<string, number>;
    const portfolioItems = (input?.portfolioItems ?? []) as unknown[];
    const events = (input?.events ?? []) as unknown[];
    const capabilities = (input?.capabilities ?? []) as unknown[];
    const decisionRules = (input?.decisionRules ?? []) as unknown[];

    const allFiveSourcesEmpty =
      Object.keys(boardCounts).length === 0 &&
      portfolioItems.length === 0 &&
      events.length === 0 &&
      capabilities.length === 0 &&
      decisionRules.length === 0;

    // RED today: the page passes all-empty inputs → 5 of 6 derivations are dead.
    expect(allFiveSourcesEmpty).toBe(false);
  });
});
