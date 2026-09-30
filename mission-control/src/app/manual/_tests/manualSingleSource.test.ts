/**
 * Single source per Manual page (FRD-08, DR-115).
 *
 * DocReader renders a slug's bespoke React component and never its `.md` body, so a
 * `.md` body that carries prose for a bespoke slug is dead text that looks
 * authoritative (it got edited after the page it "documents" stopped reading it).
 * The `.md` of a bespoke page may only be an index stub: frontmatter (title, group,
 * order for the nav) + H1 + a one-line summary + a pointer to the component.
 */

import { describe, expect, it } from "vitest";
import { readManualPages } from "@/lib/manual/manual";
import { getManualPageComponent, manualPageSlugs } from "../manualPages";

const POINTER = /manualPages\.tsx/;
const STUB_MAX_LINES = 4;
const PROSE_LINE = /^(#{2,}\s|[-*+]\s|\d+\.\s|\||```)/;

function contentLines(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

describe("Manual pages have one source of content", () => {
  const pages = readManualPages(process.cwd());
  const bespoke = pages.filter((page) => getManualPageComponent(page.slug) !== null);

  it("indexes the real content tree (guards against a vacuous run)", () => {
    expect(pages.length).toBeGreaterThan(30);
    expect(bespoke.length).toBeGreaterThan(30);
  });

  it.each(
    bespoke.map((page) => [`${page.group}/${page.slug}`, page] as const),
  )("%s: the .md of a bespoke page is an index stub, not prose", (_name, page) => {
    const lines = contentLines(page.body);
    expect(
      lines.length,
      `${page.slug}.md has ${lines.length} content lines but its bespoke component always wins: edit the component in src/app/manual/manualPages.tsx and reduce the .md to its index stub`,
    ).toBeLessThanOrEqual(STUB_MAX_LINES);
    expect(
      lines.filter((line) => PROSE_LINE.test(line)),
      `${page.slug}.md carries headings/lists/tables that are never rendered`,
    ).toEqual([]);
    expect(
      lines.some((line) => line.startsWith(">") && POINTER.test(line)),
      `${page.slug}.md stub must point at manualPages.tsx`,
    ).toBe(true);
  });

  it("every registered component has an indexed .md (otherwise the page is unreachable)", () => {
    const indexed = new Set(pages.map((page) => page.slug));
    const orphans = manualPageSlugs().filter((slug) => !indexed.has(slug));
    expect(orphans).toEqual([]);
  });

  it("a page without a component renders its .md body, so that body must be real prose", () => {
    const markdownOnly = pages.filter((page) => getManualPageComponent(page.slug) === null);
    expect(markdownOnly.length).toBeGreaterThan(0);
    for (const page of markdownOnly) {
      expect(contentLines(page.body).length, `${page.slug}.md renders as-is`).toBeGreaterThan(
        STUB_MAX_LINES,
      );
    }
  });
});
