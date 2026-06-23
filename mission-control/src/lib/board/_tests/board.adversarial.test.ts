/**
 * WO-02-001 — `deriveColumn` ADVERSARIAL review tests (DR-015)
 *
 * Written by the reviewer (Opus 4.8), NOT the implementer. These probe edges the
 * implementer's own suite (`board.test.ts`) did not exercise, derived from the EARS
 * criteria and the real incidents in `.pandacorp/comms/progress.md` (B1', I2, I3).
 *
 * The implementer's suite only ever feeds a *well-typed* StatusResult whose `phase`
 * is either a valid Phase literal or `undefined`. But the documented regression anchors
 * B1'/I2/I3 are precisely about values that BYPASS `typeof`/truthiness checks at runtime
 * (NaN, arrays, empty objects, non-string scalars). board.ts claims it "trusts the
 * StatusResult contract" — these tests verify that even if a malformed runtime value
 * reaches `phase`, deriveColumn fails CLOSED to `documented` and never throws / never
 * returns a wrong column. Fail-closed is the factory rule for ambiguous input.
 *
 * Also: mutation-testing intent (DR-016) — the `default` branch of the phase switch and
 * the `present`/`null` guards must each be killed by at least one assertion here.
 */

import { describe, expect, it } from "vitest";
import type { IdeaCard } from "../../ideas/ideas";
import type { StatusResult } from "../../status/status";
import { type BoardColumn, deriveColumn } from "../board";

function card(status: IdeaCard["status"]): IdeaCard {
  return { slug: "adv", title: "Adv", body: "", status };
}

// Build a "present" StatusResult whose phase is an arbitrary runtime value, bypassing
// the type system on purpose (this mimics a StatusResult that slipped past readStatus
// or a future readStatus regression — the consumer must still be safe).
function presentWithRawPhase(rawPhase: unknown): StatusResult {
  return {
    present: true,
    malformed: false,
    status: { phase: rawPhase as never },
  };
}

const VALID_COLUMNS: readonly BoardColumn[] = [
  "discovered",
  "documented",
  "design",
  "architecture",
  "building",
  "shipped",
  "discarded",
];

// ---------------------------------------------------------------------------
// B1'/I3 at the SHAPE level: a runtime-invalid `phase` on an in-pipeline card
// must fail closed to documented, never throw, never return a wrong column.
// ---------------------------------------------------------------------------

describe("frd-02 ADVERSARIAL: in-pipeline with runtime-invalid phase fails closed", () => {
  const badPhases: Array<[string, unknown]> = [
    ["NaN (B1')", Number.NaN],
    ["number 0", 0],
    ["number 1", 1],
    ["null", null],
    ["empty string", ""],
    ["unknown string 'productxyz'", "productxyz"],
    ["uppercase 'PRODUCT'", "PRODUCT"],
    ["array of phases (I3)", ["product", "design"]],
    ["empty array", []],
    ["empty object (I2)", {}],
    ["boolean true", true],
    ["Symbol", Symbol("design")],
  ];

  for (const [label, raw] of badPhases) {
    it(`frd-02 adv: in-pipeline + phase=${label} → documented (fallback, no throw)`, () => {
      const status = presentWithRawPhase(raw);
      let result: BoardColumn | undefined;
      expect(() => {
        result = deriveColumn(card("in-pipeline"), status);
      }).not.toThrow();
      // Fail-closed: an unrecognized phase is NOT design/architecture/building/shipped.
      expect(result).toBe<BoardColumn>("documented");
    });
  }

  it("frd-02 adv: a phase that stringly-coincides with a column name but is wrong-typed (number) does not leak", () => {
    // Guards against an implementation that did `String(phase)` then switched.
    const result = deriveColumn(card("in-pipeline"), presentWithRawPhase(42));
    expect(result).toBe<BoardColumn>("documented");
  });
});

// ---------------------------------------------------------------------------
// Mutation killer: the `release → shipped` mapping must be distinguishable from
// the `shipped` CARD status path. If an implementer collapsed both, swapping one
// branch would still pass. Pin both independently.
// (DR-085: the launched phase is "release"; the old "operation" phase is gone.)
// ---------------------------------------------------------------------------

describe("frd-02 ADVERSARIAL: shipped column has two distinct sources that must both hold", () => {
  it("frd-02 adv: in-pipeline + release yields shipped via the PHASE axis", () => {
    expect(deriveColumn(card("in-pipeline"), presentWithRawPhase("release"))).toBe("shipped");
  });

  it("frd-02 adv: shipped CARD status yields shipped even when phase axis says product", () => {
    // If the card axis were dropped, this would wrongly become "documented".
    expect(deriveColumn(card("shipped"), presentWithRawPhase("product"))).toBe("shipped");
  });

  it("frd-02 adv: in-pipeline + product does NOT become shipped (kills release/product swap)", () => {
    expect(deriveColumn(card("in-pipeline"), presentWithRawPhase("product"))).not.toBe("shipped");
  });
});

// ---------------------------------------------------------------------------
// malformed:true but a structurally-valid phase is present.
// The contract from readStatus says malformed → status:{} (no phase). But board.ts
// reads status.phase REGARDLESS of the malformed flag. Pin the actual behavior so a
// future change is caught: a present+valid phase is honored even if malformed=true.
// (This is acceptable because readStatus never emits that combo; we document it.)
// ---------------------------------------------------------------------------

describe("frd-02 ADVERSARIAL: malformed flag interaction", () => {
  it("frd-02 adv: malformed=true with a valid phase still maps by phase (board ignores the flag)", () => {
    const s: StatusResult = { present: true, malformed: true, status: { phase: "design" } };
    expect(deriveColumn(card("in-pipeline"), s)).toBe("design");
  });

  it("frd-02 adv: malformed=true with empty status falls back to documented", () => {
    const s: StatusResult = { present: true, malformed: true, status: {} };
    expect(deriveColumn(card("in-pipeline"), s)).toBe("documented");
  });
});

// ---------------------------------------------------------------------------
// Total-function / fuzz invariant over the runtime-invalid card status space.
// AC-02-001.5: design/architecture/building must never be CARD statuses. An invalid
// card status reaching the function must never produce a phase-derived column and
// must never throw — for ANY projectStatus, including a present valid one.
// ---------------------------------------------------------------------------

describe("frd-02 ADVERSARIAL: invalid card status never throws and never borrows a phase column", () => {
  const invalidStatuses = ["design", "architecture", "building", "documented", "", "FOO", "null"];
  const projectStates: StatusResult[] = [
    { present: false, malformed: false, status: null },
    { present: true, malformed: false, status: { phase: "release" } },
    { present: true, malformed: false, status: { phase: "design" } },
  ];

  for (const bad of invalidStatuses) {
    for (const ps of projectStates) {
      it(`frd-02 adv: card.status='${bad}' + project phase=${
        ps.present ? ps.status.phase : "absent"
      } → safe (no throw, valid column, not phase-borrowed)`, () => {
        let result: BoardColumn | undefined;
        expect(() => {
          result = deriveColumn(card(bad as IdeaCard["status"]), ps);
        }).not.toThrow();
        expect(VALID_COLUMNS).toContain(result);
        // An invalid CARD status must not inherit the project's phase column.
        // i.e. with phase=release the result must NOT be "shipped".
        if (ps.present && ps.status.phase === "release") {
          expect(result).not.toBe<BoardColumn>("shipped");
        }
        if (ps.present && ps.status.phase === "design") {
          expect(result).not.toBe<BoardColumn>("design");
        }
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Deep non-mutation under the in-pipeline+phase path with a frozen input.
// If deriveColumn ever wrote to its inputs it would throw on a frozen object.
// ---------------------------------------------------------------------------

describe("frd-02 ADVERSARIAL: frozen inputs prove read-only purity", () => {
  it("frd-02 adv: deriveColumn does not write to a deeply-frozen projectStatus", () => {
    const frozen: StatusResult = Object.freeze({
      present: true,
      malformed: false,
      status: Object.freeze({ phase: "implementation" as const }),
    });
    const frozenCard = Object.freeze(card("in-pipeline")) as IdeaCard;
    expect(() => deriveColumn(frozenCard, frozen)).not.toThrow();
    expect(deriveColumn(frozenCard, frozen)).toBe("building");
  });
});
