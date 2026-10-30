/**
 * Reviewer-authored (DR-080, FRD-21 gate): boundaries the builder's suite does not reach. Each row carries one
 * fact the FDD or the oracle fixes.
 */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { WorktreesRepo } from "@/lib/pendingMerge/worktreesByRepo";
import { readWorktreesByRepo } from "@/lib/pendingMerge/worktreesByRepo";
import { WorktreesCard } from "../WorktreesCard";

function withBranch(ageHours: number, leftovers = 0, ahead = 1): WorktreesRepo {
  return {
    kind: "ok",
    name: "Proyecto",
    path: "/fixture/project",
    branches: [
      {
        name: "lane/one",
        subject: "feat: one",
        origin: "lane",
        ageHours,
        ahead,
        uncommitted: 0,
        worktree: null,
      },
    ],
    leftovers,
    locked: 0,
    state: "reviewSoon",
  };
}

async function openDialog(row: WorktreesRepo): Promise<HTMLElement> {
  render(<WorktreesCard rows={[row]} />);
  await userEvent.setup().click(screen.getByRole("button", { name: row.name }));
  return screen.getByRole("dialog");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

it.each([
  [47, "hace 47 h"],
  [48, "hace 2 días"],
])("FDD ages: %i hours read «%s» at the 48 hour boundary", async (hours, text) => {
  expect(await openDialog(withBranch(hours))).toHaveTextContent(text);
});

it("FDD ages: the frozen oracle branch of 70 hours reads «hace 3 días», as the mock draws it", async () => {
  expect(await openDialog(withBranch(70))).toHaveTextContent("hace 3 días");
});

it("FDD copy: singular forms of the dialog", async () => {
  const dialog = await openDialog(withBranch(1, 1));
  expect(dialog).toHaveTextContent("1 rama sin integrar y 1 worktree sobrante.");
  expect(dialog).toHaveTextContent("1 commit fuera de main");
});

it("AC-21-007.3: the dialog offers the cleanup command for that folder", async () => {
  const dialog = await openDialog(withBranch(1));
  expect(dialog).toHaveTextContent("Corre en la carpeta de Proyecto para depurarlo:");
  expect(within(dialog).getByRole("button", { name: "Copiar /pandacorp:worktrees" })).toBeVisible();
});

it("AC-21-007.1: a row with only leftovers opens, and shows its dash in Sin integrar", async () => {
  const onlyLeftover: WorktreesRepo = { ...withBranch(1, 1), branches: [] };
  const dialog = await openDialog(onlyLeftover);
  expect(dialog).toHaveTextContent("0 ramas sin integrar y 1 worktree sobrante.");
});

it("REQ-21-005: the surface offers no merge or delete action", () => {
  render(<WorktreesCard rows={[withBranch(1)]} />);
  const names = screen.getAllByRole("button").map((button) => button.textContent ?? "");
  expect(names.filter((name) => /merge|borrar|eliminar|integrar/i.test(name))).toEqual([]);
});

it("REQ-21-006: a real git failure reads in Spanish in the notice, never as a raw English exception", () => {
  const root = mkdtempSync(path.join(tmpdir(), "wt-reason-"));
  const plain = path.join(root, "plain");
  mkdirSync(plain);
  vi.stubEnv("MC_GIT_FIXTURE", undefined as unknown as string);
  vi.stubEnv("GIT_CEILING_DIRECTORIES", root);
  try {
    render(<WorktreesCard rows={readWorktreesByRepo([{ name: "PandaSaga", path: plain }])} />);
    const notice = screen.getByRole("alert");
    expect(notice).toHaveTextContent("PandaSaga:");
    expect(notice).toHaveTextContent("git worktree list terminó con error");
    expect(notice).not.toHaveTextContent(/Git read failed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
