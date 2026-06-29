"use client";

/**
 * FavoriteButton — a star toggle that marks an idea card as a favourite (CMP-02-favorite-action).
 *
 * A compact, icon-only star button (`ti-star` outline → `ti-star-filled` gold) that the owner
 * clicks to highlight a card in ANY board column. Visual-only: the favourite flag never changes
 * the card status, its column or any pipeline flow (FRD-02 REQ-02-012). The star is BOTH the
 * indicator (its filled/outline shape + `aria-pressed` convey state without relying on colour —
 * accessibility.md) and the control.
 *
 * Optimistic UI (React 19 `useOptimistic`): the star flips immediately on click and auto-reverts
 * if the Server Action returns `{ ok: false }`. The action is injected as a prop so the component
 * is fully testable without Next.js infrastructure (mirrors DiscardButton).
 *
 * Rules (architecture §1/§7, ADR-0003):
 *   - The write is isolated to `lib/favorite/favorite.ts`; this component only triggers it.
 *   - Zero hardcoded colours — favourite uses the `--color-warn` (gold) token, distinct from the
 *     teal accent (recommended / running) and the green ok (building).
 *   - data-testid + Spanish aria-label (single operator, Spanish UI).
 *
 * Traceability:
 *   CMP-02-favorite-action → REQ-02-012
 *   AC-02-012.3 — clicking the star toggles the favourite flag (optimistic) via the Server Action.
 */

import { useOptimistic, useTransition } from "react";
import type { FavoriteResult } from "@/lib/favorite/favorite";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FavoriteButtonProps {
  /** The idea slug — passed to the Server Action as-is. */
  slug: string;
  /** Whether the card is currently a favourite (the server truth). */
  favorite: boolean;
  /**
   * The Server Action to call on toggle. Injected so tests can pass a vi.fn() without
   * Next.js infrastructure. Production callers pass `toggleFavoriteAction` from `app/board/actions`.
   */
  favoriteAction: (slug: string, favorite: boolean) => Promise<FavoriteResult>;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded colour values.
// ---------------------------------------------------------------------------

const BUTTON_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "26px",
  height: "26px",
  padding: 0,
  border: "none",
  borderRadius: "var(--radius-sm, 8px)",
  background: "transparent",
  cursor: "pointer",
  lineHeight: 1,
  transition: "color var(--duration-fast, 150ms), transform var(--duration-fast, 150ms)",
};

const ICON_ACTIVE_STYLE: React.CSSProperties = {
  fontSize: "15px",
  color: "var(--color-warn)",
};

const ICON_IDLE_STYLE: React.CSSProperties = {
  fontSize: "15px",
  color: "var(--color-text3)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Client component: an optimistic star toggle for the favourite flag.
 * Uses `useOptimistic` + `useTransition` for an instant flip that auto-reverts on failure.
 */
export function FavoriteButton({
  slug,
  favorite,
  favoriteAction,
}: FavoriteButtonProps): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  // Optimistic mirror of the server truth: flips instantly, auto-reverts if the action fails
  // (when the transition settles without the underlying `favorite` prop having changed).
  const [optimistic, setOptimistic] = useOptimistic(favorite, (_prev, next: boolean) => next);

  function handleToggle() {
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      await favoriteAction(slug, next);
    });
  }

  const label = optimistic ? "Quitar de favoritas" : "Marcar como favorita";

  return (
    <button
      type="button"
      data-testid="favorite-button"
      aria-pressed={optimistic}
      aria-label={label}
      title={label}
      onClick={handleToggle}
      disabled={isPending}
      style={BUTTON_STYLE}
    >
      <i
        className={optimistic ? "ti ti-star-filled" : "ti ti-star"}
        aria-hidden="true"
        style={optimistic ? ICON_ACTIVE_STYLE : ICON_IDLE_STYLE}
      />
    </button>
  );
}
