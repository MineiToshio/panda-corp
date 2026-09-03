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
  }
  return out
}

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`)
  process.exit(1)
}

function main() {
  const { dir } = parseArgs(process.argv.slice(2))
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
  let skippedIncompleteLines = 0
  let callsTotal = 0

  for (const name of files) {
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
      const bucket = models[model] || (models[model] = { calls: 0, input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 })
      bucket.calls++
      bucket.input_tokens += usage.input_tokens || 0
      bucket.output_tokens += usage.output_tokens || 0
      bucket.cache_creation_input_tokens += usage.cache_creation_input_tokens || 0
      bucket.cache_read_input_tokens += usage.cache_read_input_tokens || 0
    })
  }

  const unpricedModels = []
  let costUsdTotal = 0
  for (const [model, bucket] of Object.entries(models)) {
    const price = priceFor(model)
    if (!price) { unpricedModels.push(model); bucket.cost_usd = null; continue }
    const cost = (bucket.input_tokens * price.in + bucket.cache_read_input_tokens * price.cacheRead + bucket.output_tokens * price.out) / 1e6
    bucket.cost_usd = round(cost)
    costUsdTotal += cost
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
  }

  process.stdout.write(JSON.stringify(summary) + '\n')
}

try {
  main()
} catch (error) {
  fail(error.message)
}
