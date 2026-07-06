"use client";
/**
 * app/manual/DocNav.tsx — WO-08-002 (CMP-08-doc-nav)
 *
 * The side menu for the Manual. Groups pages by the Diátaxis quadrants plus the
 * Workflows and Reference groups:
 *   - Empezar aquí (tutorial)
 *   - Guías (guides)
 *   - Conceptos (concepts)
 *   - Workflows (workflows — Dynamic Workflows: the deterministic JS engines)
 *   - Referencia (reference, derived from IF-07-reference/registry/standards)
 *
 * Visual design matches prototype `manualView()` nav:
 *   - Group headers: 10px pixel font, var(--color-accent-text), uppercase, letter-spacing .08em
 *   - Nav items: `.navitem` RPG skin — icon + label; active = accentBg fill + 1px inset accent ring
 *   - Wrapped in Panel with padding:11px (position:sticky is on the parent wrapper in ManualShell)
 *
 * Client Component: owns active-item highlight; calls onSelect() on user
 * interaction. Parent (ManualShell) manages the active-page state.
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
import type { AgentRef, SkillRef } from "@/lib/reference/reference";
import type { DecisionRule } from "@/lib/registry/registry";
import type { Standard } from "@/lib/standards/standards";
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
// Matches prototype MANUALNAV structure and icons for each group.
// ---------------------------------------------------------------------------

const DIATAXIS_GROUPS: ReadonlyArray<{
  key: "tutorial" | "guides" | "concepts" | "workflows";
  label: string;
  defaultIcon: string;
}> = [
  { key: "tutorial", label: "Empezar aquí", defaultIcon: "ti-player-play" },
  { key: "guides", label: "Guías", defaultIcon: "ti-map-2" },
  { key: "concepts", label: "Conceptos", defaultIcon: "ti-brain" },
  { key: "workflows", label: "Workflows", defaultIcon: "ti-route" },
] as const;

/** The four sub-catalog entries in the Reference group (AC-08-002.2). */
const REFERENCE_CATALOGS: ReadonlyArray<{
  key: "commands" | "agents" | "rules" | "standards";
  label: string;
  icon: string;
}> = [
  { key: "commands", label: "Comandos", icon: "ti-wand" },
  { key: "agents", label: "Agentes", icon: "ti-users-group" },
  { key: "rules", label: "Reglas de decisión", icon: "ti-gavel" },
  { key: "standards", label: "Estándares", icon: "ti-book" },
] as const;

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only (FRD-13 / AC-08-002.4)
// Mirrors prototype `.navitem` / `.navitem.on` skin and group headers.
// ---------------------------------------------------------------------------

/**
 * Nav container: Panel-style background (var(--color-card)) with padding 11px.
 * Position sticky is on the parent wrapper (doc-nav-sticky) in ManualShell.
 * borderRight removed — the Panel background creates the visual separation.
 */
const NAV_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  padding: "11px",
  background: "var(--color-card)",
  borderRight: "1px solid var(--color-border-strong)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 2px 0 0 var(--color-base)",
  minHeight: "100%",
};

const GROUP_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1px",
};

/**
 * Group heading: 10px pixel font, accent-text color, uppercase, letter-spacing .08em.
 * Matches prototype: `class="px"` with `font-size:10px;color:var(--accent-text)`.
 * First group: margin-top:2px; subsequent groups: margin-top:15px.
 */
function groupHeadingStyle(isFirst: boolean): React.CSSProperties {
  return {
    fontSize: "10px",
    fontFamily: "var(--font-pixel)",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--color-accent-text)",
    margin: `${isFirst ? "2px" : "15px"} 6px 7px`,
    padding: 0,
    lineHeight: 1,
  };
}

/**
 * Nav item (`.navitem` in prototype): flexible row, 14px icon + label.
 * Active (`.navitem.on`): accentBg fill + 1px inset accent ring.
 * Inactive: transparent background, muted text.
 */
function itemStyle(isActive: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    width: "100%",
    textAlign: "left",
    padding: "6px 8px",
    borderRadius: "var(--radius-sm, 8px)",
    border: "none",
    background: isActive ? "var(--color-accent-bg)" : "transparent",
    boxShadow: isActive ? "inset 0 0 0 1px var(--color-accent)" : "none",
    color: isActive ? "var(--color-accent-text)" : "var(--color-text2, var(--color-text))",
    fontSize: "13px",
    fontWeight: isActive ? 600 : 400,
    cursor: "pointer",
    transition: "background 150ms ease, box-shadow 150ms ease",
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
  // Group authored pages by their Diátaxis group key, sorted by order.
  const pagesByGroup = new Map<string, ManualPageRef[]>();
  for (const page of pages) {
    const existing = pagesByGroup.get(page.group) ?? [];
    existing.push(page);
    pagesByGroup.set(page.group, existing);
  }
  // Sort each group's pages by order field
  for (const [key, grpPages] of pagesByGroup) {
    pagesByGroup.set(
      key,
      [...grpPages].sort((a, b) => a.order - b.order),
    );
  }

  return (
    <nav data-testid="doc-nav" aria-label="Menú del Manual" style={NAV_STYLE}>
      {/* Authored Diátaxis groups: Empezar aquí, Guías, Conceptos */}
      {DIATAXIS_GROUPS.map(({ key, label, defaultIcon }, groupIndex) => {
        const groupPages = pagesByGroup.get(key) ?? [];
        return (
          <div key={key} data-testid={`doc-nav-group-${key}`} style={GROUP_STYLE}>
            <h3 style={groupHeadingStyle(groupIndex === 0)}>{label}</h3>
            {groupPages.length === 0 && (
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--color-text2, var(--color-text))",
                  opacity: 0.5,
                  padding: "5px 8px",
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
                  <i
                    className={`ti ${defaultIcon}`}
                    style={{ fontSize: "14px" }}
                    aria-hidden="true"
                  />
                  {page.title}
                </button>
              );
            })}
          </div>
        );
      })}

      {/* Reference group — always shown, derived from canonical sources (AC-08-002.2) */}
      <div data-testid="doc-nav-group-reference" style={GROUP_STYLE}>
        <h3 style={groupHeadingStyle(false)}>Referencia</h3>
        {REFERENCE_CATALOGS.map(({ key, label, icon }) => {
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
              <i className={`ti ${icon}`} style={{ fontSize: "14px" }} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
