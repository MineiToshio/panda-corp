"use client";

/**
 * DismissableProposalStream — CMP-17-stream with the dismiss affordance (WO-17-004,
 * WO-17-007, REQ-17-008 / AC-17-007.3).
 *
 * The client boundary for the proposals page. Wraps each proposal card with an
 * accessible "Descartar" button; a dismissal is remembered in localStorage via
 * `proposalsDismissStore` and survives refreshes (White-Hat, FRD-09 — no false
 * urgency, the owner can quiet any proposal). The page itself stays a Server
 * Component; this is the only client island.
 *
 * Read-only over the factory: dismissing touches localStorage ONLY (architecture
 * §4.8) — never factory/memory, factory/standards or plugin/.
 *
 * Traceability:
 *   CMP-17-stream + CMP-17-dismiss → REQ-17-008, AC-17-007.3
 *   Reuses ProposalCard (CMP-17-proposalcard) and STREAM_META (shared copy).
 */

import { useCallback, useState } from "react";
import {
  dismissProposal,
  getDismissedIds,
} from "@/components/modules/ProposalsDismiss/proposalsDismissStore";
import type { Lesson } from "@/lib/memory/memory";
import type { Suggestion } from "@/lib/self-suggest/self-suggest";
import { ProposalCard } from "../ProposalCard/ProposalCard";
import {
  lessonProposalId,
  STREAM_META,
  type StreamKind,
  suggestionProposalId,
} from "../ProposalStream/streamMeta";

// ---------------------------------------------------------------------------
// Props
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

export type DismissableProposalStreamProps =
  | CandidateLessonStreamProps
  | PromotionStreamProps
  | PruneStreamProps
  | SelfSuggestionStreamProps;

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded colors
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

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.5rem",
};

const CARD_WRAP_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const DISMISS_BUTTON_STYLE: React.CSSProperties = {
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  padding: "0.25rem 0.5rem",
  fontSize: "0.7rem",
  fontWeight: 600,
  cursor: "pointer",
  borderRadius: "var(--radius, 0.5rem)",
  border: "var(--hairline, 1px) solid currentColor",
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
  opacity: 0.8,
};

// ---------------------------------------------------------------------------
// Internal proposal model — uniform { id, node } for both lessons and suggestions
// ---------------------------------------------------------------------------

type RenderableProposal = {
  id: string;
  node: React.JSX.Element;
};

function toRenderable(props: DismissableProposalStreamProps): RenderableProposal[] {
  if (props.kind === "self-suggestion") {
    return props.suggestions.map((suggestion) => ({
      id: suggestionProposalId(suggestion),
      node: <ProposalCard kind="self-suggestion" suggestion={suggestion} />,
    }));
  }
  return props.lessons.map((lesson) => ({
    id: lessonProposalId(lesson),
    node: <ProposalCard kind={props.kind} lesson={lesson} />,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DismissableProposalStream — a proposal stream whose cards can be dismissed.
 *
 * Mirrors `ProposalStream`'s section chrome and calm empty-state copy, but each
 * visible card carries a "Descartar" button. Dismissed ids are read from and
 * written to `proposalsDismissStore` (localStorage); the local `dismissedIds`
 * state forces a re-render so the card disappears immediately.
 */
export function DismissableProposalStream(
  props: DismissableProposalStreamProps,
): React.JSX.Element {
  const meta = STREAM_META[props.kind as StreamKind];
  const testId = `proposal-stream-${props.kind}`;

  // Initialise from the store so an already-dismissed proposal never flashes in.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set(getDismissedIds()));

  const handleDismiss = useCallback((id: string) => {
    dismissProposal(id);
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const visible = toRenderable(props).filter((p) => !dismissedIds.has(p.id));
  const isEmpty = visible.length === 0;

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
          {visible.map((proposal) => (
            <DismissRow key={proposal.id} proposal={proposal} onDismiss={handleDismiss} />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// DismissRow — one card + its dismiss button
// ---------------------------------------------------------------------------

function DismissRow({
  proposal,
  onDismiss,
}: {
  proposal: RenderableProposal;
  onDismiss: (id: string) => void;
}): React.JSX.Element {
  const handleClick = useCallback(() => {
    onDismiss(proposal.id);
  }, [onDismiss, proposal.id]);

  return (
    <div style={ROW_STYLE}>
      <div style={CARD_WRAP_STYLE}>{proposal.node}</div>
      <button
        type="button"
        data-testid="proposal-dismiss-button"
        style={DISMISS_BUTTON_STYLE}
        onClick={handleClick}
        aria-label={`Descartar propuesta: ${proposal.id}`}
      >
        ✕ Descartar
      </button>
    </div>
  );
}
