/**
 * LessonDetail — the body of a memory-lesson detail modal (CMP-17-detail, FRD-17).
 *
 * A metadata strip (type·domain, status, eval-gate, promotion, source, links) + the
 * lesson body rendered as **titled, colour-coded sections** via the shared
 * `SectionedMarkdown` primitive. Lesson bodies use bold inline labels
 * (`**Situation:** …`, `**Lesson:** …`, `**Apply next time:** …`, `**Why it
 * matters:** …`) which `SectionedMarkdown` turns into real section headers, so the
 * parts are easy to distinguish instead of one wall of bold-prefixed text. Read-only.
 */

import { Chip, type ChipTone } from "@/components/core/Chip/Chip";
import type { Lesson } from "@/lib/memory/memory";
import { SectionedMarkdown } from "./SectionedMarkdown/SectionedMarkdown";

// ---------------------------------------------------------------------------
// Status / promotion chips
// ---------------------------------------------------------------------------

const STATUS_META: Record<Lesson["status"], { label: string; tone: ChipTone }> = {
  candidate: { label: "candidata", tone: "warn" },
  active: { label: "activa", tone: "ok" },
  deprecated: { label: "obsoleta", tone: "secondary" },
} as const;

const PROMOTION_META: Partial<Record<Lesson["promotion"], { label: string; tone: ChipTone }>> = {
  proposed: { label: "promoción propuesta", tone: "accent" },
  approved: { label: "promovida", tone: "ok" },
  rejected: { label: "promoción rechazada", tone: "secondary" },
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const META_ROW_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3)",
  display: "flex",
  gap: "5px",
};

function MetaLine({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div style={META_ROW_STYLE}>
      <span style={{ color: "var(--color-text2)", flexShrink: 0 }}>{label}:</span>
      <span style={{ minWidth: 0, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LessonDetail
// ---------------------------------------------------------------------------

export function LessonDetail({ lesson }: { lesson: Lesson }): React.JSX.Element {
  const statusMeta = STATUS_META[lesson.status];
  const promotionMeta = PROMOTION_META[lesson.promotion];

  return (
    <div
      data-testid="lesson-detail"
      style={{ display: "flex", flexDirection: "column", gap: "14px" }}
    >
      {/* Chips: type·domain, status, eval-gate (candidates), promotion */}
      <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", alignItems: "center" }}>
        <Chip tone="accent">
          {lesson.type} · {lesson.domain}
        </Chip>
        <Chip tone={statusMeta.tone}>{statusMeta.label}</Chip>
        {lesson.status === "candidate" && (
          <Chip tone={lesson.evalGate === "corroborated" ? "ok" : "warn"}>
            {lesson.evalGate === "corroborated" ? "corroborada" : "esperando 2ª aparición"}
          </Chip>
        )}
        {promotionMeta != null && <Chip tone={promotionMeta.tone}>{promotionMeta.label}</Chip>}
      </div>

      {/* Provenance */}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        {lesson.source !== "" && <MetaLine label="Origen" value={lesson.source} />}
        {lesson.links.length > 0 && <MetaLine label="Vínculos" value={lesson.links.join(", ")} />}
      </div>

      {/* Body — titled colour-coded sections (Situation / Lesson / Apply / Why) */}
      <SectionedMarkdown data-testid="lesson-detail-body" body={lesson.body} />
    </div>
  );
}
