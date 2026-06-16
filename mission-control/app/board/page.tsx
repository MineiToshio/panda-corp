/**
 * Board page — Server Component (CMP-02-board-view).
 *
 * Reads all idea cards from the factory filesystem via readIdeas (IF-01-readIdeas,
 * docs/api.md WO-01-003) and renders them in the IdeaBoardView kanban.
 *
 * Platform golden rule (architecture §1): read-only, never call Claude.
 * All I/O is synchronous fs reads via readIdeas (lib/ideas.ts).
 *
 * The board is rendered server-side so no loading spinner is needed for the
 * initial render. Error states are handled via the tolerance rules of readIdeas
 * (blueprint §3) — a missing ideas folder yields [], never a throw.
 *
 * Traceability:
 *   CMP-02-board-view → REQ-02-001, REQ-02-002, REQ-02-005
 *   IF-01-readIdeas (docs/api.md WO-01-003)
 */

import type { IdeaCardProps } from "@/components/IdeaCard";
import { readIdeas } from "@/lib/ideas";
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
 * Synchronous — readIdeas is synchronous (fs.readFileSync), safe here.
 */
export default function BoardPage(): React.JSX.Element {
  // Read all idea cards. readIdeas never throws (blueprint §3 tolerance).
  const rawCards = readIdeas();

  // Map IdeaCard data → IdeaCardProps.
  // isRunning is not set here (requires readStatus per card — that's WO-02-001/WO-02-005).
  // For WO-01-003 scope: pass through the data layer fields as-is.
  const cards: IdeaCardProps[] = rawCards.map((card) => ({
    slug: card.slug,
    title: card.title,
    status: card.status,
    projectType: card.projectType,
    returnType: card.returnType,
    score: card.score,
    project: card.project,
    body: card.body,
    // isRunning resolved in the full board view (WO-02-005) once readStatus is wired.
    isRunning: undefined,
  }));

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
