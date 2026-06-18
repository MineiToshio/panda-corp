/**
 * WO-18-003 — CMP-18-pulse — "Pulso de la fábrica" section component.
 *
 * Renders the pulse funnel (ideas alive → in-construction → shipped),
 * the owner-waiting count, and the idea→shipped conversion — ≤5 signals.
 *
 * Design rules (FRD-13, AGENTS.md):
 *   - State shown by ICON + LABEL, NEVER by color alone (AC-18-003.5 / FRD-13).
 *   - ZERO hardcoded colors — all visual values via CSS custom properties.
 *   - tabular-nums on numbers (FRD-13 / globals.css html rule, AC-18-003.3).
 *   - data-testid on every significant element (test-writer contract).
 *   - Spanish labels and aria labels (AC-18-003.5, AGENTS.md).
 *   - Server Component (no "use client") — receives pre-computed PulseResult as prop.
 *
 * Traceability:
 *   CMP-18-pulse → AC-18-003.1..5 → REQ-18-013/014 → WO-18-003.
 */

import type React from "react";
import type { PulseResult } from "@/app/_lib/pulse";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PulsoProps {
  /** Pre-computed pulse signals from `pulse(input)` (IF-18-pulse). */
  pulse: PulseResult;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; zero hardcoded colors.
// ---------------------------------------------------------------------------

const SECTION_STYLE: React.CSSProperties = {
  padding: "calc(var(--space-base, 1rem) * 1.5)",
  borderRadius: "var(--radius, 0.5rem)",
  background: "color-mix(in oklch, var(--color-surface, currentColor) 60%, transparent)",
  border: "var(--hairline, 1px) solid color-mix(in oklch, currentColor 12%, transparent)",
  boxShadow: "var(--shadow-1, 0 1px 4px oklch(0 0 0 / 0.15))",
};

const HEADING_STYLE: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  marginBottom: "calc(var(--space-base, 1rem) * 0.75)",
  opacity: 0.7,
};

const SIGNALS_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(8rem, 1fr))",
  gap: "calc(var(--space-base, 1rem) * 0.75)",
};

const SIGNAL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
};

const SIGNAL_VALUE_STYLE: React.CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 700,
  lineHeight: 1,
  // tabular-nums is set globally on html via globals.css (FRD-13 / AC-18-003.3)
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-contrast, var(--color-text, currentColor))",
};

const SIGNAL_LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  opacity: 0.65,
};

const BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "calc(var(--spacing, 0.25rem) * 1)",
  padding: "calc(var(--spacing, 0.25rem) * 0.75) calc(var(--spacing, 0.25rem) * 2)",
  borderRadius: "calc(var(--radius, 0.5rem) * 0.75)",
  fontSize: "0.7rem",
  fontWeight: 500,
  border: "var(--hairline, 1px) solid color-mix(in oklch, currentColor 15%, transparent)",
  background: "color-mix(in oklch, var(--color-accent, currentColor) 10%, transparent)",
  color: "var(--color-text, currentColor)",
  marginTop: "calc(var(--space-base, 1rem) * 0.5)",
};

const STALE_BADGE_STYLE: React.CSSProperties = {
  ...BADGE_STYLE,
  background: "color-mix(in oklch, var(--color-text-muted, currentColor) 10%, transparent)",
  opacity: 0.8,
};

const CALM_BADGE_STYLE: React.CSSProperties = {
  ...BADGE_STYLE,
  marginTop: 0,
};

const DIVIDER_STYLE: React.CSSProperties = {
  width: "var(--hairline, 1px)",
  background: "color-mix(in oklch, currentColor 10%, transparent)",
  alignSelf: "stretch",
};

const FOOTER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "calc(var(--space-base, 1rem) * 0.75)",
  marginTop: "calc(var(--space-base, 1rem) * 1)",
  paddingTop: "calc(var(--space-base, 1rem) * 0.75)",
  borderTop: "var(--hairline, 1px) solid color-mix(in oklch, currentColor 10%, transparent)",
};

const CONVERSION_LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.7rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--color-text-muted, var(--color-text, currentColor))",
  opacity: 0.65,
};

const CONVERSION_VALUE_STYLE: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-accent, var(--color-contrast, currentColor))",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Single numeric funnel signal with label. */
function Signal({
  testId,
  value,
  label,
  labelTestId,
}: {
  testId: string;
  value: number;
  label: string;
  labelTestId: string;
}): React.JSX.Element {
  return (
    <div data-testid={`pulso-signal-${testId}`} style={SIGNAL_STYLE}>
      <span data-testid={testId} style={SIGNAL_VALUE_STYLE}>
        {value}
      </span>
      <span data-testid={labelTestId} style={SIGNAL_LABEL_STYLE}>
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Pulso — "Pulso de la fábrica" section.
 *
 * Receives the pre-computed `PulseResult` from `IF-18-pulse` and renders
 * the ≤5 funnel signals + conversion metric. Server Component (no client state).
 *
 * @param pulse - Derived pulse signals from `pulse(input)`.
 */
export function Pulso({ pulse: p }: PulsoProps): React.JSX.Element {
  const headingId = "pulso-heading";

  return (
    <section data-testid="pulso-section" aria-labelledby={headingId} style={SECTION_STYLE}>
      {/* Section heading (AC-18-003.5 — Spanish) */}
      <h2 id={headingId} style={HEADING_STYLE}>
        Pulso de la fábrica
      </h2>

      {/* Calm / al-día badge — shown only when nothing needs attention */}
      {p.calm && (
        <span
          data-testid="pulso-calm-badge"
          role="status"
          aria-label="Fábrica al día — sin elementos pendientes"
          style={CALM_BADGE_STYLE}
        >
          <span aria-hidden="true">✓</span>
          {" al día"}
        </span>
      )}

      {/* Funnel signals grid — ≤5 signals (AC-18-003.1) */}
      <div style={SIGNALS_GRID_STYLE}>
        {/* Signal 1: ideas alive */}
        <Signal
          testId="pulso-ideas-alive"
          value={p.ideasAlive}
          label="Ideas vivas"
          labelTestId="pulso-ideas-alive-label"
        />

        <div aria-hidden="true" style={DIVIDER_STYLE} />

        {/* Signal 2: in-construction (live) */}
        <Signal
          testId="pulso-in-construction-live"
          value={p.inConstructionLive}
          label="En construcción"
          labelTestId="pulso-in-construction-label"
        />

        <div aria-hidden="true" style={DIVIDER_STYLE} />

        {/* Signal 3: shipped */}
        <Signal
          testId="pulso-ideas-shipped"
          value={p.ideasShipped}
          label="Enviadas"
          labelTestId="pulso-ideas-shipped-label"
        />

        <div aria-hidden="true" style={DIVIDER_STYLE} />

        {/* Signal 4: owner waiting */}
        <Signal
          testId="pulso-owner-waiting"
          value={p.ownerWaiting}
          label="Tu turno"
          labelTestId="pulso-owner-waiting-label"
        />
      </div>

      {/* Stale builds badge — conditional, part of signal 2 (AC-18-003.2) */}
      {p.hasStale && (
        <span
          data-testid="pulso-stale-badge"
          role="status"
          aria-label={`${p.inConstructionStale} construcción${p.inConstructionStale !== 1 ? "es" : ""} sin señal`}
          style={STALE_BADGE_STYLE}
        >
          {/* Icon + text: state never by color alone (FRD-13 / AC-18-003.5) */}
          <span aria-hidden="true">○</span>
          {`${p.inConstructionStale} sin señal`}
        </span>
      )}

      {/* Signal 5: conversion (the one metric) — footer row */}
      <div style={FOOTER_STYLE}>
        <span data-testid="pulso-conversion-label" style={CONVERSION_LABEL_STYLE}>
          Conversión idea→enviada
        </span>
        <span data-testid="pulso-conversion" style={CONVERSION_VALUE_STYLE}>
          {p.conversionPct}%
        </span>
      </div>
    </section>
  );
}
