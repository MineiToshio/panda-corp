import { describe, expect, it, vi } from "vitest";
import { workspaceSelection } from "../workspace-route";

vi.mock("../ProjectWorkspace", () => {
  const tabs = new Set([
    "summary",
    "spec",
    "observabilidad",
    "architecture",
    "accounts",
    "changes",
    "documents",
    "commands",
  ]);
  return {
    resolveWorkspaceTab: (tab: unknown) =>
      typeof tab === "string" && tabs.has(tab) ? tab : "unknown",
  };
});

describe("FRD-25 legacy aliases with no selected project (empty Portfolio)", () => {
  it.each([
    ["party", "summary"],
    ["work-orders", "observabilidad"],
    ["Work orders", "observabilidad"],
  ])("AC-25-004.1: ?tab=%s resolves instead of a not-found", (tab) => {
    expect(() => workspaceSelection({ tab })).not.toThrow();
  });

  it("AC-25-008.1: an unknown tab keeps its bounded raw label instead of opening a project", () => {
    expect(workspaceSelection({ tab: "bogus" })).toMatchObject({
      activeTab: "unknown",
      rawTab: "bogus",
    });
  });
});
