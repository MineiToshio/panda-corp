import { describe, expect, it } from "vitest";
import { type GitRunner, readPending } from "../pendingMerge";

const NOW = 1_700_000_000_000; // fixed clock
const recentCt = String(Math.floor(NOW / 1000) - 60); // 1 min ago
const oldCt = String(Math.floor(NOW / 1000) - 6 * 3600); // 6h ago → stale (>3h)

/** A fake git runner that dispatches on the subcommand — no module mocking, just dependency injection. */
function fakeGit(opts: {
  worktrees?: string;
  unmerged?: string;
  lastCt?: string;
  ahead?: string;
}): GitRunner {
  return (args) => {
    const a = args.join(" ");
    if (a.includes("symbolic-ref")) return "origin/main";
    if (a.includes("worktree list")) return opts.worktrees ?? "";
    if (a.includes("branch --no-merged")) return opts.unmerged ?? "";
    if (a.includes("rev-list")) return opts.ahead ?? "2";
    if (a.includes("log")) return opts.lastCt ?? recentCt;
    return "";
  };
}

/** A runner that always throws — git unavailable / not a repo. */
const throwingGit: GitRunner = () => {
  throw new Error("not a git repository");
};

describe("readPending (DR-078 fail-loud)", () => {
  it("returns empty when no branch is un-merged (distinct from error)", () => {
    expect(readPending("/repo", NOW, fakeGit({ unmerged: "" }))).toEqual({ kind: "empty" });
  });

  it("returns an explicit error (never empty) when git can't be read", () => {
    expect(readPending("/repo", NOW, throwingGit).kind).toBe("error");
  });

  it("tags a branch with a live worktree as in-progress", () => {
    const run = fakeGit({
      worktrees: "worktree /wt/feat\nHEAD abc\nbranch refs/heads/feat\n",
      unmerged: "feat",
      lastCt: recentCt,
    });
    const result = readPending("/repo", NOW, run);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.items[0]).toMatchObject({
      branch: "feat",
      worktree: "/wt/feat",
      status: "in-progress",
    });
  });

  it("tags an idle un-merged branch past the threshold as stale", () => {
    const result = readPending(
      "/repo",
      NOW,
      fakeGit({ worktrees: "", unmerged: "fresh\nold", lastCt: oldCt }),
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.items.every((i) => i.status === "stale")).toBe(true);
  });
});
