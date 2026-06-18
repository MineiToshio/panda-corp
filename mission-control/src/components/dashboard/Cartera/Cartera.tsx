"use client";

/**
 * CMP-18-cartera — Build & portfolio cards grid (WO-18-004, FRD-18)
 *
 * Renders one card per active/shipped project with phase+version, WO progress,
 * age-in-stage, next command, and live/stale/blocker/shipped flags.
 * When there are no active projects, renders a first-action card instead of
 * a blank section (AC-18-004.6, REQ-18-020).
 *
 * Design constraints (FRD-13 / styling-and-ui.md):
 *   - Zero hardcoded colors — only CSS custom properties from @theme.
 *   - Flags conveyed by text + role, not color alone (a11y, AC-18-004.7).
 *   - Spanish copy throughout.
 *   - data-testid on all interactive and landmark elements.
 *
 * "use client" required because CopyButton is a client component.
 *
 * Traceability:
 *   AC-18-004.1  phase+version, WO progress, age-in-stage, next command
 *   AC-18-004.2  "en vivo" / "sin señal" freshness indicator
 *   AC-18-004.3  "estancado" staleness indicator
 *   AC-18-004.4  inline blocker reason
 *   AC-18-004.5  "estable · en operación" for shipped projects
 *   AC-18-004.6  first-action card when portfolio is empty
 *   AC-18-004.7  Spanish + a11y + data-testid surface
 */

import type { WoProgress } from "@/app/(dashboard)/_lib/card";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import type { Phase } from "@/lib/status/status";

// ---------------------------------------------------------------------------
// Types (re-exported so consumers can build CardData without importing card.ts)
// ---------------------------------------------------------------------------

export type { WoProgress };

export type CardData = {
  name: string;
  phase: Phase;
  version: string;
  woProgress: WoProgress;
  ageInStageDays: number | undefined;
  nextCommand: string;
  isLive: boolean;
  isNoSignal: boolean;
  isStalled: boolean;
  isShipped: boolean;
  blockerReason: string | undefined;
  lastEventAt: string | undefined;
};

export type CarteraProps = {
  /** Derived cards for each active/shipped project. Empty → first-action card. */
  cards: CardData[];
};

// ---------------------------------------------------------------------------
// Constants (Spanish labels)
// ---------------------------------------------------------------------------

const FIRST_ACTION_COMMAND = "/pandacorp:spec <idea>";

/** Map a Phase to a short Spanish display label. */
const PHASE_LABELS: Readonly<Record<Phase, string>> = {
  product: "Producto",
  design: "Diseño",
  architecture: "Arquitectura",
  implementation: "Implementación",
  release: "Release",
  operation: "Operación",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** "en vivo" freshness badge. */
function LiveBadge(): React.JSX.Element {
  return (
    <span
      data-testid="cartera-flag-live"
      role="status"
      aria-label="Construcción en vivo"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        fontSize: "0.75rem",
        color: "var(--color-text)",
        opacity: 0.8,
      }}
    >
      <span aria-hidden="true">●</span>
      en vivo
    </span>
  );
}

/** "sin señal" no-signal badge — text+icon, never color alone (a11y). */
function NoSignalBadge({ lastEventAt }: { lastEventAt: string | undefined }): React.JSX.Element {
  return (
    <span
      data-testid="cartera-flag-nosignal"
      role="status"
      aria-label="Sin señal — construcción sin actividad reciente"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        fontSize: "0.75rem",
        color: "var(--color-text)",
        opacity: 0.7,
      }}
    >
      <span aria-hidden="true" role="img">
        ⚠
      </span>
      sin señal
      {lastEventAt !== undefined && (
        <span style={{ fontSize: "0.7rem", opacity: 0.6 }}>
          {" "}
          (último: {formatShortDate(lastEventAt)})
        </span>
      )}
    </span>
  );
}

/** "estancado" staleness badge — text+icon, never color alone (a11y). */
function StalledBadge({
  ageInStageDays,
}: {
  ageInStageDays: number | undefined;
}): React.JSX.Element {
  return (
    <span
      data-testid="cartera-flag-stalled"
      role="status"
      aria-label="Proyecto estancado en esta fase"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        fontSize: "0.75rem",
        color: "var(--color-text)",
        opacity: 0.7,
      }}
    >
      <span aria-hidden="true" role="img">
        ⏸
      </span>
      estancado
      {ageInStageDays !== undefined && (
        <span style={{ fontSize: "0.7rem", opacity: 0.6 }}> ({ageInStageDays}d)</span>
      )}
    </span>
  );
}

/** Inline blocker reason strip. */
function BlockerReason({ reason }: { reason: string }): React.JSX.Element {
  return (
    <p
      data-testid="cartera-blocker-reason"
      role="alert"
      aria-label="Razón del bloqueo"
      style={{
        margin: "0.5rem 0 0",
        fontSize: "0.75rem",
        color: "var(--color-text)",
        opacity: 0.75,
        fontFamily: "monospace",
      }}
    >
      <span aria-hidden="true">✗ </span>
      {reason}
    </p>
  );
}

/** Derive a stable slug-like testid from a project name. */
function nameToTestId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Format an ISO date string to a short local date+time (es-ES). */
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// ProjectCard — one card per project
// ---------------------------------------------------------------------------

function ProjectCard({ card }: { card: CardData }): React.JSX.Element {
  const testId = `cartera-card-${nameToTestId(card.name)}`;
  const phaseLabel = PHASE_LABELS[card.phase] ?? card.phase;

  return (
    <article
      data-testid={testId}
      aria-label={`Proyecto ${card.name}`}
      style={{
        padding: "1rem",
        border: "1px solid color-mix(in oklch, var(--color-text) 20%, transparent)",
        borderRadius: "0.5rem",
        background: "color-mix(in oklch, var(--color-surface) 80%, transparent)",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      {/* Header: name + version + phase */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "0.5rem",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>{card.name}</h3>
        <span
          style={{
            fontSize: "0.75rem",
            opacity: 0.6,
            whiteSpace: "nowrap",
          }}
        >
          {card.version}
        </span>
      </header>

      {/* Phase label */}
      <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.7 }}>
        {phaseLabel}
        {card.ageInStageDays !== undefined && (
          <span style={{ marginLeft: "0.5rem", opacity: 0.6 }}>
            · {card.ageInStageDays}d en esta fase
          </span>
        )}
      </p>

      {/* Shipped status */}
      {card.isShipped && (
        <p
          style={{
            margin: 0,
            fontSize: "0.8rem",
            fontWeight: 500,
          }}
        >
          estable · en operación
        </p>
      )}

      {/* WO progress */}
      <p
        style={{
          margin: 0,
          fontSize: "0.8rem",
          fontVariantNumeric: "tabular-nums",
          opacity: 0.8,
        }}
      >
        WOs: {card.woProgress.done}/{card.woProgress.total} ({card.woProgress.pct}%)
      </p>

      {/* Freshness + staleness flags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {card.isLive && <LiveBadge />}
        {card.isNoSignal && <NoSignalBadge lastEventAt={card.lastEventAt} />}
        {card.isStalled && <StalledBadge ageInStageDays={card.ageInStageDays} />}
      </div>

      {/* Blocker reason */}
      {card.blockerReason !== undefined && <BlockerReason reason={card.blockerReason} />}

      {/* Next command */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginTop: "0.25rem",
        }}
      >
        <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>Siguiente:</span>
        <code
          style={{
            fontSize: "0.75rem",
            background: "color-mix(in oklch, var(--color-text) 10%, transparent)",
            padding: "0.125rem 0.375rem",
            borderRadius: "0.25rem",
          }}
        >
          {card.nextCommand}
        </code>
        <CopyButton value={card.nextCommand} />
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// FirstActionCard — shown when the portfolio is empty (AC-18-004.6)
// ---------------------------------------------------------------------------

function FirstActionCard(): React.JSX.Element {
  return (
    <article
      data-testid="cartera-first-action"
      aria-label="Primera acción — crea tu primer proyecto"
      style={{
        padding: "1.5rem",
        border: "1px dashed color-mix(in oklch, var(--color-text) 30%, transparent)",
        borderRadius: "0.5rem",
        background: "color-mix(in oklch, var(--color-surface) 60%, transparent)",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        alignItems: "flex-start",
      }}
    >
      <p style={{ margin: 0, fontWeight: 600, fontSize: "0.95rem" }}>
        Todavía no hay proyectos activos
      </p>
      <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.7 }}>
        Crea la spec de tu primera idea para empezar.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <code
          style={{
            fontSize: "0.8rem",
            background: "color-mix(in oklch, var(--color-text) 10%, transparent)",
            padding: "0.125rem 0.375rem",
            borderRadius: "0.25rem",
          }}
        >
          {FIRST_ACTION_COMMAND}
        </code>
        <CopyButton value={FIRST_ACTION_COMMAND} />
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Cartera — main export (CMP-18-cartera)
// ---------------------------------------------------------------------------

/**
 * CMP-18-cartera — "Construcción y cartera" section.
 *
 * Renders:
 * - A card grid with one ProjectCard per active/shipped project, OR
 * - A FirstActionCard when `cards` is empty (AC-18-004.6 — never blank).
 *
 * Each ProjectCard surfaces:
 *   phase+version, WO progress, age-in-stage, next command,
 *   freshness (en vivo / sin señal), staleness (estancado),
 *   inline blocker reason, shipped state (estable · en operación).
 */
export function Cartera({ cards }: CarteraProps): React.JSX.Element {
  return (
    <section aria-labelledby="cartera-heading-id">
      <h2
        id="cartera-heading-id"
        data-testid="cartera-heading"
        style={{
          fontSize: "1rem",
          fontWeight: 600,
          margin: "0 0 1rem",
        }}
      >
        Construcción y cartera
      </h2>

      {cards.length === 0 ? (
        <FirstActionCard />
      ) : (
        <div
          data-testid="cartera-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {cards.map((card) => (
            <ProjectCard key={card.name} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}
