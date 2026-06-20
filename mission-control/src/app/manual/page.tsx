/**
 * app/manual/page.tsx — WO-08-002 (CMP-08-manual-page, server entry)
 *
 * Server Component: the /manual route entry point.
 *
 * Reads all Manual data on the server (filesystem access stays server-side,
 * architecture §3) and passes it down to ManualShell ("use client" boundary).
 * ManualShell owns the PageTitle H1 "Documentación" (DR-062 — ONE title block).
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
 *   - No bespoke header/H1 here — ManualShell owns the PageTitle block (DR-062).
 *   - data-testid on the page root.
 *
 * Traceability:
 *   CMP-08-manual-page → AC-08-002.1, AC-08-002.2, AC-08-002.3, AC-08-002.4
 *   DR-046: Reference derived from canonical source at render time.
 *   DR-062: PageTitle is in ManualShell (the client shell), not here.
 */

import type { Metadata } from "next";
import type React from "react";
import { readManualPages } from "@/lib/manual/manual";
import { readAgents, readSkills } from "@/lib/reference/reference";
import { readDecisionRules } from "@/lib/registry/registry";
import { readStandards } from "@/lib/standards/standards";
import { ManualShell } from "./ManualShell";

// ---------------------------------------------------------------------------
// Page metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Documentación — Pandacorp Mission Control",
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
  background: "var(--color-base)",
  color: "var(--color-text, currentColor)",
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
    <div data-testid="manual-page" style={PAGE_STYLE}>
      {/* ManualShell owns the full layout including PageTitle H1 (DR-062). */}
      <ManualShell
        pages={pages}
        skills={skills}
        agents={agents}
        rules={rules}
        standards={standards}
      />
    </div>
  );
}
