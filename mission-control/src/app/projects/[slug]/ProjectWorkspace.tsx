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

import path from "node:path";

import { readBuildTimeline } from "@/lib/build-track/build-track";
import { resolveProjectPath } from "@/lib/config/config";
import { readActivityLog, readDecisions } from "@/lib/docs/activity";
import { listProjectDocs, readDoc } from "@/lib/docs/tree";
import { readIdeas } from "@/lib/ideas/ideas";
import { getOverlayFreshness } from "@/lib/overlay-freshness/overlay-freshness";
import { readPending } from "@/lib/pendingMerge/pendingMerge";
import type { ProjectListItem } from "@/lib/portfolio/portfolio";
import { buildSnapshot } from "@/lib/snapshot/snapshot";
import { type Phase, type ProjectStatus, readStatus } from "@/lib/status/status";
import { aggregateProgress, listWorkOrders, readWorkOrderDoc } from "@/lib/work-orders/work-orders";
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

/**
 * Resolve the project's summary — the SAME markdown the board card-detail shows in its
 * Documentos → Resumen. Both read the idea card's markdown body from `factory/ideas/*.md`.
 * Match by the RESOLVED project path: the card's `project` field is a pointer like
 * "mission-control" (NOT the display name), so we compare `resolveProjectPath(card.project)`
 * to the project's own resolved path — the same key the board uses to link a card to its
 * project. Falls back to the title when no card / empty body exists, so it's never blank.
 */
function resolveProjectSummary(projectPath: string, fallback: string): string {
  const card = readIdeas().find(
    (c) => c.project != null && resolveProjectPath(c.project) === projectPath,
  );
  const body = card?.body.trim();
  return body !== undefined && body.length > 0 ? body : fallback;
}

function renderDocumentsTab(
  projectPath: string,
  slug: string,
  docParam: string | undefined,
): React.JSX.Element {
  const nodes = listProjectDocs(projectPath);
  const firstNodeId = nodes[0]?.id ?? null;
  const selectedId =
    nodes.find((n) => n.id === docParam) !== undefined ? (docParam ?? null) : firstNodeId;
  const content =
    selectedId !== null
      ? readDoc(projectPath, nodes.find((n) => n.id === selectedId)?.relPath ?? selectedId)
      : null;
  return <TabDocuments nodes={nodes} selectedId={selectedId} content={content} project={slug} />;
}

/**
 * Party tab body. `project` is the FOLDER name — the emitters stamp `basename $PWD`, not the
 * portfolio display name — and scopes both the event tail and the SSE stream. `workOrders`
 * (same `listWorkOrders` source the objectives bar uses, DR-092) decides the scene structure:
 * sprites/rooms/queue/trophies/counter/gate. `woStarts` (track.jsonl, same reader as
 * Observabilidad) powers the REAL "N min al fuego" bubbles — never a fabricated progress value.
 */
function renderPartyTab(
  projectPath: string,
  running: boolean,
  supervisorHeartbeat?: string,
): React.JSX.Element {
  const partyOrders = listWorkOrders(projectPath);
  const partyTimeline = readBuildTimeline(projectPath, partyOrders);
  const woStarts: Record<string, number> = {};
  for (const tlFrd of partyTimeline.frds) {
    for (const tlWo of tlFrd.workOrders) {
      if (tlWo.startMs !== null) woStarts[tlWo.id] = tlWo.startMs;
    }
  }
  // Campamento (Fase 3): pending-merge worktrees/branches — the SAME readPending the
  // summary tab and the "⎇ pendientes" chip use (DR-092). On a read error the camp
  // simply doesn't render; the Summary tab is the surface that reports the error.
  const pending = readPending(projectPath);
  const tents =
    pending.kind === "ok" ? pending.items.map((i) => ({ branch: i.branch, status: i.status })) : [];
  return (
    <PartyTab
      running={running}
      project={path.basename(projectPath)}
      workOrders={partyOrders}
      woStarts={woStarts}
      supervisorHeartbeat={supervisorHeartbeat}
      tents={tents}
    />
  );
}

/**
 * Summary tab body (WS-2, prototype projResumen). The summary text is the idea-card markdown
 * body — the SAME content the board card-detail shows — falling back to the title when there
 * is no card/body.
 */
function renderSummaryTab(options: {
  projectPath: string;
  slug: string;
  status: Partial<ProjectStatus>;
  snapshot: React.ComponentProps<typeof TabSummary>["snapshot"];
}): React.JSX.Element {
  const { projectPath, slug, status, snapshot } = options;
  const activityLog = readActivityLog(projectPath);
  const decisions = readDecisions(projectPath);
  const pendingDecisions = decisions.filter((dp) => !dp.resolved).length;
  const summary = resolveProjectSummary(projectPath, status.project ?? slug);
  // FRD-20 — is this project's overlay at the factory's current OVERLAY_VERSION, or behind?
  const overlayFreshness = getOverlayFreshness(status.overlayVersion);
  // FRD-21 — this project's un-merged worktrees/branches (read live from git; fail-loud).
  const pendingMerge = readPending(projectPath);
  return (
    <TabSummary
      summary={summary}
      keyPoints={[]}
      activityLog={activityLog}
      decisions={decisions}
      pendingDecisions={pendingDecisions}
      slug={slug}
      snapshot={snapshot}
      deployTarget={status.deployTarget}
      deployUrl={status.deployUrl}
      overlayFreshness={overlayFreshness}
      pendingMerge={pendingMerge}
    />
  );
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

  // Full project name for the header title. The portfolio "Proyecto" cell (item.name) is the
  // FULL name the board card-detail shows (e.g. "Pandacorp (Mission Control)"); status.project
  // can be a shorter label (e.g. "Pandacorp"), so prefer item.name and fall back to status.project.
  const title = item.name.trim().length > 0 ? item.name : (status.project ?? slug);
  const stage = (status.phase ?? item.stage ?? "implementation") as Phase;
  const deployTarget = status.deployTarget;
  const version = status.version ?? "0.0.0";
  const running = item.running === true || status.running === true;
  const progress =
    typeof status.progress === "number" && Number.isFinite(status.progress)
      ? `${status.progress}% completado`
      : undefined;

  // Work-order progress DERIVED from the real work orders (DR-092 single source — the same
  // aggregateProgress the Kanban uses), NOT the stored status.yaml counters, which drift the moment a
  // work order is added/reopened. total = all WOs, done = VERIFIED.
  const woProgress = aggregateProgress(listWorkOrders(projectPath));
  const woDone = woProgress.done;
  // undefined when there are no work orders → the objectives bar is omitted (AC-04-002.2), same as
  // the old "no count" behavior; a number once any WO exists.
  const woTotal = woProgress.total > 0 ? woProgress.total : undefined;

  // FRD-14 snapshot — null when last_green_sha is absent (AC-14-001.3). Rendered inside Summary.
  const snapshot = buildSnapshot(slug, status, Date.now());

  const { activeTab, docParam, woParam, woTabParam } = selection;

  let body: React.JSX.Element;
  switch (activeTab) {
    case "work-orders":
      body = renderWorkOrdersTab(projectPath, slug, woParam, woTabParam);
      break;
    case "party":
      // Pass the authoritative build flag so the scene shows the powered-off state
      // when the build is off, instead of a frozen active scene from a stale event
      // tail (AC-06-013). `running` is derived above from status.yaml / the portfolio.
      body = renderPartyTab(projectPath, running, status.supervisorHeartbeat);
      break;
    case "observabilidad": {
      const obsOrders = listWorkOrders(projectPath);
      const timeline = readBuildTimeline(projectPath, obsOrders);
      body = (
        <div data-testid="tab-observabilidad-body" style={{ padding: "12px 16px" }}>
          <ObservabilidadTab workOrders={obsOrders} timeline={timeline} project={slug} />
        </div>
      );
      break;
    }
    case "documents":
      body = renderDocumentsTab(projectPath, slug, docParam);
      break;
    case "commands":
      body = <TabCommands phase={stage} slug={slug} />;
      break;
    default:
      body = renderSummaryTab({ projectPath, slug, status, snapshot });
  }

  return (
    <section data-testid="workspace-page" data-slug={slug}>
      {/* Header + objectives bar live in ONE rounded panel (prototype compactProjectHeader).
          The objectives bar is passed as children so it renders inside that same panel. */}
      <WorkspaceHeader
        title={title}
        stage={stage}
        deployTarget={deployTarget}
        version={version}
        progress={progress}
        running={running}
        headingLevel={headingLevel}
      >
        <ObjectivesBar done={woDone} total={woTotal} />
      </WorkspaceHeader>

      {/* Breathing room between the header panel and the tabs (prototype: panel margin-bottom:12px).
          The tabs are NOT flush against the header; TabBar owns its own bottom padding. */}
      <div style={{ marginTop: "12px" }}>
        <TabBar activeTab={activeTab} />
      </div>

      <div data-testid="workspace-tab-body">{body}</div>
    </section>
  );
}
