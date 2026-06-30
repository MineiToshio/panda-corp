"use client";
/**
 * GamificationLedgerSync — transparent fire-and-forget ledger snapshot (WO-09-006)
 *
 * This component has NO visible UI. It exists solely to call
 * `snapshotGamificationLedger` once on mount (after the page renders), ensuring the
 * gamification ledger is updated with the latest live outcomes without blocking
 * the render or increasing Time to First Byte.
 *
 * Mount it anywhere in the Server Component tree that has access to `liveOutcomes`
 * (e.g. `app/page.tsx`). Because it is a `"use client"` component, its `useEffect`
 * runs after hydration — safely after the page is painted (fire-and-forget, AC-09-006.2).
 *
 * Traceability:
 *   AC-09-006.2 — snapshot-on-exceed, fire-and-forget, MUST NOT block render
 */

import { useEffect } from "react";
import { snapshotGamificationLedger } from "@/app/_actions/snapshotLedger";
import type { GuildOutcomes } from "@/lib/gamification/gamification";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type GamificationLedgerSyncProps = {
  /**
   * The live guild outcomes derived from the current portfolio state.
   * Passed from the Server Component so the client component needs no data read.
   */
  readonly liveOutcomes: GuildOutcomes;
};

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
export function GamificationLedgerSync({ liveOutcomes }: GamificationLedgerSyncProps): null {
  useEffect(() => {
    // Fire-and-forget: never await, never re-trigger on re-render.
    // The void cast suppresses the "floating promise" linter warning — this is
    // intentional (AC-09-006.2: MUST NOT block the render).
    void snapshotGamificationLedger(liveOutcomes).catch(() => {
      // Silently swallow action errors — fire-and-forget; page must never crash.
    });
  }, [liveOutcomes]); // Dep on liveOutcomes: snapshot fires once per distinct live state

  return null;
}
