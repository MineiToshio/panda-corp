/**
 * architecture.ts — parse a project's Spanish architecture digest into structured
 * ArchitectureData for the "Arquitectura" tab (CMP-02-architecture-digest).
 *
 * The digest lives at `<project>/.pandacorp/comms/arquitectura-resumen.md` (gitignored Spanish
 * owner-facing layer — the underlying architecture.md/ADRs/blueprints stay English). It is a
 * high-level, visual summary: a lead blockquote, then four `## ` sections — a Stack TABLE
 * (Capa · Elección · Por qué), a CONDITIONAL data model, communication/services, and one
 * `### FRD-NN · Title` card per FRD (a blueprint one-liner + its work orders).
 *
 * The implementation-plan DAG, the ADRs and the env vars are NOT in the digest — the tab reads
 * those live from the real artifacts (work-order frontmatter, `docs/adr/*`, `.env.example`).
 *
 * Parser is PURE & dependency-free (no node imports) so the client ArchitectureDigest can import
 * it without dragging `fs` into the browser bundle; the fs reader lives in read-architecture.ts
 * (server-only, imported by the board Server Component). Same split as spec.ts vs read-spec.ts.
 */

interface ArchRow {
  /** Layer name, e.g. "Framework / UI". */
  capa: string;
  /** The chosen technology. */
  eleccion: string;
  /** One-line rationale. */
  porque: string;
}

export interface ArchItem {
  /** Bold lead of a `- **Title** — desc` bullet (or the whole bullet when there's no bold). */
  title: string;
  /** The text after the em-dash (empty for a plain `- text` bullet). */
  desc: string;
}

interface ArchDataModel {
  /** True when the digest declares "Sin base de datos" (content-as-code) — drives the "Sin BD" branch. */
  isNone: boolean;
  /** The lead prose under the heading (before the entity bullets). */
  note: string;
  /** The entities — content entities (no-DB) or DB tables. */
  entities: ArchItem[];
}

interface ArchWo {
  /** Normalized work-order id, e.g. "WO-00-001". */
  id: string;
  /** One-line summary of the work order. */
  desc: string;
}

export interface ArchFrd {
  /** Normalized id, e.g. "FRD-01". */
  id: string;
  title: string;
  /** The `**Blueprint:**` one-liner (implementation design summary). Empty when absent. */
  blueprint: string;
  /** The `**Work orders:**` bullets, summarized. */
  workOrders: ArchWo[];
}

export interface ArchitectureData {
  proyecto: string | null;
  fase: string | null;
  /** One-line stack summary (frontmatter `stack`) shown under the hero title. */
  stack: string | null;
  /** Running cost (frontmatter `coste`, e.g. "$0/mes") — a hero chip. */
  coste: string | null;
  /** Hosting (frontmatter `host`) — a hero chip. */
  host: string | null;
  /** The lead blockquote intro line (one-liner under the title). */
  intro: string | null;
  /** Stack matrix rows (from the `## 🧱 Stack` table). */
  stackRows: ArchRow[];
  /** Data model — null when the section is absent (CONDITIONAL render). */
  dataModel: ArchDataModel | null;
  /** Communication & services bullets. */
  services: ArchItem[];
  /** Per-FRD cards. */
  frds: ArchFrd[];
  /** false → nothing structured was found (the caller hides the tab). */
  hasContent: boolean;
}

// Title = the leading **bold**; desc = everything after it (tolerant of any separator between
// the bold and the description, e.g. `- **T** (x) — desc`). Same contract as spec.ts.
const BULLET_TITLE_RE = /^[-*]\s+\*\*(.+?)\*\*\s*(.*)$/;
const BULLET_PLAIN_RE = /^[-*]\s+(.+)$/;
const WO_ID_RE = /WO[\s-]?(\d{2,})[\s-](\d{3,})/i;

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

/** Parse `- **Title** — desc` / `- text` bullets into items. Same contract as spec.ts. */
function parseItems(markdown: string): ArchItem[] {
  const items: ArchItem[] = [];
  for (const line of markdown.split("\n")) {
    const t = line.match(BULLET_TITLE_RE);
    if (t?.[1] != null) {
      const desc = (t[2] ?? "")
        .replace(/^[\s—–:-]+/, "")
        .replace(/\*\*/g, "")
        .trim();
      items.push({ title: t[1].trim(), desc });
      continue;
    }
    const p = line.match(BULLET_PLAIN_RE);
    if (p?.[1] != null) {
      items.push({ title: p[1].replace(/\*\*/g, "").trim(), desc: "" });
    }
  }
  return items;
}

/** Split one `| a | b | c |` table row into trimmed cells (drops the leading/trailing empties). */
function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** A markdown table separator row: only pipes, dashes, colons and spaces. */
function isSeparatorRow(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-");
}

/**
 * Parse the stack `| Capa | Elección | Por qué |` table into rows. Ignores the header row and the
 * `|---|` separator; keeps only rows with at least a non-empty first cell.
 */
function parseStackTable(lines: string[]): ArchRow[] {
  const rows: ArchRow[] = [];
  let seenSeparator = false;
  for (const line of lines) {
    if (!line.trim().startsWith("|")) continue;
    if (isSeparatorRow(line)) {
      seenSeparator = true;
      continue;
    }
    // Rows before the separator are the header — skip until the separator is seen.
    if (!seenSeparator) continue;
    const cells = tableCells(line);
    const capa = cells[0] ?? "";
    if (capa === "") continue;
    rows.push({ capa, eleccion: cells[1] ?? "", porque: cells[2] ?? "" });
  }
  return rows;
}

/** The lead prose of a section — non-empty, non-bullet, non-table lines before the first bullet. */
function leadProse(lines: string[]): string {
  const out: string[] = [];
  for (const line of lines) {
    if (BULLET_PLAIN_RE.test(line) || line.trim().startsWith("|")) break;
    if (line.trim() !== "") out.push(line.trim());
  }
  return out.join(" ").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

/** Build the data-model section model from its raw lines (CONDITIONAL — caller passes null when absent). */
function parseDataModel(lines: string[]): ArchDataModel {
  const note = leadProse(lines);
  const text = lines.join("\n").toLowerCase();
  const isNone = /sin base de datos|sin bd|no database|content[ -]as[ -]code/.test(text);
  return { isNone, note, entities: parseItems(lines.join("\n")) };
}

/** Build the FRD cards from the "Por FRD" section's raw lines. */
function parseFrds(lines: string[]): ArchFrd[] {
  return splitH3(lines)
    .filter((s) => /FRD[\s-]?\d+/i.test(s.heading))
    .map((s): ArchFrd => {
      const parts = s.heading.split("·").map((p) => p.trim());
      const idRaw = parts[0] ?? s.heading;
      const idMatch = idRaw.match(/FRD[\s-]?(\d+)/i);
      const id = idMatch?.[1] != null ? `FRD-${idMatch[1].padStart(2, "0")}` : idRaw;
      const title = parts.slice(1).join(" · ");
      return {
        id,
        title,
        blueprint: extractLabel(s.markdown, "blueprint"),
        workOrders: parseWorkOrders(extractLabelBlock(s.markdown, "work orders", "work-orders")),
      };
    });
}

/** Return the inline text after a `**Label:**` (one-liner), stripped of markup. Empty when absent. */
function extractLabel(markdown: string, label: string): string {
  const re = new RegExp(`^\\*\\*${label}:?\\*\\*\\s*(.*)$`, "im");
  const m = markdown.match(re);
  return m?.[1] != null ? m[1].replace(/\*\*/g, "").trim() : "";
}

/** Return the lines AFTER a `**Label:**` marker, up to the next `**Label:**` or end. */
function extractLabelBlock(markdown: string, ...labels: string[]): string {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) =>
    labels.some((lab) => new RegExp(`^\\*\\*${lab}:?\\*\\*`, "i").test(l.trim())),
  );
  if (start === -1) return "";
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^\*\*[^*]+:?\*\*/.test(line.trim())) break;
    out.push(line);
  }
  return out.join("\n");
}

/** Parse work-order bullets `- **WO-NN-MMM** — desc` into {id, desc}. */
function parseWorkOrders(markdown: string): ArchWo[] {
  return parseItems(markdown).map((item): ArchWo => {
    const m = `${item.title} ${item.desc}`.match(WO_ID_RE);
    const id = m?.[1] != null && m[2] != null ? `WO-${m[1].padStart(2, "0")}-${m[2]}` : item.title;
    // When the id was in the title, the desc is the bullet's description; otherwise keep the title text.
    const desc = m != null ? item.desc : `${item.title}${item.desc ? ` — ${item.desc}` : ""}`;
    return { id, desc };
  });
}

/** Find the first section whose heading matches `needle` (case-insensitive). */
function findH2(sections: Map<string, string[]>, needle: RegExp): string[] | null {
  for (const [heading, lines] of sections) {
    if (needle.test(heading)) return lines;
  }
  return null;
}

/**
 * Parse a project's architecture digest markdown into structured ArchitectureData. Robust to a
 * missing piece (any part degrades to null/[]); `hasContent` is false only when no stack, data
 * model, services nor FRD content was found at all.
 */
export function parseArchitecture(raw: string): ArchitectureData {
  const { meta, body } = splitFrontmatter(raw);
  const sections = splitH2(body);

  const stackLines = findH2(sections, /stack|tecnolog/i);
  const dataLines = findH2(sections, /modelo de datos|data model|datos/i);
  const servicesLines = findH2(sections, /comunicaci|servicios|services|comms/i);
  const frdLines = findH2(sections, /por frd|frd/i);

  const stackRows = stackLines != null ? parseStackTable(stackLines) : [];
  const dataModel = dataLines != null ? parseDataModel(dataLines) : null;
  const services = servicesLines != null ? parseItems(servicesLines.join("\n")) : [];
  const frds = frdLines != null ? parseFrds(frdLines) : [];

  const hasContent =
    stackRows.length > 0 ||
    (dataModel != null && (dataModel.entities.length > 0 || dataModel.note !== "")) ||
    services.length > 0 ||
    frds.length > 0;

  return {
    proyecto: meta.get("proyecto") ?? null,
    fase: meta.get("fase") ?? null,
    stack: meta.get("stack") ?? null,
    coste: meta.get("coste") ?? null,
    host: meta.get("host") ?? null,
    intro: parseIntro(body),
    stackRows,
    dataModel,
    services,
    frds,
    hasContent,
  };
}
