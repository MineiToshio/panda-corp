import type { ExecFileOptions } from "node:child_process";
import { afterEach, expect, it, vi } from "vitest";
import { runGitAsync } from "../git";

type Callback = (error: (Error & { killed?: boolean }) | null, stdout: string) => void;
const boundary = vi.hoisted(() => ({
  execFile:
    vi.fn<(bin: string, args: string[], options: ExecFileOptions, callback: Callback) => void>(),
}));
vi.mock("node:child_process", () => ({ default: boundary }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("limits concurrent git children to four, with an explicit timeout and read-only environment", async () => {
  vi.stubEnv("MC_GIT_FIXTURE", undefined);
  const callbacks: Callback[] = [];
  boundary.execFile.mockImplementation((_bin, _args, options, callback) => {
    expect(options.timeout).toBe(10_000);
    expect(options.env?.GIT_OPTIONAL_LOCKS).toBe("0");
    callbacks.push(callback);
  });
  const reads = Array.from({ length: 6 }, () => runGitAsync(["status", "--porcelain"], "/fixture"));
  expect(boundary.execFile).toHaveBeenCalledTimes(4);
  callbacks[0]?.(null, " clean ");
  await reads[0];
  expect(boundary.execFile).toHaveBeenCalledTimes(5);
  callbacks[1]?.(null, "clean");
  await reads[1];
  expect(boundary.execFile).toHaveBeenCalledTimes(6);
  for (const callback of callbacks.slice(2)) callback(null, "clean");
  expect(await Promise.all(reads)).toEqual(Array(6).fill("clean"));
});
it("reports subprocess timeouts and refuses writes before spawning", async () => {
  vi.stubEnv("MC_GIT_FIXTURE", undefined);
  boundary.execFile.mockImplementation((_bin, _args, _options, callback) => {
    callback(Object.assign(new Error("private"), { killed: true }), "");
  });
  await expect(runGitAsync(["status", "--porcelain"], "/fixture")).rejects.toMatchObject({
    kind: "timeout",
  });
  await expect(runGitAsync(["reset", "--hard"], "/fixture")).rejects.toMatchObject({
    kind: "disallowed",
  });
  expect(boundary.execFile).toHaveBeenCalledTimes(1);
});
