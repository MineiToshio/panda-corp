/**
 * LessonDetail — the body of a memory-lesson detail modal (CMP-17-detail, FRD-17).
 *
 * A metadata strip (type·domain, status, eval-gate, promotion, source, links) + the
 * lesson body rendered as **titled, colour-coded sections**. Lesson bodies use bold
 * inline labels (`**Situation:** …`, `**Lesson:** …`, `**Apply next time:** …`,
 * `**Why it matters:** …`); we parse those into real section headers (icon + coloured
 * label) with the content rendered via the shared `Markdown` primitive — so the parts
 * are easy to distinguish instead of one wall of bold-prefixed text. Read-only.
 */

import { Chip, type ChipTone } from "@/components/core/Chip/Chip";
import { Markdown } from "@/components/core/Markdown/Markdown";
import type { Lesson } from "@/lib/memory/memory";

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
// Section parsing (flush-on-label) + per-section icon/colour
// ---------------------------------------------------------------------------

type Section = { label: string; content: string };
type ParsedBody = { preamble: string; sections: Section[] };

/** A leading bold label like `**Apply next time (…):**  rest`. */
const LABEL_RE = /^\*\*(.+?):\*\*\s*(.*)$/;

/**
 * Split a lesson body into a preamble + labelled sections. Any line that starts with
 * a bold `**Label:**` opens a new section; following lines accumulate into it until
 * the next label (the flush-on-heading pattern). If nothing matches, the whole body
 * is the preamble (rendered as plain markdown).
 */
function parseBody(body: string): ParsedBody {
  const sections: Section[] = [];
  const preambleLines: string[] = [];
  let current: Section | null = null;

  for (const line of body.split("\n")) {
    const match = LABEL_RE.exec(line.trim());
    if (match?.[1] !== undefined) {
      if (current !== null) sections.push(current);
      current = { label: match[1].trim(), content: match[2] ?? "" };
    } else if (current !== null) {
      current.content += `\n${line}`;
    } else {
      preambleLines.push(line);
    }
  }
  if (current !== null) sections.push(current);
  return { preamble: preambleLines.join("\n").trim(), sections };
}

/** Icon + colour for a section, matched by the label's leading word (fallback safe). */
function sectionStyle(label: string): { icon: string; color: string } {
  const l = label.toLowerCase();
  if (l.startsWith("situation") || l.startsWith("situación"))
    return { icon: "ti-alert-circle", color: "var(--color-info)" };
  if (l.startsWith("lesson") || l.startsWith("lección"))
    return { icon: "ti-bulb", color: "var(--color-accent-text)" };
  if (l.startsWith("apply") || l.startsWith("aplica"))
    return { icon: "ti-arrow-right", color: "var(--color-ok)" };
  if (l.startsWith("why") || l.startsWith("por qué") || l.startsWith("por que"))
    return { icon: "ti-help-circle", color: "var(--color-text2)" };
  return { icon: "ti-point", color: "var(--color-accent-text)" };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const META_ROW_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--color-text3)",
  display: "flex",
  gap: "5px",
};

const SECTION_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "13px",
  margin: "0 0 4px",
};

function MetaLine({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div style={META_ROW_STYLE}>
      <span style={{ color: "var(--color-text2)", flexShrink: 0 }}>{label}:</span>
      <span style={{ minWidth: 0, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

/** One titled, colour-coded section (header + markdown content). */
function SectionBlock({ section }: { section: Section }): React.JSX.Element {
  const { icon, color } = sectionStyle(section.label);
  return (
    <div style={{ borderLeft: `2px solid ${color}`, paddingLeft: "12px" }}>
      <div style={{ ...SECTION_HEADER_STYLE, color }}>
        <i className={`ti ${icon}`} style={{ fontSize: "15px" }} aria-hidden="true" />
        {section.label}
      </div>
      <Markdown>{section.content.trim()}</Markdown>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LessonDetail
// ---------------------------------------------------------------------------

export function LessonDetail({ lesson }: { lesson: Lesson }): React.JSX.Element {
  const statusMeta = STATUS_META[lesson.status];
  const promotionMeta = PROMOTION_META[lesson.promotion];
  const { preamble, sections } = parseBody(lesson.body);

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
      <div
        data-testid="lesson-detail-body"
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        {preamble !== "" && <Markdown>{preamble}</Markdown>}
        {sections.map((section) => (
          <SectionBlock key={section.label} section={section} />
        ))}
      </div>
    </div>
  );
}
