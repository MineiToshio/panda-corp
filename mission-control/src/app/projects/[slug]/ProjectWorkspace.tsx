import { Crumbs } from "@/components/core/Crumbs/Crumbs";
import { t } from "@/lib/copy/copy";
import { normalizeLegacyNavigation } from "@/lib/navigation/aliases";
import { navigationHref, parseNavigationUrl } from "@/lib/navigation/urls";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import { ProjectHero } from "./_components/ProjectHero/ProjectHero";
import { ProjectHeroCompact } from "./_components/ProjectHeroCompact/ProjectHeroCompact";
import { TabBar, type TabId } from "./_components/tabbar";
import { WorkspaceNavigationProvider } from "./_components/WorkspaceNavigation";
import ArquitecturaPanel from "./_panels/ArquitecturaPanel";
import CambiosPanel from "./_panels/CambiosPanel";
import ComandosPanel from "./_panels/ComandosPanel";
import CuentasPanel from "./_panels/CuentasPanel";
import DocumentosPanel from "./_panels/DocumentosPanel";
import ObservabilidadPanel from "./_panels/ObservabilidadPanel";
import ResumenPanel from "./_panels/ResumenPanel";
import { SectionNotFound } from "./_panels/SectionNotFound";
import SpecPanel from "./_panels/SpecPanel";
import type { PanelProps, WorkspaceRoute, WorkspaceSelection } from "./_panels/types";
import { loadWorkspaceProject } from "./_panels/workspaceProject";

const VALID_TABS: ReadonlySet<string> = new Set([
  "summary",
  "spec",
  "observability",
  "architecture",
  "accounts",
  "changes",
  "documents",
  "commands",
]);
function isTab(value: string): value is TabId {
  return VALID_TABS.has(value);
}

/** Reuse the alias table; the codec's compatibility key is translated only at this boundary. */
export function resolveWorkspaceTab(raw: string | string[] | undefined): TabId | "unknown" {
  if (raw === undefined) return "summary";
  if (typeof raw !== "string") return "unknown";
  const href = normalizeLegacyNavigation(
    `/portfolio?project=selection&tab=${encodeURIComponent(raw)}`,
  );
  const value = parseNavigationUrl(href).tab;
  const tab = value === "observabilidad" ? "observability" : value;
  return tab !== undefined && isTab(tab) ? tab : "unknown";
}
export interface ProjectWorkspaceProps {
  item: ProjectListItem;
  selection: WorkspaceSelection;
  headingLevel?: 1 | 2;
  navigationBaseHref?: string;
}
const PANELS = {
  summary: ResumenPanel,
  spec: SpecPanel,
  observability: ObservabilidadPanel,
  architecture: ArquitecturaPanel,
  accounts: CuentasPanel,
  changes: CambiosPanel,
  documents: DocumentosPanel,
  commands: ComandosPanel,
  unknown: SectionNotFound,
};

export function ProjectWorkspace({
  item,
  selection,
  headingLevel = 1,
  navigationBaseHref,
}: ProjectWorkspaceProps): React.JSX.Element {
  const project = loadWorkspaceProject(item);
  const href =
    navigationBaseHref ??
    navigationHref("/portfolio", {
      project: project.slug,
      tab: selection.rawTab ?? selection.activeTab,
    });
  const route: WorkspaceRoute = {
    ...selection,
    navigationBaseHref: href,
    state: parseNavigationUrl(href),
  };
  const Panel = PANELS[selection.activeTab];
  const props: PanelProps = { project, route };
  return (
    <WorkspaceNavigationProvider href={href}>
      <section data-testid="workspace-page" data-slug={project.slug}>
        <Crumbs
          items={[
            { label: t("shell.nav.portafolio"), href: "/portfolio" },
            { label: project.name },
          ]}
        />
        {selection.activeTab === "summary" ? (
          <ProjectHero project={project} headingLevel={headingLevel} />
        ) : (
          <ProjectHeroCompact project={project} headingLevel={headingLevel} />
        )}
        <TabBar
          activeTab={selection.activeTab}
          navigationBaseHref={href}
          projectName={project.name}
          counts={project.counts}
        />
        <div
          key={project.projectPath}
          data-testid="workspace-tab-body"
          role="tabpanel"
          id={`workspace-panel-${selection.activeTab}`}
          aria-labelledby={
            selection.activeTab === "unknown" ? undefined : `workspace-tab-${selection.activeTab}`
          }
          style={{ minWidth: 0 }}
        >
          {Panel(props)}
        </div>
      </section>
    </WorkspaceNavigationProvider>
  );
}
