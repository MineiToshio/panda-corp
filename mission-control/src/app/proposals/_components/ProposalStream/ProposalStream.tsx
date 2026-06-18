/**
 * ProposalStream — CMP-17-stream (WO-17-004, FRD-17).
 *
 * Renders a labelled proposal stream for one of the four kinds:
 *   - candidate-lesson: lessons with status === "candidate"
 *   - promotion: lessons with promotion === "proposed"
 *   - prune: lessons with status === "deprecated"
 *   - self-suggestion: Suggestion[] from computeSuggestions()
 *
 * Each row → ProposalCard. Empty state shows a calm guild message (no urgency).
 *
 * Read-only: Server Component (no client state, no action affordances beyond copy).
 *
 * Traceability:
 *   CMP-17-stream → AC-17-004.1, AC-17-004.5, AC-17-004.6
 *   REQ-17-002 — aggregate four kinds
 *   REQ-17-008 — honest and dismissible; guild theme; no false urgency
 */

import type { Lesson } from "@/lib/memory/memory";
import type { Suggestion } from "@/lib/self-suggest/self-suggest";
import { ProposalCard } from "../ProposalCard/ProposalCard";
import { STREAM_META } from "./streamMeta";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CandidateLessonStreamProps = {
  kind: "candidate-lesson";
  lessons: Lesson[];
  suggestions?: never;
};

type PromotionStreamProps = {
  kind: "promotion";
  lessons: Lesson[];
  suggestions?: never;
};

type PruneStreamProps = {
  kind: "prune";
  lessons: Lesson[];
  suggestions?: never;
};

type SelfSuggestionStreamProps = {
  kind: "self-suggestion";
  suggestions: Suggestion[];
  lessons?: never;
};

export type ProposalStreamProps =
  | CandidateLessonStreamProps
  | PromotionStreamProps
  | PruneStreamProps
  | SelfSuggestionStreamProps;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const HEADING_STYLE: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  margin: 0,
  color: "var(--color-text, currentColor)",
};

const DESCRIPTION_STYLE: React.CSSProperties = {
  fontSize: "0.8rem",
  opacity: 0.65,
  margin: "0 0 0.25rem",
  lineHeight: 1.4,
};

const CARDS_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const EMPTY_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  opacity: 0.65,
  fontStyle: "italic",
  padding: "0.75rem 0",
  color: "var(--color-text, currentColor)",
};

// ---------------------------------------------------------------------------
// ProposalStream
// ---------------------------------------------------------------------------

/**
 * ProposalStream — renders one of the four proposal stream sections.
 *
 * When the list is empty, shows a calm empty-state message aligned with
 * the guild/cronista theme (no false urgency, AC-17-004.5).
 */
export function ProposalStream(props: ProposalStreamProps): React.JSX.Element {
  const meta = STREAM_META[props.kind];
  const testId = `proposal-stream-${props.kind}`;

  const isEmpty =
    props.kind === "self-suggestion"
      ? (props.suggestions ?? []).length === 0
      : (props.lessons ?? []).length === 0;

  return (
    <section data-testid={testId} style={SECTION_STYLE} aria-labelledby={`${testId}-heading`}>
      <h2 id={`${testId}-heading`} style={HEADING_STYLE}>
        {meta.label}
      </h2>
      <p style={DESCRIPTION_STYLE}>{meta.description}</p>

      {isEmpty ? (
        <p data-testid="proposal-stream-empty" style={EMPTY_STYLE}>
          {meta.emptyMessage}
        </p>
      ) : (
        <div style={CARDS_STYLE}>
          {props.kind === "self-suggestion"
            ? props.suggestions.map((suggestion) => (
                <ProposalCard
                  key={`${suggestion.kind}-${suggestion.target ?? suggestion.command}`}
                  kind="self-suggestion"
                  suggestion={suggestion}
                />
              ))
            : props.lessons.map((lesson) => (
                <ProposalCard key={lesson.id} kind={props.kind} lesson={lesson} />
              ))}
        </div>
      )}
    </section>
  );
}
