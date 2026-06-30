/**
 * CMP-13-party-agent-sprite — Shared pixel-RPG AgentSprite (WO-13-009, FND-4)
 *
 * 52px pixel implementer figure: halo + WO-id tag, plus a forge "forging" treatment.
 * States: work / carry / vault / say-on / idle / split / review
 *
 * Design contract (party mocks / la-fragua.html .ag):
 *   - .ag: 52×52, will-change:transform, z-index 5, cursor pointer
 *   - img: 52×52 (42×42 in vault), image-rendering:pixelated
 *   - .halo: under-sprite glow ellipse; opacity .55 + animation in work/review.
 *     Warm ember (--color-warn) in the forge (work); tribunal cat-7 in review.
 *   - .hammer: a striking hammer above the head, ONLY in the work/forge state —
 *     pure "it's forging" eye-candy, NOT a progress value (the room/walk conveys
 *     real progress; the owner explicitly rejected a progress bar).
 *   - .tag: WO id below sprite, ok-colored in vault
 *   - .scrollicon: shown in carry state (📜)
 *   - .medal: shown in vault state (🏅)
 *   - Agent sprite image resolved from role → asset path (implementer → backend-dev.png)
 *
 * Tokens only — zero hardcoded colors. image-rendering:pixelated on pixel art.
 * Server Component — no "use client".
 * Traceability: WO-13-009 → REQ-06-001
 */

import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentSpriteState = "work" | "carry" | "vault" | "say-on" | "idle" | "split" | "review";

type AgentSpriteRole =
  | "implementer"
  | "reviewer"
  | "test-writer"
  | "backend-dev"
  | "frontend-dev"
  | "researcher"
  | "designer"
  | "architect"
  | "product-manager"
  | "copywriter"
  | "analytics"
  | "devops"
  | "security-auditor";

export interface AgentSpriteProps {
  /** Agent role — determines sprite image. */
  agentRole: AgentSpriteRole;
  /** Visual state. */
  state: AgentSpriteState;
  /** WO id shown in the tag below the sprite. */
  woId: string;
  /** Inline style for absolute positioning on the stage. */
  style?: CSSProperties;
}

// ---------------------------------------------------------------------------
// Asset map — role → public path
// The mock uses implementer → backend-dev.png (the generic implementer sprite)
// ---------------------------------------------------------------------------

const ROLE_ASSET: Record<AgentSpriteRole, string> = {
  implementer: "/prototype/assets/agents/backend-dev.png",
  reviewer: "/prototype/assets/agents/reviewer.png",
  "test-writer": "/prototype/assets/agents/test-writer.png",
  "backend-dev": "/prototype/assets/agents/backend-dev.png",
  "frontend-dev": "/prototype/assets/agents/frontend-dev.png",
  researcher: "/prototype/assets/agents/researcher.png",
  designer: "/prototype/assets/agents/designer.png",
  architect: "/prototype/assets/agents/architect.png",
  "product-manager": "/prototype/assets/agents/product-manager.png",
  copywriter: "/prototype/assets/agents/copywriter.png",
  analytics: "/prototype/assets/agents/analytics.png",
  devops: "/prototype/assets/agents/devops.png",
  "security-auditor": "/prototype/assets/agents/security-auditor.png",
};

// ---------------------------------------------------------------------------
// Size constants
// ---------------------------------------------------------------------------

const SIZE_NORMAL = 52;
const SIZE_VAULT = 42; // smaller in vault per mock

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Pixel-art agent sprite (one per running WO).
 * Presentational — positioned on the stage via `style` prop.
 *
 * @param props.role  - agent role (determines sprite image)
 * @param props.state - visual state (work/carry/vault/say-on/idle/split/review)
 * @param props.woId  - WO id shown in tag below the sprite
 * @param props.style - absolute positioning on stage
 */
export function AgentSprite({
  agentRole,
  state,
  woId,
  style,
}: AgentSpriteProps): React.JSX.Element {
  const isWork = state === "work";
  const isCarry = state === "carry";
  const isVault = state === "vault";
  const spriteSize = isVault ? SIZE_VAULT : SIZE_NORMAL;

  // Liveness (WO-06 liveness pass): a working/reviewing sprite bobs + its halo
  // breathes continuously, so an actively-building agent reads as alive even
  // when no new event has arrived (the event stream is sparse mid-WO). Trophies
  // (vault) and idle sprites stay still. Auto-disabled under reduced-motion.
  const isActive = isWork || state === "review";

  const rootStyle: CSSProperties = {
    position: "absolute",
    width: `${SIZE_NORMAL}px`,
    height: `${SIZE_NORMAL}px`,
    willChange: "transform",
    zIndex: 5,
    cursor: "pointer",
    ...style,
  };

  const imgStyle: CSSProperties = {
    width: `${spriteSize}px`,
    height: `${spriteSize}px`,
    imageRendering: "pixelated",
    display: "block",
    filter: "drop-shadow(0 3px 2px rgba(0,0,0,.5))",
  };

  const haloStyle: CSSProperties = {
    position: "absolute",
    left: "7px",
    bottom: "1px",
    width: "38px",
    height: "13px",
    borderRadius: "50%",
    opacity: isWork || state === "review" ? 0.55 : 0,
    transition: "opacity 0.3s",
    zIndex: -1,
    // Warm ember in the forge (work), tribunal cat-7 in review.
    background: isWork ? "var(--color-warn)" : "var(--color-cat-7)",
  };

  const hammerStyle: CSSProperties = {
    // Forge-only "forging" eye-candy: a hammer striking above the head. Kept in
    // the DOM (gated via data-visible) so tests can assert its presence/absence,
    // and hidden everywhere but the work state. NOT a progress value.
    display: isWork ? "block" : "none",
    position: "absolute",
    top: "-2px",
    left: "-4px",
    fontSize: "17px",
    lineHeight: 1,
    transformOrigin: "80% 80%",
    zIndex: 7,
    pointerEvents: "none",
  };

  const tagStyle: CSSProperties = {
    position: "absolute",
    top: "45px",
    left: "50%",
    transform: "translateX(-50%)",
    fontFamily: "var(--font-mono)",
    fontVariantNumeric: "tabular-nums",
    fontSize: "9px",
    color: isVault ? "var(--color-ok)" : "var(--color-text2)",
    background: "rgba(12,17,19,.85)",
    border: "1px solid var(--color-border)",
    borderRadius: "5px",
    padding: "0 5px",
    whiteSpace: "nowrap",
    zIndex: 6,
    lineHeight: 1.5,
  };

  const carryStyle: CSSProperties = {
    position: "absolute",
    top: "12px",
    left: "40px",
    width: "18px",
    height: "18px",
    borderRadius: "4px",
    background: "var(--color-warn-bg)",
    border: "1px solid var(--color-warn)",
    display: isCarry ? "flex" : "none",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    zIndex: 7,
  };

  const medalStyle: CSSProperties = {
    position: "absolute",
    top: "-4px",
    left: "30px",
    width: "18px",
    height: "18px",
    display: isVault ? "block" : "none",
    fontSize: "14px",
    zIndex: 7,
    filter: "drop-shadow(0 0 4px var(--color-ok))",
  };

  return (
    <div
      data-testid="agent-sprite-root"
      data-role={agentRole}
      data-state={state}
      className={isActive ? "fragua-sprite-bob" : undefined}
      role="img"
      aria-label={`Agente ${agentRole} · orden ${woId} · estado ${state}`}
      style={rootStyle}
    >
      {/* Halo glow (under-sprite) — breathes while active */}
      <span
        data-testid="agent-sprite-halo"
        className={isActive ? "fragua-halo-pulse" : undefined}
        aria-hidden="true"
        style={haloStyle}
      />

      {/* Forge hammer — strikes above the head ONLY in the work state. Pure
          "it's forging" eye-candy, not a progress value (the room/walk conveys
          real progress). Decorative → aria-hidden. */}
      <span
        data-testid="agent-sprite-hammer"
        data-visible={String(isWork)}
        aria-hidden="true"
        className="fragua-hammer"
        style={hammerStyle}
      >
        🔨
      </span>

      {/* Carry scroll icon */}
      <span
        data-testid="agent-sprite-carry"
        data-visible={String(isCarry)}
        aria-hidden="true"
        style={carryStyle}
      >
        📜
      </span>

      {/* Vault medal */}
      <span
        data-testid="agent-sprite-medal"
        data-visible={String(isVault)}
        aria-hidden="true"
        style={medalStyle}
      >
        🏅
      </span>

      {/* Sprite image — pixel art requires <img> with image-rendering:pixelated;
          next/image would override that. biome-ignore is intentional. */}
      {/* biome-ignore lint/performance/noImgElement: pixel-art sprite needs image-rendering:pixelated; next/image breaks it */}
      <img data-testid="agent-sprite-img" src={ROLE_ASSET[agentRole]} alt="" style={imgStyle} />

      {/* WO-id tag below sprite */}
      <span data-testid="agent-sprite-tag" style={tagStyle}>
        {woId}
      </span>
    </div>
  );
}
