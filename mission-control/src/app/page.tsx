/**
 * CMP-18-page — Dashboard "Inicio" (default landing route `/`)
 *
 * Server Component. Composes the six dashboard sections top-to-bottom:
 *   0. PageTitle "Inicio" (CMP-13-pagetitle, DR-062)
 *   1. Health banners  (conditional: OnboardingGate + PluginSyncBanner)
 *   2. Desde tu última visita  (Digest — visto_hasta marker, client-local)
 *   3. Tu turno  (human-gate queue, hero block)
 *   4. Pulso de la fábrica  (funnel + conversion metric)
 *   5. Construcción y cartera  (per-project cards + first-action card)
 *   6. Tu progreso  (honest gamification strip)
 *
 * Read-only invariant (architecture §1, REQ-18-002): no writes, no Claude calls.
 * All I/O is fs-based reads via `lib/**`. "use client" is NOT set here.
 *
 * Real-time (AC-18-001.2): DashboardLiveWatcher (client component) subscribes to
 * useLiveSnapshot and calls router.refresh() on new events — the Server Component
 * re-runs with fresh lib data without a full navigation.
 *
 * Traceability:
 *   AC-18-001.1  / renders the dashboard under PageTitle "Inicio"
 *   AC-18-001.2  DashboardLiveWatcher provides event-driven live updates
 *   AC-18-001.3  OnboardingGate + PluginSyncBanner hosted (conditional)
 *   AC-18-001.4  visto_hasta client-local (Digest owns localStorage)
 *   AC-18-001.5  Tu turno: human-gate queue only (IF-18-turn exclusions enforced)
 *   AC-18-001.6  Pulso: ≤5 signals (IF-18-pulse)
 *   AC-18-001.7  Cartera: per-project card with phase/WO/flags/nextcmd
 *   AC-18-001.8  Tu progreso: honest gamification, no streaks
 *   AC-18-001.9  read-only; copyable commands; navigates on click
 *   AC-18-001.10 shared primitives: SectionHead, Chip, CmdRow, PageTitle, ProgressBar
 *
 * WO-18-001 — FRD-18 blueprint §3 (CMP-18-page, CMP-18-banners)
 */

import { OnboardingGate } from "@/app/_components/OnboardingGate/OnboardingGate";
import { PluginSyncBanner } from "@/app/_components/plugin-sync-banner/plugin-sync-banner";
import { filterDigestEvents } from "@/app/_lib/digest";
import { type PulseResult, pulse } from "@/app/_lib/pulse";
import { type CardData, deriveCard } from "@/app/(dashboard)/_lib/card";
import { buildTurnQueue, type TurnItem } from "@/app/(dashboard)/_lib/turn";
import { Chip } from "@/components/core/Chip/Chip";
import { PageLayout } from "@/components/core/PageLayout/PageLayout";
import { Cartera } from "@/components/dashboard/Cartera/Cartera";
import { DashboardLiveWatcher } from "@/components/dashboard/DashboardLiveWatcher/DashboardLiveWatcher";
import { GamificationLedgerSync } from "@/components/dashboard/GamificationLedgerSync/GamificationLedgerSync";
import { Progreso } from "@/components/dashboard/Progreso/Progreso";
import { TuTurno } from "@/components/dashboard/TuTurno/TuTurno";
import { Digest } from "@/components/modules/Digest/Digest";
import { Pulso } from "@/components/modules/Pulso/Pulso";
import { computeChains, computeUniques, type Unique } from "@/lib/achievements/achievements";
import { computeStats, type ReaderData } from "@/lib/achievements/stats";
import {
  FRESHNESS_THRESHOLD_MS,
  MEMORY_RAW_NOTES_THRESHOLD,
  MEMORY_STALE_DAYS_THRESHOLD,
} from "@/lib/constants";
import type { EventsSnapshot } from "@/lib/events/events";
import { getGuildState } from "@/lib/gamification/guildState";
import { type IdeaCard, readIdeas } from "@/lib/ideas/ideas";
import type { MemoryHealth } from "@/lib/memory/memory-health";
import { memoryHealth } from "@/lib/memory/memory-health";
import { activeProjects, type ProjectListItem } from "@/lib/portfolio/portfolio";
import { readProfile } from "@/lib/profile/profile";
import type { StatusResult } from "@/lib/status/status";
import { listWorkOrders } from "@/lib/work-orders/work-orders";

// ---------------------------------------------------------------------------
// Page layout styles (CSS custom properties only — FRD-13)
// ---------------------------------------------------------------------------

// Width/margin/padding now come from the single AppShell container (#pcapp, 1240px). The page only
// owns its internal vertical rhythm.
const PAGE_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base) * 1.5)",
};

// Health banners stack: layout (flex/gap) + the empty-collapse live in the
// `.dashboard-banners` CSS class (globals.css) so an empty wrapper adds no stray
// gap between the page title and the first section (the `:empty` rule must beat
// what would otherwise be an inline display).

// ---------------------------------------------------------------------------
// Pure derivation helpers (extracted to satisfy clean-code complexity limit)
// ---------------------------------------------------------------------------

/** Active phase set for in-construction freshness split (FRD-12). */
const IN_CONSTRUCTION_PHASES = new Set(["implementation", "architecture", "release"]);

/**
 * Count live vs stale in-construction builds (FRD-12 freshness, AC-18-001.6).
 * Pure: split `projects` that are running by whether their last event is fresh.
 */
function countConstructionSplit(
  projects: readonly ProjectListItem[],
  byProject: EventsSnapshot["byProject"],
  nowMs: number,
): { live: number; stale: number } {
  let live = 0;
  let stale = 0;
  for (const p of projects) {
    if (!IN_CONSTRUCTION_PHASES.has(p.stage ?? "")) continue;
    if (!p.running) continue;
    const lastAt = byProject[p.name]?.lastEventAt;
    if (!lastAt) {
      stale++;
      continue;
    }
    const ageMs = nowMs - new Date(lastAt).getTime();
    if (Number.isFinite(ageMs) && ageMs < FRESHNESS_THRESHOLD_MS) {
      live++;
    } else {
      stale++;
    }
  }
  return { live, stale };
}

/**
 * Derive one CardData from a ProjectListItem + event snapshot (IF-18-card).
 * Fail-soft: listWorkOrders errors are swallowed; no blocker reason reported.
 */
function deriveProjectCard(
  p: ProjectListItem,
  byProject: EventsSnapshot["byProject"],
  nowMs: number,
): CardData {
  const lastEventAt = byProject[p.name]?.lastEventAt ?? null;

  let failedWoReason: string | undefined;
  if (p.exists && p.path) {
    try {
      const wos = listWorkOrders(p.path);
      const failed = wos.find((wo) => wo.state === "fail");
      failedWoReason = failed?.title ?? undefined;
    } catch {
      // Read failure — no blocker reason available (fail-soft)
    }
  }

  const statusData = p.status.present && p.status.status !== null ? p.status.status : null;

  // Thread status.updatedAt as the phase-entry timestamp so ageInStageDays and
  // isStalled can actually fire (AC-18-001.7, REQ-18-017).
  const phaseStartedAt = statusData?.updatedAt ?? undefined;

  return deriveCard({
    name: p.name,
    phase: p.stage ?? "product",
    version: statusData?.version ?? "v1",
    running: p.running ?? false,
    workOrdersDone: statusData?.workOrdersDone ?? 0,
    workOrdersTotal: statusData?.workOrdersTotal ?? 0,
    phaseStartedAt,
    lastEventAt,
    failedWoReason,
    nowMs,
  });
}

/**
 * Pick the most recently unlocked unique achievement (newest-first).
 * Returns null for a fresh factory with no earned achievements.
 */
function mostRecentUnique(uniques: readonly Unique[]): Unique | null {
  const unlocked = uniques.filter((u) => u.unlocked);
  if (unlocked.length === 0) return null;
  return (
    unlocked.sort((a, b) => {
      if (a.date && b.date) return b.date < a.date ? -1 : 1;
      if (a.date) return -1;
      if (b.date) return 1;
      return 0;
    })[0] ?? null
  );
}

// ---------------------------------------------------------------------------
// Derivation bundles (group related reads/computations)
// ---------------------------------------------------------------------------

/** IF-18-turn input derivation from live data. */
function deriveTurnItems(
  statuses: readonly StatusResult[],
  projects: readonly ProjectListItem[],
  ideas: readonly IdeaCard[],
  memHealth: MemoryHealth,
): TurnItem[] {
  const pendingDecisions = statuses.reduce((sum, s) => {
    if (!s.present || s.status === null) return sum;
    return sum + (s.status.pendingDecisions ?? 0);
  }, 0);

  const shippedAwaitingReview = projects
    .filter((p) => p.stage === "release")
    .map((p) => ({ name: p.name, path: p.path }));

  const memoryNeedsAttention =
    memHealth.rawNotes >= MEMORY_RAW_NOTES_THRESHOLD ||
    (memHealth.staleDays !== null && memHealth.staleDays >= MEMORY_STALE_DAYS_THRESHOLD);

  const undiscoveredIdeas = ideas.filter((i) => i.status === "discovered").length;

  return buildTurnQueue({
    pendingDecisions,
    inboxDecisionLines: [],
    shippedAwaitingReview,
    memoryNeedsAttention,
    undiscoveredIdeas,
  });
}

/** Input bundle for {@link derivePulse}. */
interface DerivePulseInput {
  ideas: readonly IdeaCard[];
  projects: readonly ProjectListItem[];
  byProject: EventsSnapshot["byProject"];
  ownerWaiting: number;
  nowMs: number;
}

/** IF-18-pulse derivation from live data. */
function derivePulse({
  ideas,
  projects,
  byProject,
  ownerWaiting,
  nowMs,
}: DerivePulseInput): PulseResult {
  const ideasAlive = ideas.filter((i) => i.status !== "discarded" && i.status !== "shipped").length;
  const ideasShipped = ideas.filter((i) => i.status === "shipped").length;
  const { live: inConstructionLive, stale: inConstructionStale } = countConstructionSplit(
    projects,
    byProject,
    nowMs,
  );
  return pulse({ ideasAlive, ideasShipped, inConstructionLive, inConstructionStale, ownerWaiting });
}

/**
 * Achievement derivation for the dashboard: most-recent unlocked unique + the
 * nearest next milestone. The guild LEVEL is NOT derived here — it comes from the
 * shared getGuildState() (single source of truth), so it can't diverge from the
 * header GuildBar or the Logros hero.
 */
function deriveGamification(readerData: ReaderData): {
  recentAchievement: Unique | null;
  nextMilestone: ReturnType<typeof computeChains>[number] | null;
} {
  const stats = computeStats(readerData);
  const uniques = computeUniques(readerData);
  const chains = computeChains(stats);
  const recentAchievement = mostRecentUnique(uniques);
  const nextMilestone =
    chains.filter((c) => c.nextTier !== null).sort((a, b) => b.pctToNext - a.pctToNext)[0] ?? null;
  return { recentAchievement, nextMilestone };
}

// ---------------------------------------------------------------------------
// HomePage — Server Component (default export, route `/`)
// ---------------------------------------------------------------------------

/**
 * Dashboard "Inicio" — the default landing route.
 *
 * Reads all lib layers server-side, delegates derivations to pure helpers, and
 * renders the six stacked sections under PageTitle "Inicio". Never calls Claude;
 * never writes to disk. DashboardLiveWatcher (client) provides event-driven
 * real-time refresh (AC-18-001.2).
 */
export default function HomePage(): React.JSX.Element {
  const nowMs = Date.now();

  // ── 1. Read the live data layers (all read-only) ────────────────────────

  // Guild state (statuses + events + level) from THE single source of truth, so the
  // dashboard's guild level matches the header GuildBar and the Logros hero exactly.
  // `liveOutcomes` (pre-ledger) is passed to GamificationLedgerSync so the snapshot
  // action can compare raw live vs stored max — not the already-merged outcomes (WO-09-006).
  const { statuses, eventsSnapshot, liveOutcomes, level: guildLevel } = getGuildState();
  // Drop infra/live-stream noise (SubagentStop/SupervisorTick/AgentWorking) so the "since last visit"
  // digest shows milestone changes, not thousands of SubagentStop rows (coherence, prototype digest).
  const events = filterDigestEvents(eventsSnapshot.events);
  const projects = activeProjects();
  const ideas = readIdeas();
  const memHealth = memoryHealth();
  const profileResult = readProfile();

  // ── 2. Derive sections ──────────────────────────────────────────────────

  const turnItems = deriveTurnItems(statuses, projects, ideas, memHealth);
  const pulseResult = derivePulse({
    ideas,
    projects,
    byProject: eventsSnapshot.byProject,
    ownerWaiting: turnItems.length,
    nowMs,
  });
  const cards = projects.map((p) => deriveProjectCard(p, eventsSnapshot.byProject, nowMs));

  const readerData: ReaderData = { ideas, statuses, eventsSnapshot };
  const { recentAchievement, nextMilestone } = deriveGamification(readerData);

  // ── Tu turno count chip (right slot of SectionHead) ─────────────────────
  const turnCount = turnItems.length;
  const turnChip =
    turnCount > 0 ? (
      <span data-testid="tu-turno-count" role="status">
        <Chip tone="danger">{turnCount} esperan por ti</Chip>
      </span>
    ) : (
      <span data-testid="tu-turno-al-dia">
        <Chip tone="ok">al día</Chip>
      </span>
    );

  // ── 3. Render ───────────────────────────────────────────────────────────

  return (
    <PageLayout
      icon="ti-home"
      title="Inicio"
      subtitle="Tu cabina de mando: lo que espera por ti, el pulso de la fábrica y la cartera en obra."
      testId="dashboard-page"
    >
      {/* ── Live watcher (renders null): event-driven real-time refresh, AC-18-001.2 ── */}
      <DashboardLiveWatcher />
      {/* ── Ledger sync (renders null): fire-and-forget snapshot after paint, AC-09-006.2 ── */}
      <GamificationLedgerSync liveOutcomes={liveOutcomes} />

      <div style={PAGE_STYLE}>
        {/* ── Health banners (conditional, AC-18-001.3). Collapses when empty
            (globals.css :empty rule) so it never adds a stray gap. ── */}
        <div data-testid="dashboard-banners" className="dashboard-banners">
          {/* OnboardingGate: renders only when profile is absent (FRD-01, AC-18-001.3) */}
          {!profileResult.present && <OnboardingGate />}
          {/* PluginSyncBanner: "use client"; renders null until drift confirmed (FRD-15) */}
          <PluginSyncBanner />
        </div>

        {/* ── Section 2: Desde tu última visita (digest, AC-18-001.4) ── */}
        <Digest events={events} nowMs={nowMs} />

        {/* ── Section 3: Tu turno (human-gate queue, AC-18-001.5) ── */}
        <TuTurno items={turnItems} turnChip={turnChip} />

        {/* ── Section 4: Pulso de la fábrica (funnel + conversion, AC-18-001.6) ── */}
        <Pulso pulse={pulseResult} />

        {/* ── Section 5: Construcción y cartera (project cards, AC-18-001.7) ── */}
        <Cartera cards={cards} />

        {/* ── Section 6: Tu progreso (gamification strip, AC-18-001.8) ── */}
        <Progreso
          guildLevel={guildLevel}
          recentAchievement={recentAchievement}
          nextMilestone={nextMilestone}
        />
      </div>
    </PageLayout>
  );
}
