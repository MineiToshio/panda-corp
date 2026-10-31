import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { isScalar, parseDocument } from "yaml";
import { resolveFactoryRoot } from "../config/config";

/** Outcome of a bounded discard write, with an explicit refusal reason on failure. */
export type DiscardBacklogResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "parse-error" | "not-discardable" };

const MAX_REASON_LENGTH = 500;

/** Locate only a regular markdown file; never follow a symlink on a bounded write. */
function findBacklogFile(dir: string, id: string): string | null {
  if (!/^BL-\d+$/.test(id)) return null;
  try {
    const candidates = fs
      .readdirSync(dir)
      .filter(
        (file) =>
          (file === `${id}.md` || (file.startsWith(`${id}-`) && file.endsWith(".md"))) &&
          fs.lstatSync(path.join(dir, file)).isFile(),
      );
    for (const candidate of candidates) {
      const file = path.join(dir, candidate);
      try {
        if (matter(fs.readFileSync(file, "utf-8"), { excerpt: false }).data.id === id) {
          return file;
        }
      } catch {
        // A malformed candidate must not hide a later file declaring this id.
      }
    }
    return candidates[0] === undefined ? null : path.join(dir, candidates[0]);
  } catch {
    return null;
  }
}

/** An empty YAML value range starts immediately after the colon and needs a separator. */
function scalarReplacement(range: readonly number[], serialized: string): string {
  return range[0] === range[1] ? ` ${serialized}` : serialized;
}

/** Replace scalar ranges only: comments, quoting, nested fields and the body stay byte-identical. */
function rewriteDiscard(raw: string, priorStatus: string, reason?: string): string | null {
  const frontmatter = /^(---\r?\n)([\s\S]*?)(\r?\n)---(?=\r?\n|$)/.exec(raw);
  if (!frontmatter) return null;
  const [, prefix, yaml, newline] = frontmatter;
  if (prefix === undefined || yaml === undefined || newline === undefined) return null;
  const document = parseDocument(yaml);
  if (document.errors.length > 0) return null;
  const fields: Record<string, string> = {
    status: "discarded",
    status_before_discard: priorStatus,
  };
  const trimmed = reason?.trim();
  if (trimmed) fields.discard_reason = [...trimmed].slice(0, MAX_REASON_LENGTH).join("");
  const edits: { start: number; end: number; value: string }[] = [];
  const additions: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    const node = document.get(key, true);
    const serialized = JSON.stringify(value);
    if (node === undefined) additions.push(`${key}: ${serialized}`);
    else {
      if (!isScalar(node) || !node.range) return null;
      edits.push({
        start: node.range[0],
        end: node.range[1],
        value: scalarReplacement(node.range, serialized),
      });
    }
  }
  let updated = yaml;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    updated = updated.slice(0, edit.start) + edit.value + updated.slice(edit.end);
  }
  if (additions.length) updated += newline + additions.join(newline);
  return prefix + updated + raw.slice(prefix.length + yaml.length);
}

/** Discard one open/doing item, optionally recording a trimmed, 500-code-point reason. */
export function discardBacklogItem(id: string, reason?: string): DiscardBacklogResult {
  const dir = path.join(resolveFactoryRoot(), "factory", "backlog");
  const filePath = findBacklogFile(dir, id);
  if (filePath === null) return { ok: false, reason: "not-found" };
  let raw: string;
  try {
    const bytes = fs.readFileSync(filePath);
    raw = bytes.toString("utf-8");
    if (!Buffer.from(raw, "utf-8").equals(bytes)) return { ok: false, reason: "parse-error" };
  } catch {
    return { ok: false, reason: "not-found" };
  }
  try {
    const parsed = matter(raw, { excerpt: false });
    if (parsed.data.id !== id) return { ok: false, reason: "parse-error" };
    const priorStatus: unknown = parsed.data.status;
    if (priorStatus !== "open" && priorStatus !== "doing") {
      return { ok: false, reason: "not-discardable" };
    }
    const updated = rewriteDiscard(raw, priorStatus, reason);
    if (updated === null) return { ok: false, reason: "parse-error" };
    // Validate through the same parser as readers before committing any bytes.
    const check = matter(updated, { excerpt: false }).data;
    if (
      check.id !== id ||
      check.status !== "discarded" ||
      check.status_before_discard !== priorStatus
    ) {
      return { ok: false, reason: "parse-error" };
    }
    fs.writeFileSync(filePath, updated, "utf-8");
    return { ok: true };
  } catch {
    return { ok: false, reason: "parse-error" };
  }
}
