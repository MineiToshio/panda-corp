/**
 * WO-02-003 — `nextStep` command map — ADVERSARIAL review tests (DR-015 / DR-016)
 *
 * Written by the reviewer (Opus 4.8), a different model from the implementer, to probe
 * edge cases, abuse and mutation-survival the implementer's own suite did not cover.
 * Derived from AC-02-004.1, DR-032, the WO-02-003 contract and real incidents in
 * .pandacorp/comms/progress.md (B1', I2, I3 — invalid scalars fooling typeof).
 *
 * Focus areas NOT covered by next-step.test.ts:
 *   1. Garbage / unknown cardStatus values (the input may originate from untyped YAML;
 *      readStatus/readCard reject bad values but a caller could still pass a stray string).
 *   2. advancePending must be a *meaningful, actionable* hint — not merely "any difference".
 *      A mutant that appends a single space, or "x", would pass the implementer's
 *      `commandDiffers || labelDiffers` test. We require the DR-032 acknowledgement intent.
 *   3. advancePending on terminal / pre-pipeline statuses must NOT leak the advance hint.
 *   4. Terminal statuses (shipped/discarded) must not regress to a build command — and the
 *      label must be substantive, not a single throwaway character.
 *   5. Mutation hardening of the `phase in PHASE_COMMANDS` guard and per-phase labels.
 *
 * Pure function — no fs, no mocks, no external state.
 */

import { describe, expect, it } from "vitest";

import { type NextStep, nextStep } from "../next-step";

// Pipeline progression commands — none of these may appear for terminal states.
const PIPELINE_COMMANDS = [
  "/pandacorp:spec <idea>",
  "/pandacorp:design",
  "/pandacorp:blueprint",
  "/pandacorp:implement",
  "/pandacorp:release",
];

// ---------------------------------------------------------------------------
// 1. Garbage / unknown cardStatus — defensive fallback, never throw
//    The contract type is IdeaStatus, but the function is the boundary owner.
//    A stray string from a malformed file must produce the safe pre-pipeline result.
// ---------------------------------------------------------------------------

describe("frd-02 adversarial: unknown / garbage cardStatus", () => {
  const garbage = [
    "DISCOVERED", // wrong case
    "in_pipeline", // wrong separator
    "deleted", // not in the lifecycle
    "", // empty string
    "  in-pipeline  ", // padded
    "shipped ", // trailing space
  ];

  for (const bad of garbage) {
    it(`frd-02 adversarial: cardStatus="${bad}" does not throw and returns a valid shape`, () => {
      // Cast through unknown: the function must own its boundary, not assume the
      // type system pre-validated the input.
      const result: NextStep = nextStep({ cardStatus: bad as never });
      expect(typeof result.command).toBe("string");
      expect(result.command.length).toBeGreaterThan(0);
      expect(typeof result.label).toBe("string");
      expect(result.label.length).toBeGreaterThan(0);
    });

    it(`frd-02 adversarial: cardStatus="${bad}" falls back to the spec command (pre-pipeline safe)`, () => {
      // An unrecognised status is "we don't know" → the safe pre-pipeline fallback,
      // never a build/terminal command guessed from garbage.
      const result = nextStep({ cardStatus: bad as never });
      expect(result.command).toBe("/pandacorp:spec <idea>");
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Garbage phase on an in-pipeline card — must not pick a phase command
// ---------------------------------------------------------------------------

describe("frd-02 adversarial: garbage phase on in-pipeline card", () => {
  const badPhases = ["PRODUCT", "build", "implementation ", "", "documented"];

  for (const bad of badPhases) {
    it(`frd-02 adversarial: in-pipeline + phase="${bad}" falls back to spec, not a phase command`, () => {
      const result = nextStep({ cardStatus: "in-pipeline", phase: bad as never });
      // Must not silently map an unrecognised phase to design/blueprint/implement/etc.
      expect(result.command).toBe("/pandacorp:spec <idea>");
    });
  }
});

// ---------------------------------------------------------------------------
// 3. DR-032 — advancePending must be a MEANINGFUL hint, not a cosmetic tweak
//    Kills mutants that satisfy "label differs" with a trivial change.
// ---------------------------------------------------------------------------

describe("frd-02 adversarial: DR-032 advancePending is a substantive acknowledgement hint", () => {
  it("frd-02 adversarial: pending label mentions the advance acknowledgement (DR-032 intent)", () => {
    const pending = nextStep({ cardStatus: "in-pipeline", phase: "product", advancePending: true });
    // The owner must learn they need to type the acknowledgement, not just run the command.
    // Accept the canonical Spanish hint variants ("advance" / "avanza" / "ok").
    const lc = pending.label.toLowerCase();
    const mentionsAdvance = lc.includes("advance") || lc.includes("avanz") || lc.includes("ok");
    expect(mentionsAdvance).toBe(true);
  });

  it("frd-02 adversarial: pending label is meaningfully longer than the plain label (not a 1-char tweak)", () => {
    const normal = nextStep({ cardStatus: "in-pipeline", phase: "product", advancePending: false });
    const pending = nextStep({ cardStatus: "in-pipeline", phase: "product", advancePending: true });
    // A mutant appending a single space/char would still satisfy "labelDiffers".
    // The acknowledgement hint is several words → require a real length delta.
    expect(pending.label.length).toBeGreaterThan(normal.label.length + 5);
  });

  it("frd-02 adversarial: pending label still contains the base action label (does not discard it)", () => {
    const normal = nextStep({ cardStatus: "in-pipeline", phase: "design", advancePending: false });
    const pending = nextStep({ cardStatus: "in-pipeline", phase: "design", advancePending: true });
    expect(pending.label.startsWith(normal.label)).toBe(true);
  });

  it("frd-02 adversarial: advancePending does not change the command (only the label carries the hint)", () => {
    // The command to run is the same; only the label warns about the pending gate.
    const normal = nextStep({
      cardStatus: "in-pipeline",
      phase: "architecture",
      advancePending: false,
    });
    const pending = nextStep({
      cardStatus: "in-pipeline",
      phase: "architecture",
      advancePending: true,
    });
    expect(pending.command).toBe(normal.command);
  });
});

// ---------------------------------------------------------------------------
// 4. DR-032 — advancePending must NOT leak onto terminal / pre-pipeline states
//    advance_pending only has meaning for an in-pipeline card mid-phase.
// ---------------------------------------------------------------------------

describe("frd-02 adversarial: advancePending does not leak to non-pipeline statuses", () => {
  it("frd-02 adversarial: discovered + advancePending=true → no advance hint in the label", () => {
    const plain = nextStep({ cardStatus: "discovered", advancePending: false });
    const withPending = nextStep({ cardStatus: "discovered", advancePending: true });
    expect(withPending.label).toBe(plain.label);
    expect(withPending.command).toBe(plain.command);
  });

  it("frd-02 adversarial: shipped + advancePending=true → no advance hint leaks in", () => {
    const plain = nextStep({ cardStatus: "shipped", advancePending: false });
    const withPending = nextStep({ cardStatus: "shipped", advancePending: true });
    expect(withPending.label).toBe(plain.label);
    expect(withPending.command).toBe(plain.command);
  });

  it("frd-02 adversarial: in-pipeline + undefined phase + advancePending=true → fallback, no hint leak", () => {
    // Undefined phase means we fall back to spec; the advance hint must not be appended
    // to a fallback label the owner can't act on with "ok, advance".
    const plain = nextStep({ cardStatus: "in-pipeline", advancePending: false });
    const withPending = nextStep({ cardStatus: "in-pipeline", advancePending: true });
    expect(withPending.label).toBe(plain.label);
    expect(withPending.command).toBe(plain.command);
  });
});

// ---------------------------------------------------------------------------
// 5. Terminal statuses — substance, not just non-empty
// ---------------------------------------------------------------------------

describe("frd-02 adversarial: terminal status substance", () => {
  it("frd-02 adversarial: shipped command is not a pipeline progression command", () => {
    const result = nextStep({ cardStatus: "shipped" });
    expect(PIPELINE_COMMANDS).not.toContain(result.command);
  });

  it("frd-02 adversarial: discarded command is not a pipeline progression command", () => {
    const result = nextStep({ cardStatus: "discarded" });
    expect(PIPELINE_COMMANDS).not.toContain(result.command);
  });

  it("frd-02 adversarial: shipped and discarded produce DISTINCT next steps (not aliased)", () => {
    // Mutation hardening: a mutant collapsing both terminal branches into one return
    // would alias them. shipped → review metrics; discarded → see recommendations.
    const shipped = nextStep({ cardStatus: "shipped" });
    const discarded = nextStep({ cardStatus: "discarded" });
    expect(shipped.command).not.toBe(discarded.command);
  });

  it("frd-02 adversarial: terminal labels are substantive (more than one character)", () => {
    expect(nextStep({ cardStatus: "shipped" }).label.length).toBeGreaterThan(1);
    expect(nextStep({ cardStatus: "discarded" }).label.length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// 6. Mutation hardening — every phase label is distinct (kills label-swap mutants)
// ---------------------------------------------------------------------------

describe("frd-02 adversarial: per-phase labels are distinct (mutation hardening)", () => {
  it("frd-02 adversarial: each in-pipeline phase yields a distinct label", () => {
    const phases = ["product", "design", "architecture", "implementation", "release"] as const;
    const labels = phases.map((p) => nextStep({ cardStatus: "in-pipeline", phase: p }).label);
    const unique = new Set(labels);
    // DR-085: implementation → release, release → iterate (distinct commands AND labels);
    // no two phases may collapse to the identical label by a swap mutant.
    expect(unique.size).toBe(phases.length);
  });
});

// ---------------------------------------------------------------------------
// 7. Input integrity — extra/unknown keys must not break or mutate input
// ---------------------------------------------------------------------------

describe("frd-02 adversarial: input integrity with extra keys", () => {
  it("frd-02 adversarial: extra unknown keys on the input are ignored, not thrown on", () => {
    const input = {
      cardStatus: "in-pipeline" as const,
      phase: "design" as const,
      bogus: "x",
      __proto__: { polluted: true },
    } as never;
    expect(() => nextStep(input)).not.toThrow();
    const result = nextStep(input);
    expect(result.command).toBe("/pandacorp:blueprint");
  });
});
