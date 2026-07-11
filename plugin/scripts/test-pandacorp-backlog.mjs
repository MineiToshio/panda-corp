#!/usr/bin/env node
// Exact offline spike for the Claude-owned drain-all workflow. It executes the
// production engine source with injected Dynamic Workflow globals, while the
// agent seam performs real Git worktree/rebase/merge/reset operations inside a
// disposable repository. No factory checkout state is mutated.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ENGINE_PATH = path.resolve(HERE, '../../.claude/engines/pandacorp-backlog.js')
const ROOT = path.resolve(HERE, '../..')
let source = readFileSync(ENGINE_PATH, 'utf8').replace(/^export\s+const\s+meta/m, 'const meta')
if (/^\s*(export|import)\b/m.test(source)) throw new Error('engine loader: unexpected ESM syntax')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const engine = new AsyncFunction('agent', 'log', 'args', 'phase', 'parallel', source)

const tmp = mkdtempSync(path.join(os.tmpdir(), 'pandacorp-backlog-r8-'))
const repo = path.join(tmp, 'factory')
const backlog = path.join(repo, 'factory/backlog')
const worktrees = path.join(repo, '.claude/worktrees')
let passed = 0
let failed = 0

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
function ok(condition, message) {
  if (condition) { passed++; console.log(`PASS: ${message}`) }
  else { failed++; console.error(`FAIL: ${message}`) }
}
function item(id, status, severity, title) {
  return `---\nid: ${id}\ntype: change\narea: test\ntitle: "${title}"\nstatus: ${status}\nseverity: ${severity}\nopened: 2026-07-11\nclosed:\ncloses:\n---\n\n## Fix plan\n\nFixture change.\n\n## Tests\n\nRun validator.\n\n## Done when\n\n- Valid.\n`
}
function parseFrontmatter(file) {
  const body = readFileSync(file, 'utf8')
  const value = (key) => body.match(new RegExp(`^${key}:\\s*["']?([^\\n"']+)`, 'm'))?.[1]?.trim()
  return { id: value('id'), title: value('title'), status: value('status'), severity: value('severity') }
}
function replaceStatus(file, status) {
  const body = readFileSync(file, 'utf8').replace(/^status:\s*\w+/m, `status: ${status}`)
  writeFileSync(file, body)
}
function validateMain() {
  return readdirSync(backlog).filter((f) => /^BL-.*\.md$/.test(f)).every((f) => {
    const body = readFileSync(path.join(backlog, f), 'utf8')
    return !body.includes('INVALID') && /^status:\s*(open|doing|done)$/m.test(body)
  })
}

mkdirSync(backlog, { recursive: true })
mkdirSync(worktrees, { recursive: true })
writeFileSync(path.join(repo, '.gitignore'), '.claude/worktrees/\n')
writeFileSync(path.join(backlog, 'BL-1001-mech.md'), item('BL-1001', 'open', 'p3', 'Mechanical fixture'))
writeFileSync(path.join(backlog, 'BL-1002-judge.md'), item('BL-1002', 'open', 'p0', 'Judgment fixture'))
writeFileSync(path.join(backlog, 'BL-1003-done.md'), item('BL-1003', 'done', 'p2', 'Already closed fixture'))
git(repo, 'init', '-b', 'main')
git(repo, 'config', 'user.email', 'r8@example.invalid')
git(repo, 'config', 'user.name', 'R8 fixture')
git(repo, 'add', '.')
git(repo, 'commit', '-m', 'test: seed disposable backlog')

const attempts = new Map()
const observations = {
  calls: [], phases: [], logs: [], implementActive: 0, implementMax: 0,
  mergeActive: 0, mergeMax: 0, ownershipChecks: 0, validatorRuns: 0,
  redBoundary: null, redRestored: null, reused: false,
}
let gitQueue = Promise.resolve()
function serializeGit(fn) {
  const next = gitQueue.then(fn, fn)
  gitQueue = next.catch(() => {})
  return next
}
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

async function agent(prompt, opts = {}) {
  observations.calls.push({ label: opts.label, model: opts.model, prompt: String(prompt) })
  if (opts.label === 'scan') {
    const tiers = { p3: 'haiku', p2: 'sonnet', p1: 'sonnet', p0: 'opus' }
    const items = readdirSync(backlog).filter((f) => /^BL-.*\.md$/.test(f)).sort().map((name) => {
      const file = path.join(backlog, name)
      const fm = parseFrontmatter(file)
      return { id: fm.id, path: file, title: fm.title, status: fm.status, tier: tiers[fm.severity] }
    })
    return { items }
  }
  if (opts.label?.startsWith('implement:')) {
    const id = opts.label.slice('implement:'.length)
    observations.implementActive++
    observations.implementMax = Math.max(observations.implementMax, observations.implementActive)
    await sleep(25) // prove the engine actually overlaps implement thunks
    try {
      const wt = path.join(worktrees, `bl-${id}`)
      const branch = `bl/${id}`
      await serializeGit(async () => {
        const isRegistered = existsSync(wt) && git(wt, 'branch', '--show-current') === branch
        if (isRegistered) {
          observations.reused = true
        } else if (git(repo, 'branch', '--list', branch)) {
          git(repo, 'worktree', 'add', wt, branch)
        } else {
          git(repo, 'worktree', 'add', wt, '-b', branch)
        }
      })
      const common = realpathSync(path.resolve(wt, git(wt, 'rev-parse', '--git-common-dir')))
      observations.ownershipChecks++
      if (common !== realpathSync(path.join(repo, '.git'))) throw new Error('wrong worktree owner')
      const filename = readdirSync(path.join(wt, 'factory/backlog')).find((f) => f.startsWith(id))
      const file = path.join(wt, 'factory/backlog', filename)
      const attempt = (attempts.get(id) || 0) + 1
      attempts.set(id, attempt)
      replaceStatus(file, 'done')
      let body = readFileSync(file, 'utf8').replace(/\nINVALID\n?/g, '\n')
      if (id === 'BL-1002' && attempt === 1) body += '\nINVALID\n'
      writeFileSync(file, body)
      git(wt, 'add', '.')
      git(wt, 'commit', '-m', `fix(backlog): ${id} — fixture attempt ${attempt}`)
      return { id, branch, status: 'done', summary: `attempt ${attempt}` }
    } finally {
      observations.implementActive--
    }
  }
  if (opts.label?.startsWith('merge:')) {
    const id = opts.label.slice('merge:'.length)
    observations.mergeActive++
    observations.mergeMax = Math.max(observations.mergeMax, observations.mergeActive)
    try {
      if (git(repo, 'branch', '--show-current') !== 'main' || git(repo, 'status', '--porcelain')) {
        return { id, merged: false, validator: 'red', reason: 'main checkout is not clean' }
      }
      const wt = path.join(worktrees, `bl-${id}`)
      const branch = `bl/${id}`
      const boundary = git(repo, 'rev-parse', 'HEAD')
      git(wt, 'rebase', 'main')
      git(repo, 'merge', '--ff-only', branch)
      observations.validatorRuns++
      if (!validateMain()) {
        observations.redBoundary = boundary
        const mergedSha = git(repo, 'rev-parse', 'HEAD')
        git(repo, 'reset', '--keep', boundary)
        observations.redRestored = git(repo, 'rev-parse', 'HEAD')
        return { id, merged: false, validator: 'red', reason: 'fixture validator rejected INVALID' }
      }
      git(repo, 'worktree', 'remove', wt)
      git(repo, 'branch', '-d', branch)
      return { id, merged: true, validator: 'green' }
    } finally {
      observations.mergeActive--
    }
  }
  throw new Error(`unexpected agent label: ${opts.label}`)
}

async function runOnce() {
  return engine(
    agent,
    (line) => observations.logs.push(String(line)),
    { factoryRoot: repo },
    (title) => observations.phases.push(title),
    (thunks) => Promise.all(thunks.map((thunk) => thunk())),
  )
}

try {
  const first = await runOnce()
  ok(first.done.map((x) => x.id).join(',') === 'BL-1001', 'first run serially lands the green item')
  ok(first.blocked.some((x) => x.id === 'BL-1002'), 'validator-red item is blocked, not reported done')
  ok(observations.implementMax === 2, 'implementers overlap in the parallel phase')
  ok(observations.mergeMax === 1, 'merge phase never overlaps')
  ok(observations.redBoundary === observations.redRestored, 'validator red restores the exact pre-merge SHA')
  ok(parseFrontmatter(path.join(backlog, 'BL-1001-mech.md')).status === 'done', 'green merge persists canonical done state')
  ok(parseFrontmatter(path.join(backlog, 'BL-1002-judge.md')).status === 'open', 'red merge leaves canonical item actionable')
  ok(observations.calls.find((c) => c.label === 'implement:BL-1001')?.model === 'haiku', 'scan tier controls the mechanical worker model')
  ok(observations.calls.find((c) => c.label === 'implement:BL-1002')?.model === 'opus', 'scan tier controls the judgment worker model')

  const second = await runOnce()
  ok(second.done.map((x) => x.id).join(',') === 'BL-1002', 'relaunch resumes only the still-actionable item')
  ok(second.blocked.length === 0, 'repaired resume finishes green')
  ok(observations.reused, 'resume reuses the validator-red worktree instead of colliding with it')
  ok(!git(repo, 'branch', '--list', 'bl/BL-1002'), 'green merge removes the resumed branch')
  ok(!readFileSync(path.join(backlog, 'BL-1002-judge.md'), 'utf8').includes('INVALID'), 'repaired content reaches main')
  ok(observations.ownershipChecks === 3, 'every implement attempt verifies worktree ownership')
  ok(observations.validatorRuns === 3, 'validator runs after every merge attempt, including resume')
  ok(observations.phases.join(',').includes('Scan,Implement,Merge,Report'), 'exact engine traverses Scan → Implement → Merge → Report')
  ok(/enum:\s*\['open', 'doing', 'done'\]/.test(source), 'scan schema accepts done records required for canonical resume')
  ok(observations.calls.filter((c) => c.label?.startsWith('merge:')).every((c) => /status --porcelain/.test(c.prompt) && /PRE_MERGE_SHA/.test(c.prompt) && /reset --keep/.test(c.prompt) && /ROLLBACK-BLOCKED-BY-CONCURRENT-OWNER-EDIT/.test(c.prompt) && !/update-ref refs\/heads\/main/.test(c.prompt)), 'merge prompt carries clean-main preflight and non-overwriting rollback boundary')
  ok(observations.calls.filter((c) => c.label?.startsWith('implement:')).every((c) => /REUSE it/.test(c.prompt) && /exact same directory/.test(c.prompt) && /rev-parse --git-common-dir/.test(c.prompt) && /wrong repo/.test(c.prompt) && /ambiguous directory/.test(c.prompt)), 'implement prompt carries resume, wrong-owner and ambiguous-path denial checks')
  const collision = path.join(repo, 'rollback-collision.txt')
  writeFileSync(collision, 'base\n'); git(repo, 'add', 'rollback-collision.txt'); git(repo, 'commit', '-m', 'test: rollback collision base'); const collisionBoundary = git(repo, 'rev-parse', 'HEAD')
  writeFileSync(collision, 'merged\n'); git(repo, 'add', 'rollback-collision.txt'); git(repo, 'commit', '-m', 'test: invalid merged collision'); const collisionMerged = git(repo, 'rev-parse', 'HEAD')
  writeFileSync(collision, 'owner concurrent edit\n')
  let keepRejected = false; try { git(repo, 'reset', '--keep', collisionBoundary) } catch { keepRejected = true }
  ok(keepRejected, 'validator-red rollback aborts on a concurrent owner edit')
  ok(readFileSync(collision, 'utf8') === 'owner concurrent edit\n' && git(repo, 'rev-parse', 'HEAD') === collisionMerged, 'rollback abort preserves owner bytes and merged boundary for inspection')
  git(repo, 'reset', '--hard', collisionBoundary)
  const ownership = JSON.parse(readFileSync(path.join(ROOT, 'plugin/runtime/capability-ownership.json'), 'utf8'))
  const policy = JSON.parse(readFileSync(path.join(ROOT, 'plugin/runtime/skill-runtime-policy.json'), 'utf8'))
  const codexRuntimeFiles = readdirSync(path.join(ROOT, 'plugin/runtime/codex'))
  const bl0025 = readFileSync(path.join(ROOT, 'factory/backlog/BL-0025-implement-backlog-plugin-version-allocator.md'), 'utf8')
  ok(ownership.capabilities.factory_backlog_orchestration.runtime_owner === 'claude', 'canonical drain-all owner remains Claude')
  ok(/Single-item mode only/.test(policy.overrides['implement-backlog'].codex.fallback), 'Codex policy exposes only single-item fallback')
  ok(!codexRuntimeFiles.some((name) => /backlog/i.test(name) && /\.(mjs|js|ts)$/.test(name)), 'no partial Codex drain-all executor exists')
  ok(/^status:\s*open$/m.test(bl0025), 'BL-0025 remains honestly open')
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

console.log(`RESULT: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
