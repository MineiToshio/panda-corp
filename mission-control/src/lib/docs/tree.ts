// =============================================================================
// IF-04-docs — WO-04-001
// `listProjectDocs` + `readDoc`: feature-centric document tree + raw read.
//
// Traceability: AC-04-006.1 (tree), AC-04-006.2 (body), AC-04-006.3 (empty).
// Security: readDoc validates relPath against the discovered set only (no traversal).
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { pathExists } from "../fs-utils/fs-utils";

// ---------------------------------------------------------------------------
// FRD directory pattern: must start with "frd-" followed by at least one digit.
// e.g. "frd-01-data-reading", "frd-12-observability-dataviz"
// ---------------------------------------------------------------------------

export const FRD_DIR_PATTERN = /^frd-\d/;

/**
 * A single document node in the feature-centric tree.
 *
 * Groups (architecture §4.5):
 *   "Product"              — docs/product/prd.md, docs/product/architecture.md
 *   "Feature: frd-NN-slug" — docs/frds/frd-NN-<slug>/{frd.md, fdd.md?, blueprint.md?}
 *   "Global"               — docs/adr/*.md, docs/decision-log.md
 */
export interface DocNode {
  /** Stable key unique per project, derived from relPath without the extension. */
  id: string;
  /** Display name (filename), e.g. "prd.md". */
  label: string;
  /** Group: "Product" | "Feature: frd-NN-<slug>" | "Global" */
  group: string;
  /** Path relative to the project root, forward-slash separated. */
  relPath: string;
}

/**
 * Discover the feature-centric document tree for a project.
 *
 * Returns a flat list of DocNode entries covering:
 *   - Product layer: docs/product/prd.md, docs/product/architecture.md
 *   - Per-FRD layer: docs/frds/frd-NN-<slug>/{frd.md, fdd.md?, blueprint.md?}
 *   - Global layer: docs/adr/*.md, docs/decision-log.md
 *
 * Fail-soft: absent/unreadable layers → []. Never throws.
 * Read-only: probes existence and reads directory listings only.
 *
 * @param projectPath - Absolute path to the project root.
 * @returns A genuine JS Array of DocNode; empty when no docs are found.
 */
export function listProjectDocs(projectPath: string): DocNode[] {
  // Guard: blank/empty or non-existent path.
  if (!projectPath || projectPath.trim() === "") {
    return [];
  }
  if (!pathExists(projectPath)) {
    return [];
  }

  // Collect nodes across all layers (each helper pushes into the shared array).
  const nodes: DocNode[] = [];
  _collectProductDocs(projectPath, nodes);
  _collectFrdDocs(projectPath, nodes);
  _collectGlobalDocs(projectPath, nodes);
  return nodes;
}

/** Product layer: docs/product/{prd,research,architecture}.md. */
function _collectProductDocs(projectPath: string, nodes: DocNode[]): void {
  const prdPath = path.join(projectPath, "docs", "product", "prd.md");
  if (pathExists(prdPath) && statIsFile(prdPath)) {
    nodes.push(makeDocNode("docs/product/prd.md", "prd.md", "Product"));
  }
  const researchPath = path.join(projectPath, "docs", "product", "research.md");
  if (pathExists(researchPath) && statIsFile(researchPath)) {
    nodes.push(makeDocNode("docs/product/research.md", "research.md", "Product"));
  }
  const archPath = path.join(projectPath, "docs", "product", "architecture.md");
  if (pathExists(archPath) && statIsFile(archPath)) {
    nodes.push(makeDocNode("docs/product/architecture.md", "architecture.md", "Product"));
  }
}

/** Per-FRD layer: docs/frds/frd-NN-<slug>/{frd,fdd,blueprint}.md. Behavior copied verbatim. */
function _collectFrdDocs(projectPath: string, nodes: DocNode[]): void {
  const frdsDir = path.join(projectPath, "docs", "frds");
  if (!pathExists(frdsDir) || !statIsDir(frdsDir)) {
    return;
  }
  let frdEntries: string[] = [];
  try {
    frdEntries = fs.readdirSync(frdsDir);
  } catch {
    frdEntries = [];
  }
  for (const entry of frdEntries) {
    if (!FRD_DIR_PATTERN.test(entry)) {
      continue;
    }
    const frdDir = path.join(frdsDir, entry);
    if (!statIsDir(frdDir)) {
      continue;
    }
    const group = `Feature: ${entry}`;
    // Surface only the three document files (regression I2: only if present).
    for (const docFile of ["frd.md", "fdd.md", "blueprint.md"] as const) {
      const filePath = path.join(frdDir, docFile);
      if (pathExists(filePath) && statIsFile(filePath)) {
        const relPath = `docs/frds/${entry}/${docFile}`;
        nodes.push(makeDocNode(relPath, docFile, group));
      }
    }
  }
}

/** Global layer: docs/adr/*.md + docs/decision-log.md. Behavior copied verbatim. */
function _collectGlobalDocs(projectPath: string, nodes: DocNode[]): void {
  // docs/adr/*.md files
  const adrDir = path.join(projectPath, "docs", "adr");
  if (pathExists(adrDir) && statIsDir(adrDir)) {
    let adrEntries: string[] = [];
    try {
      adrEntries = fs.readdirSync(adrDir);
    } catch {
      adrEntries = [];
    }
    for (const entry of adrEntries) {
      if (!entry.endsWith(".md")) {
        continue;
      }
      const filePath = path.join(adrDir, entry);
      if (!statIsFile(filePath)) {
        continue;
      }
      const relPath = `docs/adr/${entry}`;
      nodes.push(makeDocNode(relPath, entry, "Global"));
    }
  }

  // docs/decision-log.md
  const dlPath = path.join(projectPath, "docs", "decision-log.md");
  if (pathExists(dlPath) && statIsFile(dlPath)) {
    nodes.push(makeDocNode("docs/decision-log.md", "decision-log.md", "Global"));
  }
}

/**
 * Return the raw markdown content of a document identified by its relative path,
 * but ONLY if that relPath is one that `listProjectDocs` would surface.
 *
 * Security contract: relPath is validated against the discovered set. Any path
 * not discovered by `listProjectDocs` (including traversal attempts, absolute
 * paths, .pandacorp/ comms, work-orders, etc.) returns null without touching disk.
 *
 * @param projectPath - Absolute path to the project root.
 * @param relPath - Relative path as returned in DocNode.relPath (forward slashes).
 * @returns Raw markdown string, or null if the path is not in the discovered set
 *          or if the file cannot be read.
 */
export function readDoc(projectPath: string, relPath: string): string | null {
  // Guard: blank inputs → null.
  if (!projectPath || !relPath || relPath.trim() === "") {
    return null;
  }

  // Security: discover the set of valid relPaths first.
  const nodes = listProjectDocs(projectPath);
  const validPaths = new Set(nodes.map((n) => n.relPath));

  // Reject any relPath not in the discovered set (traversal, absolute, unlisted, etc.).
  if (!validPaths.has(relPath)) {
    return null;
  }

  // Read the file.
  const absolutePath = path.join(projectPath, relPath);
  try {
    return fs.readFileSync(absolutePath, "utf-8");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers (IF-04-docs) — named distinctly to avoid shadowing
// the `isFile` local variable in discoverBugs.
// ---------------------------------------------------------------------------

/**
 * Build a DocNode with a stable id derived from the relPath (no extension).
 * The id equals the relPath stripped of its file extension.
 * Forward slashes only (relPath is already normalised at call sites).
 */
function makeDocNode(relPath: string, label: string, group: string): DocNode {
  const id = relPath.replace(/\.[^/.]+$/, "");
  return { id, label, group, relPath };
}

/**
 * Synchronous file-only probe (not a directory, not a symlink). Fail-soft: any error → false.
 *
 * Security invariant: uses `lstatSync` (not `statSync`) so symlinks are never
 * treated as regular files. A symlink pointing out-of-tree would pass `statSync`
 * but fail here, preventing `readDoc` from leaking out-of-tree content via a
 * surfaced symlink (adversarial test: docs.wo04001.reviewer.test.ts symlink group).
 */
function statIsFile(p: string): boolean {
  try {
    return fs.lstatSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * Synchronous directory-only probe (not a file). Fail-soft: any error → false.
 */
function statIsDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
