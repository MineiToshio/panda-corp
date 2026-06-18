// Shared types for the timeline selector. Lives in its own module so both
// `timeline.ts` (public surface) and `accumulate.ts` (internal folding) can
// depend on it without a circular import (clean-code.md: no cycles).

/**
 * A single row in the flattened timeline tree.
 * The tree is: WO → Task → Action (3 levels max).
 */
export type TimelineRow = {
  /** Stable unique id for this row in the output of one toTimeline call. */
  id: string;
  /** "wo" for work-order rows, "task" for task rows, "action" for leaf events. */
  kind: "wo" | "task" | "action";
  /** workOrder id, task id, or event name for action rows. */
  label: string;
  /** ISO 8601 timestamp of the earliest event within this node's subtree. */
  start: string;
  /**
   * ISO 8601 timestamp of the latest event within this node's subtree that has
   * a terminal status (ok or fail). null when the node is still in-progress.
   */
  end: string | null;
  /**
   * Duration in milliseconds (Date.parse(end) - Date.parse(start)).
   * null when end is null (in-progress).
   * Always null or a finite non-negative number (never NaN, never negative).
   */
  duration: number | null;
  /** Id of the parent row; null for top-level rows (WO rows and true orphans). */
  parentId: string | null;
  /** "running" when end is null; "fail" when any terminal child is "fail"; "ok" otherwise. */
  status: "ok" | "fail" | "running";
};
