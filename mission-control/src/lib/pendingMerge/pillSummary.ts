import type { WorktreesByRepo } from "./worktreesByRepo";
export function summarizeWorktrees(rows: WorktreesByRepo): {
  count: number;
  urgent: boolean;
  unreadable: number;
  hidden: boolean;
} {
  const count = rows.reduce((sum, row) => sum + (row.kind === "ok" ? row.branches.length : 0), 0);
  const unreadable = rows.filter((row) => row.kind === "error").length;
  return {
    count,
    urgent: rows.some((row) => row.kind === "ok" && row.state === "cleanNow"),
    unreadable,
    hidden: count === 0 && unreadable === 0,
  };
}
