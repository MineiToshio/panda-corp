"use server";
/**
 * app/manual/page.tsx — WO-08-002 (CMP-08-manual-page, server entry)
 *
 * Server Component: the /manual route entry point.
 *
 * Reads all Manual data on the server (filesystem access stays server-side,
 * architecture §3) and passes it down to ManualShell ("use client" boundary).
 *
 * Data reads:
 *   - lib/manual.ts     → readManualPages()   (authored Tutorial/Guides/Concepts)
 *   - lib/reference.ts  → readSkills()        (commands Reference, DR-046)
 *   - lib/reference.ts  → readAgents()        (agents Reference, DR-046)
 *   - lib/registry.ts   → readDecisionRules() (rules Reference, DR-046)
 *   - lib/standards.ts  → readStandards()     (standards Reference, DR-046)
 *
 * Architecture §11 surface: `app/manual`.
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - Spanish copy.
 *   - data-testid on the page root.
 *
 * Traceability:
 *   CMP-08-manual-page → AC-08-002.1, AC-08-002.2, AC-08-002.3, AC-08-002.4
 *   DR-046: Reference derived from canonical source at render time.
 */

import type { Metadata } from "next";
import { readManualPages } from "@/lib/manual";
import { readAgents, readSkills } from "@/lib/reference";
import { readDecisionRules } from "@/lib/registry";
import { readStandards } from "@/lib/standards";
import { ManualShell } from "./ManualShell";

// ---------------------------------------------------------------------------
// Page metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Manual — Pandacorp Mission Control",
  description: "Códice del gremio: guías, referencia y conceptos para operar la fábrica Pandacorp.",
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
  borderBottom:
    "var(--hairline, 1px) solid color-mix(in oklch, var(--color-text, currentColor) 15%, transparent)",
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--color-text, currentColor)",
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

export default function ManualPage(): React.JSX.Element {
  // Server-side reads — all filesystem access stays on the server (architecture §3).
  const pages = readManualPages();
  const skills = readSkills();
  const agents = readAgents();
  const rules = readDecisionRules();
  const standards = readStandards();

  return (
    <main data-testid="manual-page" style={PAGE_STYLE}>
      {/* Page chrome */}
      <div style={HEADER_STYLE}>
        <h1 style={TITLE_STYLE}>Manual</h1>
      </div>

      {/* Interactive shell — "use client" boundary */}
      <div style={BODY_STYLE}>
        <ManualShell
          pages={pages}
          skills={skills}
          agents={agents}
          rules={rules}
          standards={standards}
        />
      </div>
    </main>
  );
}
