import { afterEach, expect, it, vi } from "vitest";
import { runGit, runGitAsync } from "@/lib/git/git";
import { getWorktreesByRepo } from "../worktreesByRepo";

vi.mock("@/lib/git/git", () => ({ runGit: vi.fn(), runGitAsync: vi.fn() }));
vi.mock("@/lib/config/config", () => ({
  resolveFactoryRoot: () => "/fixture/factory",
  resolveProjectPath: (value: string) => value,
}));
vi.mock("@/lib/portfolio/portfolio", () => ({ readPortfolio: () => [] }));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("yields to rendering, shares in-flight reads and refreshes only after the five-second cache", async () => {
  vi.useFakeTimers();
  let finish: ((value: string) => void) | undefined;
  vi.mocked(runGitAsync).mockImplementation(async (args) => {
    if (args[0] === "worktree")
      return new Promise<string>((resolve) => {
        finish = resolve;
      });
    return "";
  });
  const first = getWorktreesByRepo();
  expect(getWorktreesByRepo()).toBe(first);
  expect(runGit).not.toHaveBeenCalled();
  expect(runGitAsync).toHaveBeenCalledTimes(1);
  expect(finish).toBeTypeOf("function");
  finish?.(`worktree /fixture/factory\nHEAD ${"0".repeat(40)}\nbranch refs/heads/main\n`);
  expect(await first).toMatchObject([{ kind: "ok", state: "clean" }]);
  expect(getWorktreesByRepo()).toBe(first);
  vi.advanceTimersByTime(4999);
  expect(getWorktreesByRepo()).toBe(first);
  vi.advanceTimersByTime(2);
  const next = getWorktreesByRepo();
  expect(next).not.toBe(first);
  finish?.(`worktree /fixture/factory\nHEAD ${"0".repeat(40)}\nbranch refs/heads/main\n`);
  await next;
  expect(runGitAsync).toHaveBeenCalledTimes(4);
});
