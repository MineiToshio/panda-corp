#!/usr/bin/env node
// test-build-mech-lanes.mjs — proposal 40 Phase B (lanes): git-fixture tests of the lane ops of pandacorp-build-mech.mjs
// (lane-pool, lane-plan, lane-dispatch, lane-mark, land-chain, lane-bisect). Every scenario builds a real repository with
// the project NESTED under `proj/` (the Mission Control shape), real linked lane worktrees, and builds work orders in a
// lane with the real `commit-wo` op. The oracle is git (main's history, its files, the lane branches) — never the
// receipt alone — and every receipt must carry a valid integrity seal.

import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifySealedLine } from './drift-seal.mjs'
import { mergeJson3 } from './build-mech-lane-land.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(__dirname, 'pandacorp-build-mech.mjs')
const TEMPLATE_PW = path.join(__dirname, '..', 'templates', 'stack-a-nextjs', 'e2e', 'playwright.config.ts')

let passed = 0
let failed = 0
const ok = (cond, msg) => { if (cond) { passed++; console.log(`  ✓ ${msg}`) } else { failed++; console.log(`  ✗ ${msg}`) } }

const FAKE_TOOL = '#!/bin/sh\necho "$(basename "$0") $*" >> "$LANE_TOOL_LOG"\ncase " $FAIL_TOOLS " in *" $(basename "$0") "*) exit 1;; esac\nexit 0\n'
const BOOTSTRAP = '#!/bin/sh\nsleep "${BOOT_SLEEP:-0}"\n[ -n "$BOOT_FAIL" ] && { echo "npm ci: network unreachable"; exit 1; }\nmkdir -p node_modules/.bin .pandacorp/run\necho "${PANDACORP_LANE:-none} ${PANDACORP_E2E_PORT:-none}" >> "$BOOT_LOG"\nfor t in tsc biome vitest; do cp "$FAKE_TOOL" node_modules/.bin/$t; chmod +x node_modules/.bin/$t; done\n'
const VERIFY = '#!/bin/sh\nmkdir -p .pandacorp/run\nsha=$(git rev-parse HEAD)\nif [ -f src/bad.ts ]; then printf \'{"sha":"%s","green":false,"scope":"full","subgates":[{"name":"vitest","exit":1,"failures":["src/bad.ts: bad"]}]}\' "$sha" > .pandacorp/run/gate-report.json; echo "bad.ts present"; exit 1; fi\nprintf \'{"sha":"%s","green":true,"scope":"full","subgates":[]}\' "$sha" > .pandacorp/run/gate-report.json\nexit 0\n'
const woMd = (id, { deps = [], artifacts = [], status = 'PLANNED' } = {}) => `---\nid: ${id}\ntype: work-order\nslug: ${id.toLowerCase()}\nimplementation_status: ${status}\nreopen_count: 0\ndependsOn: [${deps.join(', ')}]\nartifacts: [${artifacts.join(', ')}]\ntests: none\ntests_reason: lane fixture\n---\n# ${id}\n\n## Status Note\n`
const woRel = (frd, id) => `docs/frds/${frd}/work-orders/${id.toLowerCase()}-x.md`

function mkRepo(wos) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'lanes-'))
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'lanes-scratch-'))
  const gitAt = (cwd) => (...args) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`)
    return r.stdout.trim()
  }
  const git = gitAt(root)
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 't@example.com')
  git('config', 'user.name', 'T')
  git('config', 'commit.gpgsign', 'false')
  const proj = path.join(root, 'proj')
  const writeAt = (base) => (rel, content) => { mkdirSync(path.dirname(path.join(base, rel)), { recursive: true }); writeFileSync(path.join(base, rel), content) }
  const write = writeAt(proj)
  const read = (rel, base = proj) => (existsSync(path.join(base, rel)) ? readFileSync(path.join(base, rel), 'utf8') : null)
  writeFileSync(path.join(root, 'factory.txt'), 'factory root file\n')
  write('.gitignore', 'node_modules/\n.pandacorp/run/\n')
  write('.pandacorp/status.yaml', 'phase: implementation\n')
  write('.pandacorp/track.jsonl', '{"kind":"start"}\n')
  write('.pandacorp/worktree-bootstrap.sh', BOOTSTRAP)
  write('.pandacorp/verify.sh', VERIFY)
  write('tsconfig.json', '{}\n')
  write('messages/en.json', '{\n  "title": "T"\n}\n')
  for (const w of wos) write(woRel(w.frd, w.id), woMd(w.id, w))
  git('add', '-A')
  git('commit', '-q', '-m', 'chore: init project')
  const fakeTool = path.join(scratch, 'fake-tool.sh')
  writeFileSync(fakeTool, FAKE_TOOL)
  chmodSync(fakeTool, 0o755)
  const toolLog = path.join(scratch, 'tools.log')
  const bootLog = path.join(scratch, 'boot.log')
  const events = path.join(scratch, 'events.ndjson')
  const portBase = String(20000 + Math.floor(Math.random() * 400) * 100)
  const baseEnv = { FAKE_TOOL: fakeTool, LANE_TOOL_LOG: toolLog, BOOT_LOG: bootLog, PANDACORP_LANE_PORT_BASE: portBase, FAIL_TOOLS: '' }
  const runIn = (project, op, args = [], env = {}) => {
    const evArgs = op === 'commit-wo' ? ['--events', events] : []
    const r = spawnSync(process.execPath, [SCRIPT, op, '--project', project, ...args, ...evArgs], { cwd: root, encoding: 'utf8', env: { ...process.env, ...baseEnv, ...env } })
    const line = (r.stdout || '').trim().split('\n').pop() || ''
    let receipt = null
    try { receipt = JSON.parse(line) } catch { receipt = null }
    return { code: r.status, receipt: receipt || {}, sealed: verifySealedLine(line).ok, stderr: r.stderr, line }
  }
  const run = (op, args, env) => runIn(proj, op, args, env)
  const laneProj = (n) => path.join(proj, '.pandacorp', 'run', 'lanes', `lane-${n}`, 'proj')
  /** Build work orders in a lane: write their artifacts, then the real commit-wo there. */
  const buildIn = (n, id, files) => {
    for (const [rel, content] of Object.entries(files)) writeAt(laneProj(n))(rel, content)
    return runIn(laneProj(n), 'commit-wo', ['--wo', id, '--files', Object.keys(files).join(',')])
  }
  /** Commit on main the way a barrier/other writer does (outside the lanes). */
  const commitMain = (files, msg) => { for (const [rel, content] of Object.entries(files)) write(rel, content); git('add', '-A'); git('commit', '-q', '-m', msg) }
  const subjects = () => git('log', '--format=%s', 'main').split('\n')
  const toolCalls = () => (existsSync(toolLog) ? readFileSync(toolLog, 'utf8').trim().split('\n').filter(Boolean) : [])
  const bootCalls = () => (existsSync(bootLog) ? readFileSync(bootLog, 'utf8').trim().split('\n').filter(Boolean) : [])
  const cleanup = () => {
    spawnSync('git', ['worktree', 'prune'], { cwd: root })
    rmSync(root, { recursive: true, force: true })
    rmSync(scratch, { recursive: true, force: true })
  }
  /** The op run in the background (its own process), resolved with the same shape as run(). */
  const runBg = (op, args = [], env = {}) => new Promise((resolve) => {
    const p = spawn(process.execPath, [SCRIPT, op, '--project', proj, ...args], { cwd: root, env: { ...process.env, ...baseEnv, ...env } })
    let out = ''
    p.stdout.on('data', (b) => { out += b })
    p.on('close', (code) => { const line = out.trim().split('\n').pop() || ''; let receipt = null; try { receipt = JSON.parse(line) } catch { receipt = null } resolve({ code, receipt: receipt || {}, sealed: verifySealedLine(line).ok, line }) })
  })
  return { root, proj, git, gitAt, write, read, run, runIn, runBg, laneProj, buildIn, commitMain, subjects, toolCalls, bootCalls, portBase: Number(portBase), cleanup }
}
const chainWos = (plan) => plan.receipt.chains.map((c) => c.wos)
/** dispatch → build each WO → mark built → land: the happy path of one chain on lane n. */
function landOne(r, n, wos, filesOf) {
  const d = r.run('lane-dispatch', ['--lane', String(n), ...wos.flatMap((w) => ['--wo', w])])
  for (const w of wos) { const b = r.buildIn(n, w, filesOf(w)); if (b.code !== 0) throw new Error(`commit-wo ${w}: ${b.line}`) }
  const m = r.run('lane-mark', ['--chain', d.receipt.chain, '--as', 'built'])
  return { d, m, land: r.run('land-chain', ['--chain', d.receipt.chain]) }
}
const fileFor = (w) => ({ [`src/${w.toLowerCase()}.ts`]: `export const x = '${w}'\n` })

// ── cyclic-frd-graph-sliced-by-ready-set ────────────────────────────────────────────────────────
console.log('cyclic-frd-graph-sliced-by-ready-set: FRD-01 ↔ FRD-05 is built slice by slice from the WO ready set')
{
  const r = mkRepo([
    { frd: 'frd-01-a', id: 'WO-01-001' },
    { frd: 'frd-01-a', id: 'WO-01-002', deps: ['WO-05-001'] },
    { frd: 'frd-05-e', id: 'WO-05-001', deps: ['WO-01-001'] },
  ])
  try {
    ok(r.run('lane-pool', ['--size', '1']).code === 0, 'lane-pool creates one lane')
    const order = []
    for (let i = 0; i < 3; i++) {
      const p = r.run('lane-plan')
      ok(p.sealed && p.code === 0 && p.receipt.chains.length === 1, `slice ${i + 1}: exactly one ready chain (${JSON.stringify(chainWos(p))})`)
      ok(p.receipt.k === 1 && p.receipt.kReason === 'narrow-dag', `slice ${i + 1}: auto K = 1 on the narrow DAG`)
      const wos = p.receipt.chains[0].wos
      order.push(wos.join('+'))
      const { land } = landOne(r, 1, wos, fileFor)
      ok(land.code === 0 && land.receipt.status === 'landed', `slice ${i + 1}: ${wos} landed`)
    }
    ok(order.join(' → ') === 'WO-01-001 → WO-05-001 → WO-01-002', `sliced FRD-01, FRD-05, FRD-01 (${order.join(' → ')})`)
    ok(r.run('lane-plan').receipt.remaining === 0, 'nothing left to build')
    const feats = r.subjects().filter((s) => s.startsWith('feat('))
    ok(feats.length === 3 && ['WO-01-001', 'WO-05-001', 'WO-01-002'].every((w) => feats.filter((s) => s.includes(w)).length === 1), 'main holds exactly one feat commit per WO')
  } finally { r.cleanup() }
}
console.log('lane-plan refuses a cyclic WO graph; an unreadable lane state fails loud')
{
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001', deps: ['WO-01-002'] }, { frd: 'frd-01-a', id: 'WO-01-002', deps: ['WO-01-001'] }])
  try {
    const p = r.run('lane-plan')
    ok(p.code === 4 && p.receipt.status === 'wo-cycle' && p.sealed, `a WO cycle is refused (${p.receipt.reason})`)
    r.write('.pandacorp/run/lanes/state.json', '{ not json')
    const q = r.run('lane-mark', ['--chain', 'c-wo-01-001', '--as', 'built'])
    ok(q.code !== 0 && q.receipt.status !== 'built', 'a corrupt state is never read as an empty pool')
  } finally { r.cleanup() }
}

// ── auto-k1-on-narrow-dag + chain shape ─────────────────────────────────────────────────────────
console.log('auto-k1-on-narrow-dag: chains ≤ 3 in dependency order; K = default 2, mode caps, --lanes, auto 1')
{
  const r = mkRepo([
    { frd: 'frd-02-b', id: 'WO-02-001' }, { frd: 'frd-02-b', id: 'WO-02-002', deps: ['WO-02-001'] },
    { frd: 'frd-02-b', id: 'WO-02-003', deps: ['WO-02-002'] }, { frd: 'frd-02-b', id: 'WO-02-004', deps: ['WO-02-003'] },
  ])
  try {
    const p = r.run('lane-plan')
    ok(JSON.stringify(chainWos(p)) === '[["WO-02-001","WO-02-002","WO-02-003"]]', `a linear FRD is one chain of 3 in dependency order (${JSON.stringify(chainWos(p))})`)
    ok(p.receipt.k === 1 && p.receipt.kReason === 'narrow-dag', 'a one-chain DAG runs at K = 1 (today\'s behaviour)')
    ok(r.run('lane-plan', ['--lanes', '4', '--mode', 'powerful']).receipt.k === 1, '--lanes cannot widen a narrow DAG')
  } finally { r.cleanup() }
  const w = mkRepo([
    { frd: 'frd-03-c', id: 'WO-03-001' }, { frd: 'frd-03-c', id: 'WO-03-002' },
    { frd: 'frd-04-d', id: 'WO-04-001' }, { frd: 'frd-04-d', id: 'WO-04-002', deps: ['WO-04-001'] },
    { frd: 'frd-06-f', id: 'WO-06-001', deps: ['WO-04-002'] }, { frd: 'frd-06-f', id: 'WO-06-002' }, { frd: 'frd-06-f', id: 'WO-06-003' },
  ])
  try {
    const p = w.run('lane-plan')
    ok(p.receipt.k === 2 && p.receipt.kReason === 'default', `a wide DAG gets the default K = 2 (${p.receipt.k} ${p.receipt.kReason})`)
    ok(JSON.stringify(p.receipt.chains[0].wos) === '["WO-04-001","WO-04-002"]', 'the longest downstream path dispatches first (FRD-04 feeds FRD-06)')
    ok(p.receipt.chains.every((c) => c.wos.length <= 3 && new Set(c.wos.map((x) => x.slice(0, 5))).size === 1), 'every chain is ≤ 3 WOs of one FRD')
    ok(!p.receipt.chains.some((c) => c.wos.includes('WO-06-001')), 'a WO whose cross-FRD dep is unbuilt is not ready')
    ok(w.run('lane-plan', ['--lanes', '4', '--mode', 'balanced']).receipt.k === 2, 'balanced caps --lanes 4 at 2')
    ok(w.run('lane-plan', ['--mode', 'pro']).receipt.k === 1, 'pro never lanes')
    ok(w.run('lane-plan', ['--lanes', '4', '--mode', 'powerful']).receipt.k === 4, 'powerful allows --lanes 4')
    ok(w.run('lane-plan', ['--lanes', '3']).receipt.k === 3, '--lanes overrides the default')
    const s = w.run('lane-plan', ['--frd', 'frd-06-f'])
    ok(JSON.stringify(chainWos(s)) === '[["WO-06-002"],["WO-06-003"]]' && s.receipt.unsatisfiedDeps.some((u) => u.wo === 'WO-06-001' && u.dep === 'WO-04-002'), '--frd scope: an out-of-scope upstream must be VERIFIED (reported unsatisfied)')
  } finally { w.cleanup() }
}

// ── schema-chain-pauses-landings ────────────────────────────────────────────────────────────────
console.log('schema-chain-pauses-landings: a prisma chain builds on main; lane builds go on, lane landings wait')
{
  const r = mkRepo([
    { frd: 'frd-01-a', id: 'WO-01-001', artifacts: ['prisma/schema.prisma'] },
    { frd: 'frd-02-b', id: 'WO-02-001', artifacts: ['src/b.ts'] },
  ])
  try {
    const p = r.run('lane-plan')
    const barrier = p.receipt.chains.find((c) => c.barrier)
    ok(barrier && JSON.stringify(barrier.wos) === '["WO-01-001"]' && p.receipt.dispatch.barrier === barrier.id, 'the prisma chain is a barrier, dispatched to main')
    r.run('lane-pool', ['--size', '1'])
    const off = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-01-001'])
    ok(off.code === 4 && off.receipt.status === 'barrier-off-main', 'a barrier chain is refused in a lane')
    const b = r.run('lane-dispatch', ['--barrier', '--wo', 'WO-01-001'])
    ok(b.code === 0 && b.receipt.where === 'main' && b.receipt.landingsPaused === true, 'the barrier is recorded on main; landings pause')
    ok(r.run('lane-dispatch', ['--barrier', '--wo', 'WO-02-001']).receipt.status === 'barrier-active', 'one barrier at a time')
    const d = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-02-001'])
    ok(d.code === 0, 'a lane build goes on while the barrier builds')
    ok(r.buildIn(1, 'WO-02-001', { 'src/b.ts': 'export const b = 1\n' }).code === 0, 'the lane chain is built')
    ok(r.run('lane-mark', ['--chain', d.receipt.chain, '--as', 'built']).code === 0, 'and queued')
    const head = r.git('rev-parse', 'HEAD')
    const paused = r.run('land-chain')
    ok(paused.code === 4 && paused.receipt.status === 'landings-paused' && paused.receipt.barrier === barrier.id, 'land-chain waits for the barrier')
    ok(r.git('rev-parse', 'HEAD') === head, 'main is untouched while paused')
    ok(r.run('lane-plan').receipt.landingsPaused === true, 'lane-plan reports the pause')
    r.write('prisma/schema.prisma', 'model A { id Int @id }\n')
    const c = r.run('commit-wo', ['--wo', 'WO-01-001', '--files', 'prisma/schema.prisma'])
    ok(c.code === 0, `the barrier commits on main (${c.receipt.status})`)
    const land = r.run('land-chain')
    ok(land.code === 0 && land.receipt.status === 'landed' && land.receipt.chain === d.receipt.chain, 'landings resume once the barrier committed')
    ok(r.read('prisma/schema.prisma') !== null && r.read('src/b.ts') !== null, 'main has both the schema and the lane chain')
  } finally { r.cleanup() }
}

// ── land-chain-union-merges-track-journal ───────────────────────────────────────────────────────
console.log('land-chain-union-merges-track-journal: rebase keeps one commit per WO, journals union, SHAs re-keyed by WO id')
{
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-01-a', id: 'WO-01-002', deps: ['WO-01-001'] }])
  try {
    r.run('lane-pool', ['--size', '1'])
    const d = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-01-001', '--wo', 'WO-01-002'])
    ok(d.code === 0 && d.receipt.branch === 'lane/c-wo-01-001' && d.receipt.env.PANDACORP_LANE === 'lane-1', 'the chain is dispatched on lane/<chain> with its lane env')
    ok(r.buildIn(1, 'WO-01-001', fileFor('WO-01-001')).code === 0, 'WO-01-001 committed in the lane')
    const again = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-01-001', '--wo', 'WO-01-002'])
    ok(again.receipt.resumed === true && JSON.stringify(again.receipt.committed) === '["WO-01-001"]', 'a re-dispatch resumes from the last committed WO (DR-086)')
    ok(r.buildIn(1, 'WO-01-002', fileFor('WO-01-002')).code === 0, 'WO-01-002 committed in the lane')
    r.commitMain({ '.pandacorp/track.jsonl': `${r.read('.pandacorp/track.jsonl')}{"kind":"main_side"}\n`, 'src/other.ts': 'export const o = 1\n' }, 'chore: a sibling landing')
    writeFileSync(path.join(r.proj, '.pandacorp/track.jsonl'), `${r.read('.pandacorp/track.jsonl')}{"kind":"pending_gate_line"}\n`)
    ok(r.run('lane-mark', ['--chain', 'c-wo-01-001', '--as', 'built']).code === 0, 'the chain is queued')
    const land = r.run('land-chain')
    ok(land.code === 0 && land.receipt.status === 'landed' && land.sealed, `land-chain lands the queue head (${land.receipt.status} ${land.receipt.reason || ''})`)
    const track = r.read('.pandacorp/track.jsonl')
    ok(['"kind":"start"', '"kind":"main_side"', '"kind":"pending_gate_line"'].every((k) => track.includes(k)), 'main\'s journal lines survive (committed and pending)')
    ok(['WO-01-001', 'WO-01-002'].every((w) => track.includes(`"kind":"wo_end","frd":"frd-01-a","wo":"${w}"`)), 'the lane\'s wo_end lines are union-merged in')
    ok(r.git('rev-list', '--merges', 'HEAD') === '', 'history stays linear (ff-only, no merge commit)')
    const feats = r.subjects().filter((s) => s.startsWith('feat('))
    ok(feats.length === 2 && feats.filter((s) => s.includes('WO-01-001')).length === 1 && feats.filter((s) => s.includes('WO-01-002')).length === 1, 'exactly one commit per WO on main (DR-097)')
    const laneLand = track.split('\n').filter((l) => l.includes('"kind":"lane_land"')).map((l) => JSON.parse(l))
    const shaOf = (w) => r.git('log', '--format=%h', '--abbrev=12', `--grep=^feat(frd-01-a): ${w}`, 'main')
    ok(laneLand.length === 1 && laneLand[0].wos.every((x) => x.sha === shaOf(x.wo)), 'the lane_land line keys each WO to its landed SHA')
    ok(r.git('rev-parse', '--short=12', 'HEAD') === land.receipt.sha, 'main fast-forwarded to the rebased tip')
    ok(['tsc', 'biome', 'vitest related'].every((t) => r.toolCalls().some((c) => c.startsWith(t))), 'tsc, biome and vitest related ran in the lane')
    ok(r.gitAt(r.proj)('branch', '--list', 'lane/*') === '', 'the landed lane branch is gone (merged)')
    ok(r.git('status', '--porcelain', '--', 'proj/src') === '', 'main\'s tree is clean')
  } finally { r.cleanup() }
}

// ── i18n key union, rebase-fix then park ────────────────────────────────────────────────────────
console.log('land-chain: messages/*.json key union; same key different value → one rebase-fix, then park')
{
  const r = mkRepo([
    { frd: 'frd-01-a', id: 'WO-01-001' },
    { frd: 'frd-02-b', id: 'WO-02-001' }, { frd: 'frd-07-g', id: 'WO-07-001', deps: ['WO-02-001'] },
  ])
  try {
    r.run('lane-pool', ['--size', '2'])
    const d1 = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-01-001'])
    r.buildIn(1, 'WO-01-001', { 'messages/en.json': '{\n  "title": "T",\n  "b": "2"\n}\n' })
    r.commitMain({ 'messages/en.json': '{\n  "title": "T",\n  "a": "1"\n}\n' }, 'feat: main adds a key')
    r.run('lane-mark', ['--chain', d1.receipt.chain, '--as', 'built'])
    const land = r.run('land-chain', ['--chain', d1.receipt.chain])
    ok(land.code === 0 && land.receipt.resolved.includes('proj/messages/en.json'), 'a messages conflict is resolved by key union')
    ok(JSON.stringify(JSON.parse(r.read('messages/en.json'))) === '{"title":"T","a":"1","b":"2"}', 'both keys land')
    const d2 = r.run('lane-dispatch', ['--lane', '2', '--wo', 'WO-02-001'])
    r.buildIn(2, 'WO-02-001', { 'messages/en.json': '{\n  "title": "X",\n  "a": "1",\n  "b": "2"\n}\n' })
    r.commitMain({ 'messages/en.json': '{\n  "title": "Y",\n  "a": "1",\n  "b": "2"\n}\n' }, 'feat: main retitles')
    r.run('lane-mark', ['--chain', d2.receipt.chain, '--as', 'built'])
    const head = r.git('rev-parse', 'HEAD')
    const red = r.run('land-chain', ['--chain', d2.receipt.chain])
    ok(red.code === 4 && red.receipt.status === 'needs-rebase-fix' && red.receipt.conflicts.some((c) => (c.keys || []).includes('/title')), `same key, different value is red (${red.receipt.status})`)
    ok(r.git('rev-parse', 'HEAD') === head && r.git('status', '--porcelain', '--', 'proj/messages') === '', 'main is untouched by a red landing')
    const parked = r.run('land-chain', ['--chain', d2.receipt.chain])
    ok(parked.code === 4 && parked.receipt.status === 'parked', 'after one rebase-fix the chain parks')
    ok(JSON.stringify(parked.receipt.blockedFrds) === '["frd-02-b","frd-07-g"]', `only the DAG descendants wait (${JSON.stringify(parked.receipt.blockedFrds)})`)
    const p = r.run('lane-plan')
    ok(!p.receipt.chains.some((c) => c.wos.includes('WO-07-001')) && p.receipt.parked.includes(d2.receipt.chain), 'lane-plan keeps the parked chain\'s descendants out')
    ok(JSON.stringify(mergeJson3({ a: 1 }, { a: 1, n: { x: 1 } }, { a: 2, n: { y: 2 } })) === '{"value":{"a":2,"n":{"x":1,"y":2}},"conflicts":[]}', 'mergeJson3 merges nested keys 3-way')
  } finally { r.cleanup() }
}
console.log('land-chain: a red check gets one rebase-fix; lane-mark refuses a chain missing a WO commit')
{
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-01-a', id: 'WO-01-002', deps: ['WO-01-001'] }])
  try {
    r.run('lane-pool', ['--size', '1'])
    const d = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-01-001', '--wo', 'WO-01-002'])
    r.buildIn(1, 'WO-01-001', fileFor('WO-01-001'))
    const early = r.run('lane-mark', ['--chain', d.receipt.chain, '--as', 'built'])
    ok(early.code === 4 && early.receipt.status === 'commit-shape' && early.receipt.missing.includes('WO-01-002'), 'a chain with an uncommitted WO is not built')
    r.buildIn(1, 'WO-01-002', fileFor('WO-01-002'))
    r.run('lane-mark', ['--chain', d.receipt.chain, '--as', 'built'])
    const red = r.run('land-chain', [], { FAIL_TOOLS: 'tsc' })
    ok(red.code === 4 && red.receipt.status === 'needs-rebase-fix' && red.receipt.kind === 'checks-red', 'a red tsc is a needs-rebase-fix, nothing landed')
    const fixed = r.run('land-chain', ['--chain', d.receipt.chain])
    ok(fixed.code === 0 && fixed.receipt.status === 'landed', 'once fixed, the chain lands')
  } finally { r.cleanup() }
}

// ── lane-never-reuses-sibling-server ────────────────────────────────────────────────────────────
console.log('lane-never-reuses-sibling-server: every lane its own port, a busy port is skipped, Playwright never reuses in a lane')
{
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-02-b', id: 'WO-02-001' }])
  const servers = []
  const listen = (port) => new Promise((resolve) => { const s = net.createServer(); s.listen(port, '127.0.0.1', () => { servers.push(s); resolve() }) })
  try {
    const pool = r.run('lane-pool', ['--size', '2'])
    const [l1, l2] = pool.receipt.pool
    ok(pool.code === 0 && l1.port !== l2.port, `two lanes, two ports (${l1.port}, ${l2.port})`)
    ok(r.bootCalls().includes(`lane-1 ${l1.port}`) && r.bootCalls().includes(`lane-2 ${l2.port}`), 'each lane is bootstrapped on its own port')
    ok(readFileSync(path.join(r.laneProj(1), '.pandacorp/run/lane.env'), 'utf8').includes('PANDACORP_LANE=lane-1'), 'the lane env is written for the builder and verify.sh')
    await listen(l1.port)
    await listen(l2.port)
    const d2 = r.run('lane-dispatch', ['--lane', '2', '--wo', 'WO-02-001'])
    ok(d2.code === 0 && ![l1.port, l2.port].includes(Number(d2.receipt.env.PORT)), `a lane whose port answers moves to a free one (${d2.receipt.env.PORT})`)
    ok(r.bootCalls().includes(`lane-2 ${d2.receipt.env.PORT}`), 'and is re-bootstrapped on it')
    const d1 = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-01-001'])
    ok(d1.code === 0 && ![l1.port, Number(d2.receipt.env.PORT)].includes(Number(d1.receipt.env.PORT)), 'never a sibling\'s port, never its own leftover server')
    const cfg = readFileSync(TEMPLATE_PW, 'utf8')
    ok(/const LANE = Boolean\(process\.env\.PANDACORP_LANE\);/.test(cfg) && /reuseExistingServer: !PROD_SMOKE && !LANE && /.test(cfg), 'the Playwright template never reuses a server inside a lane')
  } finally { for (const s of servers) s.close(); r.cleanup() }
}

// ── usable-red bisect ───────────────────────────────────────────────────────────────────────────
console.log('lane-bisect: the first red tip after a green base is the culprit, in parallel snapshot worktrees')
{
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-02-b', id: 'WO-02-001' }, { frd: 'frd-03-c', id: 'WO-03-001' }])
  try {
    r.run('lane-pool', ['--size', '1'])
    const a = landOne(r, 1, ['WO-01-001'], fileFor)
    const b = landOne(r, 1, ['WO-02-001'], () => ({ 'src/bad.ts': 'export const bad = 1\n' }))
    const c = landOne(r, 1, ['WO-03-001'], fileFor)
    ok([a, b, c].every((x) => x.land.code === 0), 'three chains landed')
    const red = r.git('rev-parse', 'HEAD')
    const bis = r.run('lane-bisect', ['--sha', red, ...[a, b, c].flatMap((x) => ['--candidate', x.d.receipt.chain])])
    ok(bis.code === 0 && bis.receipt.status === 'culprit' && bis.receipt.culprit === b.d.receipt.chain, `the chain that broke verify.sh is named (${bis.receipt.culprit})`)
    ok(bis.receipt.results.length === 4 && bis.receipt.results[0].green === true, 'the base before the first candidate is checked green')
    ok(r.git('rev-parse', 'HEAD') === red, 'bisect never reverts anything')
    ok(r.git('worktree', 'list').split('\n').filter((l) => l.includes('bisect-')).length === 0, 'its snapshot worktrees are removed')
  } finally { r.cleanup() }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Stage B: the ops the engine's lane scheduler drives (lane-next, lane-usable) and the planner's engine scope.
// ════════════════════════════════════════════════════════════════════════════════════════════════

// ── auto-k1-on-narrow-dag: the gain below the bootstrap ─────────────────────────────────────────
console.log('auto-k1-on-narrow-dag (gain): K = 1 when fewer than two WOs could build beside the longest path')
{
  const two = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-02-b', id: 'WO-02-001' }])
  try {
    const p = two.run('lane-plan')
    ok(p.receipt.width === 2 && p.receipt.k === 1 && p.receipt.kReason === 'gain-below-bootstrap' && p.receipt.offPath === 1, `two independent WOs: one off the path, K = 1 (${p.receipt.k} ${p.receipt.kReason} offPath ${p.receipt.offPath})`)
  } finally { two.cleanup() }
  const three = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-02-b', id: 'WO-02-001' }, { frd: 'frd-03-c', id: 'WO-03-001' }])
  try {
    const p = three.run('lane-plan')
    ok(p.receipt.k === 2 && p.receipt.kReason === 'default' && p.receipt.offPath === 2, `three independent WOs: K = 2 (${p.receipt.k} ${p.receipt.kReason})`)
  } finally { three.cleanup() }
}

// ── the engine's scope: --build and --wait-verified ─────────────────────────────────────────────
console.log('lane-plan --build / --wait-verified: only the engine\'s schedule dispatches; a floor FRD\'s dependents wait for its VERIFIED')
{
  const r = mkRepo([
    { frd: 'frd-01-a', id: 'WO-01-001', status: 'IN_REVIEW' }, { frd: 'frd-01-a', id: 'WO-01-002', deps: ['WO-01-001'] },
    { frd: 'frd-02-b', id: 'WO-02-001', deps: ['WO-01-001'] }, { frd: 'frd-03-c', id: 'WO-03-001' },
  ])
  try {
    const ids = (p) => p.receipt.chains.flatMap((c) => c.wos).sort().join(',')
    ok(ids(r.run('lane-plan')) === 'WO-01-002,WO-02-001,WO-03-001', 'an IN_REVIEW upstream in scope satisfies its dependents')
    const w = r.run('lane-plan', ['--wait-verified', 'frd-01-a'])
    ok(ids(w) === 'WO-01-002,WO-03-001', `--wait-verified frd-01-a: its own next WO goes on, the other FRD's dependent waits (${ids(w)})`)
    const b = r.run('lane-plan', ['--build', 'WO-01-002', '--build', 'WO-02-001'])
    ok(ids(b) === 'WO-01-002,WO-02-001', `--build: a WO outside the engine's schedule is never dispatched (${ids(b)})`)
  } finally { r.cleanup() }
}

// ── lane-pool boots outside lanes.lock ──────────────────────────────────────────────────────────
console.log('lane-pool: the bootstrap runs outside lanes.lock; a booting lane is never free')
{
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001', artifacts: ['package.json'] }, { frd: 'frd-02-b', id: 'WO-02-001' }, { frd: 'frd-03-c', id: 'WO-03-001' }, { frd: 'frd-04-d', id: 'WO-04-001' }])
  try {
    const t0 = Date.now()
    const pool = r.runBg('lane-pool', ['--size', '2'], { BOOT_SLEEP: '4' })
    let during = null
    for (let i = 0; i < 60 && !during; i++) {
      await new Promise((res) => setTimeout(res, 200))
      const st = r.read('.pandacorp/run/lanes/state.json')
      if (st && JSON.parse(st).pool.length === 2) during = r.run('lane-next')
    }
    ok(during && during.code === 0 && Date.now() - t0 < 4000, `lane-next ran while the pool booted (not blocked by lanes.lock: ${Date.now() - t0} ms)`)
    ok(during && during.receipt.pool.booting === 2 && during.receipt.dispatched.length === 0, 'both lanes are booting: no chain is dispatched to them')
    ok(during && during.receipt.barrier && JSON.stringify(during.receipt.barrier.wos) === '["WO-01-001"]' && during.receipt.landingsPaused === true, 'the barrier is dispatched to main meanwhile (it needs no lane)')
    const done = await pool
    ok(done.code === 0 && done.receipt.status === 'ready' && done.receipt.pool.every((l) => !l.broken), 'the pool comes up ready')
    const after = r.run('lane-next')
    ok(after.receipt.dispatched.length === 2 && after.receipt.pool.free === 0, `once booted, both lanes take a chain (${after.receipt.dispatched.map((d) => d.chain).join(', ')})`)
  } finally { r.cleanup() }
}

// ── lane-next: one round dispatches the barrier and every free lane ─────────────────────────────
console.log('lane-next: barrier to main + one chain per free lane; built chains queue; the barrier\'s commit resumes landings')
{
  const r = mkRepo([
    { frd: 'frd-01-a', id: 'WO-01-001', artifacts: ['prisma/schema.prisma'] },
    { frd: 'frd-02-b', id: 'WO-02-001' }, { frd: 'frd-03-c', id: 'WO-03-001' }, { frd: 'frd-04-d', id: 'WO-04-001', deps: ['WO-02-001'] },
  ])
  try {
    r.run('lane-pool', ['--size', '2'])
    const n = r.run('lane-next', ['--mode', 'balanced'])
    ok(n.code === 0 && n.sealed && n.receipt.k === 2, `one sealed round at K = 2 (${n.receipt.k} ${n.receipt.kReason})`)
    ok(n.receipt.barrier && n.receipt.barrier.chain === 'c-wo-01-001' && n.receipt.landingsPaused === true, 'the schema chain is the barrier, building on main')
    const ds = n.receipt.dispatched
    ok(ds.length === 2 && ds.every((d) => d.path && d.env && d.env.PANDACORP_LANE && d.frd && d.wos.length === 1 && Number.isInteger(d.downstream)), `both lanes dispatched with their path, env, FRD and WOs (${JSON.stringify(ds.map((d) => [d.chain, d.lane]))})`)
    ok(ds[0].wos[0] === 'WO-02-001', 'the chain with the longest downstream path goes first')
    for (const d of ds) { r.buildIn(d.lane, d.wos[0], fileFor(d.wos[0])); r.run('lane-mark', ['--chain', d.chain, '--as', 'built']) }
    const q = r.run('lane-next')
    ok(q.receipt.landQueue.length === 2 && q.receipt.landQueue[0].chain === 'c-wo-02-001' && q.receipt.dispatched.length === 0 && q.receipt.landingsPaused === true, 'built chains queue (longest downstream first); WO-04-001 waits for WO-02-001 to land')
    r.write('prisma/schema.prisma', 'model A { id Int @id }\n')
    ok(r.run('commit-wo', ['--wo', 'WO-01-001', '--files', 'prisma/schema.prisma']).code === 0, 'the barrier commits on main')
    const after = r.run('lane-next')
    ok(after.receipt.landingsPaused === false && after.receipt.barrier === null && after.receipt.landedFrds.includes('frd-01-a'), 'git wins: the barrier is landed, landings resume')
    const st = JSON.parse(r.read('.pandacorp/run/lanes/state.json'))
    ok(st.chains['c-wo-01-001'].landedSha && r.git('log', '-1', '--format=%s', st.chains['c-wo-01-001'].landedSha).includes('WO-01-001'), 'the barrier landed by its main commit records its landed SHA (bisectable)')
  } finally { r.cleanup() }
}

// ── lane-resume-after-pause (mech) ──────────────────────────────────────────────────────────────
console.log('lane-resume-after-pause: --resume re-dispatches a live chain on its own lane from its last committed WO')
{
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-01-a', id: 'WO-01-002', deps: ['WO-01-001'] }, { frd: 'frd-02-b', id: 'WO-02-001' }, { frd: 'frd-03-c', id: 'WO-03-001' }])
  try {
    r.run('lane-pool', ['--size', '1'])
    const d = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-01-001', '--wo', 'WO-01-002'])
    ok(r.buildIn(1, 'WO-01-001', fileFor('WO-01-001')).code === 0, 'the first WO committed in the lane before the pause')
    writeFileSync(path.join(r.laneProj(1), 'src/wo-01-002.ts'), 'export const half = 1\n')   // the killed builder's half-written file
    const plain = r.run('lane-next')
    ok(plain.receipt.dispatched.length === 0 && plain.receipt.inFlight.includes(d.receipt.chain), 'without --resume a live chain is only reported in flight')
    const res = r.run('lane-next', ['--resume'])
    const back = res.receipt.dispatched.find((x) => x.chain === d.receipt.chain)
    ok(back && back.resumed === true && back.lane === 1 && JSON.stringify(back.committed) === '["WO-01-001"]', `the chain is re-dispatched on lane 1 keeping WO-01-001 (${JSON.stringify(back && { r: back.resumed, c: back.committed })})`)
    ok(back && back.salvaged && back.salvaged.paths.some((p) => /wo-01-002\.ts$/.test(p.path || p)), 'the half-written file is salvaged, never built on')
    ok(!existsSync(path.join(r.laneProj(1), 'src/wo-01-002.ts')), 'and the lane is clean for the rebuild of WO-01-002')
  } finally { r.cleanup() }
}

// ── a resync that fails breaks the lane, never the chain ────────────────────────────────────────
console.log('lane-next: a failed resync marks the lane broken and releases the chain for a healthy lane')
{
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-02-b', id: 'WO-02-001' }, { frd: 'frd-03-c', id: 'WO-03-001' }])
  try {
    r.run('lane-pool', ['--size', '1'])
    r.commitMain({ 'package-lock.json': '{"lockfileVersion":3}\n' }, 'chore: a lockfile landed on main')
    const n = r.run('lane-next', [], { BOOT_FAIL: '1' })
    ok(n.code === 0 && n.receipt.dispatched.length === 0 && n.receipt.failed.length === 1 && n.receipt.failed[0].status === 'resync-failed', `the resync failure is reported (${JSON.stringify(n.receipt.failed)})`)
    ok(n.receipt.pool.broken === 1 && n.receipt.pool.free === 0 && n.receipt.inFlight.length === 0, 'the lane is broken; no chain stays claimed')
  } finally { r.cleanup() }
}

// ── usable-red-bisects-then-fixforward (mech half): lane-usable in the snapshot worktree ────────
console.log('lane-usable: verify.sh on the pinned SHA in the snapshot worktree; own-commit floor; red → class + bisect candidates')
{
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-02-b', id: 'WO-02-001' }, { frd: 'frd-03-c', id: 'WO-03-001' }, { frd: 'frd-04-d', id: 'WO-04-001' }])
  try {
    r.run('lane-pool', ['--size', '1'])
    const a = landOne(r, 1, ['WO-01-001'], fileFor)
    const auth = landOne(r, 1, ['WO-04-001'], () => ({ 'src/auth/session.ts': 'export const session = 1\n' }))
    ok(a.land.code === 0 && auth.land.code === 0, 'two chains landed')
    const head = r.git('rev-parse', 'HEAD')
    const u = r.run('lane-usable', ['--frd', 'frd-01-a', '--wo', 'WO-01-001'])
    ok(u.code === 0 && u.sealed && u.receipt.green === true && u.receipt.usable === true && u.receipt.sha === head.slice(0, 12), `green and USABLE on the pinned SHA (${u.receipt.status} ${u.receipt.failure || ''} ${u.receipt.reason || ''})`)
    ok(u.receipt.floor === false && u.receipt.commits.length === 1, `the floor reads only frd-01's own commit, not the auth chain landed after it (floor ${u.receipt.floor}, hits ${JSON.stringify(u.receipt.floorHits)})`)
    ok(/\/lanes\/snapshot\//.test(u.receipt.snapshot.path) && r.bootCalls().some((c) => c.startsWith('snapshot ')), 'verify.sh ran in the bootstrapped snapshot worktree')
    const track = r.read('.pandacorp/track.jsonl')
    ok(track.includes(`"kind":"build_usable","frd":"frd-01-a","sha":"${head.slice(0, 12)}"`) && r.git('log', '-1', '--format=%s').includes('usable'), 'the build_usable line names the pinned SHA and is committed on main')
    const fl = r.run('lane-usable', ['--frd', 'frd-04-d', '--wo', 'WO-04-001'])
    ok(fl.receipt.green === true && fl.receipt.floor === true && fl.receipt.usable === false, `the auth chain's FRD is floor: green but never USABLE (${fl.receipt.floor})`)
    const bad = landOne(r, 1, ['WO-02-001'], () => ({ 'src/bad.ts': 'export const bad = 1\n' }))
    const c = landOne(r, 1, ['WO-03-001'], fileFor)
    ok(bad.land.code === 0 && c.land.code === 0, 'a breaking chain and an innocent one landed after the green pin')
    const red = r.run('lane-usable', ['--frd', 'frd-03-c', '--wo', 'WO-03-001'])
    ok(red.code === 0 && red.receipt.green === false && red.receipt.usable === false && red.receipt.class === 'cross', `red, and other FRDs' chains landed since the last green: class cross (${red.receipt.class})`)
    ok(JSON.stringify(red.receipt.candidates) === JSON.stringify([bad.d.receipt.chain, c.d.receipt.chain]), `the candidates are the chains landed since the green pin (${JSON.stringify(red.receipt.candidates)})`)
    const bis = r.run('lane-bisect', ['--sha', r.git('rev-parse', 'HEAD'), ...red.receipt.candidates.flatMap((x) => ['--candidate', x])])
    ok(bis.receipt.status === 'culprit' && bis.receipt.culprit === bad.d.receipt.chain, `the bisect names the breaking chain (${bis.receipt.culprit})`)
    ok(!r.read('.pandacorp/track.jsonl').includes('"frd":"frd-03-c"') || !/build_usable","frd":"frd-03-c/.test(r.read('.pandacorp/track.jsonl')), 'a red FRD gets no build_usable line')
    const notYet = r.run('lane-usable', ['--frd', 'frd-03-c', '--wo', 'WO-03-001', '--sha', a.land.receipt.sha])
    ok(notYet.code === 4 && notYet.receipt.status === 'uncommitted', 'a pin where the WO is not IN_REVIEW certifies nothing')
  } finally { r.cleanup() }
}
console.log('lane-usable: a red caused only by the FRD\'s own chains is class own')
{
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-02-b', id: 'WO-02-001' }])
  try {
    r.run('lane-pool', ['--size', '1'])
    landOne(r, 1, ['WO-01-001'], fileFor)
    ok(r.run('lane-usable', ['--frd', 'frd-01-a', '--wo', 'WO-01-001']).receipt.green === true, 'a green pin')
    const own = landOne(r, 1, ['WO-02-001'], () => ({ 'src/bad.ts': 'export const bad = 1\n' }))
    const red = r.run('lane-usable', ['--frd', 'frd-02-b', '--wo', 'WO-02-001'])
    ok(red.receipt.green === false && red.receipt.class === 'own' && JSON.stringify(red.receipt.candidates) === JSON.stringify([own.d.receipt.chain]), `only its own chain since the green pin: class own (${red.receipt.class} ${JSON.stringify(red.receipt.candidates)})`)
  } finally { r.cleanup() }
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
