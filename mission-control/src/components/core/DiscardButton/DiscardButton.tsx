"use client";

/**
 * DiscardButton — Destructive action button (CMP-02-discard-action).
 *
 * Implements the discard flow for an idea card:
 *   1. Idle: shows "Descartar idea" trigger button.
 *   2. Confirming: opens a MODAL (the shared Modal core, DR-057) that captures WHY
 *      the idea is discarded — quick-tags (multi-select) + an optional free-text
 *      reason — then confirm + cancel buttons. (Two-step safety net for a
 *      destructive action.) The owner rule (FRD-02): reveal-more is a modal, never
 *      an inline expand-that-pushes-content — so the reason capture lives in the
 *      modal, not pushed inline below the trigger.
 *   3. Pending: confirm button is disabled while the Server Action is in-flight.
 *   4. Done: shows a "Descartada" success indicator (optimistic UI resolved).
 *   5. Error: reverts to idle and shows an error message when the action fails.
 *
 * The captured reason is optional (the owner can confirm without picking anything).
 * When given, it is sent to the Server Action and written to the card's
 * `discard_reason` frontmatter so `/pandacorp:discover` can learn the rejection
 * pattern and stop proposing the same kind of idea (factory v9.8.0).
 *
 * Optimistic UI: the component transitions to "done" immediately on confirm,
 * then reverts to "idle" (with an error message) if the action returns { ok: false }.
 *
 * Rules (architecture §1/§7):
 *   - This is the ONLY mutation surface in the UI. Everything else is read-only.
 *   - The Server Action `discardIdeaAction` is received as a prop so the component
 *     is fully testable without Next.js infrastructure.
 *   - Zero hardcoded colors — all visual values via CSS custom properties.
 *   - data-testid on every interactive element (test-writer contract).
 *   - Spanish copy (single operator, AGENTS.md).
 *
 * Traceability:
 *   CMP-02-discard-action → REQ-02-007
 *   AC-02-007.1 — WHEN the owner presses "Discard idea", the system SHALL rewrite
 *                 `status: discarded` in the `.md` frontmatter.
 *   AC-02-007.2 — WHEN the owner confirms a discard, the system SHALL let them
 *                 capture an optional reason and write it to `discard_reason`.
 *   Depends on WO-02-009 (discardIdeaAction, app/board/actions.ts)
 */

import { useState, useTransition } from "react";
import { Button } from "@/components/core/Button/Button";
import { Modal } from "@/components/core/Modal/Modal";
import type { DiscardResult } from "@/lib/discard/discard";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DiscardButtonProps {
  /** The idea slug — passed to the Server Action as-is. */
  slug: string;
  /**
   * The Server Action to call on confirmation.
   * Injected as a prop so tests can pass a vi.fn() without Next.js infrastructure.
   * Production callers pass `discardIdeaAction` from `app/board/actions.ts`.
   * The optional `reason` is the owner's why (quick-tags + free text), written to
   * the card's `discard_reason` frontmatter.
   */
  discardAction: (slug: string, reason?: string) => Promise<DiscardResult>;
}

// ---------------------------------------------------------------------------
// Quick-tags for the discard reason (Spanish, single operator).
// Multi-select; combined with the optional free text into one reason string.
// These mirror the rejection-pattern vocabulary discover learns from (v9.8.0).
// ---------------------------------------------------------------------------

const DISCARD_REASON_TAGS = [
  "saturado / competencia fuerte",
  "no me interesa el tema",
  "no apalanca mi canal",
  "muy complejo",
  "no monetiza en Perú",
  "otro",
] as const;

// ---------------------------------------------------------------------------
// Internal state machine
// "idle" → click trigger → "confirming"
// "confirming" → cancel → "idle"
// "confirming" → confirm → "pending" → ok → "done"
//                                    → fail → "idle" (with errorMsg)
// ---------------------------------------------------------------------------

type UIState = "idle" | "confirming" | "pending" | "done";

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded color values.
// These variables are wired by the design system (WO-13-002, globals.css).
// ---------------------------------------------------------------------------

const DONE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  padding: "calc(var(--spacing, 0.25rem) * 1) calc(var(--spacing, 0.25rem) * 2)",
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.6,
};

const CONFIRM_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  flexWrap: "wrap",
};

const ERROR_STYLE: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "var(--color-danger, currentColor)",
  marginTop: "calc(var(--spacing, 0.25rem) * 1)",
  opacity: 0.85,
};

const WRAPPER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
};

// --- Reason capture (confirming step) -------------------------------------

const REASON_FORM_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  width: "100%",
  border: "none",
  padding: 0,
  margin: 0,
};

const REASON_LABEL_STYLE: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--color-text)",
};

const REASON_HINT_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3, var(--color-text-muted))",
  fontWeight: 400,
};

const TAGS_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "5px",
};

const TAG_BTN_STYLE: React.CSSProperties = {
  fontSize: "11px",
  padding: "3px 9px",
  borderRadius: "var(--radius-sm, 8px)",
  border: "1px solid var(--color-border-strong)",
  background: "var(--color-card)",
  color: "var(--color-text2, var(--color-text))",
  cursor: "pointer",
  lineHeight: 1.4,
  fontFamily: "var(--font-display, inherit)",
  transition: "border-color var(--duration-fast, 150ms), background var(--duration-fast, 150ms)",
};

const TAG_BTN_SELECTED_STYLE: React.CSSProperties = {
  ...TAG_BTN_STYLE,
  background: "var(--color-accent-bg)",
  color: "var(--color-accent-text)",
  borderColor: "var(--color-accent-text, var(--color-border-strong))",
  fontWeight: 600,
};

const TEXTAREA_STYLE: React.CSSProperties = {
  width: "100%",
  minHeight: "140px",
  resize: "vertical",
  fontSize: "13px",
  lineHeight: 1.5,
  padding: "10px 12px",
  borderRadius: "var(--radius-sm, 8px)",
  border: "1px solid var(--color-border-strong)",
  background: "var(--color-base, var(--color-card))",
  color: "var(--color-text)",
  fontFamily: "var(--font-body, inherit)",
};

// ---------------------------------------------------------------------------
// Reason composition
// ---------------------------------------------------------------------------

/** Combine the selected quick-tags + the free text into one reason string. */
function composeReason(tags: readonly string[], text: string): string {
  const joinedTags = tags.join(" · ");
  const trimmed = text.trim();
  if (joinedTags !== "" && trimmed !== "") {
    return `${joinedTags} — ${trimmed}`;
  }
  return joinedTags !== "" ? joinedTags : trimmed;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Client component: "Descartar idea" button with a two-step confirmation flow
 * that captures an optional discard reason.
 * Uses useTransition for React 19 concurrent-safe pending state.
 */
export function DiscardButton({ slug, discardAction }: DiscardButtonProps): React.JSX.Element {
  const [uiState, setUiState] = useState<UIState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<readonly string[]>([]);
  const [reasonText, setReasonText] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Derived: while useTransition is pending, treat as "pending" regardless of uiState
  const isInFlight = isPending || uiState === "pending";

  function handleTrigger() {
    setErrorMsg(null);
    setUiState("confirming");
  }

  function handleCancel() {
    setUiState("idle");
    setErrorMsg(null);
    setSelectedTags([]);
    setReasonText("");
  }

  /**
   * Modal dismissal (backdrop click, ✕ button, Escape). Inert while the action is
   * in-flight so a destructive write can't be abandoned half-done; otherwise it
   * cancels like the explicit "Cancelar" button.
   */
  function handleClose() {
    if (isInFlight) return;
    handleCancel();
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function handleConfirm() {
    setUiState("pending");
    setErrorMsg(null);

    const reason = composeReason(selectedTags, reasonText);

    startTransition(async () => {
      const result = await discardAction(slug, reason);

      if (result.ok) {
        setUiState("done");
      } else {
        setUiState("idle");
        const reasons: Record<string, string> = {
          "not-found": "La idea no fue encontrada.",
          "parse-error": "No se pudo procesar la idea.",
        };
        setErrorMsg(reasons[result.reason] ?? "Error al descartar la idea.");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Done state
  // ---------------------------------------------------------------------------

  if (uiState === "done") {
    return (
      // aria-label not supported on plain <div>; use role="status" + aria-live instead (FRD-13 a11y)
      <div data-testid="discard-done" role="status" style={DONE_STYLE} aria-live="polite">
        Descartada
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Idle trigger + confirm/reason MODAL
  //
  // The trigger button is always rendered (no layout jump). Confirming opens the
  // shared Modal core (DR-057) — the owner rule (FRD-02): reveal-more is a modal,
  // never an inline expand-that-pushes-content. While in-flight the modal stays
  // open showing the disabled "Descartando…" state; backdrop/✕/Escape are inert
  // until the action settles.
  // ---------------------------------------------------------------------------

  const modalOpen = uiState === "confirming" || isInFlight;

  return (
    <div style={WRAPPER_STYLE}>
      {/* Trigger — the shared Button (DR-057), danger outline (secondary + danger tone). */}
      <Button
        variant="secondary"
        tone="danger"
        size="sm"
        onClick={handleTrigger}
        ariaLabel="Descartar idea"
        data-testid="discard-button"
      >
        <i className="ti ti-trash" aria-hidden="true" style={{ fontSize: "14px" }} />
        Descartar idea
      </Button>
      {errorMsg !== null && (
        <p data-testid="discard-error" style={ERROR_STYLE} role="alert" aria-live="assertive">
          {errorMsg}
        </p>
      )}

      <Modal
        open={modalOpen}
        onClose={handleClose}
        title="Descartar idea"
        testIdBase="discard"
        width={460}
      >
        {/* Reason capture — optional. <fieldset> groups the prompt (Biome a11y). */}
        <fieldset
          style={REASON_FORM_STYLE}
          aria-label="Motivo del descarte"
          data-testid="discard-reason-form"
        >
          <legend style={REASON_LABEL_STYLE}>
            ¿Por qué la descartas?{" "}
            <span style={REASON_HINT_STYLE}>
              (opcional — ayuda a no recomendarte cosas parecidas)
            </span>
          </legend>
          <div style={TAGS_ROW_STYLE}>
            {DISCARD_REASON_TAGS.map((tag) => {
              const selected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={selected}
                  data-testid={`discard-reason-tag-${tag}`}
                  onClick={() => toggleTag(tag)}
                  disabled={isInFlight}
                  style={selected ? TAG_BTN_SELECTED_STYLE : TAG_BTN_STYLE}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <textarea
            data-testid="discard-reason-text"
            aria-label="Motivo del descarte (texto libre)"
            placeholder="Cuéntame por qué (opcional)…"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            disabled={isInFlight}
            style={TEXTAREA_STYLE}
          />
        </fieldset>

        {/* Confirm / cancel — both the shared Button (DR-057): same component, different
            styles. Confirm = filled danger (primary + danger); cancel = plain secondary. */}
        <fieldset
          style={{ ...CONFIRM_ROW_STYLE, border: "none", padding: 0, margin: 0 }}
          aria-label="Confirmar descarte de idea"
        >
          <Button
            variant="primary"
            tone="danger"
            onClick={handleConfirm}
            disabled={isInFlight}
            ariaLabel="Confirmar descarte de idea"
            data-testid="discard-confirm-button"
          >
            {isInFlight ? "Descartando…" : "Sí, descartar"}
          </Button>
          <Button
            variant="secondary"
            onClick={handleCancel}
            disabled={isInFlight}
            ariaLabel="Cancelar descarte"
            data-testid="discard-cancel-button"
          >
            Cancelar
          </Button>
        </fieldset>
      </Modal>
    </div>
  );
}
