/**
 * FRD-04 gate: the Cambios date slot through the real reader, panel, card and dialog (REQ-04-011),
 * pinned to the owner's zone at the hour where a UTC day boundary would move a date-only value.
 *
 * Traceability:
 *   REQ-04-011  absolute Spanish date on the card, raw date as tooltip
 *   REQ-04-011  an unparseable date is shown raw in the same slot, never hidden
 *   Cambios bullet / DR-078  a malformed file raises the banner alongside the dated cards
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readChangeQueue } from "@/lib/changes/changes";
import { ChangesPanel } from "../ChangesPanel";

vi.mock("../../../_actions/discard-change", () => ({ discardChangeAction: vi.fn() }));

/** 2026-10-19 21:00 in America/Lima: already 2026-10-20 in UTC. */
const LIMA_EVENING = new Date("2026-10-20T02:00:00.000Z");

let projectPath: string;
let changesDir: string;
let previousTz: string | undefined;

function writeChange(filename: string, frontmatter: string, title: string): void {
  const body = `---\n${frontmatter}\n---\n\n# ${title}\n\n## Qué se quiere\nAlgo concreto.\n`;
  fs.writeFileSync(path.join(changesDir, filename), body, "utf-8");
}
function row(title: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(title) });
}
function renderQueue(): void {
  render(
    <ChangesPanel
      slug="mission-control"
      projectPath={projectPath}
      result={readChangeQueue(projectPath)}
    />,
  );
}

beforeAll(() => {
  previousTz = process.env.TZ;
  process.env.TZ = "America/Lima";
});
afterAll(() => {
  if (previousTz === undefined) delete process.env.TZ;
  else process.env.TZ = previousTz;
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(LIMA_EVENING);
  window.history.replaceState(null, "", "/portfolio/mission-control/changes");
  projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "mc-changes-date-"));
  changesDir = path.join(projectPath, ".pandacorp", "inbox", "changes");
  fs.mkdirSync(changesDir, { recursive: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  fs.rmSync(projectPath, { recursive: true, force: true });
});

describe("Cambios date slot (REQ-04-011)", () => {
  it("an unquoted YAML date reads as the absolute day, with no relative word, raw date as tooltip", () => {
    writeChange(
      "today-change.md",
      "type: feature\nclass: standard\nstatus: ready\ndate: 2026-10-19\nfrd: frd-04",
      "Cambio de hoy",
    );
    renderQueue();

    expect(row("Cambio de hoy")).toHaveTextContent("today-change · 19 oct. 2026 · frd-04");
    expect(row("Cambio de hoy").textContent).not.toMatch(/\bhoy\b.*\bhoy\b|hace|ayer/);
    expect(row("Cambio de hoy").closest("[title]")).toHaveAttribute("title", "2026-10-19");
  });

  it("an unparseable date stays raw in the same slot, never hidden and never invented", () => {
    writeChange(
      "prose-date.md",
      "type: change\nclass: standard\nstatus: ready\ndate: N/A 3",
      "Fecha en prosa",
    );
    writeChange(
      "impossible-date.md",
      'type: change\nclass: standard\nstatus: draft\ndate: "2026-02-30"',
      "Fecha imposible",
    );
    renderQueue();

    expect(row("Fecha en prosa")).toHaveTextContent("prose-date · N/A 3");
    expect(row("Fecha imposible")).toHaveTextContent("impossible-date · 2026-02-30");
  });

  it("a malformed file raises the fail-loud banner naming it while dated cards render", () => {
    writeChange(
      "good.md",
      "type: feature\nclass: standard\nstatus: ready\ndate: 2026-10-19",
      "Cambio bueno",
    );
    writeChange("broken.md", "type: nonsense\nstatus: ready\ndate: 2026-10-19", "Roto");
    renderQueue();

    expect(screen.getByRole("alert")).toHaveTextContent("broken.md");
    expect(screen.getByRole("alert")).toHaveTextContent("No se cuentan como cola vacía");
    expect(row("Cambio bueno")).toHaveTextContent("19 oct. 2026");
  });

  it("an empty queue states it; files the reader rejected never read as an empty queue", () => {
    renderQueue();
    expect(screen.getByText("No hay cambios abiertos en la cola.")).toBeInTheDocument();
    cleanup();

    writeChange("broken.md", "type: nonsense\nstatus: ready", "Roto");
    renderQueue();
    expect(screen.queryByText("No hay cambios abiertos en la cola.")).not.toBeInTheDocument();
  });

  it("the detail dialog shows the same absolute date with the raw date as tooltip", async () => {
    writeChange(
      "today-change.md",
      "type: feature\nclass: standard\nstatus: ready\ndate: 2026-10-19",
      "Cambio de hoy",
    );
    renderQueue();
    await userEvent.setup().click(row("Cambio de hoy"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("19 oct. 2026")).toHaveAttribute("title", "2026-10-19");
  });
});
