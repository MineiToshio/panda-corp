/**
 * ProjectWorkspace — the shared project workspace body (CMP-04-workspace).
 *
 * Extracted from the standalone `/projects/[slug]` page so the SAME workspace renders in TWO places,
 * faithful to the prototype where the workspace lives in the Portfolio's right pane (portfolioView →
 * projectPane): a rail on the left, the full workspace on the right.
 *   - `/projects/[slug]/page.tsx`        — standalone deep-link.
 *   - Portfolio right pane (WorkspaceSlot) — the prototype's canonical surface.
 *
 * Normal document flow (no 100dvh/overflow chrome): the page column (#pcapp, 1240px) provides the
 * frame, exactly like the prototype's projectPane sits inside #pcapp. The caller resolves the project
 * (so /projects can 404 while Portfolio degrades gracefully); this component is presentation + the
 * lazy per-tab data reads.
 *
 * Tab selection is URL-driven and context-agnostic: TabBar merges `?tab=` into the CURRENT route's
 * query (so `?project=` survives inside Portfolio). Snapshot panel lives INSIDE the Summary tab
 * (prototype projResumen), not in always-visible chrome.
 *
 * Traceability: CMP-04-workspace → REQ-04-001/002; FRD-03 (projectPane embed), WS-2/WS-3.
 */

import { resolveProjectPath } from "@/lib/config/config";
import { readActivityLog, readDecisions } from "@/lib/docs/activity";
import { listProjectDocs, readDoc } from "@/lib/docs/tree";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import { buildSnapshot } from "@/lib/snapshot/snapshot";
import { type Phase, readStatus } from "@/lib/status/status";
import { listWorkOrders, readWorkOrderDoc } from "@/lib/work-orders/work-orders";
import { ObjectivesBar } from "./_components/objectives-bar";
import { TabCommands } from "./_components/tab-commands/tab-commands";
import { TabDocuments } from "./_components/tab-documents/tab-documents";
import { TabSummary } from "./_components/tab-summary/tab-summary";
import { TabWorkOrders } from "./_components/tab-work-orders/tab-work-orders";
import { TabBar, type TabId } from "./_components/tabbar";
import { type WoDetailTab, WorkOrderDetail } from "./_components/wo-detail/wo-detail";
import { WorkspaceHeader } from "./_components/workspace-header";
import { ObservabilidadTab } from "./_observability/ObservabilidadTab/ObservabilidadTab";
import { PartyTab } from "./_party/PartyTab/PartyTab";

// ---------------------------------------------------------------------------
// Selection (URL-derived; resolved by the caller from its own searchParams)
// ---------------------------------------------------------------------------

export interface WorkspaceSelection {
  activeTab: TabId;
  docParam: string | undefined;
  woParam: string | undefined;
  woTabParam: WoDetailTab;
}

const VALID_TABS = new Set<string>([
  "summary",
  "work-orders",
  "party",
  "observabilidad",
  "documents",
  "commands",
]);

/** Resolve the active tab id from a raw `?tab=` param (default: summary). */
export function resolveWorkspaceTab(raw: string | string[] | undefined): TabId {
  return typeof raw === "string" && VALID_TABS.has(raw) ? (raw as TabId) : "summary";
}

export interface ProjectWorkspaceProps {
  /**
   * Resolved active-project entry (caller does the lookup so it owns the not-found policy). Carries
   * the already-resolved `status` (StatusResult from the portfolio enrichment) — we reuse it instead
   * of re-reading, and resolve `path` against the factory root for the per-tab file reads.
   */
  item: ProjectListItem;
  /** URL-derived tab + sub-selection. */
  selection: WorkspaceSelection;
  /** Title heading level — 1 standalone (default), 2 when embedded under Portfolio's h1. */
  headingLevel?: 1 | 2;
}

// ---------------------------------------------------------------------------
// Per-tab body resolvers (lazy reads stay co-located with the branch that owns them)
// ---------------------------------------------------------------------------

function renderWorkOrdersTab(
  projectPath: string,
  slug: string,
  woParam: string | undefined,
  woTabParam: WoDetailTab,
): React.JSX.Element {
  const orders = listWorkOrders(projectPath);
  const selectedOrder =
    woParam !== undefined ? (orders.find((o) => o.id === woParam) ?? null) : null;
  if (selectedOrder !== null) {
    const woContent = readWorkOrderDoc(projectPath, selectedOrder.relPath);
    return <WorkOrderDetail order={selectedOrder} content={woContent} activeWoTab={woTabParam} />;
  }
  return <TabWorkOrders orders={orders} project={slug} />;
}

function renderDocumentsTab(projectPath: string, docParam: string | undefined): React.JSX.Element {
  const nodes = listProjectDocs(projectPath);
  const firstNodeId = nodes[0]?.id ?? null;
  const selectedId =
    nodes.find((n) => n.id === docParam) !== undefined ? (docParam ?? null) : firstNodeId;
  const content =
    selectedId !== null
      ? readDoc(projectPath, nodes.find((n) => n.id === selectedId)?.relPath ?? selectedId)
      : null;
  return <TabDocuments nodes={nodes} selectedId={selectedId} content={content} />;
}

// ---------------------------------------------------------------------------
// ProjectWorkspace
// ---------------------------------------------------------------------------

export function ProjectWorkspace({
  item,
  selection,
  headingLevel = 1,
}: ProjectWorkspaceProps): React.JSX.Element {
  const slug = item.name;
  // Resolve against the factory root (item.path is the raw portfolio cell, relative to that root —
  // NOT to the app's cwd) before any file read, then read status from the SAME resolved location.
  const projectPath = resolveProjectPath(item.path);
  const statusResult = readStatus(projectPath);
  const status = statusResult.present && statusResult.status !== null ? statusResult.status : {};

  const title = status.project ?? slug;
  const stage = (status.phase ?? item.stage ?? "implementation") as Phase;
  const deployTarget = status.deployTarget;
  const version = status.version ?? "0.0.0";
  const running = item.running === true || status.running === true;
  const progress =
    typeof status.progress === "number" && Number.isFinite(status.progress)
      ? `${status.progress}% completado`
      : undefined;

  const woDone = status.workOrdersDone ?? 0;
  const woTotal = status.workOrdersTotal;

  // FRD-14 snapshot — null when last_green_sha is absent (AC-14-001.3). Rendered inside Summary.
  const snapshot = buildSnapshot(slug, status);

  const { activeTab, docParam, woParam, woTabParam } = selection;

  let body: React.JSX.Element;
  switch (activeTab) {
    case "work-orders":
      body = renderWorkOrdersTab(projectPath, slug, woParam, woTabParam);
      break;
    case "party":
      body = <PartyTab />;
      break;
    case "observabilidad": {
      const obsOrders = listWorkOrders(projectPath);
      body = (
        <div data-testid="tab-observabilidad-body" style={{ padding: "12px 16px" }}>
          <ObservabilidadTab workOrders={obsOrders} project={slug} />
        </div>
      );
      break;
    }
    case "documents":
      body = renderDocumentsTab(projectPath, docParam);
      break;
    case "commands":
      body = <TabCommands phase={stage} slug={slug} />;
      break;
    default: {
      // summary — snapshot panel lives inside the tab (WS-2, prototype projResumen)
      const activityLog = readActivityLog(projectPath);
      const decisions = readDecisions(projectPath);
      const pendingDecisions = decisions.filter((dp) => !dp.resolved).length;
      body = (
        <TabSummary
          summary={status.project ?? slug}
          keyPoints={[]}
          activityLog={activityLog}
          decisions={decisions}
          pendingDecisions={pendingDecisions}
          slug={slug}
          snapshot={snapshot}
        />
      );
    }
  }

  return (
    <section data-testid="workspace-page" data-slug={slug}>
      <WorkspaceHeader
        title={title}
        stage={stage}
        deployTarget={deployTarget}
        version={version}
        progress={progress}
        running={running}
        headingLevel={headingLevel}
      />
      <ObjectivesBar done={woDone} total={woTotal} />
      <TabBar activeTab={activeTab} />
      <div data-testid="workspace-tab-body">{body}</div>
    </section>
  );
}
