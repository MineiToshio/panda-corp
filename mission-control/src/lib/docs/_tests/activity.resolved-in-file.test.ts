import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { countPendingDecisions, isEngineLogEntry, parseDecisionBlocks } from "../activity";

it("AC-04-014.5: PersonalPage resolution wins without changing the heading id", () => {
  const content =
    "## 2026-07-01 (necesita tu acción) — ·  Elegir versión\n**Estado:** ✅ RESUELTO 2026-07-01";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "resolved-decision-"));
  try {
    fs.mkdirSync(path.join(dir, ".pandacorp/inbox"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".pandacorp/inbox/decisions.md"), content);
    expect(parseDecisionBlocks(content)).toEqual([
      {
        id: "2026-07-01-1",
        title: "Elegir versión",
        date: "2026-07-01",
        status: "resolved",
        resolved: true,
        resolvedInFile: true,
      },
    ]);
    expect(countPendingDecisions(dir)).toBe(0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

it.each([
  ["", "Estado: ✅ RESUELTO", "resolved", true],
  ["(RESUELTO)", "- **Estado:** RESUELTO", "resolved", undefined],
  ["(OBSOLETO)", "Estado: OBSOLETO", "obsolete", undefined],
  ["", "+ **Estado**: ❌ SUPERSEDIDO", "obsolete", undefined],
  ["", "* Estado: ⏳ PENDIENTE", "pending", undefined],
  ["(RESUELTO)", "**Estado:** desconocido", "resolved", undefined],
  ["", "Texto **Estado:** RESUELTO", "pending", undefined],
  ["", "Estado: RESUELTOincorrecto", "pending", undefined],
])("AC-04-014.5: heading %s, body %s", (heading, body, status, marker) => {
  const [point] = parseDecisionBlocks(`## 2026-07-01 ${heading} — Tema\n${body}`);
  expect(point?.status).toBe(status);
  expect(point?.resolvedInFile).toBe(marker);
});

it.each([
  ["T12:30 motor", true],
  ["12:30 motor", true],
  ["2026-10-20T08:00 motor", true],
  ["2026-10-20 Elegir versión", false],
  ["Elegir a las 12:30", false],
])("classifies engine title %s", (title, expected) => {
  expect(isEngineLogEntry({ title })).toBe(expected);
});

it("preserves the golden fixture's ordered ids across body status changes", () => {
  const fixture = fs.readFileSync(path.join(__dirname, "fixtures/decisions-golden.md"), "utf8");
  const ids = [
    "2026-08-01-1",
    "2026-08-01-2",
    "legacy-1",
    "legacy-2",
    "legacy-3",
    "2026-08-15-1",
    "2026-08-20-1",
  ];
  for (const content of [fixture, fixture.replaceAll("RESUELTO", "✅ RESUELTO")]) {
    expect(parseDecisionBlocks(content).map((point) => point.id)).toEqual(ids);
  }
});
