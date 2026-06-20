/**
 * Board page — Server Component (CMP-02-board-view).
 *
 * WO-02-005: re-painted board surface.
 *
 * Reads all idea cards, resolves the project status for each in-pipeline card
 * via readStatus, and derives the board column for every card via deriveColumn.
 * The resulting `BoardCardEntry[]` is passed to `BoardClient` which handles all
 * interactive state: category filter, intake modal, card-detail slide-in, discard.
 *
 * Platform golden rule (architecture §1): read-only Server Component — never call Claude.
 * All I/O is synchronous fs reads via readIdeas / readStatus (lib/).
 *
 * Traceability:
 *   CMP-02-board-view → REQ-02-001, REQ-02-002, REQ-02-003, REQ-02-005,
 *                        REQ-02-006, REQ-02-007, REQ-02-008
 *   IF-01-readIdeas (docs/api.md WO-01-003)
 *   IF-01-readStatus (docs/api.md WO-01-005)
 *   IF-02-deriveColumn (lib/board.ts, WO-02-001)
 */

import path from "node:path";
import { BoardClient } from "@/app/board/_components/BoardClient/BoardClient";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/IdeaBoardView";
import { deriveColumn } from "@/lib/board/board";
import { resolveFactoryRoot } from "@/lib/config/config";
import { readIdeas } from "@/lib/ideas/ideas";
import { readStatus } from "@/lib/status/status";

/**
 * Board page (Server Component, Next.js App Router).
 *
 * Two-axis column derivation (WO-02-001):
 *   1. readIdeas() — all idea cards.
 *   2. For each in-pipeline card: readStatus(projectPath) — project phase.
 *   3. deriveColumn(card, status) → BoardColumn.
 *   4. Pass boardColumn into each card entry for BoardClient → IdeaBoardView.
 *
 * readStatus is fail-soft (never throws), so a missing project yields a
 * "documented" fallback column without breaking (AC-02-001.6).
 */
export default function BoardPage(): React.JSX.Element {
  // 1. Read all idea cards. Never throws (blueprint §3 tolerance).
  const rawCards = readIdeas();

  // 2 + 3. Resolve boardColumn for every card via two-axis deriveColumn.
  const factoryRoot = resolveFactoryRoot();

  const cards: BoardCardEntry[] = rawCards.map((card) => {
    // For in-pipeline cards: resolve project status to get the phase.
    let projectStatus = null;
    if (card.status === "in-pipeline" && card.project) {
      const projectPath = path.resolve(factoryRoot, "..", card.project);
      projectStatus = readStatus(projectPath);
    }

    const boardColumn = deriveColumn(card, projectStatus);

    // isRunning: derived from the project status (running: true in status.yaml).
    // Only meaningful for in-pipeline cards (AC-02-008.2).
    const isRunning =
      card.status === "in-pipeline" &&
      projectStatus !== null &&
      projectStatus.present &&
      projectStatus.status.running === true;

    return {
      slug: card.slug,
      title: card.title,
      status: card.status,
      projectType: card.projectType,
      returnType: card.returnType,
      score: card.score,
      project: card.project,
      body: card.body,
      isRunning,
      boardColumn,
    };
  });

  // Pass to BoardClient (the interactive "use client" wrapper).
  return <BoardClient cards={cards} />;
}
