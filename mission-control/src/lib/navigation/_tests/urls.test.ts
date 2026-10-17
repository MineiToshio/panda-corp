import { describe, expect, it } from "vitest";
import { navigationHref, parseNavigationUrl } from "../urls";

describe("persistent navigation codec", () => {
  it("round trips board identity, tabs, filters and anchors", () => {
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
