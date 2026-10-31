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
  /** Optional FRD heading used as the purpose-group label. */
  purposeLabel?: string;
  purpose?: "product" | "global" | "feature" | "design" | "analytics" | "reviews" | "workOrders";
  type?: string;
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
 *   - Purpose layers: docs/design, docs/analytics, docs/reviews and per-FRD work orders
 *
 * Fail-soft: absent/unreadable layers → []. Never throws.
 * Read-only: probes existence, lists directories and reads FRD headings for group labels.
 *
 * @param projectPath - Absolute path to the project root.
 * @returns A genuine JS Array of DocNode; empty when no docs are found.
 */
export function listProjectDocs(projectPath: string): DocNode[] {
  // Guard: blank/empty or non-existent path.
  if (!projectPath || projectPath.trim() === "") {
    return [];
  }
  if (!pathExists(projectPath) || !safeDirectoryChain(projectPath, "docs")) {
    return [];
  }

  // Collect nodes across all layers (each helper pushes into the shared array).
  const nodes: DocNode[] = [];
  _collectProductDocs(projectPath, nodes);
  _collectFrdDocs(projectPath, nodes);
  _collectGlobalDocs(projectPath, nodes);
  for (const [directory, group] of [
    ["docs/design", "Design"],
    ["docs/analytics", "Analytics"],
    ["docs/reviews", "Reviews"],
  ]) {
    collectDirectory(projectPath, directory ?? "", group ?? "", nodes);
  }
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

/** Per-FRD layer: docs/frds/frd-NN-<slug>/{frd,fdd,blueprint}.md. Includes optional work orders. */
function _collectFrdDocs(projectPath: string, nodes: DocNode[]): void {
  const frdsDir = path.join(projectPath, "docs", "frds");
  if (!safeDirectoryChain(projectPath, "docs/frds")) {
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
    collectDirectory(projectPath, `docs/frds/${entry}/work-orders`, "Work orders", nodes);
    // Surface only the three document files (regression I2: only if present).
    for (const docFile of ["frd.md", "fdd.md", "blueprint.md"] as const) {
      const filePath = path.join(frdDir, docFile);
      if (pathExists(filePath) && statIsFile(filePath)) {
        const relPath = `docs/frds/${entry}/${docFile}`;
        nodes.push({
          ...makeDocNode(relPath, docFile, group),
          purposeLabel: frdPurposeLabel(frdDir, entry),
        });
      }
    }
  }
}

/** Global layer: docs/adr/*.md + docs/decision-log.md. */
function _collectGlobalDocs(projectPath: string, nodes: DocNode[]): void {
  // docs/adr/*.md files
  const adrDir = path.join(projectPath, "docs", "adr");
  if (safeDirectoryChain(projectPath, "docs/adr")) {
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
 * Count the distinct FRD folders present in a document tree (the number of
 * `Feature: frd-NN-<slug>` groups) — the canonical, on-disk FRD count.
 *
 * Use this wherever a UI needs "how many FRDs does this project have" instead of
 * trusting a count parsed from narrative prose (a digest, a summary doc): a folder
 * under `docs/frds/frd-*` is the ground truth, prose is just a description of it
 * that can list a stale/renamed/removed FRD without anyone noticing (DR-092/DR-115).
 *
 * @param nodes - The result of `listProjectDocs` (or any subset that preserves
 *   the `Feature:`-prefixed groups, e.g. the board's scoped doc filter).
 * @returns The number of distinct FRD folders represented in `nodes`.
 */
export function countFrdFolders(nodes: readonly DocNode[]): number {
  const groups = new Set<string>();
  for (const node of nodes) {
    if (node.group.startsWith("Feature:")) groups.add(node.group);
  }
  return groups.size;
}

/**
 * Return the raw markdown content of a document identified by its relative path,
 * but ONLY if that relPath is one that `listProjectDocs` would surface.
 *
 * Security contract: relPath is validated against the discovered set. Any path
 * not discovered by `listProjectDocs` (including traversal attempts, absolute
 * paths and .pandacorp/ communications) returns null without touching disk.
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
  if (!validPaths.has(relPath) || !safeDirectoryChain(projectPath, path.dirname(relPath))) {
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
  const purpose = docPurpose(group);
  const type = docType(relPath, label, purpose);
  return {
    id,
    label,
    group,
    relPath,
    purpose: label === "architecture.md" ? "global" : purpose,
    type,
  };
}

const GROUP_PURPOSES: Readonly<Record<string, NonNullable<DocNode["purpose"]>>> = {
  Product: "product",
  Global: "global",
  Design: "design",
  Analytics: "analytics",
  Reviews: "reviews",
  "Work orders": "workOrders",
};
const FILE_TYPES: Readonly<Record<string, string>> = {
  "prd.md": "PRD",
  "frd.md": "FRD",
  "fdd.md": "FDD",
  "blueprint.md": "Blueprint",
  "architecture.md": "Blueprint",
};
const PURPOSE_TYPES: Readonly<Record<string, string>> = {
  design: "Diseño",
  analytics: "Analítica",
  reviews: "Revisión",
};
function docPurpose(group: string): NonNullable<DocNode["purpose"]> {
  if (group.startsWith("Feature:")) return "feature";
  return GROUP_PURPOSES[group] ?? "global";
}
function docType(relPath: string, label: string, purpose: string): string {
  if (label.startsWith("wo-")) return "Work order";
  if (relPath.includes("/adr/")) return "ADR";
  return FILE_TYPES[label] ?? PURPOSE_TYPES[purpose] ?? "Documento";
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
    return fs.lstatSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Only descend into real directories, including every ancestor of a document. */
function safeDirectoryChain(root: string, relative: string): boolean {
  let current = root;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    if (!statIsDir(current)) return false;
  }
  return true;
}
function collectDirectory(root: string, directory: string, group: string, nodes: DocNode[]): void {
  if (!safeDirectoryChain(root, directory)) return;
  let entries: string[];
  try {
    entries = fs.readdirSync(path.join(root, directory)).sort();
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.endsWith(".md") || !statIsFile(path.join(root, directory, entry))) continue;
    nodes.push(makeDocNode(`${directory}/${entry}`, entry, group));
  }
}

function frdPurposeLabel(directory: string, folder: string): string {
  const match = /^frd-(\d+)-?(.*)/i.exec(folder);
  const code = `FRD-${match?.[1] ?? ""}`;
  const file = path.join(directory, "frd.md");
  try {
    if (statIsFile(file)) {
      const heading = fs
        .readFileSync(file, "utf8")
        .replace(/^---[\s\S]*?---/, "")
        .match(/^#\s+(.+)$/m)?.[1];
      if (heading) return `${code} ${heading.replace(/^FRD[- ]\d+\s*[·:—–-]?\s*/i, "").trim()}`;
    }
  } catch {
    /* Unreadable narrative retains the stable folder identity. */
  }
  return `${code} ${match?.[2]?.replaceAll("-", " ") ?? folder}`.trim();
}
