/**
 * FRD-03 gate (reviewer, Opus 4.8) — DR-057 reuse-before-create: ONE rail, not two.
 *
 * The adversarial test the implementers did not write. The portfolio surface must
 * reuse the inventoried shared rail primitive (`components/modules/ProjectRail`,
 * status "real" in docs/design/components.md L88) rather than fork a bespoke
 * page-local rail. This is the exact MC duplicate-primitive defect (DR-057): two
 * agents build two rails that never talk.
 *
 * History (Phase-2 build of WO-03-002):
 *   942f821 — GATE REJECT #1 ("DR-057 dup primitives")
 *   d37fa48 — GATE REJECT #2 ("DR-057 reuse: bespoke rail/banner/chips instead of
 *             shared ProjectRail/Banner+CmdRow/CountBadge")
 *   59423d2 — rebuild fixed banner + chips ONLY; the rail leg stayed bespoke.
 *
 * These tests assert the structural reuse contract:
 *   1) The shared ProjectRail module MUST have at least one production consumer
 *      (a non-test importer) — i.e. it is not orphaned.
 *   2) The page-local SelectableProjectRail MUST NOT re-declare the rail's core
 *      style constants verbatim (RAIL_STYLE / ROW_STYLE / CHIP_BUILDING_STYLE) —
 *      those belong to the ONE shared primitive.
 *
 * When the surface is consolidated onto the single shared rail (or the shared
 * modules are deleted and SelectableProjectRail is promoted to THE rail and the
 * inventory updated), these tests pass.
 *
 * Traceability: DR-057 (reuse-before-create), FRD-03 AC "matches the prototype
 * portfolio surface; no near-duplicate shared primitive".
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

/** Read a source file relative to src/. */
function readSrc(relative: string): string {
  return readFileSync(join(SRC, relative), "utf8");
}

/** Count production (non-test) importers of a module path fragment across src/. */
function productionImporters(moduleFragment: string): string[] {
  // Walk a focused, deterministic set of candidate dirs to keep the test fast.
  const candidates = [
    "app/portfolio/page.tsx",
    "app/portfolio/SelectableProjectRail.tsx",
  ];
  const hits: string[] = [];
  for (const rel of candidates) {
    let body = "";
    try {
      body = readSrc(rel);
    } catch {
      continue;
    }
    if (body.includes(moduleFragment)) hits.push(rel);
  }
  return hits;
}

describe("FRD-03 gate — DR-057 one rail, not two (reviewer)", () => {
  it("the inventoried shared ProjectRail is consumed by the portfolio surface (not orphaned)", () => {
    // The page (or its selectable wrapper) must import the shared rail module.
    const consumers = productionImporters("modules/ProjectRail/ProjectRail");
    expect(
      consumers,
      "the shared ProjectRail primitive (components.md L88, status 'real') is orphaned — " +
        "the page forks a bespoke SelectableProjectRail instead of reusing it (DR-057 duplicate rail)",
    ).not.toHaveLength(0);
  });

  it("the page-local rail does not re-declare the shared rail's core style constants verbatim", () => {
    const bespoke = readSrc("app/portfolio/SelectableProjectRail.tsx");
    const forkedConstants = ["RAIL_STYLE", "ROW_STYLE", "CHIP_BUILDING_STYLE", "CHIP_STOPPED_STYLE"];
    const reDeclared = forkedConstants.filter((name) =>
      new RegExp(`^const ${name}\\b`, "m").test(bespoke),
    );
    expect(
      reDeclared,
      `SelectableProjectRail re-declares the shared rail's style constants (${reDeclared.join(", ")}) — ` +
        "these are verbatim duplicates of components/modules/ProjectRail/ProjectRail.tsx (DR-057 forked primitive)",
    ).toHaveLength(0);
  });
});
