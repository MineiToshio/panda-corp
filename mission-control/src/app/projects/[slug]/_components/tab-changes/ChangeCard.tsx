/**
 * ChangeCard — one change-queue item (CMP-04-change-card, FRD-04).
 *
 * Renders a single item from a project's `.pandacorp/inbox/changes/`, visually
 * consistent with BacklogCard (DR-062): `rpgpanel` surface, 32px type-colored icon
 * slot, mono id, a type chip, an "Urgente" chip only when the item is `expedite`
 * (the common case is `standard` — no need to say so on every card), title, and
 * a date · FRD evidence line.
 *
 * Traceability:
 *   CMP-04-change-card → AC-04-006.x (id, type, urgency, title)
 */

import { Chip } from "@/components/core/Chip/Chip";
import { Panel } from "@/components/core/Panel/Panel";
import type { ChangeQueueItem } from "@/lib/changes/changes";
import { formatChangeDate } from "@/lib/changes/formatChangeDate";

// ---------------------------------------------------------------------------
// Type metadata — icon + color per change type
// ---------------------------------------------------------------------------

const TYPE_META: Record<ChangeQueueItem["type"], { icon: string; color: string }> = {
  bug: { icon: "ti-bug", color: "var(--color-danger)" },
  feature: { icon: "ti-sparkles", color: "var(--color-ok)" },
  change: { icon: "ti-pencil", color: "var(--color-accent)" },
} as const;

// ---------------------------------------------------------------------------
// Icon slot (32px, type-colored) — matches BacklogCard/ProposalCard for coherence
// ---------------------------------------------------------------------------

function TypeIcon({ icon, color, type }: { icon: string; color: string; type: string }) {
  return (
    <span
      data-testid="change-type-icon"
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
// ChangeCard
// ---------------------------------------------------------------------------

/** The date part of the evidence line: a relative label, or the raw string when unparseable. */
type DateDisplay = { text: string; title: string | undefined };

/**
 * Resolve the date part of the evidence line (REQ-04-011): a Spanish relative
 * label with the raw ISO date as a tooltip, or — when the date can't be parsed
 * — the raw string shown visibly (never hidden, DR-078). `null` when the item
 * carries no date at all (nothing to show).
 */
function resolveDateDisplay(item: ChangeQueueItem, now: Date): DateDisplay | null {
  if (item.date === "") return null;
  const result = formatChangeDate(item.date, now);
  if (result.ok) return { text: result.label, title: item.date };
  return { text: item.date, title: undefined };
}

/** When `onSelect` is provided the whole card is a button that opens the detail. */
export function ChangeCard({
  item,
  onSelect,
}: {
  item: ChangeQueueItem;
  onSelect?: (item: ChangeQueueItem) => void;
}): React.JSX.Element {
  const meta = TYPE_META[item.type];
  const dateDisplay = resolveDateDisplay(item, new Date());
  const hasEvidence = dateDisplay !== null || item.frd !== "";

  const card = (
    <Panel variant="rpgpanel">
      <article
        data-testid="change-card"
        data-status={item.status}
        data-item={item.id}
        aria-label={`Cambio: ${item.title}`}
        style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}
      >
        <TypeIcon icon={meta.icon} color={meta.color} type={item.type} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header: mono id + type chip + urgency chip (expedite only) */}
          <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
            <span
              data-testid="change-card-id"
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "10px",
                color: "var(--color-text3)",
              }}
            >
              {item.id}
            </span>

            <Chip tone="accent">{item.type}</Chip>

            {item.cls === "expedite" && <Chip tone="danger">Urgente</Chip>}
          </div>

          {/* Title — the change's one-liner */}
          <p
            data-testid="change-card-title"
            style={{
              fontSize: "13px",
              fontWeight: 500,
              margin: "4px 0 0",
              color: "var(--color-text)",
            }}
          >
            {item.title}
          </p>

          {/* Evidence line — relative date (raw date as tooltip) · FRD afectado */}
          {hasEvidence && (
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
                className="ti ti-calendar-event"
                style={{ fontSize: "11px", verticalAlign: "-1px" }}
              />
              {dateDisplay !== null && (
                <span data-testid="change-card-date" title={dateDisplay.title}>
                  {dateDisplay.text}
                </span>
              )}
              {dateDisplay !== null && item.frd !== "" && <span aria-hidden="true">·</span>}
              {item.frd !== "" && item.frd}
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
      data-testid="change-card-button"
      onClick={() => onSelect(item)}
      aria-label={`Ver detalle del cambio: ${item.title}`}
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
