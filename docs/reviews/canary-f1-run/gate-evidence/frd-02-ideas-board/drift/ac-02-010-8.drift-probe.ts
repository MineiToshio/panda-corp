/**
 * Drift probe — AC-02-010.8: "THE fichas SHALL reflect the current factory: the Design ficha SHALL
 * state that design uses Claude Design and produces components.md + mocks + design tokens (and
 * microcopy via copywriter); the Architecture ficha SHALL state that it plans the foundation (shared
 * primitives) and the file artifacts of each work order (plus the blueprint, ADRs and Build Plan);
 * and the Build ficha SHALL reflect the v2 build flow — foundation-first, disjoint waves serialized
 * by file artifact, per-WO fidelity loop, the 4-lens + visual-judge gate and the Option-B wave commit."
 *
 * Fails on an assertion while the ficha text (description + LEE/ESCRIBE + team) omits those
 * statements; passes once the fichas carry them.
 */
import { describe, expect, it } from "vitest";
import { PHASES } from "@/components/modules/CampaignPipeline/phases";

function fichaText(key: string): string {
  const phase = PHASES.find((p) => p.key === key);
  if (phase == null) throw new Error(`phase ${key} missing`);
  const team = phase.team.map((m) => `${m.role} ${m.label} ${m.what}`).join(" ");
  return `${phase.description} ${phase.reads} ${phase.writes} ${team}`;
}

const REQUIRED: ReadonlyArray<{ phase: string; claim: string; pattern: RegExp }> = [
  { phase: "design", claim: "uses Claude Design", pattern: /Claude Design/ },
  { phase: "design", claim: "produces components.md", pattern: /components\.md/ },
  {
    phase: "architecture",
    claim: "plans the foundation (shared primitives)",
    pattern: /fundaci[oó]n|foundation|primitivas/i,
  },
  {
    phase: "architecture",
    claim: "plans the file artifacts of each work order",
    pattern: /artefact|artifact/i,
  },
  { phase: "build", claim: "foundation-first", pattern: /fundaci[oó]n|foundation/i },
  { phase: "build", claim: "disjoint waves", pattern: /\bolas?\b|\bwaves?\b/i },
  { phase: "build", claim: "4-lens gate", pattern: /\b4 lentes\b|cuatro lentes|4-lens/i },
];

describe("AC-02-010.8 — fichas reflect the current factory", () => {
  it("design / architecture / build fichas carry every statement the AC requires", () => {
    const missing = REQUIRED.filter((r) => !r.pattern.test(fichaText(r.phase))).map(
      (r) => `${r.phase}: ${r.claim}`,
    );
    expect(missing).toEqual([]);
  });
});
