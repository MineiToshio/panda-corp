#!/usr/bin/env node
// usage-rollup.mjs — BL-0096: the factory's first per-run cost/token telemetry. Derives a per-model
// call-count/token/cost rollup from a build run's OWN subagent transcripts and prints ONE
// `usage_summary` JSON line to stdout; the caller appends it (fire-and-forget, same idiom as every
// other `.pandacorp/track.jsonl` line — see factory/standards/build-orchestration.md "Durable build
// timeline") to `.pandacorp/track.jsonl`. NEVER writes to `~/.claude/dashboard-events.ndjson` — the
// E5 slim-payload precedent (plugin/scripts/emit-event.sh) is deliberate and this does not widen it.
//
// WHERE the transcripts live: `~/.claude/projects/<project-slug>/<session-id>/subagents/workflows/
// <run-id>/agent-*.jsonl` — documented in plugin/skills/implement/SKILL.md's external maxAgents-brake
// section (the same directory that brake already globs). Only the LAUNCHING Claude Code session knows
// its own project-slug/session-id, so this CLI takes the resolved run directory as an explicit `--dir`
// (never re-derives cwd/session identity itself — BL-0022 discipline) and is invoked by the supervisor
// at run end (`implement/SKILL.md` "Guaranteed shutdown"), never by the engine's own in-process JS
// (which has no access to that identity).
//
// REAL SHAPE, verified live 2026-09-03 against actual on-disk `agent-*.jsonl` files (BL-0096 fix plan's
// [UNVERIFIED] item is now RESOLVED — transcripts DO carry usage; the SubagentStop hook payload does
// not, matching the backlog note that scanned 6,621 event lines and found none): each line is a JSONL
// entry `{ type: "user" | "assistant" | ..., message?: { id, model, usage: { input_tokens,
// output_tokens, cache_creation_input_tokens, cache_read_input_tokens, ... } }, ... }`. Only
// `type === "assistant"` entries carrying `message.usage` + `message.model` are billable calls.
//
// BL-0181: one billed API response streams across MULTIPLE such lines (one per content block), all
// sharing the same `message.id` — see `dedupeByMessageId`'s own comment for the full evidence and the
// dedupe rule (last line per `message.id` wins). Pre-BL-0181, every line was summed independently,
// overcounting cost ~1.6-1.7x.
//
// PRICING is the dated, [VERIFIED] table in docs/proposals/33-model-era-audit.md §3 (fetched from the
// Anthropic pricing page 2026-09-02), USD per MTok. Looked up by exact model id, falling back to the
// id with a trailing `-YYYYMMDD` snapshot date stripped (dated snapshots of a priced family reuse that
// family's price without a code change every rotation). Cache-CREATION tokens are counted but their
// cost is deliberately NOT computed — there is no verified cache-write rate for these models in the
// audited table, and CONV-13 forbids inventing a number; they are reported per-model and named in the
// top-level `cost_excludes`. An unrecognized model id is still tallied (calls/tokens) with `cost_usd:
// null` and listed in `unpriced_models` — an evolving model vocabulary is not malformed data.
//
// Per LESSON-0176 (model is the DOMINANT cost lever, ~10x between tiers — cited in this run's decision
// log), the rollup is keyed by MODEL, not by call site, so the resulting totals are the ones that
// actually answer proposal 33's unfalsifiable re-tier/threshold claims (R-03/R-04/R-11/R-13/R-56).
//
// FAILS LOUD (nonzero exit, no summary line printed) on: a missing/non-directory --dir, or a transcript
// line that fails to parse and is NOT the last line of its file (a genuinely corrupted transcript —
// DR-078: never silently return an empty/zero rollup for a shape this reader cannot parse). A trailing
// incomplete last line (an in-flight streaming write — a real, expected shape while a subagent is still
// writing) is tolerated: it is counted in `skipped_incomplete_lines`, never thrown.
//
// WP-09 addition: joins the per-model rollup against the Workflow's OWN state file — the object the
// live supervisor already maintains at `<session-dir>/workflows/wf_<runId>.json` (NOT the transcript
// dir), which carries per-agent `label`/`phaseTitle`/`startedAt`/`durationMs`/`agentType`/`model` in its
// `workflowProgress[]` (`type: "workflow_agent"` entries, verified live 2026-09-21 against the real
// wf_ddcc95c6-1d7 run — the same run this script cites in its own decision log). The rollup does not
// know which agentId was `gate:<frd>` or `visual-qa` on its own; this join is what answers that. The
// default location is derived by walking UP from `--dir` (`<session>/subagents/workflows/wf_<runId>` →
// `<session>/workflows/wf_<runId>.json`); `--wf-json <path>` or `PANDACORP_WF_JSON` override it for a
// run whose transcript dir moved or whose caller already knows the exact path.
//
// A MISSING wf json is a real, expected shape (an older run, or one launched outside the Workflow
// supervisor) — tolerated as `agents: null` + an explicit `agents_join` reason, never a silent `[]`
// (DR-078). A wf json that EXISTS but fails to parse, or lacks the `workflowProgress` array this join
// depends on, is a genuinely corrupted/foreign artifact — fails loud, same discipline as a corrupted
// transcript line.
//
// `cache_creation_cost_usd_estimated` is a SEPARATE, clearly-labeled estimate (1.25x each model's
// verified INPUT rate — cache-write pricing itself is not in the audited table, so this is not treated
// as a verified number) and is never folded into `cost_usd_total`, which keeps its existing meaning.
//
// F5 addition (docs/proposals/37 §A.7/§4.1 J1-13, depends on I-1/WP-09 above): a PER-CHANGE rollup,
// `--session <path>` in place of `--dir`. Two transcript kinds exist per Claude Code session (verified
// live 2026-09-22 against real on-disk sessions): the top-level `<projectSlug>/<sessionId>.jsonl`
// (the owner's own conversation) and, one level down, `<projectSlug>/<sessionId>/subagents/*.jsonl`
// — FLAT ad hoc Task/Agent-tool transcripts (`agent-<agentId>.jsonl` + a `.meta.json` sidecar, e.g. a
// real panda-mirror session). This is deliberately NEVER the same directory the WP-09 join reads:
// a full `/implement` build launched FROM a session lands its own transcripts one level deeper, at
// `subagents/workflows/wf_<runId>/agent-*.jsonl`, and that run already gets its OWN `usage_summary`
// from `--dir` joined against its own `wf_<runId>.json`. Folding those into a `--session` rollup too
// would double-count a build's cost under both artifacts — so `--session` globs `subagents/*.jsonl`
// ONE LEVEL ONLY, and a nested `subagents/workflows/` directory is simply invisible to it, by design.
//
// The window is either explicit (`--window <ISO-start>..<ISO-end>`) or derived from two commits'
// OWN COMMITTER dates (`--commits <sha1>..<sha2> --repo <path>`, `git log --format=%cI` — never author
// date, which a rebase/cherry-pick changes without changing when the work actually landed). With
// NEITHER flag the window is unbounded: every session-own call counts, and — because the flat
// subagents glob above already excludes nested build runs — this reproduces a whole session's OWN
// cost, matching how docs/proposals/37 §0.5's manual-session table was read by hand (e.g. session
// `1744c53f`: 322 calls, $18.72, verified live 2026-09-22 by running this exact mode with no window).
//
// `context_avg_tokens_per_call` is `(input + cache_read + cache_creation) / calls` — the same
// definition proposals/37 §0.4/§0.5 used for its "contexto medio/llamada" column, so this mode's
// output is directly comparable to that memo's numbers, not a new incompatible metric.
//
// DR-078: an unreadable/missing `--session` file, or a genuinely corrupt non-trailing transcript line
// (in the session file OR a subagent file), fails loud — never a silent empty/zero rollup. A window
// with zero matching calls is a real, tolerated shape: `calls: 0` plus an explicit `note`, exit 0.
//
// `--card <path.md>` optionally reads that change-card's `rigor:` frontmatter line (a hand-rolled read
// — no YAML dependency, same precedent as `generate-codex-agents.mjs`). The field is still only a
// proposal (docs/proposals/37), so a card that simply has no `rigor:` line yet reports `rigor: null`,
// never an error; an explicitly-requested `--card` path that cannot be READ AT ALL is an error (the
// owner named it). `--out <path>` appends the `{"kind":"change_usage", ...}` line to that file (e.g.
// the project's `.pandacorp/track.jsonl`); by default (no `--out`) this mode is a pure dry run and
// performs NO file writes at all — it only prints the summary line to stdout, same as `--dir` always
// has.

import { appendFileSync, closeSync, fstatSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const PRICING = {
  // family (post date-strip) → { in, out, cacheRead } USD per MTok. Source: docs/proposals/33-model-
  // era-audit.md §3, table fetched 2026-09-02 from https://platform.claude.com/docs/en/about-claude/pricing.
  'claude-fable-5-1': { in: 10, out: 50, cacheRead: 0.25 },
  'claude-opus-5': { in: 5, out: 25, cacheRead: 0.50 },
  // BL-0156: `claude-opus-5-5` (the id canary B2's transcripts actually stamped on gate/patch/
  // baseline/plan — docs/proposals/33's audited table predates this era rotation and only has
  // `claude-opus-5`) was missing here, so those 4 agents silently rolled up cost_usd: null instead
  // of failing loud or pricing. Assumed identical to `claude-opus-5` (same family, no verified
  // distinct rate published yet) until a dated pricing page proves otherwise.
  'claude-opus-5-5': { in: 5, out: 25, cacheRead: 0.50 },
  'claude-sonnet-5': { in: 2, out: 10, cacheRead: 0.20 },
  'claude-haiku-4-5': { in: 1, out: 5, cacheRead: 0.10 },
  'claude-opus-4-8': { in: 5, out: 25, cacheRead: 0.50 },
  'claude-sonnet-4-6': { in: 3, out: 15, cacheRead: 0.30 },
  'claude-sonnet-4-5': { in: 3, out: 15, cacheRead: 0.30 },
}

function priceFor(modelId) {
  if (!modelId) return null
  if (PRICING[modelId]) return PRICING[modelId]
  const stripped = modelId.replace(/-\d{8}$/, '')
  return PRICING[stripped] || null
}

function round(n) { return Math.round(n * 1e6) / 1e6 }

// D4 (REV3-K, DR-078 fail-loud read boundary): `.pandacorp/track.jsonl` has several producers, so a
// run killed mid-write can leave a last line with NO trailing newline. A bare `appendFileSync` then
// welds the new record onto that dangling line — one unparseable line, and every NDJSON reader of
// the timeline (Mission Control's DAG/timeline, the close-out rollup) fails loud on it. Normalise
// the boundary first: read only the file's LAST byte (sync fs, no full read) and prepend a newline
// when it isn't already one. A missing file needs no normalisation (ENOENT); any OTHER read failure
// still surfaces (never silently appended over) — appendFileSync itself is what enforces "an
// unwritable --out fails loud" (REV3-N), unaffected by this boundary check.
function appendTrackLine(outPath, line) {
  let needsLeadingNewline = false
  try {
    const fd = openSync(outPath, 'r')
    try {
      const size = fstatSync(fd).size
      if (size > 0) {
        const lastByte = Buffer.alloc(1)
        readSync(fd, lastByte, 0, 1, size - 1)
        needsLeadingNewline = lastByte[0] !== 0x0a
      }
    } finally {
      closeSync(fd)
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  appendFileSync(outPath, (needsLeadingNewline ? '\n' : '') + line)
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') out.dir = argv[++i]
    else if (argv[i] === '--wf-json') out.wfJson = argv[++i]
    else if (argv[i] === '--session') out.session = argv[++i]
    else if (argv[i] === '--window') out.window = argv[++i]
    else if (argv[i] === '--commits') out.commits = argv[++i]
    else if (argv[i] === '--repo') out.repo = argv[++i]
    else if (argv[i] === '--card') out.card = argv[++i]
    else if (argv[i] === '--out') out.out = argv[++i]
  }
  return out
}

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`)
  process.exit(1)
}

// `agent-<agentId>.jsonl` → `<agentId>` (the same id the Workflow's `workflowProgress[].agentId` uses).
function agentIdFromFilename(name) {
  return name.replace(/^agent-/, '').replace(/\.jsonl$/, '')
}

// `<session>/subagents/workflows/wf_<runId>` → `<session>/workflows/wf_<runId>.json` (verified live
// 2026-09-21 against the real wf_ddcc95c6-1d7 run's on-disk layout).
function defaultWfJsonPath(runDir) {
  const sessionDir = path.dirname(path.dirname(path.dirname(runDir)))
  return path.join(sessionDir, 'workflows', `${path.basename(runDir)}.json`)
}

function emptyBucket() {
  return { calls: 0, input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
}

function addUsage(bucket, usage) {
  bucket.calls++
  bucket.input_tokens += usage.input_tokens || 0
  bucket.output_tokens += usage.output_tokens || 0
  bucket.cache_creation_input_tokens += usage.cache_creation_input_tokens || 0
  bucket.cache_read_input_tokens += usage.cache_read_input_tokens || 0
}

// Parses ANY transcript JSONL file — a top-level session file or an `agent-*.jsonl` subagent
// transcript, they share the exact same line shape — into its billable `assistant` entries. Shared
// by `--dir` mode (per agent-*.jsonl) and `--session` mode (the session file + its flat subagents),
// so the trailing-partial-write tolerance and the fail-loud-on-corruption rule (DR-078) live in ONE
// place. A trailing incomplete line (an in-flight streaming write) is tolerated and counted; a
// corrupt line that is NOT the trailing one is a genuinely malformed transcript and throws.
// BL-0181: a single billed API response is written as SEVERAL JSONL lines — one per content/apiBlock
// index — and EVERY line repeats that response's full `message.usage` (same input/cache_read/cache_
// creation tokens, a partial-then-final `output_tokens`). Verified live 2026-09-25 against a real D2
// subagent transcript (`wf_faf48b18-881/agent-a6a99231809a75183.jsonl`): the first line for a given
// `message.id` carries `output_tokens: 1`, the LAST carries the true final count (253), while
// input/cache tokens are byte-identical across all of that message's lines. Summing per line (the
// pre-BL-0181 behaviour) therefore overcounted every run's cost ~1.6-1.7x (docs/proposals/38 red-team
// addendum §A1: rollup 58.58 $ vs deduplicated 36.24 $ on that same D2 run, reproduced to the cent).
// Dedupe by `message.id`, LAST line wins (it carries the complete usage). This collapse is done PER
// FILE, in-order — never cross-file/cross-agent — because a `message.id` is scoped to the one API
// call made by the one agent whose transcript file it appears in. A line with no `message.id` (a
// shape never observed live, but tolerated per DR-078) is conservatively treated as its OWN unique
// message: it is never merged with anything, so this fallback can only ever OVER-count a genuinely
// id-less line, never silently drop or merge distinct calls.
function dedupeByMessageId(rawEntries) {
  const byMessageId = new Map()
  const unidentified = []
  for (const entry of rawEntries) {
    if (!entry.messageId) { unidentified.push(entry); continue }
    byMessageId.set(entry.messageId, entry)   // re-setting an existing key overwrites its value but keeps its original slot — later (fuller) line wins, order is irrelevant since aggregation is a commutative sum
  }
  return [...byMessageId.values(), ...unidentified]
}

function parseTranscriptFile(filePath) {
  const raw = readFileSync(filePath, 'utf8')
  const lines = raw.split('\n')
  while (lines.length && lines[lines.length - 1] === '') lines.pop()   // the trailing '' after the final \n is not a real line
  const rawEntries = []
  let skippedIncompleteLines = 0
  lines.forEach((line, index) => {
    if (!line.trim()) return
    let entry
    try {
      entry = JSON.parse(line)
    } catch (error) {
      const isLastLineOfFile = index === lines.length - 1
      if (isLastLineOfFile) { skippedIncompleteLines++; return }
      throw new Error(`malformed transcript line (not the trailing partial write) at ${filePath}:${index + 1}: ${error.message}`)
    }
    if (!entry || entry.type !== 'assistant') return
    const message = entry.message
    const usage = message && message.usage
    const model = message && message.model
    if (!usage || !model) return
    rawEntries.push({ model, usage, timestamp: entry.timestamp, messageId: message.id })
  })
  return { entries: dedupeByMessageId(rawEntries), skippedIncompleteLines }
}

// `.../<sessionId>.jsonl` → `.../<sessionId>/subagents` — see the F5 header note above: FLAT only,
// deliberately never recursing into a nested `subagents/workflows/wf_<runId>/` (a build run's own,
// separately-tracked transcripts).
function subagentsDirFor(sessionPath) {
  const sessionId = path.basename(sessionPath).replace(/\.jsonl$/, '')
  return path.join(path.dirname(sessionPath), sessionId, 'subagents')
}

// A missing subagents/ directory is a real, common shape (most sessions spawn no ad hoc subagent at
// all) — tolerated as an empty list, never an error. `.meta.json` sidecars are excluded by construction
// (they don't end in `.jsonl`), no separate exclusion filter needed.
function listFlatSubagentFiles(subagentsDir) {
  let names
  try { names = readdirSync(subagentsDir) } catch { return [] }
  return names.filter((name) => name.endsWith('.jsonl')).sort()
}

// `--window <ISO-start>..<ISO-end>` — a literal, explicit window; order-independent.
function parseWindowArg(raw) {
  const parts = raw.split('..')
  if (parts.length !== 2) throw new Error(`--window must be "<ISO-start>..<ISO-end>", got: ${raw}`)
  const [startIso, endIso] = parts
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  if (Number.isNaN(start) || Number.isNaN(end)) throw new Error(`--window has an unparseable ISO timestamp: ${raw}`)
  return { start: Math.min(start, end), end: Math.max(start, end) }
}

// `--commits <sha1>..<sha2>` — derives the window from those two commits' own COMMITTER dates
// (`git log --format=%cI`; never author date, which a rebase/cherry-pick changes without changing
// when the work actually landed) in `--repo`. Order-independent: the window is [min, max] of the two.
function deriveWindowFromCommits(raw, repo) {
  const parts = raw.split('..')
  if (parts.length !== 2) throw new Error(`--commits must be "<sha1>..<sha2>", got: ${raw}`)
  if (!repo) throw new Error('--commits requires --repo <path-to-git-repo>')
  const timestamps = parts.map((sha) => {
    let out
    try {
      out = execFileSync('git', ['-C', repo, 'log', '-1', '--format=%cI', sha], { encoding: 'utf8' })
    } catch (error) {
      throw new Error(`--commits could not resolve ${sha} in ${repo}: ${String(error.message).split('\n')[0]}`)
    }
    const iso = out.trim()
    const ms = Date.parse(iso)
    if (!iso || Number.isNaN(ms)) throw new Error(`--commits: ${sha} in ${repo} has no resolvable committer date`)
    return ms
  })
  return { start: Math.min(...timestamps), end: Math.max(...timestamps) }
}

// Minimal, hand-rolled frontmatter read for a change-card's `rigor:` line — no YAML dependency, same
// precedent as `generate-codex-agents.mjs` (this repo's frontmatter is a small known subset of YAML).
// An explicitly-requested `--card` that cannot be read at all is an error (the owner named it); a card
// that reads fine but simply has no `rigor:` line yet is a real, expected shape (the field is still
// only a proposal in docs/proposals/37) — reported as `null`, never thrown.
function readCardRigor(cardPath) {
  let raw
  try {
    raw = readFileSync(cardPath, 'utf8')
  } catch (error) {
    throw new Error(`--card could not be read: ${cardPath}: ${error.message}`)
  }
  const match = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return null
  const line = match[1].split('\n').find((l) => /^rigor:\s*/.test(l))
  if (!line) return null
  const value = line.replace(/^rigor:\s*/, '').trim().replace(/^["']|["']$/g, '')
  return value || null
}

// Collapses one agent's per-model buckets (almost always exactly one model) into the row `agents[]`
// wants: totals across every model it called, a `cost_usd` that is null (never invented) if ANY of its
// models is unpriced, and the `model` it called the MOST — the one that actually explains its cost.
function summarizeAgentUsage(agentModels) {
  const totals = emptyBucket()
  let costUsd = 0
  let allPriced = true
  let dominantModel = null
  let dominantCalls = -1
  for (const [model, bucket] of Object.entries(agentModels)) {
    totals.calls += bucket.calls
    totals.input_tokens += bucket.input_tokens
    totals.output_tokens += bucket.output_tokens
    totals.cache_creation_input_tokens += bucket.cache_creation_input_tokens
    totals.cache_read_input_tokens += bucket.cache_read_input_tokens
    if (bucket.calls > dominantCalls) { dominantCalls = bucket.calls; dominantModel = model }
    const price = priceFor(model)
    if (!price) { allPriced = false; continue }
    costUsd += (bucket.input_tokens * price.in + bucket.cache_read_input_tokens * price.cacheRead + bucket.output_tokens * price.out) / 1e6
  }
  return { ...totals, model: dominantModel, cost_usd: allPriced ? round(costUsd) : null }
}

// Sweep-line max overlap of [startedAt, startedAt + durationMs) intervals. Ends are processed BEFORE
// starts at an identical timestamp so two agents that merely touch (one ends exactly when the next
// starts) are never counted as concurrent.
function computeConcurrencyMax(rows) {
  const events = []
  for (const r of rows) { events.push([r.startedAt, 1]); events.push([r.startedAt + r.durationMs, -1]) }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  let current = 0
  let max = 0
  for (const [, delta] of events) { current += delta; if (current > max) max = current }
  return max
}

// Reads the Workflow's own state file and returns its `workflow_agent` entries keyed by `agentId`.
// A MISSING file is a real, tolerated shape (`{ missing: true }`, DR-078 — never a silent empty join).
// An EXISTING but unparsable file, or one missing the `workflowProgress` array this join depends on, is
// a corrupted/foreign artifact and fails loud — same discipline as a corrupted transcript line.
function loadWorkflowAgents(wfJsonPath) {
  let raw
  try {
    raw = readFileSync(wfJsonPath, 'utf8')
  } catch {
    return { missing: true }
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`malformed workflow json at ${wfJsonPath}: ${error.message}`)
  }
  if (!parsed || !Array.isArray(parsed.workflowProgress)) {
    throw new Error(`malformed workflow json at ${wfJsonPath}: missing workflowProgress array`)
  }
  const byAgentId = new Map()
  for (const entry of parsed.workflowProgress) {
    if (entry && entry.type === 'workflow_agent' && entry.agentId) byAgentId.set(entry.agentId, entry)
  }
  return { missing: false, byAgentId }
}

function runDirMode({ dir, wfJson, out }) {
  if (!dir) return fail('missing required --dir <transcript-run-dir>')

  let stat
  try { stat = statSync(dir) } catch { return fail(`transcript run dir does not exist: ${dir}`) }
  if (!stat.isDirectory()) return fail(`--dir is not a directory: ${dir}`)

  // Exactly the glob the external maxAgents brake already uses (SKILL.md): agent-*.jsonl, never a
  // `.meta.` sidecar file (those are NOT transcript JSONL and would fail-loud as "malformed" if read).
  const files = readdirSync(dir)
    .filter((name) => name.startsWith('agent-') && name.endsWith('.jsonl') && !name.includes('.meta.'))
    .sort()

  const models = {}
  const agentUsage = {}   // agentId → { model → bucket } — almost always a single model per agent
  let skippedIncompleteLines = 0
  let callsTotal = 0

  for (const name of files) {
    const agentId = agentIdFromFilename(name)
    const filePath = path.join(dir, name)
    const { entries, skippedIncompleteLines: skipped } = parseTranscriptFile(filePath)
    skippedIncompleteLines += skipped
    for (const { model, usage } of entries) {
      callsTotal++
      addUsage(models[model] || (models[model] = emptyBucket()), usage)
      const agentModels = agentUsage[agentId] || (agentUsage[agentId] = {})
      addUsage(agentModels[model] || (agentModels[model] = emptyBucket()), usage)
    }
  }

  const unpricedModels = []
  let costUsdTotal = 0
  let cacheCreationCostUsdEstimated = 0
  for (const [model, bucket] of Object.entries(models)) {
    const price = priceFor(model)
    if (!price) { unpricedModels.push(model); bucket.cost_usd = null; continue }
    const cost = (bucket.input_tokens * price.in + bucket.cache_read_input_tokens * price.cacheRead + bucket.output_tokens * price.out) / 1e6
    bucket.cost_usd = round(cost)
    costUsdTotal += cost
    // 1.25x the model's own VERIFIED input rate — there is no verified cache-WRITE rate in the audited
    // table, so this stays a clearly-labeled estimate and is deliberately excluded from cost_usd_total.
    cacheCreationCostUsdEstimated += (bucket.cache_creation_input_tokens * price.in * 1.25) / 1e6
  }

  const wfJsonPath = wfJson || process.env.PANDACORP_WF_JSON || defaultWfJsonPath(dir)
  const wf = loadWorkflowAgents(wfJsonPath)

  let agents = null
  let agentsJoin
  let agentsUnjoined = null   // D-10: transcripts with COST but no matching workflowProgress row (DR-078: named, not dropped)
  let wallClockS = null
  let agentsDurationSumS = null
  let concurrencyMax = null
  let byPhase = null

  if (wf.missing) {
    agentsJoin = `missing wf json at ${wfJsonPath}`
  } else {
    const rows = []
    const unjoined = []   // D-10: a transcript with COST and no workflowProgress row must not vanish silently (DR-078)
    for (const [agentId, agentModels] of Object.entries(agentUsage)) {
      const wfEntry = wf.byAgentId.get(agentId)
      if (!wfEntry) { unjoined.push({ agentId, cost_usd: summarizeAgentUsage(agentModels).cost_usd }); continue }
      const usage = summarizeAgentUsage(agentModels)
      rows.push({
        agentId,
        label: wfEntry.label,
        phase: wfEntry.phaseTitle,
        agentType: wfEntry.agentType,
        model: usage.model,
        startedAt: wfEntry.startedAt,
        durationMs: wfEntry.durationMs,
        calls: usage.calls,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read_input_tokens: usage.cache_read_input_tokens,
        cache_creation_input_tokens: usage.cache_creation_input_tokens,
        cost_usd: usage.cost_usd,
      })
    }
    rows.sort((a, b) => (b.cost_usd ?? -1) - (a.cost_usd ?? -1))
    agents = rows
    if (unjoined.length) {
      agentsUnjoined = unjoined
      agentsJoin = `${unjoined.length} transcript(s) with cost but no matching workflowProgress row — see agents_unjoined`
    }
    agentsDurationSumS = round(rows.reduce((sum, r) => sum + r.durationMs, 0) / 1000)
    concurrencyMax = computeConcurrencyMax(rows)
    wallClockS = rows.length
      ? round((Math.max(...rows.map((r) => r.startedAt + r.durationMs)) - Math.min(...rows.map((r) => r.startedAt))) / 1000)
      : 0
    byPhase = {}
    for (const r of rows) {
      const b = byPhase[r.phase] || (byPhase[r.phase] = { cost_usd: 0, duration_s: 0, calls: 0 })
      b.cost_usd = round(b.cost_usd + (r.cost_usd || 0))
      b.duration_s = round(b.duration_s + r.durationMs / 1000)
      b.calls += r.calls
    }
  }

  const summary = {
    kind: 'usage_summary',
    at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    run_dir: dir,
    calls_total: callsTotal,
    models,
    cost_usd_total: round(costUsdTotal),
    cost_excludes: ['cache_creation_input_tokens'],
    unpriced_models: unpricedModels.sort(),
    skipped_incomplete_lines: skippedIncompleteLines,
    cache_creation_cost_usd_estimated: round(cacheCreationCostUsdEstimated),
    cache_creation_pricing: 'estimated 1.25x input; not verified',
    agents,
    wall_clock_s: wallClockS,
    agents_duration_sum_s: agentsDurationSumS,
    concurrency_max: concurrencyMax,
    by_phase: byPhase,
  }
  if (agentsJoin) summary.agents_join = agentsJoin
  if (agentsUnjoined) summary.agents_unjoined = agentsUnjoined   // D-10: named, not dropped (DR-078)

  // BL-0156: `--out` used to be parsed but silently dropped in --dir mode (destructured out of the
  // args, never wired to a write) — an accepted flag that does not do what it says is exactly the
  // DR-078 failure this script otherwise guards against everywhere else. Same idiom as --session's
  // --out: appendTrackLine BEFORE stdout, so an unwritable --out fails loud (propagates to main's
  // catch → fail() → exit 1, no summary line) instead of printing a summary that implies the record
  // was persisted when it wasn't (REV3-N's rule, now shared by both modes).
  if (out) appendTrackLine(out, `${JSON.stringify(summary)}\n`)

  process.stdout.write(JSON.stringify(summary) + '\n')
}

// F5: per-CHANGE rollup — see the header note above for the flat-subagents-only / no-double-count
// rationale and the window-derivation rules.
function runSessionMode({ session, windowArg, commitsArg, repo, card, out }) {
  let stat
  try { stat = statSync(session) } catch { return fail(`session transcript does not exist: ${session}`) }
  if (!stat.isFile()) return fail(`--session is not a file: ${session}`)
  if (windowArg && commitsArg) return fail('pass only one of --window / --commits, not both')

  let window = null
  let windowSource = null
  if (windowArg) { window = parseWindowArg(windowArg); windowSource = 'explicit' }
  else if (commitsArg) { window = deriveWindowFromCommits(commitsArg, repo); windowSource = 'commits' }

  const inWindow = (isoTimestamp) => {
    if (!window) return true
    const ms = Date.parse(isoTimestamp)
    return !Number.isNaN(ms) && ms >= window.start && ms <= window.end
  }

  // The session's OWN entries — parseTranscriptFile fails loud on genuine corruption (DR-078).
  const { entries: sessionEntries, skippedIncompleteLines: sessionSkipped } = parseTranscriptFile(session)
  const included = sessionEntries.filter((e) => inWindow(e.timestamp))
  let skippedIncompleteLines = sessionSkipped

  // The session's FLAT subagents only — never the nested build-run transcripts (see header note).
  const subagentsDir = subagentsDirFor(session)
  let subagentsContributing = 0
  for (const name of listFlatSubagentFiles(subagentsDir)) {
    const filePath = path.join(subagentsDir, name)
    const { entries, skippedIncompleteLines: skipped } = parseTranscriptFile(filePath)
    skippedIncompleteLines += skipped
    const inWindowEntries = entries.filter((e) => inWindow(e.timestamp))
    if (inWindowEntries.length) subagentsContributing++
    included.push(...inWindowEntries)
  }

  const models = {}
  let contextTokensSum = 0
  for (const { model, usage } of included) {
    addUsage(models[model] || (models[model] = emptyBucket()), usage)
    contextTokensSum += (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0)
  }

  const unpricedModels = []
  let costUsdTotal = 0
  let cacheCreationCostUsdEstimated = 0
  for (const [model, bucket] of Object.entries(models)) {
    const price = priceFor(model)
    if (!price) { unpricedModels.push(model); bucket.cost_usd = null; continue }
    const cost = (bucket.input_tokens * price.in + bucket.cache_read_input_tokens * price.cacheRead + bucket.output_tokens * price.out) / 1e6
    bucket.cost_usd = round(cost)
    costUsdTotal += cost
    cacheCreationCostUsdEstimated += (bucket.cache_creation_input_tokens * price.in * 1.25) / 1e6
  }

  const calls = included.length
  const isoNoMillis = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
  let wallClockS
  if (window) {
    wallClockS = round((window.end - window.start) / 1000)
  } else {
    const timestamps = included.map((e) => Date.parse(e.timestamp)).filter((ms) => !Number.isNaN(ms))
    wallClockS = timestamps.length ? round((Math.max(...timestamps) - Math.min(...timestamps)) / 1000) : 0
  }

  const summary = {
    kind: 'change_usage',
    at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    session,
    window: window ? { start: isoNoMillis(window.start), end: isoNoMillis(window.end) } : null,
    window_source: windowSource,
    calls,
    context_avg_tokens_per_call: calls ? round(contextTokensSum / calls) : null,
    models,
    cost_usd_total: round(costUsdTotal),
    cost_excludes: ['cache_creation_input_tokens'],
    unpriced_models: unpricedModels.sort(),
    skipped_incomplete_lines: skippedIncompleteLines,
    cache_creation_cost_usd_estimated: round(cacheCreationCostUsdEstimated),
    cache_creation_pricing: 'estimated 1.25x input; not verified',
    subagents: subagentsContributing,
    wall_clock_s: wallClockS,
  }
  if (calls === 0) summary.note = 'no calls found in window'   // DR-078: tolerated, not an error
  if (card) {
    summary.card = card
    summary.rigor = readCardRigor(card)
  }

  // Dry run by default (no --out): never write any file, only print. `--out` appends the SAME line
  // the caller decides where it lands — same idiom as every other `.pandacorp/track.jsonl` writer.
  if (out) appendTrackLine(out, `${JSON.stringify(summary)}\n`)

  process.stdout.write(JSON.stringify(summary) + '\n')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.session) {
    return runSessionMode({ session: args.session, windowArg: args.window, commitsArg: args.commits, repo: args.repo, card: args.card, out: args.out })
  }
  return runDirMode(args)
}

try {
  main()
} catch (error) {
  fail(error.message)
}
