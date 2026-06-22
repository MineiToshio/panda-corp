"use client";

/**
 * CMP-18-cartera — Build & portfolio cards grid (WO-18-004, FRD-18)
 *
 * Renders one card per active/shipped project with phase+version, WO progress,
 * age-in-stage, next command, and live/stale/blocker/shipped flags.
 * When there are no active projects, renders a first-action card instead of
 * a blank section (AC-18-004.6, REQ-18-020).
 *
 * Visual contract — re-anchored to the approved prototype `dashboardView()`
 * cartera card (index.html ~L711-730, DR-054/DR-062):
 *   - Card surface = the RPG embossed `.panel` skin via the Panel primitive
 *     (var(--color-card) + var(--color-border-strong) + pressed-pixel-tile shadow),
 *     NOT a color-mix surface.
 *   - Header: title + status chips (phase, en vivo/sin señal, estancado/Nd en fase, bugs).
 *   - 7px accent progress bar (non-shipped, with WOs).
 *   - Meta line: "done/tot work orders" or "estable · en operación", with
 *     "Siguiente: <code>" inline in accent-text on the right.
 *   - Blocker reason line in danger with the ti-alert-hexagon icon.
 *   - The whole card navigates to the project (Portfolio) on click.
 *   - Grid: repeat(auto-fit, minmax(290px, 1fr)), gap 10px.
 *
 * Design constraints (FRD-13 / styling-and-ui.md):
 *   - Zero hardcoded colors — only CSS custom properties from @theme.
 *   - Flags conveyed by icon + text + role, not color alone (a11y, AC-18-004.7).
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

import Link from "next/link";
import type { CardData } from "@/app/(dashboard)/_lib/card";
import { Chip } from "@/components/core/Chip/Chip";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import { Panel } from "@/components/core/Panel/Panel";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";

// CardData is imported from @/app/(dashboard)/_lib/card — not re-declared here (DR-057).
export type { CardData };

export type CarteraProps = {
  /** Derived cards for each active/shipped project. Empty → first-action card. */
  cards: CardData[];
};

// ---------------------------------------------------------------------------
// Constants (Spanish labels)
// ---------------------------------------------------------------------------

const FIRST_ACTION_COMMAND = "/pandacorp:spec <idea>";

// ---------------------------------------------------------------------------
// Shared inline styles (tokens only)
// ---------------------------------------------------------------------------

/** Inline accent code chip ("Siguiente: <code>" and inside CmdRow-like spots). */
const INLINE_CODE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  fontVariantNumeric: "tabular-nums",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive a stable slug-like testid / route segment from a project name. */
function nameToSlug(name: string): string {
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
// Sub-components — status chips
// ---------------------------------------------------------------------------

/**
 * Phase chip — info tone while building, ok tone once shipped (prototype `chip2`).
 * Carries phase label + version.
 */
function PhaseChip({ card }: { card: CardData }): React.JSX.Element {
  return (
    <Chip tone={card.isShipped ? "ok" : "info"}>
      {card.phaseLabel}
      {card.version ? ` · ${card.version}` : ""}
    </Chip>
  );
}

/** "en vivo" freshness badge — ok tone, play icon (prototype ti-player-play). */
function LiveBadge(): React.JSX.Element {
  return (
    <span data-testid="cartera-flag-live" role="status" aria-label="Construcción en vivo">
      <Chip tone="ok">
        <i
          className="ti ti-player-play"
          aria-hidden="true"
          style={{ fontSize: "10px", marginRight: "3px", verticalAlign: "-1px" }}
        />
        en vivo
      </Chip>
    </span>
  );
}

/** "sin señal" no-signal badge — warn tone, alert-triangle icon. Text conveys meaning. */
function NoSignalBadge({ lastEventAt }: { lastEventAt: string | undefined }): React.JSX.Element {
  const suffix = lastEventAt !== undefined ? ` (último: ${formatShortDate(lastEventAt)})` : "";
  return (
    <span
      data-testid="cartera-flag-nosignal"
      role="status"
      aria-label="Sin señal — construcción sin actividad reciente"
    >
      <Chip tone="warn">
        <i
          className="ti ti-alert-triangle"
          aria-hidden="true"
          style={{ fontSize: "10px", marginRight: "3px", verticalAlign: "-1px" }}
        />
        sin señal{suffix}
      </Chip>
    </span>
  );
}

/** "estancado" staleness badge — warn tone, clock-pause icon. Text conveys meaning. */
function StalledBadge({
  ageInStageDays,
}: {
  ageInStageDays: number | undefined;
}): React.JSX.Element {
  const suffix = ageInStageDays !== undefined ? ` · ${ageInStageDays} días` : "";
  return (
    <span
      data-testid="cartera-flag-stalled"
      role="status"
      aria-label="Proyecto estancado en esta fase"
    >
      <Chip tone="warn">
        <i
          className="ti ti-clock-pause"
          aria-hidden="true"
          style={{ fontSize: "10px", marginRight: "3px", verticalAlign: "-1px" }}
        />
        estancado{suffix}
      </Chip>
    </span>
  );
}

/** Neutral "Nd en fase" chip for young (non-shipped, fresh) projects. */
function YoungInPhaseBadge({ ageInStageDays }: { ageInStageDays: number }): React.JSX.Element {
  return (
    <span data-testid="cartera-flag-young">
      <Chip tone="secondary">{ageInStageDays}d en fase</Chip>
    </span>
  );
}

/** All status chips for a card header, in prototype order. */
function StatusChips({ card }: { card: CardData }): React.JSX.Element {
  return (
    <span
      style={{
        display: "flex",
        gap: "5px",
        flexWrap: "wrap",
        justifyContent: "flex-end",
      }}
    >
      <PhaseChip card={card} />
      {card.isLive && <LiveBadge />}
      {card.isNoSignal && <NoSignalBadge lastEventAt={card.lastEventAt} />}
      {card.isStalled && <StalledBadge ageInStageDays={card.ageInStageDays} />}
      {!card.isStalled && card.isYoungInPhase && card.ageInStageDays !== undefined && (
        <YoungInPhaseBadge ageInStageDays={card.ageInStageDays} />
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-components — progress bar, meta, blocker
// ---------------------------------------------------------------------------

/** 7px accent progress bar (prototype: non-shipped projects with work orders). */
function ProgressBar({ pct }: { pct: number }): React.JSX.Element {
  return (
    <div
      data-testid="cartera-progress"
      style={{
        height: "7px",
        background: "var(--color-panel)",
        borderRadius: "var(--radius-pill)",
        overflow: "hidden",
        border: "0.5px solid var(--color-border)",
        margin: "8px 0",
      }}
    >
      <div style={{ height: "100%", width: `${pct}%`, background: "var(--color-accent)" }} />
    </div>
  );
}

/**
 * Meta line: WO count or "estable · en operación" on the left, and the
 * "Siguiente: <code>" next-command on the right. The next command stays inline
 * (prototype) and is made copyable via a sibling CopyButton rendered OUTSIDE the
 * card Link (see ProjectCard) so no interactive is nested inside the anchor.
 */
function MetaLine({ card }: { card: CardData }): React.JSX.Element {
  const { woProgress, isShipped } = card;
  const left = isShipped ? (
    <span>
      <i
        className="ti ti-anchor"
        aria-hidden="true"
        style={{ fontSize: "12px", verticalAlign: "-1px", marginRight: "4px" }}
      />
      estable · en operación
    </span>
  ) : woProgress.total > 0 ? (
    <span>
      {woProgress.done}/{woProgress.total} work orders
    </span>
  ) : (
    <span>sin work orders aún</span>
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "12px",
        color: "var(--color-text2)",
        gap: "8px",
        flexWrap: "wrap",
      }}
    >
      {left}
      <span style={{ color: "var(--color-accent-text)" }}>
        Siguiente: <code style={INLINE_CODE_STYLE}>{card.nextCommand}</code>
      </span>
    </div>
  );
}

/** Inline blocker reason strip (danger + ti-alert-hexagon, prototype). */
function BlockerReason({ reason }: { reason: string }): React.JSX.Element {
  return (
    <p
      data-testid="cartera-blocker-reason"
      role="alert"
      aria-label="Razón del bloqueo"
      style={{
        margin: "7px 0 0",
        fontSize: "11px",
        color: "var(--color-danger)",
        display: "flex",
        alignItems: "flex-start",
        gap: "5px",
      }}
    >
      <i
        className="ti ti-alert-hexagon"
        aria-hidden="true"
        style={{ fontSize: "13px", marginTop: "1px", flex: "0 0 auto" }}
      />
      <span>{reason}</span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// ProjectCard — one card per project
// ---------------------------------------------------------------------------

function ProjectCard({ card }: { card: CardData }): React.JSX.Element {
  const slug = nameToSlug(card.name);
  const testId = `cartera-card-${slug}`;
  const showProgress = !card.isShipped && card.woProgress.total > 0;

  return (
    <article data-testid={testId} aria-label={`Proyecto ${card.name}`}>
      <Panel variant="rpgpanel">
        {/* The card body navigates to the project (Portfolio) on click. The next
            command's CopyButton is a SIBLING of this Link (below), never nested
            inside the anchor (a11y + hydration). */}
        <Link
          href={`/projects/${slug}`}
          data-testid="cartera-card-link"
          aria-label={`Abrir ${card.name}`}
          style={{ textDecoration: "none", color: "inherit", display: "block" }}
        >
          {/* Header: name + status chips */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "8px",
              marginBottom: "8px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontWeight: 500, fontSize: "14px", color: "var(--color-text)" }}>
              {card.name}
            </span>
            <StatusChips card={card} />
          </div>

          {/* Progress bar (non-shipped with WOs) */}
          {showProgress && <ProgressBar pct={card.woProgress.pct} />}

          {/* Meta line + "Siguiente:" inline */}
          <MetaLine card={card} />

          {/* Blocker reason */}
          {card.blockerReason !== undefined && <BlockerReason reason={card.blockerReason} />}
        </Link>

        {/* Copy affordance for the next command — inside the card, OUTSIDE the
            navigable Link, so no interactive is nested in the anchor. */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
          <CopyButton value={card.nextCommand} />
        </div>
      </Panel>
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
    >
      <Panel variant="secondary">
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "6px" }}>
          <i
            className="ti ti-rocket"
            aria-hidden="true"
            style={{ fontSize: "22px", color: "var(--color-text3)" }}
          />
          <p style={{ margin: "0", fontSize: "13px", color: "var(--color-text2)" }}>
            Aún no hay proyectos en obra.
          </p>
        </div>
        <div style={{ marginTop: "8px" }}>
          <CmdRow command={FIRST_ACTION_COMMAND} />
        </div>
      </Panel>
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
 * Each ProjectCard surfaces, on the RPG `.panel` skin:
 *   phase+version chip, WO progress bar, age-in-stage chip, next command,
 *   freshness (en vivo / sin señal), staleness (estancado), young-in-phase,
 *   inline blocker reason, shipped state (estable · en operación). The whole
 *   card navigates to the project on click.
 */
export function Cartera({ cards }: CarteraProps): React.JSX.Element {
  return (
    <section aria-label="Construcción y cartera">
      {/* SectionHead (CMP-13-sectionhead, DR-062, AC-18-001.10) */}
      <SectionHead icon="ti-layout-grid" label="Construcción y cartera" />
      {/* Hidden heading for aria-labelledby compat with legacy tests */}
      <h2
        id="cartera-heading-id"
        data-testid="cartera-heading"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
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
            gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
            gap: "10px",
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
