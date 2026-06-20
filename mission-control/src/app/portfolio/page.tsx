/**
 * Portfolio page — Server Component (CMP-03-workspace-slot).
 *
 * Re-paint to match the approved prototype (WO-03-002, FDD-03):
 *   - PageTitle: icon "ti-stack-2", H1 "Portfolio", subtitle (DR-062 cohesion)
 *   - Two-column grid: 240px rail + 1fr workspace (gap 14px, align-items start)
 *   - "PROYECTOS" uppercase label above the rail items
 *   - SelectableProjectRail with play/pause icons and .rail/.rail.on styling
 *   - WorkspaceSlot hosting the selected project (FRD-04 stub until it lands)
 *
 * Selection rules (AC-03-004.1, AC-03-005.1):
 *   - ?project=<name> and that name matches an active project → that project selected.
 *   - No param (or unmatched param) → first active project selected by default.
 *   - No active projects → empty state (SelectableProjectRail empty + slot empty).
 *
 * Read-only (architecture §1): activeProjects() never writes, never calls Claude.
 *
 * Traceability:
 *   CMP-03-active-projects, CMP-03-rail, CMP-03-workspace-slot
 *   IF-03-activeProjects (docs/api.md WO-03-001)
 *   REQ-03-001, REQ-03-002, REQ-03-004, REQ-03-005
 *   AC-03-001, AC-03-002, AC-03-004, AC-03-005
 *   WO-03-002
 */

import { PageTitle } from "@/components/core/PageTitle/PageTitle";
import { activeProjects } from "@/lib/portfolio/portfolio";
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
// Styles — CSS custom properties only; zero hardcoded hex/rgb/hsl values.
// Mirrors prototype portfolioView():
//   grid-template-columns: 240px 1fr; gap: 14px; align-items: start
// ---------------------------------------------------------------------------

const PAGE_STYLE: React.CSSProperties = {
  padding: "var(--space-base, 1rem)",
  minHeight: "100dvh",
  background: "var(--color-canvas, Canvas)",
  color: "var(--color-text, currentColor)",
};

const GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "240px 1fr",
  gap: "14px",
  alignItems: "start",
};

/** "PROYECTOS" label — 10px, accent-text, letter-spacing 0.08em (prototype railLabel()) */
const RAIL_LABEL_STYLE: React.CSSProperties = {
  fontSize: "10px",
  color: "var(--color-accent-text, var(--color-accent))",
  letterSpacing: "0.08em",
  margin: "2px 6px 8px",
  display: "block",
};

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
    <div data-testid="portfolio-page" style={PAGE_STYLE}>
      {/* DR-062 — ONE light page-title block (PageTitle), icon + H1 "Portfolio" + subtitle */}
      <PageTitle
        icon="ti-stack-2"
        title="Portfolio"
        subtitle="Tus proyectos en obra y lanzados. Elige uno para su workspace: resumen, work orders, party y documentación."
      />

      {/* Two-column grid: 240px left rail + 1fr right workspace (FDD-03) */}
      <div style={GRID_STYLE}>
        {/* Left — project rail (CMP-03-rail) */}
        <div data-testid="portfolio-rail">
          {/* "PROYECTOS" uppercase label (prototype railLabel("PROYECTOS")) */}
          <span data-testid="portfolio-rail-label" style={RAIL_LABEL_STYLE} aria-hidden="true">
            PROYECTOS
          </span>

          {/* Selectable rail: .rail / .rail.on items with play/pause icons */}
          <SelectableProjectRail items={items} selectedSlug={selectedSlug} />
        </div>

        {/* Right — workspace slot (CMP-03-workspace-slot) */}
        <WorkspaceSlot selectedSlug={selectedSlug} />
      </div>
    </div>
  );
}
