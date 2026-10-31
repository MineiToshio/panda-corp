import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  countPendingDecisions,
  isEngineLogEntry,
  parseDecisionBlocks,
  readDecisions,
} from "../activity";

/** The live PersonalPage v2 file: the status phrase closes the title, it does not open it. */
const PERSONAL_PAGE = `# Decisiones pendientes — bandeja del owner

---

## 2026-09-10 · Copy del home/about — 2 de 4 puntos ya resueltos, 2 siguen pendientes (feedback de Carlos)

**Contexto:** Carlos revisó el sitio.

## 2026-07-01 · FRD-07 Contact · falta el valor de \`NEXT_PUBLIC_WEB3FORMS_KEY\` (necesita tu acción)

**Estado:** ✅ RESUELTO 2026-07-01 — el owner puso \`NEXT_PUBLIC_WEB3FORMS_KEY\` (UUID válido)
`;

function point(heading: string, body: string) {
  return parseDecisionBlocks(`## 2026-07-01 ${heading} — Tema\n\n${body}\n`)[0];
}

describe("AC-04-014.5 the live PersonalPage v2 shape", () => {
  it("resolves 2026-07-01-1 and leaves the other entry pending", () => {
    expect(parseDecisionBlocks(PERSONAL_PAGE)).toEqual([
      {
        id: "2026-09-10-1",
        title:
          "Copy del home/about — 2 de 4 puntos ya resueltos, 2 siguen pendientes (feedback de Carlos)",
        date: "2026-09-10",
        status: "pending",
        resolved: false,
      },
      {
        id: "2026-07-01-1",
        title:
          "FRD-07 Contact · falta el valor de `NEXT_PUBLIC_WEB3FORMS_KEY` (necesita tu acción)",
        date: "2026-07-01",
        status: "resolved",
        resolved: true,
        resolvedInFile: true,
      },
    ]);
  });

  it("counts one pending through both public readers", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "resolved-reviewer-"));
    try {
      fs.mkdirSync(path.join(dir, ".pandacorp/inbox"), { recursive: true });
      fs.writeFileSync(path.join(dir, ".pandacorp/inbox/decisions.md"), PERSONAL_PAGE);
      expect(countPendingDecisions(dir)).toBe(1);
      expect(readDecisions(dir).filter((decision) => decision.resolvedInFile)).toHaveLength(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("AC-04-014.5 the Estado record", () => {
  it.each([
    "**Estado:** RESUELTO",
    "**Estado:** ✅ RESUELTO 2026-07-01",
    "**Estado:** ✅ **RESUELTO**",
    "**Estado**: RESUELTO",
    "- **Estado:** RESUELTO: opción B",
    "* **Estado:** ☑️ RESUELTO",
    "  - Estado: RESUELTO",
    "Estado: resuelto",
    "*Estado:* RESUELTO",
    "**Estado:** ✅ RESUELTA 2026-07-01",
    "**Estado:** RESUELTA: opción B",
  ])("%s resolves an entry the heading leaves pending", (line) => {
    expect(point("(necesita tu acción)", line)).toMatchObject({
      status: "resolved",
      resolved: true,
      resolvedInFile: true,
    });
  });

  it.each([
    "Quedó **Estado:** RESUELTO en otro lado",
    "> **Estado:** RESUELTO",
    "**Estado de las órdenes:** RESUELTO",
    "Estado actual: RESUELTO",
    "**Estado:** NO RESUELTO",
    "**Estado:** IRRESUELTO",
    "**Estado:** RESUELTOS",
    "**Estado:**",
    "**Decisión:** RESUELTO",
  ])("%s is not a resolution record", (line) => {
    const decision = point("(necesita tu acción)", line);
    expect(decision?.status).toBe("pending");
    expect(decision?.resolvedInFile).toBeUndefined();
  });

  it("carries the marker only over a pending heading", () => {
    expect(point("(RESUELTO)", "**Estado:** RESUELTO")?.resolvedInFile).toBeUndefined();
    expect(point("(OBSOLETO)", "**Estado:** RESUELTO")?.resolvedInFile).toBeUndefined();
    expect(point("(CERRADO)", "**Estado:** RESUELTO")?.resolvedInFile).toBeUndefined();
    expect(point("", "**Estado:** RESUELTO")?.resolvedInFile).toBe(true);
    expect(point("(lo que sea)", "**Estado:** RESUELTO")?.resolvedInFile).toBe(true);
  });

  it("an obsolete record stays obsolete and never gains the marker", () => {
    for (const word of ["OBSOLETO", "OBSOLETA", "SUPERSEDIDO", "SUPERSEDIDA"]) {
      const decision = point("(necesita tu acción)", `**Estado:** ❌ ${word}`);
      expect(decision).toMatchObject({ status: "obsolete", resolved: true });
      expect(decision?.resolvedInFile).toBeUndefined();
    }
  });

  it("does not leak a record into the next entry", () => {
    const [first, second] = parseDecisionBlocks(
      "## 2026-07-01 — Uno\n**Estado:** ✅ RESUELTO\n## 2026-07-02 — Dos\nSin estado.\n",
    );
    expect(first?.status).toBe("resolved");
    expect(second?.status).toBe("pending");
    expect(second?.resolvedInFile).toBeUndefined();
  });
});

describe("IF-04-decisions-resolved titles and ids", () => {
  it.each([
    ["## 2026-07-01 · Tema", "Tema"],
    ["## 2026-07-01 ·   Tema", "Tema"],
    ["## 2026-07-01 — · Tema", "Tema"],
    ["## OPEN: · Tema", "Tema"],
    ["## 2026-07-01 Tema · con punto", "Tema · con punto"],
    ["## 2026-07-01 ·· Tema", "· Tema"],
  ])("%s", (heading, title) => {
    expect(parseDecisionBlocks(heading)[0]?.title).toBe(title);
  });

  it("derives ids from headings alone, whatever the body records", () => {
    const content = (body: string): string =>
      `## 2026-07-01 · A\n${body}\n## 2026-07-01 — B\n## OPEN: C\n${body}\n## 2026-07-02 D\n`;
    const ids = ["2026-07-01-1", "2026-07-01-2", "legacy-1", "2026-07-02-1"];
    for (const body of ["", "**Estado:** ✅ RESUELTO", "Estado: OBSOLETO", "Estado: PENDIENTE"]) {
      expect(parseDecisionBlocks(content(body)).map((decision) => decision.id)).toEqual(ids);
    }
  });
});

describe("IF-04-decisions-resolved engine log rule", () => {
  it.each([
    ["T17:35:15Z — RESUELTO: REVERSIÓN BLOQUEADA", true],
    ["2026-10-18T17:35:15Z — motor", true],
    ["09:05 motor", true],
    ["9:05 motor", true],
    ["T9:05 motor", true],
    ["Elegir a las 12:30", false],
    ["2026-10-20 Elegir versión", false],
    ["2026 presupuesto", false],
    ["12 de octubre", false],
    ["Tarea T12:30", false],
    ["", false],
  ])("%s", (title, expected) => {
    expect(isEngineLogEntry({ title })).toBe(expected);
  });
});
