import { describe, expect, it } from "vitest";
import { navActive } from "@/components/modules/Nav/navActive";

describe("persistent global navigation", () => {
  it("AC-25-010.1: matches complete navigation prefixes", () => {
    expect(navActive("/manual/reference/agents/reviewer")).toBe("documentacion");
    expect(navActive("/manual-other")).toBeNull();
    expect(navActive("/manual")).not.toBe("inicio");
    expect(navActive("/configuration/skills/spec")).toBe("configuracion");
    expect(navActive("/configuration-other")).toBeNull();
  });
});
