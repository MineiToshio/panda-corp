import { runGit } from "@/lib/git/git";
import { GitError } from "@/lib/git/gitError";
import { isSnapshotStale } from "./snapshot";

/** Read-only comparison of a green commit against the build's HEAD. */
export type SnapshotGap =
  | {
      readonly status: "ok";
      readonly commitsBehind: number;
      readonly hoursBehind: number;
      readonly stale: boolean;
      readonly verified?: { readonly wo: string; readonly frd: string };
    }
  | { readonly status: "unavailable"; readonly reason: string };

function integer(value: string): number {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw new Error("Malformed snapshot git response: expected a nonnegative integer");
  return Number(value);
}

/** Probe commit distance and committer times; unavailable git is explicit, malformed output throws. */
export function readSnapshotGap(projectPath: string, sha: string): SnapshotGap {
  if (!/^[a-f\d]{4,40}$/i.test(sha))
    return { status: "unavailable", reason: "Invalid green commit SHA" };
  try {
    const commitsBehind = integer(runGit(["rev-list", "--count", `${sha}..HEAD`], projectPath));
    const head = integer(runGit(["log", "-1", "--format=%ct", "HEAD"], projectPath));
    const green = integer(runGit(["log", "-1", "--format=%ct", sha], projectPath));
    const subject = runGit(["log", "-1", "--format=%s", sha], projectPath);
    const match = /\bWO-(\d{2})-\d{3}\b/.exec(subject);
    const hoursBehind = Math.max(0, Math.floor((head - green) / 3600));
    return {
      status: "ok",
      commitsBehind,
      hoursBehind,
      stale: isSnapshotStale(commitsBehind, hoursBehind),
      ...(match ? { verified: { wo: match[0], frd: `FRD-${match[1]}` } } : {}),
    };
  } catch (error) {
    if (!(error instanceof GitError)) throw error;
    return { status: "unavailable", reason: error.message };
  }
}
