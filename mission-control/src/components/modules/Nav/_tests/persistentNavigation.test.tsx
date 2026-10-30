import { describe, expect, it } from "vitest";

import { isNavActive } from "@/components/modules/Nav/navTab";

describe("persistent global navigation", () => {
  it("AC-25-010.1: matches complete navigation prefixes", () => {
    expect(isNavActive("/manual/reference/agents/reviewer", "/manual")).toBe(true);
    expect(isNavActive("/manual-other", "/manual")).toBe(false);
    expect(isNavActive("/manual", "/")).toBe(false);
    expect(isNavActive("/configuration/skills/spec", "/configuration")).toBe(true);
    expect(isNavActive("/configuration-other", "/configuration")).toBe(false);
  });
});
