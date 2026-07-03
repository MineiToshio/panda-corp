"use client";

/**
 * DiscardBacklogButton — discard action for a backlog item (CMP-22-discard-backlog, FRD-22).
 *
 * Mirrors `DiscardChangeButton`'s state machine (idle → confirming → pending → done/error,
 * `useTransition`, prop-injected Server Action) but WITHOUT its own `Modal`: `BacklogDetail`
 * (the caller) already renders inside the shared `Modal` from `BacklogPanel`, so a second,
 * nested modal would be confusing (modal-on-modal). Instead, confirmation is an inline
 * "¿Seguro? Sí / No" swap.
 *
 * On success, calls `onDiscarded` so the caller can close the parent modal (the item no
 * longer shows in the default Abiertos/En curso view once discarded).
 *
 * Traceability:
 *   CMP-22-discard-backlog → REQ-22-007
 *   AC-22-007.1 — WHEN the owner discards an open/doing backlog item, the system SHALL
 *                 rewrite `status: discarded` in the `.md` frontmatter.
 */

import { useState, useTransition } from "react";
import { Button } from "@/components/core/Button/Button";
import type { DiscardBacklogResult } from "@/lib/backlog/discard-backlog";

export interface DiscardBacklogButtonProps {
  /** The item's `id` field (e.g. `"BL-0007"`). */
  id: string;
  /**
   * The Server Action to call on confirmation. Injected as a prop so tests can pass a
   * vi.fn() without Next.js infrastructure. Production callers pass `discardBacklogAction`.
   */
  discardAction: (id: string) => Promise<DiscardBacklogResult>;
  /** Called after a successful discard (e.g. so the caller closes the detail modal). */
  onDiscarded?: () => void;
}

type UIState = "idle" | "confirming" | "done";

const WRAPPER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "6px",
};

const CONFIRM_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const CONFIRM_LABEL_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text2)",
};

const ERROR_STYLE: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "var(--color-danger)",
  opacity: 0.85,
};

const DONE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "var(--color-text-muted, currentColor)",
  opacity: 0.7,
};

/**
 * Client component: "Descartar" button with an inline (non-modal) confirm step.
 * Uses useTransition for React 19 concurrent-safe pending state.
 */
export function DiscardBacklogButton({
  id,
  discardAction,
  onDiscarded,
}: DiscardBacklogButtonProps): React.JSX.Element {
  const [uiState, setUiState] = useState<UIState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleTrigger() {
    setErrorMsg(null);
    setUiState("confirming");
  }

  function handleCancel() {
    setUiState("idle");
    setErrorMsg(null);
  }

  function handleConfirm() {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await discardAction(id);
      if (result.ok) {
        setUiState("done");
        onDiscarded?.();
      } else {
        setUiState("idle");
        const reasons: Record<string, string> = {
          "not-found": "El item no fue encontrado.",
          "parse-error": "No se pudo procesar el archivo del item.",
          "not-discardable": "Este item ya no se puede descartar.",
        };
        setErrorMsg(reasons[result.reason] ?? "Error al descartar el item.");
      }
    });
  }

  if (uiState === "done") {
    return (
      <div data-testid="discard-backlog-done" role="status" style={DONE_STYLE} aria-live="polite">
        Descartado
      </div>
    );
  }

  if (uiState === "confirming" || isPending) {
    return (
      <div style={WRAPPER_STYLE}>
        <div style={CONFIRM_ROW_STYLE}>
          <span style={CONFIRM_LABEL_STYLE}>¿Descartar este item?</span>
          <Button
            variant="primary"
            tone="danger"
            size="sm"
            onClick={handleConfirm}
            disabled={isPending}
            ariaLabel="Confirmar descarte del item"
            data-testid="discard-backlog-confirm-button"
          >
            {isPending ? "Descartando…" : "Sí, descartar"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancel}
            disabled={isPending}
            ariaLabel="Cancelar descarte"
            data-testid="discard-backlog-cancel-button"
          >
            Cancelar
          </Button>
        </div>
        {errorMsg !== null && (
          <p
            data-testid="discard-backlog-error"
            style={ERROR_STYLE}
            role="alert"
            aria-live="assertive"
          >
            {errorMsg}
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={WRAPPER_STYLE}>
      <Button
        variant="secondary"
        tone="danger"
        size="sm"
        onClick={handleTrigger}
        ariaLabel="Descartar item del backlog"
        data-testid="discard-backlog-button"
      >
        <i className="ti ti-trash" aria-hidden="true" style={{ fontSize: "14px" }} />
        Descartar
      </Button>
      {errorMsg !== null && (
        <p
          data-testid="discard-backlog-error"
          style={ERROR_STYLE}
          role="alert"
          aria-live="assertive"
        >
          {errorMsg}
        </p>
      )}
    </div>
  );
}
