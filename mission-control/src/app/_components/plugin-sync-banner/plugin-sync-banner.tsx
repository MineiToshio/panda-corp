"use client";

/**
 * CMP-15-banner — PluginSyncBanner (WO-15-004 Phase 2, DR-057 refactor)
 *
 * KIND="drift" consumer of the ONE shared Banner primitive (src/components/core/Banner/Banner.tsx).
 * This component owns only the drift-specific body (heading copy, 3-reason recall text) and
 * the polling loop. ALL banner chrome (strip shape, left alert-triangle icon, hairline border,
 * command row) comes from the shared Banner — no local BANNER_STYLE/ICON_STYLE/CMD_ROW_STYLE/
 * RECALL_STYLE blocks (AC-15-004.5 / DR-057).
 *
 * Polls `/api/plugin-sync` on mount + on a fixed interval; renders the shared Banner with
 * tone="warn" kind="drift" ONLY when `drift === true`. Self-clears when a re-poll returns
 * drift=false or reason="unknown" (REQ-15-004).
 *
 * Read-only invariant (architecture §7, REQ-15-005): only GET fetches; never executes the
 * update command — it only shows it so the owner can copy and run it.
 *
 * Traceability:
 *   CMP-15-banner  → AC-15-004.1, AC-15-004.2, AC-15-004.3, AC-15-004.4, AC-15-004.5
 *   CMP-15-recall  → AC-15-004.3 (3-step recall sequence)
 *   IF-15-sync     → lib/plugin-sync.ts :: PluginSyncState
 *   CMP-15-route   → /api/plugin-sync (WO-15-003)
 *   Banner         → src/components/core/Banner/Banner.tsx (WO-13-007, DR-057)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Banner } from "@/components/core/Banner/Banner";
import type { PluginSyncState } from "@/lib/plugin-sync/plugin-sync";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Poll every 15 s — fast enough to self-clear when the owner fixes drift. */
const POLL_INTERVAL_MS = 15_000;

/** The only recovery command (REQ-15-003, blueprint §4). */
const UPDATE_CMD = "claude plugin update pandacorp@panda-corp";

/** API endpoint that returns PluginSyncState (CMP-15-route). */
const API_ENDPOINT = "/api/plugin-sync";

// ---------------------------------------------------------------------------
// Banner copy — version-behind is the only state that renders (FRD-15, AC-15-004.6)
// ---------------------------------------------------------------------------

/** Heading shown when the installed version is strictly behind the source version. */
const HEADING = "El plugin instalado está atrás";

/** Recovery sequence: run the update command, then restart the Claude Code session. */
const RECALL = "1) corre el comando · 2) reinicia la sesión de Claude Code";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PluginSyncBanner — CMP-15-banner.
 *
 * Renders through the ONE shared Banner (kind="drift", tone="warn").
 * Manages its own polling loop; renders nothing until drift is confirmed.
 * No props required.
 */
export function PluginSyncBanner(): React.JSX.Element | null {
  const [state, setState] = useState<PluginSyncState | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(API_ENDPOINT);
      if (!res.ok) return;
      const data = (await res.json()) as PluginSyncState;
      setState(data);
    } catch {
      // Network error or JSON parse error — do not update state (no false alarm)
    }
  }, []);

  useEffect(() => {
    void poll();
    intervalRef.current = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [poll]);

  // Render nothing until we have a confirmed drift state (REQ-15-004 / AC-15-004.2)
  if (state === null || !state.drift) {
    return null;
  }

  return (
    // Outer wrapper: provides the stable plugin-sync-banner testid and the aria context.
    // <section aria-label> is a landmark region (role=region) with a Spanish label, satisfying
    // AC-15-004.6. The inner Banner carries role="alert" for the live alert announcement.
    <section data-testid="plugin-sync-banner" aria-label="Aviso de plugin desincronizado">
      {/*
       * The shared Banner (DR-057, WO-13-007) renders:
       *   - left alert-triangle icon (tone="warn")
       *   - heading (reason-appropriate Spanish copy)
       *   - detail one-liner from PluginSyncState
       *   - children slot: the 3-step recall paragraph (data-testid="plugin-sync-recall")
       *   - commandRow: the copyable update command
       * No local BANNER_STYLE/ICON_STYLE/CMD_ROW_STYLE/RECALL_STYLE — all from Banner.
       */}
      <Banner
        tone="warn"
        kind="drift"
        icon="ti-alert-triangle"
        heading={HEADING}
        detail={state.detail}
        commandRow={UPDATE_CMD}
      >
        {/* CMP-15-recall: 3-step recovery sequence (AC-15-004.3) — tokens only */}
        <p
          data-testid="plugin-sync-recall"
          style={{
            fontSize: "0.6875rem",
            opacity: 0.8,
            margin: "calc(var(--space-base, 1rem) * 0.375) 0 0",
          }}
        >
          {RECALL}
        </p>
      </Banner>
    </section>
  );
}
