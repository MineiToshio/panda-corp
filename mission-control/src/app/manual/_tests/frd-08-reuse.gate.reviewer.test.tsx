/**
 * FRD-08 gate (DR-072), reviewer (opus): reuse anchor (DR-057, DR-046) for the v2 Documentación.
 * Reconciled for WO-08-003: the page no longer mounts the FRD-07 cards, so reuse now means two
 * things: nothing here reads or draws a catalog, and every shared control is the inventory's
 * primitive rather than a second copy of its markup.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(process.cwd(), "src");
function source(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

const SURFACE = [
  "app/manual/page.tsx",
  "app/manual/ManualShell.tsx",
  "app/manual/DocReader.tsx",
  "app/manual/DocNav.tsx",
];

describe("FRD-08 REQ-08-006 REQ-08-007 one catalog, owned by Configuración", () => {
  it.each(SURFACE)("%s imports no catalog reader or FRD-07 surface", (file) => {
    expect(source(file)).not.toMatch(
      /lib\/reference|lib\/registry|lib\/standards|SkillsSection|AgentList|AgentDetail|StandardsSection|DecisionRulesSection/,
    );
  });
});

describe("FRD-08 DR-057 shared primitives are reused, not re-implemented", () => {
  it.each([
    "app/manual/ManualShell.tsx",
    "components/modules/DocumentReader/DocIndex.tsx",
  ])("%s searches through the core SearchField", (file) => {
    const code = source(file);
    expect(code).toContain("@/components/core/Field/Field");
    expect(code).not.toMatch(/<input\b/);
  });

  it("the reader and the home keep the catalogue's composite primitives", () => {
    expect(source("app/manual/DocReader.tsx")).toContain("@/components/core/Crumbs/Crumbs");
    expect(source("app/manual/DocReader.tsx")).toContain("@/components/core/Markdown/Markdown");
    expect(source("app/manual/ManualShell.tsx")).toContain("@/components/core/PageHead/PageHead");
    expect(source("app/manual/ManualShell.tsx")).toContain(
      "@/components/core/EmptyState/EmptyState",
    );
    expect(source("app/manual/DocNav.tsx")).toContain(
      "@/components/modules/DocumentReader/DocIndex",
    );
  });
});
