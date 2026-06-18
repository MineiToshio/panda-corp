/**
 * WO-04-001 — `lib/docs.ts`: listProjectDocs + readDoc — RED phase
 *
 * Tests are written BEFORE the implementation of IF-04-docs.
 * `listProjectDocs` and `readDoc` do NOT yet exist in lib/docs.ts; every
 * test here will fail (RED) until the GREEN phase.  That is the intent.
 *
 * Traceability:
 *   AC-04-006.1  The Documents tab SHALL render the feature-centric document
 *                tree (nav) from `lib/docs.ts`. → listProjectDocs tests.
 *   AC-04-006.2  WHEN a document is selected, the Documents tab SHALL render
 *                its markdown body; the first available document is selected
 *                by default. → readDoc happy-path + ordering tests.
 *   AC-04-006.3  WHEN the project has no readable documents, the Documents
 *                tab SHALL show a graceful empty state. → empty project tests.
 *   WO-04-001 §Scope: readDoc validates against the discovered set — no
 *                arbitrary path traversal (security / no-traversal tests).
 *
 * Regression anchors (real bugs from .pandacorp/comms/progress.md):
 *   B1' (2026-06-16, motion.duration NaN): discovery counts must be finite
 *     integers; listProjectDocs must never return a list where .length is NaN.
 *   I2 (2026-06-16, vacuous-truth on empty collection): an FRD dir with only
 *     frd.md must NOT produce a vacuously-truthy node for blueprint.md.
 *   I3 (2026-06-16, array-shaped objects): the return of listProjectDocs must
 *     be a genuine JS Array, not an array-like object.
 *   WO-15-001 SHA-hygiene (2026-06-16): readDoc result must be a plain string,
 *     never undefined/null for a surfaced path, never trimmed silently with
 *     NaN-length. Content returned must be the actual file content.
 *   WO-01-001 (2026-06-16): pathExists must be used (or equivalent) so
 *     non-existent paths never cause an ENOENT crash from inside readDoc.
 *
 * Stack: Vitest (no mocks — pure fs reads against fixture trees + temp dirs).
 * No writes anywhere. Temp dirs cleaned up in finally{}.
 *
 * --- IF-04-docs contract (blueprint §2, IF-04-docs) -------------------------
 *
 * export interface DocNode {
 *   id: string;      // stable key, unique per project. e.g. "product/prd"
 *   label: string;   // display name (filename), e.g. "prd.md"
 *   group: string;   // "Product" | "Feature: frd-NN-<slug>" | "Global"
 *   relPath: string; // path relative to project root, forward slashes
 * }
 * export function docs(projectPath: string): DocNode[];
 * export function read(projectPath: string, relPath: string): string | null;
 *
 * Groups (architecture §4.5):
 *   "Product"               — docs/product/prd.md, docs/product/architecture.md
 *   "Feature: frd-NN-slug" — docs/frds/frd-NN-<slug>/{frd.md, fdd.md?, blueprint.md?}
 *   "Global"               — docs/adr/*.md, docs/decision-log.md
 *
 * Security rule: readDoc only accepts relPaths surfaced by listProjectDocs.
 *   Any other relPath → null (no traversal, no ENOENT, no exception).
 * ---------------------------------------------------------------------------
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURE_FULL } from "@/tests/fixtures/index";
import { listProjectDocs, readDoc } from "./docs";

// ---------------------------------------------------------------------------
// Local type mirror — mirrors the IF-04-docs contract.
// Kept here so these tests describe the expected shape without depending on
// the production type (which does not exist yet in the RED phase).
// ---------------------------------------------------------------------------
type DocNode = {
  id: string;
  label: string;
  group: string;
  relPath: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** proj-a absolute path (full docs tree in the fixture). */
const PROJ_A = path.join(FIXTURE_FULL, "projects", "proj-a");

/**
 * Create a minimal temporary project tree.
 * Returned dir is an absolute path; clean up with fs.rmSync(dir, {recursive:true, force:true}).
 */
function makeTempProject(setup?: (root: string) => void): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-docs-wo04001-"));
  if (setup) setup(dir);
  return dir;
}

/**
 * Typed wrapper for listProjectDocs.
 * In the RED phase, listProjectDocs does not exist in docs.ts yet; the cast
 * lets TypeScript compile the tests so they can be run (and fail RED) without
 * type-level noise from a missing export. Same pattern as docs.test.ts's
 * `readProjectDocs(x) as ProjectDocsIndex`.
 */
function docs(projectPath: string): DocNode[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (listProjectDocs as (p: string) => DocNode[])(projectPath);
}

/**
 * Typed wrapper for readDoc.
 * Same rationale as `docs()` above.
 */
function read(projectPath: string, relPath: string): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (readDoc as (p: string, r: string) => string | null)(projectPath, relPath);
}

// ---------------------------------------------------------------------------
// AC-04-006.1 — listProjectDocs: Product group
// ---------------------------------------------------------------------------

describe("frd-04: listProjectDocs — AC-04-006.1 Product group (proj-a)", () => {
  it("frd-04: AC-04-006.1 — WHEN prd.md exists THEN a DocNode with group='Product' and label='prd.md' is returned", () => {
    const nodes = docs(PROJ_A);
    const prdNode = nodes.find((n) => n.label === "prd.md");
    expect(prdNode).toBeDefined();
    expect(prdNode?.group).toBe("Product");
  });

  it("frd-04: AC-04-006.1 — WHEN architecture.md exists THEN a DocNode with group='Product' and label='architecture.md' is returned", () => {
    const nodes = docs(PROJ_A);
    const archNode = nodes.find((n) => n.label === "architecture.md");
    expect(archNode).toBeDefined();
    expect(archNode?.group).toBe("Product");
  });

  it("frd-04: AC-04-006.1 — WHEN prd.md exists THEN its DocNode.relPath starts with 'docs/product/'", () => {
    const nodes = docs(PROJ_A);
    const prdNode = nodes.find((n) => n.label === "prd.md");
    expect(prdNode?.relPath).toMatch(/^docs\/product\//);
  });

  it("frd-04: AC-04-006.1 — WHEN architecture.md exists THEN its DocNode.relPath starts with 'docs/product/'", () => {
    const nodes = docs(PROJ_A);
    const archNode = nodes.find((n) => n.label === "architecture.md");
    expect(archNode?.relPath).toMatch(/^docs\/product\//);
  });

  it("frd-04: AC-04-006.1 — WHEN prd.md exists THEN its DocNode.id is a non-empty string (stable key)", () => {
    const nodes = docs(PROJ_A);
    const prdNode = nodes.find((n) => n.label === "prd.md");
    expect(typeof prdNode?.id).toBe("string");
    expect((prdNode?.id ?? "").length).toBeGreaterThan(0);
  });

  it("frd-04: AC-04-006.1 — WHEN prd.md is absent THEN no Product/prd.md DocNode is returned", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs", "product"), { recursive: true });
      fs.writeFileSync(path.join(root, "docs", "product", "architecture.md"), "# Arch\n");
      // No prd.md
    });
    try {
      const nodes = docs(dir);
      const prdNode = nodes.find((n) => n.label === "prd.md");
      expect(prdNode).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-006.1 — WHEN architecture.md is absent THEN no Product/architecture.md DocNode is returned", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs", "product"), { recursive: true });
      fs.writeFileSync(path.join(root, "docs", "product", "prd.md"), "# PRD\n");
      // No architecture.md
    });
    try {
      const nodes = docs(dir);
      const archNode = nodes.find((n) => n.label === "architecture.md");
      expect(archNode).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC-04-006.1 — listProjectDocs: Feature group (per-FRD)
// ---------------------------------------------------------------------------

describe("frd-04: listProjectDocs — AC-04-006.1 Feature group (proj-a has frd-01-x)", () => {
  it("frd-04: AC-04-006.1 — WHEN frd-01-x has frd.md THEN a DocNode with group='Feature: frd-01-x' and label='frd.md' is returned", () => {
    const nodes = docs(PROJ_A);
    const frdNode = nodes.find((n) => n.group === "Feature: frd-01-x" && n.label === "frd.md");
    expect(frdNode).toBeDefined();
  });

  it("frd-04: AC-04-006.1 — WHEN frd-01-x has blueprint.md THEN a DocNode with group='Feature: frd-01-x' and label='blueprint.md' is returned", () => {
    const nodes = docs(PROJ_A);
    const bpNode = nodes.find((n) => n.group === "Feature: frd-01-x" && n.label === "blueprint.md");
    expect(bpNode).toBeDefined();
  });

  it("frd-04: AC-04-006.1 — WHEN frd-01-x has frd.md THEN its DocNode.relPath starts with 'docs/frds/frd-01-x/'", () => {
    const nodes = docs(PROJ_A);
    const frdNode = nodes.find((n) => n.group === "Feature: frd-01-x" && n.label === "frd.md");
    expect(frdNode?.relPath).toMatch(/^docs\/frds\/frd-01-x\//);
  });

  it("frd-04: AC-04-006.1 — WHEN an FRD directory has NO fdd.md THEN no DocNode with label='fdd.md' in that feature group is returned", () => {
    // proj-a's frd-01-x has no fdd.md in the fixture tree.
    const nodes = docs(PROJ_A);
    const fddNode = nodes.find((n) => n.group === "Feature: frd-01-x" && n.label === "fdd.md");
    expect(fddNode).toBeUndefined();
  });

  it("frd-04: AC-04-006.1 — WHEN an FRD directory has fdd.md THEN a DocNode with that label is returned", () => {
    const dir = makeTempProject((root) => {
      const frdDir = path.join(root, "docs", "frds", "frd-02-with-fdd");
      fs.mkdirSync(frdDir, { recursive: true });
      fs.writeFileSync(path.join(frdDir, "frd.md"), "# FRD-02\n");
      fs.writeFileSync(path.join(frdDir, "fdd.md"), "# FDD-02\n");
    });
    try {
      const nodes = docs(dir);
      const fddNode = nodes.find(
        (n) => n.group === "Feature: frd-02-with-fdd" && n.label === "fdd.md",
      );
      expect(fddNode).toBeDefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-006.1 — WHEN docs/frds/ contains dirs not matching /^frd-\\d/ THEN no DocNode with those groups is returned", () => {
    const dir = makeTempProject((root) => {
      const frdsDir = path.join(root, "docs", "frds");
      fs.mkdirSync(path.join(frdsDir, "shared"), { recursive: true });
      fs.mkdirSync(path.join(frdsDir, "README"), { recursive: true });
      fs.writeFileSync(path.join(frdsDir, "shared", "types.md"), "# Types\n");
    });
    try {
      const nodes = docs(dir);
      const badGroup = nodes.find(
        (n) => n.group === "Feature: shared" || n.group === "Feature: README",
      );
      expect(badGroup).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-006.1 — WHEN multiple FRDs exist THEN each has its own 'Feature: slug' group", () => {
    const dir = makeTempProject((root) => {
      for (const slug of ["frd-01-alpha", "frd-02-beta"]) {
        const frdDir = path.join(root, "docs", "frds", slug);
        fs.mkdirSync(frdDir, { recursive: true });
        fs.writeFileSync(path.join(frdDir, "frd.md"), `# ${slug}\n`);
      }
    });
    try {
      const nodes = docs(dir);
      const groups = [...new Set(nodes.map((n) => n.group))];
      expect(groups).toContain("Feature: frd-01-alpha");
      expect(groups).toContain("Feature: frd-02-beta");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC-04-006.1 — listProjectDocs: Global group (adr, decision-log)
// ---------------------------------------------------------------------------

describe("frd-04: listProjectDocs — AC-04-006.1 Global group (proj-a)", () => {
  it("frd-04: AC-04-006.1 — WHEN docs/adr/*.md files exist THEN DocNodes with group='Global' are returned for each", () => {
    const nodes = docs(PROJ_A);
    const adrNodes = nodes.filter((n) => n.group === "Global" && n.relPath.startsWith("docs/adr/"));
    expect(adrNodes.length).toBeGreaterThan(0);
  });

  it("frd-04: AC-04-006.1 — WHEN docs/decision-log.md exists THEN a DocNode with group='Global' and label='decision-log.md' is returned", () => {
    const nodes = docs(PROJ_A);
    const dlNode = nodes.find((n) => n.group === "Global" && n.label === "decision-log.md");
    expect(dlNode).toBeDefined();
  });

  it("frd-04: AC-04-006.1 — WHEN docs/adr/ file exists THEN its DocNode.relPath starts with 'docs/adr/'", () => {
    const nodes = docs(PROJ_A);
    const adrNode = nodes.find((n) => n.group === "Global" && n.relPath.startsWith("docs/adr/"));
    expect(adrNode?.relPath).toMatch(/^docs\/adr\//);
  });

  it("frd-04: AC-04-006.1 — WHEN docs/decision-log.md exists THEN its DocNode.relPath is 'docs/decision-log.md'", () => {
    const nodes = docs(PROJ_A);
    const dlNode = nodes.find((n) => n.group === "Global" && n.label === "decision-log.md");
    expect(dlNode?.relPath).toBe("docs/decision-log.md");
  });

  it("frd-04: AC-04-006.1 — WHEN docs/adr/ is absent THEN no Global/adr DocNode is returned", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs"), { recursive: true });
      // No adr dir
    });
    try {
      const nodes = docs(dir);
      const adrNodes = nodes.filter(
        (n) => n.group === "Global" && n.relPath.startsWith("docs/adr/"),
      );
      expect(adrNodes).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-006.1 — WHEN docs/decision-log.md is absent THEN no Global/decision-log.md DocNode is returned", () => {
    const dir = makeTempProject();
    try {
      const nodes = docs(dir);
      const dlNode = nodes.find((n) => n.group === "Global" && n.label === "decision-log.md");
      expect(dlNode).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC-04-006.1 — listProjectDocs: DocNode shape invariants (all groups)
// ---------------------------------------------------------------------------

describe("frd-04: listProjectDocs — AC-04-006.1 DocNode shape invariants", () => {
  it("frd-04: AC-04-006.1 — WHEN called on proj-a THEN every DocNode has non-empty string id, label, group, relPath", () => {
    const nodes = docs(PROJ_A);
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      expect(typeof node.id).toBe("string");
      expect(node.id.length).toBeGreaterThan(0);
      expect(typeof node.label).toBe("string");
      expect(node.label.length).toBeGreaterThan(0);
      expect(typeof node.group).toBe("string");
      expect(node.group.length).toBeGreaterThan(0);
      expect(typeof node.relPath).toBe("string");
      expect(node.relPath.length).toBeGreaterThan(0);
    }
  });

  it("frd-04: AC-04-006.1 — WHEN called on proj-a THEN all DocNode ids are unique (stable key invariant)", () => {
    const nodes = docs(PROJ_A);
    const ids = nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("frd-04: AC-04-006.1 — WHEN called on proj-a THEN all DocNode relPaths use forward slashes (not backslashes)", () => {
    const nodes = docs(PROJ_A);
    for (const node of nodes) {
      expect(node.relPath).not.toContain("\\");
    }
  });

  it("frd-04: AC-04-006.1 — WHEN called on proj-a THEN no DocNode relPath is absolute (must be relative)", () => {
    const nodes = docs(PROJ_A);
    for (const node of nodes) {
      expect(path.isAbsolute(node.relPath)).toBe(false);
    }
  });

  it("frd-04: AC-04-006.1 — WHEN called on proj-a THEN no DocNode relPath starts with '../' (no traversal out)", () => {
    const nodes = docs(PROJ_A);
    for (const node of nodes) {
      expect(node.relPath.startsWith("../")).toBe(false);
    }
  });

  it("frd-04: AC-04-006.1 — WHEN called on proj-a THEN each DocNode.group is one of 'Product', 'Feature: *', or 'Global'", () => {
    const nodes = docs(PROJ_A);
    for (const node of nodes) {
      const valid =
        node.group === "Product" || node.group.startsWith("Feature: ") || node.group === "Global";
      expect(valid).toBe(true);
    }
  });

  it("frd-04: AC-04-006.1 — WHEN called on proj-a THEN the result is a genuine JS Array (regression I3)", () => {
    const result = docs(PROJ_A);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-04-006.1 — listProjectDocs: calling twice returns stable IDs (idempotency)
// ---------------------------------------------------------------------------

describe("frd-04: listProjectDocs — AC-04-006.1 stable IDs across calls", () => {
  it("frd-04: AC-04-006.1 — WHEN called twice on the same project THEN the id of each node is identical both times", () => {
    const first = docs(PROJ_A);
    const second = docs(PROJ_A);
    const firstById = new Map(first.map((n) => [n.relPath, n.id]));
    for (const node of second) {
      expect(firstById.get(node.relPath)).toBe(node.id);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-04-006.3 — listProjectDocs: empty/absent docs → [] never throws
// ---------------------------------------------------------------------------

describe("frd-04: listProjectDocs — AC-04-006.3 graceful empty state", () => {
  it("frd-04: AC-04-006.3 — WHEN the project root does not exist THEN listProjectDocs does NOT throw", () => {
    expect(() => docs("/nonexistent/project/path/wo04001-probe")).not.toThrow();
  });

  it("frd-04: AC-04-006.3 — WHEN the project root does not exist THEN listProjectDocs returns an empty array", () => {
    const result = docs("/nonexistent/project/path/wo04001-probe");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("frd-04: AC-04-006.3 — WHEN the project root is empty THEN listProjectDocs returns an empty array", () => {
    const dir = makeTempProject();
    try {
      const result = docs(dir);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-006.3 — WHEN docs/ is present but empty THEN listProjectDocs returns an empty array without throwing", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs"), { recursive: true });
    });
    try {
      expect(() => docs(dir)).not.toThrow();
      expect(docs(dir)).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: AC-04-006.3 — WHEN an empty string is passed THEN listProjectDocs does NOT throw", () => {
    expect(() => docs("")).not.toThrow();
  });

  it("frd-04: AC-04-006.3 — WHEN an empty string is passed THEN listProjectDocs returns an empty array", () => {
    const result = docs("");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Regression B1' (2026-06-16): discovery counts must never be NaN.
// ---------------------------------------------------------------------------

describe("frd-04: listProjectDocs — regression B1': length must be a finite integer, never NaN", () => {
  it("frd-04: B1' — WHEN docs/frds/ has no matching dirs THEN result.length is 0 (finite, not NaN)", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs", "frds"), { recursive: true });
    });
    try {
      const result = docs(dir);
      expect(Number.isFinite(result.length)).toBe(true);
      expect(result.length).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: B1' — WHEN docs/adr/ is empty THEN no NaN count leaks (result.length is a finite integer)", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs", "adr"), { recursive: true });
    });
    try {
      const result = docs(dir);
      expect(Number.isFinite(result.length)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Regression I2 (2026-06-16): an empty FRD dir must not produce vacuous nodes.
// An FRD dir with only frd.md must not surface a blueprint.md node.
// ---------------------------------------------------------------------------

describe("frd-04: listProjectDocs — regression I2: no vacuous-truthy nodes for absent files", () => {
  it("frd-04: I2 — WHEN an FRD dir has only frd.md THEN no blueprint.md node is returned for that group", () => {
    const dir = makeTempProject((root) => {
      const frdDir = path.join(root, "docs", "frds", "frd-01-minimal");
      fs.mkdirSync(frdDir, { recursive: true });
      fs.writeFileSync(path.join(frdDir, "frd.md"), "# FRD-01\n");
      // No blueprint.md, no fdd.md
    });
    try {
      const nodes = docs(dir);
      const bpNode = nodes.find(
        (n) => n.group === "Feature: frd-01-minimal" && n.label === "blueprint.md",
      );
      expect(bpNode).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: I2 — WHEN an FRD dir has only frd.md THEN no fdd.md node is returned for that group", () => {
    const dir = makeTempProject((root) => {
      const frdDir = path.join(root, "docs", "frds", "frd-02-minimal");
      fs.mkdirSync(frdDir, { recursive: true });
      fs.writeFileSync(path.join(frdDir, "frd.md"), "# FRD-02\n");
    });
    try {
      const nodes = docs(dir);
      const fddNode = nodes.find(
        (n) => n.group === "Feature: frd-02-minimal" && n.label === "fdd.md",
      );
      expect(fddNode).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("frd-04: I2 — WHEN docs/adr/ is empty THEN no Global/adr DocNode is returned (no vacuous enumeration)", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs", "adr"), { recursive: true });
      // No .md files inside
    });
    try {
      const nodes = docs(dir);
      const adrNodes = nodes.filter(
        (n) => n.group === "Global" && n.relPath.startsWith("docs/adr/"),
      );
      expect(adrNodes).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC-04-006.2 — readDoc: happy path (returns raw markdown of a surfaced node)
// ---------------------------------------------------------------------------

describe("frd-04: readDoc — AC-04-006.2 WHEN a document is selected THEN raw markdown is returned", () => {
  it("frd-04: AC-04-006.2 — WHEN prd.md is surfaced THEN readDoc returns its full string content", () => {
    const nodes = docs(PROJ_A);
    const prdNode = nodes.find((n) => n.label === "prd.md");
    expect(prdNode).toBeDefined();
    const content = read(PROJ_A, prdNode?.relPath ?? "");
    expect(typeof content).toBe("string");
    expect(content).not.toBeNull();
    expect((content ?? "").length).toBeGreaterThan(0);
  });

  it("frd-04: AC-04-006.2 — WHEN prd.md is read THEN content matches the actual file content", () => {
    const nodes = docs(PROJ_A);
    const prdNode = nodes.find((n) => n.label === "prd.md");
    const relPath = prdNode?.relPath ?? "";
    const content = read(PROJ_A, relPath);
    const rawFile = fs.readFileSync(path.join(PROJ_A, relPath), "utf-8");
    expect(content).toBe(rawFile);
  });

  it("frd-04: AC-04-006.2 — WHEN frd.md is surfaced THEN readDoc returns its markdown body (non-empty string)", () => {
    const nodes = docs(PROJ_A);
    const frdNode = nodes.find((n) => n.group === "Feature: frd-01-x" && n.label === "frd.md");
    expect(frdNode).toBeDefined();
    const content = read(PROJ_A, frdNode?.relPath ?? "");
    expect(typeof content).toBe("string");
    expect(content).not.toBeNull();
    expect((content ?? "").trim().length).toBeGreaterThan(0);
  });

  it("frd-04: AC-04-006.2 — WHEN blueprint.md is surfaced THEN readDoc returns its markdown body", () => {
    const nodes = docs(PROJ_A);
    const bpNode = nodes.find((n) => n.group === "Feature: frd-01-x" && n.label === "blueprint.md");
    expect(bpNode).toBeDefined();
    const content = read(PROJ_A, bpNode?.relPath ?? "");
    expect(typeof content).toBe("string");
    expect(content).not.toBeNull();
  });

  it("frd-04: AC-04-006.2 — WHEN an ADR file is surfaced THEN readDoc returns its content", () => {
    const nodes = docs(PROJ_A);
    const adrNode = nodes.find((n) => n.group === "Global" && n.relPath.startsWith("docs/adr/"));
    expect(adrNode).toBeDefined();
    const content = read(PROJ_A, adrNode?.relPath ?? "");
    expect(typeof content).toBe("string");
    expect(content).not.toBeNull();
  });

  it("frd-04: AC-04-006.2 — WHEN decision-log.md is surfaced THEN readDoc returns its content", () => {
    const nodes = docs(PROJ_A);
    const dlNode = nodes.find((n) => n.group === "Global" && n.label === "decision-log.md");
    expect(dlNode).toBeDefined();
    const content = read(PROJ_A, dlNode?.relPath ?? "");
    expect(typeof content).toBe("string");
    expect(content).not.toBeNull();
  });

  it("frd-04: AC-04-006.2 — WHEN the first surfaced node's relPath is passed to readDoc THEN it returns a non-null string (first-doc-selected-by-default invariant)", () => {
    const nodes = docs(PROJ_A);
    // The default selection is the first available document.
    expect(nodes.length).toBeGreaterThan(0);
    const firstNode = nodes[0];
    const content = read(PROJ_A, firstNode?.relPath ?? "");
    expect(content).not.toBeNull();
    expect(typeof content).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Security / no-traversal: readDoc must reject paths not in the discovered set
// ---------------------------------------------------------------------------

describe("frd-04: readDoc — security: WHEN relPath is NOT in the discovered set THEN null is returned (no traversal)", () => {
  it("frd-04: readDoc — WHEN relPath is a file that exists but was NOT surfaced THEN returns null", () => {
    // .pandacorp/comms/progress.md exists in proj-a but is NOT a doc node (it is a comms file).
    const result = read(PROJ_A, ".pandacorp/comms/progress.md");
    expect(result).toBeNull();
  });

  it("frd-04: readDoc — WHEN relPath uses '../' traversal THEN returns null (no directory traversal)", () => {
    const result = read(PROJ_A, "../factory/profile.md");
    expect(result).toBeNull();
  });

  it("frd-04: readDoc — WHEN relPath is an absolute path THEN returns null", () => {
    const result = read(PROJ_A, "/etc/passwd");
    expect(result).toBeNull();
  });

  it("frd-04: readDoc — WHEN relPath is an empty string THEN returns null", () => {
    const result = read(PROJ_A, "");
    expect(result).toBeNull();
  });

  it("frd-04: readDoc — WHEN relPath is an arbitrary invented path that does not exist THEN returns null without throwing", () => {
    expect(() => read(PROJ_A, "docs/frds/frd-99-fake/frd.md")).not.toThrow();
    expect(read(PROJ_A, "docs/frds/frd-99-fake/frd.md")).toBeNull();
  });

  it("frd-04: readDoc — WHEN relPath points to a directory rather than a file (e.g. 'docs/frds/frd-01-x') THEN returns null", () => {
    const result = read(PROJ_A, "docs/frds/frd-01-x");
    expect(result).toBeNull();
  });

  it("frd-04: readDoc — WHEN relPath is a status.yaml file (not a surfaced doc) THEN returns null", () => {
    // status.yaml is NOT a docs node; it is owned by lib/status.ts.
    const result = read(PROJ_A, ".pandacorp/status.yaml");
    expect(result).toBeNull();
  });

  it("frd-04: readDoc — WHEN relPath is a work-orders .md (not a surfaced group) THEN returns null", () => {
    // Work-orders .md files are NOT surfaced by listProjectDocs (that is FRD-05's scope).
    const result = read(PROJ_A, "docs/frds/frd-01-x/work-orders/wo-01-x-001-reader.md");
    expect(result).toBeNull();
  });

  it("frd-04: readDoc — WHEN both projectPath and relPath are empty strings THEN does NOT throw", () => {
    expect(() => read("", "")).not.toThrow();
    expect(read("", "")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readDoc: non-existent projectPath — must not throw (regression WO-01-001)
// ---------------------------------------------------------------------------

describe("frd-04: readDoc — REQ-01-010: non-existent project path", () => {
  it("frd-04: WHEN projectPath does not exist THEN readDoc does NOT throw", () => {
    expect(() =>
      read("/nonexistent/project/path/wo04001-probe", "docs/product/prd.md"),
    ).not.toThrow();
  });

  it("frd-04: WHEN projectPath does not exist THEN readDoc returns null", () => {
    const result = read("/nonexistent/project/path/wo04001-probe", "docs/product/prd.md");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readDoc: read-only invariant — never writes
// ---------------------------------------------------------------------------

describe("frd-04: readDoc — read-only invariant (no writes)", () => {
  it("frd-04: WHEN readDoc is called THEN the mtime of the read file is unchanged", () => {
    const nodes = docs(PROJ_A);
    const prdNode = nodes.find((n) => n.label === "prd.md");
    const relPath = prdNode?.relPath ?? "";
    const absolutePath = path.join(PROJ_A, relPath);
    const before = fs.statSync(absolutePath);
    read(PROJ_A, relPath);
    const after = fs.statSync(absolutePath);
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });

  it("frd-04: WHEN readDoc is called with a non-existent projectPath THEN no file or dir is created", () => {
    const ghostPath = "/tmp/pandacorp-readdoc-ghost-wo04001";
    if (fs.existsSync(ghostPath)) {
      fs.rmSync(ghostPath, { recursive: true, force: true });
    }
    read(ghostPath, "docs/product/prd.md");
    expect(fs.existsSync(ghostPath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listProjectDocs: read-only invariant — never writes
// ---------------------------------------------------------------------------

describe("frd-04: listProjectDocs — read-only invariant (no writes)", () => {
  it("frd-04: WHEN listProjectDocs runs THEN the directory tree is unchanged (snapshot before === after)", () => {
    const dir = makeTempProject((root) => {
      const frdDir = path.join(root, "docs", "frds", "frd-01-x");
      fs.mkdirSync(path.join(frdDir, "mocks"), { recursive: true });
      fs.writeFileSync(path.join(frdDir, "frd.md"), "# FRD\n");
      fs.mkdirSync(path.join(root, "docs", "adr"), { recursive: true });
      fs.writeFileSync(path.join(root, "docs", "adr", "ADR-001.md"), "# ADR\n");
    });
    try {
      const snapshot = (p: string): string[] =>
        fs.readdirSync(p, { recursive: true }).map(String).sort();
      const before = snapshot(dir);
      docs(dir);
      docs(dir);
      const after = snapshot(dir);
      expect(after).toEqual(before);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// AC-04-006.2 — readDoc + listProjectDocs integration: every surfaced relPath
// is readable (round-trip invariant). If listProjectDocs surfaces it, readDoc
// must return non-null for it.
// ---------------------------------------------------------------------------

describe("frd-04: readDoc × listProjectDocs — round-trip: every surfaced node must be readable", () => {
  it("frd-04: AC-04-006.2 — WHEN listProjectDocs returns N nodes for proj-a THEN readDoc returns non-null for every node.relPath", () => {
    const nodes = docs(PROJ_A);
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      const content = read(PROJ_A, node.relPath);
      expect(content).not.toBeNull(); // `not.toBeNull()` gives a precise failure message per node
      expect(typeof content).toBe("string");
    }
  });

  it("frd-04: AC-04-006.2 — WHEN a temp project has 3 FRD docs + 1 ADR + prd THEN all 5 are readable via readDoc", () => {
    const dir = makeTempProject((root) => {
      // Product layer
      fs.mkdirSync(path.join(root, "docs", "product"), { recursive: true });
      fs.writeFileSync(path.join(root, "docs", "product", "prd.md"), "# PRD\nContent here.\n");
      // Feature layer
      const frdDir = path.join(root, "docs", "frds", "frd-01-alpha");
      fs.mkdirSync(frdDir, { recursive: true });
      fs.writeFileSync(path.join(frdDir, "frd.md"), "# FRD-01\n");
      fs.writeFileSync(path.join(frdDir, "blueprint.md"), "# Blueprint\n");
      fs.writeFileSync(path.join(frdDir, "fdd.md"), "# FDD\n");
      // Global layer
      const adrDir = path.join(root, "docs", "adr");
      fs.mkdirSync(adrDir, { recursive: true });
      fs.writeFileSync(path.join(adrDir, "ADR-001.md"), "# ADR-001\n");
    });
    try {
      const nodes = docs(dir);
      expect(nodes.length).toBe(5);
      for (const node of nodes) {
        const content = read(dir, node.relPath);
        expect(content).not.toBeNull();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Serializability: the DocNode[] must survive a JSON round-trip unchanged
// (it is passed to Client Components).
// ---------------------------------------------------------------------------

describe("frd-04: listProjectDocs — serializability (JSON round-trip)", () => {
  it("frd-04: WHEN the result of docs(proj-a) is JSON.stringified and parsed THEN it equals the original", () => {
    const nodes = docs(PROJ_A);
    const round = JSON.parse(JSON.stringify(nodes)) as unknown;
    expect(round).toEqual(nodes);
    expect(Array.isArray(round)).toBe(true);
  });
});
