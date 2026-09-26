/**
 * Drift probe — AC-02-010.4 deliverable chain: "The deliverable chain (LEE→ESCRIBE) SHALL be
 * research.md → PRD/FRDs (EARS) → mockups + design tokens + components.md (microcopy) → blueprint +
 * ADRs + Build Plan + work orders → …". The design phase's ESCRIBE (and so the architecture phase's
 * LEE) must name components.md.
 *
 * Fails on an assertion while the design→architecture hand-off omits components.md; passes once the
 * chain carries it.
 */
import { describe, expect, it } from "vitest";
import { PHASES } from "@/components/modules/CampaignPipeline/phases";

function phase(key: string): (typeof PHASES)[number] {
  const found = PHASES.find((p) => p.key === key);
  if (found == null) throw new Error(`phase ${key} missing`);
  return found;
}

describe("AC-02-010.4 — deliverable chain names components.md at the design hand-off", () => {
  it("design ESCRIBE and architecture LEE both include components.md", () => {
    expect({
      designWrites: /components\.md/.test(phase("design").writes),
      architectureReads: /components\.md/.test(phase("architecture").reads),
    }).toEqual({ designWrites: true, architectureReads: true });
  });
});
