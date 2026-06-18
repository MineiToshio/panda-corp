"use client";

/**
 * DiscardButton — Destructive action button (CMP-02-discard-action).
 *
 * Implements the discard flow for an idea card:
 *   1. Idle: shows "Descartar idea" trigger button.
 *   2. Confirming: shows a confirmation step with confirm + cancel buttons.
 *      (Two-step safety net for a destructive action.)
 *   3. Pending: confirm button is disabled while the Server Action is in-flight.
 *   4. Done: shows a "Descartada" success indicator (optimistic UI resolved).
 *   5. Error: reverts to idle and shows an error message when the action fails.
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
 *   Depends on WO-02-009 (discardIdeaAction, app/board/actions.ts)
 */

import { useState, useTransition } from "react";
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
   */
  discardAction: (slug: string) => Promise<DiscardResult>;
}

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

const BASE_BTN_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  padding: "calc(var(--spacing, 0.25rem) * 1) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius, 0.5rem)",
  fontSize: "0.75rem",
  fontWeight: 500,
  fontFamily: "inherit",
  cursor: "pointer",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  background: "transparent",
  color: "var(--color-text-muted, currentColor)",
  minHeight: "44px", // a11y: touch target ≥44px (FRD-13)
  minWidth: "44px",
};

const DISCARD_BTN_STYLE: React.CSSProperties = {
  ...BASE_BTN_STYLE,
  color: "var(--color-error, currentColor)",
  borderColor: "var(--color-error, currentColor)",
  opacity: 0.8,
};

const CONFIRM_BTN_STYLE: React.CSSProperties = {
  ...BASE_BTN_STYLE,
  background: "var(--color-error, currentColor)",
  color: "var(--color-on-error, Canvas)",
  borderColor: "var(--color-error, currentColor)",
  fontWeight: 700,
};

const CONFIRM_BTN_DISABLED_STYLE: React.CSSProperties = {
  ...CONFIRM_BTN_STYLE,
  opacity: 0.5,
  cursor: "not-allowed",
};

const CANCEL_BTN_STYLE: React.CSSProperties = {
  ...BASE_BTN_STYLE,
};

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
  color: "var(--color-error, currentColor)",
  marginTop: "calc(var(--spacing, 0.25rem) * 1)",
  opacity: 0.85,
};

const WRAPPER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Client component: "Descartar idea" button with a two-step confirmation flow.
 * Uses useTransition for React 19 concurrent-safe pending state.
 */
export function DiscardButton({ slug, discardAction }: DiscardButtonProps): React.JSX.Element {
  const [uiState, setUiState] = useState<UIState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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
  }

  function handleConfirm() {
    setUiState("pending");
    setErrorMsg(null);

    startTransition(async () => {
      const result = await discardAction(slug);

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
  // Confirming / Pending state (confirmation step)
  // ---------------------------------------------------------------------------

  if (uiState === "confirming" || isInFlight) {
    return (
      <div style={WRAPPER_STYLE}>
        {/* <fieldset> is the semantic equivalent of role="group" for a button group (Biome a11y) */}
        <fieldset
          style={{ ...CONFIRM_ROW_STYLE, border: "none", padding: 0, margin: 0 }}
          aria-label="Confirmar descarte de idea"
        >
          <button
            type="button"
            data-testid="discard-confirm-button"
            aria-label="Confirmar descarte de idea"
            onClick={handleConfirm}
            disabled={isInFlight}
            style={isInFlight ? CONFIRM_BTN_DISABLED_STYLE : CONFIRM_BTN_STYLE}
          >
            {isInFlight ? "Descartando…" : "Sí, descartar"}
          </button>
          <button
            type="button"
            data-testid="discard-cancel-button"
            aria-label="Cancelar descarte"
            onClick={handleCancel}
            disabled={isInFlight}
            style={
              isInFlight
                ? { ...CANCEL_BTN_STYLE, opacity: 0.4, cursor: "not-allowed" }
                : CANCEL_BTN_STYLE
            }
          >
            Cancelar
          </button>
        </fieldset>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Idle state (default)
  // ---------------------------------------------------------------------------

  return (
    <div style={WRAPPER_STYLE}>
      <button
        type="button"
        data-testid="discard-button"
        aria-label="Descartar idea"
        onClick={handleTrigger}
        style={DISCARD_BTN_STYLE}
      >
        Descartar idea
      </button>
      {errorMsg !== null && (
        <p data-testid="discard-error" style={ERROR_STYLE} role="alert" aria-live="assertive">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
