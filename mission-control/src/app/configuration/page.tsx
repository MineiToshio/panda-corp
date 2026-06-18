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
import { readEvents } from "@/lib/events/events";
import type { AgentLevelResult } from "@/lib/gamification/gamification";
import { computeAgentLevel } from "@/lib/gamification/gamification";
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
  const skills = readSkills();

  // WO-07-007: read agents + derive XP levels for the agents tab (AC-07-007.1/.3).
  const agents = readAgents();
  // Events are the source of truth for agent XP (FRD-09 honesty contract).
  // readEvents() never throws — returns empty snapshot when the file is absent.
  const { events } = readEvents();
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
      {/* Page chrome — read-only label */}
      <div style={HEADER_STYLE}>
        <h1 style={TITLE_STYLE}>Configuración</h1>
      </div>

      {/* Interactive shell — "use client" boundary */}
      <div style={BODY_STYLE}>
        <ConfigurationShell
          skills={skills}
          agentsData={{ agents, levels }}
          rules={rules}
          standards={standards}
        />
      </div>
    </main>
  );
}
