/**
 * Reviewer-authored integration suite for REQ-04-011 (FRD-04 gate, DR-015/DR-080):
 * the real change-queue reader → ChangesPanel → ChangeCard (relative date + raw tooltip)
 * → ChangeDetail (keeps the raw date). The viewer's zone is pinned to the owner's
 * (America/Lima) so the day boundary is deterministic on any runner.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { type ChangeQueueItem, readChangeQueue } from "@/lib/changes/changes";
import { ChangeCard } from "../ChangeCard";
import { ChangesPanel } from "../ChangesPanel";

const ORIGINAL_TZ = process.env.TZ;
const PANEL_PROPS = { projectPath: "/tmp/proj", slug: "mission-control" } as const;
const tempDirs: string[] = [];

beforeAll(() => {
  process.env.TZ = "America/Lima";
});

afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

afterEach(() => {
  vi.useRealTimers();
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function atLocal(iso: string): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

function makeItem(over: Partial<ChangeQueueItem>): ChangeQueueItem {
  return {
    id: "mc-review-card",
    type: "change",
    cls: "standard",
    status: "ready",
    date: "2026-09-23",
    frd: "",
    rebuildsVerified: false,
    dependsOn: "",
    implementedSha: "",
    closingAt: "",
    title: "Fecha relativa en la tarjeta",
    body: "## Qué se quiere\nFecha relativa.",
    ...over,
  };
}

/** A project dir with one real change file whose `date` is an UNQUOTED YAML date. */
function projectWithChange(dateLine: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-frd04-review-"));
  tempDirs.push(root);
  const dir = path.join(root, ".pandacorp", "inbox", "changes");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "mc-rel-date.md"),
    [
      "---",
      "type: feature",
      "class: standard",
      "status: ready",
      dateLine,
      "frd: frd-04-project-workspace",
      "---",
      "# Fecha relativa en la tarjeta",
      "",
      "## Qué se quiere",
      "Ver la fecha como 'ayer'.",
      "",
    ].join("\n"),
  );
  return root;
}

describe("REQ-04-011 · reader → panel → card integration", () => {
  it("an unquoted YAML date read by the real reader renders as a relative label with the raw date as tooltip", () => {
    atLocal("2026-09-24T12:00:00-05:00");
    const result = readChangeQueue(projectWithChange("date: 2026-09-23"));
    expect(result.errors).toEqual([]);
    render(<ChangesPanel {...PANEL_PROPS} result={result} />);

    const dateEl = screen.getByTestId("change-card-date");
    expect(dateEl).toHaveTextContent(/^ayer$/);
    expect(dateEl).toHaveAttribute("title", "2026-09-23");
    expect(screen.getByTestId("change-card")).not.toHaveTextContent("2026-09-23");
    expect(screen.getByText("frd-04-project-workspace")).toBeInTheDocument();
  });

  it("opening the card's detail keeps the RAW date (the modal is out of the relative-label scope)", async () => {
    atLocal("2026-09-24T12:00:00-05:00");
    const user = userEvent.setup();
    render(<ChangesPanel {...PANEL_PROPS} result={{ items: [makeItem({})], errors: [] }} />);
    expect(screen.queryByText("2026-09-23")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("change-card-button"));
    expect(screen.getByText("2026-09-23")).toBeInTheDocument();
  });
});

describe("REQ-04-011 · the owner's evening (UTC-5): today is 'hoy', not 'ayer'", () => {
  it("a card created today at 21:48 local (the canario-d change card) reads 'hoy'", () => {
    atLocal("2026-09-24T21:48:57-05:00");
    render(<ChangeCard item={makeItem({ date: "2026-09-24" })} />);
    expect(screen.getByTestId("change-card-date")).toHaveTextContent(/^hoy$/);
  });

  it("a card from yesterday reads 'ayer' at 23:30 local", () => {
    atLocal("2026-09-24T23:30:00-05:00");
    render(<ChangeCard item={makeItem({ date: "2026-09-23" })} />);
    expect(screen.getByTestId("change-card-date")).toHaveTextContent(/^ayer$/);
  });
});

describe("REQ-04-011 · an unparseable date is shown raw, never a fabricated age", () => {
  it.each(["N/A 3", "2026-02-30"])("date %s is visible verbatim on the card", (raw) => {
    atLocal("2026-09-24T12:00:00-05:00");
    render(<ChangeCard item={makeItem({ date: raw })} />);
    const dateEl = screen.getByTestId("change-card-date");
    expect(dateEl).toHaveTextContent(raw);
    expect(dateEl).not.toHaveTextContent(/hace|hoy|ayer/);
  });

  it("a garbage date never crashes the card and keeps the FRD part", () => {
    atLocal("2026-09-24T12:00:00-05:00");
    render(<ChangeCard item={makeItem({ date: "¿¿??", frd: "FRD-04" })} />);
    expect(screen.getByTestId("change-card-date")).toHaveTextContent("¿¿??");
    expect(screen.getByText("FRD-04")).toBeInTheDocument();
  });
});

describe("REQ-04-011 · evidence-line edge cases", () => {
  it("FRD only (no date): shows the FRD, no date node and no dangling separator", () => {
    atLocal("2026-09-24T12:00:00-05:00");
    render(<ChangeCard item={makeItem({ date: "", frd: "FRD-04" })} />);
    expect(screen.getByText("FRD-04")).toBeInTheDocument();
    expect(screen.queryByTestId("change-card-date")).not.toBeInTheDocument();
    expect(screen.queryByText("·")).not.toBeInTheDocument();
  });

  it("date only (no FRD): the label renders with no dangling separator", () => {
    atLocal("2026-09-24T12:00:00-05:00");
    render(<ChangeCard item={makeItem({ date: "2026-09-19", frd: "" })} />);
    expect(screen.getByTestId("change-card-date")).toHaveTextContent(/^hace 5 días$/);
    expect(screen.queryByText("·")).not.toBeInTheDocument();
  });

  it("neither date nor FRD: no evidence text at all, title and id still render", () => {
    atLocal("2026-09-24T12:00:00-05:00");
    render(<ChangeCard item={makeItem({ date: "", frd: "" })} />);
    expect(screen.queryByTestId("change-card-date")).not.toBeInTheDocument();
    expect(screen.getByTestId("change-card-title")).toHaveTextContent(
      "Fecha relativa en la tarjeta",
    );
    expect(screen.getByTestId("change-card-id")).toHaveTextContent("mc-review-card");
  });
});
