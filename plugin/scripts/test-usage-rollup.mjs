#!/usr/bin/env node
// test-usage-rollup.mjs — BL-0096. Proves usage-rollup.mjs against:
//   (a) a REAL fixture reproducing the actual production `agent-*.jsonl` transcript shape (verified
//       live 2026-09-03 against on-disk transcripts — see the script header), aggregated across two
//       transcript files + excluding a `.meta.` sidecar;
//   (b) a MALFORMED fixture (a corrupted non-trailing line) that must fail LOUD (DR-078), never a
//       silent empty/zero rollup;
//   (c) a tolerated trailing-incomplete-line shape (an in-flight streaming write);
//   (d) a missing --dir (fail loud, no summary line);
//   (e) an unpriced/unknown model id (tallied, never crashes, flagged — never invents a cost);
//   (f) a dated-snapshot model id falling back to its family's price.
// Plain node, no framework — mirrors plugin/scripts/test-build-run-id.mjs's `ok()` idiom.

import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const SCRIPT = path.join(path.dirname(new URL(import.meta.url).pathname), 'usage-rollup.mjs')

let passed = 0
const ok = (condition, name) => { if (!condition) throw new Error(name); passed++; console.log(`PASS  ${name}`) }

const assistantLine = (model, usage, uuid = 'u1') => JSON.stringify({
  parentUuid: null, isSidechain: true, promptId: 'p1', agentId: 'a1', type: 'assistant',
  message: { model, usage }, uuid, timestamp: '2026-09-03T00:00:00Z', userType: 'external',
  entrypoint: 'workflow', cwd: '/tmp', sessionId: 's1', version: '1.0.0', gitBranch: 'main',
})
const userLine = () => JSON.stringify({ parentUuid: null, isSidechain: true, type: 'user', uuid: 'u0', timestamp: '2026-09-03T00:00:00Z' })

const run = async (args) => {
  try {
    const { stdout, stderr } = await exec('node', [SCRIPT, ...args])
    return { code: 0, stdout, stderr }
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout || '', stderr: error.stderr || '' }
  }
}

// (a) REAL production shape: two agent-*.jsonl transcripts + a .meta. sidecar that would blow up
// parsing if it were ever read — proving the exclusion glob actually holds.
{
  const dir = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-real-'))
  await writeFile(path.join(dir, 'agent-aaa.jsonl'), [
    userLine(),
    assistantLine('claude-haiku-4-5-20251001', { input_tokens: 3, cache_creation_input_tokens: 20867, cache_read_input_tokens: 8010, output_tokens: 200 }, 'x1'),
    userLine(),
    assistantLine('claude-haiku-4-5-20251001', { input_tokens: 5, cache_creation_input_tokens: 942, cache_read_input_tokens: 28877, output_tokens: 150 }, 'x2'),
  ].join('\n') + '\n')
  await writeFile(path.join(dir, 'agent-bbb.jsonl'), [
    userLine(),
    assistantLine('claude-sonnet-5', { input_tokens: 40000, cache_creation_input_tokens: 0, cache_read_input_tokens: 160000, output_tokens: 20000 }, 'y1'),
  ].join('\n') + '\n')
  await writeFile(path.join(dir, 'agent-aaa.jsonl.meta.json'), '{ this is not valid JSONL and would throw if ever read')
  const { code, stdout } = await run(['--dir', dir])
  ok(code === 0, 'real two-file transcript shape exits 0')
  const summary = JSON.parse(stdout.trim())
  ok(summary.kind === 'usage_summary', 'summary line is kind usage_summary')
  ok(summary.calls_total === 3, 'counts exactly the 3 assistant calls across both files, ignoring user lines and the .meta. sidecar')
  ok(summary.models['claude-haiku-4-5-20251001'].calls === 2, 'per-model call count aggregates across files')
  ok(summary.models['claude-haiku-4-5-20251001'].input_tokens === 8, 'per-model token totals sum correctly (3+5)')
  ok(summary.models['claude-sonnet-5'].cost_usd === Number((40000 * 2 / 1e6 + 160000 * 0.20 / 1e6 + 20000 * 10 / 1e6).toFixed(6)), 'sonnet-5 cost computed from the audited $2/$10/$0.20 MTok rates')
  ok(typeof summary.cost_usd_total === 'number' && summary.cost_usd_total > 0, 'a total cost rolls up across models')
  ok(Array.isArray(summary.cost_excludes) && summary.cost_excludes.includes('cache_creation_input_tokens'), 'cache-creation cost is explicitly excluded, never invented')
  ok(summary.skipped_incomplete_lines === 0, 'no incomplete lines in a clean fixture')
  await rm(dir, { recursive: true })
}

// (b) MALFORMED: a corrupted line that is NOT the trailing line must fail LOUD — never a silent
// empty/zero summary (DR-078).
{
  const dir = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-malformed-'))
  await writeFile(path.join(dir, 'agent-ccc.jsonl'), [
    assistantLine('claude-sonnet-5', { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }),
    '{ this line is not valid JSON and is NOT the last line',
    userLine(),
  ].join('\n') + '\n')
  const { code, stdout, stderr } = await run(['--dir', dir])
  ok(code !== 0, 'a corrupted mid-file transcript line fails loud (nonzero exit)')
  ok(stdout.trim() === '', 'no usage_summary line is printed on a malformed shape — never silent empty/zero')
  ok(/ERROR/.test(stderr) && /malformed transcript line/.test(stderr), 'the failure names the malformed-transcript-line cause')
  await rm(dir, { recursive: true })
}

// (c) A trailing incomplete line (an in-flight streaming write) IS tolerated — real, expected shape.
{
  const dir = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-partial-'))
  await writeFile(path.join(dir, 'agent-ddd.jsonl'), [
    assistantLine('claude-opus-5', { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }),
    '{"type":"assistant","message":{"model":"claude-opus-5","usage":{"input_то', // cut mid-write, last line
  ].join('\n'))
  const { code, stdout } = await run(['--dir', dir])
  ok(code === 0, 'a trailing incomplete line does not fail the run')
  const summary = JSON.parse(stdout.trim())
  ok(summary.calls_total === 1, 'the complete preceding line is still counted')
  ok(summary.skipped_incomplete_lines === 1, 'the incomplete trailing line is counted, not silently dropped nor thrown')
  await rm(dir, { recursive: true })
}

// (d) A missing --dir fails loud, no summary line.
{
  const { code, stdout, stderr } = await run(['--dir', '/nonexistent/path/does-not-exist'])
  ok(code !== 0, 'a nonexistent transcript dir fails loud')
  ok(stdout.trim() === '', 'no summary line for a missing directory')
  ok(/ERROR/.test(stderr), 'the failure is visible on stderr')
}
{
  const { code, stderr } = await run([])
  ok(code !== 0 && /--dir/.test(stderr), 'a missing --dir argument fails loud with a clear message')
}

// (e) An unpriced/unknown model id is tallied, never crashes, and is flagged rather than priced with
// an invented number.
{
  const dir = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-unpriced-'))
  await writeFile(path.join(dir, 'agent-eee.jsonl'), assistantLine('claude-nova-9-hypothetical', { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }) + '\n')
  const { code, stdout } = await run(['--dir', dir])
  ok(code === 0, 'an unrecognized model id does not crash the rollup')
  const summary = JSON.parse(stdout.trim())
  ok(summary.models['claude-nova-9-hypothetical'].calls === 1, 'the unknown model is still tallied by calls/tokens')
  ok(summary.models['claude-nova-9-hypothetical'].cost_usd === null, 'an unpriced model never gets an invented cost')
  ok(summary.unpriced_models.includes('claude-nova-9-hypothetical'), 'the unpriced model is surfaced, not silently swallowed')
  await rm(dir, { recursive: true })
}

// (f) A dated-snapshot model id falls back to its priced family.
{
  const dir = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-dated-'))
  await writeFile(path.join(dir, 'agent-fff.jsonl'), assistantLine('claude-sonnet-5-20260901', { input_tokens: 1000000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }) + '\n')
  const { code, stdout } = await run(['--dir', dir])
  ok(code === 0, 'a dated snapshot of a priced family does not fail')
  const summary = JSON.parse(stdout.trim())
  ok(summary.models['claude-sonnet-5-20260901'].cost_usd === 2, 'the dated id prices via its family (claude-sonnet-5 = $2/MTok in) after stripping the date suffix')
  ok(summary.unpriced_models.length === 0, 'a dated snapshot of a known family is never reported as unpriced')
  await rm(dir, { recursive: true })
}

// WP-09: per-agent join against the Workflow's own state file (`<session>/workflows/wf_<runId>.json`),
// reached by walking up from `--dir` (`<session>/subagents/workflows/wf_<runId>`) — verified live
// 2026-09-21 against the real wf_ddcc95c6-1d7 run. Also proves the cache-creation cost ESTIMATE (1.25x
// input, never folded into cost_usd_total).

// (g) 3 agents WITH a wf_*.json reachable via the default derived path (no --wf-json override): labels/
// phase join correctly, concurrency_max counts a real overlap (B and C) but not a mere touching boundary
// (A ends exactly when B starts), wall_clock_s spans first start to last end, by_phase aggregates.
{
  const root = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-agents-'))
  const sessionDir = path.join(root, 'session-g')
  const runDir = path.join(sessionDir, 'subagents', 'workflows', 'wf_test1')
  await mkdir(runDir, { recursive: true })
  await mkdir(path.join(sessionDir, 'workflows'), { recursive: true })

  await writeFile(path.join(runDir, 'agent-aaa.jsonl'), assistantLine('claude-sonnet-5', { input_tokens: 1000000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }) + '\n')
  await writeFile(path.join(runDir, 'agent-bbb.jsonl'), assistantLine('claude-opus-5', { input_tokens: 1000000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }) + '\n')
  await writeFile(path.join(runDir, 'agent-ccc.jsonl'), assistantLine('claude-opus-5', { input_tokens: 2000000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }) + '\n')

  const wfAgent = (agentId, label, phaseTitle, startedAt, durationMs, model) => ({
    type: 'workflow_agent', index: 1, label, phaseIndex: 1, phaseTitle, agentId,
    agentType: 'pandacorp:implementer', model, state: 'done', startedAt, queuedAt: startedAt, durationMs, toolCalls: 3,
  })
  const wfJson = {
    runId: 'wf_test1',
    workflowProgress: [
      { type: 'workflow_phase', index: 1, title: 'Baseline' },
      wfAgent('aaa', 'baseline', 'Baseline', 1000, 5000, 'claude-sonnet-5'),
      wfAgent('bbb', 'build:WO-1', 'Build', 6000, 4000, 'claude-opus-5'),   // touches aaa's end (6000) — not concurrent
      wfAgent('ccc', 'build:WO-2', 'Build', 7000, 2000, 'claude-opus-5'),   // overlaps bbb: [7000,9000) inside [6000,10000)
    ],
  }
  await writeFile(path.join(sessionDir, 'workflows', 'wf_test1.json'), JSON.stringify(wfJson))

  const { code, stdout } = await run(['--dir', runDir])
  ok(code === 0, 'a run dir with a joinable wf json exits 0')
  const summary = JSON.parse(stdout.trim())
  ok(Array.isArray(summary.agents) && summary.agents.length === 3, 'agents array has one row per joined agentId')
  const byId = Object.fromEntries(summary.agents.map((a) => [a.agentId, a]))
  ok(byId.aaa.label === 'baseline' && byId.aaa.phase === 'Baseline', 'label and phase come from the wf json join')
  ok(byId.ccc.cost_usd === 10 && byId.bbb.cost_usd === 5 && byId.aaa.cost_usd === 2, 'per-agent cost is derived from ITS OWN transcript usage, not split evenly')
  ok(summary.agents[0].agentId === 'ccc', 'agents are sorted by cost_usd desc (ccc=$10 first)')
  ok(summary.concurrency_max === 2, 'concurrency_max counts the real bbb/ccc overlap, not the aaa/bbb touching boundary')
  ok(summary.wall_clock_s === 9, 'wall_clock_s spans first startedAt (1000) to last end (10000)')
  ok(summary.agents_duration_sum_s === 11, 'agents_duration_sum_s sums each agent duration independent of overlap (5+4+2)')
  ok(summary.by_phase.Baseline.cost_usd === 2 && summary.by_phase.Baseline.duration_s === 5, 'by_phase aggregates the Baseline phase')
  ok(summary.by_phase.Build.cost_usd === 15 && summary.by_phase.Build.duration_s === 6, 'by_phase aggregates the Build phase across bbb+ccc')
  ok(summary.agents_join === undefined, 'no agents_join explanation is added on a successful join')
  await rm(root, { recursive: true })
}

// (h) No wf_*.json anywhere reachable → agents: null + an explicit agents_join reason (DR-078: never a
// silent empty array), while the rest of the summary (calls_total, models, cost_usd_total) is untouched.
{
  const dir = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-nowf-'))
  await writeFile(path.join(dir, 'agent-zzz.jsonl'), assistantLine('claude-sonnet-5', { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }) + '\n')
  const { code, stdout } = await run(['--dir', dir])
  ok(code === 0, 'a missing wf json does not fail the whole rollup')
  const summary = JSON.parse(stdout.trim())
  ok(summary.agents === null, 'agents is explicit null, never a silently empty array, when no wf json is reachable')
  ok(typeof summary.agents_join === 'string' && /missing wf json/.test(summary.agents_join), 'agents_join names the path that was tried')
  ok(summary.calls_total === 1 && summary.cost_usd_total > 0, 'the rest of the summary is computed exactly as without the join')
  await rm(dir, { recursive: true })
}

// (i) A wf_*.json that EXISTS but is corrupt must fail LOUD (DR-078) — never silently drop the join.
{
  const root = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-badwf-'))
  const dir = path.join(root, 'run')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'agent-www.jsonl'), assistantLine('claude-sonnet-5', { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }) + '\n')
  const wfPath = path.join(root, 'wf_bad.json')
  await writeFile(wfPath, '{ this is not valid JSON')
  const { code, stdout, stderr } = await run(['--dir', dir, '--wf-json', wfPath])
  ok(code !== 0, 'a corrupt wf json fails the whole rollup loudly')
  ok(stdout.trim() === '', 'no summary line is printed when the wf json is unreadable')
  ok(/ERROR/.test(stderr), 'the failure is visible on stderr')
  await rm(root, { recursive: true })
}

// (k) D-10: a transcript with COST but NO matching workflowProgress row must not silently vanish from
// the join (DR-078) — it is named in a new `agents_unjoined` array (agentId + its own cost_usd) and
// `agents_join` carries an explanatory note, while the JOINABLE agents still populate `agents` normally.
{
  const root = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-unjoined-'))
  const sessionDir = path.join(root, 'session-k')
  const runDir = path.join(sessionDir, 'subagents', 'workflows', 'wf_test2')
  await mkdir(runDir, { recursive: true })
  await mkdir(path.join(sessionDir, 'workflows'), { recursive: true })

  await writeFile(path.join(runDir, 'agent-aaa.jsonl'), assistantLine('claude-sonnet-5', { input_tokens: 1000000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }) + '\n')
  // 'ghost' has a real transcript (real cost) but NO workflow_agent entry below — e.g. a supervisor
  // crash/race that left the wf json's own state a step behind the transcript directory.
  await writeFile(path.join(runDir, 'agent-ghost.jsonl'), assistantLine('claude-opus-5', { input_tokens: 1000000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }) + '\n')

  const wfJson = {
    runId: 'wf_test2',
    workflowProgress: [
      { type: 'workflow_agent', index: 1, label: 'baseline', phaseIndex: 1, phaseTitle: 'Baseline', agentId: 'aaa', agentType: 'pandacorp:implementer', model: 'claude-sonnet-5', state: 'done', startedAt: 1000, queuedAt: 1000, durationMs: 5000, toolCalls: 3 },
    ],
  }
  await writeFile(path.join(sessionDir, 'workflows', 'wf_test2.json'), JSON.stringify(wfJson))

  const { code, stdout } = await run(['--dir', runDir])
  ok(code === 0, 'an unjoined transcript does not fail the whole rollup')
  const summary = JSON.parse(stdout.trim())
  ok(Array.isArray(summary.agents) && summary.agents.length === 1 && summary.agents[0].agentId === 'aaa', 'the JOINABLE agent still populates agents normally')
  ok(Array.isArray(summary.agents_unjoined) && summary.agents_unjoined.length === 1, 'the unjoinable transcript is named in agents_unjoined, not silently dropped')
  ok(summary.agents_unjoined[0].agentId === 'ghost', 'agents_unjoined records the orphan transcript\'s agentId')
  ok(summary.agents_unjoined[0].cost_usd === 5, 'agents_unjoined carries that transcript\'s OWN cost_usd (1M input tokens at the $5/MTok opus-5 rate)')
  ok(typeof summary.agents_join === 'string' && /agents_unjoined/.test(summary.agents_join), 'agents_join notes that agents_unjoined has entries')
  await rm(root, { recursive: true })
}

// (j) cache_creation_cost_usd_estimated is computed at 1.25x the model's input rate, labeled as an
// estimate, and NEVER folded into cost_usd_total (that field keeps its existing, non-estimated meaning).
{
  const dir = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-cachecost-'))
  await writeFile(path.join(dir, 'agent-kkk.jsonl'), assistantLine('claude-sonnet-5', { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 1000000 }) + '\n')
  const { code, stdout } = await run(['--dir', dir, '--wf-json', '/nonexistent/wf.json'])
  ok(code === 0, 'a cache-creation-only line does not fail the rollup')
  const summary = JSON.parse(stdout.trim())
  ok(summary.cost_usd_total === 0, 'cache_creation_input_tokens still contributes nothing to cost_usd_total (back-compat)')
  ok(summary.cache_creation_cost_usd_estimated === 2.5, 'the estimate is 1.25x the $2/MTok sonnet-5 input rate over 1M cache-creation tokens')
  ok(summary.cache_creation_pricing === 'estimated 1.25x input; not verified', 'the estimate is labeled literally as unverified')
  await rm(dir, { recursive: true })
}

// The event stream is not widened (BL-0096 Done-when): the script performs no file writes at all —
// it only reads transcripts and prints the ONE summary line to stdout; the caller decides where it
// lands (`.pandacorp/track.jsonl`, never `~/.claude/dashboard-events.ndjson`).
{
  const source = await (await import('node:fs/promises')).readFile(SCRIPT, 'utf8')
  ok(!/writeFileSync|appendFileSync|createWriteStream/.test(source), 'the rollup script never writes to any file — it only reads transcripts and prints to stdout')
}

console.log(`RESULT: ${passed} passed, 0 failed`)
