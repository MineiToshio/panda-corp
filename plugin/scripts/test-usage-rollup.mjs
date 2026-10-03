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
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const SCRIPT = path.join(path.dirname(new URL(import.meta.url).pathname), 'usage-rollup.mjs')

let passed = 0
const ok = (condition, name) => { if (!condition) throw new Error(name); passed++; console.log(`PASS  ${name}`) }

// `messageId` is optional and unset by default (undefined), matching every pre-BL-0181 fixture in this
// file — those exercise call COUNTING/pricing, not the streamed-line dedupe, and must keep counting
// one call per `assistantLine()` invocation. BL-0181's own tests pass it explicitly to model several
// JSONL lines that share one real `message.id`, the shape `dedupeByMessageId` collapses.
const assistantLine = (model, usage, uuid = 'u1', messageId) => JSON.stringify({
  parentUuid: null, isSidechain: true, promptId: 'p1', agentId: 'a1', type: 'assistant',
  message: { model, usage, ...(messageId ? { id: messageId } : {}) }, uuid, timestamp: '2026-09-03T00:00:00Z', userType: 'external',
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
  ok(Array.isArray(summary.cost_excludes) && summary.cost_excludes.length === 0, 'BL-0219: cost_usd_total now prices cache writes, so nothing is excluded from it')
  const haikuNoWrite = (8 * 1 + 36887 * 0.10 + 350 * 5) / 1e6
  const haikuWrite = (20867 + 942) * 2 * 1 / 1e6   // unsplit cache-creation tokens price at the 1-hour tier: 2x the $1/MTok input rate
  ok(Math.abs(summary.models['claude-haiku-4-5-20251001'].cost_usd - (haikuNoWrite + haikuWrite)) < 1e-6, 'BL-0219: per-model cost_usd includes the cache-write term')
  ok(Math.abs(summary.models['claude-haiku-4-5-20251001'].cost_usd_excl_cache_write - haikuNoWrite) < 1e-6, 'BL-0219: cost_usd_excl_cache_write equals the pre-fix figure (comparable with past canaries)')
  ok(summary.skipped_incomplete_lines === 0, 'no incomplete lines in a clean fixture')
  await rm(dir, { recursive: true })
}

// (BL-0181) Claude Code streams ONE billed API response across several JSONL lines (one per content
// block), every line repeating that response's `message.id` with the SAME input/cache tokens but a
// growing `output_tokens` — verified live against a real D2 subagent transcript (docs/proposals/38
// red-team addendum §A1: the rollup's per-line sum reproduced its own reported 58.58 $ on that run to
// the cent; deduplicating by `message.id`, last line wins, gives the true 36.24 $, a 1.62x factor).
// 3 lines sharing one message.id must collapse to ONE call; a second, distinct message.id is a second
// call — never 4.
{
  const dir = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-dedupe-'))
  await writeFile(path.join(dir, 'agent-mmm.jsonl'), [
    assistantLine('claude-sonnet-5', { input_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 1 }, 'u1', 'msg_A'),
    assistantLine('claude-sonnet-5', { input_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 40 }, 'u2', 'msg_A'),
    assistantLine('claude-sonnet-5', { input_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 253 }, 'u3', 'msg_A'),
    assistantLine('claude-sonnet-5', { input_tokens: 8, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 100 }, 'u4', 'msg_B'),
  ].join('\n') + '\n')
  const { code, stdout } = await run(['--dir', dir])
  ok(code === 0, 'BL-0181: a transcript with repeated message.id lines exits 0')
  const summary = JSON.parse(stdout.trim())
  ok(summary.calls_total === 2, 'BL-0181: 3 streamed lines sharing msg_A count as ONE call, plus the distinct msg_B = 2 total (not 4)')
  ok(summary.models['claude-sonnet-5'].calls === 2, 'BL-0181: per-model call count reflects the dedupe, not the raw line count')
  ok(summary.models['claude-sonnet-5'].output_tokens === 353, 'BL-0181: dedupe keeps msg_A\'s LAST (final, complete) output_tokens of 253, not the sum of its 3 partials (1+40+253), plus msg_B\'s 100 = 353')
  ok(summary.models['claude-sonnet-5'].input_tokens === 18, 'BL-0181: msg_A\'s input_tokens (10, identical on all 3 of its lines) is counted ONCE, plus msg_B\'s 8 = 18 (never 10*3+8=38)')
  const expectedCost = Number((18 * 2 / 1e6 + 353 * 10 / 1e6).toFixed(6))
  ok(summary.cost_usd_total === expectedCost, 'BL-0181: cost is computed from the deduplicated totals, not the per-line sum')
  await rm(dir, { recursive: true })
}

// (BL-0181b) A line with NO message.id (a shape never observed live) is conservatively treated as its
// OWN unique message — never merged with anything else, so an id-less line can only be OVER-counted,
// never silently dropped or wrongly collapsed into another call (DR-078 direction).
{
  const dir = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-dedupe-noid-'))
  await writeFile(path.join(dir, 'agent-nnn.jsonl'), [
    assistantLine('claude-sonnet-5', { input_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 1 }),
    assistantLine('claude-sonnet-5', { input_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 1 }),
  ].join('\n') + '\n')
  const { code, stdout } = await run(['--dir', dir])
  ok(code === 0, 'BL-0181b: id-less transcript lines still roll up')
  const summary = JSON.parse(stdout.trim())
  ok(summary.calls_total === 2, 'BL-0181b: two id-less lines are never merged into one call')
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

// (BL-0208 / BL-0210) real tool-call counts, the self-report reconciliation and the per-label cost category.
// Transcript shape verified live 2026-09-30 (wf_d23327e1-6cb): one content block per JSONL line, `tool_use` blocks
// carry `id`/`name`/`input`, the agent's return value is a `StructuredOutput` tool_use, and the wf json's per-agent
// `toolCalls` (the harness ledger) counts that return call too.
const toolLine = (model, messageId, block, usage = { input_tokens: 1000000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }) => JSON.stringify({
  parentUuid: null, isSidechain: true, agentId: 'a1', type: 'assistant', uuid: `u-${messageId}-${block.id || 'b'}`, timestamp: '2026-09-03T00:00:00Z',
  message: { model, id: messageId, role: 'assistant', content: [block], usage },
})
const toolUse = (id, name, input = {}) => ({ type: 'tool_use', id, name, input })
const setupToolRun = async ({ withRepair }) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-tools-'))
  const sessionDir = path.join(root, 'session-t')
  const runDir = path.join(sessionDir, 'subagents', 'workflows', 'wf_tools')
  await mkdir(runDir, { recursive: true })
  await mkdir(path.join(sessionDir, 'workflows'), { recursive: true })
  const sonnet = 'claude-sonnet-5'
  const opus = 'claude-opus-5'
  // the drift finder: 3 work calls (m1 is STREAMED over two lines repeating the same tool_use id — counted once),
  // then its StructuredOutput claiming only 2 calls.
  await writeFile(path.join(runDir, 'agent-fnd.jsonl'), [
    toolLine(sonnet, 'm1', toolUse('t1', 'Read')),
    toolLine(sonnet, 'm1', toolUse('t1', 'Read')),
    toolLine(sonnet, 'm2', toolUse('t2', 'Grep')),
    toolLine(sonnet, 'm3', toolUse('t3', 'Bash')),
    toolLine(sonnet, 'm4', toolUse('t4', 'StructuredOutput', { contracts: [], toolCalls: 2, budgetExhausted: true })),
  ].join('\n') + '\n')
  await writeFile(path.join(runDir, 'agent-gat.jsonl'), toolLine(opus, 'g1', toolUse('g1t', 'Read')) + '\n')
  await writeFile(path.join(runDir, 'agent-lns.jsonl'), toolLine(sonnet, 'l1', toolUse('l1t', 'Read')) + '\n')
  if (withRepair) await writeFile(path.join(runDir, 'agent-rep.jsonl'), [toolLine(opus, 'r1', toolUse('r1t', 'Read')), toolLine(opus, 'r2', toolUse('r2t', 'Edit'))].join('\n') + '\n')
  const wfAgent = (agentId, label, startedAt, durationMs, model, toolCalls) => ({ type: 'workflow_agent', index: 1, label, phaseIndex: 1, phaseTitle: 'Review', agentId, agentType: 'pandacorp:reviewer', model, state: 'done', startedAt, queuedAt: startedAt, durationMs, toolCalls })
  await writeFile(path.join(sessionDir, 'workflows', 'wf_tools.json'), JSON.stringify({
    runId: 'wf_tools',
    workflowProgress: [
      { type: 'workflow_phase', index: 1, title: 'Review' },
      wfAgent('fnd', 'find:drift:frd-04', 0, 2000, sonnet, 4),
      wfAgent('gat', 'gate:frd-02', 0, 3000, opus, 1),
      wfAgent('lns', 'find:correctness:frd-02', 0, 1000, sonnet, 1),
      ...(withRepair ? [wfAgent('rep', 'gate-test-repair:frd-02', 3000, 4000, opus, 2)] : []),
    ],
  }))
  return { root, runDir }
}
{
  const { root, runDir } = await setupToolRun({ withRepair: true })
  const { code, stdout } = await run(['--dir', runDir])
  ok(code === 0, 'BL-0208/0210: a run dir with tool_use blocks and a gate-test-repair agent exits 0')
  const summary = JSON.parse(stdout.trim())
  const byId = Object.fromEntries(summary.agents.map((a) => [a.agentId, a]))
  ok(byId.fnd.tool_calls === 3, 'BL-0208: the REAL tool-call count is the distinct tool_use ids in the transcript (a streamed repeat line and the StructuredOutput return call are not counted)')
  ok(byId.fnd.tool_calls_harness === 4, "BL-0208: the harness's own ledger (wf json toolCalls, which includes the return call) is reported beside it")
  ok(byId.fnd.tool_calls_self_reported === 2 && byId.fnd.tool_calls_undercount_pct === 33.333333, 'BL-0208: the finder self-report (2) is kept only as a reconciled claim and its undercount vs the real count (3) is measured')
  ok(byId.gat.tool_calls === 1 && !('tool_calls_self_reported' in byId.gat), 'BL-0208: an agent that self-reports nothing gets no self-report fields, only the real count')
  ok(summary.by_category['gate-test-repair'].agents === 1 && summary.by_category['gate-test-repair'].cost_usd === 10 && summary.by_category['gate-test-repair'].tool_calls === 2, 'BL-0210: gate-test-repair is its OWN cost category (2 opus calls x $5), not folded into the Review phase')
  ok(summary.by_category.gate.cost_usd === 5 && summary.by_category['find:drift'].agents === 1 && summary.by_category.find.agents === 1, 'BL-0210: gate / find:drift / find (split lens) are separate categories')
  ok(summary.by_phase.Review.cost_usd === summary.by_category.gate.cost_usd + summary.by_category['gate-test-repair'].cost_usd + summary.by_category['find:drift'].cost_usd + summary.by_category.find.cost_usd, 'BL-0210: the categories partition the phase (by_phase is unchanged and still equals their sum)')
  ok(summary.gate_test_repair.fired === true && summary.gate_test_repair.frds.join(',') === 'frd-02' && summary.gate_test_repair.cost_usd === 10 && summary.gate_test_repair.duration_s === 4, 'BL-0210: the explicit gate_test_repair block names the FRD and its cost/time for the canary table')
  await rm(root, { recursive: true })
}
{
  const { root, runDir } = await setupToolRun({ withRepair: false })
  const { stdout } = await run(['--dir', runDir])
  const summary = JSON.parse(stdout.trim())
  ok(summary.gate_test_repair.fired === false && summary.gate_test_repair.agents === 0 && summary.gate_test_repair.cost_usd === 0 && !('gate-test-repair' in summary.by_category), 'BL-0210: a run where it did NOT fire says so explicitly (fired:false), so both sides of a comparison state it')
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

// (j) BL-0219: cache-WRITE tokens are priced into cost_usd_total. Claude Code writes the 1-hour TTL tier (2x input;
// the 5-minute tier is 1.25x), so a line with no per-tier split prices at 2x, and a line carrying
// `usage.cache_creation.{ephemeral_5m,ephemeral_1h}_input_tokens` prices each tier at its own rate. The pre-fix figure
// survives as `cost_usd_excl_cache_write` so a new run stays comparable with every earlier canary.
{
  const dir = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-cachecost-'))
  await writeFile(path.join(dir, 'agent-kkk.jsonl'), assistantLine('claude-sonnet-5', { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 1000000 }) + '\n')
  const { code, stdout } = await run(['--dir', dir, '--wf-json', '/nonexistent/wf.json'])
  ok(code === 0, 'a cache-creation-only line does not fail the rollup')
  const summary = JSON.parse(stdout.trim())
  ok(summary.cost_usd_total === 4, 'BL-0219: 1M unsplit cache-creation tokens price at 2x the $2/MTok sonnet-5 input rate (1-hour tier)')
  ok(summary.cost_usd_excl_cache_write === 0, 'BL-0219: cost_usd_excl_cache_write keeps the old meaning (cache writes contribute nothing)')
  ok(summary.cache_creation_cost_usd === 4 && summary.cost_usd_total === summary.cost_usd_excl_cache_write + summary.cache_creation_cost_usd, 'BL-0219: cache_creation_cost_usd is the exact difference between the two totals')
  ok(typeof summary.cache_creation_pricing === 'string' && /1h/.test(summary.cache_creation_pricing) && !('cache_creation_cost_usd_estimated' in summary), 'BL-0219: the unverified 1.25x estimate is replaced by the priced term')
  await rm(dir, { recursive: true })
}

// (j2) BL-0219: a per-tier split in the transcript is honoured (400k 5-minute at 1.25x + 600k 1-hour at 2x, $2/MTok).
{
  const dir = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-cachetier-'))
  const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 1000000, cache_creation: { ephemeral_5m_input_tokens: 400000, ephemeral_1h_input_tokens: 600000 } }
  await writeFile(path.join(dir, 'agent-lll.jsonl'), assistantLine('claude-sonnet-5', usage) + '\n')
  const { code, stdout } = await run(['--dir', dir, '--wf-json', '/nonexistent/wf.json'])
  ok(code === 0, 'a tiered cache-creation line rolls up')
  const summary = JSON.parse(stdout.trim())
  ok(Math.abs(summary.cost_usd_total - 3.4) < 1e-9, 'BL-0219: 400k 5m x 1.25 + 600k 1h x 2 over a $2/MTok input = 3.4')
  await rm(dir, { recursive: true })
}

// (j3) BL-0219: reproduces the headless CLI's own `total_cost_usd` for bench run B-4 (sonnet-5-5: in 24 / out 17,215 /
// cacheRead 708,699 / cacheWrite 79,366 = 0.631 USD), the evidence that the write rate is the 1-hour 2x tier.
{
  const dir = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-b4-'))
  await writeFile(path.join(dir, 'agent-mmm.jsonl'), assistantLine('claude-sonnet-5-5', { input_tokens: 24, output_tokens: 17215, cache_read_input_tokens: 708699, cache_creation_input_tokens: 79366 }) + '\n')
  const { stdout } = await run(['--dir', dir, '--wf-json', '/nonexistent/wf.json'])
  const summary = JSON.parse(stdout.trim())
  ok(Number(summary.cost_usd_total.toFixed(3)) === 0.631, 'BL-0219: the B-4 token counts price to the CLI-reported 0.631 USD')
  ok(Number(summary.cost_usd_excl_cache_write.toFixed(3)) === 0.314, 'BL-0219: and the old figure (no cache write) is 0.314')
  await rm(dir, { recursive: true })
}

// (j4) BL-0219: the joined per-agent rows and the phase rollup carry the priced figure too, so by_phase still sums to the total.
{
  const root = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-cacheagent-'))
  const runDir = path.join(root, 'sess', 'subagents', 'workflows', 'wf_cw')
  await mkdir(runDir, { recursive: true })
  await mkdir(path.join(root, 'sess', 'workflows'), { recursive: true })
  await writeFile(path.join(runDir, 'agent-nnn.jsonl'), assistantLine('claude-sonnet-5', { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 1000000 }) + '\n')
  await writeFile(path.join(root, 'sess', 'workflows', 'wf_cw.json'), JSON.stringify({ workflowProgress: [{ type: 'workflow_agent', agentId: 'nnn', label: 'Build', phaseTitle: 'Build', startedAt: 1000, durationMs: 1000, agentType: 'general-purpose', model: 'sonnet' }] }))
  const { code, stdout } = await run(['--dir', runDir])
  ok(code === 0, 'a joined run with cache writes rolls up')
  const summary = JSON.parse(stdout.trim())
  ok(summary.agents[0].cost_usd === 4 && summary.agents[0].cost_usd_excl_cache_write === 0, 'BL-0219: the agent row prices its cache writes and keeps the comparable excl figure')
  ok(summary.by_phase.Build.cost_usd === 4 && summary.cost_usd_total === 4, 'BL-0219: by_phase and the total agree')
  await rm(root, { recursive: true })
}

// The event stream is not widened (BL-0096 Done-when): --dir mode performs no file writes at all —
// it only reads transcripts and prints the ONE summary line to stdout. F5's --session mode adds
// exactly ONE deliberate, opt-in exception (`--out`, proven dry-run-by-default in the F5 section
// below) — so the ban narrows to "no unconditional write", not "no write function anywhere in the
// file", and the caller still decides where any write lands (never `~/.claude/dashboard-events.ndjson`).
{
  const source = await (await import('node:fs/promises')).readFile(SCRIPT, 'utf8')
  ok(/appendFileSync/.test(source), 'the ONE write path (appendFileSync, gated behind --out) is present')
  ok(!/writeFileSync|createWriteStream/.test(source), 'no OTHER write primitive is ever used — appendFileSync behind --out is the single opt-in exception')
}

// ============================================================================================
// F5 (docs/proposals/37 §A.7/§4.1 J1-13): --session per-change rollup.
// ============================================================================================

const assistantLineAt = (model, usage, timestamp, uuid = 'u1') => JSON.stringify({
  parentUuid: null, isSidechain: false, promptId: 'p1', type: 'assistant',
  message: { model, usage }, uuid, timestamp, userType: 'external',
  entrypoint: 'cli', cwd: '/tmp', sessionId: 's1', version: '1.0.0', gitBranch: 'main',
})

// (F5-a) A session with 3 in-window calls of its own, plus a flat subagent whose OWN calls straddle
// the window (one inside, one outside — only the inside one counts), plus a SECOND flat subagent
// entirely outside the window (contributes nothing, and does not count toward `subagents`).
{
  const root = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-session-'))
  const sessionPath = path.join(root, 'sess1.jsonl')
  await writeFile(sessionPath, [
    assistantLineAt('claude-sonnet-5', { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, '2026-09-11T10:10:00Z', 'm1'),
    assistantLineAt('claude-sonnet-5', { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, '2026-09-11T10:20:00Z', 'm2'),
    assistantLineAt('claude-sonnet-5', { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, '2026-09-11T10:30:00Z', 'm3'),
  ].join('\n') + '\n')
  const subagentsDir = path.join(root, 'sess1', 'subagents')
  await mkdir(subagentsDir, { recursive: true })
  await writeFile(path.join(subagentsDir, 'agent-in.jsonl'), assistantLineAt('claude-opus-5', { input_tokens: 1000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, '2026-09-11T10:15:00Z', 'a1') + '\n')
  await writeFile(path.join(subagentsDir, 'agent-out.jsonl'), assistantLineAt('claude-opus-5', { input_tokens: 999999, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, '2026-09-11T12:00:00Z', 'a2') + '\n')
  await writeFile(path.join(subagentsDir, 'agent-in.meta.json'), '{ this is not valid JSONL and would throw if ever read')

  const { code, stdout } = await run(['--session', sessionPath, '--window', '2026-09-11T10:00:00Z..2026-09-11T11:00:00Z'])
  ok(code === 0, 'F5-a: a session + in-window subagent exits 0')
  const summary = JSON.parse(stdout.trim())
  ok(summary.kind === 'change_usage', 'F5-a: kind is change_usage')
  ok(summary.calls === 4, 'F5-a: counts the session\'s 3 calls plus the ONE in-window subagent call (out-of-window subagent excluded)')
  ok(summary.subagents === 1, 'F5-a: subagents counts only the file that actually contributed an in-window call')
  const expectedCost = round3((300 * 2 + 30 * 10 + 1000 * 5) / 1e6)
  ok(Math.abs(summary.cost_usd_total - expectedCost) < 1e-6, `F5-a: cost sums session sonnet-5 calls + the in-window opus-5 subagent call (expected ${expectedCost}, got ${summary.cost_usd_total})`)
  ok(summary.context_avg_tokens_per_call === round3((300 + 1000) / 4), 'F5-a: context_avg_tokens_per_call = (input+cache_read+cache_creation)/calls — output_tokens is NOT context')
  ok(summary.window_source === 'explicit', 'F5-a: window_source records an explicit --window')
  await rm(root, { recursive: true })
}
function round3(n) { return Math.round(n * 1e6) / 1e6 }

// (F5-b) --commits derives the window from two real commits' committer dates in a temp git repo.
{
  const root = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-commits-'))
  const repo = path.join(root, 'repo')
  await mkdir(repo, { recursive: true })
  const git = (args, env = {}) => exec('git', ['-C', repo, ...args], { env: { ...process.env, ...env } })
  await git(['init', '-q'])
  await git(['config', 'user.email', 'test@example.com'])
  await git(['config', 'user.name', 'Test'])
  await writeFile(path.join(repo, 'a.txt'), 'one')
  await git(['add', 'a.txt'])
  await git(['commit', '-q', '-m', 'first'], { GIT_AUTHOR_DATE: '2026-09-11T10:00:00Z', GIT_COMMITTER_DATE: '2026-09-11T10:00:00Z' })
  const { stdout: sha1out } = await git(['rev-parse', 'HEAD'])
  const sha1 = sha1out.trim()
  await writeFile(path.join(repo, 'a.txt'), 'two')
  await git(['add', 'a.txt'])
  await git(['commit', '-q', '-m', 'second'], { GIT_AUTHOR_DATE: '2026-09-11T11:00:00Z', GIT_COMMITTER_DATE: '2026-09-11T11:00:00Z' })
  const { stdout: sha2out } = await git(['rev-parse', 'HEAD'])
  const sha2 = sha2out.trim()

  const sessionPath = path.join(root, 'sess2.jsonl')
  await writeFile(sessionPath, [
    assistantLineAt('claude-sonnet-5', { input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, '2026-09-11T10:30:00Z', 'w1'),   // inside [10:00,11:00]
    assistantLineAt('claude-sonnet-5', { input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, '2026-09-11T09:00:00Z', 'w2'),   // outside, before
  ].join('\n') + '\n')

  const { code, stdout } = await run(['--session', sessionPath, '--commits', `${sha1}..${sha2}`, '--repo', repo])
  ok(code === 0, 'F5-b: --commits against a real temp git repo exits 0')
  const summary = JSON.parse(stdout.trim())
  ok(summary.window_source === 'commits', 'F5-b: window_source records a --commits-derived window')
  ok(summary.window.start === '2026-09-11T10:00:00Z' && summary.window.end === '2026-09-11T11:00:00Z', 'F5-b: window is derived from the two commits\' own committer dates')
  ok(summary.calls === 1, 'F5-b: only the call inside the derived window counts')
  await rm(root, { recursive: true })
}

// (F5-c) A corrupted --session transcript fails LOUD (DR-078) — never a silent empty/zero rollup.
{
  const root = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-session-bad-'))
  const sessionPath = path.join(root, 'sess3.jsonl')
  await writeFile(sessionPath, [
    assistantLineAt('claude-sonnet-5', { input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, '2026-09-11T10:00:00Z'),
    '{ this line is not valid JSON and is NOT the last line',
    userLine(),
  ].join('\n') + '\n')
  const { code, stdout, stderr } = await run(['--session', sessionPath])
  ok(code !== 0, 'F5-c: a corrupted session transcript fails loud')
  ok(stdout.trim() === '', 'F5-c: no summary line is printed on a corrupted session')
  ok(/ERROR/.test(stderr) && /malformed transcript line/.test(stderr), 'F5-c: the failure names the malformed-transcript-line cause')
  await rm(root, { recursive: true })
}

// (F5-d) A window with zero matching calls is tolerated: calls:0 + an explicit note, exit 0 — never
// a hard failure and never silently indistinguishable from "the reader couldn't parse the shape".
{
  const root = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-session-empty-'))
  const sessionPath = path.join(root, 'sess4.jsonl')
  await writeFile(sessionPath, assistantLineAt('claude-sonnet-5', { input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, '2026-09-11T10:00:00Z') + '\n')
  const { code, stdout } = await run(['--session', sessionPath, '--window', '2026-01-01T00:00:00Z..2026-01-02T00:00:00Z'])
  ok(code === 0, 'F5-d: a window with zero matches does not fail the run')
  const summary = JSON.parse(stdout.trim())
  ok(summary.calls === 0, 'F5-d: calls is 0, not omitted or thrown')
  ok(summary.note === 'no calls found in window', 'F5-d: an explicit note names the empty-window shape (DR-078)')
  ok(summary.cost_usd_total === 0, 'F5-d: cost is a real, honest zero')
  await rm(root, { recursive: true })
}

// (F5-e) --out appends exactly one valid change_usage line to track.jsonl and touches nothing else;
// omitting --out (the default) never writes any file (proven above by (F5-a)/(F5-b)/(F5-d) which all
// ran without --out).
{
  const root = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-session-out-'))
  const sessionPath = path.join(root, 'sess5.jsonl')
  await writeFile(sessionPath, assistantLineAt('claude-sonnet-5', { input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, '2026-09-11T10:00:00Z') + '\n')
  const trackPath = path.join(root, 'track.jsonl')
  const preexisting = '{"kind":"frd_end","frd":"frd-99-unrelated","at":"2026-01-01T00:00:00Z"}\n'
  await writeFile(trackPath, preexisting)

  const { code, stdout } = await run(['--session', sessionPath, '--out', trackPath])
  ok(code === 0, 'F5-e: --out exits 0')
  const printed = JSON.parse(stdout.trim())
  ok(printed.kind === 'change_usage', 'F5-e: stdout still prints the same change_usage summary')

  const trackContent = await (await import('node:fs/promises')).readFile(trackPath, 'utf8')
  const trackLines = trackContent.trim().split('\n')
  ok(trackLines.length === 2, 'F5-e: exactly ONE new line was appended — the pre-existing line is untouched')
  ok(trackLines[0] === preexisting.trim(), 'F5-e: the pre-existing track.jsonl line is byte-identical, never rewritten')
  const appended = JSON.parse(trackLines[1])
  ok(appended.kind === 'change_usage' && appended.calls === 1, 'F5-e: the appended line is a valid change_usage record matching stdout')
  await rm(root, { recursive: true })
}

// (F5-f) --card reads a change-card's `rigor:` frontmatter line; a card without one yet reports
// rigor: null (a real, expected shape — the field is still only a proposal), never an error.
{
  const root = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-session-card-'))
  const sessionPath = path.join(root, 'sess6.jsonl')
  await writeFile(sessionPath, assistantLineAt('claude-sonnet-5', { input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, '2026-09-11T10:00:00Z') + '\n')
  const cardPath = path.join(root, 'card.md')
  await writeFile(cardPath, '---\ntype: change\nrigor: L1\n---\n\n# A change\n')
  const { code, stdout } = await run(['--session', sessionPath, '--card', cardPath])
  ok(code === 0, 'F5-f: --card exits 0')
  const summary = JSON.parse(stdout.trim())
  ok(summary.rigor === 'L1', 'F5-f: rigor is read from the card\'s frontmatter')

  const cardNoRigor = path.join(root, 'card-norigor.md')
  await writeFile(cardNoRigor, '---\ntype: change\n---\n\n# Another change\n')
  const { stdout: stdout2 } = await run(['--session', sessionPath, '--card', cardNoRigor])
  const summary2 = JSON.parse(stdout2.trim())
  ok(summary2.rigor === null, 'F5-f: a card with no rigor: line yet reports null, not an error')
  await rm(root, { recursive: true })
}

// ── REV3 (independent review of the speed sprint, batch 3 — 2026-09-22) ───────────────────────

// (REV3-K) `--out` must never corrupt the file it appends to. `.pandacorp/track.jsonl` is written
// by several producers; a run killed mid-write leaves a last line with NO trailing newline, and a
// bare appendFileSync then welds the new record onto it — one unparseable line, and every reader
// of the timeline (Mission Control's DAG/timeline, the close-out rollup) fails loud on it. The
// only safe append is one that normalises the boundary first.
{
  const root = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-rev3k-'))
  const sessionPath = path.join(root, 'sess-rev3k.jsonl')
  await writeFile(sessionPath, assistantLineAt('claude-sonnet-5', { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, '2026-09-22T10:00:00Z') + '\n')
  const track = path.join(root, 'track.jsonl')
  // A producer that died mid-write: a complete record, then NO trailing newline.
  await writeFile(track, '{"kind":"wo_done","wo":"wo-01-001"}')
  const { code } = await run(['--session', sessionPath, '--out', track])
  ok(code === 0, 'REV3-K: --out onto a newline-less track.jsonl still exits 0')
  const lines = (await readFile(track, 'utf8')).split('\n').filter((l) => l.trim())
  let allParse = true
  for (const line of lines) { try { JSON.parse(line) } catch { allParse = false } }
  ok(allParse && lines.length === 2,
    'REV3-K: --out preserves track.jsonl as valid NDJSON when the last line lacks a trailing newline')
  await rm(root, { recursive: true })
}

// (REV3-L) A build run's own transcripts live one level DEEPER
// (`<session>/subagents/workflows/wf_<id>/agent-*.jsonl`) and already get their own `usage_summary`
// from `--dir`. `--session` must be blind to them, or every build's cost is counted twice: once
// under the run and once under the session that launched it. Asserted by CONSTRUCTION here — a
// nested run whose single call is 100x the session's own, so a double count is unmissable.
{
  const root = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-rev3l-'))
  const sessionPath = path.join(root, 'sess-rev3l.jsonl')
  await writeFile(sessionPath, assistantLineAt('claude-sonnet-5', { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, '2026-09-22T10:00:00Z') + '\n')
  const flat = path.join(root, 'sess-rev3l', 'subagents')
  await mkdir(flat, { recursive: true })
  await writeFile(path.join(flat, 'agent-flat.jsonl'), assistantLineAt('claude-sonnet-5', { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, '2026-09-22T10:05:00Z') + '\n')
  const nested = path.join(flat, 'workflows', 'wf_rev3l')
  await mkdir(nested, { recursive: true })
  await writeFile(path.join(nested, 'agent-build-1.jsonl'), assistantLineAt('claude-opus-5', { input_tokens: 10000, output_tokens: 1000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, '2026-09-22T10:06:00Z') + '\n')
  const { code, stdout } = await run(['--session', sessionPath])
  ok(code === 0, 'REV3-L: a session with a nested build run exits 0')
  const summary = JSON.parse(stdout.trim())
  ok(summary.calls === 2, `REV3-L: only the session's own call + its FLAT subagent count — a nested build run is invisible (got ${summary.calls})`)
  ok(summary.subagents === 1, 'REV3-L: subagents counts the flat transcript only, never the nested run')
  ok(!Object.keys(summary.models).includes('claude-opus-5'), 'REV3-L: the nested build run\'s model never appears in the session rollup (no double count)')
  await rm(root, { recursive: true })
}

// (REV3-M) `--window` and `--commits` are mutually exclusive: silently honouring one while
// ignoring the other would produce a rollup whose window is not the one the caller asked for.
{
  const root = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-rev3m-'))
  const sessionPath = path.join(root, 'sess-rev3m.jsonl')
  await writeFile(sessionPath, assistantLineAt('claude-sonnet-5', { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, '2026-09-22T10:00:00Z') + '\n')
  const { code, stdout } = await run(['--session', sessionPath, '--window', '2026-09-22T00:00:00Z..2026-09-23T00:00:00Z', '--commits', 'a..b', '--repo', root])
  ok(code !== 0, 'REV3-M: passing both --window and --commits fails loud')
  ok(stdout.trim() === '', 'REV3-M: no summary line is printed when the window is ambiguous')
  await rm(root, { recursive: true })
}

// (REV3-N) An `--out` that cannot be written must FAIL, not print a summary that implies the
// record was persisted. The caller (close-out) reads exit status, and a "cost recorded" line that
// never landed is the CONV-13 failure mode this whole script exists to avoid.
{
  const root = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-rev3n-'))
  const sessionPath = path.join(root, 'sess-rev3n.jsonl')
  await writeFile(sessionPath, assistantLineAt('claude-sonnet-5', { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, '2026-09-22T10:00:00Z') + '\n')
  const { code, stdout } = await run(['--session', sessionPath, '--out', path.join(root, 'no', 'such', 'dir', 'track.jsonl')])
  ok(code !== 0, 'REV3-N: an unwritable --out fails loud')
  ok(stdout.trim() === '', 'REV3-N: no summary line is printed when the record could not be persisted')
  await rm(root, { recursive: true })
}

// (BL-0156a) `claude-opus-5-5` — the real model id canary B2 saw stamped on 4 of its opus agents
// (gate/patch/baseline/plan) — was missing from PRICING, so a real B2-shaped rollup silently priced
// its 4 most expensive agents at cost_usd: null instead of failing loud or pricing them (canary-b2-
// report.md §"Bug de precio descubierto"). Priced the same as `claude-opus-5` (same $5/$25/$0.50 MTok
// family) until a dated snapshot proves otherwise — never left unpriced by omission.
{
  const dir = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-opus55-'))
  await writeFile(path.join(dir, 'agent-ggg.jsonl'), assistantLine('claude-opus-5-5', { input_tokens: 1000000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }) + '\n')
  const { code, stdout } = await run(['--dir', dir])
  ok(code === 0, 'BL-0156a: a claude-opus-5-5 transcript does not fail')
  const summary = JSON.parse(stdout.trim())
  ok(summary.models['claude-opus-5-5'].cost_usd === 5, 'BL-0156a: claude-opus-5-5 prices at the same $5/MTok input rate as claude-opus-5, not null')
  ok(summary.unpriced_models.length === 0, 'BL-0156a: claude-opus-5-5 is no longer reported as unpriced')
  await rm(dir, { recursive: true })
}

// `claude-sonnet-5-5` — same omission class as opus-5-5 above; priced like `claude-sonnet-5` ($2/$10/$0.20 MTok)
// until a dated snapshot proves otherwise, never left unpriced by omission.
{
  const dir = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-sonnet55-'))
  await writeFile(path.join(dir, 'agent-hhh.jsonl'), assistantLine('claude-sonnet-5-5', { input_tokens: 1000000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }) + '\n')
  const { code, stdout } = await run(['--dir', dir])
  ok(code === 0, 'a claude-sonnet-5-5 transcript does not fail')
  const summary = JSON.parse(stdout.trim())
  ok(summary.models['claude-sonnet-5-5'].cost_usd === 2, 'claude-sonnet-5-5 prices at the same $2/MTok input rate as claude-sonnet-5, not null')
  ok(summary.unpriced_models.length === 0, 'claude-sonnet-5-5 is not reported as unpriced')
  await rm(dir, { recursive: true })
}

// (BL-0156b) `--dir` mode used to silently accept `--out` and drop it — `runDirMode`'s destructured
// params never included `out`, so the flag was parsed but never wired to a write (confirmed live:
// exit 0, a summary printed to stdout, track.jsonl untouched — canary-b2-report.md's flagged task #2,
// a DR-078 violation: an accepted flag that doesn't do what it says). It must now actually append the
// summary, the same idiom `--session --out` already had.
{
  const dir = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-dir-out-'))
  await writeFile(path.join(dir, 'agent-hhh.jsonl'), assistantLine('claude-sonnet-5', { input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }) + '\n')
  const trackPath = path.join(dir, 'track.jsonl')
  const preexisting = '{"kind":"frd_end","frd":"frd-99-unrelated","at":"2026-01-01T00:00:00Z"}\n'
  await writeFile(trackPath, preexisting)

  const { code, stdout } = await run(['--dir', dir, '--out', trackPath])
  ok(code === 0, 'BL-0156b: --dir with --out exits 0')
  const printed = JSON.parse(stdout.trim())
  ok(printed.kind === 'usage_summary', 'BL-0156b: stdout still prints the usage_summary')

  const trackContent = await readFile(trackPath, 'utf8')
  const trackLines = trackContent.trim().split('\n')
  ok(trackLines.length === 2, 'BL-0156b: exactly ONE new line was appended to track.jsonl')
  ok(trackLines[0] === preexisting.trim(), 'BL-0156b: the pre-existing line is untouched')
  const appended = JSON.parse(trackLines[1])
  ok(appended.kind === 'usage_summary' && appended.calls_total === 1, 'BL-0156b: the appended line is a valid usage_summary matching stdout')
  await rm(dir, { recursive: true })
}

// (BL-0156c) `--dir` with an unwritable `--out` must fail LOUD (same discipline as REV3-N for
// `--session`) — never a summary that implies the record was persisted when it wasn't.
{
  const dir = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-dir-out-fail-'))
  await writeFile(path.join(dir, 'agent-iii.jsonl'), assistantLine('claude-sonnet-5', { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }) + '\n')
  const { code, stdout } = await run(['--dir', dir, '--out', path.join(dir, 'no', 'such', 'dir', 'track.jsonl')])
  ok(code !== 0, 'BL-0156c: an unwritable --out in --dir mode fails loud')
  ok(stdout.trim() === '', 'BL-0156c: no summary line is printed when the record could not be persisted')
  await rm(dir, { recursive: true })
}

// (j5) BL-0219: --session mode prices cache writes the same way.
{
  const root = await mkdtemp(path.join(os.tmpdir(), 'usage-rollup-cachesession-'))
  const sessionPath = path.join(root, 'sess1.jsonl')
  await writeFile(sessionPath, assistantLineAt('claude-sonnet-5', { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 1000000 }, '2026-09-22T10:00:00Z') + '\n')
  const { code, stdout } = await run(['--session', sessionPath])
  ok(code === 0, 'a session with cache writes rolls up')
  const summary = JSON.parse(stdout.trim())
  ok(summary.cost_usd_total === 4 && summary.cost_usd_excl_cache_write === 0 && summary.cost_excludes.length === 0, 'BL-0219: --session prices cache writes and keeps the excl figure')
  await rm(root, { recursive: true })
}

console.log(`RESULT: ${passed} passed, 0 failed`)
