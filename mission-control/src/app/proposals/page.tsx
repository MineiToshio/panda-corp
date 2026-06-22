/**
 * WO-17-004 — Proposals page (CMP-17-page, Server Component).
 *
 * The owner-facing surface of the factory's self-learning loop (DR-047) and the
 * place where Mission Control suggests improvements on its own. Composes the
 * memory-health panel, the four proposal streams (candidate lessons, prune,
 * promotions, self-suggestions) and the durable promotions queue.
 *
 * Group ordering per REQ-17-001 / AC-17-001.3 (prototype propuestasView(), ~L1420):
 *   1. Lecciones candidatas   (group cmd: /pandacorp:memory)
 *   2. Lecciones obsoletas    (group cmd: /pandacorp:memory) — adjacent to candidates
 *   3. Promociones            (no group cmd — each /pandacorp:learn <id>)
 *   4. Auto-sugerencias       (no group cmd — each computed command)
 *
 * Visual fidelity (DR-054/DR-056, FDD-17):
 *   - PageTitle (DR-062, the ONE light title block) with open-count tail
 *   - MemoryHealthPanel (Salud de la memoria section)
 *   - DismissableProposalStream × 4 with group-level commands for candidates+prune
 *   - PromotionsQueue (inside the promotions stream, durable reviewed list)
 *
 * Theme: the guild's *crónica* (the `librarian` as cronista). Honest / White-Hat
 * (FRD-09): no false urgency, no nagging, no streaks. Guild-framed language.
 *
 * Data flow (Server Component — architecture §3):
 *   - memoryHealth()          → MemoryHealth panel (REQ-17-005)
 *   - candidateLessons()      → stream 1 (candidates, group cmd /pandacorp:memory)
 *   - prunable()              → stream 2 (prune, group cmd /pandacorp:memory)
 *   - promotionQueue()        → stream 3 (each /pandacorp:learn) + PromotionsQueue
 *   - computeSuggestions()    → stream 4 (each own command, no Claude)
 *
 * Read-only: never writes to factory/memory, factory/standards, factory/decisions
 * or plugin/ (FRD-17 non-goal). Architecture §7 golden rule: read-only, no Claude.
 *
 * NOTE: NO "use server" directive on this file. This is a Server Component (a
 * Next.js page), not a Server Action module. Adding "use server" would convert
 * all exports to Server Actions and break the build.
 *
 * Traceability:
 *   CMP-17-page → AC-17-004.1..6
 *   REQ-17-001 / AC-17-001.1/.2/.3 — group-level command + ordering
 *   REQ-17-002 (4 streams), REQ-17-003 (evidence + action + copy)
 *   REQ-17-007 (candidate distinct + eval-gate)
 *   REQ-17-008 (honest/dismissible; guild theme)
 *   REQ-17-009 (high-risk display-only)
 */

import type { Metadata } from "next";
import { Chip } from "@/components/core/Chip/Chip";
import { PageLayout } from "@/components/core/PageLayout/PageLayout";
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
// Constants — group-level commands (REQ-17-001)
// ---------------------------------------------------------------------------

/** The single activating command for candidate-lesson and prune groups. */
const MEMORY_GROUP_CMD = "/pandacorp:memory";

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

// The page <main> + title + outer chrome come from PageLayout (DR-062), inside the
// single AppShell container (#pcapp, 1240px).
const CONTENT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0",
};

const READONLY_NOTE_STYLE: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--color-text2)",
  margin: "0 2px 18px",
};

// ---------------------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------------------

/**
 * ProposalsPage — renders the proposals inbox for the factory's self-learning loop.
 *
 * Server Component: reads filesystem data from lib/memory and computes
 * self-suggestions via lib/self-suggest (pure, no Claude, no network).
 * Renders the memory-health panel, then four ProposalStream sections in the
 * protocol order (candidates → prune → promotions → self-suggestions, AC-17-001.3).
 */
export default function ProposalsPage(): React.JSX.Element {
  // Read the four data streams
  const candidates = candidateLessons();
  const prunables = prunable();
  const promotions = promotionQueue();

  // Memory-loop health for the dedicated panel (REQ-17-005).
  const health = memoryHealth();

  // Self-suggestions are derived purely from already-read data. gatherSuggestionsInput()
  // reads the live sources MC already reads — board columns, the portfolio, the event
  // tail, the skill/agent catalog, the decision registry and the inbox decision lines —
  // so all six derivations (not just recurring-lesson) can fire (REQ-17-004). Read-only,
  // no Claude (architecture §7); each reader is fail-soft.
  const suggestions = computeSuggestions(gatherSuggestionsInput());

  // Compute open count for the tail pill (all four streams)
  const openCount = candidates.length + prunables.length + promotions.length + suggestions.length;

  // Open-count tail pill for the PageTitle (prototype tabProp badge, ~L652)
  const openCountTail =
    openCount > 0 ? (
      <Chip tone="accent">
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{openCount} abiertas</span>
      </Chip>
    ) : null;

  return (
    <PageLayout
      icon="ti-mail-opened"
      title="Propuestas"
      subtitle="La bandeja del gremio: lo que la fábrica aprendió y te propone (lecciones, promociones, poda, auto-sugerencias)."
      tail={openCountTail}
      testId="proposals-page"
    >
      <div style={CONTENT_STYLE}>
        {/* Read-only notice */}
        <p style={READONLY_NOTE_STYLE}>
          Solo-lectura — tú apruebas corriendo el comando; Mission Control nunca cosecha, promueve
          ni poda.
        </p>

        {/* Memory-loop health panel (CMP-17-health → REQ-17-005, AC-17-005.1..5).
            promotionsCount feeds the 4th dStat card "Promociones a aprobar"
            (prototype reads BPROPOSALS.promote.length, index.html ~L1414). */}
        <MemoryHealth health={health} promotionsCount={promotions.length} />

        {/* Stream 1: candidate lessons (group cmd → /pandacorp:memory, AC-17-001.1/.3) */}
        <DismissableProposalStream
          kind="candidate-lesson"
          lessons={candidates}
          groupCmd={MEMORY_GROUP_CMD}
        />

        {/* Stream 2: prune proposals (adjacent to candidates, AC-17-001.3; group cmd → /pandacorp:memory) */}
        <DismissableProposalStream kind="prune" lessons={prunables} groupCmd={MEMORY_GROUP_CMD} />

        {/* Stream 3: promotions (each has own /pandacorp:learn <id> — no group cmd, AC-17-001.2) */}
        <DismissableProposalStream kind="promotion" lessons={promotions} />

        {/* Durable promotions queue (CMP-17-promoqueue → REQ-17-006):
            the reviewable surface — target / rationale / evidence / high-risk
            badge + copyable /pandacorp:learn command. */}
        <PromotionsQueue lessons={promotions} />

        {/* Stream 4: self-suggestions (computed locally, no Claude; each has own cmd, AC-17-001.2) */}
        <DismissableProposalStream kind="self-suggestion" suggestions={suggestions} />
      </div>
    </PageLayout>
  );
}
