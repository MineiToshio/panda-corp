/**
 * WO-07-009 — Standards section styles (CMP-07-standards-list + CMP-07-standard-detail)
 *
 * Style constants + helpers and the domain ordering for the Standards section.
 * Zero hardcoded colors — CSS custom properties only (FRD-13).
 */

import type React from "react";
import type { StandardDomain } from "@/lib/standards/standards";

// ---------------------------------------------------------------------------
// Domain ordering (AC-07-009.1 — the 9 domains + Other as catch-all)
// ---------------------------------------------------------------------------

export const DOMAIN_ORDER: StandardDomain[] = [
  "Programming",
  "Architecture",
  "Design",
  "Technology",
  "Quality",
  "Security",
  "Operation",
  "Data/Privacy",
  "Product/Docs",
  "Other",
];

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only (FRD-13)
// ---------------------------------------------------------------------------

export const SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 6)",
};

export const HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "calc(var(--spacing, 0.25rem) * 4)",
  flexWrap: "wrap",
};

export const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 600,
  color: "var(--color-text, currentColor)",
  margin: 0,
};

export const DOMAIN_GROUP_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

export const DOMAIN_HEADING_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text, currentColor)",
  opacity: 0.45,
  margin: 0,
  paddingBottom: "calc(var(--spacing, 0.25rem) * 1)",
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

export const LIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
};

export const ITEM_TITLE_STYLE: React.CSSProperties = {
  flex: 1,
  fontWeight: 500,
  color: "var(--color-text, currentColor)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const BADGES_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
  flexShrink: 0,
};

/** Returns severity badge style based on severity level. */
export function severityBadgeStyle(severity: string): React.CSSProperties {
  const colorMap: Record<string, string> = {
    MUST: "var(--color-accent, currentColor)",
    SHOULD: "var(--color-agent-test-writer, currentColor)",
    MAY: "var(--color-text, currentColor)",
  };
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 6px",
    borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
    fontSize: "0.6875rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    border: "var(--hairline, 1px) solid currentColor",
    color: colorMap[severity] ?? "var(--color-text, currentColor)",
    background: "transparent",
  };
}

/** Returns enforcement badge style. */
export function enforcementBadgeStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 6px",
    borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
    fontSize: "0.6875rem",
    fontWeight: 600,
    letterSpacing: "0.02em",
    border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
    color: "var(--color-text, currentColor)",
    opacity: 0.75,
    background: "transparent",
  };
}

export const DETAIL_PANEL_STYLE: React.CSSProperties = {
  marginTop: "calc(var(--spacing, 0.25rem) * 1)",
  marginLeft: "calc(var(--spacing, 0.25rem) * 3)",
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  background: "oklch(from var(--color-surface, oklch(0.1 0.015 230)) calc(l + 0.03) c h / 0.6)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
};

export const SUMMARY_LIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1.5)",
  padding: 0,
  margin: 0,
  listStyle: "none",
};

export const SUMMARY_ITEM_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  fontSize: "0.875rem",
  color: "var(--color-text, currentColor)",
  lineHeight: 1.5,
};

export const SUMMARY_BULLET_STYLE: React.CSSProperties = {
  flexShrink: 0,
  color: "var(--color-accent, currentColor)",
  fontWeight: 700,
};

export const MARKDOWN_BODY_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  lineHeight: 1.7,
  color: "var(--color-text, currentColor)",
};

export const EMPTY_STATE_STYLE: React.CSSProperties = {
  padding: "calc(var(--spacing, 0.25rem) * 8)",
  textAlign: "center",
  color: "var(--color-text, currentColor)",
  opacity: 0.5,
  fontSize: "0.875rem",
};

export const SECTION_HEADER_NOTE_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text, currentColor)",
  opacity: 0.6,
  lineHeight: 1.4,
};
