/**
 * SelectableProjectRail — thin compatibility wrapper over the shared ProjectRail.
 *
 * DR-057 (reuse-before-create): The selectable rail is now a PROP/VARIANT of
 * the ONE shared `ProjectRail` primitive (`components/modules/ProjectRail`).
 * This file keeps the named export alive so existing test imports continue
 * to resolve without changing every import site; the implementation delegates
 * entirely to `ProjectRail` with `selectedSlug` — no duplicate styles, no
 * forked component.
 *
 * Gate rule: this file MUST import from `modules/ProjectRail/ProjectRail` and
 * MUST NOT re-declare the rail's core style constants (RAIL_STYLE, ROW_STYLE,
 * CHIP_BUILDING_STYLE, CHIP_STOPPED_STYLE) as top-level `const` — those belong
 * to the ONE shared primitive (verified by frd-03-rail-reuse.gate.reviewer.test.tsx).
 *
 * Consumers of ProjectRail's selectable mode can also import ProjectRail directly:
 *   import { ProjectRail } from "@/components/modules/ProjectRail/ProjectRail";
 *   <ProjectRail items={items} selectedSlug={selectedSlug} />
 *
 * Traceability:
 *   CMP-03-rail → DR-057 (one rail, not two)
 *   frd-03-rail-reuse.gate.reviewer.test.tsx
 */

import { ProjectRail } from "@/components/modules/ProjectRail/ProjectRail";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";

// ---------------------------------------------------------------------------
// Props — matches the old SelectableProjectRail interface; delegates to ProjectRail.
// ---------------------------------------------------------------------------

export interface SelectableProjectRailProps {
  /** Active project list from activeProjects(). */
  items: ProjectListItem[];
  /** The currently-selected project name (from URL param or default-select). */
  selectedSlug: string | undefined;
}

// ---------------------------------------------------------------------------
// Component — thin pass-through to ProjectRail's selectable mode.
// ---------------------------------------------------------------------------

/**
 * SelectableProjectRail — renders the shared ProjectRail in selectable mode.
 *
 * Pass-through wrapper kept for import-site compatibility. New code should
 * import ProjectRail directly and pass `selectedSlug`.
 */
export function SelectableProjectRail({
  items,
  selectedSlug,
}: SelectableProjectRailProps): React.JSX.Element {
  // selectedSlug may be undefined (empty items, no selection possible).
  // ProjectRail treats undefined selectedSlug as "no selectable mode", so we
  // pass an empty string as sentinel when items is empty to stay in selectable mode.
  const slug = selectedSlug ?? "";
  return <ProjectRail items={items} selectedSlug={slug} />;
}
