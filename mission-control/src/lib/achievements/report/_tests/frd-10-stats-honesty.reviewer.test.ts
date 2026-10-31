import { afterEach, expect, it, vi } from "vitest";
import { runGit } from "@/lib/git/git";
import { GitError } from "@/lib/git/gitError";
import { reportScalars } from "../scalars";
import { neverRecorded, recordedKinds } from "../statProvenance";

/** Reviewer-authored (DR-080): honest degradation of the report sources. */
vi.mock("@/lib/git/git", async (original) => ({
  ...(await original<typeof import("@/lib/git/git")>()),
  runGit: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());

it.each([
  "failed",
  "timeout",
] as const)("AC-10-026.2: a %s commit count is no value, never a measured zero", (kind) => {
  vi.mocked(runGit).mockImplementation(() => {
    throw new GitError(kind, "Unavailable");
  });
  expect(reportScalars(process.cwd()).commits).toBeNull();
});

it("AC-10-028.5: an event kind present in the stream is recorded even with no durable fact", () => {
  const kinds = recordedKinds({
    ideas: [],
    statuses: [],
    eventsSnapshot: {
      events: [{ event: "SubagentStop", at: "2026-10-20T00:00:00Z" }],
      lastEventAt: "2026-10-20T00:00:00Z",
      byProject: {},
    },
    durableEvents: [],
  } as unknown as Parameters<typeof recordedKinds>[0]);
  expect(neverRecorded("subagents", 0, kinds)).toBe(false);
});
