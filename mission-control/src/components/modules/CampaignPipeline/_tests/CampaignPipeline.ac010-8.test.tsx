/**
 * AC-02-010.8 — the phase fichas reflect the CURRENT factory.
 *
 * Content-asserting on purpose: the requirement is about what the fichas SAY, so stale copy
 * (written before Claude Design, the foundation, or the v2 build flow) must fail here.
 */

import { describe, expect, it } from "vitest";
import { PHASES, type PhaseDefinition } from "../phases";

function phase(key: string): PhaseDefinition {
  const found = PHASES.find((p) => p.key === key);
  if (found === undefined) throw new Error(`phase "${key}" not found`);
  return found;
}

/** Every text the ficha shows for a phase, lowercased, for content assertions. */
function fichaText(p: PhaseDefinition): string {
  return [p.description, p.reads, p.writes, ...p.team.map((m) => m.what)].join(" ").toLowerCase();
}

describe("AC-02-010.8 — Design ficha", () => {
  const design = phase("design");

  it("states that design uses Claude Design", () => {
    expect(fichaText(design)).toContain("claude design");
  });

  it("writes components.md, mocks and design tokens", () => {
    expect(design.writes.toLowerCase()).toContain("components.md");
    expect(design.writes.toLowerCase()).toContain("mockups");
    expect(design.writes.toLowerCase()).toContain("design tokens");
  });

  it("keeps microcopy with the copywriter", () => {
    const copywriter = design.team.find((m) => m.role === "copywriter");

    expect(copywriter?.what.toLowerCase()).toContain("microcopia");
  });
});

describe("AC-02-010.8 — Architecture ficha", () => {
  const architecture = phase("architecture");

  it("plans the foundation (shared primitives) and each work order's file artifacts", () => {
    const writes = architecture.writes.toLowerCase();

    expect(writes).toContain("fundación");
    expect(writes).toContain("artefactos de archivo");
  });

  it("still writes the blueprint, ADRs and Build Plan", () => {
    const writes = architecture.writes.toLowerCase();

    expect(writes).toContain("blueprint");
    expect(writes).toContain("adrs");
    expect(writes).toContain("build plan");
  });
});

describe("AC-02-010.8 — Build ficha (v2 build flow)", () => {
  const text = fichaText(phase("build"));

  it.each([
    ["foundation-first", "fundación primero"],
    ["disjoint waves serialized by file artifact", "artefacto de archivo"],
    ["per-WO fidelity loop", "bucle de fidelidad"],
    ["the 4-lens gate", "4 lentes"],
    ["the visual judge", "juez visual"],
    ["the Option-B wave commit", "option-b"],
  ])("mentions %s", (_label, phrase) => {
    expect(text).toContain(phrase);
  });

  it("keeps the DR-085 team: hardening last, security-auditor inside the build", () => {
    const roles = phase("build").team.map((m) => m.role);

    expect(roles).toEqual(["implementer", "reviewer", "analytics", "security-auditor"]);
  });
});

describe("AC-02-010.8 — release team is untouched (DR-085)", () => {
  it("release keeps only devops", () => {
    expect(phase("release").team.map((m) => m.role)).toEqual(["devops"]);
  });
});
