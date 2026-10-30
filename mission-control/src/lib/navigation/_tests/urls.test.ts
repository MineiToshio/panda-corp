import { describe, expect, it } from "vitest";
import { navigationHref, parseNavigationUrl } from "../urls";

describe("persistent navigation codec", () => {
  it("AC-25-001.1, AC-25-002.1: round trips board identity, tabs, filters and anchors", () => {
    const href = navigationHref("/board?category=tools#schema", {
      idea: "panda-saga",
      boardTab: "arquitectura",
      entity: "User",
    });
    expect(href).toBe("/board/panda-saga/architecture?category=tools&entity=User#schema");
    expect(parseNavigationUrl(href)).toMatchObject({
      idea: "panda-saga",
      boardTab: "arquitectura",
      entity: "User",
    });
  });
  it("keeps portfolio context and case-sensitive work order identifiers", () => {
    expect(
      navigationHref("/portfolio?project=Personal%20Page&tab=work-orders&wo=WO-04-001", {}),
    ).toBe("/portfolio/Personal%20Page/work-orders/WO-04-001/summary");
    expect(parseNavigationUrl("/projects/panda/observability?view=dag")).toMatchObject({
      project: "panda",
      tab: "observabilidad",
      view: "dag",
    });
  });
  it("keeps relative document paths as one escaped path segment", () => {
    const href = navigationHref("/portfolio/panda/summary", {
      tab: "documents",
      doc: "docs/frds/a/frd.md",
    });
    expect(parseNavigationUrl(href).doc).toBe("docs/frds/a/frd.md");
    expect(href).toContain("docs%2Ffrds%2Fa%2Ffrd.md");
  });
  it("drops the previous tab's nested selection when explicitly cleared", () => {
    expect(
      navigationHref("/board/panda/spec?specFrd=FRD-01", {
        boardTab: "arquitectura",
        specFrd: null,
      }),
    ).toBe("/board/panda/architecture");
  });
  it.each([
    [
      "/proposals",
      { proposalsTab: "backlog", backlogItem: "BL-0023" },
      "/proposals/backlog/BL-0023",
    ],
    ["/achievements", { hallTab: "rangos" }, "/achievements/ranks"],
    [
      "/manual",
      { reference: "agents", referenceItem: "reviewer" },
      "/manual/reference/agents/reviewer",
    ],
    [
      "/configuration",
      { configSection: "rules", configItem: "DR-113" },
      "/configuration/rules/DR-113",
    ],
  ])("serializes %s selections", (base, patch, expected) => {
    expect(navigationHref(base, patch)).toBe(expected);
  });
});

it("AC-25-001.1, AC-25-002.1: every v2 query selection round trips across families", () => {
  const selections = {
    view: "deps",
    frd: "FRD-25",
    state: "review",
    wo: "WO-25-001",
    woview: "full",
    dag: "wo",
    focus: "WO-25-001",
    accountsQuery: "text",
    accountsState: "active",
    account: "provider:account",
    q: "search",
    type: "skill",
    approval: "all",
    severity: "MUST",
    domain: "testing",
    index: "1",
    category: "tools",
    trophy: "first",
    eras: "first,second",
    model: "Esquema",
    boardQuery: "test",
    discarded: "1",
    phase: "design",
    specFrd: "FRD-02",
    architectureFrd: "FRD-02",
    adr: "ADR-01",
    modelQuery: "user",
    entity: "users",
    schemaTable: "users",
    relationship: "owns",
    expanded: "1",
    futureKey: "retained",
  };
  for (const href of [
    "/board/idea/spec",
    "/portfolio/second/observability",
    "/projects/second/observability",
    "/manual/guides/start",
    "/configuration/rules/DR-001",
    "/achievements/ranks",
    "/proposals/backlog",
  ]) {
    const next = navigationHref(`${href}#anchor`, selections);
    expect(parseNavigationUrl(next)).toMatchObject(selections);
    expect(next).toContain("#anchor");
    expect(navigationHref(next, {})).toBe(next);
  }
});

it("AC-25-001.1, AC-25-002.1: generated selections preserve exact Unicode and escaped delimiters", () => {
  for (const value of ["User", "á😀", "x/y", "a&b=c", "a#b?c", "%2F", "空 白"]) {
    for (const family of [
      "board",
      "portfolio",
      "projects",
      "proposals",
      "achievements",
      "manual",
      "configuration",
    ]) {
      const href = navigationHref(`/${family}#heading`, {
        modelQuery: value,
        relationship: value,
        future: value,
      });
      expect(parseNavigationUrl(href)).toMatchObject({
        modelQuery: value,
        relationship: value,
        future: value,
      });
      expect(navigationHref(href, {})).toBe(href);
    }
  }
});
