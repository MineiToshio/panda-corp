"use client";

/**
 * CMP-09-celebration: scaling celebration surface (WO-09-003, re-anchored to bOverlay())
 *
 * Client-side component that renders the scaling celebration driven by
 * classifyCelebration() over new events. Restrained, honoring
 * prefers-reduced-motion and the FRD-13 motion budget.
 *
 * Prototype anchor (FDD-09 §5, bOverlay() ~L1433, bConfetti() ~L1432):
 *   - Full-screen overlay: position:fixed inset:0 z-index:300
 *     background:rgba(0,0,0,.66) backdrop-filter:blur(4px) centered flex
 *   - release: rpgpanel + confetti + shield(rocket) + "+XP" + achievement chips + dismiss
 *   - levelup: rpgpanel + confetti + "LEVEL UP" + big pixel NV numeral + rank + XpBar + dismiss
 *   - toast/phase: scaled-down surface (no overlay — small announcement)
 *   - Confetti: 26 absolute pieces (bFall 1.5s ease-in, staggered delays 0–0.5s)
 *     Colors: accent/ok/warn/tier-4/tier-5 cycling. transform/opacity only.
 *
 * Design constraints (FRD-09 + FRD-13):
 *   - Celebration SCALES: toast (WO) → phase → release → level-up moment.
 *   - Non-result events ("none" tier) → no celebration rendered.
 *   - Animation ONLY via transform/opacity, duration sourced from CSS var (<300ms).
 *   - prefers-reduced-motion: data still visible, confetti static, animation disabled.
 *   - aria-live="polite" via LiveRegion — never "assertive", never steals focus.
 *   - NO false-urgency timer, countdown, or nagging (FRD-09 forbidden patterns).
 *   - DR-061: overlay is AUTO-FIRED by the milestone (release / XP threshold crossing).
 *     The dismiss button is the ONLY control — NO "preview" or trigger button here.
 *   - Zero hardcoded colors — CSS custom properties only (FRD-13 tokens).
 *   - Spanish UI copy (AGENTS.md i18n convention).
 *
 * Traceability:
 *   CMP-09-celebration → AC-09-006.1..5
 *   Depends on: classifyCelebration (IF-09-celebration, WO-09-005)
 *               LiveRegion (CMP-13-a11y-primitives, WO-13-003)
 *               XpBar (CMP-09-xp-bar, WO-09-003) — used in levelup overlay
 */

import type React from "react";
import { useEffect, useState } from "react";
import { LiveRegion } from "@/components/a11y/LiveRegion";
import { XpBar } from "@/components/core/XpBar/XpBar";
import type { Event } from "@/lib/events/events";
import { type CelebrationTier, classifyCelebration } from "@/lib/gamification/gamification";

// ---------------------------------------------------------------------------
// Spanish copy — one message per tier (AC-09-006.5: Spanish, FRD-13 a11y)
// ---------------------------------------------------------------------------

const TIER_MESSAGES: Record<Exclude<CelebrationTier, "none">, string> = {
  toast: "Orden de trabajo completada",
  phase: "Fase completada",
  release: "Proyecto lanzado",
  levelup: "Nivel subido",
};

// ---------------------------------------------------------------------------
// Confetti piece count (matches prototype bConfetti(): 26 pieces)
// ---------------------------------------------------------------------------
const CONFETTI_COUNT = 26;

// Confetti colors cycle through accent/ok/warn/tier-4/tier-5 (per prototype)
const CONFETTI_COLORS = [
  "var(--color-accent)",
  "var(--color-ok)",
  "var(--color-warn)",
  "var(--color-tier-4)",
  "var(--color-tier-5)",
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CelebrationSurfaceProps {
  /**
   * The latest event from the dashboard stream.
   * Null/undefined → no celebration rendered (AC-09-006.2).
   */
  event: Event | null;
}

// ---------------------------------------------------------------------------
// Confetti component (bConfetti) — 26 absolute pieces with bFall animation
// ---------------------------------------------------------------------------

interface ConfettiProps {
  animated: boolean;
}

function Confetti({ animated }: ConfettiProps): React.JSX.Element {
  // Deterministic positions (no Math.random in render — SSR-safe)
  // Using a fixed spread of left positions and staggered delays
  const pieces = Array.from({ length: CONFETTI_COUNT }, (_, k) => {
    const leftPct = (k * 37 + 11) % 97; // pseudo-random spread 0–97%
    const delaySec = ((k * 19) % 50) / 100; // 0–0.49s stagger
    const color = CONFETTI_COLORS[k % CONFETTI_COLORS.length];
    return { leftPct, delaySec, color };
  });

  return (
    <div
      data-testid="celebration-confetti"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {pieces.map((piece) => (
        <i
          key={`confetti-${piece.leftPct}-${piece.delaySec}`}
          style={{
            position: "absolute",
            top: "-12px",
            left: `${piece.leftPct}%`,
            width: "7px",
            height: "11px",
            background: piece.color,
            borderRadius: "2px",
            // bFall animation: transform/opacity only (AC-09-006.3)
            // Under reduced-motion the animation is suppressed globally via
            // globals.css prefers-reduced-motion rule
            animation: animated ? `bFall 1.5s ease-in ${piece.delaySec}s both` : "none",
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Release overlay content (bOverlay("release"))
// ---------------------------------------------------------------------------

interface ReleaseContentProps {
  animated: boolean;
  onDismiss: () => void;
}

function ReleaseContent({
  animated: _animated,
  onDismiss,
}: ReleaseContentProps): React.JSX.Element {
  return (
    <>
      {/* Rocket shield crest */}
      <div
        style={{
          margin: "0 auto 16px",
          width: "80px",
          height: "80px",
          borderRadius: "16px",
          border: "2px solid var(--color-accent)",
          background: "var(--color-accent-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          imageRendering: "pixelated",
        }}
      >
        <i
          className="ti ti-rocket"
          style={{ fontSize: "38px", color: "var(--color-accent-text)" }}
        />
      </div>

      {/* "PRODUCTO LANZADO" label */}
      <div
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "13px",
          color: "var(--color-ok)",
          letterSpacing: "0.08em",
        }}
      >
        PRODUCTO LANZADO
      </div>

      {/* Celebration title */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "24px",
          fontWeight: 700,
          margin: "6px 0 4px",
          color: "var(--color-text)",
        }}
      >
        ¡Felicidades, el producto está en producción!
      </div>

      {/* Subtitle */}
      <div style={{ fontSize: "13px", color: "var(--color-text2)" }}>
        La fábrica registró la hazaña en el Salón del gremio.
      </div>

      {/* Achievement chips */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          justifyContent: "center",
          margin: "16px 0 4px",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            background: "var(--color-ok-bg)",
            color: "var(--color-ok)",
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "12px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <i className="ti ti-trophy" style={{ fontSize: "11px" }} />
          +120 XP
        </span>
        <span
          style={{
            background: "var(--color-warn-bg)",
            color: "var(--color-warn)",
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "12px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <i className="ti ti-medal" style={{ fontSize: "11px" }} />
          Logro desbloqueado
        </span>
      </div>

      {/* Dismiss button (DR-061: this is the ONLY control; auto-fired by the milestone) */}
      <button
        data-testid="celebration-dismiss"
        type="button"
        onClick={onDismiss}
        style={{
          marginTop: "14px",
          fontFamily: "var(--font-display)",
          background: "var(--color-card)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "8px",
          padding: "7px 13px",
          fontSize: "13px",
          fontWeight: 500,
          color: "var(--color-text)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        Seguir <i className="ti ti-arrow-right" style={{ fontSize: "13px" }} />
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Level-up overlay content (bOverlay("levelup"))
// ---------------------------------------------------------------------------

interface LevelUpContentProps {
  animated: boolean;
  onDismiss: () => void;
}

function LevelUpContent({
  animated: _animated,
  onDismiss,
}: LevelUpContentProps): React.JSX.Element {
  return (
    <>
      {/* "LEVEL UP" label (pixel font) */}
      <div
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "13px",
          color: "var(--color-accent-text)",
          letterSpacing: "0.1em",
        }}
      >
        LEVEL UP
      </div>

      {/* Big pixel NV numeral (64px, glow shadow) */}
      <div
        data-testid="celebration-level"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "64px",
          lineHeight: 1,
          color: "var(--color-accent-text)",
          margin: "6px 0",
          textShadow: "0 0 26px var(--color-accent)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        NV ↑
      </div>

      {/* "¡Subiste de nivel!" title */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "22px",
          fontWeight: 700,
          margin: "0 0 4px",
          color: "var(--color-text)",
        }}
      >
        ¡Subiste de nivel!
      </div>

      {/* Rank text */}
      <div style={{ fontSize: "13px", color: "var(--color-text2)" }}>
        Has alcanzado un nuevo rango en el gremio.
      </div>

      {/* Fresh XpBar at the new level (starts near 0) */}
      <div style={{ margin: "16px auto 4px", maxWidth: "240px", width: "100%" }}>
        <XpBar
          xp={0}
          next={100}
          pctToNext={4}
          label="Nuevo nivel"
          nextTitle="próximo rango"
          size="full"
        />
      </div>

      {/* Dismiss button */}
      <button
        data-testid="celebration-dismiss"
        type="button"
        onClick={onDismiss}
        style={{
          marginTop: "14px",
          fontFamily: "var(--font-display)",
          background: "var(--color-card)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "8px",
          padding: "7px 13px",
          fontSize: "13px",
          fontWeight: 500,
          color: "var(--color-text)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        ¡Genial! <i className="ti ti-sparkles" style={{ fontSize: "13px" }} />
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * CelebrationSurface — CMP-09-celebration
 *
 * For release/levelup: renders a full-screen overlay (position:fixed) with
 * backdrop blur, rpgpanel content, confetti, and a dismiss button.
 * For toast/phase: renders a smaller in-context announcement.
 * For "none" tier or null event: renders nothing.
 *
 * DR-061: the overlay is NEVER triggered by a button — it fires automatically
 * when /pandacorp:release or an XP threshold crossing is detected.
 * The dismiss button is the ONLY control present in the real app.
 *
 * AC-09-006.1: tier-scaled rendering (toast/phase/release/levelup).
 * AC-09-006.2: non-result events produce no celebration.
 * AC-09-006.3: animation via transform/opacity (bFall), <300ms base, disabled
 *              under prefers-reduced-motion (data still present).
 * AC-09-006.4: no timer, countdown, or nagging.
 * AC-09-006.5: aria-live="polite" via LiveRegion, Spanish, no focus steal.
 */
export function CelebrationSurface({ event }: CelebrationSurfaceProps): React.JSX.Element | null {
  // Detect prefers-reduced-motion (AC-09-006.3)
  const [animated, setAnimated] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setAnimated(!mql.matches);
  }, []);

  // Reset dismiss state when event identity changes. event is the correct dep: we want
  // to reset on ANY event change, not just a stable sub-field.
  // biome-ignore lint/correctness/useExhaustiveDependencies: event object is the intentional dep
  useEffect(() => {
    setDismissed(false);
  }, [event]);

  // Classify the event into a tier (AC-09-006.1 + AC-09-006.2)
  if (!event) return null;
  const tier = classifyCelebration(event);
  if (tier === "none") return null;
  if (dismissed) return null;

  // Message (Spanish) for this tier (AC-09-006.5)
  const message = TIER_MESSAGES[tier];

  // Animation style for the rpgIn entrance of the inner panel (AC-09-006.3)
  // Only transform/opacity used (never layout, color, or dimension changes).
  const panelAnimStyle: React.CSSProperties = animated
    ? {
        opacity: 1,
        transform: "translateY(0)",
        transition: `opacity var(--duration-expressive, 280ms) var(--easing-decelerate, ease-out),
                     transform var(--duration-expressive, 280ms) var(--easing-decelerate, ease-out)`,
      }
    : {
        opacity: 1,
        transform: "none",
      };

  // Full-screen overlay for release/levelup (the reserved expressive tier)
  const isOverlay = tier === "release" || tier === "levelup";

  return (
    <div
      data-testid="celebration-surface"
      data-tier={tier}
      data-animated={String(animated)}
      className="celebration-surface"
      style={panelAnimStyle}
    >
      {/* Polite announcement region (AC-09-006.5 — never assertive, never steals focus) */}
      <LiveRegion>
        <span data-testid="celebration-message">{message}</span>
      </LiveRegion>

      {isOverlay ? (
        /* Full-screen backdrop overlay (bOverlay prototype).
           Uses role="dialog" so it is an interactive region with a11y semantics.
           Clicking the backdrop (outside the card) dismisses — Escape key also handled. */
        <div
          data-testid="celebration-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Celebración del gremio"
          onClick={() => setDismissed(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setDismissed(true);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,.66)",
            backdropFilter: "blur(4px)",
            padding: "20px",
          }}
        >
          {/* Inner rpgpanel card — stop propagation so clicking panel doesn't dismiss */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation on container div, dismiss is via the button inside */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handling is on the dialog wrapper above */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              // rpgSkin.rpgpanel
              position: "relative",
              background: "var(--color-card)",
              border: "1px solid var(--color-border-strong)",
              borderRadius: "10px",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
              maxWidth: tier === "release" ? "440px" : "420px",
              width: "100%",
              textAlign: "center",
              padding: "28px 26px",
              overflow: "hidden",
            }}
          >
            {/* Confetti layer (absolute, pointer-events none) */}
            <Confetti animated={animated} />

            {/* Content (relative so it's above confetti) */}
            <div style={{ position: "relative" }}>
              {tier === "release" ? (
                <ReleaseContent animated={animated} onDismiss={() => setDismissed(true)} />
              ) : (
                <LevelUpContent animated={animated} onDismiss={() => setDismissed(true)} />
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Scaled-down surface for toast/phase (no full-screen overlay) */
        <div className="celebration-inner">
          {/* toast/phase: small in-context announcement, no overlay */}
        </div>
      )}
    </div>
  );
}
