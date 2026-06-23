"use client";

/**
 * WO-02-007 (reopened) — CardDetail component (CMP-02-card-detail)
 *
 * Traceability:
 *   CMP-02-card-detail → REQ-02-004, REQ-02-008, REQ-02-009, REQ-02-010
 *   AC-02-004.1  WHEN the owner clicks a card, the system SHALL show:
 *                summary, key points, docs navigator. The next-step command now
 *                lives in the campaign ficha (CampaignPipeline), not here.
 *   AC-02-008.1  Idea with no documents → show only the summary, no project docs, no crash.
 *   AC-02-009.1  Two horizontal tabs (Campaña · Documentos); default = Campaña.
 *   AC-02-009.2  Clicking a tab activates it and shows its body.
 *   AC-02-009.3  Clicking a document entry switches the active tab to Documentos.
 *   AC-02-009.4  Active tab persists across re-renders of the card detail.
 *
 * Documentos tab — navigable docs WITH content (DR-046):
 *   The left rail reads like a file browser: "Resumen" first, then a "Producto"
 *   section (PRD · Research), then one section per FRD (Contrato/Diseño/Implementación).
 *   Selecting "Resumen" shows the card body; selecting a project doc lazily loads
 *   its markdown body via the injected read action (the board ships only the doc
 *   STRUCTURE, so a doc's body is fetched on demand). Both render via <Markdown>.
 *
 * Style constants live in CardDetail.styles.ts (sibling).
 *
 * Design rules (AGENTS.md):
 *   - Zero hardcoded color values — all via CSS custom properties.
 *   - data-testid on every significant element (test-writer contract).
 *   - Spanish copy + aria-labels (single operator, Spanish UI).
 *   - Read-only over the factory: the read action validates relPath against the
 *     discovered set (traversal-safe); no writes, no Claude calls.
 *   - "use client" required: uses useState/useTransition (tab + reader state).
 *
 * Panel visibility strategy:
 *   Inactive panels use the classic "visually hidden but accessible" clip technique
 *   (PANEL_HIDDEN_STYLE) so that getByTestId and getByRole queries in sibling test
 *   files continue to find elements in all panels, not only the active one.
 */

import { useState, useTransition } from "react";
import { Markdown } from "@/components/core/Markdown/Markdown";
import { Tabs } from "@/components/core/Tabs/Tabs";
import { CampaignPipeline } from "@/components/modules/CampaignPipeline/CampaignPipeline";
import { phaseFromStatus } from "@/lib/campaign/campaign";
import type { DocNode } from "@/lib/docs/tree";
import type { IdeaStatus } from "@/lib/ideas/ideas";
import type { DeployTarget, Phase } from "@/lib/status/status";
import {
  DOCS_NAV_HEADING_STYLE,
  DOCS_READER_STYLE,
  DOCS_SIDEBAR_STYLE,
  docsNavItemStyle,
  PANEL_HIDDEN_STYLE,
  PANEL_STYLE,
  ROOT_STYLE,
  SUMMARY_STYLE,
  TITLE_STYLE,
} from "./CardDetail.styles";

// ---------------------------------------------------------------------------
// Tab definitions (AC-02-009.1)
// ---------------------------------------------------------------------------

type TabKey = "campana" | "docs";

interface TabDef {
  id: TabKey;
  label: string;
  icon?: string;
}

const TABS: TabDef[] = [
  { id: "campana", label: "Campaña", icon: "ti-map-2" },
  { id: "docs", label: "Documentos", icon: "ti-files" },
];

/** Stable prefix so the shared Tabs primitive emits this screen's test ids. */
const TAB_TEST_ID_PREFIX = "card-detail-tab-";

/** Sentinel key for the always-present "Resumen" rail item (vs a doc's relPath). */
const SUMMARY_KEY = "summary";

const DOCS_NAV_LIST_STYLE: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const DOCS_NAV_ICON_STYLE: React.CSSProperties = { fontSize: "13px", flexShrink: 0 };

/** Section header inside the rail (a sibling of the rail's top label). */
const DOCS_NAV_SECTION_STYLE: React.CSSProperties = {
  ...DOCS_NAV_HEADING_STYLE,
  margin: "calc(var(--spacing, 0.25rem) * 1.5) 0 calc(var(--spacing, 0.25rem) * 0.5)",
};

const READER_STATE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "0.875rem",
  color: "var(--color-text-muted, var(--color-text2, currentColor))",
};

// ---------------------------------------------------------------------------
// Rail model — group the scoped DocNodes into a file-browser-like structure.
// ---------------------------------------------------------------------------

/** Friendly Spanish label for a per-FRD doc filename. */
const FRD_FILE_LABEL: Record<string, string> = {
  "frd.md": "Contrato (frd.md)",
  "fdd.md": "Diseño (fdd.md)",
  "blueprint.md": "Implementación (blueprint.md)",
};

interface DocRailItem {
  /** Selection key — the doc's relPath (used as selectedDocKey + read arg). */
  relPath: string;
  /** Display label in the rail. */
  label: string;
}

interface DocRailSection {
  /** Section header text (uppercase label). */
  heading: string;
  items: DocRailItem[];
}

/** Strip the "Feature: " prefix from an FRD group to get the bare slug. */
function frdSlugFromGroup(group: string): string {
  return group.startsWith("Feature: ") ? group.slice("Feature: ".length) : group;
}

/**
 * Turn the flat scoped DocNode list into rail sections:
 *   "Producto"  — PRD (label "PRD") + Research (label "Research"), if present.
 *   one section per FRD — header = the frd slug; items labelled Contrato/Diseño/Implementación.
 * The page-level scope already excludes architecture.md, the Global group and .pandacorp.
 */
function buildDocSections(docNodes: readonly DocNode[]): DocRailSection[] {
  const sections: DocRailSection[] = [];

  // --- Producto section (PRD + Research) ---
  const productItems: DocRailItem[] = [];
  const prd = docNodes.find((n) => n.relPath === "docs/product/prd.md");
  if (prd) productItems.push({ relPath: prd.relPath, label: "PRD" });
  const research = docNodes.find((n) => n.relPath === "docs/product/research.md");
  if (research) productItems.push({ relPath: research.relPath, label: "Research" });
  if (productItems.length > 0) sections.push({ heading: "Producto", items: productItems });

  // --- One section per FRD (preserve discovery order; stable per group) ---
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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CardDetailProps {
  /** Filename without .md — uniquely identifies the card. */
  slug: string;
  /** Frontmatter `title` field. */
  title: string;
  /** Frontmatter `status` field — validated against the IdeaStatus union. */
  status: IdeaStatus;
  /** Markdown body (summary + key points). Rendered via react-markdown. */
  body: string;
  /** Project phase from linked project's status.yaml (in-pipeline only). */
  phase?: Phase;
  /** Deploy target (DR-085) — surfaced in the campaign's Release ficha (internal/external). */
  deployTarget?: DeployTarget;
  /** DR-032: whether a skill has advanced a phase and is waiting for "ok, advance". */
  advancePending?: boolean;
  /**
   * Scoped doc STRUCTURE for the Documentos tab (PRD + research + per-FRD docs),
   * from listProjectDocs in page.tsx. Absent/empty → the rail lists only "Resumen".
   * Bodies are NOT included; they load lazily via `readDocAction` on select.
   */
  docNodes?: DocNode[];
  /** Portfolio path of the linked project (the read action's first argument). */
  project?: string;
  /**
   * Read-only action that returns a scoped doc's markdown body on demand.
   * Optional: when absent (older callers/tests), the reader shows a graceful
   * "opens in the project workspace" fallback instead of crashing.
   */
  readDocAction?: (project: string, relPath: string) => Promise<string | null>;
  /** Whether the linked project is actively building (status.yaml running:true) —
   *  drives "en curso" + roam vs "fase actual" + idle-bob in the campaign. */
  isRunning?: boolean;
  /**
   * Host-navigation callback — called when the user activates "Entrar a La Fragua"
   * in the build phase of CampaignPipeline (AC-02-010.5).
   */
  onEnterForge?: (slug: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noop(): void {
  // Default no-op for onEnterForge when the caller does not provide one.
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CardDetail — 2-tab idea card detail (Campaña · Documentos).
 *
 * Tabs:
 *   - Campaña (default): CampaignPipeline — the 6-phase La Campaña view. Each
 *     phase's ficha carries its own "Siguiente paso" command.
 *   - Documentos: a file-browser rail (Resumen · Producto · per-FRD) + a reader.
 *     "Resumen" shows the card body; a project doc lazily loads its body.
 *
 * Both panels are always mounted; the inactive panel is visually hidden
 * via the clip technique (PANEL_HIDDEN_STYLE) so existing getByTestId /
 * getByRole test contracts remain stable regardless of the active tab.
 *
 * "use client" because: useState (tab/reader state) + useTransition (lazy load).
 */
export function CardDetail({
  slug,
  title,
  status,
  body,
  phase,
  deployTarget,
  docNodes,
  project,
  readDocAction,
  isRunning,
  onEnterForge,
}: CardDetailProps): React.JSX.Element {
  // Active tab — defaults to Campaña (AC-02-009.1). Persists across re-renders.
  const [activeTab, setActiveTab] = useState<TabKey>("campana");

  // Selected document in the Documentos rail — SUMMARY_KEY ("summary") or a doc relPath.
  const [selectedDocKey, setSelectedDocKey] = useState<string>(SUMMARY_KEY);

  // Lazy-loaded body of the selected project doc (null until a doc is selected).
  const [docContent, setDocContent] = useState<string | null>(null);
  // Whether a doc body load is in flight.
  const [docLoading, startDocLoad] = useTransition();

  // Derive the active campaign phase index for CampaignPipeline.
  const activePhase = phaseFromStatus({ cardStatus: status, phase });

  // Build the grouped rail sections (empty when no scoped docs).
  const sections = buildDocSections(docNodes ?? []);

  // Forge handler: use provided callback or no-op.
  const handleEnterForge = onEnterForge ?? noop;

  /**
   * Select the always-present "Resumen" item: show the card body, keep on Documentos.
   */
  const handleSelectSummary = () => {
    setSelectedDocKey(SUMMARY_KEY);
    setDocContent(null);
    setActiveTab("docs");
  };

  /**
   * Select a project doc: switch to the Documentos tab and lazily load its body
   * via the injected read action (AC-02-009.3). Resets the previous content/loading
   * so a stale body never flashes when switching docs. When no read action is
   * present (older callers/tests), leave content null → the reader shows the
   * graceful workspace fallback instead of crashing.
   */
  const handleSelectDoc = (relPath: string) => {
    setSelectedDocKey(relPath);
    setActiveTab("docs");
    setDocContent(null);
    if (readDocAction == null || project == null) return;
    startDocLoad(async () => {
      const content = await readDocAction(project, relPath);
      setDocContent(content);
    });
  };

  /**
   * Tab selection from the shared Tabs primitive. The primitive emits a string
   * id; narrow it back to the TabKey union (the ids come from our own TABS list).
   */
  const handleTabChange = (id: string) => {
    const match = TABS.find((tab) => tab.id === id);
    if (match != null) setActiveTab(match.id);
  };

  /** Return the correct style for a panel — active (visible) or inactive (clipped). */
  const panelStyle = (key: TabKey): React.CSSProperties =>
    activeTab === key ? PANEL_STYLE : PANEL_HIDDEN_STYLE;

  const isSummary = selectedDocKey === SUMMARY_KEY;
  // A doc is selected but no read action is wired (or no project) → graceful fallback.
  const noReader = !isSummary && (readDocAction == null || project == null);

  return (
    <section data-testid="card-detail" style={ROOT_STYLE} aria-label={`Detalle de idea: ${title}`}>
      {/* Title (accessible name + visible heading) */}
      <h2 style={TITLE_STYLE}>{title}</h2>

      {/* Tab row (AC-02-009.1 / DR-062) — THE shared Tabs primitive (the ONE tab
          pattern, .stab level), not a bespoke per-screen switcher. testIdPrefix
          keeps this screen's stable `card-detail-tab-*` test ids. */}
      <Tabs
        level="sub"
        ariaLabel="Pestañas del detalle de idea"
        tabs={TABS}
        active={activeTab}
        onChange={handleTabChange}
        testIdPrefix={TAB_TEST_ID_PREFIX}
      />

      {/* ---- Campaña panel (default, AC-02-009.1 / AC-02-010.1) ---- */}
      <div
        data-testid="card-detail-panel-campana"
        role="tabpanel"
        aria-labelledby="card-detail-tab-campana"
        style={panelStyle("campana")}
      >
        <CampaignPipeline
          slug={slug}
          activePhase={activePhase}
          running={isRunning === true}
          deployTarget={deployTarget}
          onEnterForge={handleEnterForge}
        />
      </div>

      {/* ---- Documentos panel — rail (file-browser) + reader ---- */}
      <div
        data-testid="card-detail-panel-docs"
        role="tabpanel"
        aria-labelledby="card-detail-tab-docs"
        style={panelStyle("docs")}
      >
        <div className="card-detail-docs-grid">
          {/* Left rail — navigable, grouped (Resumen · Producto · per-FRD) */}
          <nav
            data-testid="card-detail-docs-nav"
            style={DOCS_SIDEBAR_STYLE}
            aria-label="Documentos del proyecto"
          >
            <p style={DOCS_NAV_HEADING_STYLE}>Documentos</p>
            <ul style={DOCS_NAV_LIST_STYLE}>
              <li>
                <button
                  type="button"
                  data-testid="card-detail-docs-nav-resumen"
                  data-active={isSummary}
                  aria-current={isSummary ? "true" : undefined}
                  style={docsNavItemStyle(isSummary)}
                  onClick={handleSelectSummary}
                >
                  <i className="ti ti-list" aria-hidden="true" style={DOCS_NAV_ICON_STYLE} />
                  Resumen
                </button>
              </li>
            </ul>

            {sections.map((section) => (
              <div key={section.heading}>
                <p style={DOCS_NAV_SECTION_STYLE} data-testid="card-detail-docs-nav-section">
                  {section.heading}
                </p>
                <ul style={DOCS_NAV_LIST_STYLE}>
                  {section.items.map((item) => {
                    const active = selectedDocKey === item.relPath;
                    return (
                      <li key={item.relPath}>
                        {/* Semantic <button> inside <li> — <li role="button"> is rejected by Biome. */}
                        <button
                          type="button"
                          data-testid="card-detail-docs-nav-item"
                          data-active={active}
                          aria-current={active ? "true" : undefined}
                          style={docsNavItemStyle(active)}
                          onClick={() => handleSelectDoc(item.relPath)}
                        >
                          <i
                            className="ti ti-file-text"
                            aria-hidden="true"
                            style={DOCS_NAV_ICON_STYLE}
                          />
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Reader — the selected document (Resumen body, or a project doc's body) */}
          <div style={DOCS_READER_STYLE}>
            {isSummary ? (
              /* Summary — markdown body (AC-02-004.1) via the shared <Markdown> renderer
                 (real h1/h2 hierarchy). The component's own title is the clipped <h2>. */
              <div data-testid="card-detail-summary" style={SUMMARY_STYLE}>
                <Markdown>{body}</Markdown>
              </div>
            ) : (
              <div data-testid="card-detail-doc-reader" style={SUMMARY_STYLE}>
                {noReader ? (
                  <p style={READER_STATE_STYLE}>
                    El contenido se abre en el workspace del proyecto.
                  </p>
                ) : docLoading ? (
                  <p style={READER_STATE_STYLE} aria-live="polite">
                    Cargando…
                  </p>
                ) : docContent != null ? (
                  <Markdown>{docContent}</Markdown>
                ) : (
                  <p style={READER_STATE_STYLE}>No se pudo leer este documento.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden metadata for data binding */}
      <span style={{ display: "none" }} aria-hidden="true" data-slug={slug} />
    </section>
  );
}
