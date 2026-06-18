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
 * Layout:
 *   [ DocNav (side menu, fixed width) | DocReader (reading area, flex-1) ]
 *
 * Design rules (FRD-13):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - Spanish labels/aria-labels.
 *   - data-testid on the shell root.
 *
 * Traceability:
 *   CMP-08-manual-page → AC-08-002.1, AC-08-002.2, AC-08-002.3, AC-08-002.4
 */

import type React from "react";
import { useState } from "react";
import type { ManualPage } from "@/lib/manual";
import type { AgentRef, SkillRef } from "@/lib/reference";
import type { DecisionRule } from "@/lib/registry";
import type { Standard } from "@/lib/standards";
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
// Styles — CSS custom properties only (FRD-13)
// ---------------------------------------------------------------------------

const SHELL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  height: "100%",
  overflow: "hidden",
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
};

const NAV_COLUMN_STYLE: React.CSSProperties = {
  width: "16rem",
  flexShrink: 0,
  height: "100%",
  overflow: "hidden",
};

const READER_COLUMN_STYLE: React.CSSProperties = {
  flex: 1,
  height: "100%",
  overflow: "hidden",
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
  const [activePage, setActivePage] = useState<ActivePage | null>(null);

  const resolvedPage = resolveActivePage(activePage, pages);

  return (
    <div data-testid="manual-shell" style={SHELL_STYLE}>
      {/* Side menu — AC-08-002.2 */}
      <div style={NAV_COLUMN_STYLE}>
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

      {/* Reading area — AC-08-002.1, AC-08-002.3 */}
      <div style={READER_COLUMN_STYLE}>
        <DocReader
          activePage={resolvedPage}
          skills={skills}
          agents={agents}
          rules={rules}
          standards={standards}
        />
      </div>
    </div>
  );
}
