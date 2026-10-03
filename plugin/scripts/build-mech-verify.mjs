// build-mech-verify.mjs — bench FM-7: every full verify.sh a mech op runs goes through here.
//   1. Host verify slots: a counting lock (`.pandacorp/run/verify-slots/slot-<i>`, one mkdir per slot, its owner's pid
//      inside) sized max(1, floor(ncpu / 4)), overridable with PANDACORP_VERIFY_SLOTS. Up to four concurrent full suites
//      on a 10-core host (a parallel bisect, another FRD's lane-usable, a gate) pushed two `prisma migrate deploy` tests
//      past vitest's 5 s default: a red that was the host's, not the code's. Waiting for a slot is never a failure; a
//      slot whose owner is dead (or older than SLOT_STALE_MS) is reclaimed.
//   2. The timeout re-run: a red whose output carries a test-timeout signature (vitest "Test timed out", Playwright
//      "Test timeout of …ms exceeded") re-runs ONLY its failing test files, alone, holding a slot. They pass → the red
//      was contention (`flaky-contention`): the full verify.sh runs once more, holding a slot, and that run is the verdict.

import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { InputError, REPORT_REL, Refusal, projectBinEnv } from './build-mech-lib.mjs'

/** A slot older than this is a crashed holder's residue even when its pid was reused (a full verify is bounded below it). */
export const SLOT_STALE_MS = 2 * 60 * 60 * 1000
/** How long a caller waits for a slot before refusing (a refusal certifies nothing either way; it is never a red). */
const SLOT_WAIT_MS = 3 * 60 * 60 * 1000
const SLOT_POLL_MS = 250
/** A slot dir with no readable owner yet (mkdir, then the owner write) is someone's fresh claim for this long. */
const OWNERLESS_GRACE_MS = 60 * 1000
/** A reclaim takes milliseconds: a reclaim lock this old is a crashed reclaimer's. */
const RECLAIM_LOCK_STALE_MS = 30 * 1000
/** vitest's and Playwright's own test-timeout wording: the contention signature. */
export const TIMEOUT_RE = /Test timed out in \d+\s?ms|Test timeout of \d+\s?ms exceeded|Timeout \d+\s?ms exceeded/
const VITEST_FILE_RE = /\.(test|spec)\.[cm]?[jt]sx?$/
const PLAYWRIGHT_RE = /(^|\/)e2e\/.+\.spec\.[cm]?[jt]sx?$/
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** The slot count: PANDACORP_VERIFY_SLOTS (a positive integer) or max(1, floor(ncpu / 4)). */
export function verifySlotCount(env = process.env) {
  const raw = env.PANDACORP_VERIFY_SLOTS
  if (raw !== undefined && raw !== '') {
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 1) throw new InputError(`PANDACORP_VERIFY_SLOTS must be a positive integer, got ${JSON.stringify(raw)}`)
    return n
  }
  const cpus = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length
  return Math.max(1, Math.floor(cpus / 4))
}
export const slotsDir = (ctx) => path.join(ctx.project, '.pandacorp', 'run', 'verify-slots')

const alive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' }
}
/** Is this slot a dead holder's residue: its pid gone, older than SLOT_STALE_MS, or ownerless past the grace? */
function staleSlot(dir) {
  let rec = null
  try { rec = JSON.parse(readFileSync(path.join(dir, 'owner.json'), 'utf8')) } catch { rec = null }
  if (!rec) { try { return Date.now() - statSync(dir).mtimeMs > OWNERLESS_GRACE_MS } catch { return false } }
  const at = Date.parse(rec.at)
  return !alive(rec.pid) || (Number.isFinite(at) && Date.now() - at > SLOT_STALE_MS)
}
/**
 * Remove a stale slot under its own reclaim lock (`slot-<i>.reclaim`, mkdir), re-judged under that lock: a slot is only
 * ever removed by its owner or by the one reclaimer that saw it stale, so two callers can never both claim the slot a
 * dead holder left (a dir that exists cannot be claimed, and only the lock holder removes it).
 */
function reclaim(slot) {
  const lock = `${slot}.reclaim`
  try { mkdirSync(lock) } catch (e) {
    if (e.code !== 'EEXIST') throw e
    try { if (Date.now() - statSync(lock).mtimeMs > RECLAIM_LOCK_STALE_MS) rmSync(lock, { recursive: true, force: true }) } catch { /* gone meanwhile */ }
    return
  }
  try {
    if (!staleSlot(slot)) return
    const tomb = `${slot}.stale-${randomBytes(6).toString('hex')}`
    try { renameSync(slot, tomb); rmSync(tomb, { recursive: true, force: true }) } catch (e) { if (!['ENOENT', 'EEXIST', 'ENOTEMPTY'].includes(e.code)) throw e }
  } finally { rmSync(lock, { recursive: true, force: true }) }
}
/** One pass over the slots: the first free one is taken (a stale one reclaimed first); null when all are held. */
function tryTake(dir, n, owner, op) {
  mkdirSync(dir, { recursive: true })
  for (let i = 0; i < n; i++) {
    const slot = path.join(dir, `slot-${i}`)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        mkdirSync(slot)
        writeFileSync(path.join(slot, 'owner.json'), JSON.stringify({ owner, op, pid: process.pid, at: new Date().toISOString() }))
        return { dir: slot, owner }
      } catch (e) { if (e.code !== 'EEXIST') throw e }
      if (!staleSlot(slot)) break
      reclaim(slot)
    }
  }
  return null
}
const newOwner = () => `${process.pid}-${randomBytes(6).toString('hex')}`
const slotRefusal = (n, waited) => new Refusal('verify-slot-timeout', `all ${n} verify slot(s) stayed held for ${Math.round(waited / 60000)} min: no full verify.sh ran, nothing is certified either way`)
/** Release a slot this process holds (one reclaimed by someone else is left alone). */
export function releaseVerifySlot(slot) {
  if (!slot) return
  try {
    const cur = JSON.parse(readFileSync(path.join(slot.dir, 'owner.json'), 'utf8'))
    if (cur.owner === slot.owner) rmSync(slot.dir, { recursive: true, force: true })
  } catch { /* already gone */ }
}
/** Take a verify slot, waiting (async) as long as every slot is held. @returns {Promise<{dir, owner, waitedMs, slots}>} */
export async function acquireVerifySlot(ctx, op, { waitMs = SLOT_WAIT_MS } = {}) {
  const n = verifySlotCount()
  const owner = newOwner()
  const start = Date.now()
  for (;;) {
    const s = tryTake(slotsDir(ctx), n, owner, op)
    if (s) return { ...s, waitedMs: Date.now() - start, slots: n }
    if (Date.now() - start >= waitMs) throw slotRefusal(n, Date.now() - start)
    await sleep(SLOT_POLL_MS + Math.floor(Math.random() * SLOT_POLL_MS))
  }
}
/** Run `fn` holding a verify slot (released even when it throws). */
export async function withVerifySlot(ctx, op, fn) {
  const slot = await acquireVerifySlot(ctx, op)
  try { return await fn(slot) } finally { releaseVerifySlot(slot) }
}

// ── the failing test files of a red run ────────────────────────────────────────────────────────
const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null } }
/**
 * The test files a red verify.sh names: the report's vitest/playwright failure rows, then its output's vitest `FAIL`
 * lines and Playwright's numbered failure list. Project-relative, sorted, unique.
 */
export function failingTestFiles(report, output) {
  const out = new Set()
  const add = (f) => { const p = String(f || '').replace(/^\.\//, '').replace(/:\d+(:\d+)?$/, ''); if (VITEST_FILE_RE.test(p)) out.add(p) }
  for (const g of Array.isArray(report && report.subgates) ? report.subgates : []) {
    if (!g || g.exit === 0 || !['vitest', 'playwright'].includes(g.name)) continue
    for (const row of Array.isArray(g.failures) ? g.failures : []) if (row && typeof row === 'object') add(row.file)
  }
  for (const line of String(output || '').split('\n')) {
    const v = /^\s*(?:FAIL|✗|×)\s+(\S+\.(?:test|spec)\.[cm]?[jt]sx?)\b/.exec(line)
    if (v) add(v[1])
    const pw = /^\s*\d+\)\s.*?((?:[\w.@-]+\/)*[\w.@-]+\.spec\.[cm]?[jt]sx?):\d+/.exec(line)
    if (pw) add(pw[1])
  }
  return [...out].sort()
}
/** The red run's text where a timeout signature may sit: its output and its report's failure rows. */
const redText = (report, output) => `${output || ''}\n${JSON.stringify((report && report.subgates) || [])}`
export const hasTimeoutSignature = (report, output) => TIMEOUT_RE.test(redText(report, output))

/** Run a command async, bounded, keeping the last `keep` chars of its output. */
function runCapture(cmd, args, { cwd, env, timeoutMs, keep = 2 * 1024 * 1024 }) {
  return new Promise((resolve) => {
    let out = ''
    const p = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
    const timer = setTimeout(() => p.kill('SIGKILL'), timeoutMs)
    const add = (b) => { out = `${out}${b}`; if (out.length > keep) out = out.slice(-keep) }
    p.stdout.on('data', add)
    p.stderr.on('data', add)
    p.once('error', (e) => { clearTimeout(timer); resolve({ code: null, out: e.message }) })
    p.once('close', (code) => { clearTimeout(timer); resolve({ code, out }) })
  })
}
/** The isolated re-run of the failing files, by runner (vitest / Playwright, from the project's bin): passed only when every group ran and passed. */
async function rerunIsolated(cwd, env, files, timeoutMs) {
  const groups = [['vitest', ['run'], files.filter((f) => !PLAYWRIGHT_RE.test(f))], ['playwright', ['test'], files.filter((f) => PLAYWRIGHT_RE.test(f))]].filter((g) => g[2].length)
  for (const [bin, verb, group] of groups) {
    const exe = path.join(cwd, 'node_modules', '.bin', bin)
    if (!existsSync(exe)) return { passed: false, why: `node_modules/.bin/${bin} is absent: the failing files cannot re-run alone` }
    const r = await runCapture(exe, [...verb, ...group], { cwd, env: projectBinEnv(cwd, env), timeoutMs })
    if (r.code !== 0) return { passed: false, why: `${bin} exit ${r.code} on ${group.join(', ')} alone` }
  }
  return { passed: true, why: '' }
}

/**
 * ONE full verify.sh in `cwd`, holding a verify slot of `ctx` (the main project), with the timeout re-run: a red that
 * carries a test-timeout signature re-runs only its failing test files, alone, holding a slot; when they pass, the full
 * verify.sh runs once more (holding a slot) and THAT run is the verdict, flagged `flaky`. Otherwise the first run's
 * report is restored on disk (the isolated re-run never leaves its partial report behind).
 * @param {object} ctx the main project's projectCtx (owns the slots)
 * @param {{ cwd: string, env?: object, timeoutMs: number, op: string }} opts
 * @returns {Promise<{ code: number|null, out: string, report: object|null, failing: string[], flaky: null|{ files: string[], fullRerun: 'green'|'red' }, timeout: boolean, slotWaitMs: number }>}
 */
export async function runVerify(ctx, { cwd, env = {}, timeoutMs, op }) {
  const fullEnv = { ...process.env, ...env }
  const reportAbs = path.join(cwd, REPORT_REL)
  let slotWaitMs = 0
  const full = async () => withVerifySlot(ctx, op, async (s) => {
    slotWaitMs += s.waitedMs
    const r = await runCapture('bash', ['.pandacorp/verify.sh'], { cwd, env: fullEnv, timeoutMs })
    const report = readJson(reportAbs)
    return { ...r, report }
  })
  const first = await full()
  const failing = first.code === 0 ? [] : failingTestFiles(first.report, first.out)
  const timeout = first.code !== 0 && hasTimeoutSignature(first.report, first.out)
  const done = (r, flaky) => ({ code: r.code, out: r.out, report: r.report, failing: r.code === 0 ? [] : failingTestFiles(r.report, r.out), flaky, timeout, slotWaitMs })
  if (!timeout || !failing.length) return done(first, null)
  let saved = null
  try { saved = readFileSync(reportAbs) } catch { saved = null }
  const iso = await withVerifySlot(ctx, `${op}:rerun`, async (s) => { slotWaitMs += s.waitedMs; return rerunIsolated(cwd, fullEnv, failing, timeoutMs) })
  if (!iso.passed) {
    if (saved) writeFileSync(reportAbs, saved)
    return done(first, null)
  }
  const again = await full()
  return done(again, { files: failing, fullRerun: again.code === 0 ? 'green' : 'red' })
}
/**
 * The receipt status of a verify that ran through runVerify: `flaky-contention` when the timeout re-run proved the red
 * was contention and the full re-run is green or red only on a timeout again (never a bisect, never a fix-forward);
 * otherwise green/red.
 */
export function verifyStatus(v, green) {
  if (v.flaky && (green || hasTimeoutSignature(v.report, v.out))) return 'flaky-contention'
  return green ? 'green' : 'red'
}
