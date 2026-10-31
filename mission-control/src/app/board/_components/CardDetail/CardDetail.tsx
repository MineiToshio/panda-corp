"use client";

import { useEffect } from "react";
import { IdeaDocs } from "@/app/board/_components/IdeaDocs/IdeaDocs";
import type { Tone } from "@/components/core/Chip/vocabulary";
import { type LinkResolver, Markdown } from "@/components/core/Markdown/Markdown";
import { Tabs } from "@/components/core/Tabs/Tabs";
import { CampaignPipeline } from "@/components/modules/CampaignPipeline/CampaignPipeline";
import type { Adr } from "@/lib/architecture/adr";
import type { DataModelResult } from "@/lib/architecture/data-model/types";
import type { EnvVar } from "@/lib/architecture/env";
import { phaseFromStatus } from "@/lib/campaign/campaign";
import { t } from "@/lib/copy/copy";
import { classifyDocLink } from "@/lib/docs/links";
import type { DocNode } from "@/lib/docs/tree";
import type { IdeaStatus } from "@/lib/ideas/ideas";
import { updateNavigation, useUrlState } from "@/lib/navigation/useUrlState";
import type { DigestSourceErrors } from "@/lib/spec/read-artifacts";
import type { DigestFrd } from "@/lib/spec/read-frds";
import type { Phase } from "@/lib/status/status";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { ArchitectureDigest } from "./ArchitectureDigest/ArchitectureDigest";
import { PANEL_HIDDEN_STYLE, PANEL_STYLE, ROOT_STYLE, TITLE_STYLE } from "./CardDetail.styles";
import { IdeaPitch } from "./IdeaPitch/IdeaPitch";
import { SpecDigest } from "./SpecDigest/SpecDigest";
import { useCardDocument } from "./useCardDocument";

type TabKey = "propuesta" | "spec" | "arquitectura" | "docs" | "campana";

interface TabDef {
  id: TabKey;
  label: string;
  icon?: string;
  tone?: Tone;
}

const ALL_TABS: TabDef[] = [
  { id: "propuesta", label: t("idea.tabs.propuesta"), icon: "bulb", tone: "blue" },
  { id: "spec", label: t("idea.tabs.spec"), icon: "layers", tone: "blue" },
  { id: "arquitectura", label: t("idea.tabs.arquitectura"), icon: "cube", tone: "amber" },
  { id: "docs", label: t("idea.tabs.documentos"), icon: "file", tone: "violet" },
  { id: "campana", label: t("idea.tabs.campana"), icon: "flag", tone: "teal" },
];

function defaultTabForPhase(
  activePhase: number,
  hasSpec: boolean,
  hasArchitecture: boolean,
): TabKey {
  if (activePhase >= 3 && hasArchitecture) return "arquitectura";
  if (activePhase >= 1 && hasSpec) return "spec";
  return "propuesta";
}

const TAB_TEST_ID_PREFIX = "card-detail-tab-";

const SUMMARY_KEY = "summary";

const READER_STATE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "0.875rem",
  color: "var(--color-text-muted, var(--color-text2, currentColor))",
};

const FRD_FILE_LABEL: Record<string, string> = {
  "frd.md": t("idea.docs.contract"),
  "fdd.md": t("idea.docs.design"),
  "blueprint.md": t("idea.docs.implementation"),
};

interface DocRailItem {
  relPath: string;

  label: string;
}

interface DocRailSection {
  heading: string;
  items: DocRailItem[];
}

function frdSlugFromGroup(group: string): string {
  return group.startsWith("Feature: ") ? group.slice("Feature: ".length) : group;
}

function buildDocSections(docNodes: readonly DocNode[]): DocRailSection[] {
  const sections: DocRailSection[] = [];

  const productItems: DocRailItem[] = [];
  const prd = docNodes.find((n) => n.relPath === "docs/product/prd.md");
  if (prd) productItems.push({ relPath: prd.relPath, label: t("idea.docs.prd") });
  const research = docNodes.find((n) => n.relPath === "docs/product/research.md");
  if (research) productItems.push({ relPath: research.relPath, label: t("idea.docs.research") });
  if (productItems.length > 0)
    sections.push({ heading: t("idea.docs.sectionProduct"), items: productItems });

  const frdOrder: string[] = [];
  const byGroup = new Map<string, DocRailItem[]>();
  for (const node of docNodes) {
    if (!node.group.startsWith("Feature:")) continue;
    let items = byGroup.get(node.group);
    if (items == null) {
      items = [];
      byGroup.set(node.group, items);
      frdOrder.push(node.group);
    }
    items.push({ relPath: node.relPath, label: FRD_FILE_LABEL[node.label] ?? node.label });
  }
  for (const group of frdOrder) {
    sections.push({ heading: frdSlugFromGroup(group), items: byGroup.get(group) ?? [] });
  }

  return sections;
}

function makeCardLinkResolver(
  currentRelPath: string,
  knownDocPaths: ReadonlySet<string>,
  onSelectDoc: (relPath: string, anchor?: string) => void,
): LinkResolver {
  return (href) => {
    const target = classifyDocLink(href, currentRelPath, knownDocPaths);
    switch (target.kind) {
      case "doc":
        return { onSelect: () => onSelectDoc(target.relPath, target.anchor) };
      case "anchor":
        return { href: target.href, external: false };
      case "external":
        return { href: target.href, external: true };
      default:
        return null;
    }
  };
}

interface DocReaderBodyProps {
  noReader: boolean;

  docLoading: boolean;

  docContent: string | null;

  resolveLink: LinkResolver;
}

function DocReaderBody({
  noReader,
  docLoading,
  docContent,
  resolveLink,
}: DocReaderBodyProps): React.JSX.Element {
  if (noReader) {
    return <p style={READER_STATE_STYLE}>{t("idea.docs.workspace")}</p>;
  }
  if (docLoading) {
    return (
      <p style={READER_STATE_STYLE} aria-live="polite">
        {t("idea.docs.loading")}
      </p>
    );
  }
  if (docContent != null) {
    return <Markdown resolveLink={resolveLink}>{docContent}</Markdown>;
  }
  return <p style={READER_STATE_STYLE}>{t("idea.docs.readError")}</p>;
}

function useCardTabs(
  activePhase: number,
  specContent: string | undefined,
  project: string | undefined,
) {
  const hasSpec = specContent != null && specContent !== "";
  const hasArchitecture = Boolean(project);
  const [tabKey] = useUrlState("boardTab", "");
  const fallbackTab = defaultTabForPhase(activePhase, hasSpec, hasArchitecture);
  const tabs = ALL_TABS.filter(
    (tab) =>
      (tab.id !== "spec" || hasSpec) &&
      (tab.id !== "arquitectura" || hasArchitecture) &&
      (tab.id !== "docs" || Boolean(project)),
  );
  const activeTab = tabs.find((tab) => tab.id === tabKey)?.id ?? fallbackTab;
  useEffect(() => {
    if (tabKey !== activeTab) {
      updateNavigation({ boardTab: activeTab }, { replace: true });
    }
  }, [tabKey, activeTab]);
  return { activeTab, tabs };
}

export interface CardDetailProps {
  slug: string;
  readonly sourceErrors?: DigestSourceErrors;
  readonly frds?: readonly DigestFrd[];
  readonly navigationBaseHref?: string;
  readonly constructionStarted?: boolean;
  readonly forgeHref?: string;

  title: string;

  status: IdeaStatus;

  body: string;

  phase?: Phase;

  projectType?: string;

  targetPlatforms?: string;

  docNodes?: DocNode[];

  frdCount?: number;

  specContent?: string;

  architectureContent?: string;
  dataModel?: DataModelResult;

  workOrders?: WorkOrder[];

  envVars?: EnvVar[];

  adrs?: Adr[];

  project?: string;

  readDocAction?: (project: string, relPath: string) => Promise<string | null>;

  isRunning?: boolean;
}

function selectedDocument(key: string, nodes?: readonly DocNode[]): string {
  return (
    (nodes ?? []).find((node) => node.relPath === key || node.id === key)?.relPath ?? SUMMARY_KEY
  );
}
function documentCount(tab: string, nodes?: readonly DocNode[]): number | undefined {
  return tab === "docs" ? (nodes ?? []).length : undefined;
}

/** Full-width idea tabs with URL-owned selections and one live project artifact bundle. */
export function CardDetail({
  slug,
  title,
  status,
  body,
  phase,
  projectType,
  targetPlatforms,
  docNodes,
  frdCount,
  specContent = "",
  architectureContent = "",
  dataModel,
  workOrders,
  envVars,
  adrs,
  project,
  readDocAction,
  isRunning,
  sourceErrors,
  frds,
  navigationBaseHref,
  constructionStarted,
  forgeHref,
}: CardDetailProps): React.JSX.Element {
  const activePhase = phaseFromStatus({ cardStatus: status, phase });
  const { activeTab, tabs } = useCardTabs(activePhase, specContent, project);
  const [docKey] = useUrlState("doc", SUMMARY_KEY);
  const selectedDocKey = selectedDocument(docKey, docNodes);
  const { docContent, docLoading } = useCardDocument(
    selectedDocKey,
    docNodes,
    project,
    readDocAction,
  );

  const sections = buildDocSections(docNodes ?? []);

  const handleSelectSummary = () => {
    updateNavigation({ boardTab: "docs", doc: null });
  };
  const handleSelectDoc = (relPath: string, anchor = "") => {
    updateNavigation({ boardTab: "docs", doc: relPath });
    if (window.location.hash !== anchor) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}${anchor}`,
      );
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  };
  const handleTabChange = (id: string) => {
    const match = tabs.find((tab) => tab.id === id);
    if (match != null)
      updateNavigation({
        boardTab: match.id,
        doc: null,
        specFrd: null,
        architectureFrd: null,
        adr: null,
        expanded: null,
      });
  };

  const panelStyle = (key: TabKey): React.CSSProperties =>
    activeTab === key ? PANEL_STYLE : PANEL_HIDDEN_STYLE;

  const isSummary = selectedDocKey === SUMMARY_KEY;

  const noReader = !readDocAction || !project;

  const knownDocPaths = new Set((docNodes ?? []).map((node) => node.relPath));
  const resolveDocLink = makeCardLinkResolver(
    isSummary ? "" : selectedDocKey,
    knownDocPaths,
    handleSelectDoc,
  );

  return (
    <section
      data-testid="card-detail"
      style={ROOT_STYLE}
      aria-label={t("idea.detailAria", { title })}
    >
      <h2 style={TITLE_STYLE}>{title}</h2>

      <Tabs
        level="sub"
        ariaLabel={t("idea.tabs.aria")}
        tabs={tabs.map((tab) => ({
          ...tab,
          count: documentCount(tab.id, docNodes),
        }))}
        active={activeTab}
        onChange={handleTabChange}
        panelIdPrefix="card-detail-panel-"
        tabIdPrefix={TAB_TEST_ID_PREFIX}
        testIdPrefix={TAB_TEST_ID_PREFIX}
      />

      <div
        id="card-detail-panel-propuesta"
        data-testid="card-detail-panel-propuesta"
        hidden={activeTab !== "propuesta"}
        role="tabpanel"
        aria-labelledby="card-detail-tab-propuesta"
        style={panelStyle("propuesta")}
      >
        <IdeaPitch
          title={title}
          body={body}
          projectType={projectType}
          targetPlatforms={targetPlatforms}
          resolveLink={resolveDocLink}
        />
      </div>

      {activeTab === "spec" && (
        <div
          id="card-detail-panel-spec"
          data-testid="card-detail-panel-spec"
          hidden={activeTab !== "spec"}
          role="tabpanel"
          aria-labelledby="card-detail-tab-spec"
          style={panelStyle("spec")}
        >
          {
            <SpecDigest
              title={title}
              body={specContent}
              projectType={projectType}
              targetPlatforms={targetPlatforms}
              frdCount={frdCount}
              project={project}
              workOrders={workOrders}
              frds={frds}
              sourceErrors={sourceErrors}
              navigationBaseHref={navigationBaseHref}
              constructionStarted={constructionStarted}
              resolveLink={resolveDocLink}
            />
          }
        </div>
      )}

      {activeTab === "arquitectura" && (
        <div
          id="card-detail-panel-arquitectura"
          data-testid="card-detail-panel-arquitectura"
          hidden={activeTab !== "arquitectura"}
          role="tabpanel"
          aria-labelledby="card-detail-tab-arquitectura"
          style={panelStyle("arquitectura")}
        >
          {
            <ArchitectureDigest
              title={title}
              body={architectureContent}
              dataModel={dataModel}
              projectType={projectType}
              targetPlatforms={targetPlatforms}
              workOrders={workOrders}
              envVars={envVars}
              adrs={adrs}
              frds={frds}
              sourceErrors={sourceErrors}
              navigationBaseHref={navigationBaseHref}
              constructionStarted={constructionStarted}
              project={project}
              resolveLink={resolveDocLink}
            />
          }
        </div>
      )}

      <div
        id="card-detail-panel-campana"
        data-testid="card-detail-panel-campana"
        hidden={activeTab !== "campana"}
        role="tabpanel"
        aria-labelledby="card-detail-tab-campana"
        style={panelStyle("campana")}
      >
        {activeTab === "campana" && (
          <CampaignPipeline
            slug={slug}
            project={project}
            activePhase={activePhase}
            running={isRunning === true}
            forgeHref={forgeHref}
          />
        )}
      </div>

      <div
        id="card-detail-panel-docs"
        data-testid="card-detail-panel-docs"
        hidden={activeTab !== "docs"}
        role="tabpanel"
        aria-labelledby="card-detail-tab-docs"
        style={panelStyle("docs")}
      >
        <IdeaDocs
          sections={sections}
          selectedDocKey={selectedDocKey}
          onSelectDoc={handleSelectDoc}
          onSelectSummary={handleSelectSummary}
          phase={phase}
          title={isSummary ? t("idea.docs.ideaCard") : selectedDocKey}
          path={isSummary ? `${slug}.md` : selectedDocKey}
        >
          {isSummary ? (
            <div data-testid="card-detail-summary">
              <Markdown resolveLink={resolveDocLink}>{body}</Markdown>
            </div>
          ) : (
            <DocReaderBody
              noReader={noReader}
              docLoading={docLoading}
              docContent={docContent}
              resolveLink={resolveDocLink}
            />
          )}
        </IdeaDocs>
      </div>
    </section>
  );
}
