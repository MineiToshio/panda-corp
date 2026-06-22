/**
 * CardDetail — style constants and nav-entry helpers (sibling module).
 * Extracted to keep CardDetail.tsx under the 500-line limit (clean-code.md).
 * All values use CSS custom properties — zero hardcoded colors.
 */

import type { ProjectDocsIndex } from "@/lib/docs/docs";

// ---------------------------------------------------------------------------
// Root container
// ---------------------------------------------------------------------------

/**
 * Card detail root — transparent layout only: the tabs sit on top and each tab's
 * own content panel is the bordered container BELOW them (prototype detailView:
 * bare `.stab` pills above, the body panel below). No outer border here.
 */
export const ROOT_STYLE: React.CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------

/**
 * The idea title is shown by the host's PageTitle (the prototype's pageHead,
 * BRD-02); inside CardDetail it is kept as an accessible-but-visually-hidden
 * <h2> so the component keeps an internal heading/name and isolated tests can
 * still query it by text — without a duplicate visible title.
 */
export const TITLE_STYLE: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

// ---------------------------------------------------------------------------
// Tab row — now rendered by the shared Tabs primitive (DR-062); the bespoke
// TAB_ROW_STYLE / tabButtonStyle were removed when CardDetail adopted <Tabs>.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Panel base
// ---------------------------------------------------------------------------

/** Active tab panel — full width; padding 0 (each tab's own content panel(s)
 *  carry the border + padding, so they read as the container below the tabs). */
export const PANEL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 4)",
  padding: 0,
};

/** Style for a visually-hidden (but accessible) off-screen panel. */
export const PANEL_HIDDEN_STYLE: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

// ---------------------------------------------------------------------------
// Documentos panel — summary + docs navigator
// ---------------------------------------------------------------------------

export const SUMMARY_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  lineHeight: 1.6,
  color: "var(--color-text, currentColor)",
};

/** Two-pane Documentos layout: left rail (210px) + reader. Responsive via the
 *  `.card-detail-docs-grid` class in globals.css (stacks under ~640px). */

/** Left rail panel (the "DOCUMENTOS" navigator). Prototype docsBody left panel. */
export const DOCS_SIDEBAR_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
  padding: "calc(var(--spacing, 0.25rem) * 2.5)",
  background: "var(--color-surface, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
};

/** Reader panel (the selected document's body). Prototype docsBody right panel. */
export const DOCS_READER_STYLE: React.CSSProperties = {
  padding: "calc(var(--spacing, 0.25rem) * 3.5)",
  background: "var(--color-surface, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  minWidth: 0,
};

/** Rail label "DOCUMENTOS" (also reused as a section heading). */
export const DOCS_NAV_HEADING_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--color-text3, var(--color-text-muted, currentColor))",
  margin: "0 0 calc(var(--spacing, 0.25rem) * 0.5)",
};

/** A single rail nav item (Resumen / a document), with an active state. */
export function docsNavItemStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    width: "100%",
    textAlign: "left",
    padding: "5px 8px",
    borderRadius: "7px",
    border: "none",
    fontFamily: "inherit",
    fontSize: "0.8125rem",
    lineHeight: 1.35,
    cursor: "pointer",
    background: active ? "var(--color-accent-bg)" : "transparent",
    color: active
      ? "var(--color-accent-text)"
      : "var(--color-text2, var(--color-text, currentColor))",
    wordBreak: "break-word",
  };
}

// ---------------------------------------------------------------------------
// Comandos panel — next-step command row
// ---------------------------------------------------------------------------

export const NEXT_STEP_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  padding: "calc(var(--spacing, 0.25rem) * 3)",
  background: "var(--color-surface, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
};

export const NEXT_STEP_LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  margin: 0,
};

/** Command-row "when"/label hint shown above each command (Comandos tab). */
export const COMMAND_WHEN_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  margin: 0,
};

// ---------------------------------------------------------------------------
// Nav entry helpers
// ---------------------------------------------------------------------------

/** A single navigable entry in the docs navigator. */
export type NavEntry = { key: string; label: string };

/**
 * Convert a ProjectDocsIndex into a flat list of navigable entries.
 * Returns an empty array if there are no navigable entries (AC-02-008.1).
 */
export function buildNavEntries(docsIndex: ProjectDocsIndex): NavEntry[] {
  const entries: NavEntry[] = [];

  if (docsIndex.prd) {
    entries.push({ key: "prd", label: "PRD (docs/product/prd.md)" });
  }

  if (docsIndex.architecture) {
    entries.push({ key: "architecture", label: "Architecture (docs/product/architecture.md)" });
  }

  for (const frd of docsIndex.frds) {
    entries.push({ key: frd.slug, label: frd.slug });
  }

  if (docsIndex.hasAdr) {
    entries.push({ key: "adr", label: "ADR (docs/adr/)" });
  }

  if (docsIndex.hasAnalytics) {
    entries.push({ key: "analytics", label: "Analytics (docs/analytics/)" });
  }

  if (docsIndex.hasDecisionLog) {
    entries.push({ key: "decision-log", label: "Decision log (docs/decision-log.md)" });
  }

  if (docsIndex.comms.progress) {
    entries.push({ key: "progress", label: "Progress (.pandacorp/comms/progress.md)" });
  }

  if (docsIndex.comms.decisions) {
    entries.push({ key: "decisions", label: "Decisions (.pandacorp/inbox/decisions.md)" });
  }

  for (const bugPath of docsIndex.comms.bugs) {
    const filename = bugPath.split("/").at(-1) ?? bugPath;
    entries.push({ key: `bug-${filename}`, label: `Bug: ${filename}` });
  }

  return entries;
}
