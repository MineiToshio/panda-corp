// card/yaml.mjs: the SAFE YAML subset reader for card and work-order frontmatter (nothing is expanded or evaluated).
import { FM_RE, FORBIDDEN_KEYS, KEY_NAME_RE } from "./common.mjs";

function scanQuoted(text) {
  const quote = text[0];
  if (quote === '"') {
    for (let i = 1; i < text.length; i += 1) {
      if (text[i] === "\\") { i += 1; continue; }
      if (text[i] !== '"') continue;
      let value;
      try { value = JSON.parse(text.slice(0, i + 1)); } catch { return null; }
      return { value, rest: text.slice(i + 1) };
    }
    return null;
  }
  let value = "";
  for (let i = 1; i < text.length; i += 1) {
    if (text[i] !== "'") { value += text[i]; continue; }
    if (text[i + 1] === "'") { value += "'"; i += 1; continue; }
    return { value, rest: text.slice(i + 1) };
  }
  return null;
}

const bareScalar = (text) => {
  const plain = text.replace(/\s+#.*$/, "").trim();
  if (plain === "" || plain === "~" || plain === "null") return null;
  if (plain === "true") return true;
  if (plain === "false") return false;
  return plain;
};

/** Parse one scalar token. Returns `{value}` or `{problem}`. */
function parseScalar(text) {
  const token = text.trim();
  if (token === "" || token.startsWith("#")) return { value: null };
  if (/^[&*!]/.test(token) || token.startsWith("<<")) return { problem: `unsupported YAML construct: ${token.slice(0, 20)}` };
  if (token.startsWith("{")) return { problem: "unsupported YAML construct: flow mapping" };
  if (token[0] === '"' || token[0] === "'") {
    const quoted = scanQuoted(token);
    if (!quoted) return { problem: "unterminated or invalid quoted scalar", syntax: true };
    if (!/^\s*(#.*)?$/.test(quoted.rest)) return { problem: "unexpected text after a quoted scalar", syntax: true };
    return { value: quoted.value };
  }
  return { value: bareScalar(token) };
}

function splitFlowItems(inner) {
  const items = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (quote) {
      current += ch;
      if (quote === '"' && ch === "\\") { current += inner[i + 1] ?? ""; i += 1; } else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") { quote = ch; current += ch; } else if (ch === ",") { items.push(current); current = ""; } else current += ch;
  }
  if (quote) return null;
  if (current.trim() !== "" || items.length > 0) items.push(current);
  return items;
}

function parseFlowSeq(text) {
  const close = text.lastIndexOf("]");
  if (close < 0 || !/^\s*(#.*)?$/.test(text.slice(close + 1))) return { problem: "unterminated flow sequence", syntax: true };
  const items = splitFlowItems(text.slice(1, close));
  if (items === null) return { problem: "unterminated quoted scalar in a flow sequence", syntax: true };
  const value = [];
  for (const raw of items) {
    if (/^\s*[[{]/.test(raw)) return { problem: "unsupported YAML construct: nested flow collection" };
    const parsed = parseScalar(raw);
    if (parsed.problem) return parsed;
    if (parsed.value !== null) value.push(typeof parsed.value === "string" ? parsed.value : String(parsed.value));
  }
  return { value };
}

function foldBlock(lines, style, chomp) {
  const indent = Math.min(...lines.filter((l) => l.trim() !== "").map((l) => l.length - l.trimStart().length));
  const body = lines.map((l) => (l.trim() === "" ? "" : l.slice(Number.isFinite(indent) ? indent : 0)));
  let text = style === "|" ? body.join("\n") : body.join("\n").replace(/([^\n])\n(?=[^\n])/g, "$1 ");
  text = text.replace(/\n+$/, "");
  if (chomp === "-") return text;
  return chomp === "+" ? `${text}\n` : text === "" ? "" : `${text}\n`;
}

/**
 * Parse the frontmatter text of a card, work order or similar flat document. Never expands or evaluates anything.
 * @param {string} text the text between the two `---` fences
 * @returns {{data: Record<string, unknown>, keys: string[], errors: string[], unsupported: string[]}}
 *   `errors` = malformed lines; `unsupported` = constructs the subset refuses (a lenient caller may ignore them).
 */
export function parseYamlSubset(text) {
  const data = {};
  const keys = [];
  const errors = [];
  const unsupported = [];
  const lines = String(text ?? "").split(/\r?\n/);
  const isListItem = (l) => /^[ \t]*-([ \t]+|$)/.test(l);
  const note = (bucket, n, why) => bucket.push(`line ${n + 1}: ${why}`);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "" || /^\s*#/.test(line)) continue;
    const m = /^([^\s:#][^:]*?)[ \t]*:(?:[ \t]+(.*)|[ \t]*)$/.exec(line);
    if (!m || /^[ \t]/.test(line)) { note(/^[ \t]|^-/.test(line) ? unsupported : errors, i, `cannot read frontmatter line: ${line.trim().slice(0, 40)}`); continue; }
    const key = m[1];
    if (!KEY_NAME_RE.test(key) || FORBIDDEN_KEYS.has(key)) { note(errors, i, `invalid key: ${key.slice(0, 40)}`); continue; }
    if (Object.hasOwn(data, key)) { note(errors, i, `duplicate key: ${key}`); continue; }
    const rest = (m[2] ?? "").trim();
    let value = null;
    const block = /^([|>])([+-]?)\d?([+-]?)[ \t]*(#.*)?$/.exec(rest);
    if (block) {
      const collected = [];
      while (i + 1 < lines.length && (lines[i + 1].trim() === "" || /^[ \t]/.test(lines[i + 1]))) { i += 1; collected.push(lines[i]); }
      value = foldBlock(collected, block[1], block[2] || block[3]);
    } else if (rest === "" || rest.startsWith("#")) {
      const items = [];
      let j = i + 1;
      while (j < lines.length && (lines[j].trim() === "" || /^\s*#/.test(lines[j]))) j += 1;
      if (j < lines.length && isListItem(lines[j])) {
        for (; j < lines.length && (isListItem(lines[j]) || lines[j].trim() === "" || /^\s*#/.test(lines[j])); j += 1) {
          if (!isListItem(lines[j])) continue;
          const item = parseScalar(lines[j].replace(/^[ \t]*-[ \t]*/, ""));
          if (item.problem) note(item.syntax ? errors : unsupported, j, item.problem);
          else if (item.value !== null) items.push(typeof item.value === "string" ? item.value : String(item.value));
        }
        i = j - 1;
        value = items;
      } else if (j < lines.length && /^[ \t]+\S/.test(lines[j])) {
        note(unsupported, j, `nested mapping or multi-line scalar under ${key}`);
        while (j < lines.length && (lines[j].trim() === "" || /^[ \t]/.test(lines[j]))) j += 1;
        i = j - 1;
        value = "";
      }
    } else if (rest.startsWith("[")) {
      const parsed = parseFlowSeq(rest);
      if (parsed.problem) note(parsed.syntax ? errors : unsupported, i, `${key}: ${parsed.problem}`);
      value = parsed.value ?? [];
    } else {
      const parsed = parseScalar(rest);
      if (parsed.problem) { note(parsed.syntax ? errors : unsupported, i, `${key}: ${parsed.problem}`); value = rest; } else value = parsed.value;
    }
    data[key] = value;
    keys.push(key);
  }
  return { data, keys, errors, unsupported };
}

/**
 * Split a Markdown document into its frontmatter text and body.
 * @param {string} raw whole file
 * @returns {{fm: string, body: string, nl: string} | null} null when there is no frontmatter fence
 */
export function splitFrontmatter(raw) {
  const m = FM_RE.exec(String(raw ?? ""));
  if (!m) return null;
  return { fm: m[1] ?? "", body: raw.slice(m[0].length), nl: raw.includes("\r\n") ? "\r\n" : "\n" };
}

export const asList = (value) => {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value === "string" && value.trim() !== "") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
};
export const asText = (value) => (typeof value === "string" ? value.trim() : typeof value === "number" || typeof value === "boolean" ? String(value) : "");

/** Normalize a frontmatter list field (flow list, block list or comma scalar) to a string array. */
export const frontmatterList = asList;
