import { describe, expect, it, vi } from "vitest";
import { parseNavigationUrl } from "@/lib/navigation/urls";
import { workspaceHref, workspaceSelection } from "../workspace-route";

vi.mock("../ProjectWorkspace", () => ({
  resolveWorkspaceTab: (tab: string | undefined) => tab ?? "summary",
}));

describe("workspace compatibility boundary", () => {
  it.each([
    "/portfolio",
    "/projects",
  ] as const)("normalizes Party and preserves legacy work-order selection in %s", (family) => {
    const party = { project: "second", tab: "party", model: "schema" };
    const summary = workspaceSelection(party);
    expect(summary.activeTab).toBe("summary");
    expect(workspaceHref(family, party, "second", summary)).toBe(
      `${family}/second/summary?model=Esquema`,
    );
    const legacy = { project: "second", tab: "work-orders", wo: "WO-01-001", wotab: "full" };
    const selection = workspaceSelection(legacy);
    expect(selection).toMatchObject({
      activeTab: "observabilidad",
      woParam: "WO-01-001",
      woTabParam: "full",
    });
    const canonical = workspaceHref(family, legacy, "second", selection);
    expect(new URL(canonical, "http://localhost").pathname).toBe(`${family}/second/observability`);
    expect(parseNavigationUrl(canonical)).toMatchObject({ wo: "WO-01-001", woview: "full" });
    expect(canonical).not.toContain("wotab");
    expect(workspaceSelection(parseNavigationUrl(canonical))).toEqual(selection);
  });
});
