/**
 * lib/standards.test.ts — TDD for readStandards() (WO-07-004, IF-07-standards, FRD-07).
 *
 * Traceability:
 *   AC-07-004.1  one entry per factory/standards/*.md (excluding README.md)
 *   AC-07-004.2  frontmatter values used verbatim when present (option A)
 *   AC-07-004.3  derivation-map fallback when frontmatter absent; unmapped → default + typed warning
 *   AC-07-004.4  summary defaults to body's first bullet list or lead paragraph
 *   AC-07-004.5  uses resolveFactoryRoot(); fixture testing; reflects added/renamed files automatically
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readStandards, type Standard } from "./standards";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let tmpRoots: string[] = [];

/** Create a temp factory root with factory/standards/ populated from `files` map. */
function makeFactoryRoot(files: Record<string, string>): string {
  const factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-standards-test-"));
  const standardsDir = path.join(factoryRoot, "factory", "standards");
  fs.mkdirSync(standardsDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(standardsDir, name), content, "utf8");
  }
  tmpRoots.push(factoryRoot);
  return factoryRoot;
}

afterEach(() => {
  for (const d of tmpRoots) {
    fs.rmSync(d, { recursive: true, force: true });
  }
  tmpRoots = [];
  delete process.env.PANDACORP_FACTORY_ROOT;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Fixture file content
// ---------------------------------------------------------------------------

/** Standard WITH full frontmatter (option A) */
const WITH_FRONTMATTER = `---
domain: Quality
severity: MUST
enforcement: CI
summary:
  - Run tests before every commit
  - Aim for >=80% coverage on business logic
  - Use mutation testing at FRD milestones
---
# Quality and testing

Some body text here.

- First bullet point
- Second bullet point
`;

/** Standard WITHOUT frontmatter but WITH inline marker (known to derivation map) */
const WITHOUT_FRONTMATTER_MAPPED = `# Web security (headers / CSP)

> Domain: Security · Severity: **MUST** (web). Enforcement: CI gate.

Detailed body follows here.

- Harden all HTTP response headers
- Use CSP nonces for inline scripts
`;

/** Standard WITHOUT frontmatter, NOT in derivation map */
const WITHOUT_FRONTMATTER_UNMAPPED = `# Brand new experimental standard

This is something completely new with no map entry.

First paragraph text here.
`;

/** Standard with frontmatter but missing some optional fields */
const PARTIAL_FRONTMATTER = `---
domain: Architecture
severity: SHOULD
---
# Architecture patterns

First paragraph.

- Use hexagonal architecture
- Keep the data layer isolated
`;

/** Standard with body that has a lead paragraph but no bullet list */
const NO_BULLETS = `---
domain: Security
severity: MUST
enforcement: human gate
---
# Security standard

This is the lead paragraph that should become the summary. It spans
multiple lines in the body.

## Section header

More content here.
`;

// ---------------------------------------------------------------------------
// AC-07-004.1 — one entry per *.md, excluding README.md
// ---------------------------------------------------------------------------

describe("AC-07-004.1 — returns one entry per standard file, excluding README.md", () => {
  it("returns an empty array when standards dir does not exist", () => {
    const factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-standards-empty-"));
    tmpRoots.push(factoryRoot);
    // No factory/standards dir created
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result).toEqual([]);
  });

  it("skips README.md and returns entries for all other .md files", () => {
    const factoryRoot = makeFactoryRoot({
      "README.md": "# Standards README\n\nIgnore me.\n",
      "quality.md": WITH_FRONTMATTER,
      "web-security.md": WITHOUT_FRONTMATTER_MAPPED,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    const ids = result.map((s) => s.id);
    expect(ids).not.toContain("README.md");
    expect(ids).toContain("quality.md");
    expect(ids).toContain("web-security.md");
    expect(result).toHaveLength(2);
  });

  it("returns the correct shape for each entry (all required fields present)", () => {
    const factoryRoot = makeFactoryRoot({
      "quality.md": WITH_FRONTMATTER,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result).toHaveLength(1);
    const s = result[0] as Standard;
    expect(s).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      body: expect.any(String),
      domain: expect.any(String),
      severity: expect.any(String),
      enforcement: expect.any(String),
      summary: expect.any(Array),
    });
  });

  it("id is the filename (e.g. 'quality.md')", () => {
    const factoryRoot = makeFactoryRoot({
      "quality.md": WITH_FRONTMATTER,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result[0]?.id).toBe("quality.md");
  });

  it("title is extracted from the H1 heading", () => {
    const factoryRoot = makeFactoryRoot({
      "quality.md": WITH_FRONTMATTER,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result[0]?.title).toBe("Quality and testing");
  });

  it("body contains the markdown content", () => {
    const factoryRoot = makeFactoryRoot({
      "quality.md": WITH_FRONTMATTER,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result[0]?.body).toContain("Quality and testing");
    expect(result[0]?.body).toContain("Some body text here");
  });

  it("reflects added files automatically (dynamic, no static catalog)", () => {
    const factoryRoot = makeFactoryRoot({
      "quality.md": WITH_FRONTMATTER,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    // Add a new file after initial setup
    fs.writeFileSync(
      path.join(factoryRoot, "factory", "standards", "new-standard.md"),
      "# New standard\n\nNew body.\n",
      "utf8",
    );
    const result = readStandards();
    const ids = result.map((s) => s.id);
    expect(ids).toContain("quality.md");
    expect(ids).toContain("new-standard.md");
  });
});

// ---------------------------------------------------------------------------
// AC-07-004.2 — frontmatter values used verbatim (option A)
// ---------------------------------------------------------------------------

describe("AC-07-004.2 — frontmatter values used verbatim when present", () => {
  it("uses domain from frontmatter", () => {
    const factoryRoot = makeFactoryRoot({ "quality.md": WITH_FRONTMATTER });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result[0]?.domain).toBe("Quality");
  });

  it("uses severity from frontmatter", () => {
    const factoryRoot = makeFactoryRoot({ "quality.md": WITH_FRONTMATTER });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result[0]?.severity).toBe("MUST");
  });

  it("uses enforcement from frontmatter", () => {
    const factoryRoot = makeFactoryRoot({ "quality.md": WITH_FRONTMATTER });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result[0]?.enforcement).toBe("CI");
  });

  it("uses summary array from frontmatter verbatim", () => {
    const factoryRoot = makeFactoryRoot({ "quality.md": WITH_FRONTMATTER });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result[0]?.summary).toEqual([
      "Run tests before every commit",
      "Aim for >=80% coverage on business logic",
      "Use mutation testing at FRD milestones",
    ]);
  });

  it("handles partial frontmatter — missing enforcement falls back gracefully", () => {
    const factoryRoot = makeFactoryRoot({ "patterns.md": PARTIAL_FRONTMATTER });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result[0]?.domain).toBe("Architecture");
    expect(result[0]?.severity).toBe("SHOULD");
    // enforcement is missing from frontmatter → should get a fallback value (not crash)
    expect(typeof result[0]?.enforcement).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// AC-07-004.3 — derivation-map fallback when frontmatter absent
// ---------------------------------------------------------------------------

describe("AC-07-004.3 — derivation-map fallback when frontmatter absent", () => {
  it("uses derivation map for a known file (web-security.md → Security)", () => {
    const factoryRoot = makeFactoryRoot({
      "web-security.md": WITHOUT_FRONTMATTER_MAPPED,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result[0]?.domain).toBe("Security");
  });

  it("uses derivation map severity for a known file (web-security.md → MUST)", () => {
    const factoryRoot = makeFactoryRoot({
      "web-security.md": WITHOUT_FRONTMATTER_MAPPED,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result[0]?.severity).toBe("MUST");
  });

  it("uses derivation map enforcement for a known file (web-security.md → CI)", () => {
    const factoryRoot = makeFactoryRoot({
      "web-security.md": WITHOUT_FRONTMATTER_MAPPED,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result[0]?.enforcement).toMatch(/CI|checklist/);
  });

  it("unmapped file gets default domain 'Other'", () => {
    const factoryRoot = makeFactoryRoot({
      "brand-new.md": WITHOUT_FRONTMATTER_UNMAPPED,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = readStandards();
    expect(result[0]?.domain).toBe("Other");
    warnSpy.mockRestore();
  });

  it("unmapped file gets default severity 'SHOULD'", () => {
    const factoryRoot = makeFactoryRoot({
      "brand-new.md": WITHOUT_FRONTMATTER_UNMAPPED,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = readStandards();
    expect(result[0]?.severity).toBe("SHOULD");
    warnSpy.mockRestore();
  });

  it("unmapped file gets default enforcement 'checklist'", () => {
    const factoryRoot = makeFactoryRoot({
      "brand-new.md": WITHOUT_FRONTMATTER_UNMAPPED,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = readStandards();
    expect(result[0]?.enforcement).toBe("checklist");
    warnSpy.mockRestore();
  });

  it("unmapped file emits a typed warning (console.warn)", () => {
    const factoryRoot = makeFactoryRoot({
      "brand-new.md": WITHOUT_FRONTMATTER_UNMAPPED,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    readStandards();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("brand-new.md"));
    warnSpy.mockRestore();
  });

  it("never crashes on unmapped file", () => {
    const factoryRoot = makeFactoryRoot({
      "brand-new.md": WITHOUT_FRONTMATTER_UNMAPPED,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => readStandards()).not.toThrow();
    warnSpy.mockRestore();
  });

  it("maps known files for all real factory/standards files in the derivation map", () => {
    // Test multiple known files
    const factoryRoot = makeFactoryRoot({
      "conventions.md": "# Code conventions\n\nSome body.\n",
      "documentation.md": "# Living documentation\n\nSome body.\n",
      "quality.md": "# Quality and testing\n\nSome body.\n",
      "patterns.md": "# Implementation patterns\n\nSome body.\n",
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = readStandards();
    // All known files should have non-"Other" domains
    for (const s of result) {
      expect(s.domain).not.toBe("Other");
    }
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// AC-07-004.4 — summary defaults to first bullet list or lead paragraph
// ---------------------------------------------------------------------------

describe("AC-07-004.4 — summary defaults to body's first bullet list or lead paragraph", () => {
  it("derives summary from the first bullet list when no frontmatter summary", () => {
    // web-security.md has no frontmatter and has a bullet list
    const factoryRoot = makeFactoryRoot({
      "web-security.md": WITHOUT_FRONTMATTER_MAPPED,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result[0]?.summary).toBeInstanceOf(Array);
    expect(result[0]?.summary.length).toBeGreaterThan(0);
    // Should include the bullet items
    expect(
      result[0]?.summary.some((s) => s.includes("HTTP response headers") || s.includes("Harden")),
    ).toBe(true);
  });

  it("derives summary from lead paragraph when no bullet list exists", () => {
    const factoryRoot = makeFactoryRoot({
      "brand-new.md": WITHOUT_FRONTMATTER_UNMAPPED,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = readStandards();
    expect(result[0]?.summary).toBeInstanceOf(Array);
    expect(result[0]?.summary.length).toBeGreaterThan(0);
    // Should include content from the lead paragraph
    expect(result[0]?.summary[0]).toBeTruthy();
    warnSpy.mockRestore();
  });

  it("uses frontmatter summary verbatim even when body has bullets", () => {
    const factoryRoot = makeFactoryRoot({ "quality.md": WITH_FRONTMATTER });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    // The frontmatter explicitly lists 3 items; body has different items
    expect(result[0]?.summary).toHaveLength(3);
    expect(result[0]?.summary[0]).toBe("Run tests before every commit");
  });

  it("summary is always an array (never undefined or null)", () => {
    const factoryRoot = makeFactoryRoot({
      "quality.md": WITH_FRONTMATTER,
      "web-security.md": WITHOUT_FRONTMATTER_MAPPED,
      "brand-new.md": WITHOUT_FRONTMATTER_UNMAPPED,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = readStandards();
    for (const s of result) {
      expect(Array.isArray(s.summary)).toBe(true);
    }
    warnSpy.mockRestore();
  });

  it("summary items are non-empty strings", () => {
    const factoryRoot = makeFactoryRoot({ "quality.md": WITH_FRONTMATTER });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    for (const item of result[0]?.summary ?? []) {
      expect(typeof item).toBe("string");
      expect(item.trim().length).toBeGreaterThan(0);
    }
  });

  it("summary from NO_BULLETS standard uses lead paragraph", () => {
    const factoryRoot = makeFactoryRoot({ "security.md": NO_BULLETS });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result[0]?.summary).toBeInstanceOf(Array);
    expect(result[0]?.summary.length).toBeGreaterThan(0);
    // Should contain the lead paragraph text
    expect(result[0]?.summary.join(" ")).toContain("lead paragraph");
  });
});

// ---------------------------------------------------------------------------
// AC-07-004.5 — uses resolveFactoryRoot(); fixture testing; dynamic discovery
// ---------------------------------------------------------------------------

describe("AC-07-004.5 — uses resolveFactoryRoot(); fixture testing via PANDACORP_FACTORY_ROOT", () => {
  it("reads from the env-overridden factory root", () => {
    const factoryRoot = makeFactoryRoot({
      "quality.md": WITH_FRONTMATTER,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("quality.md");
  });

  it("does NOT include the real factory/standards when using fixture root", () => {
    const factoryRoot = makeFactoryRoot({
      "fixture-only.md": "# Fixture only\n\nOnly in fixture.\n",
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = readStandards();
    const ids = result.map((s) => s.id);
    expect(ids).toContain("fixture-only.md");
    expect(ids).not.toContain("quality.md"); // real factory file
    expect(ids).not.toContain("conventions.md"); // real factory file
    warnSpy.mockRestore();
  });

  it("returns [] when PANDACORP_FACTORY_ROOT points to a factory with no standards dir", () => {
    const factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-standards-empty-"));
    tmpRoots.push(factoryRoot);
    // Deliberately do NOT create factory/standards/
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result).toEqual([]);
  });

  it("handles a factory with only README.md in standards dir", () => {
    const factoryRoot = makeFactoryRoot({
      "README.md": "# Standards README\n\nIgnored.\n",
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    expect(result).toEqual([]);
  });

  it("reflects a renamed file automatically (re-reads directory each call)", () => {
    const factoryRoot = makeFactoryRoot({
      "quality.md": WITH_FRONTMATTER,
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const beforeRename = readStandards().map((s) => s.id);
    expect(beforeRename).toContain("quality.md");

    // Rename the file
    fs.renameSync(
      path.join(factoryRoot, "factory", "standards", "quality.md"),
      path.join(factoryRoot, "factory", "standards", "quality-renamed.md"),
    );
    const afterRename = readStandards().map((s) => s.id);
    expect(afterRename).not.toContain("quality.md");
    expect(afterRename).toContain("quality-renamed.md");
  });
});

// ---------------------------------------------------------------------------
// Tolerance / edge cases
// ---------------------------------------------------------------------------

describe("edge cases — tolerance + no crash", () => {
  it("tolerates a file with no H1 heading (title falls back gracefully)", () => {
    const factoryRoot = makeFactoryRoot({
      "no-heading.md": "No heading here. Just plain text.\n",
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => readStandards()).not.toThrow();
    const result = readStandards();
    expect(result[0]?.title).toBeTruthy(); // some fallback
    warnSpy.mockRestore();
  });

  it("tolerates an empty file without crashing", () => {
    const factoryRoot = makeFactoryRoot({
      "empty.md": "",
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => readStandards()).not.toThrow();
    warnSpy.mockRestore();
  });

  it("tolerates malformed frontmatter YAML without crashing", () => {
    const factoryRoot = makeFactoryRoot({
      "malformed.md": "---\ndomain: [\nunclosed bracket\n---\n# Malformed\n\nBody.\n",
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => readStandards()).not.toThrow();
    warnSpy.mockRestore();
  });

  it("still returns valid standards when one file is malformed", () => {
    const factoryRoot = makeFactoryRoot({
      "quality.md": WITH_FRONTMATTER,
      "malformed.md": "---\ndomain: [\nunclosed\n---\n# Malformed\n\nBody.\n",
    });
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = readStandards();
    // quality.md should still come through; malformed may be skipped or have defaults
    const ids = result.map((s) => s.id);
    expect(ids).toContain("quality.md");
    warnSpy.mockRestore();
  });

  it("handles non-.md files in the standards dir by ignoring them", () => {
    const factoryRoot = makeFactoryRoot({
      "quality.md": WITH_FRONTMATTER,
    });
    // Add a non-.md file
    fs.writeFileSync(
      path.join(factoryRoot, "factory", "standards", "notes.txt"),
      "some notes",
      "utf8",
    );
    process.env.PANDACORP_FACTORY_ROOT = factoryRoot;
    const result = readStandards();
    const ids = result.map((s) => s.id);
    expect(ids).not.toContain("notes.txt");
    expect(ids).toContain("quality.md");
  });
});
