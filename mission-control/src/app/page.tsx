/**
 * CMP-18-page — Dashboard "Inicio" (default landing route `/`)
 *
 * Server Component. Composes the six dashboard sections top-to-bottom:
 *   1. Health banners  (conditional: plugin-sync + orphans)
 *   2. Desde tu última visita  (digest of events since last ack)
 *   3. Tu turno  (human-gate queue, hero block)
 *   4. Pulso de la fábrica  (funnel + conversion metric)
 *   5. Construcción y cartera  (per-project cards + first-action card)
 *   6. Tu progreso  (honest gamification strip)
 *
 * Read-only invariant (architecture §1, REQ-18-002): no writes, no Claude calls.
 * All I/O is fs-based reads via `lib/**`. "use client" is NOT set here.
 *
 * Traceability:
 *   AC-18-006.1  / renders the dashboard; tabs reachable from layout's top nav
 *   AC-18-006.2  banner stack conditional (PluginSyncBanner + OrphansBanner)
 *   AC-18-006.3  read-only; no Claude
 *   AC-18-006.4  calm when healthy (al-día, no manufactured urgency)
 *   AC-18-006.5  six sections in order
 *   AC-18-006.6  fresh factory safe (al-día digest + first-action card; no crash)
 *
 * WO-18-006 — FRD-18 blueprint §3 (CMP-18-page, CMP-18-banners)
 */

import { OrphansBanner } from "@/app/_components/orphans-banner/orphans-banner";
import { PluginSyncBanner } from "@/app/_components/plugin-sync-banner/plugin-sync-banner";
import { type PulseResult, pulse } from "@/app/_lib/pulse";
import { type CardData, deriveCard } from "@/app/(dashboard)/_lib/card";
import { buildTurnQueue, type TurnItem } from "@/app/(dashboard)/_lib/turn";
import { Cartera } from "@/components/dashboard/Cartera/Cartera";
import { Progreso } from "@/components/dashboard/Progreso/Progreso";
import { TuTurno } from "@/components/dashboard/TuTurno/TuTurno";
import { Digest } from "@/components/modules/Digest/Digest";
import { Pulso } from "@/components/modules/Pulso/Pulso";
import {
  computeChains,
  computeStats,
  computeUniques,
  type Unique,
} from "@/lib/achievements/achievements";
import type { ReaderData } from "@/lib/achievements/stats";
import {
  FRESHNESS_THRESHOLD_MS,
  MEMORY_RAW_NOTES_THRESHOLD,
  MEMORY_STALE_DAYS_THRESHOLD,
} from "@/lib/constants";
import { type EventsSnapshot, readEvents } from "@/lib/events/events";
import {
  computeGuildLevel,
  deriveGuildOutcomes,
  type GuildLevel,
} from "@/lib/gamification/gamification";
import { type IdeaCard, readIdeas } from "@/lib/ideas/ideas";
import type { MemoryHealth } from "@/lib/memory/memory-health";
import { memoryHealth } from "@/lib/memory/memory-health";
import { activeProjects, type ProjectListItem, readPortfolio } from "@/lib/portfolio/portfolio";
import { readStatus, type StatusResult } from "@/lib/status/status";
import { listWorkOrders } from "@/lib/work-orders/work-orders";

// ---------------------------------------------------------------------------
// Page layout styles (CSS custom properties only — FRD-13)
// ---------------------------------------------------------------------------

const PAGE_STYLE: React.CSSProperties = {
  maxWidth: "72rem",
  margin: "0 auto",
  padding: "calc(var(--space-base) * 1.5) var(--space-base)",
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--space-base) * 1.5)",
};

// ---------------------------------------------------------------------------
// Pure derivation helpers (extracted to satisfy clean-code complexity limit)
// ---------------------------------------------------------------------------

/** Active phase set for in-construction freshness split (FRD-12). */
const IN_CONSTRUCTION_PHASES = new Set(["implementation", "architecture", "release"]);

/**
 * Count live vs stale in-construction builds (FRD-12 freshness, AC-18-003.2).
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

  return deriveCard({
    name: p.name,
    phase: p.stage ?? "product",
    version: statusData?.version ?? "v1",
    running: p.running ?? false,
    workOrdersDone: statusData?.workOrdersDone ?? 0,
    workOrdersTotal: statusData?.workOrdersTotal ?? 0,
    phaseStartedAt: undefined,
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
    .filter((p) => p.stage === "operation")
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

/** IF-18-pulse derivation from live data. */
function derivePulse(
  ideas: readonly IdeaCard[],
  projects: readonly ProjectListItem[],
  byProject: EventsSnapshot["byProject"],
  ownerWaiting: number,
  nowMs: number,
): PulseResult {
  const ideasAlive = ideas.filter((i) => i.status !== "discarded" && i.status !== "shipped").length;
  const ideasShipped = ideas.filter((i) => i.status === "shipped").length;
  const { live: inConstructionLive, stale: inConstructionStale } = countConstructionSplit(
    projects,
    byProject,
    nowMs,
  );
  return pulse({ ideasAlive, ideasShipped, inConstructionLive, inConstructionStale, ownerWaiting });
}

/** Gamification derivation: guild level, recent achievement, next milestone. */
function deriveGamification(
  readerData: ReaderData,
  statuses: readonly StatusResult[],
  eventsSnapshot: EventsSnapshot,
): {
  guildLevel: GuildLevel;
  recentAchievement: Unique | null;
  nextMilestone: ReturnType<typeof computeChains>[number] | null;
} {
  const guildOutcomes = deriveGuildOutcomes({ statuses, eventsSnapshot });
  const guildLevel = computeGuildLevel(guildOutcomes);
  const stats = computeStats(readerData);
  const uniques = computeUniques(readerData);
  const chains = computeChains(stats);
  const recentAchievement = mostRecentUnique(uniques);
  const nextMilestone =
    chains.filter((c) => c.nextTier !== null).sort((a, b) => b.pctToNext - a.pctToNext)[0] ?? null;
  return { guildLevel, recentAchievement, nextMilestone };
}

// ---------------------------------------------------------------------------
// HomePage — Server Component (default export, route `/`)
// ---------------------------------------------------------------------------

/**
 * Dashboard "Inicio" — the default landing route.
 *
 * Reads all lib layers server-side, delegates derivations to pure helpers, and
 * renders the six stacked sections. Never calls Claude; never writes to disk.
 */
export default function HomePage(): React.JSX.Element {
  const nowMs = Date.now();

  // ── 1. Read the live data layers (all read-only) ────────────────────────

  const eventsSnapshot = readEvents();
  const events = eventsSnapshot.events;
  const projects = activeProjects();
  const ideas = readIdeas();
  const memHealth = memoryHealth();
  const portfolioEntries = readPortfolio();
  const statuses = portfolioEntries.map((e) => readStatus(e.path));

  // ── 2. Derive sections ──────────────────────────────────────────────────

  const turnItems = deriveTurnItems(statuses, projects, ideas, memHealth);
  const pulseResult = derivePulse(
    ideas,
    projects,
    eventsSnapshot.byProject,
    turnItems.length,
    nowMs,
  );
  const cards = projects.map((p) => deriveProjectCard(p, eventsSnapshot.byProject, nowMs));

  const readerData: ReaderData = { ideas, statuses, eventsSnapshot };
  const { guildLevel, recentAchievement, nextMilestone } = deriveGamification(
    readerData,
    statuses,
    eventsSnapshot,
  );

  // ── 3. Render ───────────────────────────────────────────────────────────

  return (
    <main data-testid="dashboard-page" style={PAGE_STYLE}>
      {/* ── Health banners (conditional, client-side polled, AC-18-006.2) ── */}
      <div data-testid="dashboard-banners">
        {/* PluginSyncBanner: "use client"; renders null until drift confirmed (FRD-15) */}
        <PluginSyncBanner />
        {/* OrphansBanner: "use client"; renders null until candidates confirmed (FRD-16) */}
        <OrphansBanner />
      </div>

      {/* ── Section 1: Desde tu última visita (digest, AC-18-006.5) ── */}
      <Digest events={events} nowMs={nowMs} />

      {/* ── Section 2: Tu turno (human-gate queue, AC-18-006.4/5) ── */}
      <TuTurno items={turnItems} />

      {/* ── Section 3: Pulso de la fábrica (funnel + conversion, AC-18-006.5) ── */}
      <Pulso pulse={pulseResult} />

      {/* ── Section 4: Construcción y cartera (project cards, AC-18-006.5/6) ── */}
      <Cartera cards={cards} />

      {/* ── Section 5: Tu progreso (gamification strip, AC-18-006.5) ── */}
      <Progreso
        guildLevel={guildLevel}
        recentAchievement={recentAchievement}
        nextMilestone={nextMilestone}
      />
    </main>
  );
}
