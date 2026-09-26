/**
 * FRD-02 — REVIEWER adversarial probe (DR-015, DR-080) for the "Does NOT include" write clause.
 *
 * Contract (frd.md § Does NOT include, 2nd bullet; AC-02-010.6; REQ-02-007/008/012; ADR-0002/0003):
 *   - La Campaña and the three-tab card-detail restructure add ZERO mutations.
 *   - The board's writes are the bounded, human-triggered set — discard/restore status (REQ-02-007)
 *     and the favourite flag (REQ-02-012) — isolated to `lib/discard/` + `lib/favorite/`, reached
 *     only through the board's Server Action surface.
 *
 * Scope is FRD-02's own write surface plus every write to the idea-card store, wherever it lives.
 * Other approved FRDs own bounded writers of their own OUTSIDE those two folders (FRD-04 change-queue
 * discard, FRD-09 AC-09-006.2 ledger, FRD-22 REQ-22-007 backlog discard, FRD-23 REQ-23-002/003/006 +
 * ADR-0004 read-model), so "no fs write anywhere outside lib/discard + lib/favorite" is unsatisfiable
 * by a correct build; those writers are judged at their own FRD gates.
 *
 * Static analysis over the production sources (comments stripped, type-only imports ignored): an
 * import graph resolved through the `@/` alias and relative paths, plus a fs-write call detector.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const BOUNDED_WRITE_LAYER = ["lib/discard/", "lib/favorite/"] as const;
const BOARD_ACTIONS = "app/board/actions/actions.ts";
const BOUNDED_WRITERS: ReadonlyArray<{ file: string; fn: string }> = [
  { file: "lib/discard/discard.ts", fn: "discardIdea" },
  { file: "lib/discard/restore.ts", fn: "restoreIdea" },
  { file: "lib/favorite/favorite.ts", fn: "setFavorite" },
];
const BOUNDED_ACTIONS = ["discardIdeaAction", "restoreIdeaAction", "toggleFavoriteAction"] as const;

const FS_WRITE_CALL =
  /\b(?:writeFileSync|writeFile|writeSync|appendFileSync|appendFile|renameSync|unlinkSync|rmSync|rmdirSync|mkdirSync|copyFileSync|cpSync|truncateSync|symlinkSync|createWriteStream)\s*\(|\b(?:fs|fsp|promises)\.(?:rename|unlink|rm|rmdir|mkdir|copyFile|cp|truncate|symlink)\s*\(/;
const IDEA_STORE_REF = /["'`]ideas["'`]|factory\/ideas|\bIDEAS_DIR\b|["']@\/lib\/ideas\//;
const USE_SERVER = /^\s*["']use server["']/m;
const CHILD_PROCESS = /["'](?:node:)?child_process["']/;

function findProjectRoot(start: string): string {
  let dir = start;
  while (!(existsSync(path.join(dir, "package.json")) && existsSync(path.join(dir, "src")))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`no project root (package.json + src/) above ${start}`);
    dir = parent;
  }
  return dir;
}

const SRC_ROOT = path.join(findProjectRoot(__dirname), "src");

function isProductionFile(rel: string): boolean {
  if (!/\.(ts|tsx)$/.test(rel) || /\.(test|spec)\.(ts|tsx)$/.test(rel) || rel.endsWith(".d.ts")) {
    return false;
  }
  const parts = rel.split("/");
  return (
    !parts.includes("_tests") &&
    !parts.includes("__drift_probe__") &&
    !/^tests?$/.test(parts[0] ?? "")
  );
}

function collect(dir: string, out: Map<string, string>): void {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== "node_modules") collect(full, out);
      continue;
    }
    const rel = path.relative(SRC_ROOT, full).split(path.sep).join("/");
    if (isProductionFile(rel)) out.set(rel, readFileSync(full, "utf8"));
  }
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const SOURCES: ReadonlyMap<string, string> = (() => {
  const raw = new Map<string, string>();
  collect(SRC_ROOT, raw);
  return new Map([...raw].map(([rel, text]) => [rel, stripComments(text)]));
})();

function code(rel: string): string {
  const text = SOURCES.get(rel);
  if (text === undefined) throw new Error(`production source ${rel} not found under src/`);
  return text;
}

const isFsWriter = (rel: string): boolean => FS_WRITE_CALL.test(code(rel));
const inBoundedLayer = (rel: string): boolean => BOUNDED_WRITE_LAYER.some((p) => rel.startsWith(p));

function valueImportSpecifiers(source: string): string[] {
  const withoutTypeOnly = source.replace(
    /(?:^|[;\n])\s*(?:import|export)\s+type\s[\s\S]*?\bfrom\s*["'][^"']+["']/g,
    "\n",
  );
  const specs: string[] = [];
  for (const re of [
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ]) {
    for (const m of withoutTypeOnly.matchAll(re)) if (m[1]) specs.push(m[1]);
  }
  return specs;
}

function resolveImport(fromRel: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith("./") || spec.startsWith("../")) {
    base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
  } else return null;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((c) => SOURCES.has(c)) ?? null;
}

function closureOf(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const rel = queue.shift() as string;
    if (seen.has(rel)) continue;
    seen.add(rel);
    for (const spec of valueImportSpecifiers(code(rel))) {
      const next = resolveImport(rel, spec);
      if (next !== null && !seen.has(next)) queue.push(next);
    }
  }
  return [...seen].sort();
}

const filesUnder = (prefix: string): string[] =>
  [...SOURCES.keys()].filter((k) => k.startsWith(prefix)).sort();

function exportedFunctionNames(source: string): string[] {
  const names = [...source.matchAll(/\bexport\s+(?:async\s+)?function\s+(\w+)/g)].map(
    (m) => m[1] ?? "",
  );
  const consts = [...source.matchAll(/\bexport\s+const\s+(\w+)\s*=/g)].map((m) => m[1] ?? "");
  return [...names, ...consts].filter(Boolean).sort();
}

describe("FRD-02 exclusion — the board's writes are a bounded set isolated to lib/discard + lib/favorite", () => {
  it("scans the real production tree and finds the three bounded idea-card writers (non-vacuous)", () => {
    expect(SOURCES.size).toBeGreaterThan(50);
    const writers = BOUNDED_WRITERS.map(({ file, fn }) => ({
      file,
      exportsWriter: new RegExp(`\\bexport\\s+function\\s+${fn}\\b`).test(code(file)),
      writesFs: isFsWriter(file),
      targetsIdeaStore: IDEA_STORE_REF.test(code(file)),
    }));
    expect(writers).toEqual(
      BOUNDED_WRITERS.map(({ file }) => ({
        file,
        exportsWriter: true,
        writesFs: true,
        targetsIdeaStore: true,
      })),
    );
  });

  it("every fs writer inside lib/discard + lib/favorite writes idea cards only (no foreign writer hides there)", () => {
    const foreign = [...SOURCES.keys()]
      .filter(inBoundedLayer)
      .filter(isFsWriter)
      .filter((rel) => !IDEA_STORE_REF.test(code(rel)));
    expect(foreign).toEqual([]);
  });

  it("no production module outside lib/discard + lib/favorite writes to the idea-card store", () => {
    const offenders = [...SOURCES.keys()]
      .filter((rel) => !inBoundedLayer(rel))
      .filter(isFsWriter)
      .filter((rel) => IDEA_STORE_REF.test(code(rel)))
      .sort();
    expect(offenders).toEqual([]);
  });

  it("only the board's Server Action surface value-imports the bounded writers (human-triggered, ADR-0003)", () => {
    const writerFiles = new Set(BOUNDED_WRITERS.map((w) => w.file));
    const importers = [...SOURCES.keys()]
      .filter((rel) => !inBoundedLayer(rel))
      .filter((rel) =>
        valueImportSpecifiers(code(rel)).some((spec) => {
          const target = resolveImport(rel, spec);
          return target !== null && writerFiles.has(target);
        }),
      )
      .sort();
    expect(importers).toEqual([BOARD_ACTIONS]);
  });

  it("the board's mutation surface is exactly discard / restore / favourite and delegates every write", () => {
    const actions = code(BOARD_ACTIONS);
    const delegatesTo = closureOf([BOARD_ACTIONS]).filter(
      (rel) => rel !== BOARD_ACTIONS && isFsWriter(rel),
    );
    expect({
      isServerActionModule: USE_SERVER.test(actions),
      exported: exportedFunctionNames(actions),
      writesFsDirectly: isFsWriter(BOARD_ACTIONS),
      delegatesTo,
    }).toEqual({
      isServerActionModule: true,
      exported: [...BOUNDED_ACTIONS].sort(),
      writesFsDirectly: false,
      delegatesTo: BOUNDED_WRITERS.map((w) => w.file).sort(),
    });
  });

  it("the board route (page, card detail, modals, actions) reaches no fs writer outside the bounded layer", () => {
    const board = filesUnder("app/board/");
    expect(board).toContain("app/board/page.tsx");
    const reach = closureOf(board);
    expect(reach).toContain("app/board/_components/CardDetail/CardDetail.tsx");
    expect(reach.filter(isFsWriter).filter((rel) => !inBoundedLayer(rel))).toEqual([]);
  });

  it("La Campaña adds zero mutations: no fs write, Server Action or subprocess anywhere in its import graph (AC-02-010.6)", () => {
    const campaign = filesUnder("components/modules/CampaignPipeline/");
    expect(campaign).toContain("components/modules/CampaignPipeline/CampaignPipeline.tsx");
    const reach = closureOf(campaign);
    const mutating = reach
      .filter(
        (rel) => isFsWriter(rel) || USE_SERVER.test(code(rel)) || CHILD_PROCESS.test(code(rel)),
      )
      .sort();
    expect(mutating).toEqual([]);
  });
});
