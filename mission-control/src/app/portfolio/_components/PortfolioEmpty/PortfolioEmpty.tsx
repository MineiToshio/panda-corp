/**
 * PortfolioEmpty — Graceful empty state when there are no active projects (CMP-03-empty).
 *
 * Shown by the portfolio rail when activeProjects() returns an empty array.
 * Suggests /pandacorp:spec via a CopyButton so the owner can start a new project.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — all values via CSS custom properties.
 *   - Spanish user-facing copy (single local operator).
 *   - Server Component safe — no hooks, no browser APIs.
 *   - data-testid="portfolio-empty" on root.
 *
 * Traceability:
 *   CMP-03-empty → AC-03-006.1, REQ-03-006
 *   AC-03-006.5 (read-only): only renders copyable text, never clones or writes.
 */

import { CopyButton } from "@/components/core/CopyButton/CopyButton";

const SPEC_COMMAND = "/pandacorp:spec";

const CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "calc(var(--space-base, 1rem) * 0.75)",
  padding: "calc(var(--space-base, 1rem) * 2)",
  textAlign: "center",
  color: "var(--color-text, currentColor)",
};

const HEADING_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "0.9375rem",
  fontWeight: 600,
  color: "var(--color-text, currentColor)",
};

const BODY_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: "0.8125rem",
  color: "var(--color-text, currentColor)",
  opacity: 0.75,
};

const COMMAND_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--space-base, 1rem) * 0.5)",
  flexWrap: "wrap",
  justifyContent: "center",
};

const CODE_STYLE: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "var(--color-accent, currentColor)",
};

/**
 * PortfolioEmpty — renders when there are no active projects.
 * Suggests /pandacorp:spec with a CopyButton.
 *
 * AC-03-006.1: graceful empty state.
 * AC-03-006.5: read-only — only copyable text, no write/clone/Claude call.
 */
export function PortfolioEmpty(): React.JSX.Element {
  return (
    <div data-testid="portfolio-empty" style={CONTAINER_STYLE} aria-live="polite">
      <p style={HEADING_STYLE}>Sin proyectos activos</p>
      <p style={BODY_STYLE}>
        Usa <code style={CODE_STYLE}>{SPEC_COMMAND}</code> para crear un proyecto nuevo.
      </p>
      <div style={COMMAND_ROW_STYLE}>
        <CopyButton value={SPEC_COMMAND} label="Copiar comando" />
      </div>
    </div>
  );
}
