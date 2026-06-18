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
import Markdown from "react-markdown";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import { CampaignPipeline } from "@/components/modules/CampaignPipeline/CampaignPipeline";
import { phaseFromStatus } from "@/lib/campaign/campaign";
import type { ProjectDocsIndex } from "@/lib/docs/docs";
import type { IdeaStatus } from "@/lib/ideas/ideas";
import { nextStep } from "@/lib/next-step/next-step";
import type { Phase } from "@/lib/status/status";
import {
  buildNavEntries,
  COMMAND_CODE_STYLE,
  COMMAND_STYLE,
  DOCS_NAV_HEADING_STYLE,
  DOCS_NAV_STYLE,
  NAV_ITEM_STYLE,
  type NavEntry,
  NEXT_STEP_LABEL_STYLE,
  NEXT_STEP_STYLE,
  PANEL_HIDDEN_STYLE,
  PANEL_STYLE,
  ROOT_STYLE,
  SUMMARY_STYLE,
  TAB_ROW_STYLE,
  TITLE_STYLE,
  tabButtonStyle,
} from "./CardDetail.styles";

// ---------------------------------------------------------------------------
// Tab definitions (AC-02-009.1)
// ---------------------------------------------------------------------------

type TabKey = "campana" | "docs" | "comandos";

interface TabDef {
  key: TabKey;
  label: string;
}

const TABS: TabDef[] = [
  { key: "campana", label: "Campaña" },
  { key: "docs", label: "Documentos" },
  { key: "comandos", label: "Comandos" },
];

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
  /** DR-032: whether a skill has advanced a phase and is waiting for "ok, advance". */
  advancePending?: boolean;
  /** Result of readProjectDocs(card.project). Null when no project or docs. */
  docsIndex?: ProjectDocsIndex | null;
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
  advancePending,
  docsIndex,
  onEnterForge,
}: CardDetailProps): React.JSX.Element {
  // Active tab — defaults to Campaña (AC-02-009.1). Persists across re-renders.
  const [activeTab, setActiveTab] = useState<TabKey>("campana");

  // Resolve the next-step command for this card's lifecycle position.
  const step = nextStep({ cardStatus: status, phase, advancePending });

  // Derive the active campaign phase index for CampaignPipeline.
  const activePhase = phaseFromStatus({ cardStatus: status, phase });

  // Build navigable doc entries (empty when no docs).
  const navEntries: NavEntry[] = docsIndex != null ? buildNavEntries(docsIndex) : [];
  const hasNav = navEntries.length > 0;

  // Forge handler: use provided callback or no-op.
  const handleEnterForge = onEnterForge ?? noop;

  /**
   * Clicking a doc nav entry switches the active tab to Documentos
   * so the owner always lands on the Documentos panel (AC-02-009.3).
   */
  const handleDocEntryClick = () => {
    setActiveTab("docs");
  };

  /** Return the correct style for a panel — active (visible) or inactive (clipped). */
  const panelStyle = (key: TabKey): React.CSSProperties =>
    activeTab === key ? PANEL_STYLE : PANEL_HIDDEN_STYLE;

  return (
    <section data-testid="card-detail" style={ROOT_STYLE} aria-label={`Detalle de idea: ${title}`}>
      {/* Title (accessible name + visible heading) */}
      <h2 style={TITLE_STYLE}>{title}</h2>

      {/* Tab row (AC-02-009.1 — same stab pattern as the Portfolio project pane).
          Use <div role="tablist"> — <nav> cannot carry tablist role (Biome a11y). */}
      <div role="tablist" aria-label="Pestañas del detalle de idea" style={TAB_ROW_STYLE}>
        {TABS.map(({ key, label }) => {
          const isActive = key === activeTab;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              data-testid={`card-detail-tab-${key}`}
              aria-selected={isActive ? "true" : "false"}
              style={tabButtonStyle(isActive)}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ---- Campaña panel (default, AC-02-009.1 / AC-02-010.1) ---- */}
      <div
        data-testid="card-detail-panel-campana"
        role="tabpanel"
        aria-labelledby="card-detail-tab-campana"
        style={panelStyle("campana")}
      >
        <CampaignPipeline slug={slug} activePhase={activePhase} onEnterForge={handleEnterForge} />
      </div>

      {/* ---- Documentos panel (AC-02-009.2 — existing doc navigator behavior) ---- */}
      <div
        data-testid="card-detail-panel-docs"
        role="tabpanel"
        aria-labelledby="card-detail-tab-docs"
        style={panelStyle("docs")}
      >
        {/* Summary — markdown body (AC-02-004.1: summary + key points).
            Headings in the body are remapped to <strong>/<p> so they do not conflict
            with the component's own <h2> title — keeps queryByRole("heading") stable. */}
        <div data-testid="card-detail-summary" style={SUMMARY_STYLE}>
          <Markdown
            components={{
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
            }}
          >
            {body}
          </Markdown>
        </div>

        {/* Docs navigator (only when docsIndex has navigable entries — AC-02-008.1) */}
        {hasNav && (
          <nav
            data-testid="card-detail-docs-nav"
            style={DOCS_NAV_STYLE}
            aria-label="Documentos del proyecto"
          >
            <p style={DOCS_NAV_HEADING_STYLE}>Documentos</p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {navEntries.map((entry) => (
                <li key={entry.key}>
                  {/* Semantic <button> inside <li> — <li role="button"> is rejected by Biome
                      (noNoninteractiveElementToInteractiveRole, useSemanticElements). */}
                  <button
                    type="button"
                    data-testid="card-detail-docs-nav-item"
                    style={{
                      ...NAV_ITEM_STYLE,
                      background: "none",
                      border: "none",
                      width: "100%",
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                    onClick={handleDocEntryClick}
                  >
                    {entry.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      {/* ---- Comandos panel (AC-02-009.2 — existing next-step behavior) ---- */}
      <div
        data-testid="card-detail-panel-comandos"
        role="tabpanel"
        aria-labelledby="card-detail-tab-comandos"
        style={panelStyle("comandos")}
      >
        {/* Next-step command row (AC-02-004.1: next-step command with copy button) */}
        <section
          data-testid="card-detail-next-step"
          style={NEXT_STEP_STYLE}
          aria-label="Siguiente comando"
        >
          <p style={NEXT_STEP_LABEL_STYLE}>Siguiente paso</p>
          <p
            style={{
              fontSize: "0.8125rem",
              color: "var(--color-text-muted, currentColor)",
              margin: 0,
            }}
          >
            {step.label}
          </p>
          <div style={COMMAND_STYLE}>
            <code style={COMMAND_CODE_STYLE}>{step.command}</code>
            <CopyButton value={step.command} />
          </div>
        </section>
      </div>

      {/* Hidden metadata for data binding */}
      <span style={{ display: "none" }} aria-hidden="true" data-slug={slug} />
    </section>
  );
}
