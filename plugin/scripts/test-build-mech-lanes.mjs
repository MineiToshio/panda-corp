#!/usr/bin/env node
// test-build-mech-lanes.mjs — proposal 40 Phase B (lanes): git-fixture tests of the lane ops of pandacorp-build-mech.mjs
// (lane-pool, lane-plan, lane-dispatch, lane-mark, land-chain, lane-bisect). Every scenario builds a real repository with
// the project NESTED under `proj/` (the Mission Control shape), real linked lane worktrees, and builds work orders in a
// lane with the real `commit-wo` op. The oracle is git (main's history, its files, the lane branches) — never the
// receipt alone — and every receipt must carry a valid integrity seal.

import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifySealedLine } from './drift-seal.mjs'
import { mergeJson3 } from './build-mech-lane-land.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(__dirname, 'pandacorp-build-mech.mjs')
const TEMPLATE_PW = path.join(__dirname, '..', 'templates', 'stack-a-nextjs', 'e2e', 'playwright.config.ts')
const REAL_BOOTSTRAP = path.join(__dirname, '..', 'templates', 'shared', '.pandacorp', 'worktree-bootstrap.sh')

let passed = 0
let failed = 0
const ok = (cond, msg) => { if (cond) { passed++; console.log(`  ✓ ${msg}`) } else { failed++; console.log(`  ✗ ${msg}`) } }

const FAKE_TOOL = '#!/bin/sh\necho "$(basename "$0") $*" >> "$LANE_TOOL_LOG"\ncase " $FAIL_TOOLS " in *" $(basename "$0") "*) exit 1;; esac\nexit 0\n'
const BOOTSTRAP = '#!/bin/sh\nsleep "${BOOT_SLEEP:-0}"\n[ -n "$BOOT_FAIL" ] && { echo "npm ci: network unreachable"; exit 1; }\nmkdir -p node_modules/.bin .pandacorp/run\necho "${PANDACORP_LANE:-none} ${PANDACORP_E2E_PORT:-none}" >> "$BOOT_LOG"\nfor t in tsc biome vitest; do cp "$FAKE_TOOL" node_modules/.bin/$t; chmod +x node_modules/.bin/$t; done\n'
const VERIFY = '#!/bin/sh\nmkdir -p .pandacorp/run\nsha=$(git rev-parse HEAD)\nif [ -f src/bad.ts ]; then printf \'{"sha":"%s","green":false,"scope":"full","subgates":[{"name":"vitest","exit":1,"failures":["src/bad.ts: bad"]}]}\' "$sha" > .pandacorp/run/gate-report.json; echo "bad.ts present"; exit 1; fi\nprintf \'{"sha":"%s","green":true,"scope":"full","subgates":[]}\' "$sha" > .pandacorp/run/gate-report.json\nexit 0\n'
const woMd = (id, { deps = [], artifacts = [], status = 'PLANNED' } = {}) => `---\nid: ${id}\ntype: work-order\nslug: ${id.toLowerCase()}\nimplementation_status: ${status}\nreopen_count: 0\ndependsOn: [${deps.join(', ')}]\nartifacts: [${artifacts.join(', ')}]\ntests: none\ntests_reason: lane fixture\n---\n# ${id}\n\n## Status Note\n`
const woRel = (frd, id) => `docs/frds/${frd}/work-orders/${id.toLowerCase()}-x.md`

/**
 * A fixture repository. Default: the project NESTED under `proj/` with a fake bootstrap. `flat` puts the project at the
 * repo root (a normal product project, the bench shape); `realBootstrap` installs the shipped worktree-bootstrap.sh (with
 * a fake `pnpm` on PATH that drops the fake tools into node_modules/.bin); `files` adds tracked project files; `verify`
 * replaces the fixture verify.sh.
 */
function mkRepo(wos, { flat = false, realBootstrap = false, files = {}, verify = VERIFY } = {}) {
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
  const proj = flat ? root : path.join(root, 'proj')
  const writeAt = (base) => (rel, content) => { mkdirSync(path.dirname(path.join(base, rel)), { recursive: true }); writeFileSync(path.join(base, rel), content) }
  const write = writeAt(proj)
  const read = (rel, base = proj) => (existsSync(path.join(base, rel)) ? readFileSync(path.join(base, rel), 'utf8') : null)
  writeFileSync(path.join(root, 'factory.txt'), 'factory root file\n')
  write('.gitignore', 'node_modules/\n.pandacorp/run/\n')
  write('.pandacorp/status.yaml', 'phase: implementation\n')
  write('.pandacorp/track.jsonl', '{"kind":"start"}\n')
  write('.pandacorp/worktree-bootstrap.sh', realBootstrap ? readFileSync(REAL_BOOTSTRAP, 'utf8') : BOOTSTRAP)
  for (const [rel, content] of Object.entries(files)) write(rel, content)
  write('.pandacorp/verify.sh', verify)
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
  if (realBootstrap) {
    const bin = path.join(scratch, 'bin')
    mkdirSync(bin, { recursive: true })
    writeFileSync(path.join(bin, 'pnpm'), '#!/bin/sh\nmkdir -p node_modules/.bin\nfor t in tsc biome vitest; do cp "$FAKE_TOOL" node_modules/.bin/$t; chmod +x node_modules/.bin/$t; done\n')
    chmodSync(path.join(bin, 'pnpm'), 0o755)
    baseEnv.PATH = `${bin}${path.delimiter}${process.env.PATH}`
  }
  const runIn = (project, op, args = [], env = {}) => {
    const evArgs = op === 'commit-wo' ? ['--events', events] : []
    const r = spawnSync(process.execPath, [SCRIPT, op, '--project', project, ...args, ...evArgs], { cwd: root, encoding: 'utf8', env: { ...process.env, ...baseEnv, ...env } })
    const line = (r.stdout || '').trim().split('\n').pop() || ''
    let receipt = null
    try { receipt = JSON.parse(line) } catch { receipt = null }
    return { code: r.status, receipt: receipt || {}, sealed: verifySealedLine(line).ok, stderr: r.stderr, line }
  }
  const run = (op, args, env) => runIn(proj, op, args, env)
  const laneWt = (n) => path.join(proj, '.pandacorp', 'run', 'lanes', `lane-${n}`)
  const laneProj = (n) => (flat ? laneWt(n) : path.join(laneWt(n), 'proj'))
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
  return { root, proj, git, gitAt, write, read, run, runIn, runBg, laneWt, laneProj, buildIn, commitMain, subjects, toolCalls, bootCalls, portBase: Number(portBase), cleanup }
}
/**
 * Evaluate the stack template's playwright.config.ts in `dir` (Node strips its types) with ONLY `env` set, against a
 * stub @playwright/test (defineConfig is the identity): the webServer it would start and whether it would reuse one.
 */
function loadPwConfig(dir, env = {}) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'lanes-pwcfg-'))
  try {
    const stub = path.join(tmp, 'node_modules', '@playwright', 'test')
    mkdirSync(stub, { recursive: true })
    writeFileSync(path.join(stub, 'package.json'), '{ "name": "@playwright/test", "type": "module", "main": "index.js" }\n')
    writeFileSync(path.join(stub, 'index.js'), 'export const defineConfig = (c) => c\nexport const devices = { "Desktop Chrome": {} }\n')
    writeFileSync(path.join(tmp, 'package.json'), '{ "type": "module" }\n')
    writeFileSync(path.join(tmp, 'playwright.config.ts'), readFileSync(TEMPLATE_PW, 'utf8'))
    const code = `const m = await import(${JSON.stringify(path.join(tmp, 'playwright.config.ts'))}); const c = m.default; console.log(JSON.stringify({ reuse: c.webServer.reuseExistingServer, command: c.webServer.command, baseURL: c.use.baseURL }))`
    const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--input-type=module', '-e', code], { cwd: dir, encoding: 'utf8', env: { PATH: process.env.PATH, ...env } })
    const out = JSON.parse((r.stdout || '').trim().split('\n').pop() || 'null')
    return out ? { ok: true, ...out, port: Number(new URL(out.baseURL).port) } : { ok: false, stderr: r.stderr }
  } catch (e) { return { ok: false, error: e.message } } finally { rmSync(tmp, { recursive: true, force: true }) }
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
      const p = r.run('lane-plan', ['--lanes', '2'])
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
console.log('auto-k1-on-narrow-dag: chains ≤ 3 in dependency order; K = 1 by default (§7 row 5), --lanes N, mode caps, auto 1')
{
  const r = mkRepo([
    { frd: 'frd-02-b', id: 'WO-02-001' }, { frd: 'frd-02-b', id: 'WO-02-002', deps: ['WO-02-001'] },
    { frd: 'frd-02-b', id: 'WO-02-003', deps: ['WO-02-002'] }, { frd: 'frd-02-b', id: 'WO-02-004', deps: ['WO-02-003'] },
  ])
  try {
    const p = r.run('lane-plan')
    ok(JSON.stringify(chainWos(p)) === '[["WO-02-001","WO-02-002","WO-02-003"]]', `a linear FRD is one chain of 3 in dependency order (${JSON.stringify(chainWos(p))})`)
    ok(p.receipt.k === 1 && p.receipt.kRun === 1 && p.receipt.kRunReason === 'narrow-dag', `a one-chain DAG runs at K = 1 even under the default K = 2 (narrow-dag, DR-125) (${p.receipt.k} ${p.receipt.kRunReason})`)
    ok(r.run('lane-plan', ['--lanes', '2']).receipt.kReason === 'narrow-dag', 'even with --lanes 2 a one-chain DAG drops to K = 1 (narrow-dag)')
    ok(r.run('lane-plan', ['--lanes', '4', '--mode', 'powerful']).receipt.k === 1, '--lanes cannot widen a narrow DAG')
  } finally { r.cleanup() }
  const w = mkRepo([
    { frd: 'frd-03-c', id: 'WO-03-001' }, { frd: 'frd-03-c', id: 'WO-03-002' },
    { frd: 'frd-04-d', id: 'WO-04-001' }, { frd: 'frd-04-d', id: 'WO-04-002', deps: ['WO-04-001'] },
    { frd: 'frd-06-f', id: 'WO-06-001', deps: ['WO-04-002'] }, { frd: 'frd-06-f', id: 'WO-06-002' }, { frd: 'frd-06-f', id: 'WO-06-003' },
  ])
  try {
    const p = w.run('lane-plan')
    ok(p.receipt.kRun === 2 && p.receipt.kRunReason === 'default' && p.receipt.k === 2 && p.receipt.kReason === 'default', `default-lanes-is-2: lanes are ON by default on a wide DAG, K = 2 (DR-125) (${p.receipt.k} ${p.receipt.kReason} kRun ${p.receipt.kRun})`)
    const two = w.run('lane-plan', ['--lanes', '2'])
    ok(two.receipt.k === 2 && two.receipt.kReason === 'requested', `--lanes 2 on a wide DAG: K = 2 (${two.receipt.k} ${two.receipt.kReason})`)
    ok(JSON.stringify(p.receipt.chains[0].wos) === '["WO-04-001","WO-04-002"]', 'the longest downstream path dispatches first (FRD-04 feeds FRD-06)')
    ok(p.receipt.chains.every((c) => c.wos.length <= 3 && new Set(c.wos.map((x) => x.slice(0, 5))).size === 1), 'every chain is ≤ 3 WOs of one FRD')
    ok(!p.receipt.chains.some((c) => c.wos.includes('WO-06-001')), 'a WO whose cross-FRD dep is unbuilt is not ready')
    ok(w.run('lane-plan', ['--lanes', '4', '--mode', 'balanced']).receipt.k === 2, 'balanced caps --lanes 4 at 2')
    const pro = w.run('lane-plan', ['--lanes', '2', '--mode', 'pro'])
    ok(pro.receipt.k === 1 && pro.receipt.kReason === 'mode-cap-pro', 'pro never lanes, even with --lanes 2')
    ok(w.run('lane-plan', ['--lanes', '4', '--mode', 'powerful']).receipt.k === 4, 'powerful allows --lanes 4')
    ok(w.run('lane-plan', ['--lanes', '3']).receipt.k === 3, '--lanes overrides the default')
    ok(w.run('lane-plan', ['--mode', 'powerful']).receipt.k === 2, 'no --lanes: the default K = 2 in powerful too (more lanes only on request)')
    const proDefault = w.run('lane-plan', ['--mode', 'pro'])
    ok(proDefault.receipt.k === 1 && proDefault.receipt.kRunReason === 'mode-cap-pro', `pro caps the default at 1 (${proDefault.receipt.k} ${proDefault.receipt.kRunReason})`)
    ok(w.run('lane-plan', ['--lanes', '1']).receipt.k === 1, '--lanes 1 opts out of the default')
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
    // The config itself, evaluated in the lane with an EMPTY env (a builder's fresh Bash call never sourced lane.env):
    // the lane's own lane.env on disk must still pin its port and forbid reusing a server.
    const lanePort1 = Number(readFileSync(path.join(r.laneProj(1), '.pandacorp/run/lane.env'), 'utf8').match(/^export PORT=(\d+)$/m)[1])
    const inLane = loadPwConfig(r.laneProj(1))
    ok(inLane.ok && inLane.reuse === false, `in a lane with an empty env the template never reuses a server (${JSON.stringify(inLane)})`)
    ok(inLane.ok && inLane.port === lanePort1 && inLane.baseURL === `http://127.0.0.1:${lanePort1}` && inLane.command.includes(`--port ${lanePort1}`), `its server and baseURL use the lane's own port ${lanePort1}, read from lane.env (${inLane.baseURL})`)
    const inLaneEnv = loadPwConfig(r.laneProj(1), { PORT: '3000' })
    ok(inLaneEnv.ok && inLaneEnv.port === lanePort1 && inLaneEnv.reuse === false, `an inherited PORT=3000 never overrides the lane's port (${inLaneEnv.port})`)
    const plain = mkdtempSync(path.join(os.tmpdir(), 'lanes-pw-'))
    try {
      const outside = loadPwConfig(plain)
      ok(outside.ok && outside.reuse === true && outside.port === 3000, `control: outside a lane (no lane.env) the same config reuses the dev server on 3000 (${JSON.stringify(outside)})`)
    } finally { rmSync(plain, { recursive: true, force: true }) }
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
    const p = two.run('lane-plan', ['--lanes', '2'])
    ok(p.receipt.width === 2 && p.receipt.k === 1 && p.receipt.kReason === 'gain-below-bootstrap' && p.receipt.offPath === 1, `two independent WOs: one off the path, K = 1 (${p.receipt.k} ${p.receipt.kReason} offPath ${p.receipt.offPath})`)
  } finally { two.cleanup() }
  const three = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-02-b', id: 'WO-02-001' }, { frd: 'frd-03-c', id: 'WO-03-001' }])
  try {
    const p = three.run('lane-plan', ['--lanes', '2'])
    ok(p.receipt.k === 2 && p.receipt.kReason === 'requested' && p.receipt.offPath === 2, `three independent WOs with --lanes 2: K = 2 (${p.receipt.k} ${p.receipt.kReason})`)
    const bare = three.run('lane-plan')
    ok(bare.receipt.k === 2 && bare.receipt.kReason === 'default', `the same DAG without --lanes lanes at the default K = 2 (DR-125) (${bare.receipt.k} ${bare.receipt.kReason})`)
    const twoBare = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-02-b', id: 'WO-02-001' }])
    try {
      const q = twoBare.run('lane-plan')
      ok(q.receipt.k === 1 && q.receipt.kReason === 'gain-below-bootstrap', `the default auto-narrows to 1 below the bootstrap gain (${q.receipt.k} ${q.receipt.kReason})`)
    } finally { twoBare.cleanup() }
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
    const n = r.run('lane-next', ['--mode', 'balanced', '--lanes', '2'])
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
    ok((n.receipt.inFlightChains || []).length === 2 && n.receipt.inFlightChains.every((c) => c.lane && c.status === 'dispatched') && !n.receipt.inFlightChains.some((c) => c.chain === 'c-wo-01-001'), 'inFlightChains lists the live lane chains, never the barrier on main')
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
    // Bench FM-8: a dispatch whose receipt the relay lost is an orphan the engine must re-adopt; every round names each live
    // lane chain with what the engine needs to resume it there (its lane path, env and committed WOs), without touching it.
    const orphan = (plain.receipt.inFlightChains || []).find((x) => x.chain === d.receipt.chain)
    ok(orphan && orphan.lane === 1 && orphan.status === 'dispatched' && path.resolve(orphan.path) === path.resolve(r.laneProj(1)) && orphan.env && orphan.env.PORT && JSON.stringify(orphan.wos) === '["WO-01-001","WO-01-002"]' && JSON.stringify(orphan.committed) === '["WO-01-001"]', `inFlightChains names the live lane chain with its lane, path, env and committed WOs (${JSON.stringify(orphan)})`)
    ok(existsSync(path.join(r.laneProj(1), 'src/wo-01-002.ts')), 'reporting it in flight resets nothing in the lane (the half-written file is still there)')
    const res = r.run('lane-next', ['--resume'])
    const back = res.receipt.dispatched.find((x) => x.chain === d.receipt.chain)
    ok(back && back.resumed === true && back.lane === 1 && JSON.stringify(back.committed) === '["WO-01-001"]', `the chain is re-dispatched on lane 1 keeping WO-01-001 (${JSON.stringify(back && { r: back.resumed, c: back.committed })})`)
    ok(back && back.salvaged && back.salvaged.paths.some((p) => /wo-01-002\.ts$/.test(p.path || p)), 'the half-written file is salvaged, never built on')
    ok(!existsSync(path.join(r.laneProj(1), 'src/wo-01-002.ts')), 'and the lane is clean for the rebuild of WO-01-002')
    const p2 = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-02-001'])
    ok(p2.code === 4 && p2.receipt.status === 'lane-busy', 'the resumed chain holds its lane')
    r.run('lane-mark', ['--chain', d.receipt.chain, '--as', 'parked', '--why', 'red three times'])
    ok(r.run('lane-plan').receipt.blockedWos.includes('WO-01-001'), 'parked: its WOs wait for the rest of this run')
    const nextRun = r.run('lane-next', ['--resume'])
    ok(nextRun.receipt.retired.includes(d.receipt.chain) && nextRun.receipt.dispatched.some((x) => x.wos.includes('WO-01-001')) && nextRun.receipt.blockedFrds.length === 0, `the next run's resume round retires the park and retries the chain (${JSON.stringify(nextRun.receipt.dispatched.map((x) => x.chain))})`)
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

// ── a retried parked chain keeps what it committed ──────────────────────────────────────────────
console.log('lane-park-retry-keeps-commits: the retry of a parked chain archives its unlanded commits before reusing lane/<chain>')
{
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-01-a', id: 'WO-01-002', deps: ['WO-01-001'] }])
  try {
    r.run('lane-pool', ['--size', '1'])
    const d = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-01-001', '--wo', 'WO-01-002'])
    const chain = d.receipt.chain
    for (const w of ['WO-01-001', 'WO-01-002']) r.buildIn(1, w, fileFor(w))
    const tip = r.git('rev-parse', `lane/${chain}`)
    r.run('lane-mark', ['--chain', chain, '--as', 'parked', '--why', 'conflict after its rebase-fix'])
    const n = r.run('lane-next', ['--resume'])
    const again = (n.receipt.dispatched || []).find((x) => x.chain === chain)
    ok(n.code === 0 && n.receipt.retired.includes(chain) && again && again.lane === 1, `the park is retired and the same chain id is dispatched again (${JSON.stringify(n.receipt.failed)})`)
    const refs = r.git('for-each-ref', '--format=%(refname) %(objectname)', `refs/lane-parked/${chain}/`).split('\n').filter(Boolean)
    ok(refs.length === 1 && refs[0].endsWith(` ${tip}`), `the old lane/${chain} tip is kept under refs/lane-parked/${chain}/ (${refs.join(', ') || 'none'})`)
    ok(refs.length === 1 && ['WO-01-001', 'WO-01-002'].every((w) => r.git('log', '--format=%s', refs[0].split(' ')[0]).includes(w)), 'both committed WOs are reachable from the archive ref')
    ok(again && again.archived && again.archived.sha === tip.slice(0, 12) && again.archived.ref === refs[0]?.split(' ')[0], `the dispatch receipt names the archive (${JSON.stringify(again && again.archived)})`)
    ok(r.git('rev-parse', `lane/${chain}`) === r.git('rev-parse', 'main'), 'the retry starts fresh from main')
    const again2 = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-01-001', '--wo', 'WO-01-002'])
    ok(again2.code === 0 && !again2.receipt.archived, 'a re-dispatch with nothing unlanded on the branch archives nothing')
  } finally { r.cleanup() }
}
console.log('lane-park-retry: the branch held by a free sibling lane is released there; held outside the pool → a refusal, never a throw')
{
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-01-a', id: 'WO-01-002', deps: ['WO-01-001'] }, { frd: 'frd-02-b', id: 'WO-02-001' }])
  try {
    r.run('lane-pool', ['--size', '2'])
    const d = r.run('lane-dispatch', ['--lane', '2', '--wo', 'WO-01-001', '--wo', 'WO-01-002'])
    const chain = d.receipt.chain
    r.buildIn(2, 'WO-01-001', fileFor('WO-01-001'))
    const tip = r.git('rev-parse', `lane/${chain}`)
    r.run('lane-mark', ['--chain', chain, '--as', 'parked', '--why', 'red three times'])
    const n = r.run('lane-next', ['--resume'])
    const again = (n.receipt.dispatched || []).find((x) => x.chain === chain)
    ok(n.code === 0 && again && again.lane === 1 && (n.receipt.failed || []).length === 0, `lane 1 takes the chain although free lane 2 still had lane/${chain} checked out (${JSON.stringify(n.receipt.failed)})`)
    ok(r.git('for-each-ref', '--format=%(objectname)', `refs/lane-parked/${chain}/`).split('\n').includes(tip), 'and its committed WO is archived first')
  } finally { r.cleanup() }
  const o = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-01-a', id: 'WO-01-002', deps: ['WO-01-001'] }])
  try {
    o.run('lane-pool', ['--size', '1'])
    const d = o.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-01-001', '--wo', 'WO-01-002'])
    const chain = d.receipt.chain
    o.buildIn(1, 'WO-01-001', fileFor('WO-01-001'))
    o.run('lane-mark', ['--chain', chain, '--as', 'parked', '--why', 'red three times'])
    o.gitAt(o.laneProj(1))('checkout', '-q', '--detach')
    const elsewhere = path.join(o.root, 'elsewhere')
    o.git('worktree', 'add', '-q', elsewhere, `lane/${chain}`)
    const tip = o.git('rev-parse', `lane/${chain}`)
    const n = o.run('lane-next', ['--resume'])
    ok(n.code === 0 && n.sealed && (n.receipt.failed || []).length === 1 && n.receipt.failed[0].status === 'branch-in-use', `a branch checked out outside the pool is a refusal in the round, never a throw (${n.code} ${JSON.stringify(n.receipt.failed)})`)
    ok(o.gitAt(elsewhere)('rev-parse', 'HEAD') === tip && o.git('rev-parse', `lane/${chain}`) === tip, 'that worktree and the branch are untouched')
  } finally { o.cleanup() }
}

// ── a lane directory that is not its own worktree is never reset ────────────────────────────────
console.log('lane-orphan: a lane dir whose .git is gone resolves to main — dispatch and land refuse, main is never reset')
{
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-02-b', id: 'WO-02-001' }])
  try {
    r.run('lane-pool', ['--size', '1'])
    const d = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-02-001'])
    r.buildIn(1, 'WO-02-001', fileFor('WO-02-001'))
    r.run('lane-mark', ['--chain', d.receipt.chain, '--as', 'built'])
    r.write('src/owner-wip.ts', 'export const wip = 1\n')
    const head = r.git('rev-parse', 'HEAD')
    rmSync(path.join(r.proj, '.pandacorp/run/lanes/lane-1/.git'), { force: true })
    const land = r.run('land-chain', ['--chain', d.receipt.chain])
    ok(land.code === 4 && land.receipt.status === 'lane-orphan', `land-chain refuses an orphaned lane (${land.receipt.status})`)
    r.run('lane-mark', ['--chain', d.receipt.chain, '--as', 'parked', '--why', 'orphan'])
    const x = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-01-001'])
    ok(x.code === 4 && x.receipt.status === 'lane-orphan', `lane-dispatch refuses it (${x.receipt.status}: ${x.receipt.reason})`)
    ok(r.git('branch', '--show-current') === 'main' && r.git('rev-parse', 'HEAD') === head, 'main is still on main at the same commit')
    ok(r.read('src/owner-wip.ts') === 'export const wip = 1\n', 'and the owner\'s uncommitted file in main is untouched')
  } finally { r.cleanup() }
}

// ── land-chain resyncs a lane after a dependency barrier ────────────────────────────────────────
console.log('land-chain: rebased onto a lockfile/prisma change, the lane resyncs before its checks; no change, no resync')
{
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-02-b', id: 'WO-02-001' }, { frd: 'frd-03-c', id: 'WO-03-001' }])
  try {
    r.run('lane-pool', ['--size', '1'])
    const d = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-02-001'])
    r.buildIn(1, 'WO-02-001', fileFor('WO-02-001'))
    r.run('lane-mark', ['--chain', d.receipt.chain, '--as', 'built'])
    r.commitMain({ 'package-lock.json': '{"lockfileVersion":3}\n' }, 'chore: a dependency barrier landed on main')
    const head = r.git('rev-parse', 'HEAD')
    const boots = r.bootCalls().length
    const red = r.run('land-chain', ['--chain', d.receipt.chain], { BOOT_FAIL: '1' })
    ok(red.code === 4 && red.receipt.status === 'resync-failed' && r.git('rev-parse', 'HEAD') === head, `a failed resync lands nothing (${red.receipt.status})`)
    ok(r.run('lane-plan').receipt.landQueue.includes(d.receipt.chain), 'and the chain stays queued')
    const land = r.run('land-chain', ['--chain', d.receipt.chain])
    ok(land.code === 0 && land.receipt.status === 'landed', `the chain lands (${land.receipt.status} ${land.receipt.reason || ''})`)
    ok(r.bootCalls().length === boots + 1 && land.receipt.resync && land.receipt.resync.ran.includes('bootstrap'), `the lane was re-bootstrapped before its checks (${JSON.stringify(land.receipt.resync)})`)
    const d2 = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-03-001'])
    r.buildIn(1, 'WO-03-001', fileFor('WO-03-001'))
    r.run('lane-mark', ['--chain', d2.receipt.chain, '--as', 'built'])
    const before = r.bootCalls().length
    const land2 = r.run('land-chain', ['--chain', d2.receipt.chain])
    ok(land2.code === 0 && r.bootCalls().length === before && land2.receipt.resync && land2.receipt.resync.ran.length === 0, 'a landing with no dependency change resyncs nothing')
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

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Per-step K (bench FM-5): K is re-evaluated at EVERY scheduling round, never decided once for the run.
// ════════════════════════════════════════════════════════════════════════════════════════════════

// The medium bench's Build Plan (pandacorp-bench-medium, frd-01-projects/blueprint.md): ten WOs, four FRDs, one
// schema/package barrier (WO-01-003). FM-5 asked --lanes 2, the first lane-plan saw only WO-01-001 ready (width 1) and
// the whole run built sequentially although the DAG is two wide at five later points.
const BENCH_MEDIUM = [
  { frd: 'frd-01-projects', id: 'WO-01-001' },
  { frd: 'frd-01-projects', id: 'WO-01-002', deps: ['WO-01-001'] },
  { frd: 'frd-01-projects', id: 'WO-01-003', deps: ['WO-01-001'], artifacts: ['prisma/schema.prisma', 'package.json'] },
  { frd: 'frd-01-projects', id: 'WO-01-004', deps: ['WO-01-003'] },
  { frd: 'frd-01-projects', id: 'WO-01-005', deps: ['WO-01-001', 'WO-01-002', 'WO-01-004'] },
  { frd: 'frd-02-tasks', id: 'WO-02-001', deps: ['WO-01-004'] },
  { frd: 'frd-02-tasks', id: 'WO-02-002', deps: ['WO-01-001', 'WO-01-002', 'WO-01-004', 'WO-02-001'] },
  { frd: 'frd-03-search-filters', id: 'WO-03-001', deps: ['WO-02-001'] },
  { frd: 'frd-03-search-filters', id: 'WO-03-002', deps: ['WO-02-002', 'WO-03-001'] },
  { frd: 'frd-04-dashboard', id: 'WO-04-001', deps: ['WO-01-001', 'WO-01-002', 'WO-01-003'] },
]
console.log('lanes-k-reevaluated-when-width-grows: the medium-bench DAG at --lanes 2 starts narrow on main, then runs two lanes wherever it is two wide')
{
  const r = mkRepo(BENCH_MEDIUM)
  const L2 = ['--lanes', '2', '--mode', 'balanced']
  const schedule = []
  const step = (n) => {
    const x = n.receipt
    schedule.push(`K=${x.k} (${x.kReason}, width ${x.width}): ${[x.barrier && x.barrier.wos.join('+') + ' on main', ...(x.dispatched || []).map((d) => `${d.wos.join('+')} in lane ${d.lane}`)].filter(Boolean).join(' ∥ ') || 'nothing new'}`)
    return x
  }
  const built = (_r, d) => { for (const w of d.wos) if (r.buildIn(d.lane, w, fileFor(w)).code !== 0) throw new Error(`commit-wo ${w}`); return r.run('lane-mark', ['--chain', d.chain, '--as', 'built']) }
  const landed = (chain) => r.run('land-chain', ['--chain', chain]).receipt.status === 'landed'
  const onMain = (id, files) => { for (const [rel, c] of Object.entries(files)) r.write(rel, c); return r.run('commit-wo', ['--wo', id, '--files', Object.keys(files).join(',')]).code === 0 }
  const lanesOf = (x) => (x.dispatched || []).map((d) => d.wos.join('+')).sort().join(' | ')
  try {
    const p = r.run('lane-plan', L2)
    ok(p.code === 0 && p.receipt.kRun === 2 && p.receipt.kRunReason === 'requested', `the run's lane ceiling is 2: the DAG is wide later (offPath ${p.receipt.offPath}) (${p.receipt.kRun} ${p.receipt.kRunReason})`)
    ok(p.receipt.k === 1 && p.receipt.kReason === 'narrow-step' && p.receipt.width === 1, `this step is narrow: K = 1 now, not for the run (${p.receipt.k} ${p.receipt.kReason} width ${p.receipt.width})`)
    ok(JSON.stringify(chainWos(p)) === '[["WO-01-001"]]', `the head chain stops before its two children, so they can build in parallel next (${JSON.stringify(chainWos(p))})`)
    ok(p.receipt.dispatch.main === 'c-wo-01-001' && p.receipt.dispatch.lanes.length === 0, 'a narrow step builds on main: no lane, no landing to pay')
    ok(r.run('lane-pool', ['--size', String(p.receipt.kRun)]).code === 0, 'the pool boots for the run\'s ceiling, beside the first chain')
    const s1 = step(r.run('lane-next', L2))
    ok(s1.k === 1 && s1.barrier && s1.barrier.chain === 'c-wo-01-001' && s1.barrier.onMain === 'narrow-step' && s1.dispatched.length === 0, `round 1: WO-01-001 on main, both lanes stay free (${JSON.stringify(s1.barrier)})`)
    ok(onMain('WO-01-001', fileFor('WO-01-001')), 'WO-01-001 commits on main')
    const s2 = step(r.run('lane-next', L2))
    ok(s2.k === 2 && s2.kReason === 'requested' && s2.barrier && s2.barrier.chain === 'c-wo-01-003' && s2.barrier.onMain === 'schema' && lanesOf(s2) === 'WO-01-002', `round 2: the width grew to 2: the schema barrier on main ∥ WO-01-002 in a lane (K ${s2.k}, ${lanesOf(s2)})`)
    ok(built(r, s2.dispatched[0]).code === 0 && onMain('WO-01-003', { 'prisma/schema.prisma': 'model P { id Int @id }\n' }) && landed(s2.dispatched[0].chain), 'the barrier commits on main, then WO-01-002 lands')
    const s3 = step(r.run('lane-next', L2))
    ok(s3.k === 2 && lanesOf(s3) === 'WO-01-004 | WO-04-001', `round 3: two lanes, WO-01-004 ∥ WO-04-001 (another FRD, its deps met by the foundation) (${lanesOf(s3)})`)
    const d004 = s3.dispatched.find((d) => d.wos[0] === 'WO-01-004')
    const d041 = s3.dispatched.find((d) => d.wos[0] === 'WO-04-001')
    ok(built(r, d004).code === 0 && built(r, d041).code === 0 && landed(d004.chain), 'both build; WO-01-004 lands first, WO-04-001 still holds its lane')
    const s4 = step(r.run('lane-next', L2))
    ok(s4.k === 2 && lanesOf(s4) === 'WO-02-001' && s4.barrier === null, `round 4: one slot left under K = 2 (WO-04-001 holds the other): WO-02-001 (longest path) gets it; WO-01-005 waits, never a third builder on main (${lanesOf(s4)})`)
    ok(built(r, s4.dispatched[0]).code === 0 && landed(d041.chain) && landed(s4.dispatched[0].chain), 'WO-04-001 and WO-02-001 land')
    const s5 = step(r.run('lane-next', L2))
    ok(s5.k === 2 && lanesOf(s5) === 'WO-02-002 | WO-03-001', `round 5: WO-02-002 ∥ WO-03-001 (both feed WO-03-002) (${lanesOf(s5)})`)
    ok(s5.dispatched.every((d) => built(r, d).code === 0) && s5.dispatched.every((d) => landed(d.chain)), 'both land')
    const s6 = step(r.run('lane-next', L2))
    ok(s6.k === 2 && lanesOf(s6) === 'WO-01-005 | WO-03-002', `round 6: WO-01-005 ∥ WO-03-002 (${lanesOf(s6)})`)
    ok(s6.offPath === 1 && s6.kRun === 2, `the gain is judged on the REMAINING DAG at every round (offPath ${s6.offPath}): the pool is up, so one WO beside the path still earns its lane (kRun ${s6.kRun})`)
    ok(s6.dispatched.every((d) => built(r, d).code === 0) && s6.dispatched.every((d) => landed(d.chain)), 'both land')
    ok(r.run('lane-plan', L2).receipt.remaining === 0, 'all ten built')
    const feats = r.subjects().filter((s) => s.startsWith('feat('))
    ok(feats.length === 10 && BENCH_MEDIUM.every((w) => feats.filter((s) => s.includes(w.id)).length === 1), 'main holds exactly one feat commit per WO')
    ok(schedule.length === 6, `six rounds for ten WOs (sequential: ten): ${schedule.map((x, i) => `\n      ${i + 1}. ${x}`).join('')}`)
  } finally { r.cleanup() }
}
console.log('auto-k1-on-narrow-dag (per step): a DAG narrow throughout never lanes at any round; each chain builds on main')
{
  const r = mkRepo([
    { frd: 'frd-02-b', id: 'WO-02-001' }, { frd: 'frd-02-b', id: 'WO-02-002', deps: ['WO-02-001'] },
    { frd: 'frd-03-c', id: 'WO-03-001', deps: ['WO-02-002'] },
  ])
  try {
    const L2 = ['--lanes', '2', '--mode', 'balanced']
    r.run('lane-pool', ['--size', '2'])
    const seen = []
    for (let i = 0; i < 4 && r.run('lane-plan', L2).receipt.remaining > 0; i++) {
      const n = r.run('lane-next', L2).receipt
      seen.push(`${n.k}/${n.kReason}/${n.barrier ? `${n.barrier.wos.join('+')}@${n.barrier.onMain}` : '-'}/${n.dispatched.length}`)
      if (!n.barrier || n.dispatched.length) break
      for (const w of n.barrier.wos) {
        for (const [rel, c] of Object.entries(fileFor(w))) r.write(rel, c)
        if (r.run('commit-wo', ['--wo', w, '--files', Object.keys(fileFor(w)).join(',')]).code !== 0) throw new Error(`commit-wo ${w}`)
      }
    }
    ok(JSON.stringify(seen) === JSON.stringify(['1/narrow-dag/WO-02-001+WO-02-002@narrow-step/0', '1/narrow-dag/WO-03-001@narrow-step/0']), `every round K = 1 (narrow-dag), each chain on main, no lane ever dispatched (${seen.join(', ')})`)
    ok(r.run('lane-plan', L2).receipt.remaining === 0 && r.git('branch', '--list', 'lane/*') === '', 'all built on main; no lane branch was ever created')
  } finally { r.cleanup() }
}
console.log('cross-frd-ready-wo-gets-a-lane: a WO of another FRD whose deps are met takes the free lane while FRD-02 builds')
{
  const r = mkRepo([
    { frd: 'frd-01-a', id: 'WO-01-001', status: 'IN_REVIEW' },
    { frd: 'frd-02-b', id: 'WO-02-001', deps: ['WO-01-001'] }, { frd: 'frd-02-b', id: 'WO-02-002', deps: ['WO-02-001'] },
    { frd: 'frd-03-c', id: 'WO-03-001', deps: ['WO-02-002'] },
    { frd: 'frd-04-d', id: 'WO-04-001', deps: ['WO-01-001'] },
  ])
  try {
    r.run('lane-pool', ['--size', '2'])
    ok(r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-02-001', '--wo', 'WO-02-002']).code === 0, 'FRD-02 builds in lane 1')
    const n = r.run('lane-next', ['--lanes', '2', '--mode', 'balanced', '--frd', 'frd-01-a', '--frd', 'frd-02-b', '--frd', 'frd-03-c', '--frd', 'frd-04-d']).receipt
    ok(n.k === 2 && n.dispatched.length === 1 && n.dispatched[0].wos[0] === 'WO-04-001' && n.dispatched[0].lane === 2 && n.barrier === null, `WO-04-001 (FRD-04) gets lane 2 at once (${JSON.stringify(n.dispatched.map((d) => [d.wos, d.lane]))} K ${n.k} ${n.kReason})`)
  } finally { r.cleanup() }
}

// ── bootstrap-owned files (bench FM-6) ──────────────────────────────────────────────────────────
// The shipped worktree-bootstrap.sh rewrites files a project may TRACK (.claude/launch.json with the lane's ports,
// e2e/server-env.json's PORT) and writes untracked ones (.env.local). In a lane they are the lane's own config: never a
// builder's dirt, never landed on main, never a landing refusal. Real dirt is still refused.
const launchJson = (port) => `${JSON.stringify({ version: '0.0.1', configurations: [{ name: 'app', runtimeExecutable: 'pnpm', runtimeArgs: ['dev', '--port', String(port)], port }] }, null, 2)}\n`
// The landing's own lane_land journal line stays pending on main by design (swept by the next commit).
const mainDirt = (r) => r.git('status', '--porcelain', '--', '.', ':!.pandacorp/track.jsonl')
const BOOT_FILES = { '.claude/launch.json': launchJson(3000), 'e2e/server-env.json': '{\n  "PORT": "3900"\n}\n', 'package.json': '{ "name": "fixture", "private": true }\n', 'factory/README.md': 'factory\n' }
console.log('lane-bootstrap-tracked-launch-json-still-lands: the second lane\'s bootstrap rewrites a TRACKED launch.json; the chain lands, main\'s launch.json is untouched')
{
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-02-b', id: 'WO-02-001' }], { flat: true, realBootstrap: true, files: BOOT_FILES })
  const servers = []
  const listen = (port) => new Promise((resolve) => { const s = net.createServer(); s.listen(port, '127.0.0.1', () => { servers.push(s); resolve() }) })
  try {
    const pool = r.run('lane-pool', ['--size', '2'])
    ok(pool.code === 0 && pool.receipt.status === 'ready' && pool.receipt.failures.length === 0, `the real bootstrap readies both lanes (${pool.line.slice(0, 300)})`)
    const laneLaunch = (n) => r.read('.claude/launch.json', r.laneWt(n))
    ok([1, 2].every((n) => /"autoPort": true/.test(laneLaunch(n) || '')), 'the bootstrap rewrote the tracked .claude/launch.json in each lane (autoPort)')
    const tracked = (n) => r.gitAt(r.laneWt(n))('status', '--porcelain', '--untracked-files=no')
    ok([1, 2].every((n) => tracked(n) === ''), `yet no lane shows a modified tracked file: launch.json and server-env.json are hidden (${[1, 2].map(tracked).join(' | ')})`)
    // A leftover server on lane 2's port: its dispatch moves it to a free port and RE-BOOTSTRAPS after the dirt salvage
    // (the FM-6 path: the rewrite happens after the lane was reset).
    await listen(pool.receipt.pool[1].port)
    const d1 = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-01-001'])
    const d2 = r.run('lane-dispatch', ['--lane', '2', '--wo', 'WO-02-001'])
    ok(d1.code === 0 && d2.code === 0 && d2.receipt.resync.ran.includes('bootstrap'), `both dispatched; lane 2 re-bootstrapped on its new port (${JSON.stringify(d2.receipt.resync && d2.receipt.resync.ran)})`)
    ok(d1.receipt.salvaged === null && d2.receipt.salvaged === null, `no bootstrap-owned file is salvaged as a builder's dirt (${JSON.stringify([d1.receipt.salvaged, d2.receipt.salvaged])})`)
    ok(/"autoPort": true/.test(laneLaunch(2) || ''), 'lane 2 keeps its own launch.json after the dispatch')
    for (const [n, w] of [[1, 'WO-01-001'], [2, 'WO-02-001']]) {
      const b = r.buildIn(n, w, fileFor(w))
      ok(b.code === 0, `${w} committed in lane ${n} (${b.receipt.status} ${b.receipt.reason || ''})`)
      ok(r.run('lane-mark', ['--chain', `c-${w.toLowerCase()}`, '--as', 'built']).code === 0, `${w}'s chain is built`)
    }
    const a = r.run('land-chain', ['--chain', 'c-wo-01-001'])
    ok(a.code === 0 && a.receipt.status === 'landed', `the first chain lands (${a.receipt.status} ${a.receipt.reason || ''})`)
    // The owner edits main's launch.json meanwhile: the second chain's rebase crosses a change to the lane-owned file.
    r.commitMain({ '.claude/launch.json': launchJson(3001) }, 'chore: owner moves the dev port')
    const b = r.run('land-chain', ['--chain', 'c-wo-02-001'])
    ok(b.code === 0 && b.receipt.status === 'landed' && b.sealed, `the second lane's chain lands (${b.receipt.status} ${b.receipt.reason || ''})`)
    ok(r.read('.claude/launch.json') === launchJson(3001), 'main\'s launch.json is exactly the owner\'s, never a lane rewrite')
    ok(r.read('e2e/server-env.json') === BOOT_FILES['e2e/server-env.json'], 'main\'s e2e/server-env.json is untouched')
    ok(r.git('log', '--format=%s', 'main', '--', '.claude/launch.json', 'e2e/server-env.json', '.env.local') === 'chore: owner moves the dev port\nchore: init project', 'no landed commit carries a bootstrap-owned file')
    ok(mainDirt(r) === '', `main\'s tree is clean but for the pending journal line (${mainDirt(r)})`)
    ok(/"autoPort": true/.test(laneLaunch(2) || '') && tracked(2) === '', `the lane keeps its own launch.json after the landing, still hidden (${tracked(2)})`)
    const feats = r.subjects().filter((x) => x.startsWith('feat('))
    ok(feats.length === 2, 'one feat commit per WO on main')
  } finally { for (const s of servers) s.close(); r.cleanup() }
}
console.log('lane-dirty-real-work-still-refused: real uncommitted work is refused (named exactly); a bootstrap rewrite committed in the lane never lands')
{
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }], { flat: true, realBootstrap: true, files: BOOT_FILES })
  try {
    r.run('lane-pool', ['--size', '1'])
    const d = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-01-001'])
    ok(r.buildIn(1, 'WO-01-001', fileFor('WO-01-001')).code === 0 && r.run('lane-mark', ['--chain', d.receipt.chain, '--as', 'built']).code === 0, 'the chain is built')
    const lw = r.laneWt(1)
    writeFileSync(path.join(lw, 'factory/README.md'), 'factory\nhalf-done edit\n')
    writeFileSync(path.join(lw, 'src/stray.ts'), 'export const s = 1\n')
    const head = r.git('rev-parse', 'HEAD')
    const red = r.run('land-chain', ['--chain', d.receipt.chain])
    ok(red.code === 4 && red.receipt.status === 'lane-dirty' && red.receipt.bootstrapOnly === false && red.sealed, `real dirt is refused, not as bootstrap-only (${red.receipt.status} ${red.receipt.bootstrapOnly})`)
    ok(JSON.stringify([...(red.receipt.paths || [])].sort()) === '["factory/README.md","src/stray.ts"]', `it names exactly the real dirt, never a bootstrap-owned file (${JSON.stringify(red.receipt.paths)})`)
    ok(r.git('rev-parse', 'HEAD') === head, 'main is untouched')
    // Clean the real dirt, then smuggle the bootstrap's launch.json into the WO's commit: it must never reach main.
    r.gitAt(lw)('checkout', '--', 'factory/README.md')
    rmSync(path.join(lw, 'src/stray.ts'))
    const lg = r.gitAt(lw)
    lg('update-index', '--no-skip-worktree', '.claude/launch.json')
    lg('add', '.claude/launch.json')
    lg('commit', '-q', '--amend', '--no-edit')
    const leak = r.run('land-chain', ['--chain', d.receipt.chain])
    ok(leak.code === 4 && leak.receipt.status === 'bootstrap-leak' && (leak.receipt.paths || []).includes('.claude/launch.json'), `a committed bootstrap rewrite is refused (${leak.receipt.status} ${leak.receipt.reason || ''})`)
    ok(r.git('rev-parse', 'HEAD') === head && r.read('.claude/launch.json') === BOOT_FILES['.claude/launch.json'], 'main and its launch.json are untouched')
  } finally { r.cleanup() }
}
console.log('lane-bootstrap-owned-unproven: a lane whose owned-set record is gone (an older bootstrap) is re-proven by its bootstrap at landing, then lands')
{
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-02-b', id: 'WO-02-001' }], { flat: true, realBootstrap: true, files: BOOT_FILES })
  try {
    r.run('lane-pool', ['--size', '2'])
    const d = r.run('lane-dispatch', ['--lane', '1', '--wo', 'WO-01-001'])
    r.buildIn(1, 'WO-01-001', fileFor('WO-01-001'))
    r.run('lane-mark', ['--chain', d.receipt.chain, '--as', 'built'])
    const lg = r.gitAt(r.laneWt(1))
    rmSync(path.join(lg('rev-parse', '--absolute-git-dir'), 'pandacorp-bootstrap-owned.json'), { force: true })
    lg('update-index', '--no-skip-worktree', '.claude/launch.json')
    ok(lg('status', '--porcelain').includes('.claude/launch.json'), 'the legacy lane shows its bootstrap rewrite as dirt')
    const land = r.run('land-chain', ['--chain', d.receipt.chain])
    ok(land.code === 0 && land.receipt.status === 'landed', `it lands after the bootstrap re-proves the file (${land.receipt.status} ${land.receipt.reason || ''})`)
    ok(r.read('.claude/launch.json') === BOOT_FILES['.claude/launch.json'] && mainDirt(r) === '', `main\'s launch.json is untouched, its tree clean (${mainDirt(r)})`)
  } finally { r.cleanup() }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Bench FM-7: host verify slots, a sequential bisect, the timeout re-run, and a pre-existing red of another FRD.
// ════════════════════════════════════════════════════════════════════════════════════════════════
const VERIFY_MOD = path.join(__dirname, 'build-mech-verify.mjs')
const LIB_MOD = path.join(__dirname, 'build-mech-lib.mjs')
/** The fixture verify.sh's report writers: green, or red naming vitest failure rows. */
const VERIFY_HEAD = '#!/bin/sh\nmkdir -p .pandacorp/run\nsha=$(git rev-parse HEAD)\ngreen() { printf \'{"sha":"%s","green":true,"scope":"full","subgates":[]}\' "$sha" > .pandacorp/run/gate-report.json; exit 0; }\nred() { printf \'{"sha":"%s","green":false,"scope":"full","subgates":[{"name":"vitest","exit":1,"failures":[%s]}]}\' "$sha" "$1" > .pandacorp/run/gate-report.json; exit 1; }\n'
const row = (file, msg) => `{"file":"${file}","msg":"${msg}"}`

console.log('verify-slots-cap-concurrency: N concurrent full verifies never run more than the slot count at once; a dead holder\'s slot is reclaimed')
{
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'lanes-slots-'))
  const active = path.join(scratch, 'active')
  const maxLog = path.join(scratch, 'max.log')
  const verify = `#!/bin/sh\nmkdir -p "${active}" .pandacorp/run\ntouch "${active}/$$"\nls "${active}" | wc -l | tr -d ' ' >> "${maxLog}"\nsleep 0.4\nrm -f "${active}/$$"\nprintf '{"sha":"%s","green":true,"scope":"full","subgates":[]}' "$(git rev-parse HEAD)" > .pandacorp/run/gate-report.json\nexit 0\n`
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }], { verify })
  try {
    // A crashed holder's residue: slot-0 owned by a pid that is gone. Unreclaimed, it would cap the run at ONE slot.
    const dead = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' }).stdout
    mkdirSync(path.join(r.proj, '.pandacorp', 'run', 'verify-slots', 'slot-0'), { recursive: true })
    writeFileSync(path.join(r.proj, '.pandacorp', 'run', 'verify-slots', 'slot-0', 'owner.json'), JSON.stringify({ owner: 'dead', op: 'crashed', pid: Number(dead), at: new Date().toISOString() }))
    const code = `const { projectCtx } = await import(${JSON.stringify(LIB_MOD)}); const { runVerify } = await import(${JSON.stringify(VERIFY_MOD)}); const v = await runVerify(projectCtx(process.argv[1]), { cwd: process.argv[1], timeoutMs: 60000, op: 'slot-test' }); console.log(JSON.stringify({ code: v.code }))`
    const N = 5
    const runs = await Promise.all(Array.from({ length: N }, () => new Promise((resolve) => {
      const p = spawn(process.execPath, ['--input-type=module', '-e', code, r.proj], { env: { ...process.env, PANDACORP_VERIFY_SLOTS: '2' }, stdio: ['ignore', 'pipe', 'pipe'] })
      let out = ''
      p.stdout.on('data', (b) => { out += b })
      p.on('close', (c) => resolve({ c, out }))
    })))
    const seen = readFileSync(maxLog, 'utf8').trim().split('\n').map(Number)
    ok(runs.every((x) => x.c === 0 && /"code":0/.test(x.out)) && seen.length === N, `all ${N} callers ran their verify (exits ${runs.map((x) => x.c).join(',')}, ${seen.length} runs)`)
    ok(Math.max(...seen) <= 2, `never more than 2 verifies at once (observed ${seen.join(',')})`)
    ok(Math.max(...seen) === 2, `the dead holder's slot was reclaimed: 2 ran side by side (observed max ${Math.max(...seen)})`)
    ok(readdirSync(path.join(r.proj, '.pandacorp', 'run', 'verify-slots')).length === 0, 'every slot is released afterwards')
  } finally { r.cleanup(); rmSync(scratch, { recursive: true, force: true }) }
}

console.log('bisect-is-sequential-and-base-first: a verify that fails when another runs beside it stays green under the bisect; the base runs first')
{
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'lanes-seq-'))
  const busy = path.join(scratch, 'busy')
  const order = path.join(scratch, 'order.log')
  const verify = `${VERIFY_HEAD}if ! mkdir "${busy}" 2>/dev/null; then echo "another verify.sh is running"; red '${row('src/_tests/db.test.ts', 'migrate deploy contended')}'; fi\necho "$sha" >> "${order}"\nsleep 0.3\nrmdir "${busy}"\ngreen\n`
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-02-b', id: 'WO-02-001' }, { frd: 'frd-03-c', id: 'WO-03-001' }], { verify })
  try {
    r.run('lane-pool', ['--size', '1'])
    const a = landOne(r, 1, ['WO-01-001'], fileFor)
    const b = landOne(r, 1, ['WO-02-001'], fileFor)
    const c = landOne(r, 1, ['WO-03-001'], fileFor)
    ok([a, b, c].every((x) => x.land.code === 0), 'three chains landed')
    const bis = r.run('lane-bisect', ['--sha', r.git('rev-parse', 'HEAD'), ...[a, b, c].flatMap((x) => ['--candidate', x.d.receipt.chain])], { PANDACORP_VERIFY_SLOTS: '4' })
    ok(bis.code === 0 && bis.sealed && bis.receipt.status === 'not-reproduced', `with slots to spare the verifies still run one at a time: not-reproduced (${bis.receipt.status} ${JSON.stringify((bis.receipt.results || []).map((x) => x.green))})`)
    ok(bis.receipt.results[0].label === 'base' && bis.receipt.results[0].green === true, 'the base is green')
    const ran = readFileSync(order, 'utf8').trim().split('\n')
    ok(ran.length === 4 && ran[0].startsWith(a.land.receipt.base), `four verifies, the base's first (${ran.map((x) => x.slice(0, 12)).join(' → ')})`)
  } finally { r.cleanup(); rmSync(scratch, { recursive: true, force: true }) }
}

console.log('usable-timeout-rerun-is-flaky-contention: a timeout red whose failing file passes alone is flaky-contention (no candidates), then the full re-run decides')
{
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'lanes-flaky-'))
  const count = path.join(scratch, 'count')
  const verify = `${VERIFY_HEAD}n=$(cat "${count}" 2>/dev/null || echo 0); n=$((n + 1)); echo $n > "${count}"\nif [ "$n" -eq 1 ] || [ -n "$ALWAYS_TIMEOUT" ]; then echo " FAIL  src/_tests/db.test.ts > migrate deploy"; echo "Error: Test timed out in 5000ms."; red '${row('src/_tests/db.test.ts', 'migrate deploy')}'; fi\ngreen\n`
  const r = mkRepo([{ frd: 'frd-01-a', id: 'WO-01-001' }, { frd: 'frd-02-b', id: 'WO-02-001' }], { verify })
  try {
    r.run('lane-pool', ['--size', '1'])
    const a = landOne(r, 1, ['WO-01-001'], fileFor)
    ok(a.land.code === 0, 'a chain landed')
    const u = r.run('lane-usable', ['--frd', 'frd-01-a', '--wo', 'WO-01-001'])
    ok(u.code === 0 && u.sealed && u.receipt.status === 'flaky-contention', `the timeout red is flaky-contention (${u.receipt.status} ${u.receipt.failure || ''})`)
    ok(JSON.stringify(u.receipt.candidates) === '[]' && u.receipt.class === null, `no bisect candidates, no class (${JSON.stringify(u.receipt.candidates)} ${u.receipt.class})`)
    ok(r.toolCalls().some((l) => l === 'vitest run src/_tests/db.test.ts'), `only the failing file re-ran, alone (${r.toolCalls().filter((l) => l.startsWith('vitest')).join(' | ')})`)
    ok(readFileSync(count, 'utf8').trim() === '2' && u.receipt.green === true && u.receipt.usable === true && JSON.stringify(u.receipt.flaky) === '{"files":["src/_tests/db.test.ts"],"fullRerun":"green"}', `the full verify ran once more and that green run is the verdict: USABLE (${readFileSync(count, 'utf8').trim()} runs, ${JSON.stringify(u.receipt.flaky)})`)
    // The same signature whose file still fails alone is a real red: candidates, never masked as contention.
    writeFileSync(count, '0')
    const b = landOne(r, 1, ['WO-02-001'], fileFor)
    const red = r.run('lane-usable', ['--frd', 'frd-02-b', '--wo', 'WO-02-001'], { FAIL_TOOLS: 'vitest' })
    ok(red.receipt.status === 'red' && red.receipt.green === false && red.receipt.usable === false && !red.receipt.flaky && JSON.stringify(red.receipt.candidates) === JSON.stringify([b.d.receipt.chain]), `a timeout whose file fails alone too stays red with its candidates (${red.receipt.status} ${JSON.stringify(red.receipt.candidates)})`)
    ok(readFileSync(count, 'utf8').trim() === '1', 'no full re-run after a failed isolated re-run')
    ok(JSON.parse(readFileSync(path.join(r.proj, '.pandacorp', 'run', 'lanes', 'snapshot', 'proj', '.pandacorp', 'run', 'gate-report.json'), 'utf8')).green === false, 'the first run\'s report is kept on disk')
  } finally { r.cleanup(); rmSync(scratch, { recursive: true, force: true }) }
}

console.log('preexisting-red-in-other-frd-does-not-block-usable: a red only on another FRD\'s test, red at the base too, leaves this FRD USABLE')
{
  const verify = `${VERIFY_HEAD}f=''\n[ -f src/a-broken.txt ] && f='${row('src/_tests/a.test.ts', 'expected 1 got 2')}'\n[ -f src/b-broken.txt ] && f="\${f:+$f,}${row('src/_tests/b.test.ts', 'expected 3 got 4').replace(/"/g, '\\"')}"\n[ -n "$f" ] && red "$f"\ngreen\n`
  const r = mkRepo([
    { frd: 'frd-01-a', id: 'WO-01-001', artifacts: ['src/a.ts', 'src/_tests/a.test.ts'] },
    { frd: 'frd-02-b', id: 'WO-02-001', artifacts: ['src/b.ts', 'src/_tests/b.test.ts'] },
    { frd: 'frd-03-c', id: 'WO-03-001', artifacts: ['src/c.ts', 'src/b-broken.txt'] },
  ], { verify })
  try {
    r.run('lane-pool', ['--size', '1'])
    const a = landOne(r, 1, ['WO-01-001'], () => ({ 'src/a.ts': 'export const a = 1\n', 'src/_tests/a.test.ts': 'test\n' }))
    ok(a.land.code === 0 && r.run('lane-usable', ['--frd', 'frd-01-a', '--wo', 'WO-01-001']).receipt.green === true, 'FRD-01 is green at its pin')
    r.commitMain({ 'src/a-broken.txt': 'x\n' }, 'chore: another writer breaks an FRD-01 test on main')
    const b = landOne(r, 1, ['WO-02-001'], () => ({ 'src/b.ts': 'export const b = 1\n', 'src/_tests/b.test.ts': 'test\n' }))
    ok(b.land.code === 0, 'FRD-02 landed on top of the break')
    const pin = r.git('rev-parse', 'HEAD')
    const red = r.run('lane-usable', ['--frd', 'frd-02-b', '--wo', 'WO-02-001'])
    ok(red.receipt.status === 'red' && red.receipt.usable === false && red.receipt.foreign === true && JSON.stringify(red.receipt.failing) === JSON.stringify([{ file: 'src/_tests/a.test.ts', frd: 'frd-01-a', wo: 'WO-01-001' }]), `red on FRD-01's test, its owner named (${JSON.stringify(red.receipt.failing)})`)
    const early = r.run('lane-usable', ['--frd', 'frd-02-b', '--wo', 'WO-02-001', '--sha', pin, '--preexisting'])
    ok(early.code === 4 && early.receipt.status === 'no-preexisting-proof', `no bisect yet: nothing certified (${early.receipt.status})`)
    const bis = r.run('lane-bisect', ['--sha', pin, '--frd', 'frd-02-b', ...red.receipt.candidates.flatMap((x) => ['--candidate', x])])
    ok(bis.receipt.status === 'pre-existing' && bis.receipt.results[0].green === false && JSON.stringify(bis.receipt.results[0].failing) === '["src/_tests/a.test.ts"]', `the base is red on the same test: pre-existing (${bis.receipt.status} ${JSON.stringify(bis.receipt.results[0].failing)})`)
    ok(bis.receipt.preexisting && bis.receipt.preexisting.unblocks === true && bis.receipt.preexisting.owners[0].frd === 'frd-01-a' && bis.receipt.preexisting.owners[0].wo === 'WO-01-001', `it unblocks FRD-02 and routes to FRD-01's WO-01-001 (${JSON.stringify(bis.receipt.preexisting)})`)
    const u = r.run('lane-usable', ['--frd', 'frd-02-b', '--wo', 'WO-02-001', '--sha', pin, '--preexisting'])
    ok(u.code === 0 && u.sealed && u.receipt.status === 'usable-preexisting' && u.receipt.usable === true && u.receipt.green === false, `FRD-02 is USABLE although the tree is red (${u.receipt.status} ${u.receipt.usable} ${u.receipt.reason || ''})`)
    const line = r.read('.pandacorp/track.jsonl').trim().split('\n').map((l) => JSON.parse(l)).filter((j) => j.kind === 'build_usable' && j.frd === 'frd-02-b')
    ok(line.length === 1 && line[0].sha === pin.slice(0, 12) && JSON.stringify(line[0].preexisting.files) === '["src/_tests/a.test.ts"]' && /pre-existing failures/.test(r.git('log', '-1', '--format=%B')), 'the committed build_usable line names the pin and the pre-existing files')
    // A new failure of its own (not red at the base) still blocks this FRD's USABLE.
    const c = landOne(r, 1, ['WO-03-001'], () => ({ 'src/c.ts': 'export const c = 1\n', 'src/b-broken.txt': 'x\n' }))
    const pin2 = r.git('rev-parse', 'HEAD')
    const red2 = r.run('lane-usable', ['--frd', 'frd-03-c', '--wo', 'WO-03-001'])
    ok(red2.receipt.status === 'red' && red2.receipt.failing.length === 2, `FRD-03's red names both failing tests (${JSON.stringify(red2.receipt.failing)})`)
    const bis2 = r.run('lane-bisect', ['--sha', pin2, '--frd', 'frd-03-c', ...red2.receipt.candidates.flatMap((x) => ['--candidate', x])])
    ok(bis2.receipt.status === 'pre-existing' && bis2.receipt.preexisting.unblocks === false && JSON.stringify(bis2.receipt.preexisting.newFailures) === '["src/_tests/b.test.ts"]', `a failure the base does not have blocks (${JSON.stringify(bis2.receipt.preexisting)})`)
    const u2 = r.run('lane-usable', ['--frd', 'frd-03-c', '--wo', 'WO-03-001', '--sha', pin2, '--preexisting'])
    ok(u2.code === 0 && u2.receipt.status === 'red' && u2.receipt.usable === false, `not USABLE (${u2.receipt.status})`)
    ok(!r.read('.pandacorp/track.jsonl').split('\n').some((l) => l.includes('"kind":"build_usable","frd":"frd-03-c"')), 'no build_usable line for it')
  } finally { r.cleanup() }
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
