/**
 * LessonDetail — the body of a memory-lesson detail modal (CMP-17-detail, FRD-17).
 *
 * A metadata strip (type·domain, status, eval-gate, promotion, source, links) + the
 * lesson body rendered as **titled, colour-coded sections** via the shared
 * `SectionedMarkdown` primitive. Lesson bodies use bold inline labels
 * (`**Situation:** …`, `**Lesson:** …`, `**Apply next time:** …`, `**Why it
 * matters:** …`) which `SectionedMarkdown` turns into real section headers, so the
 * parts are easy to distinguish instead of one wall of bold-prefixed text.
 *
 * Read-only. An optional `command` renders a copyable command row at the bottom — the
 * promotions queue passes the `/pandacorp:learn` command so the owner can approve the
 * promotion straight from the detail (candidate/prune modals omit it).
 */

import { Chip, type ChipTone } from "@/components/core/Chip/Chip";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";
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

const COMMAND_LABEL_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text2)",
  margin: "0 0 5px",
};

const COMMAND_CODE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "12px",
  padding: "0.2em 0.5em",
  borderRadius: "var(--radius-sm, 8px)",
  background: "var(--color-panel)",
  color: "var(--color-text)",
  wordBreak: "break-all",
};

/** Copyable "run this to approve" row (promotions only). */
function CommandRow({ command }: { command: string }): React.JSX.Element {
  return (
    <div
      data-testid="lesson-detail-command"
      style={{ borderTop: "1px solid var(--color-border)", paddingTop: "12px" }}
    >
      <p style={COMMAND_LABEL_STYLE}>Para promover, corre en la fábrica:</p>
      <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
        <code style={COMMAND_CODE_STYLE}>{command}</code>
        <CopyButton value={command} label="Copiar comando" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LessonDetail
// ---------------------------------------------------------------------------

export function LessonDetail({
  lesson,
  command,
}: {
  lesson: Lesson;
  /** Optional copyable command (the promotions queue passes /pandacorp:learn). */
  command?: string;
}): React.JSX.Element {
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

      {/* Provenance + loop v2 retrieval fields (trigger / applied_in, WO-17-005) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        {lesson.trigger !== "" && <MetaLine label="Úsala cuando" value={lesson.trigger} />}
        {lesson.appliedIn.length > 0 && (
          <MetaLine
            label={`Aplicada en ${lesson.appliedIn.length} proyecto${lesson.appliedIn.length === 1 ? "" : "s"}`}
            value={lesson.appliedIn.join(", ")}
          />
        )}
        {lesson.source !== "" && <MetaLine label="Origen" value={lesson.source} />}
        {lesson.links.length > 0 && <MetaLine label="Vínculos" value={lesson.links.join(", ")} />}
      </div>

      {/* Body — titled colour-coded sections (Situation / Lesson / Apply / Why) */}
      <SectionedMarkdown data-testid="lesson-detail-body" body={lesson.body} />

      {/* Optional approve-command row (promotions) */}
      {command != null && command !== "" && <CommandRow command={command} />}
    </div>
  );
}
