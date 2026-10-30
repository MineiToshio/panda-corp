import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { runGit } from "@/lib/git/git";
import { readSnapshotGap } from "../gap";

vi.mock("@/lib/git/git", async (original) => ({
  ...(await original<typeof import("@/lib/git/git")>()),
  runGit: vi.fn(),
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it.each([
  [0, 0, false],
  [9, 23, false],
  [10, 0, true],
  [0, 24, true],
])("AC-14-002.1: distance %s / %s", (commits, hours, stale) => {
  vi.mocked(runGit)
    .mockReturnValueOnce(String(commits))
    .mockReturnValueOnce(String(1000000 + hours * 3600))
    .mockReturnValueOnce("1000000")
    .mockReturnValueOnce("feat: WO-07-002 verified");
  expect(readSnapshotGap("/fixture/project", "a41c09e2")).toEqual({
    status: "ok",
    commitsBehind: commits,
    hoursBehind: hours,
    stale,
    verified: { wo: "WO-07-002", frd: "FRD-07" },
  });
});
it("AC-14-001.1: real Spanish git fixture and malformed source stay explicit", async () => {
  const real = (await vi.importActual<typeof import("@/lib/git/git")>("@/lib/git/git")).runGit;
  vi.mocked(runGit).mockImplementation(real);
  const dir = mkdtempSync(path.join(os.tmpdir(), "snapshot-gap-"));
  const file = path.join(dir, "git.json");
  vi.stubEnv("MC_GIT_FIXTURE", file);
  try {
    writeFileSync(file, readFileSync("src/lib/git/_tests/git-state.json"));
    expect(readSnapshotGap("/fixture/funko-tracker", "a41c09e2")).toMatchObject({
      status: "ok",
      commitsBehind: 3,
      hoursBehind: 5,
    });
    expect(readSnapshotGap("/fixture/funko-tracker", "deadbeef")).toMatchObject({
      status: "unavailable",
    });
    writeFileSync(file, "{}");
    expect(readSnapshotGap("/fixture/funko-tracker", "a41c09e2")).toMatchObject({
      status: "unavailable",
      reason: expect.stringContaining("Malformed"),
    });
  } finally {
    rmSync(dir, { recursive: true });
  }
});
it("AC-14-002.1: malformed numeric output fails loud", () => {
  vi.mocked(runGit).mockReturnValueOnce("not a count");
  expect(() => readSnapshotGap("/fixture/project", "a41c09e2")).toThrow(/Malformed/);
});
