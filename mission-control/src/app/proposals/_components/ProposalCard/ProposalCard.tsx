/**
 * ProposalCard — CMP-17-proposalcard (WO-17-004, FRD-17).
 *
 * Renders a single proposal card for any of the four stream kinds:
 *   - candidate-lesson: a lesson with status === "candidate", with eval-gate badge
 *   - promotion: a lesson with promotion === "proposed" (per-card command)
 *   - prune: a lesson with status === "deprecated" (no per-card command — group-level)
 *   - self-suggestion: a Suggestion from computeSuggestions() (per-card command)
 *
 * REQ-17-001 / AC-17-001.2:
 *   withCommand=true   → show a per-card CmdRow (promotions, self-suggestions)
 *   withCommand=false  → card shows title + evidence only; command is at the group level
 *
 * Visual fidelity (DR-054/DR-056, FDD-17 §3):
 *   - `rpgpanel` card (Panel variant="rpgpanel")
 *   - 32px ItemSlot icon in the kind color
 *   - LESSON-NNNN id in mono (proposal-card-source)
 *   - eval-gate Chip (ok/warn) for candidates; target Chip (accent) for promotions
 *   - title (proposal-card-action) + evidence line (file-search icon)
 *   - CmdRow only when withCommand=true
 *
 * Read-only: the only interaction affordance is CopyButton (inside CmdRow).
 * No form, no action button, no run command (AC-17-004.4).
 * State communicated by text + data attribute, not color alone (AC-17-004.6).
 *
 * Traceability:
 *   CMP-17-proposalcard → AC-17-004.2, AC-17-004.3, AC-17-004.4, AC-17-004.6
 *   REQ-17-001 → AC-17-001.2 (withCommand controls per-card vs group-level)
 *   REQ-17-003 — evidence + action + copy button
 *   REQ-17-007 — candidate visually distinct + eval-gate state
 *   REQ-17-009 — high-risk display-only
 */

import { Chip } from "@/components/core/Chip/Chip";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Panel } from "@/components/core/Panel/Panel";
import type { Lesson } from "@/lib/memory/memory";
import type { Suggestion } from "@/lib/self-suggest/self-suggest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CandidateLessonCardProps = {
  kind: "candidate-lesson";
  lesson: Lesson;
  suggestion?: never;
  /** When false, the card defers to the group-level command (REQ-17-001). */
  withCommand?: boolean;
  /** When provided (and no per-card command), the card is a button opening the detail. */
  onSelect?: (lesson: Lesson) => void;
};

type PromotionCardProps = {
  kind: "promotion";
  lesson: Lesson;
  suggestion?: never;
  /** Promotions always carry their own /pandacorp:learn <id> (REQ-17-001). */
  withCommand?: boolean;
  /** When provided (and no per-card command), the card is a button opening the detail. */
  onSelect?: (lesson: Lesson) => void;
};

type PruneCardProps = {
  kind: "prune";
  lesson: Lesson;
  suggestion?: never;
  /** When false, the card defers to the group-level command (REQ-17-001). */
  withCommand?: boolean;
  /** When provided (and no per-card command), the card is a button opening the detail. */
  onSelect?: (lesson: Lesson) => void;
};

type SelfSuggestionCardProps = {
  kind: "self-suggestion";
  suggestion: Suggestion;
  lesson?: never;
  /** Self-suggestions always carry their own command per card (REQ-17-001). */
  withCommand?: boolean;
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

/** Fallback action title when a lesson has no usable body to title from. */
function lessonTitle(kind: "candidate-lesson" | "promotion" | "prune"): string {
  if (kind === "promotion") return "Promover lección a estándar / regla / habilidad";
  if (kind === "prune") return "Depurar lección obsoleta o para reconciliar";
  return "Revisar lección candidata";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Eval-gate Chip for candidate lessons (AC-17-004.3).
 * Uses the shared Chip primitive (tone ok/warn) — not color alone.
 */
function EvalGateChip({ evalGate }: { evalGate: Lesson["evalGate"] }): React.JSX.Element {
  const isCorroborated = evalGate === "corroborated";
  const label = isCorroborated ? "corroborada — activa" : "esperando 2ª aparición";

  return (
    <Chip tone={isCorroborated ? "ok" : "warn"}>
      <span data-testid="proposal-eval-gate-badge" data-eval-gate={evalGate}>
        {label}
      </span>
    </Chip>
  );
}

/**
 * ItemSlot icon — 32px, kind-colored, per prototype bPropCard.
 * Uses a simple inline div matching the prototype's `.itemslot` dimensions.
 * Color is conveyed by data-kind in addition to the tint (text + icon, not color alone).
 */
function KindIcon({
  icon,
  color,
  kind,
}: {
  icon: string;
  color: string;
  kind: string;
}): React.JSX.Element {
  return (
    <span
      data-testid="proposal-kind-icon"
      data-kind-icon={kind}
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "32px",
        height: "32px",
        flexShrink: 0,
        borderRadius: "8px",
        background: `color-mix(in oklch, ${color} 13%, transparent)`,
        border: `1.5px solid ${color}`,
        color,
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: "17px" }} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Kind metadata — icon + color per kind
// ---------------------------------------------------------------------------

const KIND_META = {
  "candidate-lesson": { icon: "ti-bulb", color: "var(--color-accent)" },
  promotion: { icon: "ti-arrow-up-right", color: "var(--color-tier-4, var(--color-accent))" },
  prune: { icon: "ti-trash", color: "var(--color-text3)" },
  "self-suggestion": { icon: "ti-sparkles", color: "var(--color-info)" },
} as const;

// ---------------------------------------------------------------------------
// ProposalCard
// ---------------------------------------------------------------------------

/**
 * ProposalCard — renders one proposal of any of the four kinds.
 *
 * Discriminated by the `kind` prop. The `lesson` prop is required for
 * lesson-based kinds; `suggestion` for self-suggestion.
 *
 * withCommand controls whether the per-card command row is rendered:
 *   - false (default for candidate-lesson and prune) → group provides the command
 *   - true  (default for promotion and self-suggestion) → card shows its own CmdRow
 *
 * Read-only: no action button, only a CopyButton inside CmdRow (AC-17-004.4).
 */
export function ProposalCard(props: ProposalCardProps): React.JSX.Element {
  if (props.kind === "self-suggestion") {
    return (
      <SelfSuggestionCard suggestion={props.suggestion} withCommand={props.withCommand ?? true} />
    );
  }
  return (
    <LessonCard
      kind={props.kind}
      lesson={props.lesson}
      withCommand={props.withCommand ?? props.kind === "promotion"}
      onSelect={props.onSelect}
    />
  );
}

// ---------------------------------------------------------------------------
// LessonCard — candidate-lesson, promotion, prune
// ---------------------------------------------------------------------------

function LessonCard({
  kind,
  lesson,
  withCommand,
  onSelect,
}: {
  kind: "candidate-lesson" | "promotion" | "prune";
  lesson: Lesson;
  withCommand: boolean;
  onSelect?: (lesson: Lesson) => void;
}): React.JSX.Element {
  const command = lessonCommand(kind, lesson.id);
  // Title = the lesson's `context:` (a clean, human-written one-liner). Fall back to
  // a generic per-kind label only if a lesson somehow has no context field.
  const title = lesson.context !== "" ? lesson.context : lessonTitle(kind);
  const meta = KIND_META[kind];

  const card = (
    <Panel variant="rpgpanel">
      <article
        data-testid="proposal-card"
        data-kind={kind}
        aria-label={`Propuesta: ${lesson.id}`}
        style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}
      >
        {/* 32px kind icon (prototype bPropCard itemslot) */}
        <KindIcon icon={meta.icon} color={meta.color} kind={kind} />

        {/* Content column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header row: mono id + eval-gate chip (candidate) or target chip (promotion) */}
          <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
            <span
              data-testid="proposal-card-source"
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "10px",
                color: "var(--color-text3)",
              }}
            >
              {lesson.id}
            </span>

            {kind === "candidate-lesson" && <EvalGateChip evalGate={lesson.evalGate} />}

            {/* Target/classification chip (PROP-06) — accent, "tipo · dominio"
                (the real-data form of the prototype's "estándar · web-performance.md").
                Shown for candidates and promotions, mirroring bPropCard's two-chip head. */}
            {(kind === "candidate-lesson" || kind === "promotion") && (
              <Chip tone="accent">
                <i
                  className="ti ti-arrow-up-right"
                  style={{ fontSize: "10px", verticalAlign: "-1px" }}
                />{" "}
                {lesson.type} · {lesson.domain}
              </Chip>
            )}
          </div>

          {/* Title — the lesson's clean takeaway (PROP-04/05), not a raw body slice */}
          <p
            data-testid="proposal-card-action"
            style={{
              fontSize: "13px",
              fontWeight: 500,
              margin: "4px 0 0",
              color: "var(--color-text)",
            }}
          >
            {title}
          </p>

          {/* Evidence line (file-search icon + source text) — PROP-06 */}
          {lesson.source && (
            <div
              style={{
                fontSize: "11px",
                color: "var(--color-text3)",
                marginTop: "3px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <i
                className="ti ti-file-search"
                style={{ fontSize: "11px", verticalAlign: "-1px" }}
              />
              {lesson.source}
            </div>
          )}

          {/* Per-card command — only when withCommand=true (REQ-17-001 / AC-17-001.2) */}
          {withCommand && (
            <div style={{ marginTop: "8px" }}>
              <span data-testid="proposal-card-command" style={{ display: "none" }}>
                {command}
              </span>
              <CmdRow command={command} />
            </div>
          )}
        </div>
      </article>
    </Panel>
  );

  // Clickable → opens the detail modal. Only when there is NO per-card command
  // inside (a CmdRow's CopyButton must not nest inside a button — invalid HTML).
  if (onSelect === undefined || withCommand) return card;
  return (
    <button
      type="button"
      data-testid="proposal-card-button"
      onClick={() => onSelect(lesson)}
      aria-label={`Ver detalle de la lección ${lesson.id}`}
      style={{
        display: "block",
        width: "100%",
        padding: 0,
        border: "none",
        background: "none",
        font: "inherit",
        color: "inherit",
        textAlign: "left",
        cursor: "pointer",
        borderRadius: "var(--radius-md, 12px)",
      }}
    >
      {card}
    </button>
  );
}

// ---------------------------------------------------------------------------
// SelfSuggestionCard
// ---------------------------------------------------------------------------

function SelfSuggestionCard({
  suggestion,
  withCommand,
}: {
  suggestion: Suggestion;
  withCommand: boolean;
}): React.JSX.Element {
  const meta = KIND_META["self-suggestion"];

  return (
    <Panel variant="rpgpanel">
      <article
        data-testid="proposal-card"
        data-kind="self-suggestion"
        data-severity={suggestion.severity}
        aria-label={`Sugerencia automática: ${suggestion.title}`}
        style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}
      >
        {/* 32px kind icon */}
        <KindIcon
          icon={suggestion.kind === "bottleneck" ? "ti-clock-pause" : meta.icon}
          color={meta.color}
          kind="self-suggestion"
        />

        {/* Content column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header row: id (SELF-kind) */}
          <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
            <span
              data-testid="proposal-card-source"
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "10px",
                color: "var(--color-text3)",
              }}
            >
              {suggestion.evidence}
            </span>

            {/* Severity chip — text, not color alone (AC-17-004.6) */}
            <Chip tone={suggestion.severity === "nudge" ? "warn" : "info"}>
              {suggestion.severity === "nudge" ? "aviso" : "info"}
            </Chip>
          </div>

          {/* Title — the suggested action */}
          <p
            data-testid="proposal-card-action"
            style={{
              fontSize: "13px",
              fontWeight: 500,
              margin: "4px 0 0",
              color: "var(--color-text)",
            }}
          >
            {suggestion.title}
          </p>

          {/* Per-card command — always true for self-suggestions (each differs) */}
          {withCommand && (
            <div style={{ marginTop: "8px" }}>
              <span data-testid="proposal-card-command" style={{ display: "none" }}>
                {suggestion.command}
              </span>
              <CmdRow command={suggestion.command} />
            </div>
          )}
        </div>
      </article>
    </Panel>
  );
}
