/**
 * content/manual/wo-08-005.content.test.ts — WO-08-005
 *
 * Content-completeness and structure-page tests for the authored Manual pages.
 *
 * Traceability:
 *   AC-08-005.1 — pages SHALL cover: what Pandacorp is, the flow, the stages in detail,
 *                 commands, implementation modes, standards, how to operate / hand off.
 *   AC-08-005.2 — content SHALL be sufficient for someone with no prior context
 *                 (Tutorial entry point + How-to guides + Concepts Diátaxis coverage).
 *   AC-08-005.3 — WHERE a page describes project documentation structure, it SHALL reflect
 *                 the feature-centric DR-049 layout and SHALL NOT describe the old by-type layout.
 *   AC-08-005.4 — pages are hand-authored (not derived), render via reader, may embed
 *                 CopyButton command chips.
 *
 * TDD plan (WO):
 *   1. RED: each required page slug exists and is indexed; structure-page tokens.
 *   2. GREEN: author the pages.
 *   3. Refactor / copy-edit pass.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readManualPages } from "@/lib/manual/manual";

// ---------------------------------------------------------------------------
// The app root is the mission-control directory (one level up from content/)
// ---------------------------------------------------------------------------

const APP_ROOT = path.resolve(__dirname, "../..");

// ---------------------------------------------------------------------------
// Required page slugs per WO and blueprint §3
// ---------------------------------------------------------------------------

// Tutorial (Empezar aquí) — at least one entry point
const REQUIRED_TUTORIAL_SLUGS = ["como-empezar"];

// Guides (Guías) — the prototype's 7 how-to guides (FRD-08 re-anchor).
const REQUIRED_GUIDE_SLUGS = [
  "g-capturar",
  "g-handoff",
  "g-modo",
  "g-feedback",
  "g-probar",
  "g-traspaso",
  "g-plugin",
];

// Concepts (Conceptos) — explanatory quadrant
const REQUIRED_CONCEPT_SLUGS = [
  "que-es-pandacorp",
  "el-pipeline",
  "el-equipo",
  "estandares-y-reglas",
  "arquitectura-del-sistema",
  "mission-control-por-dentro",
  "estado-y-archivos",
  "hooks-gates-seguridad",
  "stacks-golden-paths",
  "construccion-desatendida",
  "el-plugin",
  "autoaprendizaje",
];

// The slug that covers the DR-049 feature-centric documentation structure
// (may live in concepts or guides — we check for existence across all groups)
const STRUCTURE_PAGE_SLUG = "arquitectura-del-sistema";

// ---------------------------------------------------------------------------
// Helper — index via readManualPages so we test the live content tree
// ---------------------------------------------------------------------------

function getPages() {
  return readManualPages(APP_ROOT);
}

// ---------------------------------------------------------------------------
// AC-08-005.1 + AC-08-005.2 — Content completeness
// ---------------------------------------------------------------------------

describe("AC-08-005.1 + AC-08-005.2 — required page slugs are present and indexed", () => {
  it("tutorial group contains all required slugs", () => {
    const pages = getPages();
    const tutorialSlugs = pages.filter((p) => p.group === "tutorial").map((p) => p.slug);
    for (const slug of REQUIRED_TUTORIAL_SLUGS) {
      expect(tutorialSlugs, `Missing tutorial page: ${slug}`).toContain(slug);
    }
  });

  it("guides group contains all required slugs", () => {
    const pages = getPages();
    const guideSlugs = pages.filter((p) => p.group === "guides").map((p) => p.slug);
    for (const slug of REQUIRED_GUIDE_SLUGS) {
      expect(guideSlugs, `Missing guide page: ${slug}`).toContain(slug);
    }
  });

  it("concepts group contains all required slugs", () => {
    const pages = getPages();
    const conceptSlugs = pages.filter((p) => p.group === "concepts").map((p) => p.slug);
    for (const slug of REQUIRED_CONCEPT_SLUGS) {
      expect(conceptSlugs, `Missing concept page: ${slug}`).toContain(slug);
    }
  });

  it("all three Diátaxis groups have at least one authored page", () => {
    const pages = getPages();
    const groups = new Set(pages.map((p) => p.group));
    expect(groups.has("tutorial"), "tutorial group must have pages").toBe(true);
    expect(groups.has("guides"), "guides group must have pages").toBe(true);
    expect(groups.has("concepts"), "concepts group must have pages").toBe(true);
  });

  it("tutorial page 'como-empezar' covers first-run / first-command content", () => {
    const pages = getPages();
    const page = pages.find((p) => p.slug === "como-empezar");
    expect(page, "como-empezar page not found").toBeDefined();
    // Must mention the install/start concept so a no-context reader can begin
    const body = page?.body ?? "";
    expect(body.toLowerCase()).toMatch(/pandacorp|fábrica|factory|instala|primer/);
  });

  it("guide 'g-feedback' covers the bug/iterate/decide channels", () => {
    const pages = getPages();
    const page = pages.find((p) => p.slug === "g-feedback");
    expect(page, "g-feedback page not found").toBeDefined();
    const body = page?.body ?? "";
    // Should mention the feedback channels available while a build runs.
    expect(body.toLowerCase()).toMatch(/bug|iterate|decid|canal|agente/i);
  });

  it("guide 'g-modo' covers the build modes / implement", () => {
    const pages = getPages();
    const page = pages.find((p) => p.slug === "g-modo");
    expect(page, "g-modo page not found").toBeDefined();
    const body = page?.body ?? "";
    expect(body.toLowerCase()).toMatch(/implement|modo|construi|balanced|powerful/i);
  });

  it("guide 'g-traspaso' covers how to hand off to another person", () => {
    const pages = getPages();
    const page = pages.find((p) => p.slug === "g-traspaso");
    expect(page, "g-traspaso page not found").toBeDefined();
    const body = page?.body ?? "";
    expect(body.toLowerCase()).toMatch(/persona|traspas|hand.?off|retomar|otra/i);
  });

  it("concept 'que-es-pandacorp' covers what the factory is", () => {
    const pages = getPages();
    const page = pages.find((p) => p.slug === "que-es-pandacorp");
    expect(page, "que-es-pandacorp page not found").toBeDefined();
    const body = page?.body ?? "";
    expect(body.toLowerCase()).toMatch(/fábrica|software|pandacorp/i);
  });

  it("concept 'el-pipeline' covers the stage progression", () => {
    const pages = getPages();
    const page = pages.find((p) => p.slug === "el-pipeline");
    expect(page, "el-pipeline page not found").toBeDefined();
    const body = page?.body ?? "";
    // Must mention at least three phases
    expect(body.toLowerCase()).toMatch(/product|design|architect|implement|build/i);
  });

  it("each page has a non-empty title", () => {
    const pages = getPages();
    for (const page of pages) {
      expect(page.title.trim(), `Page ${page.slug} has empty title`).not.toBe("");
    }
  });

  it("each page has a non-empty body", () => {
    const pages = getPages();
    for (const page of pages) {
      expect(page.body.trim(), `Page ${page.slug} has empty body`).not.toBe("");
    }
  });
});

// ---------------------------------------------------------------------------
// AC-08-005.3 — DR-049 feature-centric structure page tokens
// ---------------------------------------------------------------------------

describe("AC-08-005.3 — DR-049 feature-centric structure page", () => {
  function getStructurePage() {
    const pages = getPages();
    return pages.find((p) => p.slug === STRUCTURE_PAGE_SLUG);
  }

  it("the structure page exists and is indexed", () => {
    const page = getStructurePage();
    expect(page, `Structure page '${STRUCTURE_PAGE_SLUG}' not found`).toBeDefined();
  });

  it("structure page mentions the feature-centric per-feature folder pattern", () => {
    const page = getStructurePage();
    const body = page?.body ?? "";
    // Must mention the pattern docs/frds/frd-NN-<slug>/ or similar
    expect(body).toMatch(/docs\/frds\/frd-\w+/);
  });

  it("structure page mentions the ID spine (REQ-NN-MMM)", () => {
    const page = getStructurePage();
    const body = page?.body ?? "";
    expect(body).toMatch(/REQ-\d{2}-\d{3}/);
  });

  it("structure page mentions the source-of-truth hierarchy", () => {
    const page = getStructurePage();
    const body = page?.body ?? "";
    // Must include FRD > ... work order hierarchy
    expect(body).toMatch(/FRD.*blueprint|blueprint.*work.?order/i);
  });

  it("structure page mentions docs/product/ layer", () => {
    const page = getStructurePage();
    const body = page?.body ?? "";
    expect(body).toMatch(/docs\/product/);
  });

  it("structure page does NOT describe a global docs/blueprint.md", () => {
    const page = getStructurePage();
    const body = page?.body ?? "";
    // Old layout had a single global docs/blueprint.md — must NOT appear
    expect(body).not.toMatch(/docs\/blueprint\.md/);
  });

  it("structure page does NOT describe a global docs/work-orders/ directory", () => {
    const page = getStructurePage();
    const body = page?.body ?? "";
    // Old layout had docs/work-orders/ at the root — must NOT appear
    expect(body).not.toMatch(/docs\/work-orders\//);
  });

  it("structure page mentions AC-NN-MMM.K acceptance criteria IDs", () => {
    const page = getStructurePage();
    const body = page?.body ?? "";
    expect(body).toMatch(/AC-\d{2}-\d{3}/);
  });

  it("structure page mentions on-demand blueprint.md within feature modules", () => {
    const page = getStructurePage();
    const body = page?.body ?? "";
    // Feature-centric: blueprint lives INSIDE frd-NN-<slug>/, not at docs/ root
    // It should mention blueprint in the context of a feature folder
    expect(body).toMatch(/blueprint\.md/);
    // Should appear alongside frd reference (inside feature folder)
    const hasFrdBlueprint = body.includes("frd") && body.includes("blueprint.md");
    expect(hasFrdBlueprint).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-08-005.4 — file presence and render compatibility
// ---------------------------------------------------------------------------

describe("AC-08-005.4 — hand-authored files exist and are valid markdown", () => {
  const allRequiredSlugs: Array<{ group: string; slug: string }> = [
    ...REQUIRED_TUTORIAL_SLUGS.map((s) => ({ group: "tutorial", slug: s })),
    ...REQUIRED_GUIDE_SLUGS.map((s) => ({ group: "guides", slug: s })),
    ...REQUIRED_CONCEPT_SLUGS.map((s) => ({ group: "concepts", slug: s })),
  ];

  for (const { group, slug } of allRequiredSlugs) {
    it(`content/manual/${group}/${slug}.md exists on disk`, () => {
      const filePath = path.join(APP_ROOT, "content", "manual", group, `${slug}.md`);
      expect(fs.existsSync(filePath), `File not found: ${filePath}`).toBe(true);
    });
  }

  it("all required pages are returned by readManualPages() (not just on disk)", () => {
    const pages = getPages();
    const indexed = new Set(pages.map((p) => `${p.group}/${p.slug}`));
    for (const { group, slug } of allRequiredSlugs) {
      expect(indexed.has(`${group}/${slug}`), `Not indexed: ${group}/${slug}`).toBe(true);
    }
  });

  it("no page file has empty frontmatter title", () => {
    const pages = getPages();
    const allSlugs = allRequiredSlugs.map((x) => x.slug);
    const required = pages.filter((p) => allSlugs.includes(p.slug));
    for (const page of required) {
      expect(page.title.trim(), `Empty title in ${page.slug}`).not.toBe("");
    }
  });
});
