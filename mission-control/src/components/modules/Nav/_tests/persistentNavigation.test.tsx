import { describe, expect, it } from "vitest";

import { isShellExempt } from "@/components/modules/AppShell/shellScope";
import { isNavActive } from "@/components/modules/Nav/navTab";

describe("persistent global navigation", () => {
  it("matches only complete navigation prefixes and exempts nested configuration", () => {
    expect(isNavActive("/manual/reference/agents/reviewer", "/manual")).toBe(true);
    expect(isNavActive("/manual-other", "/manual")).toBe(false);
    expect(isNavActive("/manual", "/")).toBe(false);
    expect(isShellExempt("/configuration/skills/spec")).toBe(true);
    expect(isShellExempt("/configuration-other")).toBe(false);
  });
});
