/**
 * Reviewer-authored (DR-080, FRD-21 gate): the mount over the frozen oracle seed (factory root, portfolio and
 * git-state.json through the real fixture seam, never a mock of the reader), asserted against the rows the
 * mock draws for `worktrees-card`, `worktrees-unreadable` and the hook `worktrees-factory-dialog` clicks.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FactoryWorktrees } from "../FactoryWorktrees";

const FIXTURES = path.resolve("docs/design/prototype/fixtures");
const overlay: { dir: string | null } = { dir: null };

function repoNames(): (string | undefined)[] {
  const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
  return rows.map((row) => within(row).getByRole("button").textContent ?? undefined);
}

beforeEach(() => {
  vi.stubEnv("PANDACORP_FACTORY_ROOT", path.join(FIXTURES, "factory-root"));
  vi.stubEnv("MC_GIT_FIXTURE", path.join(FIXTURES, "git-state.json"));
  vi.stubEnv("MC_CLOCK", "2026-10-21T00:20:00.000Z");
});
afterEach(() => {
  vi.unstubAllEnvs();
  if (overlay.dir) rmSync(overlay.dir, { recursive: true, force: true });
  overlay.dir = null;
});

it("AC-21-007.1, REQ-21-006: the oracle seed draws its five repositories and no unreadable row", () => {
  render(<FactoryWorktrees />);
  expect(repoNames()).toEqual([
    "Funko Tracker",
    "Fábrica",
    "PersonalPage v2",
    "PandaSaga",
    "PandaCast",
  ]);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("AC-21-007.2: the factory row carries the recorded hook of the factory dialog state", () => {
  render(<FactoryWorktrees />);
  expect(screen.getByRole("button", { name: "Fábrica" })).toHaveAttribute(
    "data-wt-repo",
    "factory",
  );
});

it("REQ-21-006: the unreadable repository stays in its drawn place and the notice precedes the legend", () => {
  overlay.dir = mkdtempSync(path.join(tmpdir(), "wt-oracle-"));
  const file = path.join(overlay.dir, "git-state.json");
  const seed = JSON.parse(readFileSync(path.join(FIXTURES, "git-state.json"), "utf8")) as object;
  writeFileSync(file, JSON.stringify({ ...seed, scenario: "worktrees-unreadable" }));
  vi.stubEnv("MC_GIT_FIXTURE", file);
  render(<FactoryWorktrees />);
  expect(repoNames().filter((name) => !name?.includes("Mission Control"))).toEqual([
    "Funko Tracker",
    "Fábrica",
    "PersonalPage v2",
    "PandaSaga",
    "PandaCast",
  ]);
  const notice = screen
    .getAllByRole("alert")
    .find((alert) => alert.textContent?.includes("PandaSaga"));
  expect(notice).toHaveTextContent("git worktree list terminó con error");
  const legend = screen.getByTestId("worktrees-legend");
  expect((notice?.compareDocumentPosition(legend) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
});
