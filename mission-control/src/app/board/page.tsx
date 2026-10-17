/**
 * Board page — Server Component (CMP-02-board-view).
 *
 * WO-02-005: full two-axis board — reads all idea cards, resolves the project
 * status for each project-linked card via readStatus, and derives the board column
 * for every card via deriveColumn. The resulting `boardColumn` is passed to
 * BoardShell (client) which wires the interactive layer: category filter,
 * intake modal, card selection → CardDetail, discard action.
 *
 * Platform golden rule (architecture §1): read-only, never call Claude.
 * All I/O is synchronous fs reads via readIdeas / readStatus (lib/).
 *
 * Traceability:
 *   CMP-02-board-view → REQ-02-001, REQ-02-002, REQ-02-003, REQ-02-005,
 *                        REQ-02-006, REQ-02-007, REQ-02-008
 *   IF-01-readIdeas (docs/api.md WO-01-003)
 *   IF-01-readStatus (docs/api.md WO-01-005)
 *   IF-02-deriveColumn (lib/board.ts, WO-02-001)
 *   CMP-02-board-shell (BoardShell — the interactive client boundary)
 */

import { BoardShell } from "@/app/board/_components/BoardShell/BoardShell";
import { readCardProject } from "@/app/board/_utils/readCardProject";
import {
  discardIdeaAction,
  restoreIdeaAction,
  toggleFavoriteAction,
} from "@/app/board/actions/actions";
import { readBoardDoc } from "@/app/board/actions/read-doc";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/IdeaBoardView";
import { deriveColumn } from "@/lib/board/board";
import { readIdeas } from "@/lib/ideas/ideas";
import { getIdeaNavigation } from "@/lib/navigation/identities";

// ---------------------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------------------

/**
 * Board page (Server Component, Next.js App Router).
 *
 * Two-axis column derivation (WO-02-005):
 *   1. readIdeas() — all idea cards.
 *   2. For each project-linked card: readCardProject — project status, docs and digests.
 *   3. deriveColumn(card, status) → BoardColumn.
 *   4. Pass boardColumn into BoardShell (client interactive boundary).
 *
 * readStatus is fail-soft (never throws), so a missing project yields a
 * "documented" fallback column without breaking (AC-02-001.6).
 *
 * DR-062: H1 "Tablero" is rendered by PageTitle inside BoardShell —
 * never by an ad-hoc heading in the Server Component.
 */
export default function BoardPage(): React.JSX.Element {
  // 1. Read all idea cards. Never throws (blueprint §3 tolerance).
  const rawCards = readIdeas();

  // 2 + 3. Resolve boardColumn for every card via two-axis deriveColumn.
  const cards: BoardCardEntry[] = rawCards.map((card) => {
    // Any card linked to a project (in-pipeline, shipped, discarded) keeps its docs and digests.
    const {
      projectStatus,
      docNodes,
      frdCount,
      specContent,
      architectureContent,
      dataModel,
      workOrders,
      envVars,
      adrs,
    } = readCardProject(card);

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
      navigationSlug: getIdeaNavigation(card.slug).slug,
      title: card.title,
      status: card.status,
      projectType: card.projectType,
      returnType: card.returnType,
      score: card.score,
      project: card.project,
      body: card.body,
      // The discard reason (discarded cards only) — shown in the "Ver descartadas"
      // modal and the card detail banner.
      discardReason: card.discardReason,
      // The favourite flag (REQ-02-012) — tints the card + drives the star toggle. Any column.
      favorite: card.favorite,
      isRunning,
      boardColumn,
      // Forward the real project phase so the card detail's campaign matches the
      // board column (without it the detail falls back to research → desync).
      phase: projectStatus?.present ? projectStatus.status.phase : undefined,
      // Forward the deploy target (DR-085) so the campaign's Release ficha shows
      // whether the launch is internal (in-house tool) or external (Vercel/AWS).
      deployTarget: projectStatus?.present ? projectStatus.status.deployTarget : undefined,
      // Web target platform (DR-074) — surfaced as a "qué es" tag in Propuesta + Spec.
      targetPlatforms: projectStatus?.present ? projectStatus.status.targetPlatforms : undefined,
      // Scoped doc STRUCTURE (PRD + research + FRDs); bodies load lazily on select.
      docNodes,
      // Real on-disk FRD folder count — the Spec tab's "N FRDs" badge (DR-092/DR-115).
      frdCount,
      // Spanish high-level spec digest (PRD + research + FRDs) for the Spec tab.
      specContent,
      // Spanish high-level architecture digest + its live artifacts for the Arquitectura tab.
      architectureContent,
      dataModel,
      workOrders,
      envVars,
      adrs,
    };
  });

  // BoardShell is the client boundary: it manages filter/modal/selection state
  // and receives the discard (write) + read-doc (lazy doc body) Server Actions as
  // props (injected for testability — read stays separate from the single write).
  return (
    <BoardShell
      cards={cards}
      discardAction={discardIdeaAction}
      restoreAction={restoreIdeaAction}
      readDocAction={readBoardDoc}
      favoriteAction={toggleFavoriteAction}
    />
  );
}
