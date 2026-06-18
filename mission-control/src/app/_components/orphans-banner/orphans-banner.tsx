"use client";

/**
 * CMP-16-banner — OrphansBanner
 *
 * Polls `/api/orphans` on mount + on a fixed interval; renders one dismissible
 * banner per candidate (orphan → adopt; unlisted → sync-portfolio) with the
 * project name, path and the copyable command. Collapses to a compact stacked
 * view when several candidates are present.
 *
 * Dismissal is remembered in `localStorage` keyed by absolute `path`
 * (client-local UI state — NOT a factory write, architecture §4.8).
 *
 * Self-clears when a candidate disappears from the probe (adopted/fixed) or is
 * explicitly dismissed by the owner (AC-16-004.4).
 *
 * Read-only invariant (architecture §7, REQ-16-005): only GET requests to
 * `/api/orphans`. No writes, no exec, no adopt/git invocations.
 *
 * Traceability:
 *   CMP-16-banner  → AC-16-004.1 … AC-16-004.7
 *   CMP-16-steps   → per-kind recall (adopt / sync-portfolio)
 *   IF-16-scan     → lib/orphans.ts :: Candidate
 *   CMP-16-route   → /api/orphans (WO-16-003)
 *   CopyButton     → components/CopyButton.tsx (FRD-02)
 *   WO-16-004      → FRD-16
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import type { Candidate } from "@/lib/orphans";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Poll every 30 s — fast enough to self-clear after adoption/sync. */
const POLL_INTERVAL_MS = 30_000;

/** localStorage key prefix for dismissed paths (architecture §4.8). */
const DISMISS_PREFIX = "mc:orphan-dismissed:";

/** API endpoint that returns Candidate[] (CMP-16-route). */
const API_ENDPOINT = "/api/orphans";

/** The command to suggest for each kind of candidate (AC-16-004.1 / AC-16-004.2). */
const CMD_ADOPT = "/pandacorp:adopt";
const CMD_SYNC = "/pandacorp:sync-portfolio";

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

const ITEM_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "calc(var(--space-base, 1rem) * 0.625)",
  maxWidth: "72ch",
  paddingBottom: "calc(var(--space-base, 1rem) * 0.5)",
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

const PATH_STYLE: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: "0.75rem",
  color: "var(--color-warn, oklch(0.70 0.15 60))",
  opacity: 0.9,
  margin: "0.125rem 0 0",
  userSelect: "all",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
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

const DISMISS_BTN_STYLE: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "var(--color-warn, oklch(0.70 0.15 60))",
  opacity: 0.7,
  padding: "0.125rem 0.25rem",
  marginLeft: "auto",
  fontSize: "1rem",
  lineHeight: 1,
  flexShrink: 0,
};

// ---------------------------------------------------------------------------
// localStorage helpers (architecture §4.8)
// ---------------------------------------------------------------------------

function dismissKey(candidatePath: string): string {
  return `${DISMISS_PREFIX}${candidatePath}`;
}

function isDismissed(candidatePath: string): boolean {
  try {
    return localStorage.getItem(dismissKey(candidatePath)) === "1";
  } catch {
    return false;
  }
}

function persistDismissal(candidatePath: string): void {
  try {
    localStorage.setItem(dismissKey(candidatePath), "1");
  } catch {
    // SecurityError / QuotaExceededError — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Per-kind copy helpers (CMP-16-steps)
// ---------------------------------------------------------------------------

function headingForKind(name: string, kind: Candidate["kind"]): string {
  return kind === "orphan"
    ? `Proyecto sin registrar: ${name} — ¿adoptarlo?`
    : `Proyecto con marcador pero fuera del portfolio: ${name}`;
}

function recallForKind(kind: Candidate["kind"]): string {
  return kind === "orphan"
    ? "Abre una sesión en la carpeta y corre /pandacorp:adopt"
    : "Corre /pandacorp:sync-portfolio para sincronizar el portfolio";
}

function commandForKind(kind: Candidate["kind"]): string {
  return kind === "orphan" ? CMD_ADOPT : CMD_SYNC;
}

// ---------------------------------------------------------------------------
// Single orphan item (one per visible candidate)
// ---------------------------------------------------------------------------

interface OrphanItemProps {
  candidate: Candidate;
  onDismiss: (path: string) => void;
}

function OrphanItem({ candidate, onDismiss }: OrphanItemProps): React.JSX.Element {
  const { name, path, kind } = candidate;
  const heading = headingForKind(name, kind);
  const recall = recallForKind(kind);
  const command = commandForKind(kind);

  return (
    <div data-testid={`orphan-item-${name}`} style={ITEM_STYLE}>
      <div style={BODY_STYLE}>
        <p style={HEADING_STYLE}>{heading}</p>

        {/* Absolute path — selectable text (AC-16-004.3) */}
        <p data-testid={`orphan-path-${name}`} style={PATH_STYLE}>
          {path}
        </p>

        {/* Recall steps (CMP-16-steps, AC-16-004.1 / AC-16-004.2) */}
        <p style={RECALL_STYLE}>{recall}</p>

        {/* Command row with CopyButton (AC-16-004.3) */}
        <div style={CMD_ROW_STYLE}>
          <span style={CMD_TEXT_STYLE}>{command}</span>
          {/* Wrapper gives tests a stable testid; CopyButton has its own "copy-button" testid */}
          <span data-testid={`orphan-copy-cmd-${name}`}>
            <CopyButton value={command} label="Copiar" />
          </span>
        </div>
      </div>

      {/* Dismiss button (AC-16-004.4) */}
      <button
        type="button"
        data-testid={`orphan-dismiss-${name}`}
        aria-label={`Descartar aviso de proyecto ${name}`}
        style={DISMISS_BTN_STYLE}
        onClick={() => {
          persistDismissal(path);
          onDismiss(path);
        }}
      >
        {/* × character — state conveyed by icon + button label, not color alone (FRD-13) */}
        &#x00D7;
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OrphansBanner — the exported component (CMP-16-banner)
// ---------------------------------------------------------------------------

/**
 * OrphansBanner — CMP-16-banner.
 *
 * Self-contained: manages its own polling loop and localStorage dismissals.
 * Renders nothing until at least one non-dismissed candidate is confirmed.
 * No props required.
 */
export function OrphansBanner(): React.JSX.Element | null {
  // The full list of candidates from the last poll (null = not yet fetched)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  // In-memory set of locally dismissed paths (mirrors localStorage — avoids re-reads)
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set<string>());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(API_ENDPOINT);
      if (!res.ok) return;
      const data = (await res.json()) as Candidate[];
      setCandidates(data);
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

  const handleDismiss = useCallback((path: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  // Render nothing until we have at least one poll result (AC-16-004.7)
  if (candidates === null) {
    return null;
  }

  // Filter to candidates that are both still returned by the probe AND not dismissed
  // (self-clear: candidates not in the latest probe are automatically gone — AC-16-004.4)
  const visible = candidates.filter((c) => !dismissed.has(c.path) && !isDismissed(c.path));

  // AC-16-004.7: empty candidate list → renders nothing (no empty shell)
  if (visible.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="orphans-banner"
      role="alert"
      aria-label="Avisos de proyectos sin registrar"
      style={BANNER_STYLE}
    >
      {/* Icon — state conveyed by icon + text, not color alone (AC-16-004.6 / FRD-13) */}
      <span data-testid="orphan-icon" style={ICON_STYLE} aria-hidden="true">
        &#9651;{/* ▲ warning triangle, same as PluginSyncBanner */}
      </span>

      {visible.map((candidate) => (
        <OrphanItem key={candidate.path} candidate={candidate} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}
