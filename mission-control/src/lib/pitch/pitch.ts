/**
 * pitch.ts — parse an idea card's memo body into structured PitchData for the
 * Propuesta tab (CMP-02-idea-pitch).
 *
 * The card `.md` body is the source of truth (discover redesign, plugin v9.9.0). The memo skeleton:
 * a leading blockquote (verdict + "La apuesta"), a "De un vistazo" block and a "Profundizar" block —
 * each a set of labelled sections (`### subsection` with rich markdown, OR a `- **Label:** value`
 * bullet for the older card format) — plus a scorecard table. One parser renders both formats. Prose
 * is preserved verbatim (rendered later via the shared <Markdown>); only the STRUCTURE is extracted.
 *
 * Pure, dependency-free, side-effect-free (a data-layer reader per project-structure).
 */

export type BadgeTone = "build" | "warn" | "info" | "pain" | "neutral";

interface PitchBadge {
  label: string;
  tone: BadgeTone;
}

type GlanceKind = "problema" | "vision" | "default";

export interface GlanceItem {
  /** The label (e.g. "La apuesta", "El problema", "La visión"). */
  label: string;
  /** The value markdown (prose, quotes, lists — rendered via <Markdown>). */
  value: string;
  /** Drives special framing: problema → quote, vision → feature grid. */
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
  /** The subsection's markdown body (scorecard table lines stripped). */
  markdown: string;
}

export interface RiskMitigation {
  risk: string;
  mitigation: string;
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
  if (v.includes("build") || v.includes("🏆") || v.includes("🏗")) return "build";
  if (v.includes("integr") || v.includes("🔌")) return "info";
  return "warn"; // validate / validar / 🧪
}

/** Classify a glance item by its label for special framing. */
function glanceKind(label: string): GlanceKind {
  const l = label.toLowerCase();
  if (l.includes("problema")) return "problema";
  if (l.includes("visión") || l.includes("vision")) return "vision";
  return "default";
}

/**
 * Pull "verdict" and "la apuesta" from the SINGLE lead blockquote line (the one with "la apuesta").
 * Using just that line (not all `>` lines joined) keeps the one-liner from swallowing the Badges line
 * or the problema testimonial quote.
 */
function parseLead(body: string): { verdict: string | null; laApuesta: string | null } {
  const leadLine =
    body.split("\n").find((l) => l.trimStart().startsWith(">") && /la apuesta/i.test(l)) ?? "";
  const verdictMatch = leadLine.match(
    /(?:veredicto|verdict)\s*:?\s*\*{0,2}([^*—\n]+?)\*{0,2}\s*(?:—|-{1,2}|\*\*\s*la apuesta)/i,
  );
  const apuestaMatch = leadLine.match(/la apuesta\s*:?\s*\*{0,2}\s*:?\s*(.+)$/i);
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

/**
 * Split a block's lines into `### ` subsections (heading + markdown). Only the SCORECARD table
 * (the one whose header has "founder-fit") is stripped — it renders separately as bars; every other
 * table (e.g. a Riesgo|Mitigación table) is kept so the section can render it.
 */
function splitSubsections(lines: string[]): DeepSection[] {
  const sections: DeepSection[] = [];
  let heading: string | null = null;
  let buffer: string[] = [];
  let inScorecard = false;
  const flush = () => {
    if (heading != null) sections.push({ heading, markdown: buffer.join("\n").trim() });
  };
  for (const line of lines) {
    const h3 = line.match(/^###\s+(.*)$/);
    if (h3 && h3[1] != null) {
      flush();
      heading = h3[1].trim();
      buffer = [];
      inScorecard = false;
      continue;
    }
    if (heading == null) continue;
    const isTableLine = line.trimStart().startsWith("|");
    if (isTableLine && /founder-fit/i.test(line)) {
      inScorecard = true; // start of the scorecard table → drop it
      continue;
    }
    if (inScorecard) {
      if (isTableLine) continue; // separator + data row of the scorecard
      inScorecard = false; // the scorecard table ended
    }
    buffer.push(line);
  }
  flush();
  return sections.filter((s) => s.markdown.length > 0);
}

const GLANCE_BULLET_RE = /^[-*]\s+\*\*(.+?):\*\*\s*(.*)$/;

/** Parse the "De un vistazo" block: rich `### subsections` (new format) OR `- **Label:** value` bullets. */
function parseGlance(lines: string[]): GlanceItem[] {
  if (lines.some((l) => /^###\s+/.test(l))) {
    return splitSubsections(lines).map((s) => ({
      label: s.heading,
      value: s.markdown,
      kind: glanceKind(s.heading),
    }));
  }
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

/** Cells of a markdown table row (outer pipes dropped). */
function tableCells(line: string): string[] {
  const parts = line.split("|");
  return parts.slice(1, parts.length - 1).map((c) => c.trim());
}

/** Parse the scorecard table (the row with "founder-fit") into axes. */
function parseScorecard(body: string): ScorecardAxis[] {
  const lines = body.split("\n");
  const headerIdx = lines.findIndex((l) => l.includes("|") && /founder-fit/i.test(l));
  if (headerIdx === -1) return [];
  const header = tableCells(lines[headerIdx] ?? "");
  let dataRow: string[] | null = null;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const l = lines[i] ?? "";
    if (!l.includes("|")) break;
    if (/^[\s|:-]+$/.test(l)) continue; // separator
    dataRow = tableCells(l);
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

/**
 * Parse a "Riesgo | Mitigación" markdown table from a section's markdown into pairs.
 * Returns [] when the section has no such table — the caller then renders the prose as-is.
 */
export function parseRiskMitigation(markdown: string): RiskMitigation[] {
  const lines = markdown.split("\n");
  const headerIdx = lines.findIndex(
    (l) => l.includes("|") && /riesgo/i.test(l) && /mitig/i.test(l),
  );
  if (headerIdx === -1) return [];
  const pairs: RiskMitigation[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const l = lines[i] ?? "";
    if (!l.includes("|")) break;
    if (/^[\s|:-]+$/.test(l)) continue; // separator
    const cells = tableCells(l);
    if (cells[0] && cells[1]) pairs.push({ risk: cells[0], mitigation: cells[1] });
  }
  return pairs;
}

/** Infer a badge's colour tone from its text. */
function badgeTone(label: string): BadgeTone {
  const l = label.toLowerCase();
  if (/\bbuild\b|🏗|🏆/.test(l)) return "build";
  if (/validar|validate|🧪/.test(l)) return "warn";
  if (/integr|🔌/.test(l)) return "info";
  if (/painkiller/.test(l)) return "pain";
  if (/vitamin|candy|dulce/.test(l)) return "warn";
  if (/retorno|oportunidad|personal|monetary|mixed/.test(l)) return "info";
  return "neutral"; // cubeta / esfuerzo / días / etc.
}

/**
 * Parse the explicit `> **Badges:** a | b | c` line from the memo (pipe-separated, so a badge may
 * itself contain `·`). Returns null when the card has no Badges line (→ fall back to buildBadges).
 */
function parseBadgesLine(body: string): PitchBadge[] | null {
  const line = body.split("\n").find((l) => /^>\s*\*{0,2}\s*badges/i.test(l.trimStart()));
  if (line == null) return null;
  const after = line.replace(/^>\s*\*{0,2}\s*badges\s*:?\s*\*{0,2}\s*/i, "").trim();
  const parts = after
    .split("|")
    .map((s) => s.replace(/\*\*/g, "").trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) return null;
  return parts.map((label) => ({ label, tone: badgeTone(label) }));
}

/** Fallback hero badges (no explicit Badges line): verdict + effort/return scorecard axes. */
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
 * Parse an idea card's memo body into structured PitchData. Robust to a missing piece (any field
 * degrades to empty/null); `hasStructured` is false only when neither a glance nor a deep-dive was
 * found, signalling the caller to fall back to the raw markdown.
 */
export function parsePitch(body: string): PitchData {
  const { verdict, laApuesta } = parseLead(body);
  const sections = splitSections(body);
  const glance = parseGlance(findSection(sections, "vistazo"));
  const deepDive = splitSubsections(findSection(sections, "profundizar"));
  const scorecard = parseScorecard(body);
  const badges = parseBadgesLine(body) ?? buildBadges(verdict, scorecard);
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
