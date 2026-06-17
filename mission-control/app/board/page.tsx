/**
 * Board page — Server Component (CMP-02-board-view).
 *
 * WO-02-005: full two-axis board — reads all idea cards, resolves the project
 * status for each in-pipeline card via readStatus, and derives the board column
 * for every card via deriveColumn. The resulting `boardColumn` is passed to
 * IdeaBoardView which routes cards into the 7 canonical columns.
 *
 * Platform golden rule (architecture §1): read-only, never call Claude.
 * All I/O is synchronous fs reads via readIdeas / readStatus (lib/).
 *
 * Traceability:
 *   CMP-02-board-view → REQ-02-001, REQ-02-002, REQ-02-005, REQ-02-006
 *   IF-01-readIdeas (docs/api.md WO-01-003)
 *   IF-01-readStatus (docs/api.md WO-01-005)
 *   IF-02-deriveColumn (lib/board.ts, WO-02-001)
 */

import path from "node:path";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView";
import { deriveColumn } from "@/lib/board";
import { resolveFactoryRoot } from "@/lib/config";
import { readIdeas } from "@/lib/ideas";
import { readStatus } from "@/lib/status";
import { IdeaBoardView } from "./IdeaBoardView";

// ---------------------------------------------------------------------------
// Page styles — CSS custom properties only, zero hardcoded colors
// ---------------------------------------------------------------------------

const PAGE_STYLE: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
};

const HEADER_STYLE: React.CSSProperties = {
  padding: "calc(var(--spacing, 0.25rem) * 4) calc(var(--spacing, 0.25rem) * 4)",
  borderBottom: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  display: "flex",
  alignItems: "baseline",
  gap: "calc(var(--spacing, 0.25rem) * 3)",
};

const HEADING_STYLE: React.CSSProperties = {
  fontSize: "1.125rem",
  fontWeight: 700,
  margin: 0,
  color: "var(--color-text, currentColor)",
};

const SUBTEXT_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
  margin: 0,
};

// ---------------------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------------------

/**
 * Board page (Server Component, Next.js App Router).
 *
 * Two-axis column derivation (WO-02-005):
 *   1. readIdeas() — all idea cards.
 *   2. For each in-pipeline card: readStatus(projectPath) — project phase.
 *   3. deriveColumn(card, status) → BoardColumn.
 *   4. Pass boardColumn into each card entry for IdeaBoardView.
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

  return (
    <main data-testid="board-page" style={PAGE_STYLE} aria-label="Tablero de ideas Pandacorp">
      <header style={HEADER_STYLE}>
        <h1 style={HEADING_STYLE}>Tablero de Ideas</h1>
        <p style={SUBTEXT_STYLE}>
          {cards.length === 0
            ? "Sin ideas aún."
            : `${cards.length} idea${cards.length === 1 ? "" : "s"}`}
        </p>
      </header>
      <IdeaBoardView cards={cards} />
    </main>
  );
}
