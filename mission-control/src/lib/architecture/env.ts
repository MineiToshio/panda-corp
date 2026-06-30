/**
 * env.ts — server-only reader for a project's `.env.example` (the env-var inventory the
 * architecture phase generates, DR-102). Feeds the "Variables de entorno" block of the
 * Arquitectura tab — read LIVE from the real file so it never drifts from the digest.
 *
 * Format (loose by design — a `.env.example` is forgiving): a leading `# comment` describes the
 * next `KEY=value` line. We keep the var NAME and the immediately-preceding comment (purpose);
 * the value is intentionally ignored (examples often ship blank or placeholder values).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface EnvVar {
  /** The variable name (left of `=`). */
  name: string;
  /** One-line purpose from the preceding `#` comment(s); empty when none. */
  comment: string;
}

/** A valid env var assignment line: `NAME=...` (uppercase name, the .env convention). */
const ENV_LINE_RE = /^([A-Z][A-Z0-9_]*)\s*=/;

/**
 * Read `<project>/.env.example` into a list of `{name, comment}`. Absent file → [] (a project may
 * legitimately have no env vars). Unreadable → [] (degrade rather than crash the board).
 *
 * Read-only: only `existsSync` + `readFileSync` — no writes, never reads `.env` (real secrets).
 */
export function readEnvExample(projectPath: string): EnvVar[] {
  const path = join(projectPath, ".env.example");
  if (!existsSync(path)) return [];
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    return [];
  }

  const vars: EnvVar[] = [];
  let pendingComment: string[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      // A blank line ends a comment block (so a comment only describes the var right below it).
      pendingComment = [];
      continue;
    }
    if (trimmed.startsWith("#")) {
      pendingComment.push(trimmed.replace(/^#+\s?/, "").trim());
      continue;
    }
    const m = trimmed.match(ENV_LINE_RE);
    if (m?.[1] != null) {
      vars.push({ name: m[1], comment: pendingComment.join(" ").trim() });
    }
    pendingComment = [];
  }
  return vars;
}
