/**
 * WO-01-006 — `readProjectDocs` (feature-centric tree discovery) — CMP-01-docs, IF-01-readProjectDocs
 * WO-04-001 — `listProjectDocs` + `readDoc` (IF-04-docs) — AC-04-006.1/2/3
 *
 * Traceability:
 *   REQ-01-007  Read per-project feature-centric `docs/` + `.pandacorp/` comms.
 *   REQ-01-010  Project path missing → mark not-found, don't break the view.
 *   REQ-01-011  NEVER call Claude / never write.
 *   AC-01-007.1 The system SHALL read the product layer, per-FRD modules, global docs,
 *               and the owner-facing .pandacorp/ layer (DR-049).
 *   AC-04-006.1 The Documents tab SHALL render the feature-centric document tree (nav).
 *   AC-04-006.2 WHEN a document is selected, render its markdown body (first doc by default).
 *   AC-04-006.3 WHEN the project has no readable documents, show a graceful empty state.
 *
 * Contract:
 *   export function readProjectDocs(projectPath: string): ProjectDocsIndex;
 *   export function listProjectDocs(projectPath: string): DocNode[];
 *   export function readDoc(projectPath: string, relPath: string): string | null;
 *
 * Tolerance rules (blueprint §3 fail-soft):
 *   - Non-existent / blank projectPath → empty index/[], never throws.
 *   - Absent layer (product, frds, adr, analytics, decision-log, .pandacorp) → field absent or []/false.
 *   - Empty frds/ dir → frds: [].
 *   - Dirs that don't match /^frd-\d/ pattern → ignored.
 *   - Empty FRD dir → FrdModule with all flags false (regression I2: no vacuous-truth).
 *   - Bugs dir with no .md files → bugs: [] (not NaN — regression B1').
 *   - frds and bugs are always genuine JS Arrays (regression I3).
 *   - readDoc validates relPath against the discovered set — no arbitrary traversal (security).
 *
 * Read-only invariant: only `fs.existsSync` / `fs.readdirSync` / `fs.readFileSync` — no writes, no Claude calls.
 */

import fs from "node:fs";
import path from "node:path";
import { pathExists } from "./fs-utils";

// ---------------------------------------------------------------------------
// Types (exported — consumed by FRD-04, FRD-05, FRD-08)
// ---------------------------------------------------------------------------

export type FrdModule = {
  /** Directory name under docs/frds/ (e.g. "frd-01-data-reading") — no path separators. */
  slug: string;
  /** fdd.md present in the FRD directory. */
  hasFdd: boolean;
  /** blueprint.md present in the FRD directory. */
  hasBlueprint: boolean;
  /** mocks/ subdirectory present in the FRD directory. */
  hasMocks: boolean;
  /** work-orders/ subdirectory present in the FRD directory. */
  hasWorkOrders: boolean;
};

export type ProjectDocsIndex = {
  /** Absolute path to docs/product/prd.md, present only when the file exists. */
  prd?: string;
  /** Absolute path to docs/product/architecture.md, present only when the file exists. */
  architecture?: string;
  /** One FrdModule per discovered docs/frds/frd-NN-<slug>/ directory. Always a genuine Array. */
  frds: FrdModule[];
  /** True when docs/adr/ directory exists. */
  hasAdr: boolean;
  /** True when docs/analytics/ directory exists. */
  hasAnalytics: boolean;
  /** True when docs/decision-log.md file exists. */
  hasDecisionLog: boolean;
  /** Owner-facing .pandacorp/ comms layer. Always present; bugs is always a genuine Array. */
  comms: {
    /** Absolute path to .pandacorp/comms/progress.md, present only when the file exists. */
    progress?: string;
    /** Absolute path to .pandacorp/inbox/decisions.md, present only when the file exists. */
    decisions?: string;
    /** Absolute paths of each .md file inside .pandacorp/inbox/bugs/. */
    bugs: string[];
  };
};

// ---------------------------------------------------------------------------
// FRD directory pattern: must start with "frd-" followed by at least one digit.
// e.g. "frd-01-data-reading", "frd-12-observability-dataviz"
// ---------------------------------------------------------------------------

const FRD_DIR_PATTERN = /^frd-\d/;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Discover the feature-centric docs tree for a project.
 *
 * Probes file/directory existence only — does NOT read file contents.
 * Fail-soft: any absent or unreadable layer yields an empty/false/undefined value.
 * Never throws under any input.
 *
 * @param projectPath - Absolute path to the project root.
 * @returns A fully-typed, serializable `ProjectDocsIndex`. Always has `frds` (Array) and
 *          `comms.bugs` (Array) even when empty.
 */
export function readProjectDocs(projectPath: string): ProjectDocsIndex {
  // Canonical empty result — returned whenever anything is missing.
  const empty: ProjectDocsIndex = {
    frds: [],
    hasAdr: false,
    hasAnalytics: false,
    hasDecisionLog: false,
    comms: { bugs: [] },
  };

  // Guard: blank / empty path — never throws.
  if (!projectPath || projectPath.trim() === "") {
    return empty;
  }

  // Guard: non-existent project root (REQ-01-010).
  if (!pathExists(projectPath)) {
    return empty;
  }

  // --- Product layer ---
  const docsProductDir = path.join(projectPath, "docs", "product");
  const prdPath = path.join(docsProductDir, "prd.md");
  const archPath = path.join(docsProductDir, "architecture.md");

  const prd = pathExists(prdPath) ? prdPath : undefined;
  const architecture = pathExists(archPath) ? archPath : undefined;

  // --- FRD modules ---
  const frds = discoverFrds(path.join(projectPath, "docs", "frds"));

  // --- Global docs layer ---
  const hasAdr = pathExists(path.join(projectPath, "docs", "adr"));
  const hasAnalytics = pathExists(path.join(projectPath, "docs", "analytics"));
  const hasDecisionLog = pathExists(path.join(projectPath, "docs", "decision-log.md"));

  // --- .pandacorp/ comms layer ---
  const comms = discoverComms(path.join(projectPath, ".pandacorp"));

  const result: ProjectDocsIndex = {
    frds,
    hasAdr,
    hasAnalytics,
    hasDecisionLog,
    comms,
  };

  if (prd !== undefined) result.prd = prd;
  if (architecture !== undefined) result.architecture = architecture;

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Enumerate docs/frds/ and build one FrdModule per matching directory.
 *
 * Only directories whose name matches /^frd-\d/ are included.
 * Fail-soft: absent or unreadable frdsDir → [].
 * Regression I2: an empty FRD directory produces an FrdModule with all flags false.
 * Regression I3: always returns a genuine Array.
 * Regression B1': no numeric computation — length is always a genuine integer.
 */
function discoverFrds(frdsDir: string): FrdModule[] {
  if (!pathExists(frdsDir)) {
    return [];
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(frdsDir);
  } catch {
    return [];
  }

  // Genuine Array (regression I3) — built with push, not with Array.from or Object.keys tricks.
  const result: FrdModule[] = [];

  for (const entry of entries) {
    if (!FRD_DIR_PATTERN.test(entry)) {
      continue;
    }
    const frdDir = path.join(frdsDir, entry);

    // Must be a directory (not a file).
    let stat: fs.Stats;
    try {
      stat = fs.statSync(frdDir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) {
      continue;
    }

    // Probe optional artifacts — all fail-soft (regression I2: no vacuous-truth).
    const hasFdd = pathExists(path.join(frdDir, "fdd.md"));
    const hasBlueprint = pathExists(path.join(frdDir, "blueprint.md"));
    const hasMocks = pathExists(path.join(frdDir, "mocks"));
    const hasWorkOrders = pathExists(path.join(frdDir, "work-orders"));

    // slug is the plain directory name (regression I3: string, no separators).
    result.push({ slug: entry, hasFdd, hasBlueprint, hasMocks, hasWorkOrders });
  }

  return result;
}

/**
 * Discover the .pandacorp/ comms layer.
 *
 * Probes progress.md, inbox/decisions.md, and inbox/bugs/*.md.
 * Fail-soft: absent directories or unreadable content → undefined / [].
 * Regression B1': bugs count is derived from array length, never from arithmetic.
 * Regression I3: bugs is always a genuine Array.
 */
function discoverComms(pandacorpDir: string): ProjectDocsIndex["comms"] {
  const result: ProjectDocsIndex["comms"] = { bugs: [] };

  if (!pathExists(pandacorpDir)) {
    return result;
  }

  // .pandacorp/comms/progress.md
  const progressPath = path.join(pandacorpDir, "comms", "progress.md");
  if (pathExists(progressPath)) {
    result.progress = progressPath;
  }

  // .pandacorp/inbox/decisions.md
  const decisionsPath = path.join(pandacorpDir, "inbox", "decisions.md");
  if (pathExists(decisionsPath)) {
    result.decisions = decisionsPath;
  }

  // .pandacorp/inbox/bugs/*.md
  const bugsDir = path.join(pandacorpDir, "inbox", "bugs");
  result.bugs = discoverBugs(bugsDir);

  return result;
}

/**
 * List absolute paths of .md files inside the bugs directory.
 *
 * Fail-soft: absent dir → []. Unreadable dir → [].
 * Only files ending in .md are included (gitkeep and other files ignored).
 * Regression B1': returns length via Array.length, never via arithmetic that could yield NaN.
 * Regression I3: always a genuine Array (built with push).
 */
function discoverBugs(bugsDir: string): string[] {
  if (!pathExists(bugsDir)) {
    return [];
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(bugsDir);
  } catch {
    return [];
  }

  // Genuine Array (regression I3).
  const bugs: string[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".md")) {
      continue;
    }
    const fullPath = path.join(bugsDir, entry);
    // Only include files, not subdirectories named *.md (unlikely but defensive).
    let isFile = false;
    try {
      isFile = fs.statSync(fullPath).isFile();
    } catch {
      continue;
    }
    if (isFile) {
      bugs.push(fullPath);
    }
  }

  return bugs;
}

// =============================================================================
// IF-04-docs — WO-04-001
// `listProjectDocs` + `readDoc`: feature-centric document tree + raw read.
//
// Traceability: AC-04-006.1 (tree), AC-04-006.2 (body), AC-04-006.3 (empty).
// Security: readDoc validates relPath against the discovered set only (no traversal).
// =============================================================================

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

  // Collect nodes across all layers.
  const nodes: DocNode[] = [];

  // ---- Product layer ----------------------------------------------------------
  const prdPath = path.join(projectPath, "docs", "product", "prd.md");
  if (pathExists(prdPath) && statIsFile(prdPath)) {
    nodes.push(makeDocNode("docs/product/prd.md", "prd.md", "Product"));
  }
  const archPath = path.join(projectPath, "docs", "product", "architecture.md");
  if (pathExists(archPath) && statIsFile(archPath)) {
    nodes.push(makeDocNode("docs/product/architecture.md", "architecture.md", "Product"));
  }

  // ---- Per-FRD layer ----------------------------------------------------------
  const frdsDir = path.join(projectPath, "docs", "frds");
  if (pathExists(frdsDir) && statIsDir(frdsDir)) {
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

  // ---- Global layer -----------------------------------------------------------
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

  return nodes;
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
// the `isFile` local variable in discoverBugs above.
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
 * Synchronous file-only probe (not a directory). Fail-soft: any error → false.
 */
function statIsFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
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
