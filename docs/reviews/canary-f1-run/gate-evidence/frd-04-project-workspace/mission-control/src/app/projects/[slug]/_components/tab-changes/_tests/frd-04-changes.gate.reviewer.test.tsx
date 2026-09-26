import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ChangeQueueItem, countPendingBugs, readChangeQueue } from "@/lib/changes/changes";
import { ChangesPanel } from "../ChangesPanel";

/**
 * FRD-04 gate — reviewer-authored integration suite (builder-blind, DR-080) for the
 * Changes tab: the REAL reader (`readChangeQueue`) over real queue files feeding the
 * REAL panel + card, so the relative date (REQ-04-011), the raw-date fallback, the
 * in-flight groups and the pending-count exclusion (REQ-04-010) are judged together.
 *
 * Every clock is built with the LOCAL-time Date constructor: "hoy"/"ayer" mean the
 * owner's wall-clock calendar day, so each assertion holds in any timezone.
 */

const PANEL_PROPS = { projectPath: "/tmp/proj", slug: "mission-control" } as const;

let projectPath: string;
let changesDir: string;

function writeChange(filename: string, frontmatter: string, title: string, subdir = ""): void {
  const dir = subdir === "" ? changesDir : path.join(changesDir, subdir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, filename),
    `---\n${frontmatter}\n---\n\n# ${title}\n\n## Qué se quiere\nAlgo concreto.\n`,
    "utf-8",
  );
}

function readItems(): ChangeQueueItem[] {
  const result = readChangeQueue(projectPath);
  expect(result.errors).toEqual([]);
  return result.items;
}

function cardDateFor(title: string): HTMLElement {
  const card = screen.getByRole("button", { name: `Ver detalle del cambio: ${title}` });
  return within(card).getByTestId("change-card-date");
}

beforeEach(() => {
  projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "mc-frd04-gate-"));
  changesDir = path.join(projectPath, ".pandacorp", "inbox", "changes");
  fs.mkdirSync(changesDir, { recursive: true });
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(projectPath, { recursive: true, force: true });
});

describe("FRD-04 gate — Changes card relative date through the real reader (REQ-04-011)", () => {
  it("an unquoted YAML date filed today reads 'hoy' on the card late in the owner's evening", () => {
    vi.setSystemTime(new Date(2026, 8, 24, 21, 0, 0, 0));
    writeChange(
      "evening.md",
      "type: feature\nclass: standard\nstatus: ready\ndate: 2026-09-24\nfrd: frd-04-project-workspace",
      "Cambio de esta tarde",
    );
    render(<ChangesPanel {...PANEL_PROPS} result={{ items: readItems(), errors: [] }} />);
    const dateEl = cardDateFor("Cambio de esta tarde");
    expect(dateEl).toHaveTextContent(/^hoy$/);
    expect(dateEl).toHaveAttribute("title", "2026-09-24");
  });

  it("every visible group (Listos, Borradores, En construcción, Cerrando) shows relative labels with the raw date as tooltip", () => {
    vi.setSystemTime(new Date(2026, 8, 24, 12, 0, 0, 0));
    writeChange("a.md", "type: feature\nstatus: ready\ndate: 2026-09-24", "Listo de hoy");
    writeChange("b.md", "type: bug\nstatus: draft\ndate: 2026-09-23", "Borrador de ayer");
    writeChange("c.md", "type: change\nstatus: building\ndate: 2026-09-14", "En vuelo");
    writeChange(
      "d.md",
      "type: change\nstatus: closing\ndate: 2026-06-20\nimplemented_sha: abc1234\nclosing_at: 2026-09-24T10:00:00.000Z",
      "Cerrándose",
    );
    render(<ChangesPanel {...PANEL_PROPS} result={{ items: readItems(), errors: [] }} />);

    expect(cardDateFor("Listo de hoy")).toHaveTextContent(/^hoy$/);
    expect(cardDateFor("Borrador de ayer")).toHaveTextContent(/^ayer$/);
    expect(cardDateFor("En vuelo")).toHaveTextContent(/^hace 10 días$/);
    expect(cardDateFor("Cerrándose")).toHaveTextContent(/^hace 3 meses$/);
    expect(cardDateFor("Cerrándose")).toHaveAttribute("title", "2026-06-20");
    // No raw ISO date leaks into any card's visible date text.
    for (const el of screen.getAllByTestId("change-card-date")) {
      expect(el.textContent ?? "").not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });

  it("an archived Hecho shows the relative label once its toggle is opened", async () => {
    vi.setSystemTime(new Date(2026, 8, 24, 12, 0, 0, 0));
    writeChange("done-one.md", "type: bug\nstatus: done\ndate: 2026-09-21", "Ya hecho", "done");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ChangesPanel {...PANEL_PROPS} result={{ items: readItems(), errors: [] }} />);
    await user.click(screen.getByRole("button", { name: /ver hechos \(1\)/i }));
    expect(cardDateFor("Ya hecho")).toHaveTextContent(/^hace 3 días$/);
  });

  it("a quoted non-date the owner typed is shown RAW on the card, never turned into a fabricated age", () => {
    vi.setSystemTime(new Date(2026, 8, 24, 12, 0, 0, 0));
    writeChange("junk.md", 'type: feature\nstatus: ready\ndate: "pendiente 1"', "Fecha a medias");
    render(<ChangesPanel {...PANEL_PROPS} result={{ items: readItems(), errors: [] }} />);
    const dateEl = cardDateFor("Fecha a medias");
    expect(dateEl).toHaveTextContent(/^pendiente 1$/);
    expect(dateEl.textContent ?? "").not.toMatch(/hace/);
  });

  it("the detail modal keeps the raw ISO date (the relative label is card-only)", async () => {
    vi.setSystemTime(new Date(2026, 8, 24, 12, 0, 0, 0));
    writeChange(
      "modal.md",
      "type: feature\nstatus: ready\ndate: 2026-09-19\nfrd: frd-04-project-workspace",
      "Abrir detalle",
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ChangesPanel {...PANEL_PROPS} result={{ items: readItems(), errors: [] }} />);
    expect(cardDateFor("Abrir detalle")).toHaveTextContent(/^hace 5 días$/);
    await user.click(screen.getByRole("button", { name: "Ver detalle del cambio: Abrir detalle" }));
    const detail = screen.getByTestId("change-detail");
    expect(within(detail).getByText("2026-09-19")).toBeInTheDocument();
    expect(within(detail).getByText("/pandacorp:implement change:modal")).toBeInTheDocument();
  });
});

describe("FRD-04 gate — in-flight items never count as pending (REQ-04-010)", () => {
  it("building/closing/done/discarded bugs are excluded; only ready/draft bugs count", () => {
    writeChange("r.md", "type: bug\nstatus: ready\ndate: 2026-09-20", "Bug listo");
    writeChange("d.md", "type: bug\nstatus: draft\ndate: 2026-09-20", "Bug borrador");
    writeChange("b.md", "type: bug\nstatus: building\ndate: 2026-09-20", "Bug construyendo");
    writeChange(
      "c.md",
      "type: bug\nstatus: closing\ndate: 2026-09-20\nimplemented_sha: abc1234",
      "Bug cerrando",
    );
    writeChange("x.md", "type: bug\nstatus: discarded\ndate: 2026-09-20", "Bug descartado");
    writeChange("h.md", "type: bug\nstatus: done\ndate: 2026-09-20", "Bug hecho", "done");
    expect(readItems()).toHaveLength(6);
    expect(countPendingBugs(projectPath)).toBe(2);
  });
});
