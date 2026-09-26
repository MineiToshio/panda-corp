/**
 * Drift probe — FRD-03 REQ-03-001 (Portfolio membership rule): the rail lists ONLY `building`
 * (implementation) and `shipped` (release) projects; `product` / `design` / `architecture` SHALL
 * NOT appear. `activeProjects()`'s ACTIVE_PHASES still admits "architecture" (pre-existing; see
 * docs/decision-log.md 2026-09-25, point 3). Fails on the assertion while the drift exists and
 * passes once "architecture" is dropped from the rail's phase set.
 */
import { describe, expect, it } from "vitest";

import { activeProjects } from "@/lib/portfolio/portfolio";

const TABLE = [
  "| Proyecto | Ruta | Repo | Idea origen | Fase | Usuarios | Retorno | Veredicto | Última sync |",
  "|---|---|---|---|---|---|---|---|---|",
  "| ProbeArch | `../__drift-probe-arch-missing__/` | — | idea-a | architecture | — | — | — | — |",
  "| ProbeBuild | `../__drift-probe-build-missing__/` | — | idea-b | implementation | — | — | — | — |",
  "",
].join("\n");

describe("REQ-03-001 drift probe — Portfolio membership", () => {
  it("an architecture-phase project is NOT listed in the Portfolio rail", () => {
    const names = activeProjects(TABLE).map((project) => project.name);
    expect(names).toContain("ProbeBuild");
    expect(names).not.toContain("ProbeArch");
  });
});
