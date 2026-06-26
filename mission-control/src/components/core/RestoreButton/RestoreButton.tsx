"use client";

/**
 * RestoreButton — "Volver a agregar" (un-discard) action.
 *
 * The inverse of DiscardButton: brings a discarded idea back to the board, restoring
 * the status it had BEFORE it was discarded and clearing its discard reason. Unlike
 * discard (destructive → two-step confirm), restore is non-destructive, so it's a single
 * click with optimistic UI (pending → done; reverts to idle with an error on failure).
 *
 * Rules (architecture §1/§7, extended by ADR-002): the Server Action is injected as a
 * prop so the component is testable; zero hardcoded colors; data-testid on the button;
 * Spanish copy.
 *
 * Traceability:
 *   CMP-02-restore-action → REQ-02-007
 *   AC-02-007.3 — WHEN the owner presses "Volver a agregar" on a discarded card, the system
 *                 SHALL restore its prior status and clear discard_reason.
 */

import { useState, useTransition } from "react";
import type { RestoreResult } from "@/lib/discard/restore";

export interface RestoreButtonProps {
  /** The idea slug — passed to the Server Action as-is. */
  slug: string;
  /** Server Action to call (injected for testability). */
  restoreAction: (slug: string) => Promise<RestoreResult>;
}

type UIState = "idle" | "pending" | "done";

const BTN_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  padding: "5px 10px",
  borderRadius: "var(--radius-sm, 8px)",
  fontSize: "12px",
  fontWeight: 500,
  lineHeight: 1.4,
  fontFamily: "var(--font-display, inherit)",
  cursor: "pointer",
  border: "1px solid var(--color-accent-text, var(--color-border-strong))",
  background: "var(--color-accent-bg, var(--color-card))",
  color: "var(--color-accent-text, var(--color-text))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.05), 0 1px 0 var(--color-base)",
  transition: "border-color var(--duration-fast, 150ms), background var(--duration-fast, 150ms)",
};

const BTN_DISABLED_STYLE: React.CSSProperties = {
  ...BTN_STYLE,
  opacity: 0.5,
  cursor: "not-allowed",
};

const DONE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "var(--color-ok, var(--color-text-muted))",
};

const ERROR_STYLE: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "var(--color-danger, currentColor)",
  marginTop: "4px",
  opacity: 0.85,
};

const WRAPPER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "4px",
};

export function RestoreButton({ slug, restoreAction }: RestoreButtonProps): React.JSX.Element {
  const [uiState, setUiState] = useState<UIState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isInFlight = isPending || uiState === "pending";

  function handleRestore() {
    setUiState("pending");
    setErrorMsg(null);
    startTransition(async () => {
      const result = await restoreAction(slug);
      if (result.ok) {
        setUiState("done");
      } else {
        setUiState("idle");
        const reasons: Record<string, string> = {
          "not-found": "La idea no fue encontrada.",
          "parse-error": "No se pudo procesar la idea.",
        };
        setErrorMsg(reasons[result.reason] ?? "Error al volver a agregar la idea.");
      }
    });
  }

  if (uiState === "done") {
    return (
      <div data-testid="restore-done" role="status" style={DONE_STYLE} aria-live="polite">
        <i className="ti ti-check" aria-hidden="true" style={{ fontSize: "14px" }} />
        Devuelta al tablero
      </div>
    );
  }

  return (
    <div style={WRAPPER_STYLE}>
      <button
        type="button"
        className="pc-btn"
        data-testid="restore-button"
        aria-label="Volver a agregar la idea al tablero"
        onClick={handleRestore}
        disabled={isInFlight}
        style={isInFlight ? BTN_DISABLED_STYLE : BTN_STYLE}
      >
        <i className="ti ti-arrow-back-up" aria-hidden="true" style={{ fontSize: "14px" }} />
        {isInFlight ? "Devolviendo…" : "Volver a agregar"}
      </button>
      {errorMsg !== null && (
        <p data-testid="restore-error" style={ERROR_STYLE} role="alert" aria-live="assertive">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
