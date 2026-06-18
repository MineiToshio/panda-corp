/**
 * ProposalCard — CMP-17-proposalcard (WO-17-004, FRD-17).
 *
 * Renders a single proposal card for any of the four stream kinds:
 *   - candidate-lesson: a lesson with status === "candidate", with eval-gate badge
 *   - promotion: a lesson with promotion === "proposed"
 *   - prune: a lesson with status === "deprecated"
 *   - self-suggestion: a Suggestion from computeSuggestions()
 *
 * Read-only: the only interaction affordance is the CopyButton.
 * No form, no action button, no run command (AC-17-004.4).
 * State communicated by text + data attribute, not color alone (AC-17-004.6).
 *
 * Traceability:
 *   CMP-17-proposalcard → AC-17-004.2, AC-17-004.3, AC-17-004.4, AC-17-004.6
 *   REQ-17-003 — evidence + action + copy button
 *   REQ-17-007 — candidate visually distinct + eval-gate state
 *   REQ-17-009 — high-risk display-only
 */

import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import type { Lesson } from "@/lib/memory/memory";
import type { Suggestion } from "@/lib/self-suggest/self-suggest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CandidateLessonCardProps = {
  kind: "candidate-lesson";
  lesson: Lesson;
  suggestion?: never;
};

type PromotionCardProps = {
  kind: "promotion";
  lesson: Lesson;
  suggestion?: never;
};

type PruneCardProps = {
  kind: "prune";
  lesson: Lesson;
  suggestion?: never;
};

type SelfSuggestionCardProps = {
  kind: "self-suggestion";
  suggestion: Suggestion;
  lesson?: never;
};

export type ProposalCardProps =
  | CandidateLessonCardProps
  | PromotionCardProps
  | PruneCardProps
  | SelfSuggestionCardProps;

// ---------------------------------------------------------------------------
// Constants — command derivation
// ---------------------------------------------------------------------------

/** Derive the exact /pandacorp:* command to copy for a lesson-based card. */
function lessonCommand(kind: "candidate-lesson" | "promotion" | "prune", lessonId: string): string {
  if (kind === "promotion") return `/pandacorp:learn ${lessonId}`;
  // Both candidate and prune → /pandacorp:memory review
  return "/pandacorp:memory review";
}

/** Derive a human-readable suggested action for a lesson-based card. */
function lessonAction(kind: "candidate-lesson" | "promotion" | "prune"): string {
  if (kind === "promotion") return "Revisar y aprobar la promoción a estándar/regla/habilidad";
  if (kind === "prune") return "Revisar y depurar esta lección obsoleta";
  return "Revisar la lección candidata (corroboración pendiente)";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Eval-gate badge for candidate lessons (AC-17-004.3). */
function EvalGateBadge({ evalGate }: { evalGate: Lesson["evalGate"] }): React.JSX.Element {
  const label =
    evalGate === "corroborated" ? "Corroborada (≥2 proyectos)" : "Pendiente 2ª ocurrencia";

  return (
    <span
      data-testid="proposal-eval-gate-badge"
      data-eval-gate={evalGate}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        fontSize: "0.7rem",
        fontWeight: 600,
        padding: "0.1rem 0.4rem",
        borderRadius: "var(--radius, 0.5rem)",
        border: "var(--hairline, 1px) solid currentColor",
        color:
          evalGate === "corroborated"
            ? "var(--color-agent-test-writer, currentColor)"
            : "var(--color-accent, currentColor)",
        opacity: 0.9,
      }}
    >
      {evalGate === "corroborated" ? "✓" : "⏳"} {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Card layout helpers
// ---------------------------------------------------------------------------

const CARD_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  padding: "0.75rem 1rem",
  borderRadius: "var(--radius, 0.5rem)",
  border: "var(--hairline, 1px) solid currentColor",
  background: "var(--color-surface, Canvas)",
  color: "var(--color-text, currentColor)",
  opacity: 1,
};

const SOURCE_STYLE: React.CSSProperties = {
  fontSize: "0.7rem",
  opacity: 0.65,
  fontFamily: "monospace",
};

const ACTION_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 500,
};

const COMMAND_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const COMMAND_TEXT_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  fontFamily: "monospace",
  opacity: 0.8,
};

// ---------------------------------------------------------------------------
// ProposalCard
// ---------------------------------------------------------------------------

/**
 * ProposalCard — renders one proposal of any of the four kinds.
 *
 * Discriminated by the `kind` prop. The `lesson` prop is required for
 * lesson-based kinds; `suggestion` for self-suggestion.
 *
 * Read-only: no action button, only a CopyButton (AC-17-004.4).
 */
export function ProposalCard(props: ProposalCardProps): React.JSX.Element {
  if (props.kind === "self-suggestion") {
    return <SelfSuggestionCard suggestion={props.suggestion} />;
  }
  return <LessonCard kind={props.kind} lesson={props.lesson} />;
}

// ---------------------------------------------------------------------------
// LessonCard — candidate-lesson, promotion, prune
// ---------------------------------------------------------------------------

function LessonCard({
  kind,
  lesson,
}: {
  kind: "candidate-lesson" | "promotion" | "prune";
  lesson: Lesson;
}): React.JSX.Element {
  const command = lessonCommand(kind, lesson.id);
  const action = lessonAction(kind);

  return (
    <article
      data-testid="proposal-card"
      data-kind={kind}
      style={CARD_STYLE}
      aria-label={`Propuesta: ${lesson.id}`}
    >
      {/* Header row — id + eval-gate badge for candidates */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <span data-testid="proposal-card-source" style={SOURCE_STYLE}>
          {lesson.id}
          {lesson.source ? ` · ${lesson.source}` : ""}
        </span>
        {kind === "candidate-lesson" && <EvalGateBadge evalGate={lesson.evalGate} />}
      </div>

      {/* Suggested action */}
      <p data-testid="proposal-card-action" style={ACTION_STYLE}>
        {action}
      </p>

      {/* Body snippet (the lesson content) */}
      {lesson.body ? (
        <p style={{ fontSize: "0.8rem", opacity: 0.75, margin: 0, lineHeight: 1.4 }}>
          {lesson.body.length > 200 ? `${lesson.body.slice(0, 200)}…` : lesson.body}
        </p>
      ) : null}

      {/* Command row — copyable command, no run button */}
      <div style={COMMAND_ROW_STYLE}>
        <code data-testid="proposal-card-command" style={COMMAND_TEXT_STYLE}>
          {command}
        </code>
        <CopyButton value={command} label="Copiar comando" />
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// SelfSuggestionCard
// ---------------------------------------------------------------------------

function SelfSuggestionCard({ suggestion }: { suggestion: Suggestion }): React.JSX.Element {
  return (
    <article
      data-testid="proposal-card"
      data-kind="self-suggestion"
      data-severity={suggestion.severity}
      style={CARD_STYLE}
      aria-label={`Sugerencia automática: ${suggestion.title}`}
    >
      {/* Evidence / source */}
      <span data-testid="proposal-card-source" style={SOURCE_STYLE}>
        {suggestion.evidence}
      </span>

      {/* Suggested action (title) */}
      <p data-testid="proposal-card-action" style={ACTION_STYLE}>
        {suggestion.title}
      </p>

      {/* Severity label — text, not color alone (AC-17-004.6) */}
      <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>
        {suggestion.severity === "nudge" ? "! Aviso" : "i Información"}
      </span>

      {/* Command row — display + copy only, no run */}
      <div style={COMMAND_ROW_STYLE}>
        <code data-testid="proposal-card-command" style={COMMAND_TEXT_STYLE}>
          {suggestion.command}
        </code>
        <CopyButton value={suggestion.command} label="Copiar comando" />
      </div>
    </article>
  );
}
