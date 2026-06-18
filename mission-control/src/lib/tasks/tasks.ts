import fs from "node:fs";

/**
 * WO-06-005 — Task state reader for the Party panel (FRD-06)
 *
 * Reads `~/.claude/tasks/` to determine whether an active build team exists.
 * "Active team" = the tasks directory exists and contains at least one
 * subdirectory (one team folder).
 *
 * Platform golden rule (architecture §1 / §4.7): read-only, never call Claude.
 * Absence of the tasks directory = "no active team" (tolerated gracefully).
 *
 * Traceability:
 *   IF-06-tasks → AC-06-008.1 (reads task state without calling Claude)
 *   IF-06-tasks → AC-06-010.1 (absent tasks/ → active=false, graceful empty state)
 *
 * Architecture §4.7:
 *   `tasks/<team>/` — task state for Party (tolerate absence = "no active team").
 *
 * Path used by production: TASKS_DIR from lib/config.ts (`~/.claude/tasks`).
 * Tests pass a fixture path via the `tasksDir` parameter.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of reading the tasks directory.
 *
 * - `active`: true when at least one team subdirectory is present.
 * - `teamCount`: number of team subdirectories found (0 when absent/empty).
 *
 * Both fields are always present; the result is fully serializable.
 */
export type TasksState = {
  active: boolean;
  teamCount: number;
};

/** The "no active team" sentinel returned for any absent/empty/error case. */
const INACTIVE: TasksState = { active: false, teamCount: 0 };

// ---------------------------------------------------------------------------
// readTasksState
// ---------------------------------------------------------------------------

/**
 * Read the task state directory and return whether an active team is present.
 *
 * Behaviour:
 * - Empty/blank `tasksDir` → `{ active: false, teamCount: 0 }`.
 * - Directory does not exist → `{ active: false, teamCount: 0 }` (no throw).
 * - Directory exists but is empty → `{ active: false, teamCount: 0 }`.
 * - Directory has at least one subdirectory → `{ active: true, teamCount: N }`.
 * - Files (non-directories) inside `tasksDir` are ignored (only dirs count).
 * - Any I/O error → `{ active: false, teamCount: 0 }` (never throws).
 *
 * @param tasksDir - Path to the tasks directory.
 *                   Defaults to `~/.claude/tasks` (via TASKS_DIR from config).
 *                   Override in tests via fixture paths.
 */
export function readTasksState(tasksDir: string): TasksState {
  // Guard: blank path
  if (!tasksDir || tasksDir.trim() === "") {
    return INACTIVE;
  }

  // Check if the directory exists (absence = no active team, never throw)
  let dirExists: boolean;
  try {
    dirExists = fs.existsSync(tasksDir);
  } catch {
    return INACTIVE;
  }
  if (!dirExists) {
    return INACTIVE;
  }

  // Read directory entries (fail-soft on any I/O error)
  let entries: string[];
  try {
    entries = fs.readdirSync(tasksDir);
  } catch {
    return INACTIVE;
  }

  // Count only subdirectories (team folders); files are ignored
  let teamCount = 0;
  for (const entry of entries) {
    try {
      const entryPath = `${tasksDir}/${entry}`;
      const stat = fs.statSync(entryPath);
      if (stat.isDirectory()) {
        teamCount++;
      }
    } catch {
      // skip entries that can't be stat'd
    }
  }

  return {
    active: teamCount > 0,
    teamCount,
  };
}
