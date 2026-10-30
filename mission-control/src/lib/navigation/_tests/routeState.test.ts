import { expect, it } from "vitest";
import { routeHref, workspaceRouteState } from "../routeState";

it("AC-25-007.1, AC-25-008.1: keeps unavailable tabs explicit in both presentation contexts", () => {
  for (const family of ["portfolio", "projects"]) {
    for (const tab of ["missing", "sección inexistente"]) {
      const segments = ["second", tab];
      const href = routeHref(`/${family}`, segments, {});
      expect(workspaceRouteState(href, segments)).toEqual({
        project: "second",
        tab: "unknown",
        raw: tab,
      });
      expect(() => workspaceRouteState(`${href}/tail`, [...segments, "tail"])).toThrow();
    }
  }
  expect(() => routeHref("/portfolio", [".."], {})).toThrow();
  expect(() => routeHref("/portfolio", [], { q: ["first", "second"] })).toThrow();
  expect(() => routeHref("/portfolio", [], { q: "x".repeat(2049) })).toThrow();
});
