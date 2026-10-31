import { describe, expect, it } from "vitest";
import type { ProposalsData } from "../data";
import { validProposalsSegments } from "../routeSelection";

const data: ProposalsData = {
  lessons: [],
  suggestions: [],
  skillCount: 0,
  discoveredIdeas: 0,
  memoryError: null,
  health: {
    rawNotes: 0,
    candidates: 0,
    lastMemoryRunAt: null,
    staleDays: null,
    lastSweepAt: null,
    harvestOrphans: [],
  },
  backlog: { items: [], errors: [] },
};
describe("bounded proposals routes AC-25-001.1 AC-25-002.1", () => {
  it("accepts only the exact tab grammar", () => {
    for (const segments of [["resumen"], ["memory"], ["backlog"], ["memory", "promotions"]])
      expect(validProposalsSegments(segments, data)).toBe(true);
    for (const segments of [
      [],
      ["unknown"],
      ["resumen", "extra"],
      ["memory", "wrong"],
      ["backlog", "missing"],
      ["memory", "promotions", "missing"],
      ["memory", "prune", "x", "extra"],
      ["memory", "x".repeat(201)],
    ])
      expect(validProposalsSegments(segments, data)).toBe(false);
  });
  it("resolves records only inside their owning collection", () => {
    const lesson = {
      id: "LESSON-1",
      type: "pattern",
      domain: "quality",
      context: "A useful lesson",
      trigger: "",
      status: "candidate" as const,
      promotion: "proposed" as const,
      source: "",
      links: [],
      projects: [],
      appliedIn: [],
      body: "Proof",
      evalGate: "awaiting-2nd" as const,
    };
    const input = { ...data, lessons: [lesson] };
    expect(validProposalsSegments(["memory", "promotions", "LESSON-1"], input)).toBe(true);
    expect(validProposalsSegments(["memory", "candidate-lesson", "LESSON-1"], input)).toBe(true);
    expect(validProposalsSegments(["memory", "prune", "LESSON-1"], input)).toBe(false);
    expect(validProposalsSegments(["memory", "promotions", "LESSON-2"], input)).toBe(false);
    expect(
      validProposalsSegments(["memory", "promotions", "LESSON-1"], {
        ...input,
        lessons: [{ ...lesson, promotion: "rejected" }],
      }),
    ).toBe(false);
  });
});
