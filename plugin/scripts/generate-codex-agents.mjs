#!/usr/bin/env node
// Generates Codex subagent TOML defs from Pandacorp's canonical agent
// definitions (plugin/agents/*.md), per docs/proposals/25-multi-runtime-portability.md
// §D4/§D5. Zero dependencies, Node >= 18.
//
// Usage: node plugin/scripts/generate-codex-agents.mjs
//
// Reads every plugin/agents/*.md, parses its YAML frontmatter (by hand —
// the subset of YAML this repo's frontmatter actually uses) and its
// markdown body, and emits one .codex/agents/<name>.toml per agent, plus
// three generic tier workers (tier-mech, tier-standard, tier-judge) that
// are NOT sourced from any .md file.
//
// plugin/agents/ stays canonical. Regenerate this whenever an agent
// changes (part of the plugin-maintenance ritual, D4).

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const AGENTS_SRC_DIR = path.join(REPO_ROOT, "plugin", "agents");
const OUT_DIR = path.join(REPO_ROOT, ".codex", "agents");

// ---------------------------------------------------------------------------
// Minimal frontmatter parsing (no YAML dependency).
//
// This repo's agent frontmatter is a small, known subset of YAML:
//   key: value
//   key: "quoted value with 'inner quotes' or escaped \" chars"
// Values are single-line. We only need: name, description, tools,
// disallowedTools, model, effort.
// ---------------------------------------------------------------------------

/** Strip a single layer of matching quotes and unescape \" and \\ inside. */
function unquoteYamlScalar(raw) {
  const value = raw.trim();
  if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
    const inner = value.slice(1, -1);
    return inner.replace(/\\(["\\])/g, "$1");
  }
  if (value.length >= 2 && value[0] === "'" && value[value.length - 1] === "'") {
    const inner = value.slice(1, -1);
    return inner.replace(/''/g, "'");
  }
  return value;
}

/**
 * Splits a markdown file into { frontmatter: Map<string,string>, body: string }.
 * Frontmatter is delimited by a `---` line at the very start and a closing
 * `---` line. Body is everything after the closing delimiter, with a single
 * leading blank line trimmed (matching how these files are authored).
 */
function parseAgentFile(raw) {
  const lines = raw.split("\n");
  if (lines[0].trim() !== "---") {
    throw new Error("expected frontmatter starting with '---'");
  }
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) {
    throw new Error("frontmatter never closes with '---'");
  }

  const frontmatterLines = lines.slice(1, closeIdx);
  const frontmatter = new Map();
  for (const line of frontmatterLines) {
    if (!line.trim()) continue;
    const m = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (!m) continue; // skip anything we don't recognize (e.g. continuation lines)
    const [, key, rawValue] = m;
    frontmatter.set(key, unquoteYamlScalar(rawValue));
  }

  // Body: everything after the closing '---', minus one leading blank line.
  let bodyLines = lines.slice(closeIdx + 1);
  if (bodyLines[0] !== undefined && bodyLines[0].trim() === "") {
    bodyLines = bodyLines.slice(1);
  }
  // Trim trailing blank lines for a clean, deterministic body.
  while (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === "") {
    bodyLines.pop();
  }
  const body = bodyLines.join("\n");

  return { frontmatter, body };
}

// ---------------------------------------------------------------------------
// Model tier mapping (D5 — factory/standards/agent-portability.md).
// ---------------------------------------------------------------------------

const MODEL_TIER_MAP = {
  haiku: { model: "gpt-5.4-mini", effort: "low" },
  sonnet: { model: "gpt-5.5", effort: "medium" },
  opus: { model: "gpt-5.5", effort: "high" },
};

/**
 * Maps a Claude model tier + the frontmatter's own `effort:` to the Codex
 * { model, effort } pair, per the task spec:
 *   haiku  -> gpt-5.4-mini / low
 *   sonnet -> gpt-5.5 / medium
 *   opus   -> gpt-5.5 / high
 *   missing model -> sonnet mapping
 * If the source frontmatter explicitly says `effort: xhigh`, that overrides
 * the tier's default effort (kept as "xhigh").
 */
function mapModelTier(claudeModel, explicitEffort) {
  const key = (claudeModel || "sonnet").trim().toLowerCase();
  const mapped = MODEL_TIER_MAP[key] || MODEL_TIER_MAP.sonnet;
  let effort = mapped.effort;
  if (explicitEffort && explicitEffort.trim().toLowerCase() === "xhigh") {
    effort = "xhigh";
  }
  return { model: mapped.model, effort };
}

// ---------------------------------------------------------------------------
// TOML helpers (hand-rolled — zero deps).
// ---------------------------------------------------------------------------

/** Escapes a value for a TOML basic string ("..."). */
function tomlBasicString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Wraps `text` as a TOML multi-line literal string (''' ... '''), escaping
 * any literal triple-quote sequence that would otherwise terminate the
 * string early. TOML multi-line literal strings do not process backslash
 * escapes, which is exactly what we want for markdown body content (no
 * accidental `\n`/`\t` interpretation) — the only character sequence that
 * needs neutralizing is `'''` itself.
 *
 * Per the TOML spec, a multi-line literal string may contain 1 or 2
 * consecutive single quotes verbatim; only a run of 3+ is a problem. We
 * break up any run of 3+ single quotes by inserting a zero-width-safe
 * separator (a space) so it never reads back as the closing delimiter.
 */
function tomlMultilineLiteral(text) {
  const escaped = text.replace(/'''+/g, (run) => run.split("").join("​"));
  return `'''\n${escaped}\n'''`;
}

/** snake_case-ish sanitizer for TOML bare keys (defensive; our keys are static). */
function tomlKey(key) {
  return key;
}

// ---------------------------------------------------------------------------
// Per-agent TOML assembly.
// ---------------------------------------------------------------------------

const NO_SANDBOX_TOOLS = new Set(["Write", "Edit", "Bash"]);

/**
 * True when the agent's `tools:` frontmatter contains NONE of Write/Edit/Bash
 * — i.e. it cannot mutate the filesystem or shell out, so `sandbox_mode =
 * "read-only"` is safe to declare. Agents with any of those tools get no
 * sandbox_mode line (inherit the runtime default).
 */
function isReadOnlyAgent(toolsCsv) {
  if (!toolsCsv) return false;
  const tools = toolsCsv.split(",").map((t) => t.trim()).filter(Boolean);
  return tools.every((t) => !NO_SANDBOX_TOOLS.has(t));
}

/** Builds the "Tool discipline" paragraph appended to developer_instructions. */
function toolDisciplineParagraph(frontmatter) {
  const parts = [];
  if (frontmatter.get("tools")) {
    parts.push(frontmatter.get("tools"));
  }
  if (frontmatter.get("disallowedTools")) {
    parts.push(`disallowed: ${frontmatter.get("disallowedTools")}`);
  }
  if (parts.length === 0) return null;
  const list = parts.join("; ");
  return (
    `Tool discipline: this agent's canonical definition restricts it to: ${list}. ` +
    `Honor those boundaries even though this runtime does not enforce them.`
  );
}

/** Builds the full developer_instructions text for a source-derived agent. */
function buildDeveloperInstructions(sourceRelPath, body, frontmatter) {
  const header = `# Generated from ${sourceRelPath} — do not edit; regenerate with plugin/scripts/generate-codex-agents.mjs`;
  const sections = [header, "", body];
  const discipline = toolDisciplineParagraph(frontmatter);
  if (discipline) {
    sections.push("", discipline);
  }
  return sections.join("\n");
}

/** Renders one agent's TOML file content. */
function renderAgentToml({ name, description, model, effort, sandboxReadOnly, developerInstructions }) {
  const lines = [];
  lines.push(`${tomlKey("name")} = ${tomlBasicString(name)}`);
  lines.push(`${tomlKey("description")} = ${tomlBasicString(description)}`);
  lines.push(`${tomlKey("model")} = ${tomlBasicString(model)}`);
  lines.push(`${tomlKey("model_reasoning_effort")} = ${tomlBasicString(effort)}`);
  if (sandboxReadOnly) {
    lines.push(`${tomlKey("sandbox_mode")} = ${tomlBasicString("read-only")}`);
  }
  lines.push(`${tomlKey("developer_instructions")} = ${tomlMultilineLiteral(developerInstructions)}`);
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Generic tier workers (not sourced from any .md file — D4).
// ---------------------------------------------------------------------------

const TIER_WORKERS = [
  {
    fileSlug: "tier-mech",
    name: "tier-mech",
    description:
      "Mechanical zero-judgment executor (commits, renames, single-line tweaks) — Pandacorp MECH tier",
    model: "gpt-5.4-mini",
    effort: "low",
  },
  {
    fileSlug: "tier-standard",
    name: "tier-standard",
    description: "Default implementation/research worker — Pandacorp STANDARD tier",
    model: "gpt-5.5",
    effort: "medium",
  },
  {
    fileSlug: "tier-judge",
    name: "tier-judge",
    description: "High-judgment reviewer/architect/red-teamer — Pandacorp JUDGE tier",
    model: "gpt-5.5",
    effort: "high",
  },
];

function buildTierDeveloperInstructions(tierLabel) {
  return [
    `# Generated by plugin/scripts/generate-codex-agents.mjs — generic ${tierLabel} tier worker (not sourced from plugin/agents/).`,
    "",
    `You are a ${tierLabel}-tier Pandacorp delegate. Execute the delegated task exactly as scoped by the ` +
      "orchestrating agent's request, following this project's AGENTS.md and the factory's engineering " +
      "standards (factory/standards/). Stay within the scope you were given; do not expand it, do not touch " +
      "files outside what the task requires, and report back concisely what you did and any evidence " +
      "(commands run, tests passed) that it worked.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const agentFiles = readdirSync(AGENTS_SRC_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  const generated = [];

  for (const file of agentFiles) {
    const fullPath = path.join(AGENTS_SRC_DIR, file);
    const raw = readFileSync(fullPath, "utf8");
    const { frontmatter, body } = parseAgentFile(raw);

    const name = frontmatter.get("name") || file.replace(/\.md$/, "");
    const description = frontmatter.get("description") || "";
    const claudeModel = frontmatter.get("model");
    const explicitEffort = frontmatter.get("effort");
    const { model, effort } = mapModelTier(claudeModel, explicitEffort);
    const sandboxReadOnly = isReadOnlyAgent(frontmatter.get("tools"));
    const sourceRelPath = path.posix.join("plugin", "agents", file);
    const developerInstructions = buildDeveloperInstructions(sourceRelPath, body, frontmatter);

    const toml = renderAgentToml({
      name,
      description,
      model,
      effort,
      sandboxReadOnly,
      developerInstructions,
    });

    const outPath = path.join(OUT_DIR, `${name}.toml`);
    writeFileSync(outPath, toml, "utf8");
    generated.push({ outPath, name, model, effort, sandboxReadOnly });
  }

  for (const tier of TIER_WORKERS) {
    const developerInstructions = buildTierDeveloperInstructions(tier.name.replace("tier-", "").toUpperCase());
    const toml = renderAgentToml({
      name: tier.name,
      description: tier.description,
      model: tier.model,
      effort: tier.effort,
      sandboxReadOnly: false,
      developerInstructions,
    });
    const outPath = path.join(OUT_DIR, `${tier.fileSlug}.toml`);
    writeFileSync(outPath, toml, "utf8");
    generated.push({ outPath, name: tier.name, model: tier.model, effort: tier.effort, sandboxReadOnly: false });
  }

  console.log(`Generated ${generated.length} Codex agent TOML files in ${path.relative(REPO_ROOT, OUT_DIR)}/`);
  for (const g of generated) {
    const sandboxNote = g.sandboxReadOnly ? " [sandbox_mode=read-only]" : "";
    console.log(`  ${path.basename(g.outPath)} — model=${g.model} effort=${g.effort}${sandboxNote}`);
  }
}

main();
