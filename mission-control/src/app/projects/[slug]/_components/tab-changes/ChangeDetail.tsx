/**
 * ChangeDetail — the body of a change-queue item's detail modal (CMP-04-change-detail, FRD-04).
 *
 * A metadata strip (type, urgency, status) + meta-lines (date, affected FRD, depends-on,
 * a warn-toned notice when it rebuilds already-VERIFIED work) + the item's body rendered
 * as **titled, colour-coded sections** via the shared `SectionedMarkdown` primitive (same
 * treatment as the backlog and memory-lesson detail views). Ends with a ready-to-copy
 * `/pandacorp:implement change:<id>` command — the existing targeted-build mechanism
 * (ModeSelector's `change:<slug>` variant), pointed at this specific item.
 */

import { Chip, type ChipTone } from "@/components/core/Chip/Chip";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { SectionedMarkdown } from "@/components/modules/SectionedMarkdown/SectionedMarkdown";
import type { ChangeQueueItem, ChangeQueueStatus } from "@/lib/changes/changes";

const STATUS_META: Record<ChangeQueueStatus, { label: string; tone: ChipTone }> = {
  ready: { label: "Listo", tone: "ok" },
  draft: { label: "Borrador", tone: "secondary" },
  done: { label: "Hecho", tone: "info" },
} as const;

const META_ROW_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3)",
  display: "flex",
  gap: "5px",
};

const META_LABEL_STYLE: React.CSSProperties = { color: "var(--color-text2)", flexShrink: 0 };

const WARN_BANNER_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-warn)",
  background: "var(--color-warn-bg)",
  border: "1px solid var(--color-warn)",
  borderRadius: "var(--radius-md, 12px)",
  padding: "8px 10px",
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const CMD_NOTE_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3)",
  margin: "4px 0 0",
};

/** One "label: value" meta line (date / FRD / depends-on). */
function MetaLine({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div style={META_ROW_STYLE}>
      <span style={META_LABEL_STYLE}>{label}:</span>
      <span style={{ minWidth: 0, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

export function ChangeDetail({ item }: { item: ChangeQueueItem }): React.JSX.Element {
  const statusMeta = STATUS_META[item.status];

  return (
    <div
      data-testid="change-detail"
      style={{ display: "flex", flexDirection: "column", gap: "12px" }}
    >
      {/* Chips: type, urgency (expedite only), status */}
      <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", alignItems: "center" }}>
        <Chip tone="accent">{item.type}</Chip>
        {item.cls === "expedite" && <Chip tone="danger">Urgente</Chip>}
        <Chip tone={statusMeta.tone}>{statusMeta.label}</Chip>
      </div>

      {/* Provenance + dates */}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        {item.date !== "" && <MetaLine label="Fecha" value={item.date} />}
        {item.frd !== "" && <MetaLine label="FRD afectado" value={item.frd} />}
        {item.dependsOn !== "" && <MetaLine label="Depende de" value={item.dependsOn} />}
      </div>

      {/* Rebuilds-already-verified notice — the owner must not miss this (DR-069) */}
      {item.rebuildsVerified && (
        <div data-testid="change-rebuilds-warning" role="alert" style={WARN_BANNER_STYLE}>
          <i className="ti ti-alert-triangle" aria-hidden="true" />
          Este cambio reconstruye trabajo ya verificado.
        </div>
      )}

      {/* Body — titled colour-coded sections (Qué se quiere / Contexto, or Pasos / Esperado / Actual) */}
      <SectionedMarkdown data-testid="change-detail-body" body={item.body} />

      {/* Targeted-build command — the existing `implement change:<slug>` mechanism,
          pointed at THIS item's real id (ModeSelector shows the <slug> placeholder;
          here it's concrete and ready to copy). */}
      <div>
        <CmdRow command={`/pandacorp:implement change:${item.id}`} />
        <p style={CMD_NOTE_STYLE}>
          Construye este cambio específico en la próxima corrida del build.
        </p>
      </div>
    </div>
  );
}
