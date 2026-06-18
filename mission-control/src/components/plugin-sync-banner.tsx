"use client";

/**
 * CMP-15-banner — PluginSyncBanner
 *
 * Polls `/api/plugin-sync` on mount + on a fixed interval; renders a persistent
 * amber warning banner ONLY when `drift === true`. Clears itself automatically when
 * a subsequent poll returns `drift === false` (REQ-15-004).
 *
 * Read-only invariant (architecture §7, REQ-15-005): this component never calls
 * any API with a non-GET method, never executes any shell command. It only shows
 * the recovery command and lets the owner copy + run it.
 *
 * Visual reference: prototype/index.html `pluginBanner()` (lines 563–567) — amber
 * `--warn` panel, alert-triangle icon, 3-step recall (commit→run→restart), command row.
 *
 * Traceability:
 *   CMP-15-banner  → AC-15-004.1, AC-15-004.2, AC-15-004.3, AC-15-004.4, AC-15-004.5
 *   CMP-15-recall  → AC-15-004.3 (3-step recall sequence)
 *   IF-15-sync     → lib/plugin-sync.ts :: PluginSyncState
 *   CMP-15-route   → /api/plugin-sync (WO-15-003)
 *   CopyButton     → components/CopyButton.tsx (FRD-02)
 *   WO-15-004      → FRD-15
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import type { PluginSyncState } from "@/lib/plugin-sync";

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
// Styles — zero hardcoded colors (CSS custom properties only, FRD-13)
// ---------------------------------------------------------------------------

const BANNER_STYLE: React.CSSProperties = {
  background: "var(--color-warn-bg, oklch(var(--warn-bg, 0.35 0.05 90) / 0.15))",
  borderTop: "var(--hairline, 1px) solid var(--color-warn, oklch(0.70 0.15 60))",
  borderBottom: "var(--hairline, 1px) solid var(--color-warn, oklch(0.70 0.15 60))",
  padding: "calc(var(--space-base, 1rem) * 0.75) var(--space-base, 1rem)",
  width: "100%",
};

const INNER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "calc(var(--space-base, 1rem) * 0.625)",
  maxWidth: "72ch",
};

const ICON_STYLE: React.CSSProperties = {
  color: "var(--color-warn, oklch(0.70 0.15 60))",
  flexShrink: 0,
  marginTop: "0.125rem",
  fontSize: "1.25rem",
  lineHeight: 1,
};

const BODY_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const HEADING_STYLE: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "var(--color-warn, oklch(0.70 0.15 60))",
  margin: 0,
};

const DETAIL_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--color-warn, oklch(0.70 0.15 60))",
  opacity: 0.9,
  margin: "0.125rem 0 0",
};

const RECALL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  color: "var(--color-warn, oklch(0.70 0.15 60))",
  opacity: 0.8,
  margin: "calc(var(--space-base, 1rem) * 0.375) 0 0",
};

const CMD_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--space-base, 1rem) * 0.5)",
  marginTop: "calc(var(--space-base, 1rem) * 0.5)",
  padding: "0.25rem calc(var(--space-base, 1rem) * 0.5)",
  background: "var(--color-surface-card, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-warn, oklch(0.70 0.15 60))",
  borderRadius: "var(--radius, 0.5rem)",
};

const CMD_TEXT_STYLE: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: "0.75rem",
  color: "var(--color-warn, oklch(0.70 0.15 60))",
  flex: 1,
  userSelect: "all",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

// ---------------------------------------------------------------------------
// Heading copy per reason (Spanish, AC-15-004.5)
// ---------------------------------------------------------------------------

function headingForReason(reason: PluginSyncState["reason"]): string {
  switch (reason) {
    case "uncommitted":
      return "Plugin desincronizado — hay cambios sin commitear";
    case "behind":
      return "El plugin instalado está atrás";
    case "both":
      return "Plugin desincronizado — atrás y con cambios sin commitear";
    default:
      return "Plugin desincronizado";
  }
}

// ---------------------------------------------------------------------------
// Recall sequence copy (blueprint §4, REQ-15-003)
// The recall always ends with: run command → restart Claude Code session.
// When dirty (uncommitted/both), step 1 is "commitea los cambios".
// ---------------------------------------------------------------------------

function recallForReason(reason: PluginSyncState["reason"]): string {
  const commitStep =
    reason === "uncommitted" || reason === "both" ? "1) commitea los cambios · " : "";
  const runStep = reason === "uncommitted" || reason === "both" ? "2" : "1";
  const restartStep = reason === "uncommitted" || reason === "both" ? "3" : "2";
  return `${commitStep}${runStep}) corre el comando · ${restartStep}) reinicia la sesión de Claude Code`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PluginSyncBanner — CMP-15-banner.
 *
 * Self-contained: manages its own polling loop and renders nothing until
 * drift is confirmed. No props required.
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

  const heading = headingForReason(state.reason);
  const recall = recallForReason(state.reason);

  return (
    <div
      data-testid="plugin-sync-banner"
      role="alert"
      aria-label="Aviso de plugin desincronizado"
      style={BANNER_STYLE}
    >
      <div style={INNER_STYLE}>
        {/* Alert icon — state conveyed by icon + text, not color alone (AC-15-004.5 / FRD-13) */}
        <span data-testid="plugin-sync-icon" style={ICON_STYLE} aria-hidden="true">
          &#9651;{/* ▲ warning triangle, fallback for ti-alert-triangle */}
        </span>

        <div style={BODY_STYLE}>
          {/* Heading */}
          <p style={HEADING_STYLE}>{heading}</p>

          {/* Detail one-liner from the state (e.g. "instalado abc1234 · hay cambios…") */}
          <p style={DETAIL_STYLE}>{state.detail}</p>

          {/* 3-step recall (CMP-15-recall) */}
          <p data-testid="plugin-sync-recall" style={RECALL_STYLE}>
            {recall}
          </p>

          {/* Command row with CopyButton (AC-15-004.3) */}
          <div style={CMD_ROW_STYLE}>
            <span style={CMD_TEXT_STYLE}>{UPDATE_CMD}</span>
            {/* Wrapper gives tests a stable testid; CopyButton has its own "copy-button" testid */}
            <span data-testid="plugin-sync-copy-cmd">
              <CopyButton value={UPDATE_CMD} label="Copiar" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
