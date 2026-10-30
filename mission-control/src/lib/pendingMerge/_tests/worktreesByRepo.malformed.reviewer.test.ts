/**
 * Reviewer-authored (DR-078, DR-080, FRD-21 gate): an unrecognised `git branch` shape is a read failure. Only
 * git's own parenthesised HEAD description may be skipped; any other line must not vanish into "Limpio".
 */
import { describe, expect, it, vi } from "vitest";
import { runGit } from "@/lib/git/git";
import { summarizeWorktrees } from "../pillSummary";
import { readWorktreesByRepo } from "../worktreesByRepo";

vi.mock("@/lib/git/git", () => ({ runGit: vi.fn() }));
const INSTANT = Date.parse("2026-10-22T12:00:00Z");
const REPO = { name: "Proyecto", path: "/fixture/project" };
const PORCELAIN = `worktree /fixture/project\nHEAD ${"0".repeat(40)}\nbranch refs/heads/main`;

function withBranchOutput(output: string): void {
  vi.mocked(runGit).mockImplementation((args) => {
    if (args[0] === "worktree") return PORCELAIN;
    if (args[0] === "branch") return output;
    if (args.includes("--format=%ct")) return String(INSTANT / 1000 - 3600);
    if (args.includes("--format=%s")) return "subject";
    return "1";
  });
}

describe("branch list shape", () => {
  it.each([
    ["an unrecognised line alone", "not a ref list"],
    ["an unrecognised line beside a real ref", "refs/heads/lane/kept\nerror: something else"],
    ["a short name where a full ref is due", "lane/kept"],
    ["a ref outside refs/heads", "refs/tags/v1"],
  ])("REQ-21-006: %s is an unreadable repository, never clean", (_label, output) => {
    withBranchOutput(output);
    const rows = readWorktreesByRepo([REPO], INSTANT);
    expect(rows[0]).toMatchObject({ kind: "error" });
    expect(summarizeWorktrees(rows)).toMatchObject({ unreadable: 1, hidden: false });
  });

  it("REQ-21-006: git's parenthesised HEAD description is still skipped", () => {
    withBranchOutput("(HEAD desacoplado de refs/heads/lane/kept)\nrefs/heads/lane/kept");
    expect(readWorktreesByRepo([REPO], INSTANT)[0]).toMatchObject({
      kind: "ok",
      branches: [expect.objectContaining({ name: "lane/kept" })],
    });
  });

  it("REQ-21-006: empty output still reads as nothing pending", () => {
    withBranchOutput("");
    expect(readWorktreesByRepo([REPO], INSTANT)[0]).toMatchObject({ kind: "ok", state: "clean" });
  });
});
