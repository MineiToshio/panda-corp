/**
 * FRD-04 gate — reviewer-authored integration suite for the Changes tab's relative date
 * (REQ-04-011, WO-04-008), exercised TOGETHER with the rest of the feature: the real
 * `readChangeQueue` reader over real change files → `ChangesPanel` → `ChangeCard`
 * (+ the `ChangeDetail` modal, which deliberately keeps the raw date).
 *
 * Builder-blind (DR-080). Pinned to the owner's real zone (America/Lima, UTC-5) at 21:00 local:
 * the hour window where a UTC day boundary would already call today's change "ayer".
 *
 * Traceability:
 *   REQ-04-011 / AC-04-011.3  card shows the relative label (+ FRD), raw date kept as a tooltip
 *   REQ-04-011 error clause   an unparseable date (prose, impossible day) is shown RAW, never hidden
 *   REQ-04-007 / DR-078       a malformed file still raises the fail-loud banner alongside the cards
 *   WO-04-008 exclusion       the detail modal keeps the raw ISO date
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readChangeQueue } from "@/lib/changes/changes";
import { ChangesPanel } from "../ChangesPanel";

/** 2026-09-24 21:00 in America/Lima (UTC-5) — already 2026-09-25 in UTC. */
const LIMA_EVENING = new Date("2026-09-25T02:00:00.000Z");
const PANEL_PROPS = { slug: "mission-control" } as const;

let projectPath: string;
let changesDir: string;
let previousTz: string | undefined;

function writeChange(filename: string, frontmatter: string, title: string): void {
  const body = `---\n${frontmatter}\n---\n\n# ${title}\n\n## Qué se quiere\nAlgo concreto.\n`;
  fs.writeFileSync(path.join(changesDir, filename), body, "utf-8");
}

function cardDate(title: string): HTMLElement {
  const card = screen.getByRole("button", { name: `Ver detalle del cambio: ${title}` });
  return within(card).getByTestId("change-card-date");
}

function renderQueue(): void {
  const result = readChangeQueue(projectPath);
  render(<ChangesPanel {...PANEL_PROPS} projectPath={projectPath} result={result} />);
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
  projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "mc-changes-reldate-"));
  changesDir = path.join(projectPath, ".pandacorp", "inbox", "changes");
  fs.mkdirSync(changesDir, { recursive: true });
});

afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(projectPath, { recursive: true, force: true });
});

describe("Changes tab — relative date through reader → panel → card (REQ-04-011)", () => {
  it("a change filed today (unquoted YAML date) reads 'hoy' at 21:00 local, raw date as tooltip", () => {
    writeChange(
      "today-change.md",
      "type: feature\nclass: standard\nstatus: ready\ndate: 2026-09-24\nfrd: frd-04",
      "Cambio de hoy",
    );
    writeChange(
      "yesterday-change.md",
      "type: bug\nclass: standard\nstatus: draft\ndate: 2026-09-23\nfrd:",
      "Cambio de ayer",
    );
    renderQueue();

    const today = cardDate("Cambio de hoy");
    expect(today).toHaveTextContent(/^hoy$/);
    expect(today).toHaveAttribute("title", "2026-09-24");
    const todayCard = screen.getByRole("button", { name: "Ver detalle del cambio: Cambio de hoy" });
    expect(within(todayCard).getByText("frd-04")).toBeInTheDocument();

    expect(cardDate("Cambio de ayer")).toHaveTextContent(/^ayer$/);
  });

  it("an unparseable date (prose or an impossible day) is shown RAW on the card, never an invented age", () => {
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

    const prose = cardDate("Fecha en prosa");
    expect(prose).toHaveTextContent(/^N\/A 3$/);
    expect(prose.textContent ?? "").not.toMatch(/hace|hoy|ayer/);

    const impossible = cardDate("Fecha imposible");
    expect(impossible).toHaveTextContent(/^2026-02-30$/);
  });

  it("a malformed file still raises the fail-loud banner while dated cards render (DR-078)", () => {
    writeChange(
      "today-change.md",
      "type: feature\nclass: standard\nstatus: ready\ndate: 2026-09-24",
      "Cambio de hoy",
    );
    writeChange("broken.md", "type: nonsense\nstatus: ready\ndate: 2026-09-24", "Roto");
    renderQueue();

    expect(screen.getByRole("alert")).toHaveTextContent("broken.md");
    expect(cardDate("Cambio de hoy")).toHaveTextContent(/^hoy$/);
  });

  it("the detail modal keeps the raw ISO date (out of WO-04-008 scope)", async () => {
    writeChange(
      "today-change.md",
      "type: feature\nclass: standard\nstatus: ready\ndate: 2026-09-24",
      "Cambio de hoy",
    );
    renderQueue();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Ver detalle del cambio: Cambio de hoy" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("2026-09-24")).toBeInTheDocument();
    expect(within(dialog).queryByText("hoy")).not.toBeInTheDocument();
  });
});
