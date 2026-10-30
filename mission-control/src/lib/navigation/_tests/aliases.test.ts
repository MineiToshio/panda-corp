import { expect, it } from "vitest";
import { normalizeLegacyNavigation } from "../aliases";
import { parseNavigationUrl } from "../urls";

it("AC-25-004.1, AC-25-009.1: normalizes legacy selections without losing context or anchors", () => {
  for (const family of ["portfolio", "projects"]) {
    const href = `/${family}/second/work-orders/WO-01-001/full?state=review#goal`;
    const next = normalizeLegacyNavigation(href);
    expect(next).toBe(`/${family}/second/observability?state=review&wo=WO-01-001&woview=full#goal`);
    expect(normalizeLegacyNavigation(next)).toBe(next);
    expect(parseNavigationUrl(next).project).toBe("second");
    expect(normalizeLegacyNavigation(`/${family}/second/party`)).toBe(`/${family}/second/summary`);
  }
  expect(normalizeLegacyNavigation("/portfolio?portfolioView=accounts#rows")).toBe(
    "/portfolio?view=cuentas#rows",
  );
  expect(normalizeLegacyNavigation("/manual/reference/commands/spec?q=test#body")).toBe(
    "/configuration/skills/spec?q=test#body",
  );
  expect(
    normalizeLegacyNavigation("/board?idea=stable&boardTab=docs&doc=docs%2Fprd.md&expanded=1#h"),
  ).toBe("/board/stable/documents/docs%2Fprd.md?expanded=1#h");
  for (const href of [
    "http://[",
    "/unknown?idea=test",
    "/manual/reference/unknown/x",
    "/board/%zz",
    "/portfolio/second/summary/extra",
    "/projects/second/work-orders/WO-01-001/destroy",
  ])
    expect(normalizeLegacyNavigation(href)).toBe(href);
});

it("keeps query-based aliases, model mode and obsolete observability views idempotent", () => {
  for (const family of ["portfolio", "projects"]) {
    const href = `/${family}?project=second&tab=Work%20orders&wo=WO-01-001&wotab=full&view=dag&model=schema#goal`;
    const next = normalizeLegacyNavigation(href);
    expect(next).toBe(
      `/${family}/second/observability?wo=WO-01-001&view=deps&model=Esquema&woview=full#goal`,
    );
    expect(normalizeLegacyNavigation(next)).toBe(next);
  }
  expect(normalizeLegacyNavigation("/portfolio?project=second#h")).toBe(
    "/portfolio/second/summary#h",
  );
  expect(normalizeLegacyNavigation("/board/second/architecture?model=diagram")).toBe(
    "/board/second/architecture?model=Diagrama",
  );
  expect(normalizeLegacyNavigation("/portfolio/second/unsupported?model=schema")).toBe(
    "/portfolio/second/unsupported?model=schema",
  );
  expect(normalizeLegacyNavigation("/portfolio?tab=party&tab=spec")).toBe(
    "/portfolio?tab=party&tab=spec",
  );
});
