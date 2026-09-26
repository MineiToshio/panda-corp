#!/usr/bin/env node
// Derives the DEPLOYABLE build engine from its readable SOURCE (BL-0204).
//
//   source   plugin/runtime/engine/pandacorp-build.src.js   (edit this one)
//   artifact plugin/templates/shared/.claude/engines/pandacorp-build.js   (generated, never hand-edited)
//
// Why: Claude Code's Workflow tool refuses a script file over 524288 bytes, and the engine's source
// is ~36% comments. The artifact is the SAME program with every comment dropped and every run of
// inter-token whitespace collapsed — nothing else. Every token (identifiers, punctuators, numbers,
// string / template / regex literals) is copied byte-for-byte from the source, so the content of a
// template literal or string can never be rewritten. A gap that held a line terminator (in
// whitespace or inside a comment) stays a newline, so automatic semicolon insertion sees the same
// line structure; any other non-empty gap becomes one space. Leading indentation is kept (it is the
// only thing that keeps the artifact reviewable) but trimmed to one space per two source columns.
//
// Zero dependencies on purpose (the plugin ships no node_modules): a purpose-built JS tokenizer.
// Its correctness is proven INDEPENDENTLY by test-engine-artifact.mjs, which parses source and
// artifact with a real parser (acorn) and requires identical ASTs, and runs the full engine
// scenario suite against the artifact.
//
// Usage:
//   node plugin/scripts/generate-engine.mjs           # (re)write the artifact
//   node plugin/scripts/generate-engine.mjs --check   # exit 2 if the committed artifact is stale
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Repo-relative path of the readable engine source. */
export const ENGINE_SOURCE = "plugin/runtime/engine/pandacorp-build.src.js";
/** Repo-relative path of the generated, deployable engine artifact. */
export const ENGINE_ARTIFACT = "plugin/templates/shared/.claude/engines/pandacorp-build.js";
/** The Workflow tool's hard per-script limit, in bytes. */
export const WORKFLOW_SCRIPT_LIMIT = 524288;

const BANNER = `// GENERATED from ${ENGINE_SOURCE} by plugin/scripts/generate-engine.mjs — do not edit (BL-0204)`;

const LINE_TERMINATOR = /[\n\r\u2028\u2029]/;
const WHITESPACE = /[\t\v\f \u00a0\ufeff\n\r\u2028\u2029\u1680\u2000-\u200a\u202f\u205f\u3000]/;
const ID_START = /[A-Za-z_$\u0080-\uffff\\#]/;
const ID_PART = /[A-Za-z0-9_$\u0080-\uffff\\]/;
// Longest first, so `>>>=` wins over `>>>` over `>>` over `>`.
const PUNCTUATORS = [
  ">>>=", "...", "===", "!==", "**=", "<<=", ">>=", ">>>", "&&=", "||=", "??=",
  "=>", "==", "!=", "<=", ">=", "&&", "||", "??", "?.", "++", "--", "+=", "-=", "*=", "/=", "%=",
  "&=", "|=", "^=", "**", "<<", ">>",
  "{", "}", "(", ")", "[", "]", ";", ",", "<", ">", "+", "-", "*", "/", "%", "&", "|", "^",
  "!", "~", "?", ":", "=", ".", "@",
];
// After one of these keywords a `/` starts a regular expression, not a division.
const REGEX_AFTER_KEYWORD = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else",
  "yield", "await", "extends",
]);

function fail(message, source, index) {
  const line = source.slice(0, index).split("\n").length;
  throw new Error(`generate-engine: ${message} at source line ${line}`);
}

/**
 * Splits JavaScript source into significant tokens (comments and whitespace are gaps between them).
 * @param {string} source - an ES2022 module / Workflow script body.
 * @returns {{type: string, start: number, end: number}[]} tokens with source offsets (end exclusive).
 */
export function tokenize(source) {
  const tokens = [];
  const braces = []; // 'brace' | 'template' — what a `}` closes
  let i = 0;
  const push = (type, start, end) => tokens.push({ type, start, end });
  const regexAllowed = () => {
    const prev = tokens[tokens.length - 1];
    if (!prev) return true;
    if (prev.type === "punct") return !/^[)\]}]$/.test(source.slice(prev.start, prev.end));
    if (prev.type === "name") return REGEX_AFTER_KEYWORD.has(source.slice(prev.start, prev.end));
    return false;
  };
  // Scans a template chunk that opens at `start` (a backquote or a template-closing `}`).
  const templateChunk = (start) => {
    let j = start + 1;
    while (j < source.length) {
      const c = source[j];
      if (c === "\\") { j += 2; continue; }
      if (c === "`") { push("template", start, j + 1); return j + 1; }
      if (c === "$" && source[j + 1] === "{") { push("template", start, j + 2); braces.push("template"); return j + 2; }
      j++;
    }
    return fail("unterminated template literal", source, start);
  };
  while (i < source.length) {
    const c = source[i];
    if (WHITESPACE.test(c)) { i++; continue; }
    if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && !LINE_TERMINATOR.test(source[i])) i++;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end < 0) fail("unterminated block comment", source, i);
      i = end + 2;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== c) {
        if (source[j] === "\\") j++;
        else if (source[j] === "\n") fail("newline inside a string literal", source, i);
        j++;
      }
      if (j >= source.length) fail("unterminated string literal", source, i);
      push("string", i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === "`") { i = templateChunk(i); continue; }
    if (c === "}" && braces[braces.length - 1] === "template") { braces.pop(); i = templateChunk(i); continue; }
    if (c === "/" && regexAllowed()) {
      let j = i + 1;
      let inClass = false;
      while (j < source.length) {
        const d = source[j];
        if (d === "\\") { j += 2; continue; }
        if (LINE_TERMINATOR.test(d)) fail("newline inside a regular expression", source, i);
        if (d === "[") inClass = true;
        else if (d === "]") inClass = false;
        else if (d === "/" && !inClass) break;
        j++;
      }
      j++;
      while (j < source.length && /[a-z]/.test(source[j])) j++;
      push("regex", i, j);
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(source[i + 1] || ""))) {
      let j = i;
      if (c === "0" && /[xXoObB]/.test(source[i + 1] || "")) {
        j += 2;
        while (/[0-9a-fA-F_]/.test(source[j] || "")) j++;
      } else {
        while (/[0-9_]/.test(source[j] || "")) j++;
        if (source[j] === ".") { j++; while (/[0-9_]/.test(source[j] || "")) j++; }
        if (/[eE]/.test(source[j] || "")) {
          j++;
          if (/[+-]/.test(source[j] || "")) j++;
          while (/[0-9_]/.test(source[j] || "")) j++;
        }
      }
      if (source[j] === "n") j++;
      if (ID_PART.test(source[j] || "")) fail("identifier directly after a numeric literal", source, i);
      push("number", i, j);
      i = j;
      continue;
    }
    if (ID_START.test(c)) {
      let j = i + 1;
      while (j < source.length && ID_PART.test(source[j])) j++;
      push("name", i, j);
      i = j;
      continue;
    }
    const punct = PUNCTUATORS.find((p) => source.startsWith(p, i) && !(p === "?." && /[0-9]/.test(source[i + 2] || "")));
    if (!punct) fail(`unexpected character ${JSON.stringify(c)}`, source, i);
    if (punct === "{") braces.push("brace");
    if (punct === "}") braces.pop();
    push("punct", i, i + punct.length);
    i += punct.length;
  }
  if (braces.length) fail("unbalanced braces at end of input", source, source.length);
  return tokens;
}

/** Leading whitespace of the source line containing `index`, halved (tabs count as 2 columns). */
function indentOf(source, index) {
  let lineStart = index;
  while (lineStart > 0 && !LINE_TERMINATOR.test(source[lineStart - 1])) lineStart--;
  const lead = source.slice(lineStart, index);
  if (!/^[ \t]*$/.test(lead)) return "";
  const columns = lead.replace(/\t/g, "  ").length;
  return " ".repeat(Math.floor(columns / 2));
}

/**
 * Builds the deployable artifact from the engine source: comments dropped, inter-token gaps
 * collapsed, every token copied verbatim. The banner goes right AFTER the leading
 * `export const meta = {...}` statement, because a Workflow script must BEGIN with it.
 * @param {string} source - the readable engine source.
 * @returns {string} the artifact text (ends with a single newline).
 */
export function compactEngine(source) {
  const tokens = tokenize(source);
  const text = (t) => source.slice(t.start, t.end);
  if (!(tokens.length > 4 && text(tokens[0]) === "export" && text(tokens[1]) === "const" && text(tokens[2]) === "meta")) {
    throw new Error("generate-engine: the source must begin with `export const meta = {...}` (Workflow contract)");
  }
  // End of the meta statement: the `}` that closes its object literal (plus an optional `;`).
  let depth = 0;
  let metaEnd = -1;
  for (let k = 4; k < tokens.length; k++) {
    const t = text(tokens[k]);
    if (t === "{" || t === "(" || t === "[") depth++;
    else if (t === "}" || t === ")" || t === "]") depth--;
    if (depth === 0) { metaEnd = text(tokens[k + 1]) === ";" ? k + 1 : k; break; }
  }
  if (metaEnd < 0) throw new Error("generate-engine: could not find the end of the meta literal");
  let out = "";
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (k > 0) {
      const gap = source.slice(tokens[k - 1].end, t.start);
      if (k === metaEnd + 1) out += `\n${BANNER}\n${indentOf(source, t.start)}`;
      else if (LINE_TERMINATOR.test(gap)) out += `\n${indentOf(source, t.start)}`;
      else if (gap.length) out += " ";
    }
    out += text(t);
  }
  return `${out}\n`;
}

function main() {
  const check = process.argv.includes("--check");
  const source = readFileSync(path.join(root, ENGINE_SOURCE), "utf8");
  const artifact = compactEngine(source);
  const bytes = Buffer.byteLength(artifact);
  if (bytes > WORKFLOW_SCRIPT_LIMIT) {
    console.error(`generate-engine: artifact is ${bytes} bytes, over the Workflow limit of ${WORKFLOW_SCRIPT_LIMIT}`);
    process.exit(1);
  }
  const target = path.join(root, ENGINE_ARTIFACT);
  if (check) {
    let current = "";
    try { current = readFileSync(target, "utf8"); } catch { current = ""; }
    if (current !== artifact) {
      console.error(`generate-engine: ${ENGINE_ARTIFACT} is stale vs ${ENGINE_SOURCE}; run node plugin/scripts/generate-engine.mjs`);
      process.exit(2);
    }
    console.log(`generate-engine: artifact up to date (${bytes} bytes)`);
    return;
  }
  writeFileSync(target, artifact);
  console.log(`generate-engine: wrote ${ENGINE_ARTIFACT} (${bytes} bytes from ${Buffer.byteLength(source)} source bytes)`);
}

// Compare REAL paths: on macOS a temp dir under /var is a symlink to /private/var, and a plain URL
// comparison would silently skip main() (exit 0 = a fail-OPEN drift check).
const invokedDirectly = process.argv[1] && realpathSync(path.resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
