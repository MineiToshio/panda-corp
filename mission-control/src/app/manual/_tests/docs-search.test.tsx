import { describe, expect, it, vi } from "vitest";
import type { ManualPage } from "@/lib/manual/manual";
import { buildSearchIndex, searchPages } from "../_components/DocsSearch/search";

const pages: ManualPage[] = [
  {
    group: "concepts",
    slug: "body",
    title: "Other",
    order: 2,
    body: `${"x".repeat(100)} acción ${"z".repeat(200)}`,
  },
  { group: "guides", slug: "title", title: "Acción", order: 1, body: "A guide" },
];
describe("AC-08-020.2 pure full-text search", () => {
  it("folds accents/case, ranks titles first and clips both snippet ends around the match", () => {
    const index = buildSearchIndex(pages, (page) => page.body);
    const hits = searchPages(index, "ACCION");
    expect(hits.map((hit) => hit.page.slug)).toEqual(["title", "body"]);
    expect(hits[1]?.snippet).toMatch(/^….*acción.*…$/);
    expect(searchPages(index, " ")).toEqual([]);
    expect(searchPages(index, "no-match")).toEqual([]);
  });
  it("reports extraction failures and keeps failed pages searchable by title only", () => {
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("Broken renderer");
    const index = buildSearchIndex(pages, () => {
      throw error;
    });
    expect(report).toHaveBeenCalledWith(expect.stringContaining("concepts/body"), error);
    expect(searchPages(index, "Acción")).toHaveLength(1);
    expect(index.every((entry) => entry.text === "")).toBe(true);
    report.mockRestore();
  });
});
