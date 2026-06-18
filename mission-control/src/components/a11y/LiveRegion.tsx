"use client";

/**
 * WO-13-003 — CMP-13-a11y-primitives: LiveRegion component
 *
 * Wraps content in an `aria-live="polite"` region so screen readers announce
 * events (feed updates, toast messages, freshness badge changes) without
 * stealing focus from the current interaction.
 *
 * Traces:
 *   AC-13-008.1 (REQ-13-008) — aria-live="polite" to announce events without
 *   stealing focus.
 *
 * Design decisions:
 *   - role="status" is the semantic shorthand for aria-live="polite" + aria-atomic="true"
 *     in modern AT; we also set both attributes explicitly for maximal compatibility.
 *   - aria-atomic="true": the entire region content is re-announced when any part
 *     changes — prevents partial mid-sentence announcements.
 *   - data-testid="live-region": required by the test suite for targeted queries.
 *   - Stateless: no internal state — renders children directly. No shared references
 *     between instances (WO-04-003 regression: mutation of shared row objects).
 *   - No hardcoded colours, no inline color styles (FRD-13 §3).
 *   - "use client" is required because this component may receive dynamic children
 *     from client-side event streams (feed, toast). It is still safe to render
 *     server-side (no browser API used at module load time).
 */

import type React from "react";
import type { ReactNode } from "react";

export interface LiveRegionProps {
  /**
   * The content to announce. Accepts any ReactNode — string, JSX, arrays, null,
   * undefined. Null/undefined/empty-string are valid (empty announcement = silence).
   */
  children?: ReactNode;
}

/**
 * LiveRegion — aria-live="polite" wrapper.
 *
 * Guarantees:
 *   - aria-live="polite"   (never "assertive" — must not steal focus)
 *   - aria-atomic="true"   (full region re-read on any change)
 *   - role="status"        (semantic live region, consistent with polite + atomic)
 *   - data-testid="live-region"
 *   - No inline colour styles (no hex, no rgb, no hsl)
 *   - Renders null/undefined/empty children without throwing
 *   - Multiple instances are fully independent (no shared module state)
 *
 * AC-13-008.1 / WO-13-003.
 */
export function LiveRegion({ children }: LiveRegionProps): React.JSX.Element {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" data-testid="live-region">
      {children}
    </div>
  );
}
