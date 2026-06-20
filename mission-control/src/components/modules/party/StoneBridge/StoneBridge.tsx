/**
 * CMP-13-party-stone-bridge — Shared pixel-RPG StoneBridge connector (WO-13-009, FND-4)
 *
 * PNG stone connector between rooms (bridge-h.png / bridge-v.png).
 * Sits above room backgrounds (z-index 2), below crossing sprites (z-index 5).
 * Presentational: orientation + flow state → image, no interactivity.
 *
 * Design contract (party mocks / la-fragua.html):
 *   - .bridge: position absolute, z-index 2, pointer-events none
 *   - bridge-h.png for horizontal (forge → tribunal)
 *   - bridge-v.png for vertical  (tribunal → vault)
 *   - image-rendering:pixelated on the img
 *   - flow=true: the active bridge "flows" the deliverable (visual state via data-flow)
 *
 * Server Component — no "use client".
 * Traceability: WO-13-009 → REQ-06-017
 */

import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoneBridgeProps {
  /** h = horizontal bridge-h.png; v = vertical bridge-v.png */
  orientation: "h" | "v";
  /** When true the bridge is the active/flowing connector. */
  flow: boolean;
  /** Inline style for absolute positioning on the stage (left/top/width/height). */
  style?: CSSProperties;
}

// ---------------------------------------------------------------------------
// Asset paths
// ---------------------------------------------------------------------------

const BRIDGE_ASSET: Record<"h" | "v", string> = {
  h: "/prototype/assets/zones/bridge-h.png",
  v: "/prototype/assets/zones/bridge-v.png",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Stone bridge PNG connector between Party rooms.
 * Presentational — positions itself via the `style` prop on the stage.
 *
 * @param props.orientation - h (horizontal) or v (vertical)
 * @param props.flow        - whether this bridge is the active flowing connector
 * @param props.style       - positioning on the stage (left/top/width/height)
 */
export function StoneBridge({ orientation, flow, style }: StoneBridgeProps): React.JSX.Element {
  const rootStyle: CSSProperties = {
    position: "absolute",
    zIndex: 2,
    pointerEvents: "none",
    ...style,
  };

  const imgStyle: CSSProperties = {
    display: "block",
    width: "100%",
    height: "100%",
    imageRendering: "pixelated",
  };

  return (
    <div
      data-testid="stone-bridge-root"
      data-orientation={orientation}
      data-flow={String(flow)}
      style={rootStyle}
    >
      {/* biome-ignore lint/performance/noImgElement: pixel-art bridge needs image-rendering:pixelated; next/image breaks it */}
      <img data-testid="stone-bridge-img" src={BRIDGE_ASSET[orientation]} alt="" style={imgStyle} />
    </div>
  );
}
