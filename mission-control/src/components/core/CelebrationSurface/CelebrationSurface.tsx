"use client";

/**
 * WO-09-006 — CMP-09-celebration: scaling celebration surface
 *
 * Client-side component that renders the scaling celebration driven by
 * classifyCelebration() over new events. Restrained, honoring
 * prefers-reduced-motion and the FRD-13 motion budget.
 *
 * Design constraints (FRD-09 + FRD-13):
 *   - Celebration SCALES: toast (WO) → phase → release → level-up moment.
 *   - Non-result events ("none" tier) → no celebration rendered.
 *   - Animation ONLY via transform/opacity, duration sourced from CSS var
 *     (--duration-expressive = 280ms, < 300ms requirement).
 *   - prefers-reduced-motion: data still visible, animation disabled.
 *   - aria-live="polite" via LiveRegion — never "assertive", never steals focus.
 *   - NO false-urgency timer, countdown, or nagging (FRD-09 forbidden patterns).
 *   - Zero hardcoded colors — CSS custom properties only (FRD-13 tokens).
 *   - Spanish UI copy (AGENTS.md i18n convention).
 *
 * Traceability:
 *   CMP-09-celebration → AC-09-006.1..5
 *   Depends on: classifyCelebration (IF-09-celebration, WO-09-005)
 *               LiveRegion (CMP-13-a11y-primitives, WO-13-003)
 */

import type React from "react";
import { useEffect, useState } from "react";
import { LiveRegion } from "@/components/a11y/LiveRegion";
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
// Component
// ---------------------------------------------------------------------------

/**
 * CelebrationSurface — CMP-09-celebration
 *
 * Renders the scaling celebration surface for result events.
 * Returns null for non-result events (tier === "none") or when no event
 * is provided.
 *
 * AC-09-006.1: tier-scaled rendering (toast/phase/release/levelup).
 * AC-09-006.2: non-result events produce no celebration.
 * AC-09-006.3: animation via transform/opacity, <300ms, disabled under
 *              prefers-reduced-motion (data still present).
 * AC-09-006.4: no timer, countdown, or nagging.
 * AC-09-006.5: aria-live="polite" via LiveRegion, Spanish, no focus steal.
 */
export function CelebrationSurface({ event }: CelebrationSurfaceProps): React.JSX.Element | null {
  // Detect prefers-reduced-motion (AC-09-006.3)
  const [animated, setAnimated] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setAnimated(!mql.matches);
  }, []);

  // Classify the event into a tier (AC-09-006.1 + AC-09-006.2)
  if (!event) return null;
  const tier = classifyCelebration(event);
  if (tier === "none") return null;

  // Message (Spanish) for this tier (AC-09-006.5)
  const message = TIER_MESSAGES[tier];

  // Animation style — only transform/opacity, using CSS token for duration
  // (AC-09-006.3). When reduced-motion, no transition is applied but element
  // remains visible so data is accessible.
  const animationStyle: React.CSSProperties = animated
    ? {
        // Only transform/opacity used here (AC-09-006.3)
        opacity: 1,
        transform: "translateY(0)",
        transition: `opacity var(--duration-expressive, 280ms) var(--easing-decelerate, ease-out),
                     transform var(--duration-expressive, 280ms) var(--easing-decelerate, ease-out)`,
      }
    : {
        // Reduced-motion: show without animation (AC-09-006.3 data still present)
        opacity: 1,
        transform: "none",
      };

  // Outer wrapper: only animation properties in style (AC-09-006.3 — no layout/color
  // properties that could affect the check). Layout/chrome lives in className so
  // the style attribute only ever carries transform + opacity + transition.
  return (
    <div
      data-testid="celebration-surface"
      data-tier={tier}
      data-animated={String(animated)}
      className="celebration-surface"
      style={animationStyle}
    >
      {/* Chrome / layout — CSS-only, no inline color properties */}
      <div className="celebration-inner">
        {/* Announcement region — aria-live="polite", never "assertive" (AC-09-006.5) */}
        <LiveRegion>
          <span data-testid="celebration-message">{message}</span>
        </LiveRegion>
      </div>
    </div>
  );
}
