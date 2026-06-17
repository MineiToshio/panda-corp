/**
 * WO-04-004 — Project workspace page (CMP-04-workspace)
 *
 * Server Component: resolves the project from the URL slug, reads status + docs,
 * then renders the workspace shell:
 *   - WorkspaceHeader (CMP-04-header)       — title, stage, version, progress
 *   - ObjectivesBar (CMP-04-objectives-bar) — work_orders_done/total + %
 *   - TabBar (CMP-04-tabbar)                — 5 tabs, URL-driven selection
 *   - Active tab body (slot)                — one of the five tab components
 *
 * Tab bodies (AC-04-001.1, blueprint §3):
 *   summary   → TabSummary (CMP-04-tab-summary)     WO-04-005
 *   work-orders → WorkOrderBoard (CMP-05-board)     FRD-05 (already shipped)
 *   party       → PartyTab (CMP-06-*)               FRD-06 (already shipped)
 *   documents   → TabDocuments (CMP-04-tab-documents) WO-04-006
 *   commands    → TabCommands (CMP-04-tab-commands)     WO-04-007
 *
 * URL-driven selection (AC-04-001.2):
 *   - ?tab=<id>   → that tab active.
 *   - absent/invalid → "summary" (default).
 *   - ?doc=<id>   → document selection within the Documents tab.
 *
 * Design rules (AGENTS.md / FRD-13):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on the page root and significant containers.
 *   - Spanish copy via i18n (component-level).
 *   - Server Component only (TabBar has its own "use client").
 *
 * Traceability:
 *   CMP-04-workspace → REQ-04-001, REQ-04-002
 *   AC-04-001.1, AC-04-001.2, AC-04-002.1, AC-04-002.2, AC-04-002.3
 *   IF-04-status (lib/status.ts), IF-04-docs (lib/docs.ts),
 *   IF-03-activeProjects (lib/portfolio.ts)
 */

import { notFound } from "next/navigation";
import { listProjectDocs, readActivityLog, readDecisions, readDoc } from "@/lib/docs";
import { activeProjects } from "@/lib/portfolio";
import { type Phase, readStatus } from "@/lib/status";
import { listWorkOrders } from "@/lib/work-orders";
import { ObjectivesBar } from "./_components/objectives-bar";
import { TabCommands } from "./_components/tab-commands";
import { TabDocuments } from "./_components/tab-documents";
import { TabSummary } from "./_components/tab-summary";
import { TabBar, type TabId } from "./_components/tabbar";
import { WorkOrderBoard } from "./_components/wo-board";
import { WorkspaceHeader } from "./_components/workspace-header";
import { PartyTab } from "./_party/PartyTab";

// ---------------------------------------------------------------------------
// Next.js App Router types (Next.js 16: params and searchParams are Promises)
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// ---------------------------------------------------------------------------
// Valid tab ids (AC-04-001.1)
// ---------------------------------------------------------------------------

const VALID_TABS = new Set<string>(["summary", "work-orders", "party", "documents", "commands"]);

function resolveTab(raw: string | string[] | undefined): TabId {
  if (typeof raw === "string" && VALID_TABS.has(raw)) {
    return raw as TabId;
  }
  // Default: Summary (AC-04-001.2)
  return "summary";
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

const PAGE_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100dvh",
  overflow: "hidden",
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
};

const CHROME_STYLE: React.CSSProperties = {
  flexShrink: 0,
};

const BODY_STYLE: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  display: "flex",
  flexDirection: "column",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ProjectWorkspacePage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  // Resolve Next.js 16 promise-based params
  const { slug } = await params;
  const sp = await searchParams;

  // --- Resolve project path from slug ---
  // The slug is the project name from the portfolio (selection.ts pattern).
  const items = activeProjects();
  const item = items.find((p) => p.name === slug);
  if (item === undefined) {
    notFound();
  }

  const projectPath = item.path;

  // --- Read project status ---
  const statusResult = readStatus(projectPath);
  const status = statusResult.present && statusResult.status !== null ? statusResult.status : {};

  // Derive header props
  const title = status.project ?? slug;
  const stage = status.phase ?? item.stage ?? "implementation";
  const version = status.version ?? "0.0.0";
  // progress in status.yaml is a number (e.g. 75 = 75% done); format as a string for the header.
  // The AC says "progress string when present" — we render it as "<N>% completado" when numeric.
  const progress =
    typeof status.progress === "number" && Number.isFinite(status.progress)
      ? `${status.progress}% completado`
      : undefined;

  // Derive objectives bar props
  const woDone = status.workOrdersDone ?? 0;
  const woTotal = status.workOrdersTotal;

  // --- URL-driven tab selection ---
  const activeTab = resolveTab(sp.tab);
  const docParam = typeof sp.doc === "string" ? sp.doc : undefined;

  // --- Read tab-specific data (lazy: only what the active tab needs) ---
  let tabBody: React.JSX.Element;

  if (activeTab === "summary") {
    const activityLog = readActivityLog(projectPath);
    const decisions = readDecisions(projectPath);
    const pendingDecisions = decisions.filter((dp) => !dp.resolved).length;
    tabBody = (
      <TabSummary
        summary={status.project ?? slug}
        keyPoints={[]}
        activityLog={activityLog}
        decisions={decisions}
        pendingDecisions={pendingDecisions}
      />
    );
  } else if (activeTab === "work-orders") {
    const orders = listWorkOrders(projectPath);
    tabBody = <WorkOrderBoard orders={orders} />;
  } else if (activeTab === "party") {
    tabBody = <PartyTab />;
  } else if (activeTab === "documents") {
    const nodes = listProjectDocs(projectPath);
    // Default: first node's relPath, or the ?doc= param if valid
    const firstNodeId = nodes[0]?.id ?? null;
    const selectedId =
      nodes.find((n) => n.id === docParam) !== undefined ? (docParam ?? null) : firstNodeId;
    const content =
      selectedId !== null
        ? readDoc(projectPath, nodes.find((n) => n.id === selectedId)?.relPath ?? selectedId)
        : null;
    tabBody = <TabDocuments nodes={nodes} selectedId={selectedId} content={content} />;
  } else {
    // commands — CMP-04-tab-commands (WO-04-007, AC-04-005.1/.2)
    tabBody = <TabCommands phase={stage as Phase} slug={slug} />;
  }

  return (
    <main data-testid="workspace-page" data-slug={slug} style={PAGE_STYLE}>
      {/* Chrome: header + objectives bar + tab bar (AC-04-002.3 — always visible) */}
      <div style={CHROME_STYLE}>
        <WorkspaceHeader title={title} stage={stage} version={version} progress={progress} />
        <ObjectivesBar done={woDone} total={woTotal} />
        <TabBar activeTab={activeTab} />
      </div>

      {/* Tab body — changes with active tab */}
      <div data-testid="workspace-tab-body" style={BODY_STYLE}>
        {tabBody}
      </div>
    </main>
  );
}
