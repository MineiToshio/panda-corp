/**
 * AC-02-010.8 — Phase fichas MUST reflect the current factory (WO-02-007)
 *
 * Traceability:
 *   AC-02-010.8 — THE fichas SHALL reflect the current factory:
 *     - Design: uses Claude Design, produces components.md + mocks + design tokens (+ microcopy via copywriter)
 *     - Architecture: plans the foundation (shared primitives) and the file artifacts of each WO
 *     - Build: reflects the v2 build flow — foundation-first, disjoint waves, per-WO fidelity loop,
 *       the 4-lens + visual-judge gate and the Option-B wave commit (DR-060)
 *
 * These tests are INTENTIONALLY content-asserting against phases.ts because AC-02-010.8 is a
 * product-level requirement, not just a "renders something" test. They fail if the phase data
 * is stale (was written before the factory model was updated).
 *
 * Stack: Vitest (pure data — no RTL needed for phase data assertions).
 */

import { describe, expect, it } from "vitest";
import { PHASES } from "@/components/modules/CampaignPipeline/phases";

// ---------------------------------------------------------------------------
// Helper: find a phase by key
// ---------------------------------------------------------------------------

function phase(key: string) {
  const p = PHASES.find((ph) => ph.key === key);
  if (!p) throw new Error(`Phase '${key}' not found in PHASES`);
  return p;
}

// ---------------------------------------------------------------------------
// AC-02-010.8 — Design ficha reflects the current factory
// ---------------------------------------------------------------------------

describe("AC-02-010.8 — Design phase ficha reflects the current factory", () => {
  const design = phase("design");

  it("Design description or team mentions Claude Design", () => {
    const text = [design.description, ...design.team.map((m) => m.what)].join(" ").toLowerCase();
    expect(text).toMatch(/claude design/i);
  });

  it("Design writes field mentions components.md (the component inventory)", () => {
    expect(design.writes.toLowerCase()).toMatch(/components\.md/i);
  });

  it("Design writes field mentions mocks (per-FRD mocks/FDD)", () => {
    // Either 'mocks' or 'fdd' — the deliverable chain includes the per-FRD mocks
    const writesLower = design.writes.toLowerCase();
    expect(writesLower.match(/mock|fdd/)).not.toBeNull();
  });

  it("Design writes field mentions design tokens", () => {
    const writesLower = design.writes.toLowerCase();
    // 'tokens' or 'design-tokens' or 'DESIGN.md'
    expect(writesLower.match(/token|design\.md/)).not.toBeNull();
  });

  it("Design team has copywriter (microcopy via copywriter)", () => {
    const roles = design.team.map((m) => m.role);
    expect(roles).toContain("copywriter");
  });

  it("Design team copywriter what mentions microcopy or voz", () => {
    const cw = design.team.find((m) => m.role === "copywriter");
    expect(cw).toBeDefined();
    const what = (cw?.what ?? "").toLowerCase();
    expect(what.match(/microcopy|voz/)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-02-010.8 — Architecture ficha reflects the current factory
// ---------------------------------------------------------------------------

describe("AC-02-010.8 — Architecture phase ficha reflects the current factory", () => {
  const architecture = phase("architecture");

  it("Architecture description or team mentions foundation or primitives (shared primitives planning)", () => {
    const text = [
      architecture.description,
      architecture.writes,
      ...architecture.team.map((m) => m.what),
    ]
      .join(" ")
      .toLowerCase();
    // Either 'fundación', 'primitivas', 'foundation', or 'artifacts'
    expect(text.match(/fundaci[oó]n|primitiva|foundation|artifact/)).not.toBeNull();
  });

  it("Architecture writes field includes work orders (file artifacts per WO)", () => {
    const writesLower = architecture.writes.toLowerCase();
    // 'work order' or 'work-order' or 'WO'
    expect(writesLower.match(/work order|work-order/)).not.toBeNull();
  });

  it("Architecture writes field or team mentions Build Plan", () => {
    const text = [architecture.writes, ...architecture.team.map((m) => m.what)]
      .join(" ")
      .toLowerCase();
    expect(text).toMatch(/build plan/i);
  });
});

// ---------------------------------------------------------------------------
// AC-02-010.8 — Build ficha reflects the v2 build flow
// ---------------------------------------------------------------------------

describe("AC-02-010.8 — Build phase ficha reflects the v2 build flow", () => {
  const build = phase("build");

  it("Build description mentions 4 lenses (4-lens gate)", () => {
    const text = [build.description, ...build.team.map((m) => m.what)].join(" ").toLowerCase();
    // '4 lentes', '4 lens', 'cuatro lentes', 'visual-judge', '4-lens'
    expect(text.match(/4 lens|4-lens|cuatro lens|4 lente/)).not.toBeNull();
  });

  it("Build description or reviewer what mentions visual gate or visual-judge", () => {
    const text = [build.description, ...build.team.map((m) => m.what)].join(" ").toLowerCase();
    // visual gate / visual check / gate visual / visual-judge / mock
    expect(text.match(/visual|gate visual|fidelidad|mock/)).not.toBeNull();
  });

  it("Build description mentions foundation-first or disjoint waves", () => {
    const text = [build.description, ...build.team.map((m) => m.what)].join(" ").toLowerCase();
    // 'fundación primero', 'foundation-first', 'disjoint', 'disjuntas', 'oleada'
    expect(
      text.match(/fundaci[oó]n.*primero|foundation.*first|disjoint|disjunta|oleada/),
    ).not.toBeNull();
  });

  it("Build description or implementer what mentions fidelity loop or autocorrects against mock", () => {
    const text = [build.description, ...build.team.map((m) => m.what)].join(" ").toLowerCase();
    // 'fidelity loop', 'fidelidad', 'autocorrect', 'autocorrig', 'mock'
    expect(text.match(/fidelidad|autocorrig|bucle de|fidelity|mock/)).not.toBeNull();
  });

  it("Build team has reviewer", () => {
    const roles = build.team.map((m) => m.role);
    expect(roles).toContain("reviewer");
  });

  it("Build reviewer what mentions 4 lenses or gate", () => {
    const reviewer = build.team.find((m) => m.role === "reviewer");
    expect(reviewer).toBeDefined();
    const what = (reviewer?.what ?? "").toLowerCase();
    // '4 lentes', 'gate', 'visual'
    expect(what.match(/4 lente|4 lens|gate|visual/)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sanity — all 6 phases have non-empty required fields
// ---------------------------------------------------------------------------

describe("sanity — all phases have populated required fields", () => {
  const PHASE_KEYS = ["research", "product", "design", "architecture", "build", "release"] as const;

  for (const key of PHASE_KEYS) {
    it(`${key} phase has non-empty key/name/description/reads/writes and at least 1 team member`, () => {
      const p = phase(key);
      expect(p.key.length).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.reads.length).toBeGreaterThan(0);
      expect(p.writes.length).toBeGreaterThan(0);
      expect(p.team.length).toBeGreaterThan(0);
    });
  }
});
