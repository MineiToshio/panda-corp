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
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { DecisionRulesSection } from "@/app/configuration/_rules/DecisionRulesSection/DecisionRulesSection";
import { AgentDetail } from "@/app/configuration/AgentDetail";
import { AgentList } from "@/app/configuration/AgentList";
import { SkillsSection } from "@/app/configuration/SkillsSection";
import { StandardsSection } from "@/app/configuration/StandardsSection/StandardsSection";
import { DocH } from "@/components/modules/manual-diagrams/DocH";
import type { AgentLevelResult } from "@/lib/gamification/agents";
import type { ManualPage } from "@/lib/manual/manual";
import type { AgentRef, SkillRef } from "@/lib/reference/reference";
import type { DecisionRule } from "@/lib/registry/registry";
import type { Standard } from "@/lib/standards/standards";
import { getManualPageComponent } from "./manualPages";
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

// ---------------------------------------------------------------------------
// Reference catalog views — REUSE the FRD-07 card primitives VERBATIM (DR-046 /
// DR-057): the Manual Referencia and Configuración stay visually + behaviorally
// consistent because they render the SAME SkillsSection / AgentList /
// DecisionRulesSection / StandardsSection — never a forked catalog.
// ---------------------------------------------------------------------------

/** Zero-state level for the agents catalog (the Manual has no computed XP). */
const ZERO_AGENT_LEVEL: AgentLevelResult = {
  level: 1,
  title: "Apprentice",
  xp: 0,
  next: 5,
  pctToNext: 0,
};

/**
 * Agents reference catalog — reuses the shared AgentList + AgentDetail (FRD-07).
 * Manages its own selection state since the Manual has no parent shell for it.
 */
function ReferenceAgentsCatalog({ agents }: { agents: AgentRef[] }): React.JSX.Element {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const levels: Record<string, AgentLevelResult> = {};
  const selectedAgent = selectedAgentId
    ? (agents.find((a) => a.id === selectedAgentId) ?? null)
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "calc(var(--space-base) * 1.5)" }}>
      <AgentList
        agents={agents}
        levels={levels}
        selectedAgentId={selectedAgentId}
        onSelectAgent={setSelectedAgentId}
      />
      {selectedAgent !== null ? (
        <AgentDetail agent={selectedAgent} level={ZERO_AGENT_LEVEL} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prose wrapper for react-markdown output
// ---------------------------------------------------------------------------

const PROSE_STYLE: React.CSSProperties = {
  color: "var(--color-text, currentColor)",
  lineHeight: 1.7,
  fontSize: "0.9375rem",
};

/**
 * Render an authored page body.
 *
 * Faithful path: a bespoke React page registered for the slug (composed UI that
 * mirrors the prototype — DocH + Panel cards + CmdRow + chips + concept diagrams).
 * Fallback path: the markdown reader (a DocH-styled title + react-markdown body),
 * so authored pages without a bespoke layout still render and their body still
 * reaches the reader.
 */
function AuthoredBody({ page }: { page: ManualPage }): React.JSX.Element {
  const Bespoke = getManualPageComponent(page.slug);
  if (Bespoke !== null) {
    return <Bespoke />;
  }
  return (
    <>
      <DocH title={page.title} level={1} />
      <div style={PROSE_STYLE}>
        <ReactMarkdown>{page.body}</ReactMarkdown>
      </div>
    </>
  );
}

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
        /* Authored page — AC-08-002.3.
           Faithful path: if the slug has a bespoke React page in the registry
           (the prototype-faithful composed layout: DocH + Panel cards + CmdRow +
           chips + concept diagrams), render it. Otherwise fall back to the
           markdown reader (authored pages without a bespoke layout still render). */
        <article data-testid="doc-reader-authored">
          <AuthoredBody page={activePage.page} />
        </article>
      ) : (
        /* Reference catalog view — AC-08-002.3: render derived catalog by REUSING
           the FRD-07 card primitives verbatim (DR-046 / DR-057), never a fork. */
        <article data-testid="doc-reader-reference">
          {activePage.catalog === "commands" && <SkillsSection skills={skills} />}
          {activePage.catalog === "agents" && <ReferenceAgentsCatalog agents={agents} />}
          {activePage.catalog === "rules" && <DecisionRulesSection rules={rules} />}
          {activePage.catalog === "standards" && <StandardsSection standards={standards} />}
        </article>
      )}
    </main>
  );
}
