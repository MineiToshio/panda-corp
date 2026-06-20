"use client";

/**
 * CelebrationSurface — CMP-09-celebration (WO-09-003 re-anchor, originally WO-09-006)
 *
 * Scaling celebration surface matching prototype bOverlay(kind) + bConfetti():
 *
 * Tiers:
 *   "toast"   — small in-place chip (no overlay); announces WO completion.
 *   "phase"   — medium entrance animation on the affected panel (no overlay).
 *   "release" — full-screen overlay: rocket Shield + "PRODUCTO LANZADO" + XP chip +
 *               achievement chip + confetti + dismiss button.
 *   "levelup" — full-screen overlay: "LEVEL UP" + pixel NV numeral + "¡Subiste de
 *               nivel!" + new rank + fresh XpBar + confetti + dismiss button.
 *   "none"    — renders nothing.
 *
 * Design constraints (FRD-09 + FRD-13):
 *   - Celebration SCALES (toast→phase→release→levelup); never flat (AC-09-006.1).
 *   - Non-result events → no celebration (AC-09-006.2).
 *   - Animation: transform/opacity only, <300ms; disabled under prefers-reduced-motion
 *     (data still visible — AC-09-006.3).
 *   - NO false-urgency timer, countdown, nagging (AC-09-006.4).
 *   - aria-live="polite" via LiveRegion; never steals focus (AC-09-006.5).
 *   - Zero hardcoded colors — CSS custom properties only (FRD-13 tokens).
 *   - Spanish UI copy.
 *   - Auto-fired: triggered by the milestone event (release/XP threshold), never
 *     by a button. The ONLY button is the dismiss ("Seguir" / "¡Genial!") — DR-061.
 *
 * Confetti (bConfetti): 26 colored pieces using tier + accent + ok + warn tokens;
 *   bFall animation (transform/opacity, 1.5s) suppressed under prefers-reduced-motion
 *   (data-reduced="true" on confetti container — AC-09-006.3).
 *
 * Traceability:
 *   CMP-09-celebration → AC-09-006.1..5
 *   Visual reference: prototype bOverlay() + bConfetti() ~L1432/1433
 *   Depends on: classifyCelebration (WO-09-005), LiveRegion (WO-13-003),
 *               XpBar (WO-09-003/004)
 */

import type React from "react";
import { useEffect, useState } from "react";
import { LiveRegion } from "@/components/a11y/LiveRegion";
import { XpBar } from "@/components/core/XpBar/XpBar";
import type { Event } from "@/lib/events/events";
import { type CelebrationTier, classifyCelebration, RANKS } from "@/lib/gamification/gamification";

// ── Spanish copy ──────────────────────────────────────────────────────────────

const TIER_MESSAGES: Record<Exclude<CelebrationTier, "none">, string> = {
  toast: "Orden de trabajo completada",
  phase: "Fase completada",
  release: "Proyecto lanzado",
  levelup: "Nivel subido",
};

// Confetti colors — token-based (accent, ok, warn, tier-4, tier-5)
const CONFETTI_COLORS = [
  "var(--color-accent)",
  "var(--color-ok)",
  "var(--color-warn)",
  "var(--color-tier-4)",
  "var(--color-tier-5)",
];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CelebrationSurfaceProps {
  /**
   * The latest result event from the dashboard stream.
   * null/undefined → no celebration (AC-09-006.2).
   */
  event: Event | null;
  /**
   * Optional dismiss callback — called when user clicks the dismiss button.
   * The overlay is always dismissible; this wires the callback (DR-061).
   */
  onDismiss?: () => void;
  /**
   * For levelup tier: the new guild level number to display in the pixel NV numeral.
   * If not provided, defaults to 2 (the first possible level-up result).
   */
  newLevel?: number;
}

// ── Confetti ──────────────────────────────────────────────────────────────────

/** Confetti piece — 26 pieces per prototype bConfetti() */
function Confetti({ reduced }: { reduced: boolean }): React.JSX.Element {
  // 26 pieces with deterministic positions (no Math.random in SSR-compatible way)
  // Using a fixed seed pattern matching the prototype aesthetic
  // Keys derived from position string so they're stable and non-index based
  const PIECES = Array.from({ length: 26 }, (_, k) => ({
    left: `${(k * 37 + 13) % 100}%`,
    delay: `${((k * 0.5) / 26).toFixed(2)}s`,
    color: CONFETTI_COLORS[k % CONFETTI_COLORS.length],
  }));

  return (
    <div
      data-testid="celebration-confetti"
      data-reduced={reduced ? "true" : undefined}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {PIECES.map((p) => (
        <i
          key={p.left}
          data-testid="confetti-piece"
          style={{
            position: "absolute",
            top: "-12px",
            left: p.left,
            width: "7px",
            height: "11px",
            background: p.color,
            borderRadius: "2px",
            // bFall animation — suppressed under reduced-motion via globals.css
            // and data-reduced attr; the piece remains static but visible
            animation: reduced ? undefined : `bFall 1.5s ease-in ${p.delay} both`,
          }}
        />
      ))}
    </div>
  );
}

// ── Full-screen overlay (release / levelup) ───────────────────────────────────

interface OverlayProps {
  tier: "release" | "levelup";
  animated: boolean;
  reduced: boolean;
  onDismiss: () => void;
  message: string;
  newLevel: number;
}

function FullOverlay({
  tier,
  animated,
  reduced,
  onDismiss,
  message,
  newLevel,
}: OverlayProps): React.JSX.Element {
  const animStyle: React.CSSProperties = animated
    ? {
        opacity: 1,
        transform: "translateY(0)",
        transition: `opacity var(--duration-expressive, 280ms) var(--easing-decelerate, ease-out),
                     transform var(--duration-expressive, 280ms) var(--easing-decelerate, ease-out)`,
      }
    : { opacity: 1, transform: "none" };

  return (
    // Backdrop dismiss is progressive enhancement; the dismiss button inside the
    // card is always keyboard-accessible (Tab + Enter/Space).
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop is decorative/convenience-only
    <div
      data-testid="celebration-overlay"
      data-overlay="true"
      role="presentation"
      onClick={onDismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // rgba for backdrop is the one accepted exception (prototype pattern)
        background: "rgba(0,0,0,.66)",
        backdropFilter: "blur(4px)",
        padding: "20px",
      }}
    >
      {/* rpgpanel anim card — stop propagation so clicking card doesn't dismiss */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation on card is pure DOM hygiene */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard dismiss is handled by the button inside */}
      <div
        data-testid="celebration-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          ...animStyle,
          position: "relative",
          maxWidth: tier === "release" ? "440px" : "420px",
          width: "100%",
          textAlign: "center",
          padding: "28px 26px",
          overflow: "hidden",
          /* rpgpanel */
          background: "var(--color-card)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "10px",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
        }}
      >
        {/* Confetti (behind content) */}
        <Confetti reduced={reduced} />

        {/* Content — above confetti */}
        <div style={{ position: "relative" }}>
          {tier === "release" ? (
            <ReleaseContent onDismiss={onDismiss} />
          ) : (
            <LevelupContent onDismiss={onDismiss} newLevel={newLevel} />
          )}
        </div>

        {/* aria-live polite announcement (AC-09-006.5) */}
        <LiveRegion>
          <span data-testid="celebration-message">{message}</span>
        </LiveRegion>
      </div>
    </div>
  );
}

// ── Release content ───────────────────────────────────────────────────────────

function ReleaseContent({ onDismiss }: { onDismiss: () => void }): React.JSX.Element {
  return (
    <>
      {/* Rocket Shield crest */}
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
        }}
      >
        <i
          className="ti ti-rocket"
          aria-hidden="true"
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

      {/* Title */}
      <div
        style={{
          fontFamily: "var(--font-display, var(--font-space-grotesk))",
          fontSize: "24px",
          margin: "6px 0 4px",
          color: "var(--color-text)",
        }}
      >
        ¡Tu producto está en producción!
      </div>

      <div style={{ fontSize: "13px", color: "var(--color-text2)" }}>
        La fábrica registró la hazaña en el Salón del gremio.
      </div>

      {/* XP + achievement chips */}
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
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "3px 10px",
            borderRadius: "99px",
            fontSize: "12px",
            fontWeight: 500,
            background: "var(--color-ok-bg)",
            color: "var(--color-ok)",
          }}
        >
          <i className="ti ti-trophy" aria-hidden="true" style={{ fontSize: "11px" }} />
          {" +120 XP"}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "3px 10px",
            borderRadius: "99px",
            fontSize: "12px",
            fontWeight: 500,
            background: "var(--color-warn-bg)",
            color: "var(--color-warn)",
          }}
        >
          <i className="ti ti-medal" aria-hidden="true" style={{ fontSize: "11px" }} />
          {" Logro desbloqueado"}
        </span>
      </div>

      {/* Dismiss button (DR-061: auto-fired but always dismissible) */}
      <button
        data-testid="celebration-dismiss"
        type="button"
        onClick={onDismiss}
        aria-label="Continuar"
        style={{
          marginTop: "14px",
          padding: "8px 20px",
          borderRadius: "7px",
          border: "1px solid var(--color-border-strong)",
          background: "var(--color-card2)",
          color: "var(--color-text)",
          fontSize: "14px",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {"Seguir "}
        <i
          className="ti ti-arrow-right"
          aria-hidden="true"
          style={{ fontSize: "13px", verticalAlign: "-2px" }}
        />
      </button>
    </>
  );
}

// ── Level-up content ──────────────────────────────────────────────────────────

function LevelupContent({
  onDismiss,
  newLevel,
}: {
  onDismiss: () => void;
  newLevel: number;
}): React.JSX.Element {
  // Derive the HONEST rank for `newLevel` from the same RANKS ladder the engine
  // uses — never a hardcoded title/threshold (AC-09-004.3, FRD-09 honesty).
  // `newLevel` is 1-based (level 1 = RANKS[0]); clamp into the valid range.
  const rankIndex = Math.min(Math.max(0, newLevel - 1), RANKS.length - 1);
  const currentRank = RANKS[rankIndex] ?? RANKS[0];
  const reachedTitle = currentRank?.title ?? "";
  const isMaxRank = rankIndex >= RANKS.length - 1;
  const nextRank = isMaxRank ? currentRank : RANKS[rankIndex + 1];
  // A fresh bar at the new rank: xp sits at the rank's own threshold, reading
  // toward the next rank's REAL threshold (0% progress into the new rank).
  const baseXp = currentRank?.threshold ?? 0;
  const nextThreshold = nextRank?.threshold ?? baseXp;
  const nextTitle = nextRank?.title ?? reachedTitle;

  return (
    <>
      {/* "LEVEL UP" label */}
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

      {/* Big pixel NV numeral — must contain a digit for AC-09-006.1 */}
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
        {"NV "}
        <span>{newLevel}</span>
      </div>

      {/* "¡Subiste de nivel!" title */}
      <div
        style={{
          fontFamily: "var(--font-display, var(--font-space-grotesk))",
          fontSize: "22px",
          margin: "0 0 4px",
          color: "var(--color-text)",
        }}
      >
        ¡Subiste de nivel!
      </div>

      <div style={{ fontSize: "13px", color: "var(--color-text2)" }}>
        {"Ahora eres "}
        <strong style={{ color: "var(--color-accent-text)" }}>{reachedTitle}</strong>
        {"."}
      </div>

      {/* Fresh XpBar for the new rank (AC-09-006.1: level-up shows XpBar).
          xp/next derived from RANKS so the bar reads a REAL threshold. */}
      <div style={{ margin: "16px auto 4px", maxWidth: "240px" }}>
        <XpBar
          xp={baseXp}
          next={nextThreshold}
          pctToNext={0}
          label={reachedTitle}
          nextTitle={nextTitle}
          size="full"
        />
      </div>

      {/* Dismiss button (DR-061) */}
      <button
        data-testid="celebration-dismiss"
        type="button"
        onClick={onDismiss}
        aria-label="¡Genial!"
        style={{
          marginTop: "14px",
          padding: "8px 20px",
          borderRadius: "7px",
          border: "1px solid var(--color-border-strong)",
          background: "var(--color-card2)",
          color: "var(--color-text)",
          fontSize: "14px",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {"¡Genial! "}
        <i
          className="ti ti-sparkles"
          aria-hidden="true"
          style={{ fontSize: "13px", verticalAlign: "-2px" }}
        />
      </button>
    </>
  );
}

// ── Small celebration (toast / phase) ─────────────────────────────────────────

interface SmallCelebrationProps {
  tier: "toast" | "phase";
  animated: boolean;
  message: string;
}

function SmallCelebration({ tier, animated, message }: SmallCelebrationProps): React.JSX.Element {
  const animStyle: React.CSSProperties = animated
    ? {
        opacity: 1,
        transform: "translateY(0)",
        transition: `opacity var(--duration-expressive, 280ms) var(--easing-decelerate, ease-out),
                     transform var(--duration-expressive, 280ms) var(--easing-decelerate, ease-out)`,
      }
    : { opacity: 1, transform: "none" };

  return (
    <div
      data-testid="celebration-surface"
      data-tier={tier}
      data-animated={String(animated)}
      className="celebration-surface"
      style={animStyle}
    >
      <div className="celebration-inner">
        <LiveRegion>
          <span data-testid="celebration-message">{message}</span>
        </LiveRegion>
      </div>
    </div>
  );
}

// ── CelebrationSurface ────────────────────────────────────────────────────────

/**
 * CelebrationSurface — CMP-09-celebration
 *
 * Auto-fires on result events via classifyCelebration().
 * toast/phase → small in-place element.
 * release/levelup → full-screen overlay with confetti + dismiss.
 * none → renders nothing.
 */
export function CelebrationSurface({
  event,
  onDismiss,
  newLevel = 2,
}: CelebrationSurfaceProps): React.JSX.Element | null {
  const [animated, setAnimated] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Detect prefers-reduced-motion on mount only (AC-09-006.3).
  // window.matchMedia is a stable browser API — intentionally [] dep array.
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setAnimated(!mql.matches);
    setReduced(mql.matches);
  }, []);

  // Reset dismissed state whenever the event changes (new event → show again).
  // event is intentionally in the dep array as the trigger, not used in callback body.
  // biome-ignore lint/correctness/useExhaustiveDependencies: event is the trigger dep; setDismissed is stable
  useEffect(() => {
    setDismissed(false);
  }, [event]);

  if (!event) return null;

  const tier = classifyCelebration(event);
  if (tier === "none") return null;

  const message = TIER_MESSAGES[tier];

  function handleDismiss() {
    setDismissed(true);
    onDismiss?.();
  }

  // Dismissed state: hide overlay
  if (dismissed) return null;

  // Full-screen overlay for release and levelup
  if (tier === "release" || tier === "levelup") {
    return (
      // Outer wrapper for test detection (celebration-surface sits on the overlay)
      <div data-testid="celebration-surface" data-tier={tier} data-animated={String(animated)}>
        <FullOverlay
          tier={tier}
          animated={animated}
          reduced={reduced}
          onDismiss={handleDismiss}
          message={message}
          newLevel={newLevel}
        />
      </div>
    );
  }

  // Small celebration for toast / phase
  return <SmallCelebration tier={tier} animated={animated} message={message} />;
}
