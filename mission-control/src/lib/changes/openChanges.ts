import fs from "node:fs";
import path from "node:path";
import { type ChangeQueueReadResult, readChangeQueue } from "./changes";

/**
 * A failed count is unknown, never a partial number or a fabricated zero.
 * Consumers can pass `errors` to the queue's existing error surface and omit
 * the badge/stat whenever `ok` is false. The discriminant narrows `count`.
 */
export type OpenChangesResult =
  | { ok: true; count: number; errors: [] }
  | { ok: false; count: null; errors: ChangeQueueReadResult["errors"] };

/**
 * Count all non-terminal changes, including building and closing items.
 * This is broader than owner-pending work (ready/draft only). The queue reader
 * remains the authority for item discovery and parsing; directory listing is
 * checked here because that reader suppresses listing errors. Even
 * one malformed/unreadable item makes the total unknown. A missing queue is
 * legitimately empty and inherits the reader's successful zero-item result.
 */
export function countOpenChanges(projectPath: string): OpenChangesResult {
  const queue = path.join(projectPath, ".pandacorp", "inbox", "changes");
  for (const dir of [queue, path.join(queue, "done")]) {
    try {
      fs.readdirSync(dir);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") continue;
      return {
        ok: false,
        count: null,
        errors: [{ file: dir, reason: "change directory could not be listed" }],
      };
    }
  }
  const { items, errors } = readChangeQueue(projectPath);
  if (errors.length > 0) return { ok: false, count: null, errors };
  const count = items.filter(
    (item) => item.status !== "done" && item.status !== "discarded",
  ).length;
  return { ok: true, count, errors: [] };
}
