/**
 * WO-18-003 — CMP-18-pulse — "Pulso de la fábrica" section component.
 *
 * Renders the pulse funnel as four `dStat` cards (ideas alive, in-construction,
 * shipped, owner-waiting) plus the idea→shipped conversion line — ≤5 signals.
 *
 * Visual contract — re-anchored to the approved prototype `dashboardView()` Pulso
 * block (index.html ~L749-756, `dStat` ~L659, DR-054/DR-062):
 *   - The four signals are `dStat` CARDS (var(--color-panel) surface, 0.5px
 *     var(--color-border), icon+label 11px var(--color-text2), big pixel numeral
 *     30px in var(--font-pixel) with a CONDITIONAL accent, 11px var(--color-text3)
 *     sub), laid out in a bare grid repeat(auto-fit, minmax(150px, 1fr)) gap 10px.
 *     There is NO panel wrapping the grid.
 *   - The conversion is a LOOSE, centered line AFTER the grid (ti-route-2 icon,
 *     "Conversión idea → lanzada: N% · tu métrica que importa") — NOT inside a panel.
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
import { SectionHead } from "@/components/core/SectionHead/SectionHead";

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

/** Bare signals grid — no enclosing panel (prototype). */
const SIGNALS_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "10px",
};

/** dStat card surface (prototype `dStat`). */
const STAT_CARD_STYLE: React.CSSProperties = {
  background: "var(--color-panel)",
  borderRadius: "var(--radius-md)",
  padding: "13px 15px",
  border: "0.5px solid var(--color-border)",
};

const STAT_LABEL_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "11px",
  color: "var(--color-text2)",
};

const STAT_VALUE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-pixel)",
  fontSize: "30px",
  lineHeight: 1,
  marginTop: "6px",
  fontVariantNumeric: "tabular-nums",
};

const STAT_SUB_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3)",
  marginTop: "4px",
};

const CALM_BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  padding: "3px 10px",
  borderRadius: "var(--radius-sm)",
  fontSize: "11px",
  fontWeight: 500,
  background: "var(--color-ok-bg)",
  color: "var(--color-ok)",
  marginBottom: "4px",
};

const STALE_BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  padding: "3px 10px",
  borderRadius: "var(--radius-sm)",
  fontSize: "11px",
  fontWeight: 500,
  background: "var(--color-warn-bg)",
  color: "var(--color-warn)",
  marginTop: "8px",
};

/** Loose, centered conversion line after the grid (prototype). */
const CONVERSION_LINE_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text3)",
  marginTop: "9px",
  textAlign: "center",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatProps {
  testId: string;
  labelTestId: string;
  value: number;
  label: string;
  sub: string;
  icon: string;
  /** Accent color token for the numeral + icon, or undefined for the default. */
  accent?: string;
}

/** Single numeric funnel signal rendered as a `dStat` card (prototype). */
function Stat({
  testId,
  labelTestId,
  value,
  label,
  sub,
  icon,
  accent,
}: StatProps): React.JSX.Element {
  return (
    <div data-testid={`pulso-signal-${testId}`} style={STAT_CARD_STYLE}>
      <div style={STAT_LABEL_ROW_STYLE}>
        <i
          className={`ti ${icon}`}
          aria-hidden="true"
          style={{ fontSize: "14px", color: accent ?? "var(--color-text2)" }}
        />
        <span data-testid={labelTestId}>{label}</span>
      </div>
      <div
        data-testid={testId}
        style={{ ...STAT_VALUE_STYLE, color: accent ?? "var(--color-text)" }}
      >
        {value}
      </div>
      <div style={STAT_SUB_STYLE}>{sub}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Pulso — "Pulso de la fábrica" section.
 *
 * Receives the pre-computed `PulseResult` from `IF-18-pulse` and renders the
 * four `dStat` signals + the loose conversion line. Server Component (no client
 * state).
 *
 * @param pulse - Derived pulse signals from `pulse(input)`.
 */
export function Pulso({ pulse: p }: PulsoProps): React.JSX.Element {
  // Conditional accents (prototype): green when builds are live, red when the
  // owner is waiting. State is conveyed by icon + label too (never color alone).
  const inConstructionAccent = p.inConstructionLive > 0 ? "var(--color-ok)" : undefined;
  const ownerWaitingAccent = p.ownerWaiting > 0 ? "var(--color-danger)" : "var(--color-ok)";
  const inConstructionSub =
    p.inConstructionLive > 0 ? `${p.inConstructionLive} en vivo` : "ninguno corriendo";
  const ownerWaitingSub = p.ownerWaiting > 0 ? "gates humanos" : "al día";

  return (
    <section data-testid="pulso-section" aria-label="Pulso de la fábrica">
      {/* SectionHead (CMP-13-sectionhead, DR-062, AC-18-001.10) */}
      <SectionHead icon="ti-activity-heartbeat" label="Pulso de la fábrica" />

      {/* Calm / al-día badge — shown only when nothing needs attention */}
      {p.calm && (
        <span
          data-testid="pulso-calm-badge"
          role="status"
          aria-label="Fábrica al día — sin elementos pendientes"
          style={CALM_BADGE_STYLE}
        >
          <i className="ti ti-circle-check" aria-hidden="true" style={{ fontSize: "11px" }} />
          al día
        </span>
      )}

      {/* Funnel signals grid — four dStat cards, no enclosing panel (AC-18-003.1) */}
      <div style={SIGNALS_GRID_STYLE}>
        <Stat
          testId="pulso-ideas-alive"
          labelTestId="pulso-ideas-alive-label"
          value={p.ideasAlive}
          label="Ideas vivas"
          sub="en cartera"
          icon="ti-bulb"
        />
        <Stat
          testId="pulso-in-construction-live"
          labelTestId="pulso-in-construction-label"
          value={p.inConstructionLive}
          label="En construcción"
          sub={inConstructionSub}
          icon="ti-hammer"
          accent={inConstructionAccent}
        />
        <Stat
          testId="pulso-ideas-shipped"
          labelTestId="pulso-ideas-shipped-label"
          value={p.ideasShipped}
          label="Lanzados"
          sub="en producción"
          icon="ti-rocket"
        />
        <Stat
          testId="pulso-owner-waiting"
          labelTestId="pulso-owner-waiting-label"
          value={p.ownerWaiting}
          label="Esperan por ti"
          sub={ownerWaitingSub}
          icon="ti-flag-3"
          accent={ownerWaitingAccent}
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
          <i className="ti ti-alert-triangle" aria-hidden="true" style={{ fontSize: "11px" }} />
          {`${p.inConstructionStale} sin señal`}
        </span>
      )}

      {/* Signal 5: conversion (the one metric) — loose centered line (AC-18-003.3) */}
      <div style={CONVERSION_LINE_STYLE}>
        <i
          className="ti ti-route-2"
          aria-hidden="true"
          style={{ fontSize: "13px", verticalAlign: "-2px", marginRight: "4px" }}
        />
        <span data-testid="pulso-conversion-label">Conversión idea → lanzada:</span>{" "}
        <b style={{ color: "var(--color-text2)", fontWeight: 500 }}>
          <span data-testid="pulso-conversion">{p.conversionPct}%</span>
        </b>{" "}
        · tu métrica que importa
      </div>
    </section>
  );
}
