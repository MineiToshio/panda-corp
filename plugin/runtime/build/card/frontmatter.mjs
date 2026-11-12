// card/frontmatter.mjs: single-line frontmatter edits; the body and every untouched line stay byte-identical.
import {
  fail, FORBIDDEN_KEYS, FRD_RE, KEY_NAME_RE, PLAIN_ENUM_KEYS, SHA_RE, V1_ONLY_KEYS,
} from "./common.mjs";
import { splitFrontmatter } from "./yaml.mjs";

export function serializeValue(key, value) {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return JSON.stringify(value.map(String));
  const text = String(value);
  if (key.endsWith("_sha") && SHA_RE.test(text) && !/^\d+(e\d+)?$/.test(text)) return text;
  if (PLAIN_ENUM_KEYS.has(key) && /^[a-z][a-z0-9-]*$/.test(text)) return text;
  if ((key === "date" && /^\d{4}-\d{2}-\d{2}$/.test(text)) || (key === "frd" && FRD_RE.test(text))) return text;
  return JSON.stringify(text.replace(/\s+/g, " ").trim());
}

function keyExtent(lines, index) {
  const inline = lines[index].slice(lines[index].indexOf(":") + 1).replace(/\s+#.*$/, "").trim();
  const block = /^[|>]/.test(inline);
  let end = index + 1;
  while (end < lines.length) {
    const l = lines[end];
    if (/^[ \t]+\S/.test(l) || (inline === "" && /^-(\s|$)/.test(l)) || (block && l.trim() === "")) end += 1;
    else break;
  }
  while (block && end > index + 1 && lines[end - 1].trim() === "") end -= 1;
  return end;
}

/**
 * Set and remove frontmatter keys by editing single lines; the body and every other line stay byte-identical.
 * @param {string} raw whole card text
 * @param {{set?: Record<string, unknown>, remove?: string[]}} edits
 * @returns {string} the edited text
 */
export function updateFrontmatter(raw, { set = {}, remove = [] } = {}) {
  const parts = splitFrontmatter(raw);
  if (!parts) throw fail("INVALID_INPUT", "card has no frontmatter");
  const lines = parts.fm === "" ? [] : parts.fm.split(/\r?\n/);
  const find = (key) => lines.findIndex((l) => new RegExp(`^${key}[ \\t]*:`).test(l));
  for (const key of remove) {
    if (!KEY_NAME_RE.test(key)) throw fail("INVALID_INPUT", `invalid frontmatter key: ${key}`);
    const at = find(key);
    if (at >= 0) lines.splice(at, keyExtent(lines, at) - at);
  }
  for (const [key, value] of Object.entries(set)) {
    if (!KEY_NAME_RE.test(key) || FORBIDDEN_KEYS.has(key)) throw fail("INVALID_INPUT", `invalid frontmatter key: ${key}`);
    if (V1_ONLY_KEYS.includes(key)) throw fail("INVALID_INPUT", `v2 never writes ${key}`);
    const line = `${key}: ${serializeValue(key, value)}`;
    const at = find(key);
    if (at >= 0) lines.splice(at, keyExtent(lines, at) - at, line);
    else lines.push(line);
  }
  const closing = /\r?\n$/.test(raw.slice(0, raw.length - parts.body.length)) ? parts.nl : "";
  const head = raw.startsWith("﻿") ? "﻿" : "";
  return `${head}---${parts.nl}${lines.join(parts.nl)}${lines.length ? parts.nl : ""}---${closing}${parts.body}`;
}
