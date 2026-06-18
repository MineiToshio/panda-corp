"use client";

/**
 * WO-02-007 — CardDetail component (CMP-02-card-detail)
 *
 * Traceability:
 *   CMP-02-card-detail → REQ-02-004, REQ-02-008
 *   AC-02-004.1  WHEN the owner clicks a card, the system SHALL show:
 *                summary, key points, docs navigator, next-step command (copy).
 *   AC-02-008.1  Idea with no documents → show only the summary, no navigator, no crash.
 *
 * Design rules (AGENTS.md):
 *   - Zero hardcoded color values — all via CSS custom properties.
 *   - data-testid on every significant element (test-writer contract).
 *   - Spanish aria-labels (single operator, Spanish UI).
 *   - Read-only: no writes, no fs calls, no network calls.
 *   - "use client" required because CopyButton uses browser clipboard API.
 */

import Markdown from "react-markdown";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import type { ProjectDocsIndex } from "@/lib/docs/docs";
import type { IdeaStatus } from "@/lib/ideas/ideas";
import { nextStep } from "@/lib/next-step/next-step";
import type { Phase } from "@/lib/status/status";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CardDetailProps {
  /** Filename without .md — uniquely identifies the card. */
  slug: string;
  /** Frontmatter `title` field. */
  title: string;
  /** Frontmatter `status` field — validated against the IdeaStatus union. */
  status: IdeaStatus;
  /** Markdown body (summary + key points). Rendered via react-markdown. */
  body: string;
  /** Project phase from linked project's status.yaml (in-pipeline only). */
  phase?: Phase;
  /** DR-032: whether a skill has advanced a phase and is waiting for "ok, advance". */
  advancePending?: boolean;
  /** Result of readProjectDocs(card.project). Null when no project or docs. */
  docsIndex?: ProjectDocsIndex | null;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; no hardcoded color values.
// ---------------------------------------------------------------------------

const ROOT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 4)",
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  background: "var(--color-surface-panel, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  color: "var(--color-text, currentColor)",
  margin: 0,
};

const SUMMARY_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  lineHeight: 1.6,
  color: "var(--color-text, currentColor)",
};

const DOCS_NAV_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  padding: "calc(var(--spacing, 0.25rem) * 3)",
  background: "var(--color-surface, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
};

const DOCS_NAV_HEADING_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  margin: 0,
};

const NAV_ITEM_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-accent, currentColor)",
  padding: "0.125rem 0",
  wordBreak: "break-all",
};

const NEXT_STEP_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  padding: "calc(var(--spacing, 0.25rem) * 3)",
  background: "var(--color-surface, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
};

const NEXT_STEP_LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  margin: 0,
};

const COMMAND_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  flexWrap: "wrap",
};

const COMMAND_CODE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "0.8125rem",
  color: "var(--color-text, currentColor)",
  background: "var(--color-surface-panel, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.5)",
  padding: "0.125rem 0.375rem",
};

// ---------------------------------------------------------------------------
// Helpers — build navigable entries from docsIndex
// ---------------------------------------------------------------------------

type NavEntry = { key: string; label: string };

/**
 * Convert a ProjectDocsIndex into a flat list of navigable entries.
 * Returns an empty array if there are no navigable entries (AC-02-008.1).
 */
function buildNavEntries(docsIndex: ProjectDocsIndex): NavEntry[] {
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CardDetail — navigable idea card detail with docs navigator and next-step command.
 *
 * "use client" because CopyButton relies on the clipboard API (browser only).
 * Safe to render in any environment that has the browser APIs (jsdom, browser).
 */
export function CardDetail({
  slug,
  title,
  status,
  body,
  phase,
  advancePending,
  docsIndex,
}: CardDetailProps): React.JSX.Element {
  // Resolve the next-step command for this card's lifecycle position.
  const step = nextStep({ cardStatus: status, phase, advancePending });

  // Build navigable doc entries (empty when no docs).
  const navEntries: NavEntry[] = docsIndex != null ? buildNavEntries(docsIndex) : [];
  const hasNav = navEntries.length > 0;

  return (
    <section data-testid="card-detail" style={ROOT_STYLE} aria-label={`Detalle de idea: ${title}`}>
      {/* Title (accessible name + visible heading) */}
      <h2 style={TITLE_STYLE}>{title}</h2>

      {/* Summary — markdown body (AC-02-004.1: summary + key points).
          Headings in the body (## Summary, ### …) are remapped to <strong>/<p>
          so they do not conflict with the component's own <h2> title — this keeps
          `screen.queryByRole("heading")` deterministic in tests (single heading). */}
      <div data-testid="card-detail-summary" style={SUMMARY_STYLE}>
        <Markdown
          components={{
            h1: ({ children }) => (
              <p>
                <strong>{children}</strong>
              </p>
            ),
            h2: ({ children }) => (
              <p>
                <strong>{children}</strong>
              </p>
            ),
            h3: ({ children }) => (
              <p>
                <strong>{children}</strong>
              </p>
            ),
            h4: ({ children }) => (
              <p>
                <strong>{children}</strong>
              </p>
            ),
            h5: ({ children }) => (
              <p>
                <strong>{children}</strong>
              </p>
            ),
            h6: ({ children }) => (
              <p>
                <strong>{children}</strong>
              </p>
            ),
          }}
        >
          {body}
        </Markdown>
      </div>

      {/* Docs navigator (only when docsIndex has navigable entries — AC-02-008.1) */}
      {hasNav && (
        <nav
          data-testid="card-detail-docs-nav"
          style={DOCS_NAV_STYLE}
          aria-label="Documentos del proyecto"
        >
          <p style={DOCS_NAV_HEADING_STYLE}>Documentos</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {navEntries.map((entry) => (
              <li key={entry.key} data-testid="card-detail-docs-nav-item" style={NAV_ITEM_STYLE}>
                {entry.label}
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Next-step command row (AC-02-004.1: next-step command with copy button).
          Uses <section> so aria-label is valid (div[generic] does not support it). */}
      <section
        data-testid="card-detail-next-step"
        style={NEXT_STEP_STYLE}
        aria-label="Siguiente comando"
      >
        <p style={NEXT_STEP_LABEL_STYLE}>Siguiente paso</p>
        {/* The label includes the command + any DR-032 advance hint */}
        <p
          style={{
            fontSize: "0.8125rem",
            color: "var(--color-text-muted, currentColor)",
            margin: 0,
          }}
        >
          {step.label}
        </p>
        <div style={COMMAND_STYLE}>
          <code style={COMMAND_CODE_STYLE}>{step.command}</code>
          <CopyButton value={step.command} />
        </div>
      </section>

      {/* Hidden metadata for data binding (slug is not displayed but carried for key usage) */}
      <span style={{ display: "none" }} aria-hidden="true" data-slug={slug} />
    </section>
  );
}
