/**
 * Portfolio page — Server Component (CMP-03-workspace-slot).
 *
 * Reads the rail projects (building + shipped) from railProjects() and derives the selected project
 * from the ?project= URL param (URL-driven selection).
 *
 * Selection rules (AC-03-004.1, AC-03-005.1):
 *   - ?project=<name> and that name matches an active project → that project selected.
 *   - No param → first active project, normalized to an explicit identity URL.
 *   - Unknown explicit project → not found; never switches to an unrelated project.
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
 * Read-only (architecture §1): railProjects() never writes, never calls Claude.
 *
 * Traceability:
 *   CMP-03-active-projects, CMP-03-rail, CMP-03-workspace-slot
 *   IF-03-activeProjects + railProjects (docs/api.md WO-03-001)
 *   REQ-03-001, REQ-03-004, REQ-03-005
 *   AC-03-004.1, AC-03-005.1
 *   WO-03-002 (surface)
 *   DR-057 (one rail, not two)
 */

import { notFound } from "next/navigation";
import { ProjectWorkspace } from "@/app/projects/[slug]/ProjectWorkspace";
import { workspaceHref, workspaceSelection } from "@/app/projects/[slug]/workspace-route";
import { PageLayout } from "@/components/core/PageLayout/PageLayout";
import { ProjectRail } from "@/components/modules/ProjectRail/ProjectRail";
import { PortfolioViews } from "@/components/modules/ServicesDirectory/PortfolioViews";
import { ServicesDirectory } from "@/components/modules/ServicesDirectory/ServicesDirectory";
import { getProjectNavigation, resolveProjectNavigation } from "@/lib/navigation/identities";
import { NavigationCanonical } from "@/lib/navigation/NavigationCanonical";
import { routeHref } from "@/lib/navigation/routeState";
import { railProjects } from "@/lib/portfolio/portfolio";
import { getServicesDirectory } from "@/lib/services/services";
import { PortfolioLayout } from "./PortfolioLayout";
import { WorkspaceSlot } from "./WorkspaceSlot";

// ---------------------------------------------------------------------------
// Next.js App Router page props (Next.js 16: searchParams is a Promise).
// ---------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  routeState?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded colors/spacing.
// ---------------------------------------------------------------------------

// Width + outer padding + the page <main> come from PageLayout (DR-062) inside the
// single AppShell container (#pcapp, centered 1240px maximum).
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
  routeState = {},
}: PageProps): Promise<React.JSX.Element> {
  // Read-only: railProjects() never writes, never calls Claude (architecture §7).
  const items = railProjects();

  // Resolve the searchParams promise (Next.js 16 requirement).
  const rawQuery = await searchParams;
  routeHref("/portfolio", [], rawQuery);
  const params = { ...rawQuery, ...routeState };
  const accountsView =
    params.view === "cuentas" || (params.view === undefined && params.portfolioView === "accounts");
  const rawParam = params.project;
  const projectParam = typeof rawParam === "string" ? rawParam : undefined;

  // Derive selected slug: ?project=<name> → match → else first item → else undefined.
  const selectedItem =
    projectParam === undefined ? items[0] : resolveProjectNavigation(projectParam, items);
  if (projectParam !== undefined && selectedItem === undefined) notFound();
  const selectedSlug = selectedItem?.name;
  const identity = selectedItem
    ? getProjectNavigation(selectedItem.path, selectedItem.name)
    : undefined;
  const publicSlug = identity?.slug;
  const selection = workspaceSelection({ ...params, project: publicSlug }, selectedItem?.path);
  const href = workspaceHref("/portfolio", params, publicSlug, selection);

  // Resolve the selected project's workspace (prototype projectPane embedded in the right pane, DEC-4).
  // URL-driven tab selection shares the page's searchParams (?tab/?doc/?wo) — TabBar preserves ?project.
  let workspace: React.ReactNode;
  if (selectedItem !== undefined) {
    workspace = (
      <ProjectWorkspace
        item={selectedItem}
        selection={selection}
        headingLevel={2}
        navigationBaseHref={href}
      />
    );
  }

  return (
    <PageLayout
      icon="ti-stack-2"
      title="Portfolio"
      subtitle="Tus proyectos en obra y lanzados. Elige uno para su workspace: resumen, observabilidad, arquitectura, cuentas, cambios, documentos y comandos."
      testId="portfolio-page"
    >
      {selectedItem && <NavigationCanonical href={href} />}
      <PortfolioViews accounts={accountsView} href={href} />
      {accountsView ? (
        <ServicesDirectory data={getServicesDirectory()} />
      ) : (
        <>
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
                <ProjectRail
                  items={items}
                  selectedSlug={selectedSlug ?? ""}
                  navigationBaseHref={href}
                  selectedNavigationId={identity?.id}
                />
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
        </>
      )}
    </PageLayout>
  );
}
