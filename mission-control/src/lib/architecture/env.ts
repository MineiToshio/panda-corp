import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface EnvVar {
  readonly name: string;
  readonly comment: string;
  /** Source section, absent only for legacy callers. */
  readonly section?: string;
  readonly described?: boolean;
}

/** Parse the public inventory without retaining any example value. Invalid source fails loudly. */
export function parseEnvExample(raw: string): EnvVar[] {
  const vars: EnvVar[] = [];
  let section = "";
  let comments: string[] = [];
  const lines = raw.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const text = line.trim();
    if (!text) {
      comments = [];
      continue;
    }
    const assignment = text.match(/^(?:#\s*)?([A-Z][A-Z0-9_]*)\s*=/);
    if (assignment?.[1]) {
      vars.push({
        name: assignment[1],
        comment: comments.join(" "),
        section,
        described: comments.length > 0,
      });
      comments = [];
      continue;
    }
    if (text.startsWith("#")) {
      const comment = text.replace(/^#+\s*/, "");
      if (/^[-=]{2,}$/.test(comment)) {
        comments = [];
        continue;
      }
      if (isSectionHeader(text, lines[index + 1], comments.length)) {
        section = comment.replace(/^[-=]+\s*|\s*[-=]+$/g, "").trim();
        comments = [];
      } else comments.push(comment);
      continue;
    }
    if (/^[a-z][a-z\d_]*\s*=/.test(text)) {
      comments = [];
      continue;
    }
    throw new Error(`.env.example:${index + 1}: invalid variable declaration`);
  }
  return vars;
}

function isSectionHeader(
  text: string,
  nextLine: string | undefined,
  commentCount: number,
): boolean {
  const next = nextLine?.trim() ?? "";
  return (
    /^#\s*[-=]{2,}\s*$/.test(next) ||
    /^[-=]{2,}|^##/.test(text.replace(/^#\s*/, "")) ||
    /^##/.test(text) ||
    (!next && commentCount === 0)
  );
}

/** Missing inventory is deliberate absence; unreadable/malformed sources throw for the bundle to report. */
export function readEnvExample(projectPath: string): EnvVar[] {
  const file = join(projectPath, ".env.example");
  return existsSync(file) ? parseEnvExample(readFileSync(file, "utf-8")) : [];
}
