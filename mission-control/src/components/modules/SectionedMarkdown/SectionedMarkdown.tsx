/**
 * SectionedMarkdown — render a markdown body as **titled, colour-coded sections**
 * (CMP-17-detail / CMP-22-detail, FRD-17 / FRD-22).
 *
 * The detail modals for memory lessons and backlog items both want the same look:
 * instead of one wall of text, each labelled part becomes a real section header
 * (icon + coloured label) with its content rendered via the shared `Markdown`
 * primitive. The two sources mark their sections differently, so this component
 * auto-detects the mode:
 *
 *  - **heading mode** — the body has `## Heading` lines (backlog items: Problem /
 *    Root cause / Fix plan / Tests / Done when / Out of scope). Used when ANY line
 *    starts with `## `.
 *  - **label mode** — the body has leading bold labels `**Label:** …` (lessons:
 *    Situation / Lesson / Apply next time / Why it matters).
 *
 * A body that matches neither is rendered as plain markdown (the preamble path).
 * Read-only.
 */

import { Markdown } from "@/components/core/Markdown/Markdown";

// ---------------------------------------------------------------------------
// Section parsing (flush-on-heading) + per-section icon/colour
// ---------------------------------------------------------------------------

type Section = { label: string; content: string };
type ParsedBody = { preamble: string; sections: Section[] };

/** A markdown H2 heading like `## Fix plan`. */
const HEADING_RE = /^##\s+(.+?)\s*$/;
/** A leading bold label like `**Apply next time (…):**  rest`. */
const LABEL_RE = /^\*\*(.+?):\*\*\s*(.*)$/;

/**
 * If `line` opens a section, return its label + inline content, else `null`. In
 * **heading mode** a `## Label` line opens a section (no inline content); in **label
 * mode** a leading `**Label:**  rest` opens one (with `rest` as inline content).
 */
function matchSectionStart(
  line: string,
  useHeadings: boolean,
): { label: string; content: string } | null {
  const trimmed = line.trim();
  if (useHeadings) {
    const heading = HEADING_RE.exec(trimmed);
    return heading?.[1] !== undefined ? { label: heading[1].trim(), content: "" } : null;
  }
  const label = LABEL_RE.exec(trimmed);
  return label?.[1] !== undefined ? { label: label[1].trim(), content: label[2] ?? "" } : null;
}

/**
 * Split a body into a preamble + labelled sections. If any line is an H2 heading we
 * parse in **heading mode** (`## Label`); otherwise in **label mode** (a leading
 * `**Label:**`). Following lines accumulate into the open section (the flush-on-heading
 * pattern); content before the first marker is the preamble. If nothing matches, the
 * whole body is the preamble.
 */
function parseBody(body: string): ParsedBody {
  const lines = body.split("\n");
  const useHeadings = lines.some((line) => HEADING_RE.test(line.trim()));

  const sections: Section[] = [];
  const preambleLines: string[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    const start = matchSectionStart(line, useHeadings);
    if (start !== null) {
      if (current !== null) sections.push(current);
      current = start;
    } else if (current !== null) {
      current.content += `\n${line}`;
    } else {
      preambleLines.push(line);
    }
  }
  if (current !== null) sections.push(current);
  return { preamble: preambleLines.join("\n").trim(), sections };
}

type SectionStyle = { icon: string; color: string };

/**
 * Prefix → style table. Each entry's `prefixes` are matched (case-insensitively,
 * English + Spanish) against the label's leading words; first match wins, so more
 * specific prefixes (`root cause`, `fix plan`, `done when`) come before broad ones
 * (`plan`, `fix`, `done`). Covers lesson labels (Situation / Lesson / Apply / Why)
 * and backlog headings (Problem / Root cause / Fix plan / Tests / Done when / Out of
 * scope).
 */
const SECTION_STYLES: ReadonlyArray<{ prefixes: readonly string[]; style: SectionStyle }> = [
  {
    prefixes: ["situation", "situación"],
    style: { icon: "ti-alert-circle", color: "var(--color-info)" },
  },
  {
    prefixes: ["lesson", "lección"],
    style: { icon: "ti-bulb", color: "var(--color-accent-text)" },
  },
  { prefixes: ["apply", "aplica"], style: { icon: "ti-arrow-right", color: "var(--color-ok)" } },
  {
    prefixes: ["why", "por qué", "por que"],
    style: { icon: "ti-help-circle", color: "var(--color-text2)" },
  },
  {
    prefixes: ["problem", "problema"],
    style: { icon: "ti-alert-triangle", color: "var(--color-danger)" },
  },
  {
    prefixes: ["root cause", "causa"],
    style: { icon: "ti-microscope", color: "var(--color-warn)" },
  },
  {
    prefixes: ["fix plan", "fix", "plan"],
    style: { icon: "ti-tool", color: "var(--color-accent-text)" },
  },
  { prefixes: ["test", "prueba"], style: { icon: "ti-flask", color: "var(--color-info)" } },
  {
    prefixes: ["done when", "done", "hecho"],
    style: { icon: "ti-circle-check", color: "var(--color-ok)" },
  },
  { prefixes: ["out of scope", "fuera"], style: { icon: "ti-ban", color: "var(--color-text2)" } },
];

const FALLBACK_STYLE: SectionStyle = { icon: "ti-point", color: "var(--color-accent-text)" };

/** Icon + colour for a section label (first prefix match wins, fallback safe). */
function sectionStyle(label: string): SectionStyle {
  const l = label.toLowerCase();
  const match = SECTION_STYLES.find((entry) => entry.prefixes.some((p) => l.startsWith(p)));
  return match?.style ?? FALLBACK_STYLE;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const SECTION_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "13px",
  margin: "0 0 4px",
};

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

/**
 * Render `body` as titled colour-coded sections. When the body has no recognised
 * section markers it degrades to a single `Markdown` block (still nicely formatted).
 */
export function SectionedMarkdown({
  body,
  "data-testid": testId,
}: {
  body: string;
  "data-testid"?: string;
}): React.JSX.Element {
  const { preamble, sections } = parseBody(body);

  return (
    <div data-testid={testId} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {preamble !== "" && <Markdown>{preamble}</Markdown>}
      {sections.map((section) => (
        <SectionBlock key={section.label} section={section} />
      ))}
    </div>
  );
}
