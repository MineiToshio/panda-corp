import { Banner } from "@/components/core/Banner/Banner";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import { MEMORY_RAW_NOTES_THRESHOLD, MEMORY_STALE_DAYS_THRESHOLD } from "@/lib/constants";
import type { MemoryHealth as MemoryHealthData } from "@/lib/memory/memory-health";

/**
 * CMP-17-health — MemoryHealth panel (WO-17-005, FRD-17, REQ-17-005).
 *
 * Shows the self-learning-loop health:
 *   - Raw-notes count (factory/_inbox.md + per-project .pandacorp/run/lessons.md lines)
 *   - Candidate-lessons count (status: candidate in factory/memory/)
 *   - Last /pandacorp:memory run time (approximate — mtime proxy, not exact event)
 *   - Staleness nudge WHEN rawNotes >= threshold OR staleDays >= threshold
 *   - First-harvest invite WHEN lastMemoryRunAt === null (fresh factory)
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

/** Icon indicating staleness — text+icon for a11y (not color alone). */
function StaleIcon(): React.JSX.Element {
  return (
    <span
      data-testid="memory-health-stale-icon"
      role="img"
      aria-label="Antigüedad de la memoria"
      style={{ fontSize: "1em" }}
    >
      ⏳
    </span>
  );
}

/** Stat row: label + value. */
function StatRow({
  label,
  value,
  testId,
}: {
  label: string;
  value: React.ReactNode;
  testId: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "0.5rem",
        padding: "0.25rem 0",
      }}
    >
      <span
        style={{
          fontSize: "0.75rem",
          color: "var(--color-text)",
          opacity: 0.6,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span
        data-testid={testId}
        style={{
          fontWeight: 600,
          color: "var(--color-text)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MemoryHealthProps {
  /** Health data from memoryHealth() (lib/memory/memory-health.ts). */
  health: MemoryHealthData;
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
export function MemoryHealth({ health }: MemoryHealthProps): React.JSX.Element {
  const { rawNotes, candidates, lastMemoryRunAt, staleDays } = health;

  // Threshold checks (AC-17-005.2).
  const isRawNotesAbove = rawNotes >= MEMORY_RAW_NOTES_THRESHOLD;
  const isStaleDaysAbove = staleDays !== null && staleDays >= MEMORY_STALE_DAYS_THRESHOLD;
  const shouldNudge = isRawNotesAbove || isStaleDaysAbove;

  // Choose the command for the nudge (harvest if mainly backlog; review if stale/both).
  const nudgeCommand = isStaleDaysAbove ? CMD_REVIEW : CMD_HARVEST;

  // Fresh factory: no memory run ever (AC-17-005.3).
  const isFreshFactory = lastMemoryRunAt === null;

  return (
    <section
      data-testid="memory-health-panel"
      aria-label="Salud del bucle de aprendizaje"
      style={{
        padding: "var(--space-base)",
        borderRadius: "var(--radius)",
        border: "var(--hairline) solid color-mix(in oklch, var(--color-text) 15%, transparent)",
        background: "var(--color-surface)",
        color: "var(--color-text)",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      {/* Heading — the ONE shared SectionHead primitive (DR-062), not a bespoke header */}
      <SectionHead label="Salud de la memoria" icon="ti-brain" />

      {/* Stats grid (AC-17-005.1) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
        <StatRow label="Notas pendientes" value={rawNotes} testId="memory-health-raw-notes" />
        <StatRow label="Candidatas" value={candidates} testId="memory-health-candidates" />
      </div>

      {/* Last-run section — only when there is a signal (AC-17-005.1 + AC-17-005.4) */}
      {!isFreshFactory && lastMemoryRunAt !== null && (
        <div
          data-testid="memory-health-last-run"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--color-text)",
                opacity: 0.6,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Última ejecución{" "}
              <span data-testid="memory-health-last-run-label" style={{ fontStyle: "italic" }}>
                (aprox.)
              </span>
            </span>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
              {formatDate(lastMemoryRunAt)}
            </span>
          </div>

          {/* Staleness row with icon (AC-17-005.5: text + icon, not color alone) */}
          {staleDays !== null && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                fontSize: "0.8125rem",
                opacity: staleDays > 0 ? 1 : 0.7,
              }}
            >
              <StaleIcon />
              <span data-testid="memory-health-stale-days" style={{ color: "var(--color-text)" }}>
                {staleDays === 0 ? "Hoy" : `Hace ${staleDays} día${staleDays === 1 ? "" : "s"}`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* First-harvest invite — fresh factory (AC-17-005.3).
          The ONE shared Banner primitive (DR-057), not a bespoke nudge <div>. */}
      {isFreshFactory && (
        <div data-testid="memory-health-first-harvest">
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
          The ONE shared Banner primitive (DR-057), not a second bespoke banner. */}
      {shouldNudge && !isFreshFactory && (
        <div data-testid="memory-health-nudge">
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
    </section>
  );
}
