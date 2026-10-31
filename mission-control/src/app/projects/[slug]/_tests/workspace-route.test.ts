import { describe, expect, it } from "vitest";
import { routeHref, workspaceRouteState } from "@/lib/navigation/routeState";
import { parseNavigationUrl } from "@/lib/navigation/urls";
import { workspaceHref, workspaceSelection } from "../workspace-route";

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
      activeTab: "observability",
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

describe.each(["/portfolio", "/projects"] as const)("unknown sections in %s", (family) => {
  it.each([
    "foo%20bar",
    "foo%25bar",
    "foo%2520bar",
    "foo%",
    "%E0%A4%A",
  ])("keeps %s stable across route selection and canonicalization", (raw) => {
    const href = routeHref(family, ["second", raw], {});
    const segments = new URL(href, "http://localhost").pathname.split("/").slice(2);
    const params = workspaceRouteState(href, segments);
    const selection = workspaceSelection(params);
    expect(selection.activeTab).toBe("unknown");
    expect(workspaceHref(family, params, "second", selection)).toBe(href);
  });
});
