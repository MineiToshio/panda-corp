"use client";
/**
 * GamificationLedgerSync — transparent fire-and-forget ledger snapshot (WO-09-006)
 *
 * This component has NO visible UI. It exists solely to call
 * `snapshotGamificationLedger` once on mount (after the page renders), ensuring the
 * the server-side ledger is reconciled from canonical files without blocking
 * the render or increasing Time to First Byte.
 *
 * It is mounted once in the root layout. Because it is a `"use client"` component, its `useEffect`
 * runs after hydration — safely after the page is painted (fire-and-forget, AC-09-006.2).
 *
 * Traceability:
 *   AC-09-006.2 — snapshot-on-exceed, fire-and-forget, MUST NOT block render
 */

import { useEffect } from "react";
import { snapshotGamificationLedger } from "@/app/_actions/snapshotLedger";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Transparent ledger-sync component. Renders nothing; triggers the ledger
 * snapshot exactly once on mount via a fire-and-forget `useEffect`.
 *
 * Errors from the server action are silently swallowed (the action itself handles
 * them) so a write failure can never crash the page.
 */
export function GamificationLedgerSync(): null {
  useEffect(() => {
    // Fire-and-forget: never await, never re-trigger on re-render.
    // The void cast suppresses the "floating promise" linter warning — this is
    // intentional (AC-09-006.2: MUST NOT block the render).
    void snapshotGamificationLedger().catch(() => {
      // Silently swallow action errors — fire-and-forget; page must never crash.
    });
  }, []);

  return null;
}
