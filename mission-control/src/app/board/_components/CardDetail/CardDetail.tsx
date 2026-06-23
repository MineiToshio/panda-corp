"use client";

/**
 * WO-02-007 (reopened) — CardDetail component (CMP-02-card-detail)
 *
 * Traceability:
 *   CMP-02-card-detail → REQ-02-004, REQ-02-008, REQ-02-009, REQ-02-010
 *   AC-02-004.1  WHEN the owner clicks a card, the system SHALL show:
 *                summary, key points, docs navigator, next-step command (copy).
 *   AC-02-008.1  Idea with no documents → show only the summary, no navigator, no crash.
 *   AC-02-009.1  Three horizontal tabs (Campaña · Documentos · Comandos); default = Campaña.
 *   AC-02-009.2  Clicking a tab activates it and shows its body.
 *   AC-02-009.3  Clicking a document entry switches the active tab to Documentos.
 *   AC-02-009.4  Active tab persists across re-renders of the card detail.
 *
 * Style constants and nav-entry helpers live in CardDetail.styles.ts (sibling).
 *
 * Design rules (AGENTS.md):
 *   - Zero hardcoded color values — all via CSS custom properties.
 *   - data-testid on every significant element (test-writer contract).
 *   - Spanish aria-labels (single operator, Spanish UI).
 *   - Read-only: no writes, no fs calls, no network calls.
 *   - "use client" required: uses useState (tab state) + CopyButton (clipboard API).
 *
 * Panel visibility strategy:
 *   Inactive panels use the classic "visually hidden but accessible" clip technique
 *   (PANEL_HIDDEN_STYLE) so that getByTestId and getByRole queries in sibling test
 *   files continue to find elements in all panels, not only the active one.
 */

import { useState } from "react";
import Markdown, { type Components } from "react-markdown";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Tabs } from "@/components/core/Tabs/Tabs";
import { CampaignPipeline } from "@/components/modules/CampaignPipeline/CampaignPipeline";
import { phaseFromStatus } from "@/lib/campaign/campaign";
import type { ProjectDocsIndex } from "@/lib/docs/docs";
import type { IdeaStatus } from "@/lib/ideas/ideas";
import { nextStep, workspaceCommands } from "@/lib/next-step/next-step";
import type { DeployTarget, Phase } from "@/lib/status/status";
import {
  buildNavEntries,
  COMMAND_WHEN_STYLE,
  DOCS_NAV_HEADING_STYLE,
  DOCS_READER_STYLE,
  DOCS_SIDEBAR_STYLE,
  docsNavItemStyle,
  type NavEntry,
  NEXT_STEP_LABEL_STYLE,
  NEXT_STEP_STYLE,
  PANEL_HIDDEN_STYLE,
  PANEL_STYLE,
  ROOT_STYLE,
  SUMMARY_STYLE,
  TITLE_STYLE,
} from "./CardDetail.styles";

// ---------------------------------------------------------------------------
// Tab definitions (AC-02-009.1)
// ---------------------------------------------------------------------------

type TabKey = "campana" | "docs" | "comandos";

interface TabDef {
  id: TabKey;
  label: string;
  icon?: string;
}

const TABS: TabDef[] = [
  { id: "campana", label: "Campaña", icon: "ti-map-2" },
  { id: "docs", label: "Documentos", icon: "ti-files" },
  { id: "comandos", label: "Comandos", icon: "ti-wand" },
];

/** Stable prefix so the shared Tabs primitive emits this screen's test ids. */
const TAB_TEST_ID_PREFIX = "card-detail-tab-";

/**
 * Markdown heading components remapped to <strong>/<p> so body headings don't
 * conflict with the component's own <h2> title (keeps queryByRole("heading") stable).
 */
const MARKDOWN_COMPONENTS = {
  h1: ({ children }) => (
    <p>
      <strong>{children}</strong>
    </p>
  ),
  h2: ({ children }) => (
    <p>
      <strong>{children}</strong>
    </p>
  ),
  h3: ({ children }) => (
    <p>
      <strong>{children}</strong>
    </p>
  ),
  h4: ({ children }) => (
    <p>
      <strong>{children}</strong>
    </p>
  ),
  h5: ({ children }) => (
    <p>
      <strong>{children}</strong>
    </p>
  ),
  h6: ({ children }) => (
    <p>
      <strong>{children}</strong>
    </p>
  ),
} satisfies Components;

const DOCS_NAV_LIST_STYLE: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const DOCS_NAV_ICON_STYLE: React.CSSProperties = { fontSize: "13px", flexShrink: 0 };

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
  /** Result of readProjectDocs(card.project). Null when no project or docs. */
  docsIndex?: ProjectDocsIndex | null;
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
 * CardDetail — 3-tab idea card detail (Campaña · Documentos · Comandos).
 *
 * Tabs:
 *   - Campaña (default): CampaignPipeline — the 6-phase La Campaña view.
 *   - Documentos: summary + key points (react-markdown) + docs navigator.
 *   - Comandos: next-step command + copy button.
 *
 * All three panels are always mounted; inactive panels are visually hidden
 * via the clip technique (PANEL_HIDDEN_STYLE) so that existing getByTestId /
 * getByRole test contracts remain stable regardless of the active tab.
 *
 * "use client" because: useState (tab state) + CopyButton (clipboard API).
 */
export function CardDetail({
  slug,
  title,
  status,
  body,
  phase,
  deployTarget,
  advancePending,
  docsIndex,
  isRunning,
  onEnterForge,
}: CardDetailProps): React.JSX.Element {
  // Active tab — defaults to Campaña (AC-02-009.1). Persists across re-renders.
  const [activeTab, setActiveTab] = useState<TabKey>("campana");

  // Selected document in the Documentos rail — "summary" (Resumen) or a doc key.
  const [selectedDocKey, setSelectedDocKey] = useState<string>("summary");

  // Resolve the next-step command for this card's lifecycle position.
  const step = nextStep({ cardStatus: status, phase, advancePending });

  // Project commands for the Comandos tab — the multi-command box shows for
  // construction/launched cards (prototype commandsBox); else just the next step.
  const projectCommands = phase != null ? workspaceCommands(phase) : [];
  const showProjectCommands = phase === "implementation" || phase === "release";

  // Derive the active campaign phase index for CampaignPipeline.
  const activePhase = phaseFromStatus({ cardStatus: status, phase });

  // Build navigable doc entries (empty when no docs).
  const navEntries: NavEntry[] = docsIndex != null ? buildNavEntries(docsIndex) : [];

  // Forge handler: use provided callback or no-op.
  const handleEnterForge = onEnterForge ?? noop;

  /**
   * Select a document in the Documentos rail and keep the active tab on Documentos
   * (AC-02-009.3). "summary" shows the Resumen; any other key shows that document.
   */
  const handleSelectDoc = (key: string) => {
    setSelectedDocKey(key);
    setActiveTab("docs");
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

      {/* ---- Documentos panel — rail (210px) + reader (prototype docsBody) ---- */}
      <div
        data-testid="card-detail-panel-docs"
        role="tabpanel"
        aria-labelledby="card-detail-tab-docs"
        style={panelStyle("docs")}
      >
        <div className="card-detail-docs-grid">
          {/* Left rail — the documents navigator (always lists Resumen first) */}
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
                  data-active={selectedDocKey === "summary"}
                  aria-current={selectedDocKey === "summary" ? "true" : undefined}
                  style={docsNavItemStyle(selectedDocKey === "summary")}
                  onClick={() => handleSelectDoc("summary")}
                >
                  <i className="ti ti-list" aria-hidden="true" style={DOCS_NAV_ICON_STYLE} />
                  Resumen
                </button>
              </li>
              {navEntries.map((entry) => (
                <li key={entry.key}>
                  {/* Semantic <button> inside <li> — <li role="button"> is rejected by Biome. */}
                  <button
                    type="button"
                    data-testid="card-detail-docs-nav-item"
                    data-active={selectedDocKey === entry.key}
                    aria-current={selectedDocKey === entry.key ? "true" : undefined}
                    style={docsNavItemStyle(selectedDocKey === entry.key)}
                    onClick={() => handleSelectDoc(entry.key)}
                  >
                    <i className="ti ti-file-text" aria-hidden="true" style={DOCS_NAV_ICON_STYLE} />
                    {entry.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Reader — the selected document (Resumen body, or a project doc) */}
          <div style={DOCS_READER_STYLE}>
            {selectedDocKey === "summary" ? (
              /* Summary — markdown body (AC-02-004.1). Headings remapped to <strong>/<p>
                 so they don't conflict with the component's own <h2> title. */
              <div data-testid="card-detail-summary" style={SUMMARY_STYLE}>
                <Markdown components={MARKDOWN_COMPONENTS}>{body}</Markdown>
              </div>
            ) : (
              <div data-testid="card-detail-doc-reader" style={SUMMARY_STYLE}>
                <p style={{ margin: "0 0 6px" }}>
                  <strong>
                    {navEntries.find((e) => e.key === selectedDocKey)?.label ?? selectedDocKey}
                  </strong>
                </p>
                <p style={{ margin: 0, color: "var(--color-text-muted, currentColor)" }}>
                  Este documento vive en el proyecto. Ábrelo en el workspace del proyecto
                  (Portfolio) para leerlo completo.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Comandos panel — next step · avanzar + (construction/launched) the project box ---- */}
      <div
        data-testid="card-detail-panel-comandos"
        role="tabpanel"
        aria-labelledby="card-detail-tab-comandos"
        style={panelStyle("comandos")}
      >
        {/* Next step · advance (AC-02-004.1) */}
        <section
          data-testid="card-detail-next-step"
          style={NEXT_STEP_STYLE}
          aria-label="Siguiente comando"
        >
          <p style={NEXT_STEP_LABEL_STYLE}>Siguiente paso · avanzar</p>
          <p style={COMMAND_WHEN_STYLE}>{step.label}</p>
          <CmdRow command={step.command} />
        </section>

        {/* Project command box — construction/launched cards (prototype commandsBox) */}
        {showProjectCommands && (
          <section
            data-testid="card-detail-project-commands"
            style={NEXT_STEP_STYLE}
            aria-label="Comandos del proyecto"
          >
            <p style={NEXT_STEP_LABEL_STYLE}>Comandos del proyecto</p>
            {projectCommands.map((row) => (
              <div
                key={row.command}
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <p style={COMMAND_WHEN_STYLE}>{row.when}</p>
                <CmdRow command={row.command} />
              </div>
            ))}
          </section>
        )}
      </div>

      {/* Hidden metadata for data binding */}
      <span style={{ display: "none" }} aria-hidden="true" data-slug={slug} />
    </section>
  );
}
