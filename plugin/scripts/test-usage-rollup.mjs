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
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
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

// The event stream is not widened (BL-0096 Done-when): the script performs no file writes at all —
// it only reads transcripts and prints the ONE summary line to stdout; the caller decides where it
// lands (`.pandacorp/track.jsonl`, never `~/.claude/dashboard-events.ndjson`).
{
  const source = await (await import('node:fs/promises')).readFile(SCRIPT, 'utf8')
  ok(!/writeFileSync|appendFileSync|createWriteStream/.test(source), 'the rollup script never writes to any file — it only reads transcripts and prints to stdout')
}

console.log(`RESULT: ${passed} passed, 0 failed`)
