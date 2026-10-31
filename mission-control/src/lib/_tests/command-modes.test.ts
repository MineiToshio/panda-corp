/** Clarification flags retained for campaign command disclosures. */

import { describe, expect, it } from "vitest";

import { SPEC_MODES } from "@/lib/command-modes";

describe("command-modes — spec clarification modes", () => {
  it("AC-02-010.9 offers exactly --ask / --auto / --infer with one-line hints", () => {
    expect(SPEC_MODES.map((m) => m.flag)).toEqual(["--ask", "--auto", "--infer"]);
    expect(SPEC_MODES.map((m) => m.label)).toEqual(["ask", "auto", "infer"]);
    for (const mode of SPEC_MODES) expect(mode.hint.trim()).not.toBe("");
  });
});
