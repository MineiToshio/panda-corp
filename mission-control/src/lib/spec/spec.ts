/**
 * spec.ts — read & parse a project's Spanish spec digest into structured SpecData
 * for the "Spec" tab (CMP-02-spec-digest).
 *
 * The digest lives at `<project>/.pandacorp/comms/spec-resumen.md` (gitignored Spanish
 * owner-facing layer — the underlying PRD/research/FRD docs stay English). It is a
 * high-level, visual summary: a lead blockquote, then three `## ` sections — PRD,
 * Research and FRDs. PRD/Research are sets of `### subsection` blocks (classified by
 * label → roles / metrics / chips / decisions / refs / prose); FRDs are `### FRD-NN ·
 * Title · TAG` cards with bullet key-points.
 *
 * Parser is PURE & dependency-free (no node imports) so the client SpecDigest can import
 * it without dragging `fs` into the browser bundle; the fs reader lives in read-spec.ts
 * (server-only, imported by the board Server Component). Same split as pitch.ts vs ideas.ts.
 */

type SpecBlockKind = "prose" | "roles" | "metrics" | "chips" | "chips-muted" | "decisions" | "refs";

export interface SpecItem {
  /** Bold lead of a `- **Title** — desc` bullet (or the whole bullet when there's no bold). */
  title: string;
  /** The text after the em-dash (empty for a plain `- text` chip). */
  desc: string;
}

export interface SpecBlock {
  /** The `### ` subsection label (e.g. "Usuarios", "Métricas de éxito"). */
  label: string;
  kind: SpecBlockKind;
  /** Raw markdown of the subsection (used when kind === "prose"). */
  markdown: string;
  /** Parsed bullets (used for the structured kinds). */
  items: SpecItem[];
}

export interface SpecSection {
  /** Clean label: "PRD" | "Research". */
  label: string;
  blocks: SpecBlock[];
}

export interface SpecFrd {
  /** Normalized id, e.g. "FRD-01". */
  id: string;
  title: string;
  /** Short tag from the heading (e.g. "UI", "CLI", "Infra") or null. */
  tag: string | null;
  /** One-line summary shown on the card (the lead prose before any `**Label:**`). */
  summary: string;
  /** Broader overview (modal). Empty when the digest omits it. */
  overview: string;
  /** User stories (modal). */
  userStories: string[];
  /** Business rules (modal). */
  businessRules: string[];
  /** Out-of-scope items (modal). */
  outOfScope: string[];
  /** Open questions to resolve (modal). */
  openQuestions: string[];
}

export interface SpecData {
  proyecto: string | null;
  fase: string | null;
  /** The lead blockquote intro line (one-liner under the title). */
  intro: string | null;
  prd: SpecSection | null;
  research: SpecSection | null;
  frds: SpecFrd[];
  /** false → nothing structured was found (the caller hides the tab). */
  hasContent: boolean;
}

const BULLET_TITLE_RE = /^[-*]\s+\*\*(.+?)\*\*\s*[—–:-]+\s*(.*)$/;
const BULLET_PLAIN_RE = /^[-*]\s+(.+)$/;
const FRD_HEADING_RE = /^FRD[\s-]?\d+/i;

/** Split the leading `---` frontmatter from the body. Dependency-free (no gray-matter). */
function splitFrontmatter(raw: string): { meta: Map<string, string>; body: string } {
  const meta = new Map<string, string>();
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (m?.[1] == null) return { meta, body: raw };
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-zA-Z_]+)\s*:\s*(.*)$/);
    if (kv?.[1] != null && kv[2] != null) {
      meta.set(kv[1].trim(), kv[2].trim().replace(/^["']|["']$/g, ""));
    }
  }
  return { meta, body: raw.slice(m[0].length) };
}

/** The lead intro: the first `>` blockquote line, stripped of markup. */
function parseIntro(body: string): string | null {
  const line = body.split("\n").find((l) => l.trimStart().startsWith(">"));
  if (line == null) return null;
  const text = line
    .replace(/^\s*>\s?/, "")
    .replace(/\*\*/g, "")
    .trim();
  return text.length > 0 ? text : null;
}

/** Split a body into `## ` sections (heading → its lines); the pre-first-heading lead is "". */
function splitH2(body: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  let current = "";
  map.set(current, []);
  for (const line of body.split("\n")) {
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2?.[1] != null) {
      current = h2[1].trim();
      map.set(current, []);
      continue;
    }
    map.get(current)?.push(line);
  }
  return map;
}

/** Split a section's lines into `### ` subsections (heading + markdown). */
function splitH3(lines: string[]): Array<{ heading: string; markdown: string }> {
  const out: Array<{ heading: string; markdown: string }> = [];
  let heading: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (heading != null) out.push({ heading, markdown: buffer.join("\n").trim() });
  };
  for (const line of lines) {
    const h3 = line.match(/^###\s+(.*)$/);
    if (h3?.[1] != null) {
      flush();
      heading = h3[1].trim();
      buffer = [];
      continue;
    }
    if (heading != null) buffer.push(line);
  }
  flush();
  return out;
}

/** Parse `- **Title** — desc` / `- text` bullets into items. */
function parseItems(markdown: string): SpecItem[] {
  const items: SpecItem[] = [];
  for (const line of markdown.split("\n")) {
    const t = line.match(BULLET_TITLE_RE);
    if (t?.[1] != null) {
      items.push({ title: t[1].trim(), desc: (t[2] ?? "").trim() });
      continue;
    }
    const p = line.match(BULLET_PLAIN_RE);
    if (p?.[1] != null) {
      items.push({ title: p[1].replace(/\*\*/g, "").trim(), desc: "" });
    }
  }
  return items;
}

/** Classify a PRD/Research subsection by its label → its rich rendering kind. */
function blockKind(label: string): SpecBlockKind {
  const l = label.toLowerCase();
  if (/usuario/.test(l)) return "roles";
  if (/métrica|metrica|éxito|exito|kpi/.test(l)) return "metrics";
  if (/fuera|backlog/.test(l)) return "chips-muted";
  if (/alcance|incluye|\bv1\b|scope/.test(l)) return "chips";
  if (/abiert|pendiente/.test(l)) return "decisions";
  if (/referent|inspiraci|referenc/.test(l)) return "refs";
  return "prose";
}

/** Build a PRD/Research section model from its raw lines. */
function parseSection(label: string, lines: string[]): SpecSection {
  const blocks = splitH3(lines).map((s): SpecBlock => {
    const kind = blockKind(s.heading);
    return {
      label: s.heading,
      kind,
      markdown: s.markdown,
      items: kind === "prose" ? [] : parseItems(s.markdown),
    };
  });
  return { label, blocks };
}

const FRD_LABEL_RE = /^\*\*(.+?):\*\*\s*(.*)$/;

/**
 * Split an FRD subsection body into its lead summary (before any `**Label:**`) and a
 * map of labelled detail blocks (overview, user stories, business rules, out of scope).
 */
function splitFrdBody(markdown: string): { summary: string; sections: Map<string, string> } {
  const sections = new Map<string, string>();
  const summaryLines: string[] = [];
  let label: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (label != null) sections.set(label, buffer.join("\n").trim());
  };
  for (const line of markdown.split("\n")) {
    const m = line.match(FRD_LABEL_RE);
    if (m?.[1] != null) {
      flush();
      label = m[1].trim().toLowerCase();
      buffer = m[2] != null && m[2] !== "" ? [m[2]] : [];
      continue;
    }
    if (label == null) summaryLines.push(line);
    else buffer.push(line);
  }
  flush();
  return { summary: summaryLines.join(" ").replace(/\s+/g, " ").trim(), sections };
}

/** Return the first labelled block whose key matches any needle (substring), else "". */
function frdSection(sections: Map<string, string>, ...needles: string[]): string {
  for (const [key, value] of sections) {
    if (needles.some((n) => key.includes(n))) return value;
  }
  return "";
}

/** Plain bullet lines (`- text`) → their text. */
function bulletLines(content: string): string[] {
  const out: string[] = [];
  for (const line of content.split("\n")) {
    const m = line.match(/^[-*]\s+(.+)$/);
    if (m?.[1] != null) out.push(m[1].replace(/\*\*/g, "").trim());
  }
  return out;
}

/** Build the FRD cards (+ modal detail) from the FRDs section's raw lines. */
function parseFrds(lines: string[]): SpecFrd[] {
  return splitH3(lines)
    .filter((s) => FRD_HEADING_RE.test(s.heading))
    .map((s): SpecFrd => {
      const parts = s.heading.split("·").map((p) => p.trim());
      const idRaw = parts[0] ?? s.heading;
      const idMatch = idRaw.match(/FRD[\s-]?(\d+)/i);
      const id = idMatch?.[1] != null ? `FRD-${idMatch[1].padStart(2, "0")}` : idRaw;
      const { summary, sections } = splitFrdBody(s.markdown);
      return {
        id,
        title: parts[1] ?? "",
        tag: parts[2] ?? null,
        summary,
        overview: frdSection(sections, "overview", "resumen"),
        userStories: bulletLines(frdSection(sections, "user stor", "historias")),
        businessRules: bulletLines(frdSection(sections, "regla", "business rule")),
        outOfScope: bulletLines(frdSection(sections, "fuera de alcance", "out of scope")),
        openQuestions: bulletLines(frdSection(sections, "open question", "pregunta", "abiert")),
      };
    });
}

/** Find the section whose heading contains `needle` (case-insensitive). */
function findH2(sections: Map<string, string[]>, needle: RegExp): string[] | null {
  for (const [heading, lines] of sections) {
    if (needle.test(heading)) return lines;
  }
  return null;
}

/**
 * Parse a project's spec digest markdown into structured SpecData. Robust to a missing
 * piece (any part degrades to null/[]); `hasContent` is false only when no PRD, Research
 * nor FRD content was found at all.
 */
export function parseSpec(raw: string): SpecData {
  const { meta, body } = splitFrontmatter(raw);
  const sections = splitH2(body);

  const prdLines = findH2(sections, /prd/i);
  const researchLines = findH2(sections, /research|investig/i);
  const frdLines = findH2(sections, /frd/i);

  const prd = prdLines != null ? parseSection("PRD", prdLines) : null;
  const research = researchLines != null ? parseSection("Research", researchLines) : null;
  const frds = frdLines != null ? parseFrds(frdLines) : [];

  const hasContent =
    (prd != null && prd.blocks.length > 0) ||
    (research != null && research.blocks.length > 0) ||
    frds.length > 0;

  return {
    proyecto: meta.get("proyecto") ?? null,
    fase: meta.get("fase") ?? null,
    intro: parseIntro(body),
    prd,
    research,
    frds,
    hasContent,
  };
}
