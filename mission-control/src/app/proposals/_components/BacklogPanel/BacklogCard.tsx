/**
 * BacklogCard — one factory-backlog item (CMP-22-card, FRD-22, DR-103).
 *
 * Renders a single `BL-*` actionable item, visually consistent with ProposalCard
 * (DR-062): `rpgpanel` surface, 32px type-colored icon slot, mono id, chips
 * (type · area, severity), title, and an evidence line (source + links).
 *
 * Read-only: no action button. An item is worked by asking an agent (see the
 * BacklogPanel note); the card only displays it.
 *
 * Traceability:
 *   CMP-22-card → AC-22-002.1..4 (id, type·area, severity by text+color, source)
 */

import { Chip, type ChipTone } from "@/components/core/Chip/Chip";
import { Panel } from "@/components/core/Panel/Panel";
import type { BacklogItem, BacklogSeverity } from "@/lib/backlog/backlog";

// ---------------------------------------------------------------------------
// Type / severity metadata
// ---------------------------------------------------------------------------

const TYPE_META: Record<BacklogItem["type"], { icon: string; color: string }> = {
  bug: { icon: "ti-bug", color: "var(--color-danger)" },
  change: { icon: "ti-pencil", color: "var(--color-accent)" },
} as const;

/** Severity → chip tone (text + tone, never color alone — accessibility). */
const SEVERITY_TONE: Record<BacklogSeverity, ChipTone> = {
  p0: "danger",
  p1: "warn",
  p2: "secondary",
} as const;

// ---------------------------------------------------------------------------
// Icon slot (32px, type-colored) — matches ProposalCard's slot for coherence
// ---------------------------------------------------------------------------

function TypeIcon({ icon, color, type }: { icon: string; color: string; type: string }) {
  return (
    <span
      data-testid="backlog-type-icon"
      data-type={type}
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "32px",
        height: "32px",
        flexShrink: 0,
        borderRadius: "8px",
        background: `color-mix(in oklch, ${color} 13%, transparent)`,
        border: `1.5px solid ${color}`,
        color,
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: "17px" }} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// BacklogCard
// ---------------------------------------------------------------------------

/** Evidence text: the source that spawned the item, plus its links. */
function evidenceText(item: BacklogItem): string {
  const parts = [item.source, item.links.length > 0 ? item.links.join(" · ") : ""].filter(Boolean);
  return parts.join(" · ");
}

/** When `onSelect` is provided the whole card is a button that opens the detail. */
export function BacklogCard({
  item,
  onSelect,
}: {
  item: BacklogItem;
  onSelect?: (item: BacklogItem) => void;
}): React.JSX.Element {
  const meta = TYPE_META[item.type];
  const evidence = evidenceText(item);

  const card = (
    <Panel variant="rpgpanel">
      <article
        data-testid="backlog-card"
        data-status={item.status}
        data-item={item.id}
        aria-label={`Item del backlog: ${item.id}`}
        style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}
      >
        <TypeIcon icon={meta.icon} color={meta.color} type={item.type} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header: mono id + type·area chip + severity chip */}
          <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
            <span
              data-testid="backlog-card-id"
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "10px",
                color: "var(--color-text3)",
              }}
            >
              {item.id}
            </span>

            <Chip tone="accent">
              {item.type} · {item.area}
            </Chip>

            {item.severity != null && (
              <Chip tone={SEVERITY_TONE[item.severity]}>{item.severity.toUpperCase()}</Chip>
            )}
          </div>

          {/* Title — the item's imperative one-liner */}
          <p
            data-testid="backlog-card-title"
            style={{
              fontSize: "13px",
              fontWeight: 500,
              margin: "4px 0 0",
              color: "var(--color-text)",
            }}
          >
            {item.title}
          </p>

          {/* Evidence line — where it came from (source + links) */}
          {evidence !== "" && (
            <div
              style={{
                fontSize: "11px",
                color: "var(--color-text3)",
                marginTop: "3px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <i
                className="ti ti-file-search"
                style={{ fontSize: "11px", verticalAlign: "-1px" }}
              />
              {evidence}
            </div>
          )}
        </div>
      </article>
    </Panel>
  );

  // Display-only when no handler; a full-card button (accessible click + keyboard)
  // that opens the detail modal when onSelect is provided.
  if (onSelect === undefined) return card;
  return (
    <button
      type="button"
      data-testid="backlog-card-button"
      onClick={() => onSelect(item)}
      aria-label={`Ver detalle del item ${item.id}: ${item.title}`}
      style={{
        display: "block",
        width: "100%",
        padding: 0,
        border: "none",
        background: "none",
        font: "inherit",
        color: "inherit",
        textAlign: "left",
        cursor: "pointer",
        borderRadius: "var(--radius-md, 12px)",
      }}
    >
      {card}
    </button>
  );
}
