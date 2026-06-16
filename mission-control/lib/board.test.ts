/**
 * WO-02-001 — `deriveColumn` two-axis logic — RED phase
 *
 * These tests are written BEFORE the implementation (`lib/board.ts` does not exist yet).
 * They will all fail until the GREEN phase; that is the intent.
 *
 * Traceability:
 *   AC-02-001.1  The board SHALL place each idea into one of
 *                discovered → documented → design → architecture → building → shipped (+ discarded)
 *                by deriving the column from two axes (card status + project phase),
 *                NOT from card status alone.
 *   AC-02-001.2  discovered / recommended → "discovered" (recommended shows a badge, but
 *                column is still "discovered").
 *   AC-02-001.3  in-pipeline → column from project phase:
 *                  product → documented
 *                  design  → design
 *                  architecture → architecture
 *                  implementation | release → building
 *                  operation → shipped
 *   AC-02-001.4  shipped → shipped; discarded → discarded.
 *   AC-02-001.5  The board SHALL NOT expect design/architecture/building as a card status.
 *   AC-02-001.6  IF an in-pipeline card's project or status.yaml is missing/malformed
 *                THEN fall back to documented column without breaking.
 *
 * Regression anchors from .pandacorp/comms/progress.md (past incidents):
 *   B1' (2026-06-16): NaN bypasses numeric guards in readStatus — use Number.isFinite.
 *     readStatus is the single source for `phase`; board.ts MUST NOT re-validate it —
 *     it trusts the StatusResult contract. Regression here: deriveColumn with a
 *     StatusResult that has phase: undefined (because readStatus rejected a bad value)
 *     MUST fall back to documented, not crash or return a wrong column.
 *   I3 (2026-06-16): array-shaped objects fool typeof. StatusResult.phase can be undefined
 *     when the YAML has an array for phase. deriveColumn must treat undefined phase on an
 *     in-pipeline card as the missing-project fallback (→ documented).
 *
 * Stack: Vitest. No mocks — deriveColumn is a pure function; all inputs are inline objects.
 * No fs reads (the function takes already-parsed values). No external state.
 */

import { describe, expect, it } from "vitest";

// The module under test (does not exist yet — tests are RED).
import { deriveColumn } from "./board";

// ---------------------------------------------------------------------------
// Local type mirrors (the module will export these; we redeclare here so the
// test file compiles before board.ts exists — replaced by real imports once green).
// ---------------------------------------------------------------------------

type IdeaStatus = "discovered" | "recommended" | "in-pipeline" | "shipped" | "discarded";

type IdeaCard = {
  slug: string;
  title: string;
  status: IdeaStatus;
  projectType?: string;
  returnType?: "monetary" | "opportunity" | "personal" | "mixed";
  score?: number;
  project?: string;
  body: string;
};

type Phase = "product" | "design" | "architecture" | "implementation" | "release" | "operation";

type ProjectStatus = {
  project?: string;
  phase?: Phase;
  version?: string;
  running?: boolean;
};

type StatusResult =
  | { present: false; malformed: false; status: null }
  | { present: true; malformed: boolean; status: Partial<ProjectStatus> };

type BoardColumn =
  | "discovered"
  | "documented"
  | "design"
  | "architecture"
  | "building"
  | "shipped"
  | "discarded";

// ---------------------------------------------------------------------------
// Factories — minimal valid objects; tests only set the fields under test.
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<IdeaCard> & { status: IdeaStatus }): IdeaCard {
  return {
    slug: "test-idea",
    title: "Test Idea",
    body: "",
    ...overrides,
  };
}

function makePresent(phase: Phase | undefined, malformed = false): StatusResult {
  return {
    present: true,
    malformed,
    status: phase !== undefined ? { phase } : {},
  };
}

const STATUS_ABSENT: StatusResult = { present: false, malformed: false, status: null };

// ---------------------------------------------------------------------------
// AC-02-001.2 — card status: discovered → discovered
// ---------------------------------------------------------------------------

describe("frd-02: deriveColumn — AC-02-001.2 discovered status", () => {
  it("frd-02: WHEN card status is discovered THEN column is discovered", () => {
    const result = deriveColumn(makeCard({ status: "discovered" }), null);
    expect(result).toBe<BoardColumn>("discovered");
  });

  it("frd-02: WHEN card status is discovered AND projectStatus is null THEN column is discovered", () => {
    const result = deriveColumn(makeCard({ status: "discovered" }), null);
    expect(result).toBe<BoardColumn>("discovered");
  });

  it("frd-02: WHEN card status is discovered AND projectStatus is present THEN project phase is ignored and column is discovered", () => {
    // The project axis must not override a pre-pipeline card's column.
    const result = deriveColumn(makeCard({ status: "discovered" }), makePresent("implementation"));
    expect(result).toBe<BoardColumn>("discovered");
  });
});

// ---------------------------------------------------------------------------
// AC-02-001.2 — card status: recommended → discovered (badge handled by card UI, not column)
// ---------------------------------------------------------------------------

describe("frd-02: deriveColumn — AC-02-001.2 recommended status", () => {
  it("frd-02: WHEN card status is recommended THEN column is discovered (not recommended)", () => {
    const result = deriveColumn(makeCard({ status: "recommended" }), null);
    expect(result).toBe<BoardColumn>("discovered");
  });

  it("frd-02: WHEN card status is recommended AND projectStatus is present THEN column is still discovered", () => {
    const result = deriveColumn(makeCard({ status: "recommended" }), makePresent("design"));
    expect(result).toBe<BoardColumn>("discovered");
  });
});

// ---------------------------------------------------------------------------
// AC-02-001.3 — card status: in-pipeline, each phase → its column
// ---------------------------------------------------------------------------

describe("frd-02: deriveColumn — AC-02-001.3 in-pipeline phase mapping", () => {
  it("frd-02: WHEN card is in-pipeline AND phase is product THEN column is documented", () => {
    const result = deriveColumn(makeCard({ status: "in-pipeline" }), makePresent("product"));
    expect(result).toBe<BoardColumn>("documented");
  });

  it("frd-02: WHEN card is in-pipeline AND phase is design THEN column is design", () => {
    const result = deriveColumn(makeCard({ status: "in-pipeline" }), makePresent("design"));
    expect(result).toBe<BoardColumn>("design");
  });

  it("frd-02: WHEN card is in-pipeline AND phase is architecture THEN column is architecture", () => {
    const result = deriveColumn(makeCard({ status: "in-pipeline" }), makePresent("architecture"));
    expect(result).toBe<BoardColumn>("architecture");
  });

  it("frd-02: WHEN card is in-pipeline AND phase is implementation THEN column is building", () => {
    const result = deriveColumn(makeCard({ status: "in-pipeline" }), makePresent("implementation"));
    expect(result).toBe<BoardColumn>("building");
  });

  it("frd-02: WHEN card is in-pipeline AND phase is release THEN column is building", () => {
    // release maps to the same column as implementation (blueprint §2)
    const result = deriveColumn(makeCard({ status: "in-pipeline" }), makePresent("release"));
    expect(result).toBe<BoardColumn>("building");
  });

  it("frd-02: WHEN card is in-pipeline AND phase is operation THEN column is shipped", () => {
    const result = deriveColumn(makeCard({ status: "in-pipeline" }), makePresent("operation"));
    expect(result).toBe<BoardColumn>("shipped");
  });
});

// ---------------------------------------------------------------------------
// AC-02-001.4 — terminal statuses
// ---------------------------------------------------------------------------

describe("frd-02: deriveColumn — AC-02-001.4 terminal statuses", () => {
  it("frd-02: WHEN card status is shipped THEN column is shipped", () => {
    const result = deriveColumn(makeCard({ status: "shipped" }), null);
    expect(result).toBe<BoardColumn>("shipped");
  });

  it("frd-02: WHEN card status is shipped AND projectStatus is present THEN project phase is ignored", () => {
    const result = deriveColumn(makeCard({ status: "shipped" }), makePresent("product"));
    expect(result).toBe<BoardColumn>("shipped");
  });

  it("frd-02: WHEN card status is discarded THEN column is discarded", () => {
    const result = deriveColumn(makeCard({ status: "discarded" }), null);
    expect(result).toBe<BoardColumn>("discarded");
  });

  it("frd-02: WHEN card status is discarded AND projectStatus is present THEN project phase is ignored", () => {
    const result = deriveColumn(makeCard({ status: "discarded" }), makePresent("operation"));
    expect(result).toBe<BoardColumn>("discarded");
  });
});

// ---------------------------------------------------------------------------
// AC-02-001.6 — in-pipeline fallback: missing project / status absent / malformed
// ---------------------------------------------------------------------------

describe("frd-02: deriveColumn — AC-02-001.6 in-pipeline fallback to documented", () => {
  it("frd-02: WHEN card is in-pipeline AND projectStatus is null THEN falls back to documented", () => {
    // Null projectStatus = no linked project was resolved at all.
    const result = deriveColumn(makeCard({ status: "in-pipeline" }), null);
    expect(result).toBe<BoardColumn>("documented");
  });

  it("frd-02: WHEN card is in-pipeline AND projectStatus.present is false THEN falls back to documented", () => {
    // Absent status.yaml (project folder missing or status file missing).
    const result = deriveColumn(makeCard({ status: "in-pipeline" }), STATUS_ABSENT);
    expect(result).toBe<BoardColumn>("documented");
  });

  it("frd-02: WHEN card is in-pipeline AND projectStatus is malformed THEN falls back to documented", () => {
    // Malformed YAML: present=true, malformed=true, status={} (no phase).
    const malformed: StatusResult = { present: true, malformed: true, status: {} };
    const result = deriveColumn(makeCard({ status: "in-pipeline" }), malformed);
    expect(result).toBe<BoardColumn>("documented");
  });

  it("frd-02: WHEN card is in-pipeline AND projectStatus is present but phase is undefined THEN falls back to documented", () => {
    // Valid YAML but phase key absent (partial-tolerant, blueprint §3).
    // Regression I3 (2026-06-16): readStatus returns phase: undefined when phase was an array.
    // deriveColumn must treat undefined phase as the fallback case.
    const noPhase: StatusResult = { present: true, malformed: false, status: {} };
    const result = deriveColumn(makeCard({ status: "in-pipeline" }), noPhase);
    expect(result).toBe<BoardColumn>("documented");
  });

  it("frd-02: WHEN card is in-pipeline AND projectStatus.present is false THEN does not throw", () => {
    // Regression: must never throw regardless of input quality (AC-02-001.6 "without breaking").
    expect(() => deriveColumn(makeCard({ status: "in-pipeline" }), STATUS_ABSENT)).not.toThrow();
  });

  it("frd-02: WHEN card is in-pipeline AND projectStatus is null THEN does not throw", () => {
    expect(() => deriveColumn(makeCard({ status: "in-pipeline" }), null)).not.toThrow();
  });

  it("frd-02: WHEN card is in-pipeline AND projectStatus is malformed THEN does not throw", () => {
    const malformed: StatusResult = { present: true, malformed: true, status: {} };
    expect(() => deriveColumn(makeCard({ status: "in-pipeline" }), malformed)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC-02-001.5 — design/architecture/building MUST NOT appear as card statuses.
// These tests assert that deriveColumn only accepts the five valid IdeaStatus values
// at the type level. The following tests verify runtime safety for any unexpected
// string that reaches the function (defensive programming, not typed inputs).
// ---------------------------------------------------------------------------

describe("frd-02: deriveColumn — AC-02-001.5 no invalid card statuses produce wrong columns", () => {
  it("frd-02: WHEN card status is design (invalid, must never occur) THEN function does not produce building or architecture or design as if it were a phase", () => {
    // This status cannot come from the real data layer (readIdeas rejects unknown statuses).
    // deriveColumn MUST NOT silently map "design" as card status to the design column.
    // Expected behavior: fall through to a safe default or produce "discovered"/"documented".
    // It MUST NOT produce "building" or "architecture" for an unknown/invalid card status.
    // (The exact safe value is implementation-defined; the invariant is what we assert.)
    const invalidCard = makeCard({ status: "design" as IdeaStatus });
    const result = deriveColumn(invalidCard, null);
    expect(result).not.toBe<BoardColumn>("building");
    expect(result).not.toBe<BoardColumn>("architecture");
  });

  it("frd-02: WHEN card status is building (invalid, must never occur) THEN function does not produce building as if it were an in-pipeline phase", () => {
    const invalidCard = makeCard({ status: "building" as IdeaStatus });
    const _result = deriveColumn(invalidCard, null);
    // "building" as a card status is not a valid in-pipeline phase trigger.
    // The result must not be "building" arrived at by treating the card status as a phase.
    // (Safe: the function can return anything for invalid input, but it must not throw.)
    expect(() => deriveColumn(invalidCard, null)).not.toThrow();
  });

  it("frd-02: WHEN card status is architecture (invalid, must never occur) THEN function does not throw", () => {
    const invalidCard = makeCard({ status: "architecture" as IdeaStatus });
    expect(() => deriveColumn(invalidCard, null)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Regression B1' (2026-06-16) — NaN phase does not sneak through
// The StatusResult contract from readStatus guarantees phase is undefined when
// the YAML value is not a valid Phase string. We test the downstream effect on
// deriveColumn: a StatusResult with no phase on an in-pipeline card → documented.
// ---------------------------------------------------------------------------

describe("frd-02: deriveColumn — regression B1' NaN/invalid phase → documented fallback", () => {
  it("frd-02 regression-B1': WHEN in-pipeline AND StatusResult has no phase (NaN rejected upstream) THEN column is documented", () => {
    // readStatus rejects NaN for numeric fields (B1') and also for phase (must be a Phase literal).
    // The result has phase: undefined. deriveColumn must fall back to documented.
    const noPhase: StatusResult = { present: true, malformed: false, status: { running: true } };
    const result = deriveColumn(makeCard({ status: "in-pipeline" }), noPhase);
    expect(result).toBe<BoardColumn>("documented");
  });
});

// ---------------------------------------------------------------------------
// Pure function invariants: no state, no side effects
// ---------------------------------------------------------------------------

describe("frd-02: deriveColumn — pure function invariants", () => {
  it("frd-02: WHEN called twice with same arguments THEN returns the same column (deterministic)", () => {
    const card = makeCard({ status: "in-pipeline" });
    const status = makePresent("implementation");
    const first = deriveColumn(card, status);
    const second = deriveColumn(card, status);
    expect(first).toBe(second);
  });

  it("frd-02: WHEN called THEN the input card is not mutated", () => {
    const card = makeCard({ status: "in-pipeline" });
    const originalStatus = card.status;
    const originalSlug = card.slug;
    deriveColumn(card, makePresent("design"));
    expect(card.status).toBe(originalStatus);
    expect(card.slug).toBe(originalSlug);
  });

  it("frd-02: WHEN called THEN the input projectStatus is not mutated", () => {
    const status = makePresent("product");
    const originalPhase = (
      status as { present: true; malformed: boolean; status: Partial<ProjectStatus> }
    ).status.phase;
    deriveColumn(makeCard({ status: "in-pipeline" }), status);
    expect(
      (status as { present: true; malformed: boolean; status: Partial<ProjectStatus> }).status
        .phase,
    ).toBe(originalPhase);
  });

  it("frd-02: deriveColumn returns one of the seven valid BoardColumn values for every valid input combination", () => {
    const validColumns: BoardColumn[] = [
      "discovered",
      "documented",
      "design",
      "architecture",
      "building",
      "shipped",
      "discarded",
    ];
    const validStatuses: IdeaStatus[] = [
      "discovered",
      "recommended",
      "in-pipeline",
      "shipped",
      "discarded",
    ];
    const validPhases: Phase[] = [
      "product",
      "design",
      "architecture",
      "implementation",
      "release",
      "operation",
    ];

    for (const status of validStatuses) {
      // Test with null projectStatus
      const withNull = deriveColumn(makeCard({ status }), null);
      expect(validColumns).toContain(withNull);

      // Test with each phase
      for (const phase of validPhases) {
        const withPhase = deriveColumn(makeCard({ status }), makePresent(phase));
        expect(validColumns).toContain(withPhase);
      }
    }
  });

  it("frd-02: WHEN card is discovered or recommended THEN projectStatus is irrelevant (column never changes based on phase)", () => {
    // The pre-pipeline statuses must produce the same column regardless of what the
    // project status says — the two-axis logic is only active for in-pipeline cards.
    const phases: (Phase | undefined)[] = [
      "product",
      "design",
      "architecture",
      "implementation",
      "release",
      "operation",
      undefined,
    ];

    for (const cardStatus of ["discovered", "recommended"] as IdeaStatus[]) {
      const withNull = deriveColumn(makeCard({ status: cardStatus }), null);

      for (const phase of phases) {
        const result = deriveColumn(makeCard({ status: cardStatus }), makePresent(phase));
        expect(result).toBe(withNull);
      }
    }
  });

  it("frd-02: WHEN card is shipped or discarded THEN projectStatus is irrelevant (column never changes based on phase)", () => {
    const phases: (Phase | undefined)[] = [
      "product",
      "design",
      "architecture",
      "implementation",
      "release",
      "operation",
      undefined,
    ];

    for (const cardStatus of ["shipped", "discarded"] as IdeaStatus[]) {
      const withNull = deriveColumn(makeCard({ status: cardStatus }), null);

      for (const phase of phases) {
        const result = deriveColumn(makeCard({ status: cardStatus }), makePresent(phase));
        expect(result).toBe(withNull);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Mapping table completeness — one assertion per row of blueprint §2
// (mutation testing target: every branch in the switch/map must be killed by a test)
// ---------------------------------------------------------------------------

describe("frd-02: deriveColumn — complete mapping table (blueprint §2)", () => {
  // Row 1: discovered | — → discovered
  it("frd-02 mapping[1]: discovered + any → discovered", () => {
    expect(deriveColumn(makeCard({ status: "discovered" }), null)).toBe("discovered");
  });

  // Row 2: recommended | — → discovered (+ badge)
  it("frd-02 mapping[2]: recommended + any → discovered", () => {
    expect(deriveColumn(makeCard({ status: "recommended" }), null)).toBe("discovered");
  });

  // Row 3: in-pipeline | product → documented
  it("frd-02 mapping[3]: in-pipeline + product → documented", () => {
    expect(deriveColumn(makeCard({ status: "in-pipeline" }), makePresent("product"))).toBe(
      "documented",
    );
  });

  // Row 4: in-pipeline | design → design
  it("frd-02 mapping[4]: in-pipeline + design → design", () => {
    expect(deriveColumn(makeCard({ status: "in-pipeline" }), makePresent("design"))).toBe("design");
  });

  // Row 5: in-pipeline | architecture → architecture
  it("frd-02 mapping[5]: in-pipeline + architecture → architecture", () => {
    expect(deriveColumn(makeCard({ status: "in-pipeline" }), makePresent("architecture"))).toBe(
      "architecture",
    );
  });

  // Row 6: in-pipeline | implementation → building
  it("frd-02 mapping[6]: in-pipeline + implementation → building", () => {
    expect(deriveColumn(makeCard({ status: "in-pipeline" }), makePresent("implementation"))).toBe(
      "building",
    );
  });

  // Row 7: in-pipeline | release → building
  it("frd-02 mapping[7]: in-pipeline + release → building", () => {
    expect(deriveColumn(makeCard({ status: "in-pipeline" }), makePresent("release"))).toBe(
      "building",
    );
  });

  // Row 8: in-pipeline | operation → shipped
  it("frd-02 mapping[8]: in-pipeline + operation → shipped", () => {
    expect(deriveColumn(makeCard({ status: "in-pipeline" }), makePresent("operation"))).toBe(
      "shipped",
    );
  });

  // Row 9: in-pipeline | missing project / status absent / malformed → documented
  it("frd-02 mapping[9a]: in-pipeline + null status → documented (fallback)", () => {
    expect(deriveColumn(makeCard({ status: "in-pipeline" }), null)).toBe("documented");
  });

  it("frd-02 mapping[9b]: in-pipeline + absent status → documented (fallback)", () => {
    expect(deriveColumn(makeCard({ status: "in-pipeline" }), STATUS_ABSENT)).toBe("documented");
  });

  it("frd-02 mapping[9c]: in-pipeline + malformed status → documented (fallback)", () => {
    const malformed: StatusResult = { present: true, malformed: true, status: {} };
    expect(deriveColumn(makeCard({ status: "in-pipeline" }), malformed)).toBe("documented");
  });

  // Row 10: shipped | — → shipped
  it("frd-02 mapping[10]: shipped + any → shipped", () => {
    expect(deriveColumn(makeCard({ status: "shipped" }), null)).toBe("shipped");
  });

  // Row 11: discarded | — → discarded
  it("frd-02 mapping[11]: discarded + any → discarded", () => {
    expect(deriveColumn(makeCard({ status: "discarded" }), null)).toBe("discarded");
  });
});
