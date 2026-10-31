/**
 * WO-03-001 — `activeProjects` ADVERSARIAL suite (DR-015).
 *
 * Written by the reviewer (Opus 4.8 — a DIFFERENT model from the implementer) to probe
 * precedence rules, snapshot-gating and fail-soft edges that the implementer's own suite
 * (`lib/active-projects.test.ts`) did NOT cover. Every expectation was pre-confirmed against
 * the real compose helper via a throwaway probe BEFORE being asserted here, so each test
 * kills a real mutant rather than re-describing whatever the code happens to do.
 *
 * Coverage gaps targeted (none of these appear in the implementer suite):
 *   1. Authoritative-over-advisory precedence: status.yaml phase MUST override a conflicting
 *      portfolio `phase` cell (status=architecture beats portfolio=shipped).
 *   2. The v1 business snapshot and last-sync fields are retired (FRD-03 REQ-03-003, WO-13-013): the
 *      reader never carries them, whatever the row's resolved stage or its portfolio cells say.
 *   3. `building` advisory keyword → implementation (the human alias the FRD names but the
 *      implementer never fallback-tested without a status.yaml).
 *   4. Mixed-case advisory phase cell is normalized.
 *   5. Unknown advisory phase → row excluded (no throw, no leak of an invalid stage).
 *   6. `running` is omitted/undefined (never coerced) when status is absent.
 *
 * Traceability: AC-03-001.1 (active inclusion), AC-03-002.1 (stage + running),
 * AC-03-003.1 (business snapshot), AC-03-006.x (path-not-found), blueprint §2/§3 (precedence,
 * fail-soft), regression B1' (strict boolean running).
 *
 * Stack: Vitest. Inline portfolio content (parser path) + real fs over the committed
 * factory-full fixture for the precedence cases that require a real status.yaml.
 */

import { describe, expect, it } from "vitest";

import { FIXTURE_FULL, withFactoryRoot } from "../../tests/fixtures";
import { activeProjects } from "../portfolio/portfolio";

const H =
  "| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |";
const S = "|---|---|---|---|---|---|---|---|---|";

// ---------------------------------------------------------------------------
// (1) Authoritative status.yaml phase OVERRIDES a conflicting portfolio cell.
// proj-architecture's real status.yaml says `architecture`. We hand it a portfolio
// row that LIES and says `shipped` with snapshot cells. The resolved stage must be
// `architecture` (status wins) and NO retired snapshot field may appear. A mutant that
// read `entry.phase` first would be caught here.
// ---------------------------------------------------------------------------

describe("frd-03 adversarial: activeProjects — status.yaml phase beats a conflicting portfolio cell", () => {
  it("resolves stage from status (architecture), ignoring the portfolio 'shipped' cell", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const content = [
        H,
        S,
        "| proj-architecture | projects/proj-architecture | r | i | shipped | 777 | $9 MRR | win | x |",
      ].join("\n");
      const item = activeProjects(content).find((p) => p.name === "proj-architecture");
      expect(item).toBeDefined();
      expect(item?.stage).toBe("architecture");
    });
  });

  it("does NOT attach a snapshot even though the (lying) portfolio row has snapshot cells", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const content = [
        H,
        S,
        "| proj-architecture | projects/proj-architecture | r | i | shipped | 777 | $9 MRR | win | x |",
      ].join("\n");
      const item = activeProjects(content).find((p) => p.name === "proj-architecture");
      expect(item).toBeDefined();
      expect(item).not.toHaveProperty("snapshot");
      expect(item).not.toHaveProperty("lastSync");
    });
  });
});

// ---------------------------------------------------------------------------
// (2) Authoritative `release` beats the portfolio `phase` cell. proj-operation's
// status.yaml = release (DR-085); we give it a portfolio row claiming `implementation`
// and carrying the old snapshot cells. Resolved stage must be release (status wins) and
// the retired fields stay absent on a launched row, the case that used to populate them.
// ---------------------------------------------------------------------------

describe("frd-03 adversarial: activeProjects — authoritative release over the portfolio cell", () => {
  it("resolves release from status and carries no snapshot when the portfolio cell says implementation", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const content = [
        H,
        S,
        "| proj-operation | projects/proj-operation | r | i | implementation | 500 | $1 MRR | dd | x |",
      ].join("\n");
      const item = activeProjects(content).find((p) => p.name === "proj-operation");
      expect(item?.stage).toBe("release");
      expect(item).not.toHaveProperty("snapshot");
    });
  });
});

// ---------------------------------------------------------------------------
// (2b) A NON-release authoritative phase with old snapshot cells. proj-a status =
// implementation; the row lies with snapshot cells → no snapshot, real running flag.
// ---------------------------------------------------------------------------

describe("frd-03 adversarial: activeProjects — no snapshot on a non-release phase despite portfolio cells", () => {
  it("drops portfolio snapshot cells when the resolved stage is implementation", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const content = [
        H,
        S,
        "| proj-a | projects/proj-a | r | i | implementation | 500 | $1 MRR | dd | x |",
      ].join("\n");
      const item = activeProjects(content).find((p) => p.name === "proj-a");
      expect(item?.stage).toBe("implementation");
      expect(item).not.toHaveProperty("snapshot");
      // running comes from the real status.yaml (running: true) — strict boolean (B1').
      expect(item?.running).toBe(true);
      expect(typeof item?.running).toBe("boolean");
    });
  });
});

// ---------------------------------------------------------------------------
// (3) `building` advisory keyword → implementation, via the portfolio FALLBACK
// (no status.yaml on disk). The FRD names `building` as the human alias; the
// implementer suite never exercises it through the no-status fallback path.
// A mutant that dropped the `building` entry from ADVISORY_TO_PHASE would be caught.
// ---------------------------------------------------------------------------

describe("frd-03 adversarial: activeProjects — 'building' advisory keyword maps to implementation (fallback)", () => {
  it("classifies a no-status row whose portfolio phase is 'building' as implementation and includes it", () => {
    const content = [
      H,
      S,
      "| build-proj | /no/such/path/build-proj | r | i | building | — | — | — | x |",
    ].join("\n");
    const item = activeProjects(content).find((p) => p.name === "build-proj");
    expect(item).toBeDefined();
    expect(item?.stage).toBe("implementation");
    // path missing on disk → exists:false but still listed (badge-ready, AC-03-006.x).
    expect(item?.exists).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (4) Mixed-case advisory phase cell ("Implementation") must normalize via the
// lower-cased lookup. A mutant that dropped `.toLowerCase()` would exclude the row.
// ---------------------------------------------------------------------------

describe("frd-03 adversarial: activeProjects — mixed-case advisory phase is normalized", () => {
  it("classifies a portfolio phase cell 'Implementation' (capitalized) as implementation", () => {
    const content = [
      H,
      S,
      "| mixed | /no/such/path/mixed | r | i | Implementation | — | — | — | x |",
    ].join("\n");
    const item = activeProjects(content).find((p) => p.name === "mixed");
    expect(item).toBeDefined();
    expect(item?.stage).toBe("implementation");
  });
});

// ---------------------------------------------------------------------------
// (5) Unknown advisory phase → row excluded, no throw, no invalid stage leaked.
// A mutant that defaulted an unknown phase to a real stage (instead of undefined)
// would surface the row and be caught by the exclusion + valid-stage invariant.
// ---------------------------------------------------------------------------

describe("frd-03 adversarial: activeProjects — unknown advisory phase is excluded", () => {
  it("excludes a no-status row whose portfolio phase is gibberish and never throws", () => {
    const content = [H, S, "| gib | /no/such/path/gib | r | i | bananas | — | — | — | x |"].join(
      "\n",
    );
    let result: ReturnType<typeof activeProjects> = [];
    expect(() => {
      result = activeProjects(content);
    }).not.toThrow();
    expect(result.map((p) => p.name)).not.toContain("gib");
  });

  it("never emits an item whose stage is outside the active set, across a mixed table", () => {
    const ACTIVE = new Set(["architecture", "implementation", "release"]);
    const content = [
      H,
      S,
      "| a-arch | /p/a | r | i | architecture | — | — | — | x |",
      "| a-gib | /p/g | r | i | not-a-phase | — | — | — | x |",
      "| a-design | /p/d | r | i | design | — | — | — | x |",
      "| a-op | /p/o | r | i | release | 1 | $2 | win | x |",
    ].join("\n");
    const result = activeProjects(content);
    for (const item of result) {
      expect(item.stage).toBeDefined();
      expect(ACTIVE.has(item.stage as string)).toBe(true);
    }
    // design + gibberish excluded; architecture + release (launched) kept.
    expect(result.map((p) => p.name).sort()).toEqual(["a-arch", "a-op"]);
  });
});

// ---------------------------------------------------------------------------
// (6) `running` is never coerced when status is absent — it stays undefined
// (regression B1': a NaN/null/0 must never masquerade as a boolean).
// ---------------------------------------------------------------------------

describe("frd-03 adversarial: activeProjects — running undefined (not coerced) when status absent", () => {
  it("leaves running undefined for a no-status active row", () => {
    const content = [
      H,
      S,
      "| no-status | /no/such/path/no-status | r | i | release | — | — | — | x |",
    ].join("\n");
    const item = activeProjects(content).find((p) => p.name === "no-status");
    expect(item).toBeDefined();
    expect(item?.running).toBeUndefined();
    // status object reflects absence; never null-dereferenced.
    expect(item?.status.present).toBe(false);
    expect(item?.status.status).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// (7) A launched row with placeholder cells: the retired snapshot never appears, not
// even as an empty object or the raw placeholder string.
// ---------------------------------------------------------------------------

describe("frd-03 adversarial: activeProjects — placeholder snapshot cells on a launched row", () => {
  it("keeps the launched row and carries no snapshot field at all", () => {
    const content = [
      H,
      S,
      "| part-op | /no/such/path/part-op | r | i | release | 5 | — | — | x |",
    ].join("\n");
    const item = activeProjects(content).find((p) => p.name === "part-op");
    expect(item?.stage).toBe("release");
    expect(item).not.toHaveProperty("snapshot");
    expect(JSON.stringify(item)).not.toContain("—");
  });
});
