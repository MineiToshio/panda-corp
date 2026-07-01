"use client";

/**
 * DismissableProposalStream — CMP-17-stream with dismiss + group-level command
 * (WO-17-004, REQ-17-008, REQ-17-001 / AC-17-007.3, AC-17-001.1/.2).
 *
 * The client boundary for the proposals page. Each card can be dismissed
 * (localStorage, no factory write — White-Hat FRD-09). When `groupCmd` is
 * provided, it is rendered ONCE under the section title as a `CmdRow` (the
 * group-level command pattern from REQ-17-001), and individual cards are
 * rendered WITHOUT their own per-card command (`withCommand=false`). When
 * `groupCmd` is absent (promotions / self-suggestions), each card renders its
 * own `CmdRow` (`withCommand=true`).
 *
 * Visual structure (DR-062):
 *   - Section header → shared `SectionHead` (one per group, no bespoke header)
 *   - Group command   → shared `CmdRow` with data-testid="group-level-command"
 *   - Cards           → `ProposalCard` with `withCommand` flag
 *   - Dismiss button  → per-row ✕ accessible button
 *
 * Read-only over the factory: dismissing touches localStorage ONLY (architecture
 * §4.8) — never factory/memory, factory/standards or plugin/.
 *
 * Traceability:
 *   CMP-17-stream + CMP-17-dismiss → REQ-17-008, AC-17-007.3
 *   REQ-17-001 → AC-17-001.1 (groupCmd rendered once)
 *   REQ-17-001 → AC-17-001.2 (withCommand=false when groupCmd present)
 */

import { useCallback, useState } from "react";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
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
} from "../streamMeta";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CandidateLessonStreamProps = {
  kind: "candidate-lesson";
  lessons: Lesson[];
  suggestions?: never;
  /** Group-level command (shown once under section title). When present, cards carry no command. */
  groupCmd?: string;
};

type PromotionStreamProps = {
  kind: "promotion";
  lessons: Lesson[];
  suggestions?: never;
  /** No group command for promotions (each has its own /pandacorp:learn <id>). */
  groupCmd?: never;
};

type PruneStreamProps = {
  kind: "prune";
  lessons: Lesson[];
  suggestions?: never;
  /** Group-level command (shown once under section title). When present, cards carry no command. */
  groupCmd?: string;
};

type SelfSuggestionStreamProps = {
  kind: "self-suggestion";
  suggestions: Suggestion[];
  lessons?: never;
  /** No group command for self-suggestions (each has its own computed command). */
  groupCmd?: never;
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
  gap: "0",
};

const CARDS_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "9px",
};

const EMPTY_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text3)",
  fontStyle: "italic",
  padding: "0.75rem 2px",
};

// The card fills the row; the dismiss ✕ is overlaid subtly in its top-right corner
// (position:relative anchor) instead of a text+border pill hanging off to the side.
const ROW_STYLE: React.CSSProperties = {
  position: "relative",
};

const DISMISS_BUTTON_STYLE: React.CSSProperties = {
  position: "absolute",
  top: "8px",
  right: "8px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "26px",
  height: "26px",
  padding: 0,
  lineHeight: 1,
  cursor: "pointer",
  borderRadius: "var(--radius-sm, 8px)",
  border: "none",
  background: "transparent",
  color: "var(--color-text3)",
};

const GROUP_CMD_WRAP_STYLE: React.CSSProperties = {
  marginBottom: "11px",
};

const GROUP_CMD_LABEL_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text2)",
  marginBottom: "4px",
};

// ---------------------------------------------------------------------------
// Internal proposal model — uniform { id, node } for both lessons and suggestions
// ---------------------------------------------------------------------------

type RenderableProposal = {
  id: string;
  node: React.JSX.Element;
};

function toRenderable(
  props: DismissableProposalStreamProps,
  withCommand: boolean,
): RenderableProposal[] {
  if (props.kind === "self-suggestion") {
    return props.suggestions.map((suggestion) => ({
      id: suggestionProposalId(suggestion),
      node: (
        <ProposalCard kind="self-suggestion" suggestion={suggestion} withCommand={withCommand} />
      ),
    }));
  }
  return props.lessons.map((lesson) => ({
    id: lessonProposalId(lesson),
    node: <ProposalCard kind={props.kind} lesson={lesson} withCommand={withCommand} />,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DismissableProposalStream — a proposal stream whose cards can be dismissed.
 *
 * When `groupCmd` is present (candidates, prune):
 *   - A CmdRow with `data-testid="group-level-command"` is shown once under
 *     the SectionHead, labelled "Para revisar/activar toda esta lista, corre:"
 *   - Individual cards are rendered with `withCommand=false` (no per-card cmd)
 *
 * When `groupCmd` is absent (promotions, self-suggestions):
 *   - No group command row
 *   - Individual cards are rendered with `withCommand=true` (per-card cmd)
 */
export function DismissableProposalStream(
  props: DismissableProposalStreamProps,
): React.JSX.Element {
  const meta = STREAM_META[props.kind as StreamKind];
  const testId = `proposal-stream-${props.kind}`;
  const groupCmd = "groupCmd" in props ? props.groupCmd : undefined;

  // When a group command exists, individual cards carry no command (REQ-17-001)
  const withCommand = !groupCmd;

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

  const visible = toRenderable(props, withCommand).filter((p) => !dismissedIds.has(p.id));
  const isEmpty = visible.length === 0;

  return (
    <section data-testid={testId} style={SECTION_STYLE} aria-labelledby={`${testId}-heading`}>
      {/* THE one SectionHead — DR-062, no bespoke per-screen section header */}
      <SectionHead
        icon={SECTION_ICON[props.kind]}
        label={meta.label}
        count={visible.length > 0 ? visible.length : undefined}
      />

      {/* Group-level command row — once under the title (REQ-17-001 / AC-17-001.1) */}
      {groupCmd && !isEmpty && (
        <div style={GROUP_CMD_WRAP_STYLE}>
          <p style={GROUP_CMD_LABEL_STYLE}>Para revisar/activar toda esta lista, corre:</p>
          <div data-testid="group-level-command">
            <CmdRow command={groupCmd} />
          </div>
        </div>
      )}

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
// Section icon map (per-kind Tabler icon for SectionHead)
// ---------------------------------------------------------------------------

const SECTION_ICON: Record<StreamKind, string> = {
  "candidate-lesson": "ti-bulb",
  promotion: "ti-arrow-up-right",
  prune: "ti-trash",
  "self-suggestion": "ti-sparkles",
};

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
      {proposal.node}
      <button
        type="button"
        data-testid="proposal-dismiss-button"
        style={DISMISS_BUTTON_STYLE}
        onClick={handleClick}
        title="Descartar"
        aria-label={`Descartar propuesta: ${proposal.id}`}
      >
        <i className="ti ti-x" style={{ fontSize: "14px" }} aria-hidden="true" />
      </button>
    </div>
  );
}
