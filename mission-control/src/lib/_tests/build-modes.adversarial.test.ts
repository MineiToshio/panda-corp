import { describe, expect, it } from "vitest";
import { buildCommand, isBuildTarget } from "../build-mode-store";

describe("FRD-11 target boundary", () => {
  it.each([
    "WO-04-001",
    "powerful",
    "v2",
    "FRD-04 --resume",
    "change:../escape",
    "<id>",
    "",
  ])("rejects unsupported target %s", (value) => {
    expect(buildCommand("target", value)).toBeNull();
    expect(isBuildTarget({ value, label: value, status: "ready" })).toBe(false);
  });
  it.each([
    "building",
    "closing",
    "done",
    "discarded",
    undefined,
  ])("excludes ineligible card state %s", (status) => {
    expect(isBuildTarget({ value: "change:fix", label: "Fix", status })).toBe(false);
  });
  it("excludes stale cards even if ready", () => {
    expect(
      isBuildTarget({
        value: "change:fix",
        label: "Fix",
        status: "ready",
        staleSuspect: "Already shipped",
      }),
    ).toBe(false);
  });
});
