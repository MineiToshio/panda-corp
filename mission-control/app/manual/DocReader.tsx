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
import type { AgentRef, SkillRef } from "@/lib/reference";
import type { DecisionRule } from "@/lib/registry";
import type { Standard } from "@/lib/standards";
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

const SECTION_HEADING_STYLE: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  marginBottom: "var(--space-base, 1rem)",
  color: "var(--color-text, currentColor)",
  borderBottom:
    "var(--hairline, 1px) solid color-mix(in oklch, var(--color-text, currentColor) 15%, transparent)",
  paddingBottom: "calc(var(--space-base, 1rem) * 0.5)",
};

const LIST_STYLE: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.75)",
};

const ITEM_STYLE: React.CSSProperties = {
  padding: "calc(var(--space-base, 1rem) * 0.75) var(--space-base, 1rem)",
  borderRadius: "var(--radius, 0.5rem)",
  background: "color-mix(in oklch, var(--color-text, currentColor) 5%, transparent)",
  border:
    "var(--hairline, 1px) solid color-mix(in oklch, var(--color-text, currentColor) 10%, transparent)",
};

const ITEM_NAME_STYLE: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "0.9375rem",
  color: "var(--color-accent, currentColor)",
  marginBottom: "calc(var(--space-base, 1rem) * 0.25)",
};

const ITEM_DESC_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text, currentColor)",
  opacity: 0.8,
  margin: 0,
};

const BADGE_STYLE: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.75rem",
  fontWeight: 600,
  padding: "0.125rem 0.375rem",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  background: "color-mix(in oklch, var(--color-accent, currentColor) 20%, transparent)",
  color: "var(--color-accent, currentColor)",
  marginLeft: "0.5rem",
};

// ---------------------------------------------------------------------------
// Reference catalog views (CMP-08-reference-* — DR-046: derived, not copied)
// ---------------------------------------------------------------------------

function CommandsView({ skills }: { skills: SkillRef[] }): React.JSX.Element {
  return (
    <div data-testid="reference-commands-view">
      <h2 style={SECTION_HEADING_STYLE}>Comandos (Habilidades)</h2>
      {skills.length === 0 ? (
        <p style={ITEM_DESC_STYLE}>No se encontraron habilidades en el plugin.</p>
      ) : (
        <ul style={LIST_STYLE} aria-label="Lista de comandos del plugin">
          {skills.map((skill) => (
            <li key={skill.slug} style={ITEM_STYLE} data-testid={`reference-command-${skill.slug}`}>
              <div style={ITEM_NAME_STYLE}>
                /pandacorp:{skill.slug}
                {skill.runsIn !== "unknown" && <span style={BADGE_STYLE}>{skill.runsIn}</span>}
              </div>
              <p style={ITEM_DESC_STYLE}>{skill.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AgentsView({ agents }: { agents: AgentRef[] }): React.JSX.Element {
  return (
    <div data-testid="reference-agents-view">
      <h2 style={SECTION_HEADING_STYLE}>Agentes (Party)</h2>
      {agents.length === 0 ? (
        <p style={ITEM_DESC_STYLE}>No se encontraron agentes en el plugin.</p>
      ) : (
        <ul style={LIST_STYLE} aria-label="Lista de agentes del plugin">
          {agents.map((agent) => (
            <li key={agent.id} style={ITEM_STYLE} data-testid={`reference-agent-${agent.id}`}>
              <div style={ITEM_NAME_STYLE}>
                {agent.name ?? agent.id}
                {agent.model !== "unknown" && <span style={BADGE_STYLE}>{agent.model}</span>}
              </div>
              {agent.description && <p style={ITEM_DESC_STYLE}>{agent.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RulesView({ rules }: { rules: DecisionRule[] }): React.JSX.Element {
  return (
    <div data-testid="reference-rules-view">
      <h2 style={SECTION_HEADING_STYLE}>Reglas de decisión</h2>
      {rules.length === 0 ? (
        <p style={ITEM_DESC_STYLE}>No se encontraron reglas en el registro.</p>
      ) : (
        <ul style={LIST_STYLE} aria-label="Lista de reglas de decisión">
          {rules.map((rule) => (
            <li key={rule.id} style={ITEM_STYLE} data-testid={`reference-rule-${rule.id}`}>
              <div style={ITEM_NAME_STYLE}>
                {rule.id}
                {rule.requiereHumano && <span style={BADGE_STYLE}>humano</span>}
              </div>
              <p style={ITEM_DESC_STYLE}>
                <strong>Patrón:</strong> {rule.patron}
              </p>
              <p style={ITEM_DESC_STYLE}>
                <strong>Por defecto:</strong> {rule.default}
              </p>
              {rule.nota && (
                <p style={{ ...ITEM_DESC_STYLE, opacity: 0.6, fontStyle: "italic" }}>{rule.nota}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StandardsView({ standards }: { standards: Standard[] }): React.JSX.Element {
  return (
    <div data-testid="reference-standards-view">
      <h2 style={SECTION_HEADING_STYLE}>Estándares</h2>
      {standards.length === 0 ? (
        <p style={ITEM_DESC_STYLE}>No se encontraron estándares.</p>
      ) : (
        <ul style={LIST_STYLE} aria-label="Lista de estándares de la fábrica">
          {standards.map((std) => (
            <li key={std.id} style={ITEM_STYLE} data-testid={`reference-standard-${std.id}`}>
              <div style={ITEM_NAME_STYLE}>
                {std.title}
                <span style={BADGE_STYLE}>{std.severity}</span>
                <span
                  style={{
                    ...BADGE_STYLE,
                    background:
                      "color-mix(in oklch, var(--color-text, currentColor) 10%, transparent)",
                    color: "var(--color-text, currentColor)",
                  }}
                >
                  {std.domain}
                </span>
              </div>
              {std.summary.length > 0 && <p style={ITEM_DESC_STYLE}>{std.summary[0]}</p>}
            </li>
          ))}
        </ul>
      )}
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
          {activePage.catalog === "commands" && <CommandsView skills={skills} />}
          {activePage.catalog === "agents" && <AgentsView agents={agents} />}
          {activePage.catalog === "rules" && <RulesView rules={rules} />}
          {activePage.catalog === "standards" && <StandardsView standards={standards} />}
        </article>
      )}
    </main>
  );
}
