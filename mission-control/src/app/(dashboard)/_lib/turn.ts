/**
 * WO-18-002 — `IF-18-turn` human-gate queue derivation
 *
 * Builds the "Tu turno" queue: ONLY genuine human gates, urgency-ordered,
 * each with its copyable /pandacorp:* command and a navigable href.
 *
 * Sources (FRD-18 §Tu turno, blueprint §3 IF-18-turn):
 *   1. pending-decisions — status.pendingDecisions > 0
 *   2. review-launch     — shipped projects awaiting /pandacorp:review-launch (DR-043)
 *   3. memory-nudge      — FRD-17 memoryHealth backlog nudge
 *   4. undiscovered-ideas — ideas in "Descubierta" awaiting prioritization
 *
 * EXCLUDES (AC-18-002.2):
 *   - Running builds (routine progress, not owner gates)
 *   - Auto-retried failed work orders (handled by the build engine)
 *   - advance_pending (DR-032) — Board signal, not a human gate
 *
 * Pure function: no fs, no Claude, no network, no side effects. Never throws.
 * All data is injected via TurnInput.
 *
 * Traceability:
 *   IF-18-turn → REQ-18-010, REQ-18-011, REQ-18-012
 *   AC-18-002.1 / AC-18-002.2 / AC-18-002.3 / AC-18-002.4 / AC-18-002.5
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single item in the "Tu turno" human-gate queue.
 * The discriminant `kind` is one of the four genuine gate sources PLUS three
 * explicitly-forbidden routine-progress kinds (never emitted, but typed to
 * enable exhaustive checks in tests).
 */
export type TurnItemKind =
  | "pending-decisions"
  | "review-launch"
  | "memory-nudge"
  | "undiscovered-ideas"
  // These NEVER appear in the queue (AC-18-002.2 — excluded routine progress):
  | "running-build"
  | "advance-pending"
  | "failed-wo";

export type TurnItem = {
  /** Discriminant for the gate source. */
  kind: TurnItemKind;
  /** Spanish label shown in the UI. */
  label: string;
  /** The exact /pandacorp:* command to copy (AC-18-002.1). */
  command: string;
  /** Navigable href for the item row (AC-18-002.4). Starts with '/'. */
  href: string;
};

/**
 * Input bag for buildTurnQueue — pure data, no fs or live reads.
 * The caller (a Server Component) reads the live libs and injects here.
 */
export type TurnInput = {
  /** Count from status.pending_decisions. 0 → no item. */
  pendingDecisions: number;
  /**
   * Non-empty lines from .pandacorp/inbox/decisions.md.
   * Used for richer label construction (future). Currently not gating by kind —
   * the count in pendingDecisions is authoritative (blueprint §3 IF-18-turn).
   */
  inboxDecisionLines: string[];
  /**
   * Shipped projects awaiting /pandacorp:review-launch (DR-043).
   * One item per project entry.
   */
  shippedAwaitingReview: Array<{ name: string; path: string }>;
  /**
   * True when the memory backlog nudge should fire (FRD-17 memoryHealth).
   * Computed upstream: rawNotes >= threshold OR staleDays >= threshold.
   */
  memoryNeedsAttention: boolean;
  /** Count of ideas in "Descubierta" status awaiting prioritization. 0 → no item. */
  undiscoveredIdeas: number;
};

// ---------------------------------------------------------------------------
// Urgency order (AC-18-002.3)
// Higher priority = lower number = appears first in the sorted output.
// ---------------------------------------------------------------------------

const URGENCY: Record<
  Exclude<TurnItemKind, "running-build" | "advance-pending" | "failed-wo">,
  number
> = {
  "pending-decisions": 10,
  "review-launch": 20,
  "memory-nudge": 30,
  "undiscovered-ideas": 40,
};

// ---------------------------------------------------------------------------
// buildTurnQueue — pure derivation (IF-18-turn)
// ---------------------------------------------------------------------------

/**
 * Build the urgency-ordered human-gate queue from the injected TurnInput.
 *
 * Returns [] when nothing needs the owner (al-día state — AC-18-002.5).
 * Never throws.
 *
 * @param input - Pre-computed gate signals injected by the Server Component.
 * @returns Ordered array of TurnItem (highest urgency first). Never mutates input.
 */
export function buildTurnQueue(input: TurnInput): TurnItem[] {
  const items: TurnItem[] = [];

  // 1. Pending decisions (highest urgency: owner must decide before builds can proceed)
  if (input.pendingDecisions > 0) {
    const count = input.pendingDecisions;
    const plural = count === 1 ? "decisión pendiente" : "decisiones pendientes";
    items.push({
      kind: "pending-decisions",
      label: `${count} ${plural}`,
      command: "/pandacorp:decide",
      href: "/configuration",
    });
  }

  // 2. Shipped projects awaiting /pandacorp:review-launch (DR-043)
  for (const project of input.shippedAwaitingReview) {
    items.push({
      kind: "review-launch",
      label: `Revisar lanzamiento: ${project.name}`,
      command: "/pandacorp:review-launch",
      href: `/projects/${project.name}`,
    });
  }

  // 3. Memory backlog nudge (FRD-17 memoryHealth)
  if (input.memoryNeedsAttention) {
    items.push({
      kind: "memory-nudge",
      label: "Cosechar memoria del taller",
      command: "/pandacorp:memory",
      href: "/proposals",
    });
  }

  // 4. Undiscovered ideas awaiting prioritization
  if (input.undiscoveredIdeas > 0) {
    const count = input.undiscoveredIdeas;
    const plural = count === 1 ? "idea sin priorizar" : "ideas sin priorizar";
    items.push({
      kind: "undiscovered-ideas",
      label: `${count} ${plural}`,
      command: "/pandacorp:recommend",
      href: "/board",
    });
  }

  // Sort by urgency (stable: items of the same kind retain insertion order)
  return [...items].sort((a, b) => {
    const ua = URGENCY[a.kind as keyof typeof URGENCY] ?? 99;
    const ub = URGENCY[b.kind as keyof typeof URGENCY] ?? 99;
    return ua - ub;
  });
}
