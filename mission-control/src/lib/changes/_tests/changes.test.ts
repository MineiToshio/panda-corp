import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readChangeQueue } from "../changes";

/**
 * changes.ts reader tests (FRD-04, DR-078 fail-loud boundary).
 *
 * Each test builds a real project's .pandacorp/inbox/changes/ in a temp dir and
 * exercises readChangeQueue() against real and malformed fixtures — the malformed
 * one MUST surface in errors[], not vanish.
 */

let projectPath: string;
let changesDir: string;

function writeChange(filename: string, body: string, subdir = ""): void {
  const dir = subdir === "" ? changesDir : path.join(changesDir, subdir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), body, "utf-8");
}

const VALID_FEATURE = `---
type: feature
class: standard
status: ready
date: 2026-07-01
frd: frd-05-settings
rebuilds_verified: false
depends_on:
---

# Agrega exportar a CSV en la tabla de pedidos

## Qué se quiere
Un botón que exporte la tabla actual a CSV.

## Contexto
El owner lo pidió para hacer reportes fuera de la app.
`;

beforeEach(() => {
  projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "mc-changes-"));
  changesDir = path.join(projectPath, ".pandacorp", "inbox", "changes");
  fs.mkdirSync(changesDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(projectPath, { recursive: true, force: true });
});

describe("readChangeQueue — real fixtures", () => {
  it("parses a valid ready feature item with all fields", () => {
    writeChange("mc-export-csv.md", VALID_FEATURE);
    const { items, errors } = readChangeQueue(projectPath);
    expect(errors).toEqual([]);
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item).toMatchObject({
      id: "mc-export-csv",
      type: "feature",
      cls: "standard",
      status: "ready",
      date: "2026-07-01",
      frd: "frd-05-settings",
      rebuildsVerified: false,
      dependsOn: "",
      title: "Agrega exportar a CSV en la tabla de pedidos",
    });
    expect(item?.body).toContain("Qué se quiere");
    expect(item?.body).not.toContain("# Agrega exportar a CSV");
  });

  it("reads archived done items from the done/ subfolder", () => {
    writeChange(
      "mc-old-fix.md",
      `---
type: bug
class: standard
status: done
date: 2026-06-20
frd:
rebuilds_verified: false
depends_on:
---

# Arregla el paginador

## Pasos para reproducir
1. Abre la tabla.

## Esperado
Pagina bien.

## Actual
No pagina.
`,
      "done",
    );
    const { items, errors } = readChangeQueue(projectPath);
    expect(errors).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "mc-old-fix", status: "done", type: "bug" });
  });

  it("defaults class to standard when absent", () => {
    writeChange(
      "mc-no-class.md",
      `---
type: change
status: ready
---

# Un ajuste sin class explicita

## Qué se quiere
Algo.
`,
    );
    const { items, errors } = readChangeQueue(projectPath);
    expect(errors).toEqual([]);
    expect(items[0]?.cls).toBe("standard");
  });

  it("skips README.md and template files", () => {
    writeChange("mc-export-csv.md", VALID_FEATURE);
    writeChange("README.md", "| Card | Tipo | Clase | Estado |\n");
    writeChange("_change-request-template.md", "---\ntype: change\n---\n# t\n");
    const { items, errors } = readChangeQueue(projectPath);
    expect(errors).toEqual([]);
    expect(items.map((i) => i.id)).toEqual(["mc-export-csv"]);
  });

  it("returns an empty (not errored) result when the changes dir is absent", () => {
    fs.rmSync(changesDir, { recursive: true, force: true });
    const { items, errors } = readChangeQueue(projectPath);
    expect(items).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe("readChangeQueue — fail-loud on malformed items (DR-078)", () => {
  it("surfaces malformed YAML frontmatter in errors[], does not drop it silently", () => {
    writeChange("mc-export-csv.md", VALID_FEATURE);
    writeChange("mc-broken.md", "---\ntype: bug\n  bad: [unclosed\n---\n# t\nbody");
    const { items, errors } = readChangeQueue(projectPath);
    expect(items.map((i) => i.id)).toEqual(["mc-export-csv"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.file).toBe("mc-broken.md");
    expect(errors[0]?.reason).toMatch(/malformed/i);
  });

  it("surfaces a missing required field (status) as an error", () => {
    writeChange(
      "mc-nostatus.md",
      `---
type: bug
---
# Falta status
`,
    );
    const { items, errors } = readChangeQueue(projectPath);
    expect(items).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.reason).toMatch(/status/i);
  });

  it("surfaces an out-of-range enum (type) as an error", () => {
    writeChange(
      "mc-badtype.md",
      `---
type: whoops
status: ready
---
# Tipo invalido
`,
    );
    const { items, errors } = readChangeQueue(projectPath);
    expect(items).toEqual([]);
    expect(errors[0]?.reason).toMatch(/type/i);
  });

  it("surfaces a missing H1 title in the body as an error", () => {
    writeChange(
      "mc-notitle.md",
      `---
type: change
status: ready
---

## Qué se quiere
No hay encabezado H1 arriba.
`,
    );
    const { items, errors } = readChangeQueue(projectPath);
    expect(items).toEqual([]);
    expect(errors[0]?.reason).toMatch(/title/i);
  });

  it("surfaces a duplicate id fail-loud and keeps only the first", () => {
    writeChange("mc-dup.md", VALID_FEATURE);
    writeChange("mc-dup.md", VALID_FEATURE, "done");
    const { items, errors } = readChangeQueue(projectPath);
    expect(items.filter((i) => i.id === "mc-dup")).toHaveLength(1);
    const dupError = errors.find((e) => e.reason.includes("duplicate id mc-dup"));
    expect(dupError).toBeDefined();
  });
});
