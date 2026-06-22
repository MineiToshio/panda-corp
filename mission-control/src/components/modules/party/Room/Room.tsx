/**
 * CMP-13-party-room — Shared pixel-RPG Room primitive (WO-13-009, FND-4)
 *
 * Used by La Campaña (FRD-02, the 6-phase trail) and La Fragua (FRD-06,
 * the living build map). Presentational/stateless: props in, pixels out.
 *
 * Design contract (party tokens + mocks):
 *   - 920×560 stage; rooms absolutely positioned (left/top via style prop)
 *   - border-radius 12–14px, border 1px solid var(--color-border-strong)
 *   - bg image via zone → asset path, image-rendering:pixelated
 *   - zone states: cool (saturate .85), hot (forge/tribunal glow), active (accent
 *     glow + roompulse), done (brightness .86), locked (grayscale .85 brightness .6)
 *   - top-left label chip: pixel font, dark scrim bg
 *   - top-right count chip: mono font, dark scrim bg (only if count provided)
 *   - children slot for sprites / cast / connectors layered on top
 *
 * Tokens only — zero hardcoded colors. image-rendering:pixelated on all pixel art.
 * Server Component (no "use client" — no state, no effects).
 *
 * Traceability: WO-13-009 → REQ-06-003 / AC-WO-13-009
 */

import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The zone determines the background asset. */
type RoomZone =
  | "forge"
  | "tribunal"
  | "vault"
  | "research"
  | "spec"
  | "design"
  | "architecture"
  | "build"
  | "release";

/** Visual state of the room. */
type RoomState = "cool" | "hot" | "active" | "done" | "locked";

export interface RoomProps {
  /** Zone determines background image and identity. */
  zone: RoomZone;
  /** Spanish display label shown in the top-left chip (also the accessible name). */
  label: string;
  /**
   * Optional rich label node for the visible chip (e.g. a phase number coloured
   * with the accent). When provided it replaces `label` in the visible chip;
   * `label` still backs the section's aria-label.
   */
  labelNode?: ReactNode;
  /** Visual state of the room. */
  state: RoomState;
  /** Optional WO/agent count shown in the top-right chip. */
  count?: number;
  /** Inline style for absolute positioning on the stage. */
  style?: CSSProperties;
  /** Children — sprites, cast, overlays. Layered above the background. */
  children?: ReactNode;
}

// ---------------------------------------------------------------------------
// Asset map — zone → public path
// ---------------------------------------------------------------------------

const ZONE_ASSET: Record<RoomZone, string> = {
  forge: "/prototype/assets/zones/backend.png",
  tribunal: "/prototype/assets/zones/tribunal.png",
  vault: "/prototype/assets/zones/boveda.png",
  research: "/prototype/assets/zones/research.png",
  spec: "/prototype/assets/zones/review.png",
  design: "/prototype/assets/zones/frontend.png",
  architecture: "/prototype/assets/zones/architecture.png",
  build: "/prototype/assets/zones/build-hall.png",
  release: "/prototype/assets/zones/release.png",
};

// ---------------------------------------------------------------------------
// State filter — zone state → CSS filter applied to the room
// ---------------------------------------------------------------------------

function roomFilter(state: RoomState): string | undefined {
  switch (state) {
    case "cool":
      return "saturate(0.85)";
    case "done":
      return "saturate(0.92)";
    case "locked":
      return "grayscale(0.85) brightness(0.6)";
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Room glow — applied for active/hot states via box-shadow
// ---------------------------------------------------------------------------

function roomBoxShadow(state: RoomState, zone: RoomZone): string | undefined {
  if (state === "active") {
    return "0 0 0 2px var(--color-accent), 0 0 40px -8px var(--color-accent)";
  }
  if (state === "hot") {
    if (zone === "forge") {
      return "0 0 0 2px var(--color-cat-7), 0 0 34px -6px var(--color-cat-7)";
    }
    if (zone === "tribunal") {
      return "0 0 0 2px var(--color-warn), 0 0 30px -6px var(--color-warn)";
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Scrim background — rgba dark overlay (party structural literal per design-tokens)
// ---------------------------------------------------------------------------

const SCRIM_LABEL = "rgba(12,17,19,.82)";
const SCRIM_COUNT = "rgba(12,17,19,.8)";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Shared pixel-RPG room primitive.
 * Renders a pixel-art zone with label chip, optional count chip, and a slot
 * for sprites/overlays. Positioned absolutely on the stage via the `style` prop.
 *
 * @param props.zone      - zone identity → background asset
 * @param props.label     - display label (top-left chip)
 * @param props.state     - visual state (cool/hot/active/done/locked)
 * @param props.count     - optional WO/agent count (top-right chip)
 * @param props.style     - inline style for absolute positioning on stage
 * @param props.children  - sprites, cast, overlays layered above the background
 */
export function Room({
  zone,
  label,
  labelNode,
  state,
  count,
  style,
  children,
}: RoomProps): React.JSX.Element {
  const filter = roomFilter(state);
  const boxShadow = roomBoxShadow(state, zone);

  const rootStyle: CSSProperties = {
    position: "absolute",
    borderRadius: "12px",
    overflow: "hidden",
    border: "1px solid var(--color-border-strong)",
    zIndex: 1,
    transition: "box-shadow 0.4s, filter 0.4s",
    ...(filter && { filter }),
    ...(boxShadow && { boxShadow }),
    ...style,
  };

  const bgStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundImage: `url(${ZONE_ASSET[zone]})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    imageRendering: "pixelated",
    transition: "filter 0.5s, opacity 0.5s",
  };

  const labelStyle: CSSProperties = {
    position: "absolute",
    top: 6,
    left: 8,
    fontFamily: "var(--font-pixel)",
    fontSize: "13px",
    color: "var(--color-text)",
    background: SCRIM_LABEL,
    border: "1px solid var(--color-border-strong)",
    borderRadius: "7px",
    padding: "1px 8px",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    zIndex: 3,
    whiteSpace: "nowrap",
  };

  const countStyle: CSSProperties = {
    position: "absolute",
    top: 6,
    right: 8,
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    color: "var(--color-text2)",
    background: SCRIM_COUNT,
    border: "1px solid var(--color-border-strong)",
    borderRadius: "20px",
    padding: "1px 8px",
    zIndex: 3,
  };

  return (
    <section
      data-testid="room-root"
      data-zone={zone}
      data-state={state}
      aria-label={`Sala ${label} · estado: ${state}`}
      style={rootStyle}
    >
      {/* Zone background (pixel art) */}
      <div data-testid="room-bg" style={bgStyle} />

      {/* Top-left label chip */}
      <span data-testid="room-label" style={labelStyle}>
        {labelNode ?? label}
      </span>

      {/* Top-right count chip (optional) */}
      {count !== undefined && (
        <span data-testid="room-count" style={countStyle}>
          {count}
        </span>
      )}

      {/* Children: sprites, cast, overlays */}
      {children}
    </section>
  );
}
