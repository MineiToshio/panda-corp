/**
 * WO-07-005 — Configuration page (CMP-07-config-page, server wrapper)
 * WO-07-006 — reads skills and passes them to ConfigurationShell
 * WO-07-007 — reads agents + computes XP levels and passes them to ConfigurationShell
 * WO-07-008 — reads decision rules and passes them to ConfigurationShell
 * WO-07-009 — reads standards and passes them to ConfigurationShell
 *
 * Server Component: the /configuration route entry point.
 * Reads filesystem data on the server and passes it down to ConfigurationShell
 * ("use client" boundary).
 *
 * Architecture §11: app surface `app/configuration`.
 * Architecture §3: Server Components read the filesystem; client components
 * handle interaction. ConfigurationShell is the "use client" boundary.
 *
 * Data reads (ALL FOUR sections — never partial):
 *   - lib/reference.ts    (skills — WO-07-006)
 *   - lib/reference.ts    (agents — WO-07-007)
 *   - lib/gamification.ts (computeAgentLevel per agent — WO-07-007)
 *   - lib/registry.ts     (decision rules — WO-07-008)
 *   - lib/standards.ts    (standards — WO-07-009)
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only.
 *   - data-testid on the page root.
 *   - Spanish copy.
 *   - NO "use server" directive — this is a Server Component (page), not a
 *     Server Action module. Adding "use server" here would convert all exports
 *     to Server Actions and break the Next.js build (async-only constraint).
 *
 * Traceability:
 *   CMP-07-config-page -> FRD-07
 *   AC-07-005.1, AC-07-005.2, AC-07-005.3, AC-07-005.4
 *   AC-07-006.1..5  (skills data flow)
 *   AC-07-007.1..4  (agents data flow)
 *   AC-07-008.1..4  (decision rules data flow)
 *   AC-07-009.1..5  (standards data flow)
 */

import type { Metadata } from "next";
import { type AgentLevelResult, computeAgentLevel } from "@/lib/gamification/agents";
import { durableEvents, readLedger } from "@/lib/gamification/ledger";
import { readAgents, readSkills } from "@/lib/reference/reference";
import { readDecisionRules } from "@/lib/registry/registry";
import { readStandards } from "@/lib/standards/standards";
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ConfigurationPage(): React.JSX.Element {
  // Server-side reads — filesystem access stays on the server (architecture §3).
  // WO-07-006: read skills for the skills tab.
  const skills = readSkills();

  // WO-07-007: read agents + derive XP levels for the agents tab (AC-07-007.1/.3).
  const agents = readAgents();
  // Only oracle-materialized facts may drive agent XP. Current WO state does not
  // prove author identity, so forged event attribution cannot award XP.
  const events = durableEvents(readLedger());
  const levels: Record<string, AgentLevelResult> = {};
  for (const agent of agents) {
    levels[agent.id] = computeAgentLevel(agent.id, events);
  }

  // WO-07-008: read decision rules for the rules tab (AC-07-008.2).
  const rules = readDecisionRules();

  // WO-07-009: read standards for the standards tab.
  const standards = readStandards();

  return (
    <main data-testid="configuration-page" style={PAGE_STYLE}>
      {/* ConfigurationShell owns the PageTitle + tabs + section panels ("use client" boundary).
       *  No extra header wrapper here — PageTitle (DR-062) lives inside the shell. */}
      <ConfigurationShell
        skills={skills}
        agentsData={{ agents, levels }}
        rules={rules}
        standards={standards}
      />
    </main>
  );
}
