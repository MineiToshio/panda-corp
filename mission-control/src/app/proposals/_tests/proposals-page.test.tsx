import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadProposalsData } from "@/lib/proposals/data";
import ProposalsPage from "../page";

let fixture: string;
beforeEach(() => {
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), "s3c-proposals-"));
  vi.stubEnv("PANDACORP_FACTORY_ROOT", fixture);
  vi.stubEnv("MC_CLOCK", "2026-10-30T12:00:00Z");
  fs.mkdirSync(path.join(fixture, "factory/memory"), { recursive: true });
  fs.writeFileSync(path.join(fixture, "factory/memory/_last-sweep"), "2026-10-30T00:00:00Z");
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(fixture, { recursive: true, force: true });
});
describe("Proposals page composition", () => {
  it("AC-17-004.6 AC-17-011.1 AC-22-002.2 renders the calm default without a main of its own", () => {
    render(<ProposalsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Propuestas" })).toBeInTheDocument();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getAllByText("Nada necesita tu decisión ahora.", { selector: "p" })[0],
    ).toBeVisible();
    expect(screen.getByText("La memoria se revisa sola")).toBeVisible();
  });
  it("AC-17-001.3 AC-17-011.4 mounts waiting, collapsed candidates, and conditional pruning in order", () => {
    fs.writeFileSync(
      path.join(fixture, "factory/memory/LESSON-1.md"),
      "---\nid: LESSON-1\ntype: pattern\ndomain: quality\nstatus: active\npromotion: proposed\ncontext: Real queued lesson\n---\n## Proof\nEvidence",
    );
    fs.writeFileSync(
      path.join(fixture, "factory/memory/LESSON-2.md"),
      "---\nid: LESSON-2\ntype: gotcha\ndomain: quality\nstatus: deprecated\ncontext: Obsolete lesson\n---\nProof",
    );
    render(<ProposalsPage />);
    fireEvent.click(screen.getByRole("tab", { name: /Memoria/ }));
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((x) => x.textContent)
        .join(" "),
    ).toMatch(/Cómo avanza.*Esperan tu decisión.*Para podar/);
    expect(screen.getByText("No piden nada")).toBeVisible();
  });
  it("distinguishes a malformed lesson from an unreadable memory store", () => {
    fs.writeFileSync(path.join(fixture, "factory/memory/LESSON-9.md"), "---\nbroken: [\n---\n");
    expect(loadProposalsData().lessons).toEqual([]);
    fs.renameSync(
      path.join(fixture, "factory/memory"),
      path.join(fixture, "factory/memory-backup"),
    );
    fs.writeFileSync(path.join(fixture, "factory/memory"), "not a directory");
    render(<ProposalsPage />);
    expect(screen.getByRole("alert")).toBeVisible();
    expect(
      screen.queryByText("Nada necesita tu decisión ahora.", { selector: "p" }),
    ).not.toBeInTheDocument();
  });
});
