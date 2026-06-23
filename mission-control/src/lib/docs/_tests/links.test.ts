/**
 * lib/docs/links — classifyDocLink + resolveRelativePath
 *
 * Shared doc-link resolution used by both document readers (workspace tab + board
 * card-detail) so in-document links (e.g. the PRD's `[FRD-01](../frds/frd-01-…/frd.md)`)
 * open the linked doc inside the reader instead of 404-ing against the app's routes.
 */

import { describe, expect, it } from "vitest";
import { classifyDocLink, resolveRelativePath } from "../links";

describe("lib/docs/links — resolveRelativePath", () => {
  it("resolves a '../' link against the doc's directory", () => {
    expect(resolveRelativePath("docs/product", "../frds/frd-01-x/frd.md")).toBe(
      "docs/frds/frd-01-x/frd.md",
    );
  });

  it("collapses '.' and drops empty segments", () => {
    expect(resolveRelativePath("docs/product", "./research.md")).toBe("docs/product/research.md");
  });

  it("handles an empty base dir (root-relative)", () => {
    expect(resolveRelativePath("", "docs/decision-log.md")).toBe("docs/decision-log.md");
  });
});

describe("lib/docs/links — classifyDocLink", () => {
  const KNOWN = new Set(["docs/frds/frd-01-x/frd.md", "docs/decision-log.md"]);
  const FROM = "docs/product/prd.md";

  it("classifies an off-app URL as external", () => {
    expect(classifyDocLink("https://example.com", FROM, KNOWN)).toEqual({
      kind: "external",
      href: "https://example.com",
    });
    expect(classifyDocLink("mailto:a@b.com", FROM, KNOWN).kind).toBe("external");
  });

  it("classifies an in-page anchor as anchor", () => {
    expect(classifyDocLink("#section", FROM, KNOWN)).toEqual({ kind: "anchor", href: "#section" });
  });

  it("classifies a relative link to a KNOWN doc as doc (resolved relPath)", () => {
    expect(classifyDocLink("../frds/frd-01-x/frd.md", FROM, KNOWN)).toEqual({
      kind: "doc",
      relPath: "docs/frds/frd-01-x/frd.md",
    });
  });

  it("ignores a trailing #anchor / ?query when resolving a doc link", () => {
    expect(classifyDocLink("../decision-log.md#dr-085", FROM, KNOWN)).toEqual({
      kind: "doc",
      relPath: "docs/decision-log.md",
    });
  });

  it("classifies a relative link to a doc the reader does NOT surface as unknown", () => {
    expect(classifyDocLink("../frds/frd-99-z/frd.md", FROM, KNOWN)).toEqual({ kind: "unknown" });
    expect(classifyDocLink("../work-orders/wo-01.md", FROM, KNOWN)).toEqual({ kind: "unknown" });
  });

  it("classifies an empty href as unknown", () => {
    expect(classifyDocLink("", FROM, KNOWN)).toEqual({ kind: "unknown" });
  });
});
