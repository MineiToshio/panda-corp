/**
 * CardDetail — style constants and nav-entry helpers (sibling module).
 * Extracted to keep CardDetail.tsx under the 500-line limit (clean-code.md).
 * All values use CSS custom properties — zero hardcoded colors.
 */

import type { ProjectDocsIndex } from "@/lib/docs/docs";

// ---------------------------------------------------------------------------
// Root container
// ---------------------------------------------------------------------------

export const ROOT_STYLE: React.CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: 0,
  background: "var(--color-surface-panel, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
};

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------

export const TITLE_STYLE: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  color: "var(--color-text, currentColor)",
  margin: 0,
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  paddingBottom: "calc(var(--spacing, 0.25rem) * 3)",
};

// ---------------------------------------------------------------------------
// Tab row — now rendered by the shared Tabs primitive (DR-062); the bespoke
// TAB_ROW_STYLE / tabButtonStyle were removed when CardDetail adopted <Tabs>.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Panel base
// ---------------------------------------------------------------------------

export const PANEL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 4)",
  padding: "calc(var(--spacing, 0.25rem) * 4)",
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

export const DOCS_NAV_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  padding: "calc(var(--spacing, 0.25rem) * 3)",
  background: "var(--color-surface, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
};

export const DOCS_NAV_HEADING_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  margin: 0,
};

export const NAV_ITEM_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-accent, currentColor)",
  padding: "0.125rem 0",
  wordBreak: "break-all",
  cursor: "pointer",
};

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

export const COMMAND_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  flexWrap: "wrap",
};

export const COMMAND_CODE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "0.8125rem",
  color: "var(--color-text, currentColor)",
  background: "var(--color-surface-panel, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  padding: "0.125rem 0.375rem",
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
