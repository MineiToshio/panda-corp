/** One acceptance card, with its optional source identifier separated from prose. */
export interface Criterion {
  readonly id?: string;
  readonly text: string;
}
/** The source document's reading sections. Missing headings remain absent. */
export interface WorkOrderSections {
  readonly about?: string;
  readonly scope?: string;
  readonly outOfScope?: string;
  readonly criteria: readonly Criterion[];
  readonly built?: string;
}
/** Split bullet criteria, preserving continuation paragraphs and EARS prose. */
function criteria(text: string): Criterion[] {
  const bullets: string[] = [];
  let lines: string[] = [];
  let indent = 0;
  let afterBlank = false;
  for (const line of text.split(/\r?\n/)) {
    const bullet = /^(\s*)(?:[-*+]|\d+[.)])\s+(.+)$/.exec(line);
    const bulletIndent = bullet?.[1]?.length ?? 0;
    const item = bullet?.[2];
    if (item !== undefined && (!lines.length || bulletIndent <= indent)) {
      if (lines.length) bullets.push(lines.join("\n").trim());
      lines = [item];
      indent = bulletIndent;
    } else if (lines.length) {
      if (endsCriterion(line, afterBlank, indent)) break;
      lines.push(line);
    }
    afterBlank = !line.trim();
  }
  if (lines.length) bullets.push(lines.join("\n").trim());
  return bullets.map(parseCriterion);
}

function endsCriterion(line: string, afterBlank: boolean, indent: number): boolean {
  const depth = line.match(/^\s*/)?.[0].length ?? 0;
  return /^\s*#{1,6}\s/.test(line) || Boolean(afterBlank && line.trim() && depth <= indent);
}

function parseCriterion(clean: string): Criterion {
  const match =
    /^(?:\*\*((?:AC|REQ)-\d+-\d+(?:\.\d+)?)([^\n]*?)\*\*|((?:AC|REQ)-\d+-\d+(?:\.\d+)?))\s*[—–:-]?\s*/.exec(
      clean,
    );
  if (!match) return { text: clean };
  return {
    id: match[1] ?? match[3],
    text: `${match[2]?.trim() ?? ""} ${clean.slice(match[0].length)}`.trim(),
  };
}

/** Match the supported heading families without inventing absent document content. */
export function extractSections(markdown: string, fallback?: string): WorkOrderSections {
  const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const sections = [...body.matchAll(/^##\s+(.+)\r?\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/gm)];
  const find = (pattern: RegExp) =>
    sections.find((m) => pattern.test(m[1] ?? ""))?.[2]?.trim() || undefined;
  return {
    about: find(/^(Summary|Goal|Objective|Problem|Context)$/i) ?? fallback,
    scope: find(/^(In Scope|Scope)$/i),
    outOfScope: find(/^Out of Scope$/i),
    criteria: criteria(
      find(/^(Acceptance.*|Requirements.*Acceptance.*)$/i) ?? find(/^Definition of done$/i) ?? "",
    ),
    built: find(/^Status Note$/i),
  };
}
