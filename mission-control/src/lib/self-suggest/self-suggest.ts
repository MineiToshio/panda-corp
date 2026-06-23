/**
 * lib/self-suggest.ts — `computeSuggestions()` (WO-17-003, FRD-17, IF-17-suggest)
 *
 * Pure derivation of six self-suggestion kinds from already-read reader data.
 * NO Claude calls, NO network, NO filesystem I/O — pure function over injected inputs
 * (architecture §7, AC-17-003.3).
 *
 * The six kinds:
 *   1. bottleneck      — ≥ N ideas in the same board column
 *   2. velocity        — a phase running ≫ portfolio median
 *   3. unused-capability — a skill/agent with zero recorded usage in the event tail
 *   4. policy-friction — a requiere_humano:false rule recurring in inbox/decisions.md
 *   5. recurring-lesson — a lesson seen in ≥2 projects → propose promotion
 *   6. launch-review   — a shipped project past the age threshold
 *
 * All thresholds in `lib/constants.ts` (AC-17-003.6). Missing inputs return the
 * still-valid subset and never throw (AC-17-003.7 fresh-factory tolerant).
 *
 * Traceability:
 *   IF-17-suggest → REQ-17-004, AC-17-003.1..7
 *   blueprint §4 — local, no Claude derivation table
 *   architecture §7 — read-only, no Claude
 */

import {
  BOTTLENECK_THRESHOLD,
  LAUNCH_REVIEW_DAYS,
  SELF_SUGGEST_EVENT_CAP,
  VELOCITY_FACTOR,
} from "../constants";
import type { Lesson } from "../memory/memory";

// ---------------------------------------------------------------------------
// Public types (blueprint §3 IF-17-suggest)
// ---------------------------------------------------------------------------

type SuggestionKind =
  | "bottleneck"
  | "velocity"
  | "unused-capability"
  | "policy-friction"
  | "recurring-lesson"
  | "launch-review";

export type Suggestion = {
  kind: SuggestionKind;
  /** Spanish, change-framed (guild theme) */
  title: string;
  /** The metric / LESSON id / project name + data point that triggered this */
  evidence: string;
  /** Exact /pandacorp:* command to act (AC-17-003.2) */
  command: string;
  /** Project slug / lesson id / rule id for navigation (optional) */
  target?: string;
  severity: "info" | "nudge";
};

// ---------------------------------------------------------------------------
// Input types (pure data bag — no readers called internally)
// ---------------------------------------------------------------------------

/** A skill or agent capability entry from lib/reference. */
export type CapabilityRef = {
  id: string;
  kind: "skill" | "agent";
};

/** A minimal event shape needed for the derivations. */
export type SuggestEvent = {
  event: string;
  at: string;
  agent?: string;
  session?: string;
  project?: string;
};

/** A minimal portfolio item shape needed for the derivations. */
export type SuggestPortfolioItem = {
  name: string;
  path: string;
  /** Phase of the project (e.g. "release", "implementation"). */
  stage?: string;
  /** ISO 8601 date when the project entered the current phase; null if unknown. */
  phaseStartedAt: string | null;
};

/** A minimal decision rule shape from lib/registry. */
export type SuggestDecisionRule = {
  id: string;
  patron: string;
  default: string;
  requiereHumano: boolean;
};

/**
 * All inputs needed by `computeSuggestions`.
 *
 * Each derivation only reads the fields it needs; unused fields can be
 * left empty without triggering unrelated suggestions (AC-17-003.7).
 */
export type SuggestionsInput = {
  /** Count of ideas per board column (from lib/board derivation). */
  boardColumnCounts: Record<string, number>;
  /** Active portfolio items enriched with phase/age data. */
  portfolioItems: SuggestPortfolioItem[];
  /**
   * Capped event tail for velocity/unused-capability.
   * Callers MUST pass ≤ SELF_SUGGEST_EVENT_CAP events (AC-17-003.4).
   * computeSuggestions enforces the cap internally as a defensive measure.
   */
  events: SuggestEvent[];
  /** Skills and agents catalog from lib/reference. */
  capabilities: CapabilityRef[];
  /** Decision rules from lib/registry. */
  decisionRules: SuggestDecisionRule[];
  /** Lines from .pandacorp/inbox/decisions.md across all projects. */
  inboxDecisionLines: string[];
  /** All lessons from lib/memory.readLessons(). */
  lessons: Lesson[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse an ISO date string into days-ago, returns null when invalid. */
function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  const diffMs = Date.now() - parsed;
  return diffMs / (1000 * 60 * 60 * 24);
}

/**
 * Median of a non-empty array of finite numbers.
 * Returns null for an empty array.
 */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? null;
  }
  const lo = sorted[mid - 1];
  const hi = sorted[mid];
  if (lo === undefined || hi === undefined) return null;
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// Derivation 1: bottleneck
//
// Rule: ≥ BOTTLENECK_THRESHOLD ideas in the same board column.
// Command: /pandacorp:recommend (bring the best candidates forward)
// ---------------------------------------------------------------------------

function deriveBottleneck(boardColumnCounts: Record<string, number>): Suggestion[] {
  const suggestions: Suggestion[] = [];
  for (const [column, count] of Object.entries(boardColumnCounts)) {
    if (!Number.isFinite(count) || count < BOTTLENECK_THRESHOLD) continue;
    suggestions.push({
      kind: "bottleneck",
      title: `Cuello de botella en la columna "${column}" (${count} ideas)`,
      evidence: `Columna "${column}": ${count} ideas acumuladas (umbral: ${BOTTLENECK_THRESHOLD})`,
      command: "/pandacorp:recommend",
      target: column,
      severity: "nudge",
    });
  }
  return suggestions;
}

// ---------------------------------------------------------------------------
// Derivation 2: velocity
//
// Rule: a project's phase age is > VELOCITY_FACTOR × portfolio_median.
// Command: /pandacorp:implement (or context-appropriate command)
// ---------------------------------------------------------------------------

function deriveVelocity(portfolioItems: SuggestPortfolioItem[]): Suggestion[] {
  // Collect items that have a measurable phase age (null phaseStartedAt → excluded)
  const itemsWithAge = portfolioItems
    .map((item) => ({ item, age: daysAgo(item.phaseStartedAt) }))
    .filter((x): x is { item: SuggestPortfolioItem; age: number } => x.age !== null);

  if (itemsWithAge.length < 2) {
    // Need at least 2 data points to compute a meaningful median comparison.
    return [];
  }

  const ages = itemsWithAge.map((x) => x.age);
  const med = median(ages);
  if (med === null || med === 0) return [];

  const threshold = med * VELOCITY_FACTOR;

  const suggestions: Suggestion[] = [];
  for (const { item, age } of itemsWithAge) {
    if (age > threshold) {
      suggestions.push({
        kind: "velocity",
        title: `"${item.name}" lleva ${Math.round(age)} días en esta fase (mediana: ${Math.round(med)} días)`,
        evidence: `${item.name}: ${Math.round(age)} días en fase "${item.stage ?? "desconocida"}" (mediana del portafolio: ${Math.round(med)} días, factor: ×${VELOCITY_FACTOR})`,
        command: "/pandacorp:implement",
        target: item.name,
        severity: "nudge",
      });
    }
  }
  return suggestions;
}

// ---------------------------------------------------------------------------
// Derivation 3: unused-capability
//
// Rule: a skill/agent from lib/reference has zero matching agent/session hits
// in the capped event tail.
// Command: /pandacorp:<skill-id> (vary per capability)
// ---------------------------------------------------------------------------

function deriveUnusedCapability(
  capabilities: CapabilityRef[],
  rawEvents: SuggestEvent[],
): Suggestion[] {
  // Enforce the cap (AC-17-003.4): take only the last SELF_SUGGEST_EVENT_CAP events.
  const events = rawEvents.slice(-SELF_SUGGEST_EVENT_CAP);

  // Build the set of capability ids seen in the event tail.
  const seenIds = new Set<string>();
  for (const ev of events) {
    if (ev.agent !== undefined) seenIds.add(ev.agent);
    if (ev.session !== undefined) seenIds.add(ev.session);
  }

  const suggestions: Suggestion[] = [];
  for (const cap of capabilities) {
    if (seenIds.has(cap.id)) continue;
    suggestions.push({
      kind: "unused-capability",
      title: `La ${cap.kind === "agent" ? "agente" : "habilidad"} "${cap.id}" no tiene uso registrado`,
      evidence: `${cap.kind === "agent" ? "Agente" : "Habilidad"} "${cap.id}": sin eventos de uso en las últimas ${events.length} entradas del registro`,
      command: `/pandacorp:${cap.id}`,
      target: cap.id,
      severity: "info",
    });
  }
  return suggestions;
}

// ---------------------------------------------------------------------------
// Derivation 4: policy-friction
//
// Rule: a requiere_humano:false decision rule appears in ≥2 inbox decision lines.
// Command: /pandacorp:decide
// ---------------------------------------------------------------------------

function derivePolicyFriction(
  decisionRules: SuggestDecisionRule[],
  inboxDecisionLines: string[],
): Suggestion[] {
  // Only consider rules where requiereHumano is false (these should be auto-resolved,
  // but keep recurring in the inbox → friction signal).
  const autoRules = decisionRules.filter((r) => !r.requiereHumano);

  const suggestions: Suggestion[] = [];
  for (const rule of autoRules) {
    // Count inbox lines that mention this rule's id.
    const occurrences = inboxDecisionLines.filter((line) => line.includes(rule.id)).length;
    if (occurrences < 2) continue;
    suggestions.push({
      kind: "policy-friction",
      title: `La regla "${rule.id}" aparece repetidamente en la bandeja de decisiones`,
      evidence: `${rule.id} ("${rule.patron}"): ${occurrences} apariciones en inbox (requiere_humano:false → debería ser automático)`,
      command: "/pandacorp:decide",
      target: rule.id,
      severity: "nudge",
    });
  }
  return suggestions;
}

// ---------------------------------------------------------------------------
// Derivation 5: recurring-lesson
//
// Rule: a lesson with projects.length >= 2 (anchored to LESSON-0001, AC-17-003.5).
// Command: /pandacorp:learn (promote to a standard/rule/skill)
// ---------------------------------------------------------------------------

function deriveRecurringLesson(lessons: Lesson[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  for (const lesson of lessons) {
    // AC-17-003.5: fire ONLY when projects.length >= 2.
    // projects.length is always a genuine Array.prototype.length (never NaN).
    if (lesson.projects.length < 2) continue;
    suggestions.push({
      kind: "recurring-lesson",
      title: `"${lesson.id}" aparece en ${lesson.projects.length} proyectos — proponer promoción`,
      evidence: `${lesson.id} (${lesson.domain}): observado en ${lesson.projects.length} proyectos (${lesson.projects.join(", ")})`,
      command: "/pandacorp:learn",
      target: lesson.id,
      severity: "nudge",
    });
  }
  return suggestions;
}

// ---------------------------------------------------------------------------
// Derivation 6: launch-review
//
// Rule: a launched ("release") project older than LAUNCH_REVIEW_DAYS days.
// Command: /pandacorp:review-launch (DR-043)
// ---------------------------------------------------------------------------

function deriveLaunchReview(portfolioItems: SuggestPortfolioItem[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  for (const item of portfolioItems) {
    if (item.stage !== "release") continue;
    const age = daysAgo(item.phaseStartedAt);
    if (age === null || !Number.isFinite(age)) continue;
    if (age <= LAUNCH_REVIEW_DAYS) continue;
    suggestions.push({
      kind: "launch-review",
      title: `"${item.name}" lleva ${Math.round(age)} días en producción — revisar métricas`,
      evidence: `${item.name}: ${Math.round(age)} días en operación (umbral: ${LAUNCH_REVIEW_DAYS} días, DR-043)`,
      command: "/pandacorp:review-launch",
      target: item.name,
      severity: "nudge",
    });
  }
  return suggestions;
}

// ---------------------------------------------------------------------------
// Public API: computeSuggestions
// ---------------------------------------------------------------------------

/**
 * Derive all six self-suggestion kinds from the provided data inputs.
 *
 * Pure function: NO filesystem access, NO Claude calls, NO network (AC-17-003.3).
 * Each derivation independently runs over its subset of the input; a missing or
 * empty input for a derivation produces zero suggestions for that kind without
 * affecting the others (AC-17-003.7 fresh-factory tolerant).
 *
 * @param input - Pre-read data from the relevant lib/ readers.
 * @returns Array of `Suggestion` objects (the still-valid subset). Never throws.
 */
export function computeSuggestions(input: SuggestionsInput): Suggestion[] {
  const {
    boardColumnCounts,
    portfolioItems,
    events,
    capabilities,
    decisionRules,
    inboxDecisionLines,
    lessons,
  } = input;

  try {
    return [
      ...deriveBottleneck(boardColumnCounts),
      ...deriveVelocity(portfolioItems),
      ...deriveUnusedCapability(capabilities, events),
      ...derivePolicyFriction(decisionRules, inboxDecisionLines),
      ...deriveRecurringLesson(lessons),
      ...deriveLaunchReview(portfolioItems),
    ];
  } catch {
    // Last-resort guard: no derivation failure should propagate to the caller
    // (AC-17-003.7 fresh-factory tolerant — never throws).
    return [];
  }
}
