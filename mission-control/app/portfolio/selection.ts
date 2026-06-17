/**
 * selection.ts — Pure helper for URL-driven project selection (WO-03-004).
 *
 * Derives the selected project slug from:
 *   1. The ?project=<slug> URL param — when it matches an active project name.
 *   2. The first active project's name — when no param is given or no match.
 *   3. undefined — when there are no active projects at all.
 *
 * Design rule (blueprint §3): selection is URL-driven (Server-rendered),
 * no client state, no flash of unselected content.
 *
 * Traceability:
 *   CMP-03-workspace-slot → REQ-03-004, REQ-03-005
 *   AC-03-004.1, AC-03-005.1
 *   WO-03-004
 */

import type { ProjectListItem } from "@/lib/portfolio";

/**
 * Derive the slug (project name) of the currently-selected project.
 *
 * @param items   - Active project list from activeProjects().
 * @param param   - The raw ?project= URL param value, or undefined if absent.
 * @returns The selected project name, or undefined when items is empty.
 *
 * Rules (AC-03-004.1, AC-03-005.1):
 *   - If `param` exactly matches the `name` of an item in `items`, return it.
 *   - Otherwise return `items[0].name` (first project, default selection).
 *   - When `items` is empty, return undefined (graceful empty state).
 */
export function deriveSelectedSlug(
  items: ProjectListItem[],
  param: string | undefined,
): string | undefined {
  if (items.length === 0) return undefined;

  // Exact match against item names (case-sensitive).
  if (param !== undefined) {
    const match = items.find((item) => item.name === param);
    if (match !== undefined) return match.name;
  }

  // Default: first active project.
  // biome-ignore lint/style/noNonNullAssertion: length > 0 guard above
  return items[0]!.name;
}
