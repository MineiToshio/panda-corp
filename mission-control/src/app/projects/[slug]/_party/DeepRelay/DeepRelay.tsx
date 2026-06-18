"use client";

/**
 * WO-06-013 — DeepRelay (CMP-06-relay, La Fragua faithful model)
 *
 * Renders a deep-mode work order's **sequential 3-step relay**:
 *   test-writer (RED) → backend-dev → frontend-dev
 * with a 3-segment progress indicator, the active sub-step highlighted, the
 * contract hand-off (📄) when the backend publishes `docs/api.md`, and the
 * "Opus" label (AC-06-007.1/.2/.3).
 *
 * When the work order has **no** frontend, it renders as a single
 * `implementer` figure (no relay), matching the non-split modes (AC-06-007.4).
 *
 * Pure render component: driven entirely by props (the engine-derived
 * `RelayState` from the FraguaSnapshot). No RAF, no engine mount, no I/O.
 * Observation-only (AC-06-009.1): zero control affordances.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - ZERO hardcoded colors — CSS custom properties only (roleColor, IF-06-role-color).
 *   - `data-testid` on every significant element.
 *   - Spanish aria-labels.
 *
 * Traceability:
 *   CMP-06-relay → REQ-06-007
 *   IF-06-role-color (roleColor, layout.ts)
 */

import type { RelayState } from "../fragua-snapshot/fragua-snapshot";
import { roleColor } from "../layout";
import type { RelayStep } from "../state-map/state-map";

// ---------------------------------------------------------------------------
// Relay step model — the fixed, ordered sequence (REQ-06-007)
// ---------------------------------------------------------------------------

/** Build role driving each relay step (for the role color + sub-sprite art). */
type RelayRole = "test-writer" | "backend-dev" | "frontend-dev";

/** The ordered relay steps. Index encodes progression (test → backend → frontend). */
const RELAY_SEQUENCE: ReadonlyArray<{ step: RelayStep; role: RelayRole; label: string }> =
  Object.freeze([
    { step: "test", role: "test-writer", label: "test-writer" },
    { step: "backend", role: "backend-dev", label: "backend-dev" },
    { step: "frontend", role: "frontend-dev", label: "frontend-dev" },
  ]);

/** Step ordinal lookup — drives "done"/"active" derivation. */
const STEP_INDEX: Readonly<Record<RelayStep, number>> = Object.freeze({
  test: 0,
  backend: 1,
  frontend: 2,
});

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only (zero hardcoded colors)
// ---------------------------------------------------------------------------

const RELAY_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  padding: "calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius, 0.375rem)",
  background: "var(--color-card, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.625rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, currentColor)",
  alignSelf: "flex-start",
  padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 1.5)",
  borderRadius: "var(--radius, 0.375rem)",
  background: "var(--color-surface, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

const STEPS_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
};

const PROGRESS_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "calc(var(--spacing, 0.25rem) * 0.5)",
};

const PROGRESS_SEGMENT_STYLE: React.CSSProperties = {
  flex: 1,
  height: "calc(var(--spacing, 0.25rem) * 1)",
  borderRadius: "var(--radius, 0.375rem)",
};

const CONTRACT_STYLE: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--color-text-muted, currentColor)",
};

const SINGLE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "var(--radius, 0.375rem)",
  fontSize: "0.6875rem",
  fontWeight: 600,
  background: "var(--color-card, Canvas)",
  border: "var(--hairline, 1px) solid var(--color-border, currentColor)",
};

/** Build the per-step sub-sprite style, coloring by role via the IF-06-role-color token. */
function stepStyle(role: RelayRole, isActive: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "calc(var(--spacing, 0.25rem) * 0.5)",
    fontSize: "0.625rem",
    fontWeight: 600,
    padding: "calc(var(--spacing, 0.25rem) * 0.5) calc(var(--spacing, 0.25rem) * 1.5)",
    borderRadius: "var(--radius, 0.375rem)",
    color: `var(${roleColor(role)}, currentColor)`,
    border: `var(--hairline, 1px) solid var(${roleColor(role)}, currentColor)`,
    opacity: isActive ? 1 : 0.55,
  };
}

/** Build the progress segment style, filling by role color when reached. */
function segmentStyle(role: RelayRole, isFilled: boolean): React.CSSProperties {
  return {
    ...PROGRESS_SEGMENT_STYLE,
    background: isFilled
      ? `var(${roleColor(role)}, currentColor)`
      : "var(--color-border, currentColor)",
    opacity: isFilled ? 1 : 0.35,
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DeepRelayProps {
  /** The work-order id this relay belongs to (e.g. "WO-06-013"). */
  wo: string;
  /** The engine-derived relay state (current step + contract flag). */
  relay: RelayState;
  /**
   * Whether the work order has a frontend. When false, the WO renders as a
   * single `implementer` figure with no relay (AC-06-007.4).
   */
  hasFrontend: boolean;
}

// ---------------------------------------------------------------------------
// DeepRelay component
// ---------------------------------------------------------------------------

/**
 * Renders the deep-mode sequential relay (or a single implementer when the WO
 * has no frontend). Observation-only; driven entirely by props.
 *
 * @param props.wo - The work-order id.
 * @param props.relay - The engine-derived relay state.
 * @param props.hasFrontend - Whether the WO has a frontend sub-step.
 */
export function DeepRelay({ wo, relay, hasFrontend }: DeepRelayProps): React.JSX.Element {
  // AC-06-007.4 — no frontend → single implementer figure, no relay.
  if (!hasFrontend) {
    return (
      <span
        data-testid={`deep-relay-single-${wo}`}
        data-role="implementer"
        role="img"
        aria-label={`${wo} — implementer`}
        style={{ ...SINGLE_STYLE, color: `var(${roleColor("implementer")}, currentColor)` }}
      >
        <span aria-hidden="true">⚒</span>
        {wo}
      </span>
    );
  }

  const activeIndex = STEP_INDEX[relay.step];

  return (
    <div
      data-testid={`deep-relay-${wo}`}
      title={`${wo} — relevo secuencial en profundidad (Opus)`}
      style={RELAY_STYLE}
    >
      {/* "Opus" label (AC-06-007.1). */}
      <span data-testid="relay-label" style={LABEL_STYLE}>
        Opus
      </span>

      {/* Three role sub-steps with the contract hand-off between backend & frontend. */}
      <div style={STEPS_ROW_STYLE}>
        {RELAY_SEQUENCE.map(({ step, role, label }, index) => {
          const isActive = index === activeIndex;
          const isDone = index < activeIndex;
          return (
            <span
              key={step}
              data-testid={`relay-step-${role}`}
              data-active={isActive}
              data-done={isDone}
              data-role={role}
              style={stepStyle(role, isActive)}
            >
              {label}
              {isDone && (
                <span aria-hidden="true" data-testid={`relay-step-${role}-check`}>
                  ✓
                </span>
              )}
              {/* Contract hand-off (📄) sits between backend-dev and frontend-dev (AC-06-007.3). */}
              {step === "backend" && relay.contractPublished && (
                <span
                  data-testid="relay-contract"
                  role="img"
                  aria-label="Contrato docs/api.md publicado"
                  style={CONTRACT_STYLE}
                >
                  📄
                </span>
              )}
            </span>
          );
        })}
      </div>

      {/* 3-segment progress indicator (AC-06-007.1/.2). */}
      <div data-testid="relay-progress" style={PROGRESS_ROW_STYLE} aria-hidden="true">
        {RELAY_SEQUENCE.map(({ step, role }, index) => (
          <span
            key={step}
            data-testid={`relay-progress-segment-${step}`}
            data-filled={index <= activeIndex}
            style={segmentStyle(role, index <= activeIndex)}
          />
        ))}
      </div>
    </div>
  );
}
