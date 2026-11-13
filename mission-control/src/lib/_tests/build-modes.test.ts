import { describe, expect, it } from "vitest";
import { buildCommand, isBuildTarget } from "../build-mode-store";

describe("FRD-11 build entry contract", () => {
  it("copies build and resume without power arguments", () => {
    expect(buildCommand("build")).toBe("/pandacorp:implement");
    expect(buildCommand("resume")).toBe("/pandacorp:implement --resume");
  });
  it("copies only explicit FRD or card targets", () => {
    expect(buildCommand("target", "FRD-04")).toBe("/pandacorp:implement FRD-04");
    expect(buildCommand("target", "change:fix-dates")).toBe(
      "/pandacorp:implement change:fix-dates",
    );
    expect(buildCommand("target")).toBeNull();
  });
  it.each(["ready", "draft"])("accepts %s cards", (status) => {
    expect(isBuildTarget({ value: "change:fix", label: "Fix", status })).toBe(true);
  });
});
