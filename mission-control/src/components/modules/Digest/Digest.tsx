"use client";

/**
 * CMP-18-digest — "Desde tu última visita" client component (WO-18-001, FRD-18).
 *
 * Owns the `visto_hasta` marker in localStorage. On mount reads the persisted
 * marker; a visit/refresh does NOT advance it. Only "marcar visto" advances it.
 *
 * Architecture §4.8: `visto_hasta` is client-local UI state — never a write to
 * the factory, projects, or status.yaml.
 *
 * Props:
 *   - `events`  — the capped event tail from `lib/events` (read by the server).
 *   - `nowMs`   — the current timestamp in ms (injected for testability).
 *
 * Traceability:
 *   REQ-18-005 → AC-18-001.1  change-framed items via IF-18-digest
 *   REQ-18-006 → AC-18-001.2  localStorage persistence; visit does NOT advance
 *   REQ-18-007 → AC-18-001.3  "marcar visto" advances the marker
 *   REQ-18-008 → AC-18-001.4  al-día state + last-24h fallback
 *   REQ-18-009 → AC-18-001.5  live count via prop re-render
 */

import { useCallback, useEffect, useState } from "react";
import { computeDigest, type DigestItem } from "@/app/_lib/digest";
import type { Event } from "@/lib/events/events";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** localStorage key for the visto_hasta marker. */
const STORAGE_KEY = "mc:digest:visto_hasta";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read the persisted marker from localStorage. Returns 0 if not set or invalid. */
function readMarker(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

/** Persist the marker to localStorage. Silent on error. */
function writeMarker(ms: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(ms));
  } catch {
    // Preference loss, not data loss — fail silently.
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface DigestItemRowProps {
  item: DigestItem;
}

/** A single event row in the digest list. */
function DigestItemRow({ item }: DigestItemRowProps): React.JSX.Element {
  const { event, isNew, relativeLabel } = item;

  return (
    <li
      data-testid="digest-item"
      data-new={isNew ? "true" : undefined}
      data-dimmed={!isNew ? "true" : undefined}
      className={[
        "flex items-start gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        isNew ? "border border-accent/40 bg-accent/5 text-text" : "opacity-50 text-text",
      ].join(" ")}
      aria-label={`${event.event}${event.project ? ` en ${event.project}` : ""}, ${relativeLabel}`}
    >
      {/* New indicator dot */}
      {isNew && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium leading-snug">
          {event.event}
          {event.project && <span className="ml-1 font-normal opacity-70">· {event.project}</span>}
        </p>
        <p className="mt-0.5 text-xs opacity-60">{relativeLabel}</p>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface DigestProps {
  /** The capped event tail (read by the server; passed as a prop). */
  events: readonly Event[];
  /** Current timestamp in ms — injected for testability. Defaults to Date.now(). */
  nowMs?: number;
}

/**
 * Digest — "Desde tu última visita" section.
 *
 * Client component: reads/writes the `visto_hasta` marker in localStorage.
 * A refresh or mere visit does NOT advance the marker.
 * Only "marcar visto" advances it.
 */
export function Digest({ events, nowMs: nowMsProp }: DigestProps): React.JSX.Element {
  const nowMs = nowMsProp ?? Date.now();

  // Read initial marker from localStorage on mount (AC-18-001.2).
  // useState initializer runs once on mount — does NOT advance the marker.
  const [markerMs, setMarkerMs] = useState<number>(() => readMarker());

  // Re-sync marker from localStorage if it was externally updated
  // (e.g. another tab advanced it). Runs only on mount.
  useEffect(() => {
    const stored = readMarker();
    setMarkerMs(stored);
  }, []);

  // Derive digest from current events + marker (reactive to prop changes → AC-18-001.5).
  const { newEvents, last24h, atDia } = computeDigest(events, markerMs, nowMs);
  const newCount = newEvents.length;

  // "Marcar visto" — advance the marker to now (AC-18-001.3).
  const handleMarkSeen = useCallback(() => {
    const next = nowMs;
    writeMarker(next);
    setMarkerMs(next);
  }, [nowMs]);

  return (
    <section aria-label="Desde tu última visita" className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-text">Desde tu última visita</h2>

        <div className="flex items-center gap-2">
          {/* Live new-event count badge (AC-18-001.3, AC-18-001.5) */}
          {newCount > 0 && (
            <span
              role="status"
              aria-live="polite"
              aria-label={`${newCount} evento${newCount !== 1 ? "s" : ""} nuevo${newCount !== 1 ? "s" : ""}`}
              className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-base"
            >
              {newCount}
            </span>
          )}

          {/* "Marcar visto" button (AC-18-001.3) */}
          {newCount > 0 && (
            <button
              type="button"
              data-testid="marcar-visto-btn"
              onClick={handleMarkSeen}
              className="rounded-md border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Marcar visto
            </button>
          )}
        </div>
      </div>

      {/* Al día state (AC-18-001.4) */}
      {atDia && (
        <p className="text-sm font-medium text-accent">
          <span aria-hidden="true">✓</span> <span>Al día</span>
        </p>
      )}

      {/* New events list (AC-18-001.3) */}
      {newEvents.length > 0 && (
        <ul aria-label="Eventos nuevos" className="space-y-1">
          {newEvents.map((item) => (
            <DigestItemRow key={`${item.event.at}-${item.event.event}`} item={item} />
          ))}
        </ul>
      )}

      {/* Last-24h fallback (AC-18-001.4) — shown in al-día state, dimmed */}
      {last24h.length > 0 && (
        <div>
          {atDia && (
            <p className="mb-1 text-xs font-medium uppercase tracking-wide opacity-50">
              Últimas 24 h
            </p>
          )}
          <ul aria-label="Actividad en las últimas 24 horas" className="space-y-1">
            {last24h.map((item) => (
              <DigestItemRow key={`${item.event.at}-${item.event.event}`} item={item} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
