/**
 * WO-17-004 — Proposals page (CMP-17-page, Server Component).
 *
 * The owner-facing surface of the factory's self-learning loop (DR-047) and the
 * place where Mission Control suggests improvements on its own. Composes the
 * memory-health panel, the four proposal streams (candidate lessons, promotions,
 * prune, self-suggestions) and the durable promotions queue.
 *
 * Theme: the guild's *crónica* (the `librarian` as cronista). Honest / White-Hat
 * (FRD-09): no false urgency, no nagging, no streaks. Guild-framed language.
 *
 * Data flow (Server Component — architecture §3):
 *   - memoryHealth()     → CMP-17-health panel (REQ-17-005)
 *   - candidateLessons() → CMP-17-stream candidate-lesson
 *   - promotionQueue()   → CMP-17-stream promotion + CMP-17-promoqueue (REQ-17-006)
 *   - prunable()         → CMP-17-stream prune
 *   - computeSuggestions(input) — pure, no Claude — → CMP-17-stream self-suggestion
 *
 * Read-only: never writes to factory/memory, factory/standards, factory/decisions
 * or plugin/ (FRD-17 non-goal). Architecture §7 golden rule: read-only, no Claude.
 *
 * NOTE: NO "use server" directive on this file. This is a Server Component (a
 * Next.js page), not a Server Action module. Adding "use server" would convert
 * all exports to Server Actions and break the build (all Server Actions must be
 * async — the default export `ProposalsPage` is a sync function). See progress.md
 * reviewer finding 2026-06-17 (WO-08-002 / WO-07 pre-existing bug).
 *
 * Traceability:
 *   CMP-17-page → AC-17-004.1..6
 *   REQ-17-002 (4 streams), REQ-17-003 (evidence + action + copy)
 *   REQ-17-007 (candidate distinct + eval-gate)
 *   REQ-17-008 (honest/dismissible; guild theme)
 *   REQ-17-009 (high-risk display-only)
 */

import type { Metadata } from "next";
import { MemoryHealth } from "@/components/modules/MemoryHealth/MemoryHealth";
import { PromotionsQueue } from "@/components/modules/PromotionsQueue/PromotionsQueue";
import { candidateLessons, promotionQueue, prunable } from "@/lib/memory/memory";
import { memoryHealth } from "@/lib/memory/memory-health";
import { gatherSuggestionsInput } from "@/lib/self-suggest/gather";
import { computeSuggestions } from "@/lib/self-suggest/self-suggest";
import { DismissableProposalStream } from "./_components/DismissableProposalStream/DismissableProposalStream";

// ---------------------------------------------------------------------------
// Page metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Propuestas — Pandacorp Mission Control",
  description:
    "Crónica del gremio: lecciones candidatas, propuestas de promoción, depuraciones y sugerencias automáticas.",
};

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

const PAGE_STYLE: React.CSSProperties = {
  minHeight: "100dvh",
  background: "var(--color-base, Canvas)",
  color: "var(--color-text, currentColor)",
};

const HEADER_STYLE: React.CSSProperties = {
  padding: "calc(var(--space-base, 1rem) * 1.5) calc(var(--space-base, 1rem) * 2)",
  borderBottom: "var(--hairline, 1px) solid currentColor",
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const HEADING_STYLE: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  margin: 0,
  color: "var(--color-text, currentColor)",
};

const SUBHEADING_STYLE: React.CSSProperties = {
  fontSize: "0.8rem",
  opacity: 0.6,
  margin: 0,
  fontStyle: "italic",
};

const CONTENT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base, 1rem) * 2)",
  padding: "calc(var(--space-base, 1rem) * 1.5) calc(var(--space-base, 1rem) * 2)",
  maxWidth: "900px",
};

// ---------------------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------------------

/**
 * ProposalsPage — renders the proposals inbox for the factory's self-learning loop.
 *
 * Server Component: reads filesystem data from lib/memory and computes
 * self-suggestions via lib/self-suggest (pure, no Claude, no network).
 * Renders four ProposalStream sections, one per kind.
 */
export default function ProposalsPage(): React.JSX.Element {
  // Read the four data streams
  const candidates = candidateLessons();
  const promotions = promotionQueue();
  const prunables = prunable();

  // Memory-loop health for the dedicated panel (REQ-17-005).
  const health = memoryHealth();

  // Self-suggestions are derived purely from already-read data. gatherSuggestionsInput()
  // reads the live sources MC already reads — board columns, the portfolio, the event
  // tail, the skill/agent catalog, the decision registry and the inbox decision lines —
  // so all six derivations (not just recurring-lesson) can fire (REQ-17-004). Read-only,
  // no Claude (architecture §7); each reader is fail-soft.
  const suggestions = computeSuggestions(gatherSuggestionsInput());

  return (
    <main data-testid="proposals-page" style={PAGE_STYLE}>
      {/* Page header — guild cronista theme */}
      <header style={HEADER_STYLE}>
        <h1 style={HEADING_STYLE}>Propuestas / Crónica del gremio</h1>
        <p style={SUBHEADING_STYLE}>
          Registro del librarian: lecciones pendientes, promociones y sugerencias del sistema. Solo
          lectura — el owner actúa a través de las habilidades.
        </p>
      </header>

      {/* Proposal surface */}
      <div style={CONTENT_STYLE}>
        {/* Memory-loop health panel (CMP-17-health → REQ-17-005) */}
        <MemoryHealth health={health} />

        {/* Stream 1: candidate lessons (dismissible — REQ-17-008) */}
        <DismissableProposalStream kind="candidate-lesson" lessons={candidates} />

        {/* Stream 2: promotions stream (CMP-17-stream, generic proposal cards) */}
        <DismissableProposalStream kind="promotion" lessons={promotions} />

        {/* Durable promotions queue (CMP-17-promoqueue → REQ-17-006):
            the reviewable surface — target / rationale / evidence / high-risk
            badge + copyable /pandacorp:learn command. */}
        <PromotionsQueue lessons={promotions} />

        {/* Stream 3: prune proposals (dismissible — REQ-17-008) */}
        <DismissableProposalStream kind="prune" lessons={prunables} />

        {/* Stream 4: self-suggestions (computed locally, no Claude; dismissible) */}
        <DismissableProposalStream kind="self-suggestion" suggestions={suggestions} />
      </div>
    </main>
  );
}
