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
import { useState } from "react";
import { PageTitle } from "@/components/core/PageTitle/PageTitle";
import type { ManualPage } from "@/lib/manual/manual";
import type { AgentRef, SkillRef } from "@/lib/reference/reference";
import type { DecisionRule } from "@/lib/registry/registry";
import type { Standard } from "@/lib/standards/standards";
import { DocNav } from "./DocNav";
import { DocReader } from "./DocReader";
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
const HEADER_STYLE: React.CSSProperties = {
  flexShrink: 0,
  padding: "14px 20px 10px",
  borderBottom: "1px solid var(--color-border-strong)",
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

/**
 * Derive the default (first) page to show on load.
 *
 * Matches prototype `manualView()` line ~1362:
 *   `var p = ST.manualPage || MANUALNAV[0].items[0].id`
 * which falls back to the first nav item — the first authored tutorial page.
 *
 * Priority order matches DIATAXIS_GROUPS in DocNav: tutorial → guides → concepts.
 * Returns null only when there are zero authored pages (empty content tree).
 */
function deriveDefaultPage(pages: ManualPage[]): ActivePage | null {
  const priority = ["tutorial", "guides", "concepts"] as const;
  for (const group of priority) {
    const inGroup = pages.filter((p) => p.group === group).sort((a, b) => a.order - b.order);
    const first = inGroup[0];
    if (first) {
      return { type: "authored", group: first.group, slug: first.slug };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// ManualShell
// ---------------------------------------------------------------------------

export function ManualShell({
  pages,
  skills,
  agents,
  rules,
  standards,
}: ManualShellProps): React.JSX.Element {
  const [activePage, setActivePage] = useState<ActivePage | null>(() => deriveDefaultPage(pages));

  const resolvedPage = resolveActivePage(activePage, pages);

  return (
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
            onSelect={setActivePage}
          />
        </div>

        {/* Reading area — min-width:0 prevents grid overflow (AC-08-002.1, AC-08-002.3) */}
        <div data-testid="manual-reader-area" style={READER_COLUMN_STYLE}>
          <DocReader
            activePage={resolvedPage}
            skills={skills}
            agents={agents}
            rules={rules}
            standards={standards}
          />
        </div>
      </div>
    </div>
  );
}
