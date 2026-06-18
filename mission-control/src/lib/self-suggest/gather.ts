/**
 * lib/self-suggest/gather.ts — `gatherSuggestionsInput()` (FRD-17, REQ-17-004).
 *
 * The wiring layer between the shipped lib/ readers and the pure
 * `computeSuggestions()` derivation. Reads the data Mission Control *already*
 * reads — board columns, the portfolio, the event tail, the skill/agent catalog,
 * the decision registry, the per-project inbox decision lines and the lesson
 * corpus — and assembles them into a single `SuggestionsInput`.
 *
 * Why this exists: `computeSuggestions` is a PURE function (no I/O, no Claude) so
 * it can be unit-tested in isolation. This module is the one place that performs
 * the reads and adapts each reader's shape into the input bag. Without it the
 * page would have to hardcode empty inputs and five of the six derivations
 * (bottleneck / velocity / unused-capability / policy-friction / launch-review)
 * would be dead production code.
 *
 * Read-only / no Claude (architecture §7): every reader is a fail-soft fs read.
 * A missing factory, portfolio, event log or project leaves that source empty
 * without throwing — the still-valid subset is returned.
 *
 * Traceability:
 *   REQ-17-004 → computeSuggestions wiring → CMP-17-page
 *   Consumes: lib/ideas, lib/board, lib/status, lib/portfolio, lib/events,
 *             lib/reference, lib/registry, lib/docs (decisions), lib/memory.
 */

import path from "node:path";
import { deriveColumn } from "@/lib/board/board";
import { resolveFactoryRoot } from "@/lib/config/config";
import { readDecisions } from "@/lib/docs/activity";
import { readEvents } from "@/lib/events/events";
import { readIdeas } from "@/lib/ideas/ideas";
import { readLessons } from "@/lib/memory/memory";
import { activeProjects, readPortfolio } from "@/lib/portfolio/portfolio";
import { readAgents, readSkills } from "@/lib/reference/reference";
import { readDecisionRules } from "@/lib/registry/registry";
import { readStatus } from "@/lib/status/status";
import type {
  CapabilityRef,
  SuggestDecisionRule,
  SuggestEvent,
  SuggestionsInput,
  SuggestPortfolioItem,
} from "./self-suggest";

// ---------------------------------------------------------------------------
// Board column counts (bottleneck derivation)
// ---------------------------------------------------------------------------

/**
 * Derive the per-column idea counts the way the board page does: read every
 * card, resolve the project status for in-pipeline cards, and bucket by the
 * derived `BoardColumn`. Fail-soft — a missing factory yields `{}`.
 */
function deriveBoardColumnCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  let cards: ReturnType<typeof readIdeas>;
  try {
    cards = readIdeas();
  } catch {
    return counts;
  }

  const factoryRoot = resolveFactoryRoot();
  for (const card of cards) {
    let projectStatus = null;
    if (card.status === "in-pipeline" && card.project) {
      const projectPath = path.resolve(factoryRoot, "..", card.project);
      projectStatus = readStatus(projectPath);
    }
    const column = deriveColumn(card, projectStatus);
    counts[column] = (counts[column] ?? 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Portfolio items (velocity + launch-review derivations)
// ---------------------------------------------------------------------------

/**
 * Map active portfolio rows into the minimal shape the derivations need.
 * `phaseStartedAt` uses the status file's `updatedAt` (the last time the phase
 * machine wrote the project) as the available proxy for when the current phase
 * began; absent/malformed status → null (excluded from the velocity median).
 */
function derivePortfolioItems(): SuggestPortfolioItem[] {
  let items: ReturnType<typeof activeProjects>;
  try {
    items = activeProjects();
  } catch {
    return [];
  }

  return items.map((item) => {
    const phaseStartedAt =
      item.status.present && item.status.status !== null
        ? (item.status.status.updatedAt ?? null)
        : null;
    return {
      name: item.name,
      path: item.path,
      stage: item.stage,
      phaseStartedAt,
    };
  });
}

// ---------------------------------------------------------------------------
// Event tail (unused-capability derivation)
// ---------------------------------------------------------------------------

/** The capped event tail, narrowed to the fields the derivations consume. */
function deriveEvents(): SuggestEvent[] {
  let snapshot: ReturnType<typeof readEvents>;
  try {
    snapshot = readEvents();
  } catch {
    return [];
  }
  return snapshot.events.map((ev) => ({
    event: ev.event,
    at: ev.at,
    ...(ev.agent !== undefined ? { agent: ev.agent } : {}),
    ...(ev.session !== undefined ? { session: ev.session } : {}),
    ...(ev.project !== undefined ? { project: ev.project } : {}),
  }));
}

// ---------------------------------------------------------------------------
// Capabilities (unused-capability derivation)
// ---------------------------------------------------------------------------

/** Skills (`slug`) + agents (`id`) flattened into the `{ id, kind }` catalog. */
function deriveCapabilities(): CapabilityRef[] {
  const capabilities: CapabilityRef[] = [];
  try {
    for (const skill of readSkills()) {
      capabilities.push({ id: skill.slug, kind: "skill" });
    }
  } catch {
    /* fail-soft: missing plugin dir → no skills */
  }
  try {
    for (const agent of readAgents()) {
      capabilities.push({ id: agent.id, kind: "agent" });
    }
  } catch {
    /* fail-soft: missing agents dir → no agents */
  }
  return capabilities;
}

// ---------------------------------------------------------------------------
// Decision rules (policy-friction derivation)
// ---------------------------------------------------------------------------

/** The decision registry rules, already shaped for the policy-friction scan. */
function deriveDecisionRules(): SuggestDecisionRule[] {
  try {
    return readDecisionRules().map((rule) => ({
      id: rule.id,
      patron: rule.patron,
      default: rule.default,
      requiereHumano: rule.requiereHumano,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Inbox decision lines (policy-friction derivation)
// ---------------------------------------------------------------------------

/**
 * Flatten every active project's `.pandacorp/inbox/decisions.md` into plain
 * lines (title + recommendation) the policy-friction scan can search for rule
 * ids. Iterates the portfolio rows, resolves each project path and reads its
 * decisions; fail-soft per project.
 */
function deriveInboxDecisionLines(): string[] {
  const lines: string[] = [];
  let entries: ReturnType<typeof readPortfolio>;
  try {
    entries = readPortfolio();
  } catch {
    return lines;
  }

  const factoryRoot = resolveFactoryRoot();
  for (const entry of entries) {
    const projectPath = path.isAbsolute(entry.path)
      ? entry.path
      : path.join(factoryRoot, entry.path);
    let decisions: ReturnType<typeof readDecisions>;
    try {
      decisions = readDecisions(projectPath);
    } catch {
      continue;
    }
    for (const decision of decisions) {
      lines.push(decision.title);
      if (decision.recommendation !== undefined) {
        lines.push(decision.recommendation);
      }
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assemble the full `SuggestionsInput` from the live lib/ readers.
 *
 * Every source is read fail-soft: a missing factory, portfolio, event log,
 * plugin catalog, registry or project leaves that field empty without throwing,
 * so a fresh factory still returns a valid (mostly-empty) input
 * (AC-17-003.7). The caller passes the result straight to `computeSuggestions`.
 *
 * @returns A populated `SuggestionsInput`. Never throws.
 */
export function gatherSuggestionsInput(): SuggestionsInput {
  return {
    boardColumnCounts: deriveBoardColumnCounts(),
    portfolioItems: derivePortfolioItems(),
    events: deriveEvents(),
    capabilities: deriveCapabilities(),
    decisionRules: deriveDecisionRules(),
    inboxDecisionLines: deriveInboxDecisionLines(),
    lessons: safeReadLessons(),
  };
}

/** Lesson corpus, fail-soft (missing factory/memory → []). */
function safeReadLessons(): SuggestionsInput["lessons"] {
  try {
    return readLessons();
  } catch {
    return [];
  }
}
