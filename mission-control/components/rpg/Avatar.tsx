/**
 * WO-09-003 — CMP-09-avatar pixel-art agent avatar
 *
 * Reusable pixel-art (Final-Fantasy-style) agent avatar component.
 * Static sprite assets keyed by agent id. Degrades gracefully when a sprite
 * is missing. Reused by FRD-07 (agents section) and FRD-10 (party Hall hero).
 *
 * Design rules (FRD-13 / AGENTS.md):
 *   - image-rendering: pixelated on sprite images (FF-style).
 *   - CSS custom properties only — zero hardcoded colors.
 *   - FRD-13 elevation/radius tokens for chrome (border/background).
 *   - data-testid on every significant element.
 *   - Spanish aria-label / alt text (AGENTS.md a11y).
 *
 * Traceability:
 *   CMP-09-avatar → AC-09-003.1, AC-09-003.2, AC-09-003.3, AC-09-003.4
 *   Blueprint §3 (FRD-09-blueprint#3-components--interfaces)
 */

// ---------------------------------------------------------------------------
// Sprite map — static asset paths for every canonical agent role
// Paths served from /prototype/assets/agents/ (already present in repo).
// ---------------------------------------------------------------------------

import type { AgentRole } from "@/app/_design/tokens";

/**
 * SPRITE_MAP: canonical role → sprite asset path (relative to site root).
 * The fallback key "backend-dev" is used when an id is unknown (AC-09-003.2).
 */
export const SPRITE_MAP: Record<AgentRole, string> = {
  researcher: "/prototype/assets/agents/researcher.png",
  "backend-dev": "/prototype/assets/agents/backend-dev.png",
  "frontend-dev": "/prototype/assets/agents/frontend-dev.png",
  "test-writer": "/prototype/assets/agents/test-writer.png",
  reviewer: "/prototype/assets/agents/reviewer.png",
  "security-auditor": "/prototype/assets/agents/security-auditor.png",
  architect: "/prototype/assets/agents/architect.png",
  "product-manager": "/prototype/assets/agents/product-manager.png",
  designer: "/prototype/assets/agents/designer.png",
  guild: "/prototype/assets/agents/analytics.png",
};

// ---------------------------------------------------------------------------
// Size tokens — tokenized size variants using FRD-13 spacing scale.
// Mapped to CSS custom properties so no pixel values appear in style attrs.
// ---------------------------------------------------------------------------

/**
 * The three tokenized avatar sizes (AC-09-003.1).
 * sm = 2rem, md = 3rem, lg = 4rem — all multiples of the 0.25rem scale.
 */
export type AvatarSize = "sm" | "md" | "lg";

/**
 * Size → CSS custom property value (FRD-13 spacing scale).
 * The property is injected as a CSS variable so consumers can override via
 * parent scope — never a hardcoded pixel measurement.
 */
const SIZE_CSS: Record<AvatarSize, string> = {
  sm: "var(--avatar-size-sm, 2rem)",
  md: "var(--avatar-size-md, 3rem)",
  lg: "var(--avatar-size-lg, 4rem)",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AvatarProps {
  /**
   * Canonical agent role id (e.g. "backend-dev").
   * If the id is not in SPRITE_MAP, the component degrades gracefully
   * (renders a fallback sprite) without breaking layout (AC-09-003.2).
   */
  agentId: AgentRole;
  /**
   * Tokenized size variant (default: "sm").
   * All sizes resolve to CSS custom properties — never hardcoded px (AC-09-003.1).
   */
  size?: AvatarSize;
  /**
   * Optional suffix to help distinguish multiple avatars in tests.
   * Exposed as a data attribute on the wrapper but does NOT change data-testid.
   */
  "data-testid-suffix"?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CMP-09-avatar — pixel-art agent avatar.
 *
 * Renders a pixel-art sprite for a canonical agent role. When the id is not
 * in SPRITE_MAP, falls back to the "backend-dev" sprite without throwing or
 * breaking the layout (AC-09-003.2).
 *
 * All chrome (border, background) uses only FRD-13 CSS custom properties
 * (AC-09-003.4). The image uses `image-rendering: pixelated` for the FF-style
 * pixel-art look (AC-09-003.1).
 *
 * A Spanish aria-label is set on the wrapper and a Spanish alt on the image
 * (AC-09-003.3).
 */
export function Avatar({
  agentId,
  size = "sm",
  "data-testid-suffix": suffix,
}: AvatarProps): React.JSX.Element {
  // Resolve sprite src — fallback to "backend-dev" when id is unknown (AC-09-003.2).
  const spriteSrc: string =
    agentId in SPRITE_MAP
      ? (SPRITE_MAP[agentId as AgentRole] ?? SPRITE_MAP["backend-dev"])
      : SPRITE_MAP["backend-dev"];

  const sizeValue = SIZE_CSS[size] ?? SIZE_CSS.sm;

  // Spanish aria-label (AC-09-003.3)
  const ariaLabel = `Avatar de agente ${agentId}`;
  // Spanish alt text on the image (AC-09-003.3)
  const altText = `Sprite de ${agentId}`;

  // ---------------------------------------------------------------------------
  // Wrapper styles — FRD-13 tokens only for chrome (AC-09-003.4)
  // Sizes are CSS vars (AC-09-003.1). Radius from FRD-13 --radius token.
  // ---------------------------------------------------------------------------
  const wrapperStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: sizeValue,
    height: sizeValue,
    borderRadius: "var(--radius, 0.5rem)",
    border: `var(--hairline, 1px) solid var(--color-base, currentColor)`,
    background: "var(--color-surface, Canvas)",
    overflow: "hidden",
    // Elevation level 1 (panel) for the avatar chrome (FRD-13 §3)
    boxShadow: "var(--shadow-1, none)",
    flexShrink: 0,
  };

  // ---------------------------------------------------------------------------
  // Image styles — pixelated rendering for FF-style pixel art (AC-09-003.1)
  // ---------------------------------------------------------------------------
  const imgStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    imageRendering: "pixelated",
    display: "block",
  };

  return (
    <div
      data-testid="agent-avatar"
      data-role={agentId}
      data-size={size}
      data-suffix={suffix}
      aria-label={ariaLabel}
      role="img"
      style={wrapperStyle}
    >
      {/* biome-ignore lint/performance/noImgElement: pixelated pixel-art sprite — Next.js Image does not support image-rendering:pixelated */}
      <img src={spriteSrc} alt={altText} data-testid="agent-avatar-img" style={imgStyle} />
    </div>
  );
}
