/**
 * WO-02-003 — `nextStep` command map — RED phase
 *
 * These tests are written BEFORE the implementation (`lib/next-step.ts` does not exist yet).
 * They will all fail until the GREEN phase; that is the intent.
 *
 * Traceability:
 *   AC-02-004.1  WHEN the owner clicks a card, the detail SHALL show the next-step command
 *                (with a copy button). This WO supplies the pure status/phase → command map.
 *   REQ-02-004   Click a card → detail: summary, key points, docs navigator, next-step command.
 *   IF-02-nextStep  nextStep(input): NextStep
 *
 * Pipeline command strings (canonical source: CLAUDE.md operation table):
 *   discovered / recommended (not in-pipeline) → /pandacorp:spec <idea>
 *   in-pipeline + product              → /pandacorp:design
 *   in-pipeline + design               → /pandacorp:blueprint
 *   in-pipeline + architecture         → /pandacorp:implement
 *   in-pipeline + implementation       → /pandacorp:release
 *   in-pipeline + release              → /pandacorp:release
 *   in-pipeline + operation            → /pandacorp:iterate   (or :review-launch)
 *   advancePending: true (any in-pipeline phase) → command MUST carry the "ok, advance" hint
 *   shipped / discarded                → terminal, no meaningful next step
 *
 * DR-032 (advance_pending): when a skill finishes a phase it sets advance_pending: true and
 * waits for the owner's "ok, advance." nextStep must surface this as a distinguishable
 * command/label so the owner knows what to type (not an empty hint).
 *
 * Regression anchors from .pandacorp/comms/progress.md (real incidents → regression tests):
 *   B1' (2026-06-16): typeof NaN === "number" bypasses numeric guards. nextStep receives
 *     phase as a Phase string or undefined — it does NOT receive NaN — but the regression
 *     teaches us to never fall through on undefined phase to a wrong command. We test this:
 *     undefined phase on an in-pipeline-adjacent input must not produce an in-pipeline command.
 *   I3  (2026-06-16): array-shaped objects fool typeof. readStatus rejects arrays for phase
 *     (returns undefined). nextStep with undefined phase must be safe and deterministic.
 *
 * Stack: Vitest. Pure function — no fs, no writes, no mocks, no external state.
 * All inputs are inline values; each test is independent.
 */

import { describe, expect, it } from "vitest";

// The module under test (does not exist yet — tests are RED until GREEN phase).
import { nextStep } from "./next-step";

// ---------------------------------------------------------------------------
// Local type mirrors for the contract defined in wo-02-003 and blueprint §4.
// Replaced by real imports once the module exists; kept here so the test file
// expresses its own expectations independently of the implementation.
// ---------------------------------------------------------------------------

type IdeaStatus = "discovered" | "recommended" | "in-pipeline" | "shipped" | "discarded";
type Phase = "product" | "design" | "architecture" | "implementation" | "release" | "operation";
type NextStep = { command: string; openPath?: string; label: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: {
  cardStatus?: IdeaStatus;
  phase?: Phase;
  advancePending?: boolean;
}): { cardStatus?: IdeaStatus; phase?: Phase; advancePending?: boolean } {
  return { ...overrides };
}

// ---------------------------------------------------------------------------
// AC-02-004.1 — discovered → /pandacorp:spec <idea>
// ---------------------------------------------------------------------------

describe("frd-02: nextStep — AC-02-004.1 discovered status", () => {
  it("frd-02: WHEN cardStatus is discovered THEN command is /pandacorp:spec <idea>", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "discovered" }));
    expect(result.command).toBe("/pandacorp:spec <idea>");
  });

  it("frd-02: WHEN cardStatus is discovered THEN result has a non-empty label", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "discovered" }));
    expect(result.label.length).toBeGreaterThan(0);
  });

  it("frd-02: WHEN cardStatus is discovered THEN openPath is undefined (no project yet)", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "discovered" }));
    expect(result.openPath).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-02-004.1 — recommended → /pandacorp:spec <idea>
// ---------------------------------------------------------------------------

describe("frd-02: nextStep — AC-02-004.1 recommended status", () => {
  it("frd-02: WHEN cardStatus is recommended THEN command is /pandacorp:spec <idea>", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "recommended" }));
    expect(result.command).toBe("/pandacorp:spec <idea>");
  });

  it("frd-02: WHEN cardStatus is recommended THEN openPath is undefined (no project yet)", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "recommended" }));
    expect(result.openPath).toBeUndefined();
  });

  it("frd-02: WHEN cardStatus is recommended THEN result has a non-empty label", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "recommended" }));
    expect(result.label.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC-02-004.1 — in-pipeline + product → /pandacorp:design
// ---------------------------------------------------------------------------

describe("frd-02: nextStep — AC-02-004.1 in-pipeline + product phase", () => {
  it("frd-02: WHEN cardStatus is in-pipeline AND phase is product THEN command is /pandacorp:design", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "in-pipeline", phase: "product" }));
    expect(result.command).toBe("/pandacorp:design");
  });

  it("frd-02: WHEN cardStatus is in-pipeline AND phase is product THEN result has a non-empty label", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "in-pipeline", phase: "product" }));
    expect(result.label.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC-02-004.1 — in-pipeline + design → /pandacorp:blueprint
// ---------------------------------------------------------------------------

describe("frd-02: nextStep — AC-02-004.1 in-pipeline + design phase", () => {
  it("frd-02: WHEN cardStatus is in-pipeline AND phase is design THEN command is /pandacorp:blueprint", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "in-pipeline", phase: "design" }));
    expect(result.command).toBe("/pandacorp:blueprint");
  });

  it("frd-02: WHEN cardStatus is in-pipeline AND phase is design THEN result has a non-empty label", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "in-pipeline", phase: "design" }));
    expect(result.label.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC-02-004.1 — in-pipeline + architecture → /pandacorp:implement
// ---------------------------------------------------------------------------

describe("frd-02: nextStep — AC-02-004.1 in-pipeline + architecture phase", () => {
  it("frd-02: WHEN cardStatus is in-pipeline AND phase is architecture THEN command is /pandacorp:implement", () => {
    const result: NextStep = nextStep(
      makeInput({ cardStatus: "in-pipeline", phase: "architecture" }),
    );
    expect(result.command).toBe("/pandacorp:implement");
  });

  it("frd-02: WHEN cardStatus is in-pipeline AND phase is architecture THEN result has a non-empty label", () => {
    const result: NextStep = nextStep(
      makeInput({ cardStatus: "in-pipeline", phase: "architecture" }),
    );
    expect(result.label.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC-02-004.1 — in-pipeline + implementation → /pandacorp:release
// ---------------------------------------------------------------------------

describe("frd-02: nextStep — AC-02-004.1 in-pipeline + implementation phase", () => {
  it("frd-02: WHEN cardStatus is in-pipeline AND phase is implementation THEN command is /pandacorp:release", () => {
    const result: NextStep = nextStep(
      makeInput({ cardStatus: "in-pipeline", phase: "implementation" }),
    );
    expect(result.command).toBe("/pandacorp:release");
  });

  it("frd-02: WHEN cardStatus is in-pipeline AND phase is implementation THEN result has a non-empty label", () => {
    const result: NextStep = nextStep(
      makeInput({ cardStatus: "in-pipeline", phase: "implementation" }),
    );
    expect(result.label.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC-02-004.1 — in-pipeline + release → /pandacorp:release
// (release phase maps to the same command as implementation: audit + deploy)
// ---------------------------------------------------------------------------

describe("frd-02: nextStep — AC-02-004.1 in-pipeline + release phase", () => {
  it("frd-02: WHEN cardStatus is in-pipeline AND phase is release THEN command is /pandacorp:release", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "in-pipeline", phase: "release" }));
    expect(result.command).toBe("/pandacorp:release");
  });

  it("frd-02: WHEN cardStatus is in-pipeline AND phase is release THEN result has a non-empty label", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "in-pipeline", phase: "release" }));
    expect(result.label.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC-02-004.1 — in-pipeline + operation → /pandacorp:iterate
// (operation = shipped project in maintenance; canonical command is :iterate)
// ---------------------------------------------------------------------------

describe("frd-02: nextStep — AC-02-004.1 in-pipeline + operation phase", () => {
  it("frd-02: WHEN cardStatus is in-pipeline AND phase is operation THEN command is /pandacorp:iterate", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "in-pipeline", phase: "operation" }));
    expect(result.command).toBe("/pandacorp:iterate");
  });

  it("frd-02: WHEN cardStatus is in-pipeline AND phase is operation THEN result has a non-empty label", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "in-pipeline", phase: "operation" }));
    expect(result.label.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// DR-032 — advancePending: true
//
// When advance_pending is true the owner needs to type "ok, advance" or an
// equivalent acknowledgement. nextStep MUST surface a distinguishable command
// or label — the user cannot act correctly from a generic "next step" hint.
// The command MUST NOT be the same as when advancePending is false for the same
// phase (a mutant that ignores advancePending would flip this test).
// ---------------------------------------------------------------------------

describe("frd-02: nextStep — DR-032 advancePending flag", () => {
  it("frd-02 DR-032: WHEN advancePending is true AND phase is product THEN command differs from the plain design command OR label contains an advance hint", () => {
    const normal: NextStep = nextStep(
      makeInput({ cardStatus: "in-pipeline", phase: "product", advancePending: false }),
    );
    const pending: NextStep = nextStep(
      makeInput({ cardStatus: "in-pipeline", phase: "product", advancePending: true }),
    );
    // Either the command itself changes (e.g. an "ok, advance" literal), or the label
    // communicates the pending state. At least one of these must differ.
    const commandDiffers = pending.command !== normal.command;
    const labelDiffers = pending.label !== normal.label;
    expect(commandDiffers || labelDiffers).toBe(true);
  });

  it("frd-02 DR-032: WHEN advancePending is true AND phase is design THEN command or label differs from the non-pending case", () => {
    const normal: NextStep = nextStep(
      makeInput({ cardStatus: "in-pipeline", phase: "design", advancePending: false }),
    );
    const pending: NextStep = nextStep(
      makeInput({ cardStatus: "in-pipeline", phase: "design", advancePending: true }),
    );
    const commandDiffers = pending.command !== normal.command;
    const labelDiffers = pending.label !== normal.label;
    expect(commandDiffers || labelDiffers).toBe(true);
  });

  it("frd-02 DR-032: WHEN advancePending is true AND phase is architecture THEN command or label differs from the non-pending case", () => {
    const normal: NextStep = nextStep(
      makeInput({ cardStatus: "in-pipeline", phase: "architecture", advancePending: false }),
    );
    const pending: NextStep = nextStep(
      makeInput({ cardStatus: "in-pipeline", phase: "architecture", advancePending: true }),
    );
    const commandDiffers = pending.command !== normal.command;
    const labelDiffers = pending.label !== normal.label;
    expect(commandDiffers || labelDiffers).toBe(true);
  });

  it("frd-02 DR-032: WHEN advancePending is true AND phase is implementation THEN command or label differs from the non-pending case", () => {
    const normal: NextStep = nextStep(
      makeInput({ cardStatus: "in-pipeline", phase: "implementation", advancePending: false }),
    );
    const pending: NextStep = nextStep(
      makeInput({ cardStatus: "in-pipeline", phase: "implementation", advancePending: true }),
    );
    const commandDiffers = pending.command !== normal.command;
    const labelDiffers = pending.label !== normal.label;
    expect(commandDiffers || labelDiffers).toBe(true);
  });

  it("frd-02 DR-032: WHEN advancePending is false THEN command is the standard phase command (not an advance hint)", () => {
    const result: NextStep = nextStep(
      makeInput({ cardStatus: "in-pipeline", phase: "product", advancePending: false }),
    );
    expect(result.command).toBe("/pandacorp:design");
  });

  it("frd-02 DR-032: WHEN advancePending is undefined THEN behaves the same as advancePending: false", () => {
    const withFalse: NextStep = nextStep(
      makeInput({ cardStatus: "in-pipeline", phase: "product", advancePending: false }),
    );
    const withUndefined: NextStep = nextStep(
      makeInput({ cardStatus: "in-pipeline", phase: "product" }),
    );
    expect(withUndefined.command).toBe(withFalse.command);
    expect(withUndefined.label).toBe(withFalse.label);
  });
});

// ---------------------------------------------------------------------------
// Terminal statuses — shipped / discarded
//
// A shipped or discarded idea has no actionable next step in the pipeline.
// The function MUST NOT produce a pipeline command (like :spec or :design)
// for these states. It MUST return a valid NextStep object (never throw).
// The command and label must be non-empty strings (no crash, no undefined).
// ---------------------------------------------------------------------------

describe("frd-02: nextStep — terminal statuses (shipped / discarded)", () => {
  it("frd-02: WHEN cardStatus is shipped THEN function does not throw", () => {
    expect(() => nextStep(makeInput({ cardStatus: "shipped" }))).not.toThrow();
  });

  it("frd-02: WHEN cardStatus is shipped THEN command is a non-empty string", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "shipped" }));
    expect(typeof result.command).toBe("string");
    expect(result.command.length).toBeGreaterThan(0);
  });

  it("frd-02: WHEN cardStatus is shipped THEN command is NOT a pipeline progression command", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "shipped" }));
    // Shipped projects cannot be advanced through the pipeline from Mission Control.
    // The command must not be one of the build-pipeline commands.
    expect(result.command).not.toBe("/pandacorp:spec <idea>");
    expect(result.command).not.toBe("/pandacorp:design");
    expect(result.command).not.toBe("/pandacorp:blueprint");
    expect(result.command).not.toBe("/pandacorp:implement");
    expect(result.command).not.toBe("/pandacorp:release");
  });

  it("frd-02: WHEN cardStatus is shipped THEN label is a non-empty string", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "shipped" }));
    expect(typeof result.label).toBe("string");
    expect(result.label.length).toBeGreaterThan(0);
  });

  it("frd-02: WHEN cardStatus is discarded THEN function does not throw", () => {
    expect(() => nextStep(makeInput({ cardStatus: "discarded" }))).not.toThrow();
  });

  it("frd-02: WHEN cardStatus is discarded THEN command is a non-empty string", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "discarded" }));
    expect(typeof result.command).toBe("string");
    expect(result.command.length).toBeGreaterThan(0);
  });

  it("frd-02: WHEN cardStatus is discarded THEN command is NOT a pipeline progression command", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "discarded" }));
    expect(result.command).not.toBe("/pandacorp:spec <idea>");
    expect(result.command).not.toBe("/pandacorp:design");
    expect(result.command).not.toBe("/pandacorp:blueprint");
    expect(result.command).not.toBe("/pandacorp:implement");
    expect(result.command).not.toBe("/pandacorp:release");
  });

  it("frd-02: WHEN cardStatus is discarded THEN label is a non-empty string", () => {
    const result: NextStep = nextStep(makeInput({ cardStatus: "discarded" }));
    expect(typeof result.label).toBe("string");
    expect(result.label.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases — undefined / missing inputs
//
// The function must handle partial inputs gracefully. It is called from a card
// detail that may not always have all fields set.
// ---------------------------------------------------------------------------

describe("frd-02: nextStep — edge cases and missing inputs", () => {
  it("frd-02: WHEN called with an empty object THEN function does not throw", () => {
    expect(() => nextStep({})).not.toThrow();
  });

  it("frd-02: WHEN called with an empty object THEN returns a valid NextStep with non-empty command and label", () => {
    const result: NextStep = nextStep({});
    expect(typeof result.command).toBe("string");
    expect(result.command.length).toBeGreaterThan(0);
    expect(typeof result.label).toBe("string");
    expect(result.label.length).toBeGreaterThan(0);
  });

  it("frd-02: WHEN cardStatus is in-pipeline AND phase is undefined THEN function does not throw", () => {
    // Regression I3 (2026-06-16): array-shaped phase is rejected upstream by readStatus
    // and arrives here as undefined. Must not crash or return a wrong pipeline command.
    expect(() => nextStep(makeInput({ cardStatus: "in-pipeline" }))).not.toThrow();
  });

  it("frd-02: WHEN cardStatus is in-pipeline AND phase is undefined THEN command is NOT an in-pipeline phase command (no guessing from undefined)", () => {
    // Regression I3 + B1' context: undefined phase must produce a safe, deterministic fallback.
    // It MUST NOT silently map to a wrong phase command.
    const result: NextStep = nextStep(makeInput({ cardStatus: "in-pipeline" }));
    expect(result.command).not.toBe("/pandacorp:blueprint");
    expect(result.command).not.toBe("/pandacorp:implement");
    expect(result.command).not.toBe("/pandacorp:release");
    expect(result.command).not.toBe("/pandacorp:iterate");
    // An undefined phase on an in-pipeline card means "we don't know" —
    // the safe fallback is the spec command (not yet in pipeline from the UI's perspective)
    // OR a clearly labelled "unknown" state. Either way it must not pick a wrong phase.
  });

  it("frd-02: WHEN only phase is provided (no cardStatus) THEN function does not throw", () => {
    // phase without cardStatus: the caller may pass a project's phase even if the
    // card status field was missing (defensive: the function owns the fallback).
    expect(() => nextStep(makeInput({ phase: "design" }))).not.toThrow();
  });

  it("frd-02: WHEN only phase is provided THEN returns a NextStep with non-empty command and label", () => {
    const result: NextStep = nextStep(makeInput({ phase: "design" }));
    expect(typeof result.command).toBe("string");
    expect(result.command.length).toBeGreaterThan(0);
    expect(typeof result.label).toBe("string");
    expect(result.label.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Mapping table completeness — one assertion per pipeline position (mutation targets)
//
// Each test here kills a distinct mutant: changing one command string or one branch
// condition flips exactly one of these. Together they lock the entire mapping table
// so that no single-line mutation can pass the suite undetected.
// ---------------------------------------------------------------------------

describe("frd-02: nextStep — complete mapping table (lock against mutation)", () => {
  // Row 1: discovered → /pandacorp:spec <idea>
  it("frd-02 mapping[1]: discovered → command is /pandacorp:spec <idea>", () => {
    expect(nextStep({ cardStatus: "discovered" }).command).toBe("/pandacorp:spec <idea>");
  });

  // Row 2: recommended → /pandacorp:spec <idea>
  it("frd-02 mapping[2]: recommended → command is /pandacorp:spec <idea>", () => {
    expect(nextStep({ cardStatus: "recommended" }).command).toBe("/pandacorp:spec <idea>");
  });

  // Row 3: in-pipeline + product → /pandacorp:design
  it("frd-02 mapping[3]: in-pipeline + product → command is /pandacorp:design", () => {
    expect(nextStep({ cardStatus: "in-pipeline", phase: "product" }).command).toBe(
      "/pandacorp:design",
    );
  });

  // Row 4: in-pipeline + design → /pandacorp:blueprint
  it("frd-02 mapping[4]: in-pipeline + design → command is /pandacorp:blueprint", () => {
    expect(nextStep({ cardStatus: "in-pipeline", phase: "design" }).command).toBe(
      "/pandacorp:blueprint",
    );
  });

  // Row 5: in-pipeline + architecture → /pandacorp:implement
  it("frd-02 mapping[5]: in-pipeline + architecture → command is /pandacorp:implement", () => {
    expect(nextStep({ cardStatus: "in-pipeline", phase: "architecture" }).command).toBe(
      "/pandacorp:implement",
    );
  });

  // Row 6: in-pipeline + implementation → /pandacorp:release
  it("frd-02 mapping[6]: in-pipeline + implementation → command is /pandacorp:release", () => {
    expect(nextStep({ cardStatus: "in-pipeline", phase: "implementation" }).command).toBe(
      "/pandacorp:release",
    );
  });

  // Row 7: in-pipeline + release → /pandacorp:release (same as implementation)
  it("frd-02 mapping[7]: in-pipeline + release → command is /pandacorp:release", () => {
    expect(nextStep({ cardStatus: "in-pipeline", phase: "release" }).command).toBe(
      "/pandacorp:release",
    );
  });

  // Row 8: in-pipeline + operation → /pandacorp:iterate
  it("frd-02 mapping[8]: in-pipeline + operation → command is /pandacorp:iterate", () => {
    expect(nextStep({ cardStatus: "in-pipeline", phase: "operation" }).command).toBe(
      "/pandacorp:iterate",
    );
  });

  // Row 9: implementation and release must map to the SAME command (not confused)
  it("frd-02 mapping[9]: implementation and release both map to the same command", () => {
    const implCmd = nextStep({ cardStatus: "in-pipeline", phase: "implementation" }).command;
    const releaseCmd = nextStep({ cardStatus: "in-pipeline", phase: "release" }).command;
    expect(implCmd).toBe(releaseCmd);
  });

  // Row 10: discovered and recommended must map to the SAME command (not confused)
  it("frd-02 mapping[10]: discovered and recommended both map to the same command", () => {
    const discoveredCmd = nextStep({ cardStatus: "discovered" }).command;
    const recommendedCmd = nextStep({ cardStatus: "recommended" }).command;
    expect(discoveredCmd).toBe(recommendedCmd);
  });
});

// ---------------------------------------------------------------------------
// Pure function invariants — no state, no side effects
// ---------------------------------------------------------------------------

describe("frd-02: nextStep — pure function invariants", () => {
  it("frd-02: WHEN called twice with the same arguments THEN returns the same command (deterministic)", () => {
    const input = { cardStatus: "in-pipeline" as IdeaStatus, phase: "architecture" as Phase };
    const first = nextStep(input);
    const second = nextStep(input);
    expect(first.command).toBe(second.command);
    expect(first.label).toBe(second.label);
  });

  it("frd-02: WHEN called THEN the input object is not mutated", () => {
    const input = {
      cardStatus: "in-pipeline" as IdeaStatus,
      phase: "design" as Phase,
      advancePending: false,
    };
    const originalStatus = input.cardStatus;
    const originalPhase = input.phase;
    const originalPending = input.advancePending;
    nextStep(input);
    expect(input.cardStatus).toBe(originalStatus);
    expect(input.phase).toBe(originalPhase);
    expect(input.advancePending).toBe(originalPending);
  });

  it("frd-02: WHEN called with any valid input THEN returns an object with command (string) and label (string)", () => {
    const validCases: Array<{ cardStatus?: IdeaStatus; phase?: Phase }> = [
      { cardStatus: "discovered" },
      { cardStatus: "recommended" },
      { cardStatus: "in-pipeline", phase: "product" },
      { cardStatus: "in-pipeline", phase: "design" },
      { cardStatus: "in-pipeline", phase: "architecture" },
      { cardStatus: "in-pipeline", phase: "implementation" },
      { cardStatus: "in-pipeline", phase: "release" },
      { cardStatus: "in-pipeline", phase: "operation" },
      { cardStatus: "shipped" },
      { cardStatus: "discarded" },
    ];

    for (const input of validCases) {
      const result = nextStep(input);
      expect(typeof result.command).toBe("string");
      expect(result.command.length).toBeGreaterThan(0);
      expect(typeof result.label).toBe("string");
      expect(result.label.length).toBeGreaterThan(0);
    }
  });

  it("frd-02: WHEN called with any valid input THEN openPath is either undefined or a string (never null, never number)", () => {
    const validCases: Array<{ cardStatus?: IdeaStatus; phase?: Phase }> = [
      { cardStatus: "discovered" },
      { cardStatus: "in-pipeline", phase: "product" },
      { cardStatus: "in-pipeline", phase: "architecture" },
      { cardStatus: "shipped" },
    ];

    for (const input of validCases) {
      const result = nextStep(input);
      if (result.openPath !== undefined) {
        expect(typeof result.openPath).toBe("string");
      }
    }
  });

  it("frd-02: WHEN called with adjacent phases THEN commands are distinct (no phase aliasing)", () => {
    // Each phase must produce a DISTINCT command — no two adjacent phases should be
    // collapsed to the same command unless the spec explicitly says so
    // (only implementation+release share a command; all others must differ).
    const product = nextStep({ cardStatus: "in-pipeline", phase: "product" }).command;
    const design = nextStep({ cardStatus: "in-pipeline", phase: "design" }).command;
    const architecture = nextStep({ cardStatus: "in-pipeline", phase: "architecture" }).command;
    const operation = nextStep({ cardStatus: "in-pipeline", phase: "operation" }).command;

    // All four are distinct
    expect(product).not.toBe(design);
    expect(design).not.toBe(architecture);
    expect(architecture).not.toBe(operation);

    // None of them equals the spec command (pre-pipeline)
    const spec = nextStep({ cardStatus: "discovered" }).command;
    expect(product).not.toBe(spec);
    expect(design).not.toBe(spec);
    expect(architecture).not.toBe(spec);
    expect(operation).not.toBe(spec);
  });
});

// ---------------------------------------------------------------------------
// Regression anchors — direct tests against the past incident patterns
//
// B1' (2026-06-16): NaN sneaks through typeof guards.
//   nextStep does not receive numeric values — but undefined phase (the downstream
//   result of NaN being rejected upstream) must produce a safe result.
//
// I3  (2026-06-16): array-shaped objects fool typeof.
//   Same: phase arrives as undefined when the YAML had an array. Safe result required.
// ---------------------------------------------------------------------------

describe("frd-02: nextStep — regression B1' and I3", () => {
  it("frd-02 regression-B1': WHEN phase is undefined (NaN rejected upstream by readStatus) THEN function does not throw", () => {
    expect(() => nextStep({ cardStatus: "in-pipeline", phase: undefined })).not.toThrow();
  });

  it("frd-02 regression-B1': WHEN phase is undefined THEN command is deterministic and non-empty", () => {
    const a = nextStep({ cardStatus: "in-pipeline", phase: undefined });
    const b = nextStep({ cardStatus: "in-pipeline", phase: undefined });
    expect(a.command).toBe(b.command);
    expect(a.command.length).toBeGreaterThan(0);
  });

  it("frd-02 regression-I3: WHEN phase is undefined (array rejected upstream) THEN command is NOT a phase-specific command", () => {
    // If the array was accepted as a phase, the function might produce a wrong phase command.
    // With phase: undefined the function must fall back to a safe value, not /pandacorp:implement
    // or any other phase-specific command that would mislead the owner.
    const result = nextStep({ cardStatus: "in-pipeline", phase: undefined });
    expect(result.command).not.toBe("/pandacorp:blueprint");
    expect(result.command).not.toBe("/pandacorp:implement");
    expect(result.command).not.toBe("/pandacorp:release");
    expect(result.command).not.toBe("/pandacorp:iterate");
  });

  it("frd-02 regression-I3: WHEN all inputs are undefined THEN function does not throw and returns valid shape", () => {
    expect(() => nextStep({})).not.toThrow();
    const result = nextStep({});
    expect(typeof result.command).toBe("string");
    expect(result.command.length).toBeGreaterThan(0);
    expect(typeof result.label).toBe("string");
  });
});
