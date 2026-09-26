/**
 * Drift probe (BL-0203 whole-FRD finder) — REQ-03-001, portfolio membership.
 *
 * `docs/frds/frd-03-portfolio/frd.md` (last_updated 2026-09-24, the authoritative layer
 * per the source-of-truth hierarchy FRD > FDD > design-tokens > blueprint > work order)
 * is explicit and was tightened after the blueprint was written:
 *
 *   "The Portfolio rail shows ONLY projects that have started development — those in
 *   `building` or `shipped`. Projects still in the `product` / `design` / `architecture`
 *   phases are NOT in Portfolio; they live on the Tablero (FRD-01/02) until they reach
 *   build."
 *   REQ-03-001 — "...projects in `product` / `design` / `architecture` SHALL NOT appear
 *   here (they are on the Tablero)."
 *
 * But `src/lib/portfolio/portfolio.ts`'s `ACTIVE_PHASES` set (read literally, not by name)
 * still contains `"architecture"` (the stale `blueprint.md`, last_updated 2026-06-21, §0
 * still describes the rail as listing "architecture, building, shipped" — it was never
 * updated when the FRD text changed). The existing reviewer suite
 * (`src/app/portfolio/_tests/frd-03-gate-opus.reviewer.test.tsx`, "lists ONLY
 * building/shipped phases; product/design/architecture-only rows are excluded") never
 * actually exercises an `architecture`-phase fixture row despite its own name and
 * docstring claiming to — its fixture only covers `product` and `design`, both of which
 * map to `undefined` in `ADVISORY_TO_PHASE` today, which is a different code path from an
 * explicit `"architecture"` phase (present in both the advisory map AND `ACTIVE_PHASES`).
 * That gap in the existing suite is exactly why this contract needed a fresh, targeted
 * probe rather than trusting the existing test's name.
 *
 * This probe fails today: an `architecture`-phase row (via either the advisory cell or an
 * authoritative `status.yaml` phase) still reaches `activeProjects()`'s output. It passes
 * once `architecture` is removed from the active/membership set (or once the FRD text is
 * reverted, in which case this probe's premise itself would need reviewer sign-off, but
 * that is a spec-side call, not this probe's).
 */
import { describe, expect, it } from "vitest";

import { activeProjects } from "@/lib/portfolio/portfolio";

describe("REQ-03-001 — architecture-phase projects SHALL NOT appear in the Portfolio rail", () => {
  it("an advisory 'architecture' phase cell is excluded from activeProjects()", () => {
    const md = [
      "| Name | Path | Phase |",
      "| --- | --- | --- |",
      "| in-architecture | /nope/arch | architecture |",
      "| in-build | /nope/build | implementation |",
    ].join("\n");

    const names = activeProjects(md).map((item) => item.name);
    expect(names).not.toContain("in-architecture");
    expect(names).toContain("in-build");
  });
});
