/**
 * CMP-13-party-stone-bridge — Shared pixel-RPG StoneBridge connector (WO-13-009, FND-4)
 *
 * PNG stone connector between rooms (bridge-h.png / bridge-v.png).
 * Sits above room backgrounds (z-index 2), below crossing sprites (z-index 5).
 * Presentational: orientation + flow state → image, no interactivity.
 *
 * Deliverable label (CMP-02 / party-pipeline.html conn() ~L238): when a label is
 * provided, the bridge renders the centred `.doc` chip — emoji + deliverable name
 * + a trailing state marker ("→" while flowing, "✓" once delivered). Faithful to
 * the prototype `.conn .doc` (mono 10px, dark chip, ok-tinted while flowing).
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

/** Delivery state of the bridge's deliverable label (mirrors conn() in the prototype). */
type BridgeDeliverState = "done" | "flow" | "locked";

export interface StoneBridgeProps {
  /** h = horizontal bridge-h.png; v = vertical bridge-v.png */
  orientation: "h" | "v";
  /** When true the bridge is the active/flowing connector. */
  flow: boolean;
  /** Inline style for absolute positioning on the stage (left/top/width/height). */
  style?: CSSProperties;
  /** Deliverable name shown on the centred `.doc` chip (e.g. "research.md"). */
  deliverableLabel?: string;
  /** Emoji shown before the deliverable name (the `.pip`, e.g. "🔍"). */
  deliverableEmoji?: string;
  /**
   * Delivery state — drives the trailing marker and the chip colour:
   *   done → "✓" (delivered), flow → "→" (in transit), locked → no marker, dimmed.
   */
  deliverableState?: BridgeDeliverState;
}

// ---------------------------------------------------------------------------
// Asset paths
// ---------------------------------------------------------------------------

const BRIDGE_ASSET: Record<"h" | "v", string> = {
  h: "/prototype/assets/zones/bridge-h.png",
  v: "/prototype/assets/zones/bridge-v.png",
};

// ---------------------------------------------------------------------------
// Deliverable label styles (faithful to `.conn .doc` in party-pipeline.html L48-50)
// ---------------------------------------------------------------------------

/** Trailing marker by state: "→" flowing, "✓" delivered, "" locked. */
function stateMarker(state: BridgeDeliverState): string {
  if (state === "flow") return " →";
  if (state === "done") return " ✓";
  return "";
}

function deliverableLabelStyle(state: BridgeDeliverState): CSSProperties {
  const base: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: "10px",
    background: "var(--color-base, #0c1113)",
    border: "1px solid var(--color-border-strong)",
    borderRadius: "7px",
    padding: "3px 8px",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    zIndex: 12,
    boxShadow: "0 3px 10px rgba(0,0,0,.6)",
    color: "var(--color-text2)",
  };
  if (state === "flow") {
    return {
      ...base,
      color: "var(--color-ok)",
      borderColor: "var(--color-ok)",
      boxShadow: "0 0 14px -4px var(--color-ok)",
    };
  }
  if (state === "locked") {
    return { ...base, color: "var(--color-text3)", opacity: 0.5 };
  }
  return base;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Stone bridge PNG connector between Party rooms.
 * Presentational — positions itself via the `style` prop on the stage.
 *
 * @param props.orientation     - h (horizontal) or v (vertical)
 * @param props.flow            - whether this bridge is the active flowing connector
 * @param props.style           - positioning on the stage (left/top/width/height)
 * @param props.deliverableLabel - optional deliverable name for the `.doc` chip
 * @param props.deliverableEmoji - optional emoji shown before the deliverable name
 * @param props.deliverableState - delivery state (done/flow/locked) for marker + colour
 */
export function StoneBridge({
  orientation,
  flow,
  style,
  deliverableLabel,
  deliverableEmoji,
  deliverableState = flow ? "flow" : "done",
}: StoneBridgeProps): React.JSX.Element {
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

      {/* Deliverable chip — emoji + name + state marker (prototype .conn .doc) */}
      {deliverableLabel != null && (
        <span
          data-testid="stone-bridge-deliverable"
          data-deliver-state={deliverableState}
          aria-hidden="true"
          style={deliverableLabelStyle(deliverableState)}
        >
          {deliverableEmoji != null && <span>{deliverableEmoji}</span>}
          {deliverableLabel}
          {stateMarker(deliverableState)}
        </span>
      )}
    </div>
  );
}
