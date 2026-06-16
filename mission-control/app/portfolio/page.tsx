/**
 * Portfolio page — Server Component.
 *
 * Calls activeProjects() at render time (read-only, never calls Claude),
 * then passes the result to ProjectRail for display.
 *
 * Traceability:
 *   CMP-03-active-projects, CMP-03-rail, CMP-03-workspace-slot
 *   IF-03-activeProjects (docs/api.md WO-03-001)
 *   REQ-03-001, REQ-03-004, REQ-03-005 (selection via ?project= URL param)
 */

import { ProjectRail } from "@/components/ProjectRail";
import { activeProjects } from "@/lib/portfolio";

export default function PortfolioPage(): React.JSX.Element {
  // Read-only: activeProjects() never writes, never calls Claude (architecture §7).
  // Synchronous — safe for Server Components without await.
  const items = activeProjects();

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
      {/* Left rail — project list (CMP-03-rail) */}
      <aside
        data-testid="portfolio-page-rail"
        style={{
          width: "clamp(220px, 22vw, 320px)",
          borderRight: "var(--hairline, 1px) solid var(--color-border, currentColor)",
          overflowY: "auto",
          flexShrink: 0,
        }}
      >
        <ProjectRail items={items} />
      </aside>

      {/* Right slot — workspace (CMP-03-workspace-slot, FRD-04 scope, placeholder) */}
      <section
        data-testid="portfolio-page-workspace"
        style={{
          flex: 1,
          padding: "calc(var(--space-base, 1rem) * 1.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text, currentColor)",
          opacity: 0.5,
          fontSize: "0.875rem",
        }}
      >
        {items.length > 0 ? "Selecciona un proyecto para ver su espacio de trabajo." : null}
      </section>
    </main>
  );
}
