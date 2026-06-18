/**
 * lib/gamification/agents.ts — Agent-level XP / rank scoring (FRD-09, WO-09-002).
 *
 * Split out of gamification.ts (clean-code file-size limit). The public symbols
 * here are re-exported from gamification.ts so the `@/lib/gamification/gamification`
 * surface stays identical.
 *
 * Platform golden rule (architecture §1): read-only derivation only. Pure functions.
 *
 * Interfaces implemented (blueprint §3):
 *   IF-09-agent-xp — computeAgentLevel(agentId, events): AgentLevelResult
 *
 * Traceability:
 *   AC-09-002.1 — computeAgentLevel returns { level, title, xp, next, pctToNext }
 *                 with title from Apprentice→Engineer→Senior→Architect
 *   AC-09-002.2 — XP accrues ONLY from that agent's completed WOs; non-WO events → 0 XP
 *   AC-09-002.3 — agent with no closed WOs returns honest zero state, no fake fill
 *   AC-09-002.4 — pure function; unknown agentId returns zero state, not throw
 */
import type { Event } from "../events/events";

/**
 * Agent rank titles in order: Apprentice → Engineer → Senior → Architect.
 *
 * Exported as a readonly string[] so tests can index by position and use
 * `.toHaveLength()` / iteration (per AC-09-002.1 test contract).
 *
 * Blueprint §3 IF-09-agent-xp. FRD-07 agent levels.
 */
export const AGENT_RANKS: readonly string[] = [
  "Apprentice",
  "Engineer",
  "Senior",
  "Architect",
] as const;

/**
 * XP thresholds for each rank transition (indexed by 0-based rank boundary).
 *
 * Meaning: a new rank is entered at exactly this XP total.
 *   AGENT_XP_THRESHOLDS[0] — XP needed to reach Engineer (rank 2)
 *   AGENT_XP_THRESHOLDS[1] — XP needed to reach Senior  (rank 3)
 *   AGENT_XP_THRESHOLDS[2] — XP needed to reach Architect (rank 4, max)
 *   AGENT_XP_THRESHOLDS[3] — Architect's own threshold (for `next` reference at max)
 *
 * Values are strictly ascending, all positive (AC-09-002.1 test contract).
 *
 * Agent XP rate: 1 XP per closed work order (honesty contract, simpler than guild
 * so thresholds are WO-count friendly; TDD plan §3 "share threshold math").
 */
export const AGENT_XP_THRESHOLDS: readonly [number, number, number, number] = [
  5, // [0] XP to reach Engineer (5 closed WOs)
  20, // [1] XP to reach Senior  (20 closed WOs)
  60, // [2] XP to reach Architect (60 closed WOs)
  100, // [3] XP cap: Architect bar is full (pctToNext=1) at this WO count
] as const;

/**
 * Result shape for computeAgentLevel (mirrors GuildLevel for consistency,
 * except pctToNext is [0, 1] — a fraction — rather than [0, 100]).
 *
 * AC-09-002.1: returns { level, title, xp, next, pctToNext }.
 */
export type AgentLevelResult = {
  /** Current rank index (1-based; level 1 = Apprentice). */
  readonly level: number;
  /** Human-readable rank title from AGENT_RANKS. */
  readonly title: string;
  /** Total accumulated XP (1 XP per closed WO for this agent). */
  readonly xp: number;
  /** XP required to reach the next rank (= max threshold when at Architect). */
  readonly next: number;
  /**
   * Fractional progress toward the next rank, [0, 1].
   * 0 when at a rank boundary (just leveled up or at zero).
   * 1 when at max rank (Architect, fully maxed).
   * Never artificially inflated (FRD-09 bar-stuck-at-80% forbidden pattern).
   */
  readonly pctToNext: number;
};

/** Agent XP per closed work order (1 XP — keeps thresholds WO-count-friendly). */
const AGENT_XP_PER_WO = 1;

/**
 * Internal rank breakpoints for computeAgentLevel.
 * Aligned with AGENT_XP_THRESHOLDS[0..2] (the actual rank boundaries).
 */
// Breakpoints mirror AGENT_XP_THRESHOLDS[0..2] — single source of truth is AGENT_XP_THRESHOLDS.
// Concrete values avoid non-null assertions in the array literal (biome noNonNullAssertion).
const AGENT_RANK_BREAKPOINTS: readonly number[] = [
  0, // Apprentice starts at 0
  5, // Engineer starts at 5 XP (= AGENT_XP_THRESHOLDS[0])
  20, // Senior starts at 20 XP (= AGENT_XP_THRESHOLDS[1])
  60, // Architect starts at 60 XP (= AGENT_XP_THRESHOLDS[2])
] as const;

/**
 * Compute an agent's current level, title, XP, next threshold and progress bar
 * from the event stream (WO-09-002, IF-09-agent-xp).
 *
 * Pure function: no I/O, no clock, no engagement bonus, no mutation.
 * Same (agentId, events) always produces the same result.
 *
 * XP contract (AC-09-002.2 — honesty constraint):
 *   +1 XP: event where `agent === agentId` AND `workOrder` is non-empty AND `status === "ok"`.
 *   +0 XP: activity events (read, write, edit, message, start, end, handoff, blocked, review,
 *           test_ok without workOrder, any event without the agent's id, fail events).
 *
 * Honest zero state (AC-09-002.3):
 *   No closed WOs → xp = 0, pctToNext = 0, level = 1, title = "Apprentice".
 *   Bar is NEVER artificially inflated (FRD-09 forbidden pattern).
 *
 * Unknown/empty agentId (AC-09-002.4): returns zero state, never throws.
 *
 * @param agentId - The agent role string to filter by (e.g. "backend-dev").
 * @param events  - The event stream to scan (never mutated).
 */
export function computeAgentLevel(agentId: string, events: readonly Event[]): AgentLevelResult {
  // ── XP derivation: only closed WOs for this agent ─────────────────────────
  const xp = events.reduce<number>((acc, ev) => {
    if (
      ev.agent === agentId &&
      typeof ev.workOrder === "string" &&
      ev.workOrder.length > 0 &&
      ev.status === "ok"
    ) {
      return acc + AGENT_XP_PER_WO;
    }
    return acc;
  }, 0);

  // ── Rank resolution (walks breakpoints ascending, keeps last match) ────────
  let rankIndex = 0;
  for (let i = 0; i < AGENT_RANK_BREAKPOINTS.length; i++) {
    const bp = AGENT_RANK_BREAKPOINTS[i];
    if (bp !== undefined && xp >= bp) {
      rankIndex = i;
    }
  }

  const level = rankIndex + 1; // 1-based
  // biome-ignore lint/style/noNonNullAssertion: rankIndex is always in AGENT_RANKS bounds
  const title = AGENT_RANKS[rankIndex]!;
  const isMaxRank = rankIndex === AGENT_RANKS.length - 1;

  // ── Progress bar (pctToNext as fraction [0, 1]) ────────────────────────────
  let pctToNext: number;
  let next: number;

  if (isMaxRank) {
    // At Architect: bar is full (1), next = Architect's own threshold
    pctToNext = 1;
    // biome-ignore lint/style/noNonNullAssertion: AGENT_RANK_BREAKPOINTS[3] = max threshold
    next = AGENT_RANK_BREAKPOINTS[rankIndex]!;
  } else {
    // biome-ignore lint/style/noNonNullAssertion: not at max rank, next breakpoint exists
    const currentThreshold = AGENT_RANK_BREAKPOINTS[rankIndex]!;
    // biome-ignore lint/style/noNonNullAssertion: not at max rank, next breakpoint exists
    const nextThreshold = AGENT_RANK_BREAKPOINTS[rankIndex + 1]!;
    next = nextThreshold;
    const span = nextThreshold - currentThreshold;
    const progress = xp - currentThreshold;
    // If exactly at a boundary (progress === 0), pctToNext = 0 (just leveled up).
    pctToNext = span > 0 ? Math.min(1, progress / span) : 0;
  }

  return { level, title, xp, next, pctToNext };
}
