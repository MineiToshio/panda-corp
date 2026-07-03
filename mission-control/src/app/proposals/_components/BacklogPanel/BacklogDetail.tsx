/**
 * BacklogDetail — the body of a backlog item's detail modal (CMP-22-detail, FRD-22).
 *
 * A metadata strip (type·area, severity, status, source, links, dates) + the item's
 * body rendered as **titled, colour-coded sections** via the shared
 * `SectionedMarkdown` primitive — the same treatment the memory-lesson detail uses.
 * Backlog bodies use `## Heading` sections (Problem / Root cause / Fix plan / Tests /
 * Done when / Out of scope). Read-only.
 */

import { Chip, type ChipTone } from "@/components/core/Chip/Chip";
import { SectionedMarkdown } from "@/components/modules/SectionedMarkdown/SectionedMarkdown";
import type { BacklogItem, BacklogSeverity, BacklogStatus } from "@/lib/backlog/backlog";

const SEVERITY_TONE: Record<BacklogSeverity, ChipTone> = {
  p0: "danger",
  p1: "warn",
  p2: "secondary",
} as const;

const STATUS_META: Record<BacklogStatus, { label: string; tone: ChipTone }> = {
  open: { label: "Abierto", tone: "info" },
  doing: { label: "En curso", tone: "warn" },
  done: { label: "Hecho", tone: "ok" },
} as const;

const META_ROW_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3)",
  display: "flex",
  gap: "5px",
};

const META_LABEL_STYLE: React.CSSProperties = { color: "var(--color-text2)", flexShrink: 0 };

/** One "label: value" meta line (source / links / dates). */
function MetaLine({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div style={META_ROW_STYLE}>
      <span style={META_LABEL_STYLE}>{label}:</span>
      <span style={{ minWidth: 0, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

export function BacklogDetail({ item }: { item: BacklogItem }): React.JSX.Element {
  const statusMeta = STATUS_META[item.status];

  return (
    <div
      data-testid="backlog-detail"
      style={{ display: "flex", flexDirection: "column", gap: "12px" }}
    >
      {/* Chips: type·area, severity, status */}
      <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", alignItems: "center" }}>
        <Chip tone="accent">
          {item.type} · {item.area}
        </Chip>
        {item.severity != null && (
          <Chip tone={SEVERITY_TONE[item.severity]}>{item.severity.toUpperCase()}</Chip>
        )}
        <Chip tone={statusMeta.tone}>{statusMeta.label}</Chip>
      </div>

      {/* Provenance + dates */}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        {item.source !== "" && <MetaLine label="Origen" value={item.source} />}
        {item.links.length > 0 && <MetaLine label="Vínculos" value={item.links.join(", ")} />}
        {item.opened !== "" && <MetaLine label="Abierto" value={item.opened} />}
        {item.closed != null && <MetaLine label="Cerrado" value={item.closed} />}
        {item.closes !== "" && <MetaLine label="Cierra" value={item.closes} />}
      </div>

      {/* Body — titled colour-coded sections (Problem / Root cause / Fix plan / …) */}
      <SectionedMarkdown data-testid="backlog-detail-body" body={item.body} />
    </div>
  );
}
