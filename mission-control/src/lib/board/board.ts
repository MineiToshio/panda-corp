/**
 * WO-02-001 — `deriveColumn` two-axis logic (CMP-02-board-derive, IF-02-deriveColumn)
 *
 * Derives the kanban column for an idea card from two axes:
 *   1. The card's `status` field (from IdeaCard, FRD-01).
 *   2. The linked project's `phase` field (from StatusResult, FRD-01 readStatus).
 *
 * Pure function: no fs, no writes, no network, no Claude calls, no side effects.
 * Never throws (AC-02-001.6 "without breaking").
 *
 * Mapping table (blueprint §2, REQ-02-001):
 *
 *   Card status      | Project phase                        | → Column
 *   -----------------|--------------------------------------|----------
 *   discovered       | —                                    | discovered
 *   recommended      | —                                    | discovered (+ badge)
 *   in-pipeline      | product                              | documented
 *   in-pipeline      | design                               | design
 *   in-pipeline      | architecture                         | architecture
 *   in-pipeline      | implementation                       | building
 *   in-pipeline      | release                              | building
 *   in-pipeline      | operation                            | shipped
 *   in-pipeline      | missing / absent / malformed / undef | documented (fallback)
 *   shipped          | —                                    | shipped
 *   discarded        | —                                    | discarded
 *
 * Traceability:
 *   AC-02-001.1 — two-axis derivation, not card status alone
 *   AC-02-001.2 — discovered/recommended → discovered
 *   AC-02-001.3 — in-pipeline phase mapping
 *   AC-02-001.4 — terminal statuses (shipped/discarded)
 *   AC-02-001.5 — design/architecture/building MUST NOT be card statuses
 *   AC-02-001.6 — fallback to documented, never throw
 *
 * Regression anchors:
 *   B1' (2026-06-16): readStatus rejects NaN/invalid phase → phase is undefined →
 *     deriveColumn falls back to documented (no re-validation needed here).
 *   I3  (2026-06-16): array-shaped phase rejected upstream → phase is undefined →
 *     same fallback path applies.
 */

import type { IdeaCard } from "../ideas/ideas";
import type { StatusResult } from "../status/status";

// Re-export types so consumers can import from one place (blueprint §1 component table).
export type { IdeaCard } from "../ideas/ideas";
export type { StatusResult } from "../status/status";

export type BoardColumn =
  | "discovered"
  | "documented"
  | "design"
  | "architecture"
  | "building"
  | "shipped"
  | "discarded";

/**
 * Derive the kanban column for an idea card.
 *
 * @param card          - The parsed idea card (from `readIdeas`).
 * @param projectStatus - The parsed project status (from `readStatus`), or `null`
 *                        when no project path was resolved (missing `project` pointer on card,
 *                        or the project directory was not found).
 * @returns The `BoardColumn` the card belongs in. Never throws.
 */
export function deriveColumn(card: IdeaCard, projectStatus: StatusResult | null): BoardColumn {
  const { status } = card;

  // --- Pre-pipeline and terminal statuses: the project axis is irrelevant ---
  if (status === "discovered" || status === "recommended") {
    return "discovered";
  }

  if (status === "shipped") {
    return "shipped";
  }

  if (status === "discarded") {
    return "discarded";
  }

  // --- in-pipeline: derive from the project phase ---
  // (AC-02-001.5: design/architecture/building can never be a card status;
  //  any other unexpected string also falls through to this block safely.)
  if (status === "in-pipeline") {
    return deriveFromPhase(projectStatus);
  }

  // --- Invalid card status (AC-02-001.5 defensive path) ---
  // Typed inputs from readIdeas are always valid; this guard handles runtime
  // bypass only (e.g. "design" cast as IdeaStatus in tests).
  // Safe default: "discovered" — never throws, never returns building/architecture
  // for an unknown card status (test assertions in AC-02-001.5 expect this).
  return "discovered";
}

/**
 * Resolve the column from the project's StatusResult when a card is `in-pipeline`.
 * Falls back to `documented` for any case where the phase is missing or unresolvable
 * (AC-02-001.6).
 */
function deriveFromPhase(projectStatus: StatusResult | null): BoardColumn {
  // null → no project was resolved
  if (projectStatus === null) {
    return "documented";
  }

  // present: false → status.yaml absent (project dir or file missing)
  if (!projectStatus.present) {
    return "documented";
  }

  // present: true — extract phase (may be undefined if malformed or missing key)
  const phase = projectStatus.status?.phase;

  // undefined phase → malformed YAML, missing key, or upstream rejection (B1', I3)
  if (phase === undefined) {
    return "documented";
  }

  // Phase mapping (blueprint §2, AC-02-001.3)
  switch (phase) {
    case "product":
      return "documented";
    case "design":
      return "design";
    case "architecture":
      return "architecture";
    case "implementation":
      return "building";
    case "release":
      return "building";
    case "operation":
      return "shipped";
    default: {
      // Exhaustive: TypeScript knows phase is Phase (a closed union), but a defensive
      // default ensures the function never throws if the union is ever extended.
      const _exhaustive: never = phase;
      void _exhaustive;
      return "documented";
    }
  }
}
