/**
 * FRD-08 gate, reviewer (opus): content oracle for WO-08-004 over EVERY indexed page, bespoke or
 * markdown. The builder's retired-phrase guard walks registered renderers only, so a page that
 * renders its `.md` body escaped it.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readManualPages } from "@/lib/manual/manual";
import { extractPageText } from "../_components/DocsSearch/extract";
import { buildSearchIndex, searchPages } from "../_components/DocsSearch/search";
import { getManualPageComponent } from "../manualPages";

const pages = readManualPages(process.cwd());
function text(slug: string): string {
  const page = pages.find((entry) => entry.slug === slug);
  if (!page) throw new Error(`Missing page: ${slug}`);
  return `${page.title} ${extractPageText(page, renderToStaticMarkup)}`;
}
const SURFACES = pages.map((page) => page.slug);

describe("WO-08-004 REQ-08-013 retired surfaces, all pages", () => {
  it.each(SURFACES)("%s names no retired Mission Control surface", (slug) => {
    expect(text(slug)).not.toMatch(
      /Portfolio\s*→|Party\s*→|panel Party|pestaña \W*Party|El Party panel|feed del Party|eventos del Party|tribunal del Party|el Party\b/i,
    );
    expect(text(slug)).not.toContain("Claude Design");
  });

  it("g-adoptar names the app destination «Portafolio», not «Portfolio»", () => {
    expect(text("g-adoptar")).not.toMatch(/en el Portfolio|y el Portfolio/);
  });
});

describe("WO-08-004 REQ-08-013 build mode guide matches the installed engine", () => {
  it("REQ-08-021.1 selects scope or resumes without retired power modes", () => {
    const guide = text("g-modo");
    expect(guide).toContain("implement frd-05-settings");
    expect(guide).toContain("implement change:mc-fix-pagination");
    expect(guide).toContain("--resume");
    expect(guide).not.toMatch(/implement (balanced|powerful|deep|pro)/);
    expect(guide).not.toMatch(/(?:hasta|oleadas de) [248] work orders/);
  });

  it("commands are separated from the prose that introduces them", () => {
    expect(text("g-modo")).not.toMatch(/[.;](?:implement|--lanes)/);
  });
});

describe("REQ-08-018 every indexed page has one content source", () => {
  it("indexes only bespoke or real-prose pages", () => {
    for (const page of pages) {
      if (!getManualPageComponent(page.slug)) expect(page.body.trim().length).toBeGreaterThan(200);
    }
  });
});

describe("AC-08-020.2 real Day 1 search content", () => {
  it("finds project prose across every retained group without joining adjacent blocks", () => {
    const index = buildSearchIndex(pages, (page) => extractPageText(page, renderToStaticMarkup));
    const hits = searchPages(index, "proyecto");
    expect(new Set(hits.map((hit) => hit.group))).toEqual(
      new Set(["tutorial", "guides", "concepts", "workflows"]),
    );
    const backlog = hits.find((hit) => hit.page.slug === "wf-pandacorp-backlog");
    expect(backlog?.snippet).toContain("proyecto");
    expect(text("wf-pandacorp-backlog")).toContain("/pandacorp:implement");
    for (const hit of hits) {
      expect(hit.snippet.replace(/\b(?:OpenCode|JavaScript)\b/g, "")).not.toMatch(
        /\p{Ll}[.:]?\p{Lu}\p{Ll}/u,
      );
    }
  });
});
