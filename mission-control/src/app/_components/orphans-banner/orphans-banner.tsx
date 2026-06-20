"use client";

/**
 * CMP-16-banner — OrphansBanner
 *
 * DR-057 refactor: consumes the ONE shared Banner primitive (kind="orphan",
 * tone="warn") — no local BANNER_STYLE/ICON_STYLE/CMD_ROW_STYLE/RECALL_STYLE.
 * ALL banner chrome (strip shape, warn icon, hairline border, dismiss ×,
 * collapse toggle) comes from Banner (src/components/core/Banner/Banner.tsx,
 * WO-13-007).
 *
 * This component contributes only:
 *   - Polling loop + localStorage dismiss logic
 *   - Per-candidate item body: Chip (sin adoptar / falta en portfolio) +
 *     path <code> + hint line + CmdRow (adopt / sync-portfolio)
 *
 * Dismissal is remembered in `localStorage` keyed by absolute `path`
 * (client-local UI state — NOT a factory write, architecture §4.8).
 *
 * Self-clears when a candidate disappears from the probe (adopted/fixed)
 * or is explicitly dismissed (AC-16-004.4).
 *
 * Read-only invariant (architecture §7, REQ-16-005): only GET /api/orphans;
 * no writes, no exec, no adopt/git invocations.
 *
 * Traceability:
 *   CMP-16-banner  → AC-16-004.1 … AC-16-004.8
 *   CMP-16-steps   → per-kind recall (adopt / sync-portfolio)
 *   IF-16-scan     → lib/orphans.ts :: Candidate
 *   CMP-16-route   → /api/orphans (WO-16-003)
 *   Banner         → src/components/core/Banner/Banner.tsx (WO-13-007, DR-057)
 *   Chip           → src/components/core/Chip/Chip.tsx
 *   CmdRow         → src/components/core/CmdRow/CmdRow.tsx
 *   WO-16-004      → FRD-16
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Banner } from "@/components/core/Banner/Banner";
import { Chip } from "@/components/core/Chip/Chip";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
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

/** Commands per kind (CMP-16-steps, AC-16-004.1 / AC-16-004.2). */
const CMD_ADOPT = "/pandacorp:adopt";
const CMD_SYNC = "/pandacorp:sync-portfolio";

/** Above this many candidates, collapse the rest (calm dashboard, FRD-16 collapse criterion). */
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
// Per-kind helpers (CMP-16-steps)
// ---------------------------------------------------------------------------

function hintForKind(kind: Candidate["kind"]): string {
  return kind === "orphan"
    ? "tiene .pandacorp/ pero nunca pasó por el handoff — adóptalo bajo la fábrica"
    : "ya es proyecto de la fábrica (tiene .pandacorp/status.yaml), solo falta su fila en el portfolio";
}

function commandForKind(kind: Candidate["kind"]): string {
  return kind === "orphan" ? CMD_ADOPT : CMD_SYNC;
}

// ---------------------------------------------------------------------------
// Single orphan item body (rendered inside the shared Banner's children slot)
// ---------------------------------------------------------------------------

interface OrphanItemBodyProps {
  candidate: Candidate;
  onDismiss: (path: string) => void;
}

/** Per-candidate body rendered inside the shared Banner's children slot. */
function OrphanItemBody({ candidate, onDismiss }: OrphanItemBodyProps): React.JSX.Element {
  const { name, path, kind } = candidate;
  const command = commandForKind(kind);
  const hint = hintForKind(kind);

  const itemStyle: React.CSSProperties = {
    borderTop: "0.5px solid var(--color-border, var(--hairline, 1px))",
    paddingTop: "9px",
    paddingBottom: "4px",
  };

  const nameRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap" as const,
    marginBottom: "3px",
  };

  const pathStyle: React.CSSProperties = {
    fontSize: "11px",
    color: "var(--color-text3, var(--color-text2))",
    background: "var(--color-panel, Canvas)",
    padding: "1px 6px",
    borderRadius: "4px",
    fontFamily: "var(--font-mono, monospace)",
    userSelect: "all" as const,
  };

  const hintStyle: React.CSSProperties = {
    fontSize: "11px",
    color: "var(--color-warn)",
    marginBottom: "4px",
  };

  const dismissStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    opacity: 0.7,
    padding: "0.125rem 0.25rem",
    fontSize: "1rem",
    lineHeight: 1,
    color: "inherit",
    flexShrink: 0,
  };

  return (
    <div data-testid={`orphan-item-${name}`} style={itemStyle}>
      <div style={nameRowStyle}>
        <span style={{ fontSize: "13px", fontWeight: 500 }}>{name}</span>
        {/* Case chip: icon+text, not color alone (AC-16-004.8 / FRD-13) */}
        {kind === "orphan" ? (
          <Chip tone="warn">sin adoptar</Chip>
        ) : (
          <Chip tone="info">falta en portfolio</Chip>
        )}
        {/* Monospace selectable path (AC-16-004.1, AC-16-004.3) */}
        <code data-testid={`orphan-path-${name}`} style={pathStyle}>
          {path}
        </code>
        {/* Per-item dismiss (AC-16-004.4) */}
        <button
          type="button"
          data-testid={`orphan-dismiss-${name}`}
          aria-label={`Descartar aviso de proyecto ${name}`}
          style={dismissStyle}
          onClick={() => {
            persistDismissal(path);
            onDismiss(path);
          }}
        >
          {/* × — state conveyed by button label, not color alone (FRD-13) */}
          &#x00D7;
        </button>
      </div>

      {/* Hint line — context for the case (AC-16-004.1 / AC-16-004.2) */}
      <div style={hintStyle}>{hint}</div>

      {/* CmdRow + CopyButton (CMP-16-steps, AC-16-004.1/AC-16-004.3) */}
      <div data-testid={`orphan-copy-cmd-${name}`}>
        <CmdRow command={command} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OrphansBanner — the exported component (CMP-16-banner)
// ---------------------------------------------------------------------------

/**
 * OrphansBanner — CMP-16-banner (DR-057 refactor).
 *
 * kind="orphan" consumer of the shared Banner (tone="warn", dismissible).
 * Self-contained: manages its own polling loop, per-path localStorage dismissals,
 * and overflow collapse (>2 candidates). Renders nothing until at least one
 * non-dismissed candidate is confirmed. No props required.
 */
export function OrphansBanner(): React.JSX.Element | null {
  // Full list of candidates from the last poll (null = not yet fetched)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  // In-memory set of locally dismissed paths (mirrors localStorage — avoids re-reads)
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set<string>());
  // Whether the overflow collapse is expanded (calm dashboard, FRD-16 collapse criterion)
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

  // Filter: only candidates still returned by the probe AND not locally dismissed
  // (self-clear: candidates absent from the latest probe are automatically removed — AC-16-004.4)
  const visible = candidates.filter((c) => !dismissed.has(c.path) && !isDismissed(c.path));

  // AC-16-004.7: empty candidate list → renders nothing (no empty shell)
  if (visible.length === 0) {
    return null;
  }

  // Overflow collapse: show only the first COLLAPSE_THRESHOLD items unless expanded
  // (calm dashboard — prevents wall-of-banners regression, AC-16-004.5 / REQ-16-003.2)
  const shown = expanded ? visible : visible.slice(0, COLLAPSE_THRESHOLD);
  const hiddenCount = visible.length - shown.length;

  const toggleStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    opacity: 0.85,
    padding: "0.25rem 0",
    fontSize: "0.75rem",
    fontWeight: 500,
    textDecoration: "underline",
    color: "inherit",
    marginTop: "0.25rem",
    display: "block",
  };

  return (
    // Outer section: stable testid + aria landmark (same pattern as PluginSyncBanner)
    <section data-testid="orphans-banner" aria-label="Avisos de proyectos sin registrar">
      {/*
       * THE shared Banner (DR-057, WO-13-007) renders:
       *   - left warn-triangle icon (tone="warn", banner-icon testid)
       *   - heading "Proyectos de Pandacorp sin registrar"
       *   - detail: scope note (.pandacorp/ only; foreign folders never listed)
       *   - children slot: visible candidate items + overflow toggle
       *   - dismissible × (banner-dismiss testid — dismisses ALL candidates, AC-16-004.4)
       * No local BANNER_STYLE/ICON_STYLE/CMD_ROW_STYLE/RECALL_STYLE (AC-16-004.7, DR-057).
       */}
      <Banner
        tone="warn"
        kind="orphan"
        heading="Proyectos de Pandacorp sin registrar"
        detail="Detecté carpetas con .pandacorp/ que no están en tu portfolio. (Las carpetas ajenas de ~/Proyectos/ nunca se listan aquí.)"
        dismissible
        onDismiss={() => {
          // Dismiss ALL visible candidates at once (whole-banner dismiss)
          for (const c of visible) {
            persistDismissal(c.path);
            handleDismiss(c.path);
          }
        }}
      >
        {/* Per-candidate items (collapsed to COLLAPSE_THRESHOLD unless expanded) */}
        {shown.map((candidate) => (
          <OrphanItemBody key={candidate.path} candidate={candidate} onDismiss={handleDismiss} />
        ))}

        {/* Overflow collapse toggle — scoped inside Banner's children slot (AC-16-004.5) */}
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
              : `Ver ${hiddenCount} proyecto${hiddenCount === 1 ? "" : "s"} más sin registrar`}
          </button>
        )}
      </Banner>
    </section>
  );
}
