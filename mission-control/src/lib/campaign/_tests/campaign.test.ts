/**
 * WO-02-011 — `phaseFromStatus` derivation tests
 *
 * Traceability: AC-02-010.2, CMP-02-phase-from-status, IF-02-phaseFromStatus
 *
 * Tests cover every row from the mapping table in blueprint §4b:
 *   | Card status           | Project phase           | → Active phase |
 *   |-----------------------|-------------------------|----------------|
 *   | discovered/recommended| —                       | 0 research     |
 *   | in-pipeline           | product                 | 1 product      |
 *   | in-pipeline           | design                  | 2 design       |
 *   | in-pipeline           | architecture            | 3 architecture |
 *   | in-pipeline           | implementation          | 4 build        |
 *   | in-pipeline           | release                 | 4 build        |
 *   | in-pipeline           | operation               | 5 release      |
 *   | shipped               | —                       | 5 release      |
 *   | absent/unrecognized   | —                       | 0 research (fallback) |
 *
 * Edge cases:
 *   - undefined input object → 0 (no throw)
 *   - malformed/null input → 0 (no throw)
 *   - in-pipeline with no phase → 0 (fallback)
 *   - discarded card → 0 (no active phase, fallback)
 */

import { describe, expect, it } from "vitest";
import type { CampaignPhase } from "../campaign";
import { phaseFromStatus } from "../campaign";

describe("phaseFromStatus", () => {
  // -----------------------------------------------------------------------
  // Row 1: discovered / recommended → 0 (research)
  // -----------------------------------------------------------------------
  describe("pre-pipeline cards → research (0)", () => {
    it("returns 0 for discovered status", () => {
      const result: CampaignPhase = phaseFromStatus({ cardStatus: "discovered" });
      expect(result).toBe(0);
    });

    it("returns 0 for recommended status", () => {
      const result: CampaignPhase = phaseFromStatus({ cardStatus: "recommended" });
      expect(result).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Row 2–6: in-pipeline with each project phase
  // -----------------------------------------------------------------------
  describe("in-pipeline cards → phase from project status", () => {
    it("returns 1 for in-pipeline + product phase", () => {
      expect(phaseFromStatus({ cardStatus: "in-pipeline", phase: "product" })).toBe(1);
    });

    it("returns 2 for in-pipeline + design phase", () => {
      expect(phaseFromStatus({ cardStatus: "in-pipeline", phase: "design" })).toBe(2);
    });

    it("returns 3 for in-pipeline + architecture phase", () => {
      expect(phaseFromStatus({ cardStatus: "in-pipeline", phase: "architecture" })).toBe(3);
    });

    it("returns 4 for in-pipeline + implementation phase", () => {
      expect(phaseFromStatus({ cardStatus: "in-pipeline", phase: "implementation" })).toBe(4);
    });

    it("returns 4 for in-pipeline + release phase", () => {
      expect(phaseFromStatus({ cardStatus: "in-pipeline", phase: "release" })).toBe(4);
    });

    it("returns 5 for in-pipeline + operation phase", () => {
      expect(phaseFromStatus({ cardStatus: "in-pipeline", phase: "operation" })).toBe(5);
    });
  });

  // -----------------------------------------------------------------------
  // Row 7: shipped → 5 (release)
  // -----------------------------------------------------------------------
  describe("shipped cards → release (5)", () => {
    it("returns 5 for shipped status", () => {
      expect(phaseFromStatus({ cardStatus: "shipped" })).toBe(5);
    });

    it("returns 5 for shipped even when a phase is supplied", () => {
      // Card status takes precedence: shipped always maps to 5
      expect(phaseFromStatus({ cardStatus: "shipped", phase: "product" })).toBe(5);
    });
  });

  // -----------------------------------------------------------------------
  // Row 8: absent/unrecognized → 0 (research fallback, AC-02-010.2)
  // -----------------------------------------------------------------------
  describe("absent or unrecognized input → research (0) fallback", () => {
    it("returns 0 when cardStatus is undefined", () => {
      expect(phaseFromStatus({})).toBe(0);
    });

    it("returns 0 when cardStatus is undefined but a phase is supplied", () => {
      // Phase alone without cardStatus → fallback (card axis is authoritative)
      expect(phaseFromStatus({ phase: "design" })).toBe(0);
    });

    it("returns 0 for discarded status (no active campaign phase)", () => {
      expect(phaseFromStatus({ cardStatus: "discarded" })).toBe(0);
    });

    it("returns 0 for in-pipeline with no phase (missing project)", () => {
      // in-pipeline but no phase → fallback to research (AC-02-010.2 edge case)
      expect(phaseFromStatus({ cardStatus: "in-pipeline" })).toBe(0);
    });

    it("returns 0 for in-pipeline with undefined phase", () => {
      expect(phaseFromStatus({ cardStatus: "in-pipeline", phase: undefined })).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Robustness: malformed / undefined input must not throw
  // -----------------------------------------------------------------------
  describe("malformed or undefined input → 0 without throwing", () => {
    it("returns 0 for an empty-looking object (no fields)", () => {
      expect(() => phaseFromStatus({})).not.toThrow();
      expect(phaseFromStatus({})).toBe(0);
    });

    it("is a pure function: same input always returns same output", () => {
      const a = phaseFromStatus({ cardStatus: "in-pipeline", phase: "design" });
      const b = phaseFromStatus({ cardStatus: "in-pipeline", phase: "design" });
      expect(a).toBe(b);
      expect(a).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Type guard: return value is always a valid CampaignPhase (0–5)
  // -----------------------------------------------------------------------
  describe("return values are always in range 0–5", () => {
    const allCombinations = [
      { cardStatus: "discovered" as const },
      { cardStatus: "recommended" as const },
      { cardStatus: "in-pipeline" as const, phase: "product" as const },
      { cardStatus: "in-pipeline" as const, phase: "design" as const },
      { cardStatus: "in-pipeline" as const, phase: "architecture" as const },
      { cardStatus: "in-pipeline" as const, phase: "implementation" as const },
      { cardStatus: "in-pipeline" as const, phase: "release" as const },
      { cardStatus: "in-pipeline" as const, phase: "operation" as const },
      { cardStatus: "shipped" as const },
      { cardStatus: "discarded" as const },
      {},
    ];

    it.each(allCombinations)("phaseFromStatus(%o) returns 0–5", (input) => {
      const result = phaseFromStatus(input);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(5);
      expect(Number.isInteger(result)).toBe(true);
    });
  });
});
