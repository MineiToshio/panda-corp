import { expect, it, vi } from "vitest";
import { runGit } from "@/lib/git/git";
import { readWorktreesByRepo } from "../worktreesByRepo";

vi.mock("@/lib/git/git", () => ({ runGit: vi.fn() }));
it("FRD-21: integration, attempts and assumptions remain engine branches after worktree cleanup", () => {
  const branches = [
    "lane/run-a/integration",
    "lane/run-a/u-build",
    "lane/run-a/u-build-a2",
    "lane/run-a/assume-d-1",
  ];
  vi.mocked(runGit).mockImplementation((args) => {
    if (args[0] === "worktree")
      return `worktree /fixture/project\nHEAD ${"0".repeat(40)}\nbranch refs/heads/main\n`;
    if (args[0] === "branch") return branches.map((name) => `refs/heads/${name}`).join("\n");
    if (args.includes("--format=%ct")) return "1794484800";
    if (args.includes("--format=%s")) return "Pending work";
    return "1";
  });
  const row = readWorktreesByRepo([{ name: "Project", path: "/fixture/project" }])[0];
  expect(row?.kind).toBe("ok");
  if (row?.kind !== "ok") throw new Error("Invalid fixture");
  expect(row.branches.map((b) => b.name)).toEqual(branches);
  expect(row.branches.every((b) => b.origin === "lane" && b.worktree === null)).toBe(true);
  expect(row.leftovers).toBe(0);
});
