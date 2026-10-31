import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readManualPages } from "@/lib/manual/manual";
import { DAILY_GUIDES, ESSENTIALS } from "../_components/DocsHome/model";
import { extractPageText, loadSearchIndex } from "../_components/DocsSearch/extract";
import { getManualPageComponent, manualPageSlugs } from "../manualPages";

const pages = readManualPages(process.cwd());
function text(slug: string): string {
  const page = pages.find((entry) => entry.slug === slug);
  if (!page) throw new Error(`Missing page: ${slug}`);
  return extractPageText(page, renderToStaticMarkup).replace(/\s+/g, " ");
}
const RETIRED =
  /Portfolio\s*→|panel Party|pestaña Party|El Party panel|feed del Party|eventos del Party|tribunal del Party|en el Party|mira el Party|>Manual<|>Códice</i;

describe("WO-08-004 v2 authored documentation", () => {
  it("REQ-08-004 REQ-08-005 retains every required topic and resolves the curated home links", () => {
    const indexed = new Set(pages.map((page) => page.slug));
    for (const slug of [
      "que-es-pandacorp",
      "el-pipeline",
      "el-equipo",
      "g-modo",
      "estandares-y-reglas",
      "g-handoff",
      "multi-runtime",
      "mission-control-por-dentro",
      ...ESSENTIALS,
      ...DAILY_GUIDES,
    ])
      expect(indexed.has(slug), slug).toBe(true);
    expect(pages.filter((page) => page.group === "tutorial")).toHaveLength(2);
    expect(pages.filter((page) => page.group === "concepts")).toHaveLength(22);
    expect(pages.filter((page) => page.group === "workflows")).toHaveLength(3);
  });
  it.each(
    manualPageSlugs(),
  )("REQ-08-013 extracts every registered renderer without throwing: %s", (slug) => {
    const copy = text(slug);
    expect(copy.length).toBeGreaterThan(100);
    expect(copy).not.toMatch(RETIRED);
    expect(copy).not.toMatch(/en un proyecto nuevo.*motor por defecto.*Claude Design/i);
    expect(copy).not.toContain("Con Claude Design el loop");
  });
  it("AC-08-020.2 memoises the lazy index and indexes renderer prose rather than its stub", async () => {
    const first = loadSearchIndex(pages);
    expect(loadSearchIndex(pages)).toBe(first);
    const index = await first;
    expect(index).toHaveLength(pages.length);
    expect(index.find((entry) => entry.page.slug === "el-pipeline")?.text).toContain(
      "Artifacts privados",
    );
    expect(index.find((entry) => entry.page.slug === "el-pipeline")?.text).not.toContain(
      "manualPages.tsx",
    );
  });
  it("REQ-08-013 explains HTML as source and the stable private Artifact review loop", () => {
    const copy = text("el-pipeline");
    for (const phrase of [
      "direcciones HTML",
      "Artifacts privados",
      "enlace estable",
      "comentarios",
      "journal",
      "archivos locales o capturas",
    ])
      expect(copy).toContain(phrase);
    expect(copy).not.toContain("Claude Design");
    expect(text("multi-runtime")).toContain("Revisión de diseño");
  });
  it("REQ-08-013 routes mode selection and the first mission to the v2 destinations without fixed wave sizes", () => {
    const mode = text("g-modo");
    expect(mode).toContain("Comandos");
    expect(mode).toContain("Campaña");
    expect(mode).toContain("--lanes");
    expect(mode).not.toMatch(/hasta [248] work orders|oleadas de [248]/);
    expect(text("como-empezar")).toContain("Portafolio");
    expect(text("como-empezar")).toContain("La Fragua");
    expect(text("como-empezar")).toContain("Resumen");
  });
  it("REQ-08-006 REQ-08-011 removes embedded catalogs and workflow graphs and retires the deferred graph module", () => {
    expect(pages.some((page) => page.group === "reference")).toBe(false);
    const registry = fs.readFileSync("src/app/manual/manualPages.tsx", "utf8");
    expect(registry).not.toMatch(
      /FlowGraph|workflow-flows|SkillDetail|AgentList|SkillsSection|DecisionRulesSection/,
    );
    expect(fs.existsSync("src/lib/manual/workflow-flows.ts")).toBe(false);
    expect(fs.existsSync("src/lib/manual/skill-flows.ts")).toBe(false);
    expect(fs.existsSync("src/components/modules/manual-diagrams/FlowGraph.tsx")).toBe(false);
  });
  it.each(
    manualPageSlugs(),
  )("REQ-08-001 reader content leaves the shell's single h1 intact: %s", (slug) => {
    const Renderer = getManualPageComponent(slug);
    if (!Renderer) throw new Error(slug);
    expect(renderToStaticMarkup(createElement(Renderer))).not.toMatch(/<h1\b/);
  });
  it("REQ-08-013 keeps the documented conditional external design mirror without making it the design engine", () => {
    const sync = fs.readFileSync(
      path.resolve(process.cwd(), "../plugin/skills/sync/SKILL.md"),
      "utf8",
    );
    expect(sync).toContain("External design source");
    expect(text("g-sync")).toContain("procedencia");
    expect(text("g-sync")).toContain("avisa y ofrece");
  });
});
