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
// entry `{ type: "user" | "assistant" | ..., message?: { model, usage: { input_tokens, output_tokens,
// cache_creation_input_tokens, cache_read_input_tokens, ... } }, ... }`. Only `type === "assistant"`
// entries carrying `message.usage` + `message.model` are billable calls.
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

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const PRICING = {
  // family (post date-strip) → { in, out, cacheRead } USD per MTok. Source: docs/proposals/33-model-
  // era-audit.md §3, table fetched 2026-09-02 from https://platform.claude.com/docs/en/about-claude/pricing.
  'claude-fable-5-1': { in: 10, out: 50, cacheRead: 0.25 },
  'claude-opus-5': { in: 5, out: 25, cacheRead: 0.50 },
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

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') out.dir = argv[++i]
    else if (argv[i] === '--wf-json') out.wfJson = argv[++i]
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

function main() {
  const { dir, wfJson } = parseArgs(process.argv.slice(2))
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
    const raw = readFileSync(filePath, 'utf8')
    const lines = raw.split('\n')
    while (lines.length && lines[lines.length - 1] === '') lines.pop()   // the trailing '' after the final \n is not a real line
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
      callsTotal++
      addUsage(models[model] || (models[model] = emptyBucket()), usage)
      const agentModels = agentUsage[agentId] || (agentUsage[agentId] = {})
      addUsage(agentModels[model] || (agentModels[model] = emptyBucket()), usage)
    })
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

  process.stdout.write(JSON.stringify(summary) + '\n')
}

try {
  main()
} catch (error) {
  fail(error.message)
}
