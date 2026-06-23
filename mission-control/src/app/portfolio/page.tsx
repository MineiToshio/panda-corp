/**
 * Portfolio page — Server Component (CMP-03-workspace-slot).
 *
 * Reads active projects from activeProjects() and derives the selected project
 * from the ?project= URL param (URL-driven selection).
 *
 * Selection rules (AC-03-004.1, AC-03-005.1):
 *   - ?project=<name> and that name matches an active project → that project selected.
 *   - No param (or unmatched param) → first active project selected by default.
 *   - No active projects → empty state (WorkspaceSlot + ProjectRail empty).
 *
 * Layout (FDD-03 §1, prototype portfolioView()):
 *   PageTitle "Portfolio" (the ONE light title block, DR-062)
 *   Two-column grid: 240px rail | 1fr workspace pane; gap 14px; align-items start.
 *   Rail column: "PROYECTOS" label (railLabel style) + ProjectRail (selectedSlug mode).
 *   Right column: WorkspaceSlot hosting the selected project's workspace (FRD-04).
 *
 * DR-057 (reuse-before-create): imports the ONE shared ProjectRail directly.
 * No bespoke SelectableProjectRail is used here — the selectable mode is a
 * prop variant of the shared primitive.
 *
 * Wiring FRD-04: replace WorkspaceSlot's body with the real workspace component.
 * Read-only (architecture §1): activeProjects() never writes, never calls Claude.
 *
 * Traceability:
 *   CMP-03-active-projects, CMP-03-rail, CMP-03-workspace-slot
 *   IF-03-activeProjects (docs/api.md WO-03-001)
 *   REQ-03-001, REQ-03-004, REQ-03-005
 *   AC-03-004.1, AC-03-005.1
 *   WO-03-002 (surface)
 *   DR-057 (one rail, not two)
 */

import {
  ProjectWorkspace,
  resolveWorkspaceTab,
  type WorkspaceSelection,
} from "@/app/projects/[slug]/ProjectWorkspace";
import { PageLayout } from "@/components/core/PageLayout/PageLayout";
import { ProjectRail } from "@/components/modules/ProjectRail/ProjectRail";
import { activeProjects } from "@/lib/portfolio/portfolio";
import { PortfolioLayout } from "./PortfolioLayout";
import { deriveSelectedSlug } from "./selection";
import { WorkspaceSlot } from "./WorkspaceSlot";

// ---------------------------------------------------------------------------
// Next.js App Router page props (Next.js 16: searchParams is a Promise).
// ---------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded colors/spacing.
// ---------------------------------------------------------------------------

// Width + outer padding + the page <main> come from PageLayout (DR-062) inside the
// single AppShell container (#pcapp, 1240px).
/**
 * Rail label — mirrors prototype `railLabel()` + `.px` class:
 * small uppercase label above a section list (PROYECTOS, DOCUMENTOS, CAPÍTULOS).
 * Uses the pixel font (--font-pixel) for exact fidelity with the prototype's `.px` class.
 * font-size: 10px, color: var(--color-accent-text), letter-spacing: .08em.
 */
const RAIL_LABEL_STYLE: React.CSSProperties = {
  fontSize: "10px",
  fontFamily: "var(--font-pixel, ui-monospace, monospace)",
  fontWeight: 500,
  color: "var(--color-accent-text, currentColor)",
  letterSpacing: "0.08em",
  margin: "2px 6px 8px",
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

  // Resolve the selected project's workspace (prototype projectPane embedded in the right pane, DEC-4).
  // URL-driven tab selection shares the page's searchParams (?tab/?doc/?wo) — TabBar preserves ?project.
  const selectedItem = items.find((p) => p.name === selectedSlug);
  let workspace: React.ReactNode;
  if (selectedItem !== undefined) {
    const selection: WorkspaceSelection = {
      activeTab: resolveWorkspaceTab(params.tab),
      docParam: typeof params.doc === "string" ? params.doc : undefined,
      woParam: typeof params.wo === "string" && params.wo.length > 0 ? params.wo : undefined,
      woTabParam: typeof params.wotab === "string" && params.wotab === "full" ? "full" : "summary",
    };
    workspace = <ProjectWorkspace item={selectedItem} selection={selection} headingLevel={2} />;
  }

  return (
    <PageLayout
      icon="ti-stack-2"
      title="Portfolio"
      subtitle="Tus proyectos en obra y lanzados. Elige uno para su workspace: resumen, work orders, party y documentación."
      testId="portfolio-page"
    >
      {/* Responsive grid with a user-collapsible projects rail (PortfolioLayout owns the toggle +
          persistence; the grid track-template + mobile single-column stack live in globals.css). */}
      <PortfolioLayout
        rail={
          <div data-testid="portfolio-page-rail">
            {/* "PROYECTOS" rail label (prototype railLabel("PROYECTOS")) */}
            <div data-testid="portfolio-rail-label" aria-hidden="true" style={RAIL_LABEL_STYLE}>
              PROYECTOS
            </div>
            {/* Shared ProjectRail in selectable mode — URL-driven selection, per-row Link nav,
                data-selected on the active row (DR-057 reuse-before-create). */}
            <ProjectRail items={items} selectedSlug={selectedSlug ?? ""} />
          </div>
        }
        workspace={
          // minWidth:0 — a grid item defaults to min-width:auto (its min-content); without it a wide
          // child (the WoDag canvas, a long timeline/table) forces the pane past the frame and the
          // whole page scrolls sideways. With it, such content scrolls inside its own container.
          <div data-testid="portfolio-page-workspace" style={{ minWidth: 0 }}>
            <WorkspaceSlot selectedSlug={selectedSlug}>{workspace}</WorkspaceSlot>
          </div>
        }
      />
    </PageLayout>
  );
}
