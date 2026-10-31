/**
 * FRD-17 — REVIEWER composition gate test (DR-015 / DR-050), rewritten for the v2 surface.
 *
 * Renders the REAL ProposalsPage over a REAL temporary factory: a "SHALL show" criterion is only
 * met by what the page composes, not by a component that renders nowhere.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProposalsPage from "../page";

let root: string;
const write = (relative: string, content: string): void => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-frd17-page-"));
  vi.stubEnv("PANDACORP_FACTORY_ROOT", root);
  vi.stubEnv("MC_CLOCK", "2026-10-30T12:00:00Z");
  write("factory/memory/_last-sweep", "2026-10-30T00:00:00Z");
  write(
    "factory/memory/LESSON-0003.md",
    "---\nid: LESSON-0003\ntype: gotcha\ndomain: testing\nstatus: active\npromotion: proposed\ncontext: Queued lesson\nsource: proj-alpha (x), proj-beta (y)\n---\n**Situation:** S.\n",
  );
  write(
    "factory/backlog/BL-0001-urgent.md",
    "---\nid: BL-0001\ntype: bug\nstatus: open\narea: hooks\nseverity: p0\ntitle: Urgent item\n---\n## Problem\nP.\n",
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("FRD-17 gate: the proposals page composes the full feature surface", () => {
  it("mounts three volatile panels, Resumen active, with no nested main (AC-22-002.1..4)", () => {
    render(<ProposalsPage />);
    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    expect(panels).toHaveLength(3);
    expect(panels.filter((panel) => !panel.hidden)).toHaveLength(1);
    for (const panel of panels) expect(panel).toHaveAttribute("data-volatile");
    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.getByRole("tab", { name: /Resumen/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Backlog 1/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Memoria 1/ })).toBeInTheDocument();
  });

  it("shows the ordered actions with count, command and a link, and the calm strip", () => {
    render(<ProposalsPage />);
    const list = screen.getByRole("list");
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.querySelector("h3")?.textContent)).toEqual([
      "1 problema urgente en la fábrica",
      "1 lección espera tu sí o no",
    ]);
    expect(within(rows[0] as HTMLElement).getByRole("link")).toHaveAttribute(
      "href",
      "/proposals/backlog",
    );
    expect(screen.getByText("La memoria se revisa sola.")).toBeVisible();
  });

  it("an unreadable memory store is a named error on its card, never zero (blueprint Contracts)", () => {
    fs.rmSync(path.join(root, "factory/memory"), { recursive: true, force: true });
    write("factory/memory", "not a directory");
    render(<ProposalsPage />);
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    expect(screen.queryByText("La memoria se revisa sola.")).toBeNull();
  });
});
