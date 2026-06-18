"use client";

/**
 * CampaignPipeline — La Campaña: the 6-phase pipeline view (CMP-02-campaign-pipeline).
 *
 * Traceability:
 *   CMP-02-campaign-pipeline → REQ-02-010
 *   AC-02-010.1 — 6-phase pipeline in order inside a labelled container.
 *   AC-02-010.3 — done / current / locked state by position vs activePhase.
 *   AC-02-010.4 — per-phase ficha: description + LEE/ESCRIBE + the WHOLE team.
 *   AC-02-010.5 — build phase "Entrar a La Fragua" calls onEnterForge(slug).
 *   AC-02-010.6 — read-only: no write, no network, no fs, no Claude call.
 *   AC-02-010.7 — locked future phases render a graceful locked/empty state.
 *
 * Static phase model (PHASES, TeamMember, PhaseDefinition) lives in ./phases.ts.
 * "use client" is required because this component tracks selected-phase state
 * (useState) and handles click events.
 *
 * Design rules (AGENTS.md):
 *   - Zero hardcoded color values — all via CSS custom properties.
 *   - data-testid on every significant interactive element.
 *   - Spanish aria-labels and user-facing copy.
 *   - Read-only: no writes, no fs calls, no network calls, no Claude calls.
 */

import { useState } from "react";
import type { CampaignPhase } from "@/lib/campaign/campaign";
import type { PhaseDefinition } from "./phases";
import { PHASES } from "./phases";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Props for CampaignPipeline. */
export interface CampaignPipelineProps {
  /** The project/idea slug — forwarded to onEnterForge (AC-02-010.5). */
  slug: string;
  /** Active phase index 0–5, derived from phaseFromStatus (WO-02-011). */
  activePhase: CampaignPhase;
  /**
   * Host-navigation callback wired to goToParty (WO-02-012).
   * Called when the user activates "Entrar a La Fragua" in the build phase.
   * @param slug - the project/idea slug.
   */
  onEnterForge: (slug: string) => void;
}

// ---------------------------------------------------------------------------
// Phase state type
// ---------------------------------------------------------------------------

type PhaseState = "done" | "current" | "locked";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the display state of a phase by its index vs the active phase.
 * @param index - Phase index (0–5).
 * @param activePhase - The active campaign phase index.
 * @returns "done" if index < activePhase, "current" if equal, "locked" if greater.
 */
function getPhaseState(index: number, activePhase: CampaignPhase): PhaseState {
  if (index < activePhase) return "done";
  if (index === activePhase) return "current";
  return "locked";
}

function phaseBadgeLabel(state: PhaseState): string {
  if (state === "done") return "✓ Completada";
  if (state === "current") return "● Activa";
  return "🔒 Bloqueada";
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; no hardcoded color values.
// ---------------------------------------------------------------------------

const ROOT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 4)",
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  background: "var(--color-surface-panel, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
};

const CONTAINER_HEADING_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  margin: 0,
};

const PHASES_LIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  listStyle: "none",
  margin: 0,
  padding: 0,
};

function getPhaseButtonStyle(state: PhaseState): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "calc(var(--spacing, 0.25rem) * 3)",
    width: "100%",
    padding: "calc(var(--spacing, 0.25rem) * 3)",
    borderRadius: "var(--radius, 0.5rem)",
    border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
    background: "var(--color-surface, Canvas)",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    fontSize: "0.875rem",
    transition: "opacity 0.15s ease",
  };

  if (state === "current") {
    return {
      ...base,
      border: "2px solid var(--color-accent, currentColor)",
      background: "var(--color-surface-panel, var(--color-surface, Canvas))",
      boxShadow: "0 0 0 2px var(--color-accent-muted, var(--color-accent, currentColor))",
    };
  }

  if (state === "locked") {
    return { ...base, opacity: 0.5 };
  }

  return base;
}

const PHASE_NAME_STYLE: React.CSSProperties = {
  fontWeight: 600,
  color: "var(--color-text, currentColor)",
  flex: 1,
};

const PHASE_STATE_BADGE_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
};

const FICHA_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 4)",
  padding: "calc(var(--spacing, 0.25rem) * 4)",
  background: "var(--color-surface, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "var(--radius, 0.5rem)",
};

const FICHA_SECTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  margin: 0,
};

const FICHA_SECTION_VALUE_STYLE: React.CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--color-text, currentColor)",
  lineHeight: 1.5,
  margin: 0,
};

const FICHA_LOCKED_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 2)",
  alignItems: "center",
  padding: "calc(var(--spacing, 0.25rem) * 6) 0",
};

const TEAM_MEMBER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  padding: "calc(var(--spacing, 0.25rem) * 2) calc(var(--spacing, 0.25rem) * 3)",
  background: "var(--color-surface-panel, var(--color-surface, Canvas))",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.75)",
};

const TEAM_MEMBER_ROLE_KEY_STYLE: React.CSSProperties = {
  fontSize: "0.625rem",
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
};

const TEAM_MEMBER_LABEL_STYLE: React.CSSProperties = {
  fontWeight: 700,
  fontSize: "0.8125rem",
  color: "var(--color-accent, currentColor)",
};

const TEAM_MEMBER_WHAT_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  lineHeight: 1.5,
};

const ENTER_FORGE_BUTTON_STYLE: React.CSSProperties = {
  padding: "calc(var(--spacing, 0.25rem) * 2) calc(var(--spacing, 0.25rem) * 4)",
  background: "var(--color-accent, currentColor)",
  color: "var(--color-accent-foreground, Canvas)",
  border: "none",
  borderRadius: "var(--radius, 0.5rem)",
  fontWeight: 700,
  fontSize: "0.875rem",
  cursor: "pointer",
  fontFamily: "inherit",
  alignSelf: "flex-start",
};

const FICHA_SUBSECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
};

// ---------------------------------------------------------------------------
// FichaContent — the content shown when a phase is clicked.
// ---------------------------------------------------------------------------

interface FichaContentProps {
  phase: PhaseDefinition;
  phaseState: PhaseState;
  slug: string;
  onEnterForge: (slug: string) => void;
}

function FichaContent({
  phase,
  phaseState,
  slug,
  onEnterForge,
}: FichaContentProps): React.JSX.Element {
  const isLocked = phaseState === "locked";

  if (isLocked) {
    return (
      <section
        data-testid="campaign-phase-ficha"
        style={FICHA_STYLE}
        aria-label={`Ficha de fase bloqueada: ${phase.name}`}
      >
        <div data-testid="ficha-locked-marker" style={FICHA_LOCKED_STYLE}>
          <span style={{ fontSize: "2rem" }}>🔒</span>
          <p
            style={{
              ...FICHA_SECTION_VALUE_STYLE,
              textAlign: "center",
              color: "var(--color-text-muted, var(--color-text, currentColor))",
            }}
          >
            Esta fase aún no está disponible. Completa las fases anteriores para desbloquearla.
          </p>
        </div>
      </section>
    );
  }

  const isBuild = phase.key === "build";

  const handleEnterForge = () => {
    onEnterForge(slug);
  };

  return (
    <section
      data-testid="campaign-phase-ficha"
      style={FICHA_STYLE}
      aria-label={`Ficha de fase: ${phase.name}`}
    >
      {/* Description */}
      <div data-testid="ficha-description" style={FICHA_SUBSECTION_STYLE}>
        <p style={FICHA_SECTION_LABEL_STYLE}>Descripción</p>
        <p style={FICHA_SECTION_VALUE_STYLE}>{phase.description}</p>
      </div>

      {/* LEE — reads previous deliverable */}
      <div data-testid="ficha-lee" style={FICHA_SUBSECTION_STYLE}>
        <p style={FICHA_SECTION_LABEL_STYLE}>LEE</p>
        <p style={FICHA_SECTION_VALUE_STYLE}>{phase.reads}</p>
      </div>

      {/* ESCRIBE — writes next deliverable */}
      <div data-testid="ficha-escribe" style={FICHA_SUBSECTION_STYLE}>
        <p style={FICHA_SECTION_LABEL_STYLE}>ESCRIBE</p>
        <p style={FICHA_SECTION_VALUE_STYLE}>{phase.writes}</p>
      </div>

      {/* Team (AC-02-010.4 — the WHOLE team, every specialist) */}
      <div
        data-testid="ficha-team"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "calc(var(--spacing, 0.25rem) * 2)",
        }}
      >
        <p style={FICHA_SECTION_LABEL_STYLE}>Equipo</p>
        {phase.team.map((member) => (
          <div key={member.role} data-testid="ficha-team-member" style={TEAM_MEMBER_STYLE}>
            {/* Machine-readable role key (hyphenated) — shown in small muted text */}
            <span style={TEAM_MEMBER_ROLE_KEY_STYLE}>{member.role}</span>
            <span style={TEAM_MEMBER_LABEL_STYLE}>{member.label}</span>
            <span style={TEAM_MEMBER_WHAT_STYLE}>{member.what}</span>
          </div>
        ))}
      </div>

      {/* "Entrar a La Fragua" — build phase only (AC-02-010.5) */}
      {isBuild && (
        <button
          data-testid="ficha-enter-forge"
          type="button"
          style={ENTER_FORGE_BUTTON_STYLE}
          aria-label="Entrar a La Fragua — ver el build en vivo"
          onClick={handleEnterForge}
        >
          Entrar a La Fragua
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// CampaignPipeline — the main component
// ---------------------------------------------------------------------------

/**
 * CampaignPipeline — La Campaña: the 6-phase pipeline view.
 *
 * Pure display + local selection state; no fs, network, write or Claude.
 * "use client" because it uses useState and onClick handlers.
 *
 * @param props - slug, activePhase (0–5), onEnterForge callback.
 */
export function CampaignPipeline({
  slug,
  activePhase,
  onEnterForge,
}: CampaignPipelineProps): React.JSX.Element {
  // The phase key currently selected for ficha display (null = no ficha open).
  const [selectedPhaseKey, setSelectedPhaseKey] = useState<string | null>(null);

  const handlePhaseClick = (key: string) => {
    // Toggle: clicking the same phase closes the ficha.
    setSelectedPhaseKey((prev) => (prev === key ? null : key));
  };

  const selectedPhase =
    selectedPhaseKey != null ? (PHASES.find((p) => p.key === selectedPhaseKey) ?? null) : null;

  return (
    <section
      data-testid="campaign-pipeline"
      style={ROOT_STYLE}
      aria-label="La Campaña — las 6 fases del viaje de la idea"
    >
      {/* Labelled container heading (AC-02-010.1) */}
      <p style={CONTAINER_HEADING_STYLE}>EL VIAJE DE ESTA IDEA POR LAS 6 FASES</p>

      {/* Phase list */}
      <ol style={PHASES_LIST_STYLE}>
        {PHASES.map((phase, index) => {
          const state = getPhaseState(index, activePhase);

          return (
            <li key={phase.key}>
              <button
                data-testid={`campaign-phase-${phase.key}`}
                data-phase-state={state}
                type="button"
                style={getPhaseButtonStyle(state)}
                aria-label={`Fase ${index + 1}: ${phase.name} — ${phaseBadgeLabel(state)}`}
                aria-expanded={selectedPhaseKey === phase.key}
                onClick={() => handlePhaseClick(phase.key)}
              >
                <span style={PHASE_NAME_STYLE}>{phase.name}</span>
                <span style={PHASE_STATE_BADGE_STYLE}>{phaseBadgeLabel(state)}</span>
              </button>

              {/* Ficha — shown inline below the clicked phase */}
              {selectedPhaseKey === phase.key && selectedPhase != null && (
                <FichaContent
                  phase={selectedPhase}
                  phaseState={state}
                  slug={slug}
                  onEnterForge={onEnterForge}
                />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
