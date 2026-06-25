/**
 * DagCard — a single work-order card inside its FRD cluster box (2D WoDag).
 *
 * Ported from the prototype's per-card render (dag-2d.generator.mjs): a rounded
 * rect with a left state-color bar, the mono WO id, and a 2-line wrapped title.
 *
 * a11y: the card is role="button", keyboard-operable, and conveys state by a
 * shape indicator (the state dot + icon) AND text — never color alone.
 * Tokens only (no hardcoded colors). Text lives in a <foreignObject> so a long
 * title clips/wraps to the card instead of spilling (SVG <text> never wraps).
 */

import type { WorkOrderState } from "@/lib/work-orders/work-orders";
import { CARD_H, CARD_W, type PositionedCard } from "./layout";

const STATE_COLOR: Record<WorkOrderState, string> = {
  done: "var(--color-ok)",
  fail: "var(--color-danger)",
  in_progress: "var(--color-accent)",
  review: "var(--color-info)",
  todo: "var(--color-border-strong)",
};

const STATE_ICON: Record<WorkOrderState, string> = {
  done: "ti-circle-check",
  fail: "ti-alert-triangle",
  in_progress: "ti-loader-2",
  review: "ti-eye",
  todo: "ti-circle",
};

/** Dim opacity for a card outside the selection's FRD neighborhood. */
const DIM_OPACITY = "0.32";

/** Strip a leading "WO-NN-MMM — " id prefix from the title (id shown separately). */
const ID_PREFIX_RE = /^WO-\d{1,3}-\d{1,4}\s*[—–-]\s*/;

const ID_STYLE: React.CSSProperties = {
  fontSize: "8px",
  fontFamily: "ui-monospace, monospace",
  color: "var(--color-text3)",
  whiteSpace: "nowrap",
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: "9.5px",
  lineHeight: 1.18,
  color: "var(--color-text)",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  overflowWrap: "anywhere",
};

export interface DagCardProps {
  card: PositionedCard;
  /** On the selected WO's intra chain (gets an accent outline). */
  isInChain: boolean;
  /** The pivot of the current selection. */
  isSelected: boolean;
  /** Outside the selection's FRD neighborhood → dimmed. */
  isDimmed: boolean;
  /** Follow-active marks this as the running WO. */
  isRunning: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

/** A single interactive work-order card (SVG <g role="button">). */
export function DagCard({
  card,
  isInChain,
  isSelected,
  isDimmed,
  isRunning,
  onSelect,
  onHover,
}: DagCardProps): React.JSX.Element {
  const stateColor = STATE_COLOR[card.state];
  const stateIcon = STATE_ICON[card.state];
  const cleanTitle = card.title.replace(ID_PREFIX_RE, "").trim() || card.title;
  const outline = isSelected || isInChain;
  const filter = isRunning ? "drop-shadow(0 0 6px var(--color-accent))" : undefined;

  return (
    // biome-ignore lint/a11y/useSemanticElements: an SVG <g> cannot be a native <button>; role=button is the correct ARIA pattern for an interactive SVG node
    <g
      data-testid={`dag-node-${card.id}`}
      data-active={isSelected ? "true" : "false"}
      aria-pressed={isSelected ? "true" : "false"}
      aria-label={`${card.id} ${card.title} — ${card.state}`}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        // Stop the SVG background handler (which clears the pin) from firing.
        e.stopPropagation();
        onSelect(card.id);
      }}
      onMouseEnter={() => onHover(card.id)}
      onMouseLeave={() => onHover(null)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(card.id);
        }
      }}
      style={{
        cursor: "pointer",
        opacity: isDimmed ? DIM_OPACITY : "1",
        ...(filter ? { filter } : {}),
      }}
    >
      <rect
        x={card.x}
        y={card.y}
        width={CARD_W}
        height={CARD_H}
        rx="6"
        fill="var(--color-card2, var(--color-card))"
        stroke={outline ? "var(--color-accent)" : "var(--color-border)"}
        strokeWidth={outline ? 2 : 1}
      />
      {/* Left state-color bar (doubles as the dot indicator for a11y, not color alone) */}
      <rect
        data-testid={`dag-node-dot-${card.id}`}
        x={card.x}
        y={card.y}
        width="4"
        height={CARD_H}
        rx="2"
        fill={stateColor}
      />
      {/* State icon (decorative — pairs with the bar + text) */}
      <foreignObject x={card.x + CARD_W - 17} y={card.y + 6} width="14" height="14">
        <span
          className={`ti ${stateIcon}`}
          aria-hidden="true"
          style={{ fontSize: "11px", color: stateColor, display: "block", lineHeight: 1 }}
        />
      </foreignObject>
      {/* Id + 2-line title */}
      <foreignObject x={card.x + 12} y={card.y + 6} width={CARD_W - 32} height={CARD_H - 10}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
          <span data-testid={`dag-node-meta-${card.id}`} style={ID_STYLE}>
            {card.id} · {card.clusterFrd}
          </span>
          <span style={TITLE_STYLE}>{cleanTitle}</span>
        </div>
      </foreignObject>
      {isRunning && (
        <text
          data-testid={`dag-node-active-caption-${card.id}`}
          x={card.x + CARD_W - 8}
          y={card.y + CARD_H - 5}
          fontSize="7.5"
          textAnchor="end"
          fill="var(--color-accent-text)"
        >
          ▶ paso activo
        </text>
      )}
    </g>
  );
}
