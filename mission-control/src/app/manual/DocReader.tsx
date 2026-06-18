"use client";
/**
 * app/manual/DocReader.tsx — WO-08-002 (CMP-08-doc-reader)
 *
 * The reading area for the Manual. Renders:
 *   - An authored page (Tutorial / Guides / Concepts) via react-markdown.
 *   - A Reference catalog view (commands / agents / rules / standards),
 *     derived from the canonical source readers (DR-046 — no hand-copied lists).
 *   - An empty state when nothing is selected.
 *
 * Client Component: receives pre-resolved data as props from the Server
 * Component (page.tsx) so no filesystem access happens here.
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - Spanish aria-labels.
 *   - data-testid on the root and on each catalog view.
 *
 * Traceability:
 *   CMP-08-doc-reader → AC-08-002.1, AC-08-002.3
 *   CMP-08-reference-* → AC-08-002.2 (Reference derived, not hand-copied)
 */

import type React from "react";
import ReactMarkdown from "react-markdown";
import type { AgentRef, SkillRef } from "@/lib/reference/reference";
import type { DecisionRule } from "@/lib/registry/registry";
import type { Standard } from "@/lib/standards/standards";
import { ReferenceAgentsSection } from "./ReferenceAgentsSection";
import { ReferenceCommandsSection } from "./ReferenceCommandsSection/ReferenceCommandsSection";
import { ReferenceRulesView } from "./ReferenceRulesView";
import { ReferenceStandardsView } from "./ReferenceStandardsView";
import type { ReaderActivePage } from "./types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DocReaderProps {
  /**
   * The currently active page to render.
   * - null → empty state
   * - { type: "authored", page } → render page.body via react-markdown
   * - { type: "reference", catalog } → render the corresponding catalog view
   */
  activePage: ReaderActivePage | null;
  /** Skills catalog (from readSkills()) — for the commands reference view. */
  skills: SkillRef[];
  /** Agents catalog (from readAgents()) — for the agents reference view. */
  agents: AgentRef[];
  /** Decision rules (from readDecisionRules()) — for the rules reference view. */
  rules: DecisionRule[];
  /** Standards (from readStandards()) — for the standards reference view. */
  standards: Standard[];
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only (FRD-13)
// ---------------------------------------------------------------------------

const READER_STYLE: React.CSSProperties = {
  flex: 1,
  height: "100%",
  overflowY: "auto",
  padding: "calc(var(--space-base, 1rem) * 2) calc(var(--space-base, 1rem) * 3)",
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
};

const EMPTY_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "var(--color-text, currentColor)",
  opacity: 0.45,
  fontSize: "0.9375rem",
  gap: "calc(var(--space-base, 1rem) * 0.5)",
};

const PAGE_TITLE_STYLE: React.CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 700,
  marginBottom: "calc(var(--space-base, 1rem) * 1.5)",
  color: "var(--color-text, currentColor)",
};

// ---------------------------------------------------------------------------
// Reference catalog views — all four delegated to dedicated components (WO-08-003/004)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Prose wrapper for react-markdown output
// ---------------------------------------------------------------------------

const PROSE_STYLE: React.CSSProperties = {
  color: "var(--color-text, currentColor)",
  lineHeight: 1.7,
  fontSize: "0.9375rem",
};

// ---------------------------------------------------------------------------
// DocReader
// ---------------------------------------------------------------------------

export function DocReader({
  activePage,
  skills,
  agents,
  rules,
  standards,
}: DocReaderProps): React.JSX.Element {
  return (
    <main data-testid="doc-reader" aria-label="Área de lectura del Manual" style={READER_STYLE}>
      {activePage === null ? (
        /* Empty state — AC-08-002.1 */
        <div data-testid="doc-reader-empty" style={EMPTY_STYLE}>
          <span aria-hidden="true" style={{ fontSize: "2rem" }}>
            📖
          </span>
          <span>Selecciona una página del menú para leerla</span>
        </div>
      ) : activePage.type === "authored" ? (
        /* Authored page — AC-08-002.3: render via react-markdown */
        <article data-testid="doc-reader-authored">
          <h1 style={PAGE_TITLE_STYLE}>{activePage.page.title}</h1>
          <div style={PROSE_STYLE}>
            <ReactMarkdown>{activePage.page.body}</ReactMarkdown>
          </div>
        </article>
      ) : (
        /* Reference catalog view — AC-08-002.3: render derived catalog */
        <article data-testid="doc-reader-reference">
          {activePage.catalog === "commands" && <ReferenceCommandsSection skills={skills} />}
          {activePage.catalog === "agents" && <ReferenceAgentsSection agents={agents} />}
          {activePage.catalog === "rules" && <ReferenceRulesView rules={rules} />}
          {activePage.catalog === "standards" && <ReferenceStandardsView standards={standards} />}
        </article>
      )}
    </main>
  );
}
