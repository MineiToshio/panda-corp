/**
 * lib/manual.test.ts — WO-08-001
 *
 * Tests for `readManualPages()` in `lib/manual.ts`.
 *
 * Traceability:
 *   AC-08-001.1 — returns one entry per page with group, slug, title, order, body
 *   AC-08-001.2 — pages returned grouped and ordered; deterministic
 *   AC-08-001.3 — malformed/missing-metadata pages are SKIPPED with typed warning; no throw
 *   AC-08-001.4 — reads from the app's own content/manual/ tree; fixture-testable
 *
 * TDD plan (WO):
 *   1. Fixture content/manual/ with two groups, ordered pages, one malformed.
 *   2. RED: tests for grouping, ordering, skip-malformed, fields.
 *   3. GREEN: implement readManualPages().
 *   4. Refactor.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManualPage } from "./manual";
import { readManualPages } from "./manual";

// ---------------------------------------------------------------------------
// Helpers: build a minimal content/manual fixture in a temp dir
// ---------------------------------------------------------------------------

function makeTmpAppRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-manual-"));
  return dir;
}

function writeManualPage(appRoot: string, group: string, filename: string, content: string): void {
  const dir = path.join(appRoot, "content", "manual", group);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), content, "utf-8");
}

// ---------------------------------------------------------------------------
// Fixture pages content
// ---------------------------------------------------------------------------

const TUTORIAL_PAGE = `---
title: "Cómo empezar"
group: tutorial
order: 1
---

# Cómo empezar

Esta es la guía para el primer arranque.

Aquí aprendes a usar Pandacorp desde cero.
`;

const GUIDE_PAGE_1 = `---
title: "Cómo operas a diario"
group: guides
order: 1
---

# Cómo operas a diario

Guía para la operación diaria de la fábrica.
`;

const GUIDE_PAGE_2 = `---
title: "Cómo se construye"
group: guides
order: 2
---

# Cómo se construye

Guía del pipeline de construcción.
`;

const CONCEPT_PAGE = `---
title: "Qué es Pandacorp"
group: concepts
order: 1
---

# Qué es Pandacorp

Explicación del sistema completo.
`;

// Malformed: missing required `title` field
const MALFORMED_MISSING_TITLE = `---
group: guides
order: 99
---

# Sin título en frontmatter
`;

// Malformed: missing required `group` field
const MALFORMED_MISSING_GROUP = `---
title: "Sin grupo"
order: 5
---

# Sin grupo en frontmatter
`;

// Malformed: missing required `order` field
const MALFORMED_MISSING_ORDER = `---
title: "Sin orden"
group: tutorial
---

# Sin orden en frontmatter
`;

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = makeTmpAppRoot();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// AC-08-001.1 — field shape
// ---------------------------------------------------------------------------

describe("AC-08-001.1 — field shape: group, slug, title, order, body", () => {
  it("returns ManualPage with all required fields for a well-formed page", () => {
    writeManualPage(tmpDir, "tutorial", "como-empezar.md", TUTORIAL_PAGE);

    const pages = readManualPages(tmpDir);

    expect(pages).toHaveLength(1);
    const page = pages[0];
    // Non-null assertion guarded by length check above
    // biome-ignore lint/style/noNonNullAssertion: guarded by length assertion
    const p = page!;
    expect(p.group).toBe("tutorial");
    expect(p.slug).toBe("como-empezar");
    expect(p.title).toBe("Cómo empezar");
    expect(p.order).toBe(1);
    expect(typeof p.body).toBe("string");
    expect(p.body.length).toBeGreaterThan(0);
  });

  it("slug is derived from filename without extension", () => {
    writeManualPage(tmpDir, "guides", "operacion-diaria.md", GUIDE_PAGE_1);

    const pages = readManualPages(tmpDir);

    // biome-ignore lint/style/noNonNullAssertion: guarded by length check
    expect(pages[0]!.slug).toBe("operacion-diaria");
  });

  it("body contains the page markdown content (stripped of frontmatter)", () => {
    writeManualPage(tmpDir, "concepts", "que-es.md", CONCEPT_PAGE);

    const pages = readManualPages(tmpDir);

    // biome-ignore lint/style/noNonNullAssertion: guarded by length check
    const body = pages[0]!.body;
    expect(body).toContain("Qué es Pandacorp");
    // frontmatter should NOT appear in body
    expect(body).not.toContain("group: concepts");
    expect(body).not.toContain("order: 1");
  });

  it("order is parsed as a number", () => {
    writeManualPage(tmpDir, "guides", "construir.md", GUIDE_PAGE_2);

    const pages = readManualPages(tmpDir);

    // biome-ignore lint/style/noNonNullAssertion: guarded by length check
    const firstPage = pages[0]!;
    expect(firstPage.order).toBe(2);
    expect(typeof firstPage.order).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// AC-08-001.2 — grouping and deterministic ordering
// ---------------------------------------------------------------------------

describe("AC-08-001.2 — grouping and deterministic ordering", () => {
  it("returns pages sorted by group then by order", () => {
    // Write out of order to verify sort
    writeManualPage(tmpDir, "guides", "construir.md", GUIDE_PAGE_2);
    writeManualPage(tmpDir, "tutorial", "como-empezar.md", TUTORIAL_PAGE);
    writeManualPage(tmpDir, "guides", "operacion.md", GUIDE_PAGE_1);
    writeManualPage(tmpDir, "concepts", "que-es.md", CONCEPT_PAGE);

    const pages = readManualPages(tmpDir);

    // Find the guides
    const guides = pages.filter((p) => p.group === "guides");
    expect(guides).toHaveLength(2);
    // biome-ignore lint/style/noNonNullAssertion: guarded by length check
    expect(guides[0]!.order).toBeLessThan(guides[1]!.order);
    // biome-ignore lint/style/noNonNullAssertion: guarded by length check
    expect(guides[0]!.title).toBe("Cómo operas a diario");
    // biome-ignore lint/style/noNonNullAssertion: guarded by length check
    expect(guides[1]!.title).toBe("Cómo se construye");
  });

  it("pages within the same group are ordered by ascending order value", () => {
    writeManualPage(tmpDir, "guides", "segunda.md", GUIDE_PAGE_2);
    writeManualPage(tmpDir, "guides", "primera.md", GUIDE_PAGE_1);

    const pages = readManualPages(tmpDir);
    const guides = pages.filter((p) => p.group === "guides");

    expect(guides).toHaveLength(2);
    // biome-ignore lint/style/noNonNullAssertion: guarded by length check
    expect(guides[0]!.order).toBe(1);
    // biome-ignore lint/style/noNonNullAssertion: guarded by length check
    expect(guides[1]!.order).toBe(2);
  });

  it("returns pages from all groups when multiple groups exist", () => {
    writeManualPage(tmpDir, "tutorial", "como-empezar.md", TUTORIAL_PAGE);
    writeManualPage(tmpDir, "guides", "construir.md", GUIDE_PAGE_2);
    writeManualPage(tmpDir, "concepts", "que-es.md", CONCEPT_PAGE);

    const pages = readManualPages(tmpDir);

    const groups = new Set(pages.map((p) => p.group));
    expect(groups.has("tutorial")).toBe(true);
    expect(groups.has("guides")).toBe(true);
    expect(groups.has("concepts")).toBe(true);
  });

  it("result is deterministic across repeated calls with same files", () => {
    writeManualPage(tmpDir, "guides", "segunda.md", GUIDE_PAGE_2);
    writeManualPage(tmpDir, "guides", "primera.md", GUIDE_PAGE_1);
    writeManualPage(tmpDir, "tutorial", "inicio.md", TUTORIAL_PAGE);

    const run1 = readManualPages(tmpDir);
    const run2 = readManualPages(tmpDir);

    expect(run1.map((p) => p.slug)).toEqual(run2.map((p) => p.slug));
  });
});

// ---------------------------------------------------------------------------
// AC-08-001.3 — malformed/missing metadata: skip with typed warning, no throw
// ---------------------------------------------------------------------------

describe("AC-08-001.3 — skip malformed pages with typed warning, never throw", () => {
  it("skips a page with missing title and does not throw", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    writeManualPage(tmpDir, "guides", "sin-titulo.md", MALFORMED_MISSING_TITLE);
    writeManualPage(tmpDir, "guides", "construir.md", GUIDE_PAGE_2);

    let pages: ManualPage[] = [];
    expect(() => {
      pages = readManualPages(tmpDir);
    }).not.toThrow();

    // Only the valid page is returned
    expect(pages).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: guarded by length check
    expect(pages[0]!.slug).toBe("construir");

    // A warning was emitted
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("skips a page with missing group and does not throw", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    writeManualPage(tmpDir, "tutorial", "sin-grupo.md", MALFORMED_MISSING_GROUP);
    writeManualPage(tmpDir, "tutorial", "inicio.md", TUTORIAL_PAGE);

    let pages: ManualPage[] = [];
    expect(() => {
      pages = readManualPages(tmpDir);
    }).not.toThrow();

    expect(pages).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: guarded by length check
    expect(pages[0]!.slug).toBe("inicio");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("skips a page with missing order and does not throw", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    writeManualPage(tmpDir, "tutorial", "sin-orden.md", MALFORMED_MISSING_ORDER);
    writeManualPage(tmpDir, "tutorial", "inicio.md", TUTORIAL_PAGE);

    let pages: ManualPage[] = [];
    expect(() => {
      pages = readManualPages(tmpDir);
    }).not.toThrow();

    expect(pages).toHaveLength(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("warns contain the filename of the skipped page", () => {
    const warnings: string[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    });

    writeManualPage(tmpDir, "guides", "sin-titulo.md", MALFORMED_MISSING_TITLE);

    readManualPages(tmpDir);

    expect(warnings.some((w) => w.includes("sin-titulo.md"))).toBe(true);
    spy.mockRestore();
  });

  it("returns empty array (not throw) when all pages in a group are malformed", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    writeManualPage(tmpDir, "guides", "sin-titulo.md", MALFORMED_MISSING_TITLE);

    let pages: ManualPage[] = [];
    expect(() => {
      pages = readManualPages(tmpDir);
    }).not.toThrow();

    expect(pages).toHaveLength(0);
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// AC-08-001.4 — reads from app's own content/manual/ tree; fixture-testable
// ---------------------------------------------------------------------------

describe("AC-08-001.4 — reads from app-local content/manual/; fixture-testable", () => {
  it("returns empty array when content/manual/ directory does not exist (no throw)", () => {
    // tmpDir has no content/manual subdirectory
    const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-manual-empty-"));
    try {
      let pages: ManualPage[] = [];
      expect(() => {
        pages = readManualPages(emptyRoot);
      }).not.toThrow();
      expect(pages).toHaveLength(0);
    } finally {
      fs.rmSync(emptyRoot, { recursive: true, force: true });
    }
  });

  it("returns empty array when content/manual/ is empty (no groups)", () => {
    fs.mkdirSync(path.join(tmpDir, "content", "manual"), { recursive: true });

    let pages: ManualPage[] = [];
    expect(() => {
      pages = readManualPages(tmpDir);
    }).not.toThrow();
    expect(pages).toHaveLength(0);
  });

  it("accepts appRoot parameter for fixture testing (not the live app root)", () => {
    writeManualPage(tmpDir, "tutorial", "como-empezar.md", TUTORIAL_PAGE);

    const pages = readManualPages(tmpDir);

    // Verify it read from tmpDir, not the live content/manual
    expect(pages).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: guarded by length check
    expect(pages[0]!.slug).toBe("como-empezar");
  });

  it("reads .md files only (ignores non-.md files)", () => {
    writeManualPage(tmpDir, "tutorial", "como-empezar.md", TUTORIAL_PAGE);
    // Write a non-md file that should be ignored
    fs.writeFileSync(
      path.join(tmpDir, "content", "manual", "tutorial", "README.txt"),
      "should be ignored",
    );
    fs.writeFileSync(path.join(tmpDir, "content", "manual", "tutorial", ".DS_Store"), "ignore me");

    const pages = readManualPages(tmpDir);

    expect(pages).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: guarded by length check
    expect(pages[0]!.slug).toBe("como-empezar");
  });

  it("handles group directories that are empty (no .md files)", () => {
    // Create a group dir with no files
    fs.mkdirSync(path.join(tmpDir, "content", "manual", "concepts"), { recursive: true });
    writeManualPage(tmpDir, "tutorial", "inicio.md", TUTORIAL_PAGE);

    const pages = readManualPages(tmpDir);

    // Only tutorial page returned; empty concepts dir doesn't break anything
    expect(pages).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: guarded by length check
    expect(pages[0]!.group).toBe("tutorial");
  });
});

// ---------------------------------------------------------------------------
// Type completeness — verify ManualPage type exports
// ---------------------------------------------------------------------------

describe("type exports", () => {
  it("ManualPage type has the required shape", () => {
    const page: ManualPage = {
      group: "tutorial",
      slug: "test-page",
      title: "Test Page",
      order: 1,
      body: "# Test\n\nContent here.",
    };
    // Just verifying TS compiles with the expected shape
    expect(page.group).toBe("tutorial");
    expect(page.slug).toBe("test-page");
    expect(page.title).toBe("Test Page");
    expect(page.order).toBe(1);
    expect(page.body).toContain("Content");
  });
});
