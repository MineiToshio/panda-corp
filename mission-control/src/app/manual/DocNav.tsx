"use client";
/**
 * app/manual/DocNav.tsx — WO-08-002 (CMP-08-doc-nav)
 *
 * The side menu for the Manual. Groups pages by the four Diátaxis quadrants:
 *   - Empezar aquí (tutorial)
 *   - Guías (guides)
 *   - Referencia (reference, derived from IF-07-reference/registry/standards)
 *   - Conceptos (concepts)
 *
 * Client Component: owns active-item highlight; calls onSelect() on user
 * interaction. Parent (ManualShell or page.tsx) manages the active-page state.
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - Spanish aria-labels.
 *   - Keyboard-navigable (buttons with :focus-visible ring from globals.css).
 *   - data-testid on all interactive elements.
 *   - Rationed accent on the active page item via data-active.
 *
 * Traceability:
 *   CMP-08-doc-nav → AC-08-002.1, AC-08-002.2, AC-08-002.4
 */

import type React from "react";
import type { AgentRef, SkillRef } from "@/lib/reference";
import type { DecisionRule } from "@/lib/registry";
import type { Standard } from "@/lib/standards";
import type { ActivePage, ManualPageRef } from "./types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DocNavProps {
  /** Authored Tutorial / Guides / Concepts pages from readManualPages(). */
  pages: ManualPageRef[];
  /** Skills catalog from readSkills() — for Reference section. */
  skills: SkillRef[];
  /** Agents catalog from readAgents() — for Reference section. */
  agents: AgentRef[];
  /** Decision rules from readDecisionRules() — for Reference section. */
  rules: DecisionRule[];
  /** Standards from readStandards() — for Reference section. */
  standards: Standard[];
  /** Currently selected page. null = nothing selected. */
  activePage: ActivePage | null;
  /** Called when the user selects a page from the menu. */
  onSelect: (page: ActivePage) => void;
}

// ---------------------------------------------------------------------------
// Diátaxis quadrant config — fixed, always shown (AC-08-002.2)
// ---------------------------------------------------------------------------

const DIATAXIS_GROUPS: ReadonlyArray<{
  key: "tutorial" | "guides" | "concepts";
  label: string;
}> = [
  { key: "tutorial", label: "Empezar aquí" },
  { key: "guides", label: "Guías" },
  { key: "concepts", label: "Conceptos" },
] as const;

/** The four sub-catalog entries in the Reference group (AC-08-002.2). */
const REFERENCE_CATALOGS: ReadonlyArray<{
  key: "commands" | "agents" | "rules" | "standards";
  label: string;
}> = [
  { key: "commands", label: "Comandos" },
  { key: "agents", label: "Agentes" },
  { key: "rules", label: "Reglas de decisión" },
  { key: "standards", label: "Estándares" },
] as const;

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only (FRD-13 / AC-08-002.4)
// ---------------------------------------------------------------------------

const NAV_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 1.5)",
  padding: "var(--space-base, 1rem)",
  height: "100%",
  overflowY: "auto",
  borderRight:
    "var(--hairline, 1px) solid color-mix(in oklch, var(--color-text, currentColor) 15%, transparent)",
  background: "var(--color-surface, Canvas)",
};

const GROUP_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 0.25)",
};

const GROUP_HEADING_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text, currentColor)",
  opacity: 0.5,
  margin: 0,
  marginBottom: "calc(var(--space-base, 1rem) * 0.25)",
  padding: "0 calc(var(--space-base, 1rem) * 0.5)",
};

/** Base style for a nav item button. Active variant uses data-active to apply accent. */
const ITEM_BASE_STYLE: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "calc(var(--space-base, 1rem) * 0.375) calc(var(--space-base, 1rem) * 0.5)",
  borderRadius: "var(--radius, 0.5rem)",
  border: "none",
  background: "transparent",
  color: "var(--color-text, currentColor)",
  fontSize: "0.875rem",
  cursor: "pointer",
  transition: "background var(--duration-fast, 150ms) var(--easing-standard, ease)",
};

/** Active item: rationed accent background — only on the active page (AC-08-002.4). */
function itemStyle(isActive: boolean): React.CSSProperties {
  return {
    ...ITEM_BASE_STYLE,
    background: isActive
      ? "color-mix(in oklch, var(--color-accent, currentColor) 15%, transparent)"
      : "transparent",
    color: isActive ? "var(--color-accent, currentColor)" : "var(--color-text, currentColor)",
    fontWeight: isActive ? 600 : 400,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAuthoredActive(activePage: ActivePage | null, group: string, slug: string): boolean {
  return activePage?.type === "authored" && activePage.group === group && activePage.slug === slug;
}

function isReferenceActive(
  activePage: ActivePage | null,
  catalog: "commands" | "agents" | "rules" | "standards",
): boolean {
  return activePage?.type === "reference" && activePage.catalog === catalog;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocNav({ pages, activePage, onSelect }: DocNavProps): React.JSX.Element {
  // Group authored pages by their Diátaxis group key.
  const pagesByGroup = new Map<string, ManualPageRef[]>();
  for (const page of pages) {
    const existing = pagesByGroup.get(page.group) ?? [];
    existing.push(page);
    pagesByGroup.set(page.group, existing);
  }

  return (
    <nav data-testid="doc-nav" aria-label="Menú del Manual" style={NAV_STYLE}>
      {/* Authored Diátaxis groups: Empezar aquí, Guías, Conceptos */}
      {DIATAXIS_GROUPS.map(({ key, label }) => {
        const groupPages = pagesByGroup.get(key) ?? [];
        return (
          <div key={key} data-testid={`doc-nav-group-${key}`} style={GROUP_STYLE}>
            <h3 style={GROUP_HEADING_STYLE}>{label}</h3>
            {groupPages.length === 0 && (
              <span
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--color-text, currentColor)",
                  opacity: 0.4,
                  padding:
                    "calc(var(--space-base, 1rem) * 0.25) calc(var(--space-base, 1rem) * 0.5)",
                  fontStyle: "italic",
                }}
              >
                Sin páginas
              </span>
            )}
            {groupPages.map((page) => {
              const active = isAuthoredActive(activePage, page.group, page.slug);
              return (
                <button
                  key={page.slug}
                  type="button"
                  data-testid={`doc-nav-item-${page.group}-${page.slug}`}
                  data-active={active ? "true" : "false"}
                  aria-label={`Abrir página: ${page.title}`}
                  aria-current={active ? "page" : undefined}
                  style={itemStyle(active)}
                  onClick={() => onSelect({ type: "authored", group: page.group, slug: page.slug })}
                >
                  {page.title}
                </button>
              );
            })}
          </div>
        );
      })}

      {/* Reference group — always shown, derived from canonical sources (AC-08-002.2) */}
      <div data-testid="doc-nav-group-reference" style={GROUP_STYLE}>
        <h3 style={GROUP_HEADING_STYLE}>Referencia</h3>
        {REFERENCE_CATALOGS.map(({ key, label }) => {
          const active = isReferenceActive(activePage, key);
          return (
            <button
              key={key}
              type="button"
              data-testid={`doc-nav-item-reference-${key}`}
              data-active={active ? "true" : "false"}
              aria-label={`Abrir referencia: ${label}`}
              aria-current={active ? "page" : undefined}
              style={itemStyle(active)}
              onClick={() => onSelect({ type: "reference", catalog: key })}
            >
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
