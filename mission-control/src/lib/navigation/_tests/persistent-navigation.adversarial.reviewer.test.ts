import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";
import { routeHref, workspaceRouteState } from "../routeState";
import { navigationHref, parseNavigationUrl } from "../urls";

const notFoundDigest = "NEXT_HTTP_ERROR_FALLBACK;404";
const allowedHost = (url: string): NextRequest =>
  new NextRequest(url, { headers: { host: "localhost:3000" } });

describe("independent persistent navigation boundary", () => {
  it.each([
    "/",
    "/board",
    "/portfolio",
    "/projects/example",
    "/proposals",
    "/achievements",
    "/manual",
    "/configuration",
  ])("rejects duplicate and oversized query input before rendering %s", (family) => {
    expect(proxy(allowedHost(`http://localhost${family}?entity=first&entity=second`)).status).toBe(
      400,
    );
    expect(proxy(allowedHost(`http://localhost${family}?q=${"x".repeat(2049)}`)).status).toBe(400);
    expect(proxy(allowedHost(`http://localhost${family}?${"x".repeat(81)}=value`)).status).toBe(
      400,
    );
    expect(proxy(allowedHost(`http://localhost${family}?${"x".repeat(8200)}`)).status).toBe(414);
    expect(proxy(allowedHost(`http://localhost${family}?entity=one`)).status).toBe(200);
  });

  it("rejects a foreign or absent Host before it reads any navigation input", () => {
    const hostile = "http://localhost/?entity=first&entity=second";
    const foreign = new NextRequest(hostile, { headers: { host: "evil.example" } });
    expect(proxy(foreign).status).toBe(421);
    expect(proxy(new NextRequest(hostile)).status).toBe(421);
  });

  it.each([
    ["another", "summary", "unexpected"],
    ["another", "work-orders", "WO-01-001", "destroy"],
    ["another", "documents", "docs/product/prd", "full"],
    ["another", "work-orders", "WO-01-001", "summary", "extra"],
  ])("rejects unsupported workspace tails: %j", (...segments) => {
    const href = routeHref("/portfolio", segments, {});
    expect(() => workspaceRouteState(href, segments)).toThrow(notFoundDigest);
  });

  it("passes an unknown workspace tab through with its raw label instead of rejecting the route", () => {
    const segments = ["another", "unsupported"];
    const href = routeHref("/portfolio", segments, {});
    expect(workspaceRouteState(href, segments)).toMatchObject({
      tab: "unknown",
      raw: "unsupported",
    });
  });

  it.each([
    [".."],
    ["."],
    ["bad\\locator"],
    ["%2e%2e"],
    ["bad%5Clocator"],
    ["bad%00locator"],
    ["bad\0locator"],
    ["x".repeat(513)],
  ])("rejects unsafe route segments: %j", (...segments) =>
    expect(() => routeHref("/portfolio", segments, {})).toThrow(notFoundDigest));

  it("preserves exact nested document case, anchor and filters across both presentation contexts", () => {
    for (const family of ["portfolio", "projects"]) {
      const href = navigationHref(
        `/${family}/second-project/work-orders/WO-02-007/full?frd=FRD-02&state=review#Acceptance`,
        {
          tab: "documents",
          doc: "docs/frds/FRD-02/Architecture.md",
          wo: null,
          wotab: null,
        },
      );
      expect(href).toBe(
        `/${family}/second-project/documents/docs%2Ffrds%2FFRD-02%2FArchitecture.md?frd=FRD-02&state=review#Acceptance`,
      );
      expect(parseNavigationUrl(href)).toEqual({
        project: "second-project",
        tab: "documents",
        doc: "docs/frds/FRD-02/Architecture.md",
        frd: "FRD-02",
        state: "review",
      });
    }
  });

  it("normalizes Next catch-all escaped path delimiters before constructing the document hydration seed", () => {
    const segments = ["second-project", "documents", "docs%2Fproduct%2Fprd"];
    const href = routeHref("/portfolio", segments, {});
    expect(workspaceRouteState(href, segments).doc).toBe("docs/product/prd");
  });

  it("path identity wins over conflicting legacy query identity and preserves nested model state", () => {
    const href = navigationHref(
      "/portfolio/second-project/architecture?project=first-project&model=schema&schemaTable=User&modelQuery=mail&entity=User&expanded=1#schema",
      {},
    );
    expect(href).toBe(
      "/portfolio/second-project/architecture?model=schema&schemaTable=User&modelQuery=mail&entity=User&expanded=1#schema",
    );
    expect(parseNavigationUrl(href).project).toBe("second-project");
  });
});
