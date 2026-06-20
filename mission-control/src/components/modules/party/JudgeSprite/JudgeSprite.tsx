/**
 * CMP-13-party-judge-sprite — Shared pixel-RPG JudgeSprite (WO-13-009, FND-4)
 *
 * The per-FRD reviewer figure: dim until the gate opens, then pacing the Tribunal.
 * One per FRD, not one per WO.
 *
 * Design contract (party mocks / la-fragua.html reviewer):
 *   - reviewer sprite (reviewer.png), image-rendering:pixelated
 *   - inactive: img opacity .45 + grayscale (.4) — visually dimmed
 *   - active: halo (warn-colored), pacing animation (handled by RAF in scene, not here)
 *   - tag: "Juez · 1×FRD", warn-colored when active
 *   - optional judgingTarget: the WO id being judged
 *
 * Tokens only — zero hardcoded colors. Server Component — no "use client".
 * Traceability: WO-13-009 → REQ-06-004 (reviewer gate)
 */

import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JudgeSpriteProps {
  /** Whether the gate is open (reviewer is active). */
  active: boolean;
  /** WO id currently being judged (optional, shown as data attr). */
  judgingTarget?: string;
  /** Inline style for absolute positioning on the stage. */
  style?: CSSProperties;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Reviewer/judge figure for the Tribunal del Juez room.
 * Dim when gate is closed; active (pacing + halo) when gate opens.
 * Presentational: the RAF pacing animation is driven by the scene, not here.
 *
 * @param props.active         - gate open → active state
 * @param props.judgingTarget  - WO id being judged
 * @param props.style          - absolute positioning on stage
 */
export function JudgeSprite({ active, judgingTarget, style }: JudgeSpriteProps): React.JSX.Element {
  const rootStyle: CSSProperties = {
    position: "absolute",
    width: "52px",
    height: "52px",
    willChange: "transform",
    zIndex: 6,
    cursor: "default",
    ...style,
  };

  const imgStyle: CSSProperties = {
    width: "52px",
    height: "52px",
    imageRendering: "pixelated",
    display: "block",
    filter: active
      ? "drop-shadow(0 3px 2px rgba(0,0,0,.5))"
      : "drop-shadow(0 3px 2px rgba(0,0,0,.3)) grayscale(0.4)",
    opacity: active ? 1 : 0.45,
    transition: "opacity 0.3s, filter 0.3s",
  };

  const haloStyle: CSSProperties = {
    position: "absolute",
    left: "7px",
    bottom: "1px",
    width: "38px",
    height: "13px",
    borderRadius: "50%",
    opacity: active ? 0.55 : 0,
    transition: "opacity 0.3s",
    zIndex: -1,
    background: "var(--color-warn)",
  };

  const tagStyle: CSSProperties = {
    position: "absolute",
    top: "45px",
    left: "50%",
    transform: "translateX(-50%)",
    fontFamily: "var(--font-mono)",
    fontSize: "9px",
    color: active ? "var(--color-warn)" : "var(--color-text2)",
    background: "rgba(12,17,19,.85)",
    border: "1px solid var(--color-border)",
    borderRadius: "5px",
    padding: "0 5px",
    whiteSpace: "nowrap",
    zIndex: 6,
    lineHeight: 1.5,
    transition: "color 0.3s",
  };

  return (
    <div
      data-testid="judge-sprite-root"
      data-active={String(active)}
      {...(judgingTarget ? { "data-judging-target": judgingTarget } : {})}
      role="img"
      aria-label={
        active
          ? "Revisor activo — evaluando en el Tribunal del Juez"
          : "Revisor en espera — pendiente de revisión"
      }
      style={rootStyle}
    >
      {/* Halo glow (under-sprite) */}
      <span
        data-testid="judge-sprite-halo"
        data-active={String(active)}
        aria-hidden="true"
        style={haloStyle}
      />

      {/* Reviewer sprite image — pixel art requires image-rendering:pixelated */}
      {/* biome-ignore lint/performance/noImgElement: pixel-art sprite needs image-rendering:pixelated; next/image breaks it */}
      <img
        data-testid="judge-sprite-img"
        src="/prototype/assets/agents/reviewer.png"
        alt=""
        style={imgStyle}
      />

      {/* Judge tag */}
      <span data-testid="judge-sprite-tag" style={tagStyle}>
        Juez · 1×FRD
      </span>
    </div>
  );
}
