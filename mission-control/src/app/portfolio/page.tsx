/**
 * Portfolio page — Server Component (CMP-03-workspace-slot).
 *
 * Reads active projects from activeProjects() and derives the selected project
 * from the ?project= URL param (URL-driven selection, WO-03-004 design).
 *
 * Selection rules (AC-03-004.1, AC-03-005.1):
 *   - ?project=<name> and that name matches an active project → that project selected.
 *   - No param (or unmatched param) → first active project selected by default.
 *   - No active projects → empty state (WorkspaceSlot + SelectableProjectRail empty).
 *
 * The right panel renders WorkspaceSlot carrying the selected slug.
 * Until FRD-04 lands, WorkspaceSlot is a placeholder with data-slug="<name>".
 * Wiring FRD-04: replace WorkspaceSlot's body with the real workspace component.
 *
 * Read-only (architecture §1): activeProjects() never writes, never calls Claude.
 *
 * Traceability:
 *   CMP-03-active-projects, CMP-03-rail, CMP-03-workspace-slot
 *   IF-03-activeProjects (docs/api.md WO-03-001)
 *   REQ-03-001, REQ-03-004, REQ-03-005
 *   AC-03-004.1, AC-03-005.1
 *   WO-03-004
 */

import { activeProjects } from "@/lib/portfolio";
import { SelectableProjectRail } from "./SelectableProjectRail";
import { deriveSelectedSlug } from "./selection";
import { WorkspaceSlot } from "./WorkspaceSlot";

// ---------------------------------------------------------------------------
// Next.js App Router page props (Next.js 16: searchParams is a Promise).
// ---------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PortfolioPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  // Read-only: activeProjects() never writes, never calls Claude (architecture §7).
  const items = activeProjects();

  // Resolve the searchParams promise (Next.js 16 requirement).
  const params = await searchParams;
  const rawParam = params.project;
  const projectParam = typeof rawParam === "string" ? rawParam : undefined;

  // Derive selected slug: ?project=<name> → match → else first item → else undefined.
  const selectedSlug = deriveSelectedSlug(items, projectParam);

  return (
    <main
      data-testid="portfolio-page"
      style={{
        display: "flex",
        minHeight: "100dvh",
        background: "var(--color-base, Canvas)",
        color: "var(--color-text, currentColor)",
      }}
    >
      {/* Left rail — selectable project list (CMP-03-rail, CMP-03-row) */}
      <aside
        data-testid="portfolio-page-rail"
        style={{
          width: "clamp(220px, 22vw, 320px)",
          borderRight: "var(--hairline, 1px) solid var(--color-border, currentColor)",
          overflowY: "auto",
          flexShrink: 0,
        }}
      >
        <SelectableProjectRail items={items} selectedSlug={selectedSlug} />
      </aside>

      {/* Right panel — workspace slot (CMP-03-workspace-slot) */}
      <div
        data-testid="portfolio-page-workspace"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <WorkspaceSlot selectedSlug={selectedSlug} />
      </div>
    </main>
  );
}
