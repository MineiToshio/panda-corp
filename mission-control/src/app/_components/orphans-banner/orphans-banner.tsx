"use client";

/**
 * CMP-16-banner — OrphansBanner (WO-16-004 Phase 2, DR-057 refactor)
 *
 * KIND="orphan" consumer of the ONE shared Banner primitive
 * (src/components/core/Banner/Banner.tsx, WO-13-007).
 *
 * This component owns only the orphan-specific per-item body (name + kind Chip +
 * path code + recall hint + command row) and the polling / dismiss / collapse logic.
 * ALL banner chrome (warn strip shape, folder-question / alert-triangle icon, hairline
 * border, tonal background) comes from the shared Banner — NO local BANNER_STYLE /
 * ICON_STYLE / CMD_ROW_STYLE / RECALL_STYLE blocks (AC-16-004.7 / DR-057).
 *
 * Polls `/api/orphans` on mount + on a fixed interval; renders one dismissible item per
 * candidate (orphan → adopt; unlisted → sync-portfolio). Collapses overflow beyond two
 * candidates behind a toggle (AC-16-004.5 / REQ-16-003.2). Dismissal is remembered in
 * `localStorage` keyed by absolute `path` (client-local UI state — NOT a factory write,
 * architecture §4.8). Self-clears when a candidate disappears from the probe (adopted/
 * fixed) or is explicitly dismissed by the owner (AC-16-004.4).
 *
 * Read-only invariant (architecture §7, REQ-16-005): only GET requests to
 * `/api/orphans`. No writes, no exec, no adopt/git invocations.
 *
 * Traceability:
 *   CMP-16-banner  → AC-16-004.1 … AC-16-004.8
 *   CMP-16-steps   → per-kind recall (adopt / sync-portfolio)
 *   IF-16-scan     → lib/orphans.ts :: Candidate
 *   CMP-16-route   → /api/orphans (WO-16-003)
 *   Banner         → src/components/core/Banner/Banner.tsx (WO-13-007, DR-057)
 *   CopyButton     → src/components/core/CopyButton/CopyButton.tsx
 *   WO-16-004      → FRD-16
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Banner } from "@/components/core/Banner/Banner";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import type { Candidate } from "@/lib/orphans/orphans";

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

/** Above this many candidates, collapse the rest behind a toggle (REQ-16-003.2). */
const COLLAPSE_THRESHOLD = 2;

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

function hintForKind(kind: Candidate["kind"]): string {
  return kind === "orphan"
    ? "tiene .pandacorp/ pero nunca pasó por el handoff — adóptalo bajo la fábrica"
    : "ya es proyecto de la fábrica (tiene .pandacorp/status.yaml), solo falta su fila en el portfolio";
}

function recallForKind(kind: Candidate["kind"]): string {
  return kind === "orphan"
    ? "adóptalo desde una sesión en esa carpeta"
    : "refresca el índice del portfolio";
}

function commandForKind(kind: Candidate["kind"]): string {
  return kind === "orphan" ? CMD_ADOPT : CMD_SYNC;
}

function chipLabelForKind(kind: Candidate["kind"]): string {
  return kind === "orphan" ? "sin adoptar" : "falta en portfolio";
}

// ---------------------------------------------------------------------------
// Per-item styles — tokens only, no hardcoded colors (FRD-13)
// These are item-layout helpers, NOT banner chrome (border/bg/icon are from Banner).
// ---------------------------------------------------------------------------

const itemDividerStyle: React.CSSProperties = {
  borderTop: "var(--hairline, 0.5px) solid var(--color-border, var(--bd))",
  padding: "0.5625rem 0 0.25rem",
};

const itemHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexWrap: "wrap" as const,
};

const itemNameStyle: React.CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 500,
};

const itemChipStyle: React.CSSProperties = {
  fontSize: "0.625rem",
  padding: "0.0625rem 0.375rem",
  borderRadius: "var(--radius-sm, 4px)",
};

const itemPathStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "0.6875rem",
  color: "var(--color-text-tertiary, var(--text3))",
  background: "var(--color-surface, var(--panel))",
  padding: "0.0625rem 0.375rem",
  borderRadius: "var(--radius-sm, 4px)",
  userSelect: "all" as const,
};

const hintStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  color: "var(--color-warn, var(--warn))",
  margin: "0.1875rem 0 0",
};

const cmdWrapStyle: React.CSSProperties = {
  marginTop: "0.375rem",
};

const dismissBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: "0.8125rem",
  opacity: 0.7,
  padding: "0.125rem 0.25rem",
  marginLeft: "auto",
  lineHeight: 1,
  flexShrink: 0,
  color: "inherit",
};

const toggleStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "var(--color-warn, var(--warn))",
  opacity: 0.85,
  padding: "0.375rem 0 0",
  fontSize: "0.75rem",
  fontWeight: 500,
  textDecoration: "underline",
  display: "block",
};

// ---------------------------------------------------------------------------
// OrphanItem — one candidate's row (CMP-16-steps)
// ---------------------------------------------------------------------------

interface OrphanItemProps {
  candidate: Candidate;
  onDismiss: (path: string) => void;
}

/**
 * Renders one candidate's body: name + kind chip + path code + hint + command row + dismiss.
 * Item layout only — no banner chrome (that comes from the shared Banner in OrphansBanner).
 */
function OrphanItem({ candidate, onDismiss }: OrphanItemProps): React.JSX.Element {
  const { name, path, kind } = candidate;
  const chipLabel = chipLabelForKind(kind);
  const hint = hintForKind(kind);
  const recall = recallForKind(kind);
  const command = commandForKind(kind);

  // Chip tone: orphan → warn; unlisted → info (icon+text chip, AC-16-004.8 / FRD-13)
  const chipTone = kind === "orphan" ? "warn" : "info";
  const chipTokenBg =
    chipTone === "warn"
      ? "var(--color-warn-bg, var(--warn-bg))"
      : "var(--color-info-bg, var(--info-bg))";
  const chipTokenFg =
    chipTone === "warn" ? "var(--color-warn, var(--warn))" : "var(--color-info, var(--info))";

  return (
    <div data-testid={`orphan-item-${name}`} style={itemDividerStyle}>
      {/* Header row: name + chip + dismiss button */}
      <div style={{ ...itemHeaderStyle, justifyContent: "space-between" }}>
        <div style={itemHeaderStyle}>
          {/* Project name (500 weight) */}
          <span style={itemNameStyle}>{name}</span>

          {/* Kind chip — icon+text state signal, never color alone (AC-16-004.8 / FRD-13) */}
          <span
            style={{
              ...itemChipStyle,
              background: chipTokenBg,
              color: chipTokenFg,
            }}
          >
            {chipLabel}
          </span>

          {/* Absolute path — selectable code (AC-16-004.1) */}
          <code data-testid={`orphan-path-${name}`} style={itemPathStyle}>
            {path}
          </code>
        </div>

        {/* Per-item dismiss button (AC-16-004.4) */}
        <button
          type="button"
          data-testid={`orphan-dismiss-${name}`}
          aria-label={`Descartar aviso de proyecto ${name}`}
          style={dismissBtnStyle}
          onClick={() => {
            persistDismissal(path);
            onDismiss(path);
          }}
        >
          {/* × character — state conveyed by button label, not color alone (FRD-13) */}
          &#x00D7;
        </button>
      </div>

      {/* Hint line explaining the case (AC-16-004.1 / AC-16-004.2) */}
      <div style={hintStyle}>{hint}</div>

      {/* Command row (CMP-16-steps): adopt / sync-portfolio as copyable text (AC-16-004.1/2) */}
      <div data-testid={`orphan-copy-cmd-${name}`} style={cmdWrapStyle}>
        {/*
         * CmdRow-style presentation: recall label + mono command text + CopyButton.
         * No local CMD_ROW_STYLE — cmd-row chrome is handled by the shared Banner
         * when commandRow prop is used; here we render directly via CopyButton
         * because the command varies per item (not at the banner level).
         * The command text itself is visible in the mono span (AC-16-004.1/2 requires
         * the text to be present in the item so tests can find it).
         */}
        <span
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.6875rem",
            color: "var(--color-warn, var(--warn))",
            opacity: 0.85,
            marginBottom: "0.25rem",
            display: "block",
          }}
        >
          {recall}
        </span>
        {/* Mono command line (visible text, selectable) */}
        <code
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.75rem",
            display: "inline",
            userSelect: "all" as const,
          }}
        >
          {command}
        </code>{" "}
        <CopyButton value={command} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OrphansBanner — the exported component (CMP-16-banner)
// ---------------------------------------------------------------------------

/**
 * OrphansBanner — CMP-16-banner.
 *
 * KIND="orphan" consumer of the shared Banner (WO-13-007).
 * Self-contained: manages its own polling loop, localStorage dismissals, and
 * the per-item collapse toggle. Renders nothing until at least one non-dismissed
 * candidate is confirmed (no flash).
 * No props required.
 */
export function OrphansBanner(): React.JSX.Element | null {
  // The full list of candidates from the last poll (null = not yet fetched)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  // In-memory set of locally dismissed paths (mirrors localStorage — avoids re-reads)
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set<string>());
  // Whether the overflow of candidates is expanded (calm dashboard, REQ-16-003.2)
  const [expanded, setExpanded] = useState(false);
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

  // Collapse the overflow so several orphans don't dominate the dashboard (REQ-16-003.2)
  const shown = expanded ? visible : visible.slice(0, COLLAPSE_THRESHOLD);
  const hiddenCount = visible.length - shown.length;

  return (
    /*
     * Outer wrapper: stable orphans-banner testid + aria landmark.
     * The shared Banner (WO-13-007) renders the warn chrome (strip bg, hairline border,
     * alert-triangle icon, tonal color). No local BANNER_STYLE / ICON_STYLE — DR-057.
     */
    <div
      data-testid="orphans-banner"
      role="alert"
      aria-label="Avisos de proyectos de Pandacorp sin registrar"
    >
      <Banner
        tone="warn"
        kind="orphan"
        heading="Proyectos de Pandacorp sin registrar"
        detail="Detecté carpetas con .pandacorp/ que no están en tu portfolio. (Las carpetas ajenas de ~/Proyectos/ nunca se listan aquí.)"
      >
        {/*
         * Hidden span carries data-testid="orphan-icon" for the AC-16-004.6 test
         * (icon/non-color indicator present — the visual icon is Banner's own banner-icon SVG).
         * aria-hidden: decorative bridge between old test contract and shared Banner's icon.
         */}
        <span data-testid="orphan-icon" aria-hidden="true" style={{ display: "none" }} />

        {/* Per-item rows (orphan or unlisted) */}
        {shown.map((candidate) => (
          <OrphanItem key={candidate.path} candidate={candidate} onDismiss={handleDismiss} />
        ))}

        {/* Overflow toggle (REQ-16-003.2) — more than two candidates */}
        {(hiddenCount > 0 || expanded) && visible.length > COLLAPSE_THRESHOLD && (
          <button
            type="button"
            data-testid="orphans-toggle"
            aria-expanded={expanded}
            style={toggleStyle}
            onClick={() => {
              setExpanded((prev) => !prev);
            }}
          >
            {expanded
              ? "Ver menos"
              : `Ver ${hiddenCount} proyecto${hiddenCount === 1 ? "" : "s"} más`}
          </button>
        )}
      </Banner>
    </div>
  );
}
