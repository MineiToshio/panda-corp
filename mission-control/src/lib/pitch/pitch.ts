/**
 * pitch.ts — parse an idea card's memo body into structured PitchData for the
 * Propuesta tab (CMP-02-idea-pitch).
 *
 * The card `.md` body is the source of truth (discover redesign, plugin v9.9.0). Both the
 * new hot→cold memo and the prior card format share the same skeleton — a leading blockquote
 * (verdict + "La apuesta"), a "De un vistazo" block of bold-labelled bullets, a scorecard
 * table, and a "Profundizar" block of `###` subsections — so one parser renders both. Prose is
 * preserved verbatim (rendered later via the shared <Markdown>); only the STRUCTURE is extracted.
 *
 * Pure, dependency-free, side-effect-free (a data-layer reader per project-structure).
 */

export type BadgeTone = "build" | "warn" | "info" | "neutral";

interface PitchBadge {
  label: string;
  tone: BadgeTone;
}

type GlanceKind = "problema" | "vision" | "default";

export interface GlanceItem {
  /** The bold label (e.g. "Problema", "Por qué tú", "La visión"). */
  label: string;
  /** The value markdown (may contain bold/links — rendered via <Markdown>). */
  value: string;
  /** Drives special framing: problema → quote callout, vision → framed prize. */
  kind: GlanceKind;
}

export type ScoreLevel = "high" | "mid" | "low";

export interface ScorecardAxis {
  axis: string;
  /** The raw cell text (shown as the caption — honest, never invented). */
  value: string;
  level: ScoreLevel;
}

export interface DeepSection {
  heading: string;
  /** The subsection's markdown body (table lines stripped — the scorecard renders separately). */
  markdown: string;
}

export interface PitchData {
  verdict: string | null;
  laApuesta: string | null;
  badges: PitchBadge[];
  glance: GlanceItem[];
  scorecard: ScorecardAxis[];
  deepDive: DeepSection[];
  /** false → nothing structured was found; the caller renders the raw body as a fallback. */
  hasStructured: boolean;
}

const HIGH_RE = /\b(alto|alta|high|micro)\b/i;
const LOW_RE = /\b(bajo|baja|low|grande|large)\b/i;

/** Map a scorecard cell's text to an approximate magnitude for the bar (the text stays the caption). */
function levelOf(text: string): ScoreLevel {
  if (HIGH_RE.test(text)) return "high";
  if (LOW_RE.test(text)) return "low";
  return "mid";
}

/** Tone for the verdict badge from its label/emoji. */
function verdictTone(verdict: string): BadgeTone {
  const v = verdict.toLowerCase();
  if (v.includes("build") || v.includes("🏆")) return "build";
  if (v.includes("integr") || v.includes("🔌")) return "info";
  return "warn"; // validate / validar / 🧪
}

/** Classify a glance bullet by its label for special framing. */
function glanceKind(label: string): GlanceKind {
  const l = label.toLowerCase();
  if (l.includes("problema")) return "problema";
  if (l.includes("visión") || l.includes("vision")) return "vision";
  return "default";
}

/** Pull "verdict" and "la apuesta" from the leading blockquote line(s). */
function parseLead(body: string): { verdict: string | null; laApuesta: string | null } {
  const quote = body
    .split("\n")
    .filter((l) => l.trimStart().startsWith(">"))
    .join(" ");
  const verdictMatch = quote.match(
    /(?:veredicto|verdict)\s*:?\s*\*{0,2}([^*—\n]+?)\*{0,2}\s*(?:—|-{1,2}|\*\*\s*la apuesta)/i,
  );
  const apuestaMatch = quote.match(/la apuesta\s*:?\s*\*{0,2}\s*:?\s*([^\n]+)/i);
  const verdict = verdictMatch?.[1]?.trim() ?? null;
  let laApuesta = apuestaMatch?.[1]?.trim() ?? null;
  if (laApuesta != null)
    laApuesta = laApuesta
      .replace(/\*\*/g, "")
      .replace(/^[:\s]+/, "")
      .trim();
  return { verdict, laApuesta: laApuesta || null };
}

/** Split the body into `## ` sections (heading text → its lines). The lead (pre-first-heading) is "". */
function splitSections(body: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  let current = "";
  map.set(current, []);
  for (const line of body.split("\n")) {
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2 && h2[1] != null) {
      current = h2[1].trim();
      map.set(current, []);
      continue;
    }
    map.get(current)?.push(line);
  }
  return map;
}

/** Find the section whose heading contains `needle` (case-insensitive). */
function findSection(sections: Map<string, string[]>, needle: string): string[] {
  for (const [heading, lines] of sections) {
    if (heading.toLowerCase().includes(needle)) return lines;
  }
  return [];
}

const GLANCE_BULLET_RE = /^[-*]\s+\*\*(.+?):\*\*\s*(.*)$/;

/** Parse "- **Label:** value" bullets from the "De un vistazo" block. */
function parseGlance(lines: string[]): GlanceItem[] {
  const items: GlanceItem[] = [];
  for (const line of lines) {
    const m = line.match(GLANCE_BULLET_RE);
    if (m?.[1] != null && m[2] != null) {
      const label = m[1].trim();
      items.push({ label, value: m[2].trim(), kind: glanceKind(label) });
    }
  }
  return items;
}

/** Parse the scorecard table (the row with "founder-fit") into axes. */
function parseScorecard(body: string): ScorecardAxis[] {
  const lines = body.split("\n");
  const headerIdx = lines.findIndex((l) => l.includes("|") && /founder-fit/i.test(l));
  if (headerIdx === -1) return [];
  const cells = (l: string): string[] => {
    const parts = l.split("|");
    return parts.slice(1, parts.length - 1).map((c) => c.trim());
  };
  const header = cells(lines[headerIdx] ?? "");
  // The data row is the first table row after the separator (skip the |---| line).
  let dataRow: string[] | null = null;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const l = lines[i] ?? "";
    if (!l.includes("|")) break;
    if (/^[\s|:-]+$/.test(l)) continue; // separator
    dataRow = cells(l);
    break;
  }
  if (dataRow == null) return [];
  const axes: ScorecardAxis[] = [];
  for (let i = 1; i < header.length; i++) {
    const axis = header[i]?.trim();
    const value = dataRow[i]?.trim() ?? "";
    if (axis && value) axes.push({ axis, value, level: levelOf(value) });
  }
  return axes;
}

/** Parse the "Profundizar" block into `### ` subsections (table lines stripped). */
function parseDeepDive(lines: string[]): DeepSection[] {
  const sections: DeepSection[] = [];
  let heading: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (heading != null) {
      const markdown = buffer.join("\n").trim();
      sections.push({ heading, markdown });
    }
  };
  for (const line of lines) {
    const h3 = line.match(/^###\s+(.*)$/);
    if (h3 && h3[1] != null) {
      flush();
      heading = h3[1].trim();
      buffer = [];
      continue;
    }
    if (heading != null && !line.trimStart().startsWith("|")) buffer.push(line);
  }
  flush();
  return sections.filter((s) => s.markdown.length > 0);
}

/** Build the hero badges from the verdict + the effort/return scorecard axes. */
function buildBadges(verdict: string | null, scorecard: ScorecardAxis[]): PitchBadge[] {
  const badges: PitchBadge[] = [];
  if (verdict) badges.push({ label: verdict, tone: verdictTone(verdict) });
  const effort = scorecard.find((a) => /esfuerzo/i.test(a.axis));
  if (effort) badges.push({ label: `esfuerzo: ${effort.value}`, tone: "neutral" });
  const ret = scorecard.find((a) => /retorno/i.test(a.axis));
  if (ret) badges.push({ label: ret.value, tone: "info" });
  return badges;
}

/**
 * Parse an idea card's memo body into structured PitchData. Robust to a missing piece
 * (any field degrades to empty/null); `hasStructured` is false only when neither a glance
 * nor a deep-dive was found, signalling the caller to fall back to the raw markdown.
 */
export function parsePitch(body: string): PitchData {
  const { verdict, laApuesta } = parseLead(body);
  const sections = splitSections(body);
  const glance = parseGlance(findSection(sections, "vistazo"));
  const deepDive = parseDeepDive(findSection(sections, "profundizar"));
  const scorecard = parseScorecard(body);
  const badges = buildBadges(verdict, scorecard);
  return {
    verdict,
    laApuesta,
    badges,
    glance,
    scorecard,
    deepDive,
    hasStructured: glance.length > 0 || deepDive.length > 0,
  };
}
