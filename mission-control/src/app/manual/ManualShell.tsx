"use client";
/**
 * app/manual/ManualShell.tsx — WO-08-002 (CMP-08-manual-page, client shell)
 *
 * Client Component: owns the active-page state and wires DocNav + DocReader.
 *
 * The Server Component (page.tsx) reads all data on the server and passes it
 * down here as props. ManualShell manages the user's selection state and
 * resolves the ActivePage key into a ReaderActivePage for DocReader.
 *
 * Layout (matches prototype `manualView()` — 236px 1fr two-pane grid):
 *   PageTitle block (full width, flex-shrink:0)
 *   ──────────────────────────────────────────────
 *   │ DocNav (sticky, 236px) │ DocReader (1fr)    │
 *   ──────────────────────────────────────────────
 *
 * Design rules (FRD-13 / AGENTS.md / DR-062):
 *   - PageTitle is the ONE page H1 ("Documentación"), DR-062.
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - Spanish labels/aria-labels.
 *   - data-testid on the shell root and key structural elements.
 *   - NavColumn is sticky (position:sticky + top); reading area has min-width:0.
 *
 * Traceability:
 *   CMP-08-manual-page → AC-08-002.1, AC-08-002.2, AC-08-002.3, AC-08-002.4
 *   DR-062 → ONE PageTitle "Documentación"
 */

import type React from "react";
import { useCallback, useEffect, useMemo } from "react";
import { PageTitle } from "@/components/core/PageTitle/PageTitle";
import type { ManualPage } from "@/lib/manual/manual";
import { parseNavigationUrl } from "@/lib/navigation/urls";
import { updateNavigation, useUrlState } from "@/lib/navigation/useUrlState";
import type { AgentRef, SkillRef } from "@/lib/reference/reference";
import type { DecisionRule } from "@/lib/registry/registry";
import type { Standard } from "@/lib/standards/standards";
import { DocNav } from "./DocNav";
import { DocReader } from "./DocReader";
import { type ManualNav, ManualNavProvider } from "./ManualNavContext";
import type { ActivePage, ReaderActivePage } from "./types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ManualShellProps {
  /** Authored pages from readManualPages(). */
  pages: ManualPage[];
  /** Skills catalog from readSkills(). */
  skills: SkillRef[];
  /** Agents catalog from readAgents(). */
  agents: AgentRef[];
  /** Decision rules from readDecisionRules(). */
  rules: DecisionRule[];
  /** Standards from readStandards(). */
  standards: Standard[];
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only (FRD-13) — mirrors prototype manualView()
// ---------------------------------------------------------------------------

/** Outer shell: column flex — header (title) on top, two-pane body below. */
const SHELL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  overflow: "hidden",
  background: "var(--color-base)",
  color: "var(--color-text, currentColor)",
};

/** Header block: PageTitle with bottom border. */
// De-boxed header: the PageTitle sits at the container edge with its own marginBottom,
// matching the PageLayout pages (DR-062 coherence). No bordered/inset header bar.
const HEADER_STYLE: React.CSSProperties = {
  flexShrink: 0,
};

/**
 * Two-pane content area: 236px 1fr grid (prototype: `.rpghall` grid layout).
 * align-items:start lets the nav panel stop at its content height and be sticky.
 */
const BODY_STYLE: React.CSSProperties = {
  flex: 1,
  display: "grid",
  gridTemplateColumns: "236px 1fr",
  alignItems: "start",
  overflow: "hidden",
  minHeight: 0,
};

/**
 * Nav column: sticky inside the scrollable body so the side menu doesn't
 * scroll away. Overflow auto lets it scroll independently if content overflows.
 */
const NAV_COLUMN_STYLE: React.CSSProperties = {
  position: "sticky",
  top: 0,
  height: "100%",
  overflowY: "auto",
};

/**
 * Reader column: min-width:0 prevents the 1fr column from overflowing the grid
 * container when the content is wider than available space (CSS grid gotcha).
 */
const READER_COLUMN_STYLE: React.CSSProperties = {
  minWidth: 0,
  height: "100%",
  overflowY: "auto",
};

// ---------------------------------------------------------------------------
// Derive the default page (mirrors prototype MANUALNAV[0].items[0] fallback)
// ---------------------------------------------------------------------------

/**
 * Derive the initial active page from the pages list.
 *
 * Priority: tutorial → guides → concepts (matches DIATAXIS_GROUPS order
 * in DocNav and the prototype MANUALNAV[0].items[0].id fallback at ~L1362).
 *
 * Returns null only when no authored pages exist at all.
 */
function deriveDefaultPage(pages: ManualPage[]): Extract<ActivePage, { type: "authored" }> | null {
  const PRIORITY_ORDER = ["tutorial", "guides", "concepts", "workflows"] as const;
  for (const group of PRIORITY_ORDER) {
    const groupPages = pages.filter((p) => p.group === group).sort((a, b) => a.order - b.order);
    if (groupPages.length > 0) {
      const first = groupPages[0];
      if (!first) continue;
      return { type: "authored", group: first.group, slug: first.slug };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Resolve ActivePage → ReaderActivePage
// ---------------------------------------------------------------------------

/**
 * Resolve an ActivePage selection key into a fully-hydrated ReaderActivePage
 * by looking up the authored page body from the pages list.
 *
 * Returns null if the authored page slug is not found (edge case: stale state).
 */
function resolveActivePage(
  activePage: ActivePage | null,
  pages: ManualPage[],
): ReaderActivePage | null {
  if (activePage === null) return null;

  if (activePage.type === "reference") {
    return activePage; // ReferencePageSelection is already a ReaderReferencePage shape
  }

  // type === "authored": look up the full page by group + slug
  const found = pages.find((p) => p.group === activePage.group && p.slug === activePage.slug);
  if (!found) return null;

  return { type: "authored", page: found };
}

// ---------------------------------------------------------------------------
// ManualShell
// ---------------------------------------------------------------------------

function referenceCatalog(value: string): "commands" | "agents" | "rules" | "standards" | null {
  switch (value) {
    case "commands":
    case "agents":
    case "rules":
    case "standards":
      return value;
    default:
      return null;
  }
}

function manualSelection(group: string, slug: string, reference: string): ActivePage | null {
  if (reference) {
    const catalog = referenceCatalog(reference);
    return catalog ? { type: "reference", catalog } : null;
  }
  return group && slug ? { type: "authored", group, slug } : null;
}

function useCanonicalManualDefault(group: string, slug: string): void {
  useEffect(() => {
    const state = parseNavigationUrl(window.location.href);
    if (
      !state.manualGroup &&
      !state.reference &&
      group &&
      slug &&
      window.location.pathname === "/manual"
    ) {
      updateNavigation({ manualGroup: group, manualPage: slug }, { replace: true });
    }
  }, [group, slug]);
}

export function ManualShell({
  pages,
  skills,
  agents,
  rules,
  standards,
}: ManualShellProps): React.JSX.Element {
  const defaultPage = deriveDefaultPage(pages);
  const [group] = useUrlState("manualGroup", defaultPage?.group ?? "");
  const [slug] = useUrlState("manualPage", defaultPage?.slug ?? "");
  const [reference] = useUrlState("reference", "");
  const [referenceItem, setReferenceItem] = useUrlState("referenceItem", "");
  const catalog = referenceCatalog(reference);
  const activePage = manualSelection(group, slug, reference);
  const resolvedPage = resolveActivePage(activePage, pages);
  useCanonicalManualDefault(defaultPage?.group ?? "", defaultPage?.slug ?? "");

  const refSkill = catalog === "commands" ? referenceItem : null;
  const refAgent = catalog === "agents" ? referenceItem : null;

  const handleNavSelect = useCallback((page: ActivePage): void => {
    updateNavigation(
      page.type === "reference"
        ? { reference: page.catalog, referenceItem: null, manualGroup: null, manualPage: null }
        : { manualGroup: page.group, manualPage: page.slug, reference: null, referenceItem: null },
    );
  }, []);

  const nav = useMemo<ManualNav>(
    () => ({
      goToSkill: (skill: string): void =>
        updateNavigation({
          reference: "commands",
          referenceItem: skill,
          manualGroup: null,
          manualPage: null,
        }),
      goToAgent: (agent: string): void =>
        updateNavigation({
          reference: "agents",
          referenceItem: agent,
          manualGroup: null,
          manualPage: null,
        }),
      goToManual: (nextGroup: string, nextSlug: string): void =>
        updateNavigation({
          manualGroup: nextGroup,
          manualPage: nextSlug,
          reference: null,
          referenceItem: null,
        }),
    }),
    [],
  );

  return (
    <ManualNavProvider value={nav}>
      <div data-testid="manual-shell" style={SHELL_STYLE}>
        {/* Page header — DR-062: ONE PageTitle block, H1 "Documentación" */}
        <div style={HEADER_STYLE}>
          <PageTitle
            icon="ti-book"
            title="Documentación"
            subtitle="El códice del gremio — guías, referencia y conceptos."
          />
        </div>

        {/* Two-pane body: 236px nav | 1fr reader (prototype manualView()) */}
        <div style={BODY_STYLE}>
          {/* Side menu — sticky nav column (AC-08-002.2) */}
          <div data-testid="doc-nav-sticky" style={NAV_COLUMN_STYLE}>
            <DocNav
              pages={pages}
              skills={skills}
              agents={agents}
              rules={rules}
              standards={standards}
              activePage={activePage}
              onSelect={handleNavSelect}
            />
          </div>

          {/* Reading area — min-width:0 prevents grid overflow (AC-08-002.1, AC-08-002.3) */}
          <div data-testid="manual-reader-area" style={READER_COLUMN_STYLE}>
            {((activePage && !resolvedPage) || (reference && !catalog)) && (
              <p role="status">La página solicitada no está disponible.</p>
            )}
            <DocReader
              activePage={resolvedPage}
              skills={skills}
              agents={agents}
              rules={rules}
              standards={standards}
              selectedSkillSlug={refSkill}
              selectedAgentId={refAgent}
              onClearSkill={() => setReferenceItem("")}
              onClearAgent={() => setReferenceItem("")}
            />
          </div>
        </div>
      </div>
    </ManualNavProvider>
  );
}
