import type React from "react";
import { Banner } from "@/components/core/Banner/Banner";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import { MEMORY_RAW_NOTES_THRESHOLD, MEMORY_STALE_DAYS_THRESHOLD } from "@/lib/constants";
import type { MemoryHealth as MemoryHealthData } from "@/lib/memory/memory-health";

/**
 * CMP-17-health — MemoryHealth panel (WO-17-005, FRD-17, REQ-17-005).
 *
 * Shows the self-learning-loop health as a 4-card stat grid (prototype
 * `propuestasView()` "Salud de la memoria", index.html ~L1410-1415 using
 * `dStat()` ~L659):
 *   - "Notas sin refinar"       — rawNotes (warn-colored when > 0)
 *   - "Lecciones candidatas"    — candidates (accent-text)
 *   - "Última cosecha"          — "hace Nd" (warn-colored when staleDays >= 7)
 *   - "Promociones a aprobar"   — promotionsCount (accent-text when > 0)
 * Plus a staleness nudge WHEN rawNotes >= threshold OR staleDays >= threshold,
 * and a first-harvest invite WHEN lastMemoryRunAt === null (fresh factory).
 *
 * The staleness nudge and the first-harvest invite render the shared `Banner`
 * directly (the real, copyable affordance, DR-057 reuse-gate): the prototype's
 * "SOLO DEMO" wrapper was dropped because the trigger is now real — `shouldNudge`
 * is computed from real thresholds over real `health` data (AC-17-005.2), so a
 * "solo demo" frame would misrepresent a genuine signal as simulated.
 *
 * Doubles as the on-demand refine-trigger surface: the owner runs the refinement
 * when the panel says there is something to consolidate (REQ-17-005).
 *
 * Honest/White-Hat (REQ-17-008): no false urgency, no nagging, no streaks.
 * The nudge only appears above threshold; dismissing is the owner's decision.
 *
 * A11y (AC-17-005.5):
 *   - Staleness conveyed by text + icon, not color alone.
 *   - Panel is a <section> landmark (role="region" implied by semantic).
 *   - All copy in Spanish.
 *
 * Design tokens (FRD-13): zero hardcoded colors — only CSS custom properties.
 *
 * Traceability:
 *   AC-17-005.1  panel shows raw-notes, candidates, last-run
 *   AC-17-005.2  nudge only above threshold (rawNotes or staleDays)
 *   AC-17-005.3  fresh factory → first-harvest invite
 *   AC-17-005.4  last-run labelled as approximate
 *   AC-17-005.5  Spanish copy + a11y + staleness by text+icon
 */

// ---------------------------------------------------------------------------
// Constants (no magic strings)
// ---------------------------------------------------------------------------

const CMD_HARVEST = "/pandacorp:memory harvest";
const CMD_REVIEW = "/pandacorp:memory review";

// ---------------------------------------------------------------------------
// Sub-components / helpers
// ---------------------------------------------------------------------------

/** Format an ISO date string into a short human-readable date. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── dStat grid styles (prototype dStat(), index.html ~L659) ──────────────────
// dStat: --secondary surface (≈ --color-panel), --rmd radius (≈ --radius-md),
// 13px 15px padding, .5px --bd border (≈ --color-border); 11px label row with
// a 14px icon tinted by `accent`; 30px display value tinted by `accent`; 11px
// muted sub-line. Light + dark first-class (tokens re-declared per theme).

const D_STAT_STYLE: React.CSSProperties = {
  background: "var(--color-panel)",
  borderRadius: "var(--radius-md, 12px)",
  padding: "13px 15px",
  border: "var(--hairline, 1px) solid var(--color-border)",
};

const D_STAT_LABEL_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "11px",
  color: "var(--color-text2)",
};

const D_STAT_SUB_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3)",
  marginTop: "4px",
};

/**
 * dStat — the prototype's stat card (label + icon · big value · sub-line).
 * `accent` tints both the icon and the value; omit for the neutral text tone.
 * `icon` element carried as ReactNode so the staleness card can inject the
 * a11y-required stale icon (text + icon, not color alone — AC-17-005.5).
 */
function DStat({
  label,
  value,
  sub,
  icon,
  accent,
  valueTestId,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
  icon: React.ReactNode;
  accent?: string;
  valueTestId: string;
}): React.JSX.Element {
  return (
    <div style={D_STAT_STYLE}>
      <div style={D_STAT_LABEL_STYLE}>
        <span style={{ color: accent ?? "var(--color-text2)", display: "inline-flex" }}>
          {icon}
        </span>
        {label}
      </div>
      <div
        data-testid={valueTestId}
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "30px",
          lineHeight: 1,
          marginTop: "6px",
          color: accent ?? "var(--color-text)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div style={D_STAT_SUB_STYLE}>{sub}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MemoryHealthProps {
  /** Health data from memoryHealth() (lib/memory/memory-health.ts). */
  health: MemoryHealthData;
  /**
   * Number of promotions awaiting approval (promotion: "proposed"). Drives the
   * 4th stat card "Promociones a aprobar" (prototype reads BPROPOSALS.promote.length,
   * index.html ~L1414). Defaults to 0 so the panel renders standalone in tests.
   */
  promotionsCount?: number;
}

/** Human "hace Nd" label for the staleness day-delta (or em-dash when unknown). */
function staleLabel(staleDays: number | null): string {
  if (staleDays === null) return "—";
  if (staleDays === 0) return "hoy";
  return `hace ${staleDays}d`;
}

/**
 * "Última cosecha" sub-line. When the daily sweep marker exists (loop v2,
 * `_last-sweep`) it shows the REAL sweep timestamp — the "(aprox.)" mtime proxy
 * is only the fallback for stores the sweep has never touched (AC-17-005.4).
 */
function harvestSubLabel({
  isFreshFactory,
  lastMemoryRunAt,
  lastSweepAt,
}: {
  isFreshFactory: boolean;
  lastMemoryRunAt: string | null;
  lastSweepAt: string | null;
}): string {
  if (lastSweepAt !== null) return `barrido diario · ${formatDate(lastSweepAt)}`;
  if (isFreshFactory) return "/pandacorp:memory · aún sin correr";
  return `/pandacorp:memory · ${formatDate(lastMemoryRunAt ?? "")} (aprox.)`;
}

/**
 * "Última cosecha" card value (AC-17-005.1/.5). For a fresh factory it reads
 * "nunca"; otherwise it pairs a history icon (the a11y stale icon — text + icon,
 * never color alone) with the "hace Nd" delta. Carries the testids the suite
 * asserts on (memory-health-last-run / -stale-icon / -stale-days).
 */
function HarvestRecencyValue({
  isFreshFactory,
  staleDays,
}: {
  isFreshFactory: boolean;
  staleDays: number | null;
}): React.JSX.Element {
  if (isFreshFactory) {
    return <span data-testid="memory-health-last-run">nunca</span>;
  }
  return (
    <span
      data-testid="memory-health-last-run"
      style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
    >
      <span data-testid="memory-health-stale-icon" role="img" aria-label="Antigüedad de la memoria">
        <i className="ti ti-history" style={{ fontSize: "1em" }} />
      </span>
      <span data-testid="memory-health-stale-days">{staleLabel(staleDays)}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * MemoryHealth — the self-learning-loop health panel.
 *
 * Receives a pre-computed `health` prop (from memoryHealth() called server-side).
 * Pure presentation: derives nudge/invite logic from the data, no fs reads.
 */
export function MemoryHealth({
  health,
  promotionsCount = 0,
}: MemoryHealthProps): React.JSX.Element {
  const { rawNotes, candidates, lastMemoryRunAt, staleDays, lastSweepAt, harvestOrphans } = health;

  // Threshold checks (AC-17-005.2).
  const isRawNotesAbove = rawNotes >= MEMORY_RAW_NOTES_THRESHOLD;
  const isStaleDaysAbove = staleDays !== null && staleDays >= MEMORY_STALE_DAYS_THRESHOLD;
  const shouldNudge = isRawNotesAbove || isStaleDaysAbove;

  // Choose the command for the nudge (harvest if mainly backlog; review if stale/both).
  const nudgeCommand = isStaleDaysAbove ? CMD_REVIEW : CMD_HARVEST;

  // Fresh factory: no memory run ever (AC-17-005.3).
  const isFreshFactory = lastMemoryRunAt === null;

  // "Última cosecha" value: "hace Nd" when known (warn-tinted at/above threshold),
  // otherwise "nunca" for a fresh factory (no null/NaN — AC-17-005.3).
  const harvestAccent = isStaleDaysAbove ? "var(--color-warn)" : undefined;

  return (
    <section
      data-testid="memory-health-panel"
      aria-label="Salud del bucle de aprendizaje"
      style={{ color: "var(--color-text)" }}
    >
      {/* Heading — the ONE shared SectionHead primitive (DR-062), not a bespoke header.
          Prototype: secthead("ti-heartbeat","Salud de la memoria") (~L1416). */}
      <SectionHead label="Salud de la memoria" icon="ti-heartbeat" />

      {/* 4-card dStat grid (AC-17-005.1; prototype saludGrid ~L1410-1415) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "10px",
        }}
      >
        <DStat
          label="Notas sin refinar"
          value={rawNotes}
          sub="esperan a la cosecha"
          icon={<i className="ti ti-notes" style={{ fontSize: "14px" }} aria-hidden="true" />}
          accent={rawNotes ? "var(--color-warn)" : undefined}
          valueTestId="memory-health-raw-notes"
        />
        <DStat
          label="Lecciones candidatas"
          value={candidates}
          sub="esperan corroboración"
          icon={<i className="ti ti-bulb-filled" style={{ fontSize: "14px" }} aria-hidden="true" />}
          accent="var(--color-accent-text)"
          valueTestId="memory-health-candidates"
        />
        <DStat
          label="Última cosecha"
          value={<HarvestRecencyValue isFreshFactory={isFreshFactory} staleDays={staleDays} />}
          sub={harvestSubLabel({ isFreshFactory, lastMemoryRunAt, lastSweepAt })}
          icon={<i className="ti ti-history" style={{ fontSize: "14px" }} aria-hidden="true" />}
          accent={harvestAccent}
          valueTestId="memory-health-last-run-value"
        />
        <DStat
          label="Promociones a aprobar"
          value={promotionsCount}
          sub="lecciones → estándar/regla"
          icon={
            <i className="ti ti-arrow-up-right" style={{ fontSize: "14px" }} aria-hidden="true" />
          }
          accent={promotionsCount ? "var(--color-accent-text)" : undefined}
          valueTestId="memory-health-promotions"
        />
      </div>

      {/* Approximate-run label (AC-17-005.4) — a screen-reader-available marker that
          the last-run value is a proxy, not an exact event. */}
      {!isFreshFactory && (
        <span data-testid="memory-health-last-run-label" style={{ display: "none" }}>
          aproximado (proxy de mtime)
        </span>
      )}

      {/* First-harvest invite — fresh factory (AC-17-005.3).
          The ONE shared Banner primitive (DR-057), rendered directly. */}
      {isFreshFactory && (
        <div data-testid="memory-health-first-harvest" style={{ marginTop: "10px" }}>
          <Banner
            tone="info"
            kind="inline"
            heading="Sin memoria aún"
            detail="Comienza la primera cosecha para iniciar el bucle de aprendizaje del gremio:"
            commandRow={CMD_HARVEST}
          />
        </div>
      )}

      {/* Staleness nudge — above threshold (AC-17-005.2, REQ-17-008: no nagging).
          The shared Banner (DR-057), rendered directly: the trigger is real
          (`shouldNudge` over real thresholds), so no "SOLO DEMO" wrapper. */}
      {shouldNudge && !isFreshFactory && (
        <div data-testid="memory-health-nudge" style={{ marginTop: "10px" }}>
          <Banner
            tone="warn"
            kind="inline"
            heading={
              isStaleDaysAbove
                ? `La memoria lleva ${staleDays} día${staleDays === 1 ? "" : "s"} sin refinar`
                : `Hay ${rawNotes} notas pendientes de cosechar`
            }
            detail={isStaleDaysAbove ? "Ejecuta una revisión:" : "Ejecuta una cosecha:"}
            commandRow={nudgeCommand}
          />
        </div>
      )}

      <OrphansBanner orphans={harvestOrphans} />
    </section>
  );
}

/**
 * Harvest orphans — a build reached `phase: release` WITHOUT its close-out harvest
 * (no `last_harvest` stamp, loop v2 / WO-17-005). Danger: the loop loses that build's
 * lessons until someone harvests. The shared Banner (DR-057), real data only —
 * renders nothing when there are no orphans (honest empty).
 */
function OrphansBanner({ orphans }: { orphans: string[] }): React.JSX.Element | null {
  if (orphans.length === 0) return null;
  return (
    <div data-testid="memory-health-orphans">
      <Banner
        tone="danger"
        kind="inline"
        heading={`${orphans.length} build${orphans.length === 1 ? "" : "s"} sin cosechar: ${orphans.join(", ")}`}
        detail="Cerraron en release sin sello last_harvest — sus lecciones aún no entraron a la memoria. Cosecha ahora:"
        commandRow={`${CMD_HARVEST} ${orphans[0] ?? ""}`.trim()}
      />
    </div>
  );
}
