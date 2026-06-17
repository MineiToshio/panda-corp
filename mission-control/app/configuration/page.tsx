/**
 * WO-07-005 — Configuration page (CMP-07-config-page, server wrapper)
 *
 * Server Component: the /configuration route entry point.
 * Renders the page chrome (title) and mounts ConfigurationShell, which
 * owns the interactive section-tab state ("use client").
 *
 * Architecture §11: app surface `app/configuration`.
 * Architecture §3: Server Components read the filesystem; client components
 * handle interaction. ConfigurationShell is the "use client" boundary.
 *
 * Data reads (WO-07-006 through WO-07-009 add reads here when sections ship):
 *   - lib/reference.ts  (skills + agents)
 *   - lib/registry.ts   (decision rules)
 *   - lib/standards.ts  (standards)
 * For this shell WO (WO-07-005) no data reads are needed — section content
 * is stubbed in ConfigurationShell placeholders.
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on the page root.
 *   - Spanish copy.
 *
 * Traceability:
 *   CMP-07-config-page → FRD-07
 *   AC-07-005.1, AC-07-005.2, AC-07-005.3, AC-07-005.4
 */

import type { Metadata } from "next";
import { readSkills } from "@/lib/reference";
import { readDecisionRules } from "@/lib/registry";
import { ConfigurationShell } from "./ConfigurationShell";

// ---------------------------------------------------------------------------
// Page metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Configuración — Pandacorp Mission Control",
  description:
    "Vista de lectura de la configuración de la fábrica: habilidades, agentes, reglas y estándares.",
};

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors (FRD-13)
// ---------------------------------------------------------------------------

const PAGE_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100dvh",
  overflow: "hidden",
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
};

const HEADER_STYLE: React.CSSProperties = {
  flexShrink: 0,
  padding: "calc(var(--spacing, 0.25rem) * 5) calc(var(--spacing, 0.25rem) * 8)",
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.65,
  margin: 0,
};

const BODY_STYLE: React.CSSProperties = {
  flex: 1,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ConfigurationPage(): React.JSX.Element {
  // Server-side reads — filesystem access stays on the server (architecture §3).
  // WO-07-006: read skills for the skills tab.
  // WO-07-008: read decision rules for the rules tab.
  const skills = readSkills();
  const rules = readDecisionRules();

  return (
    <main data-testid="configuration-page" style={PAGE_STYLE}>
      {/* Page chrome — read-only label */}
      <div style={HEADER_STYLE}>
        <h1 style={TITLE_STYLE}>Configuración</h1>
      </div>

      {/* Interactive shell — "use client" boundary */}
      <div style={BODY_STYLE}>
        <ConfigurationShell skills={skills} rules={rules} />
      </div>
    </main>
  );
}
