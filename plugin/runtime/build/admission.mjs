// admission.mjs — RAM/CPU-adaptive admission for the v2 build engine (BUILD-9, D31, D4, D7; PLAN 3.12 and 3.16 A1/A22).
//
// Deterministic and LLM-free. Three concerns, all over injected deps so tests never touch the real host:
//   1. Signals: macOS pressure level, swapouts, available memory (readSignals); fail loud (SignalError) so the
//      caller falls back to safe mode (B = 1, H = 1, motivo "senal_fallida").
//   2. Decision: decide() grants at most one B (LLM unit) or H (heavy tool) slot per call, with a motivo_limite.
//      Never kills anything: live work finishes, launches pause (BL-0223).
//   3. Host H slots (A1, shared byte-for-byte with merge-queue.sh) and unit tokens (D4: the unit token IS the
//      admission token; only `next` issues, report/review-record/doubt answer verify and release).
// There is no calibration file (F3). `admit` is read-only: admit() never writes, reclaims or issues.

import { createHash, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import * as nodeFs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const GIB = 1024 ** 3

/** Fixed constants (BUILD-9 Constants table, A22). GiB unless the name says otherwise. */
export const ADMISSION = Object.freeze({
  K_TECHO: 2,
  SUELO: 2,
  COLCHON_GIB: 3,
  COLCHON_MIN_GIB: 1,
  C_B_GIB: 1.5,
  C_TOOL_GIB: 1.2,
  C_H_GIB: 3.5,
  CODEX_EXTRA_GIB: 0.35,
  HYSTERESIS_GIB: 0.5,
  REVIEWER_SUBCAP: 2,
  H_MAX_CAP: 2,
  AGENT_FRESH_S: 60,
  L4_PAUSE_S: 600,
  HISTORY_LEN: 3,
  K_REACTIVE_CODEX_START: 2,
  SLOT_POLL_MS: 5000,
  SLOT_OWNERLESS_GRACE_MS: 60000,
  EXEC_TIMEOUT_MS: 5000,
})

/** The closed motivo_limite enum (BUILD-9). */
export const MOTIVOS = Object.freeze([
  'ancho', 'ram', 'ram_reservada_H', 'veto_presion', 'veto_swap', 'cpu_H', 'techo', 'owner_k',
  'reactivo_contencion', 'reactivo_codex', 'cupo_limite', 'senal_fallida', 'pausa_L4', 'sin_token',
])

const REACTIVE_MOTIVOS = ['reactivo_contencion', 'reactivo_codex', 'cupo_limite']
const round3 = (n) => Math.round(n * 1000) / 1000

/** Raised when a RAM signal cannot be read or parsed. Callers switch to safe mode (never a silent default, DR-078). */
export class SignalError extends Error {
  /** @param {string} message @param {{source?: string}} [opts] */
  constructor(message, { source = 'unknown' } = {}) {
    super(message)
    this.name = 'SignalError'
    this.source = source
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------------------------------------------

/** Default exec: file + args -> stdout, bounded by a timeout. Throws on a non-zero exit. */
export const defaultExec = (file, args) =>
  execFileSync(file, args, { encoding: 'utf8', timeout: ADMISSION.EXEC_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'] })

function parseVmStat(text) {
  const header = /page size of (\d+) bytes/.exec(text)
  if (!header || !(Number(header[1]) > 0)) throw new SignalError('vm_stat: page-size header not found', { source: 'vm_stat' })
  const pageBytes = Number(header[1])
  const get = (label) => {
    const m = new RegExp(`^${label}:\\s+(\\d+)\\.?\\s*$`, 'm').exec(text)
    if (!m) throw new SignalError(`vm_stat: line "${label}" not found or malformed`, { source: 'vm_stat' })
    return Number(m[1])
  }
  const free = get('Pages free')
  const inactive = get('Pages inactive')
  const speculative = get('Pages speculative')
  const purgeable = get('Pages purgeable')
  // Telemetry only (never an input to a decision): a vm_stat without the line counts the term as 0.
  const fileBacked = /^File-backed pages:/m.test(text) ? get('File-backed pages') : 0
  const swapouts = get('Swapouts')
  return {
    swapouts,
    A_gib: round3(((free + inactive + speculative + purgeable) * pageBytes) / GIB),
    A_cons_gib: round3(((free + speculative + purgeable + fileBacked) * pageBytes) / GIB),
  }
}

function parseSwapUsage(text) {
  const m = /vm\.swapusage:.*\bused\s*=\s*([\d.]+)\s*([KMG])\b/.exec(text)
  if (!m || !Number.isFinite(Number(m[1]))) throw new SignalError('sysctl vm.swapusage: "used" not found', { source: 'swapusage' })
  const factor = { K: 1 / 1024, M: 1, G: 1024 }[m[2]]
  return round3(Number(m[1]) * factor)
}

function parsePressure(text) {
  const level = Number(String(text).trim())
  if (![1, 2, 4].includes(level)) throw new SignalError(`kern.memorystatus_vm_pressure_level: unexpected value ${JSON.stringify(String(text).trim())}`, { source: 'pressure' })
  return level
}

function readFixture(raw) {
  let obj
  try { obj = JSON.parse(raw) } catch (e) { throw new SignalError(`signals file is not JSON: ${e.message}`, { source: 'fixture' }) }
  const keys = ['sysctl_pressure', 'vm_stat', 'swapusage']
  if (!obj || typeof obj !== 'object' || !keys.every((k) => typeof obj[k] === 'string')) {
    throw new SignalError('signals file must be {sysctl_pressure, vm_stat, swapusage} (raw command outputs)', { source: 'fixture' })
  }
  return obj
}

/**
 * Read the RAM signals (a few ms). Async: the injected `exec` may return a Promise.
 * @param {{exec?: (file: string, args: string[]) => string|Promise<string>, signalsFile?: string|null, readFile?: (p: string) => string|Promise<string>}} [deps]
 *   `signalsFile` (PANDACORP_SIGNALS_FILE) holds the RAW outputs `{sysctl_pressure, vm_stat, swapusage}` and goes
 *   through the same parsers as the real commands.
 * @returns {Promise<{L: 1|2|4, swapouts: number, swap_used_mb: number, A_gib: number, A_cons_gib: number}>}
 * @throws {SignalError} on any missing tool, rejected exec, non-zero exit or unexpected format.
 */
export async function readSignals({ exec = defaultExec, signalsFile = null, readFile = (p) => nodeFs.readFileSync(p, 'utf8') } = {}) {
  let outputs
  if (signalsFile) {
    let raw
    try { raw = await readFile(signalsFile) } catch (e) { throw new SignalError(`cannot read signals file: ${e.message}`, { source: 'fixture' }) }
    const fx = readFixture(String(raw))
    outputs = { pressure: fx.sysctl_pressure, vm: fx.vm_stat, swap: fx.swapusage }
  } else {
    const run = async (file, args, source) => {
      try { return String(await exec(file, args)) } catch (e) { throw new SignalError(`${file} ${args.join(' ')} failed: ${e?.message ?? e}`, { source }) }
    }
    outputs = {
      pressure: await run('sysctl', ['-n', 'kern.memorystatus_vm_pressure_level'], 'pressure'),
      vm: await run('vm_stat', [], 'vm_stat'),
      swap: await run('sysctl', ['vm.swapusage'], 'swapusage'),
    }
  }
  const L = parsePressure(outputs.pressure)
  const vm = parseVmStat(outputs.vm)
  const swap_used_mb = parseSwapUsage(outputs.swap)
  return { L, swapouts: vm.swapouts, swap_used_mb, A_gib: vm.A_gib, A_cons_gib: vm.A_cons_gib }
}

/** `ncpu` as Node sees it (A1). */
export const cpuCount = () => (typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length)

/** H_max = max(1, min(2, floor(ncpu / 4))) (A1). */
export const hMax = (ncpu = cpuCount()) => Math.max(1, Math.min(ADMISSION.H_MAX_CAP, Math.floor(ncpu / 4)))

/**
 * RSS of a process tree in GiB (a reservation input for CLI-launched processes). Returns null when `ps` is
 * unreadable: callers treat null as 0, which keeps the full class-peak reservation (the safe direction).
 * @param {number} rootPid
 * @param {{exec?: (file: string, args: string[]) => string|Promise<string>}} [deps]
 * @returns {Promise<number|null>}
 */
export async function rssTreeGib(rootPid, { exec = defaultExec } = {}) {
  let out
  try { out = String(await exec('ps', ['-axo', 'pid=,ppid=,rss='])) } catch { return null }
  const kids = new Map()
  const rss = new Map()
  for (const line of out.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s*$/.exec(line)
    if (!m) continue
    const [pid, ppid, kb] = [Number(m[1]), Number(m[2]), Number(m[3])]
    rss.set(pid, kb)
    if (!kids.has(ppid)) kids.set(ppid, [])
    kids.get(ppid).push(pid)
  }
  if (!rss.has(rootPid)) return null
  let totalKb = 0
  const stack = [rootPid]
  const seen = new Set()
  while (stack.length) {
    const pid = stack.pop()
    if (seen.has(pid)) continue
    seen.add(pid)
    totalKb += rss.get(pid) ?? 0
    stack.push(...(kids.get(pid) ?? []))
  }
  return round3((totalKb * 1024) / GIB)
}

// ---------------------------------------------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------------------------------------------

/**
 * Memory a live unit may still claim but has not reached yet (D31, A22).
 * - agent-dispatched B unit (no process of its own): c_b for its first 60 s, then c_tool while alive.
 * - CLI-launched process: max(0, class peak - rss of its tree); peak = c_b + 0.35 (Codex worker) or c_h (heavy job).
 * @param {{class: 'B'|'H', origin: 'agent'|'cli', runtime?: 'codex'|'claude'|null, started_ms: number, rss_gib?: number|null}|{pending_gib: number}} res
 * @param {number} nowMs
 */
export function pendingGib(res, nowMs) {
  if (Number.isFinite(res.pending_gib)) return res.pending_gib // a caller that already computed it
  if (res.class === 'B' && res.origin === 'agent') {
    const ageS = Math.max(0, (nowMs - res.started_ms) / 1000)
    return ageS < ADMISSION.AGENT_FRESH_S ? ADMISSION.C_B_GIB : ADMISSION.C_TOOL_GIB
  }
  const peak = res.class === 'H' ? ADMISSION.C_H_GIB : ADMISSION.C_B_GIB + (res.runtime === 'codex' ? ADMISSION.CODEX_EXTRA_GIB : 0)
  return round3(Math.max(0, peak - (res.rss_gib ?? 0)))
}

// ---------------------------------------------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------------------------------------------

function swapDeltas(history, signals) {
  const seq = [...history.map((h) => h.swapouts), signals.swapouts].slice(-(ADMISSION.HISTORY_LEN + 1))
  const out = []
  for (let i = 1; i < seq.length; i++) out.push(Math.max(0, seq[i] - seq[i - 1])) // a counter that went down was reset
  return out
}

/**
 * DEC-1 veto: L == 4 is handled before this (pausa_L4). Otherwise only the swap TREND vetoes: swapouts rose in >= 2 of the
 * last 3 deltas. L 2 with flat swap, or too few readings to tell, is no veto. `veto` is 'swap' at L == 1 and 'presion'
 * when the trend is corroborated by L >= 2.
 */
function readVeto(history, signals) {
  const deltas = swapDeltas(history, signals)
  const rising = deltas.filter((d) => d > 0).length >= 2
  return { veto: rising ? (signals.L >= 2 ? 'presion' : 'swap') : null, deltas }
}

/** Calm = L == 1 and zero swapouts across the last 3 readings (needed to rise above the floor). */
function isCalm(history, signals, deltas) {
  const lastThree = [...history, signals].slice(-ADMISSION.HISTORY_LEN)
  return deltas.length === ADMISSION.HISTORY_LEN && deltas.every((d) => d === 0) && lastThree.every((r) => r.L === 1)
}

const vetoMotivo = (veto) => (veto === 'swap' ? 'veto_swap' : 'veto_presion')

function ceilingTerms({ readyWidth, liveB, caps, runtimeShape }) {
  const reactive = caps.kReactive ?? (runtimeShape === 'R-C' || runtimeShape === 'drive' ? ADMISSION.K_REACTIVE_CODEX_START : Infinity)
  const reactiveMotivo = REACTIVE_MOTIVOS.includes(caps.kReactiveReason) ? caps.kReactiveReason : 'reactivo_contencion'
  const kTecho = runtimeShape === 'R-B' ? 1 : (caps.K_TECHO ?? ADMISSION.K_TECHO)
  return [
    ['ancho', readyWidth + liveB],
    ['techo', kTecho],
    ['owner_k', caps.kOwner ?? Infinity],
    [reactiveMotivo, reactive],
  ]
}

function decideHeavy(ctx) {
  const { live, veto, P, hMaxBase, runtimeShape } = ctx
  const hCap = veto || runtimeShape === 'R-B' ? 1 : hMaxBase
  const base = { A_ef: ctx.A_ef, P, veto, h_max: hCap }
  if (live.H >= hCap) {
    return { ...base, grant: null, motivo_limite: veto ? vetoMotivo(veto) : 'cpu_H', waitsForRam: false }
  }
  if (P >= ADMISSION.C_H_GIB || live.H === 0) {
    const limiter = veto ? vetoMotivo(veto) : 'cpu_H'
    return { ...base, grant: 'H', motivo_limite: limiter, waitsForRam: false }
  }
  return { ...base, grant: null, motivo_limite: 'ram', waitsForRam: true }
}

/**
 * One admission decision (pure). Grants at most one slot; the caller increments `live`/reservations and calls again.
 *
 * Veto (DEC-1): L == 4 launches nothing (pausa_L4); otherwise only a rising swap trend (>= 2 of the last 3 swapout deltas)
 * vetoes, which means series (1 builder + 1 heavy). L 2 with flat swap is no veto.
 *
 * `motivo_limite` on a grant names the binding ceiling (B: the ceiling term that equals `techo`; H: `cpu_H`, or the
 * veto that lowered H_max); on a wait it names why nothing was granted.
 *
 * @param {object} input
 * @param {{L:1|2|4, swapouts:number, A_gib:number}|null} input.signals current reading; null/missing = safe mode (SignalError upstream)
 * @param {{L:number, swapouts:number}[]} [input.history] previous readings, oldest first (last 3 are used)
 * @param {object[]} [input.reservations] live units, see {@link pendingGib}
 * @param {{B:number, H:number, R?:number}} input.live live builder-class units (R = live reviewers among them) and host-wide heavy slots in use
 * @param {number} [input.heavyQueued] heavy jobs waiting
 * @param {number} [input.readyWidth] ready, non-overlapping units not yet live (from the planner)
 * @param {{K_TECHO?:number, kOwner?:number, kReactive?:number, kReactiveReason?:string, colchonGib?:number}} [input.caps]
 * @param {'R-A'|'R-B'|'R-C'|'drive'} [input.runtimeShape] R-B is B = 1, H = 1 always
 * @param {'B'|'H'|null} [input.want] restrict the grant to one class (admit --class); null = either, heavy first
 * @param {'builder'|'reviewer'} [input.candidate] a reviewer is also bounded by the reviewer sub-cap
 * @param {number} [input.nowMs] @param {number} [input.ncpu]
 * @returns {{grant:'B'|'H'|null, motivo_limite:string, techo:number|null, suelo:number|null, A_ef:number, P:number, veto:null|'presion'|'swap', h_max:number|null, safe_mode:false}}
 */
export function decide({
  signals, history = [], reservations = [], live, heavyQueued = 0, readyWidth = 1, caps = {},
  runtimeShape = 'R-A', want = null, candidate = 'builder', nowMs = Date.now(), ncpu = cpuCount(),
}) {
  if (!signals) return safeModeDecision({ live, heavyQueued, readyWidth, want, caps })
  const sumPending = reservations.reduce((s, r) => s + pendingGib(r, nowMs), 0)
  const A_ef = round3(signals.A_gib - sumPending)
  if (signals.L === 4) {
    return { grant: null, motivo_limite: 'pausa_L4', techo: null, suelo: null, A_ef, P: round3(A_ef - ADMISSION.COLCHON_GIB), veto: 'presion', h_max: null, safe_mode: false }
  }
  const colchon = Math.max(ADMISSION.COLCHON_MIN_GIB, caps.colchonGib ?? ADMISSION.COLCHON_GIB)
  const { veto, deltas } = readVeto(history, signals)
  const calm = isCalm(history, signals, deltas)
  const P0 = round3(A_ef - colchon)

  const heavy = heavyQueued > 0 ? decideHeavy({ live, veto, P: P0, A_ef, hMaxBase: hMax(ncpu), runtimeShape }) : null
  if (want !== 'B' && heavy?.grant === 'H') {
    return { grant: 'H', motivo_limite: heavy.motivo_limite, techo: null, suelo: null, A_ef, P: P0, veto, h_max: heavy.h_max, safe_mode: false }
  }
  // A heavy job waiting for RAM sets its c_h aside (it does not freeze builders); waiting for CPU sets nothing aside.
  const asideH = Boolean(heavy?.waitsForRam)
  const P = round3(asideH ? P0 - ADMISSION.C_H_GIB : P0)

  if (want === 'H') {
    const motivo = heavy ? heavy.motivo_limite : 'ancho'
    return { grant: null, motivo_limite: motivo, techo: null, suelo: null, A_ef, P, veto, h_max: heavy?.h_max ?? null, safe_mode: false }
  }

  const terms = ceilingTerms({ readyWidth, liveB: live.B, caps, runtimeShape })
  const techo = Math.min(...terms.map(([, v]) => v))
  const bound = terms.find(([, v]) => v === techo)[0]
  const suelo = !veto && P >= 0 ? ADMISSION.SUELO : 1
  const out = (grant, motivo_limite) => ({ grant, motivo_limite, techo, suelo, A_ef, P, veto, h_max: heavy?.h_max ?? null, safe_mode: false })

  if (candidate === 'reviewer' && (live.R ?? 0) >= ADMISSION.REVIEWER_SUBCAP) return out(null, 'techo')
  if (live.B >= techo) return out(null, bound)
  if (live.B < suelo) return out('B', bound)
  if (veto) return out(null, vetoMotivo(veto))
  if (P >= ADMISSION.C_B_GIB + ADMISSION.HYSTERESIS_GIB && calm) return out('B', bound)
  // Held at the floor: not calm (L != 1, any swapout in the window, or fewer than 3 readings). Not a veto.
  if (P >= ADMISSION.C_B_GIB + ADMISSION.HYSTERESIS_GIB) return out(null, 'ram')
  const wouldFitWithoutAside = asideH && P0 >= ADMISSION.C_B_GIB + ADMISSION.HYSTERESIS_GIB
  return out(null, wouldFitWithoutAside ? 'ram_reservada_H' : 'ram')
}

/**
 * Safe-mode decision after a SignalError: B = 1 and H = 1 (the series), motivo `senal_fallida`. Owner `--k` is a
 * ceiling, never a floor, so it cannot lift safe mode.
 * @param {{live:{B:number,H:number}, heavyQueued?:number, readyWidth?:number, want?:'B'|'H'|null, caps?:{kOwner?:number}}} input
 */
export function safeModeDecision({ live, heavyQueued = 0, readyWidth = 1, want = null, caps = {} }) {
  const heavyOk = want !== 'B' && heavyQueued > 0 && live.H < 1
  const builderOk = want !== 'H' && readyWidth > 0 && (caps.kOwner ?? Infinity) >= 1 && live.B < 1
  const grant = heavyOk ? 'H' : builderOk ? 'B' : null
  return { grant, motivo_limite: 'senal_fallida', techo: 1, suelo: 1, A_ef: null, P: null, veto: null, h_max: 1, safe_mode: true }
}

/**
 * Read-only dry run behind `admit`: reads the signals and returns the decision a `next` would take, in the CLI's
 * output shape. Never writes, never reclaims a slot, never issues a token.
 * @param {object} input same as {@link decide} minus `signals`, plus `class` and the readSignals deps
 * @returns {Promise<{decision:'grant'|'wait', class:'B'|'H', motivo_limite:string, techo:number|null, suelo:number|null, A_ef:number|null, P:number|null, signals:object|null, safe_mode:boolean}>}
 */
export async function admit({ class: cls = 'B', signalsFile = null, exec, readFile, ...rest }) {
  const want = cls === 'H' ? 'H' : 'B'
  const input = { ...rest, want, heavyQueued: cls === 'H' ? Math.max(1, rest.heavyQueued ?? 0) : (rest.heavyQueued ?? 0) }
  let signals
  try {
    signals = await readSignals({ exec, signalsFile, readFile })
  } catch (e) {
    if (!(e instanceof SignalError)) throw e
    const d = safeModeDecision(input)
    return { decision: d.grant ? 'grant' : 'wait', class: cls, motivo_limite: d.motivo_limite, techo: d.techo, suelo: d.suelo, A_ef: null, P: null, signals: null, safe_mode: true, error: e.message }
  }
  const d = decide({ ...input, signals })
  return { decision: d.grant ? 'grant' : 'wait', class: cls, motivo_limite: d.motivo_limite, techo: d.techo, suelo: d.suelo, A_ef: d.A_ef, P: d.P, signals, safe_mode: false }
}

// ---------------------------------------------------------------------------------------------------------------
// Host H slots (A1): the same protocol as merge-queue.sh
// ---------------------------------------------------------------------------------------------------------------

/** `<host>` = $PANDACORP_HOST_DIR or ~/.pandacorp/host. */
export const hostDir = (env = process.env, home = os.homedir()) => env.PANDACORP_HOST_DIR || path.join(home, '.pandacorp', 'host')
/** `<host>/h-slots`. */
export const hSlotsDir = (host = hostDir()) => path.join(host, 'h-slots')

const defaultIsAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' }
}

function readOwner(fs, slot) {
  try {
    const o = JSON.parse(fs.readFileSync(path.join(slot, 'owner.json'), 'utf8'))
    return o && Number.isInteger(o.pid) ? o : null
  } catch { return null }
}

/** A slot is stale when its owner pid fails `kill -0`, or it has no owner.json and its mtime is older than 60 s. */
function isStaleSlot(fs, slot, nowMs, isAlive, graceMs) {
  const owner = readOwner(fs, slot)
  if (owner) return !isAlive(owner.pid)
  try { return nowMs - fs.statSync(slot).mtimeMs > graceMs } catch { return false }
}

/**
 * Try once to take a host heavy-tool slot (non-blocking). Protocol: `mkdir <dir>/slot-<i>` in index order, then write
 * owner.json {pid, kind, project, at}; a stale slot is `rm -rf`-reclaimed and retried.
 * @param {{dir?: string, host?: string, max?: number, kind: 'g2'|'merge-queue', project: string, pid?: number,
 *          now?: () => number, isAlive?: (pid:number)=>boolean, fs?: object, graceMs?: number}} opts
 *   `host` is the host directory (slots under `<host>/h-slots/slot-<i>`); `dir` is the slots directory itself; with neither,
 *   `$PANDACORP_HOST_DIR` or `~/.pandacorp/host`.
 * @returns {{slot: string, index: number, release: () => boolean}|null} null when every slot is held.
 */
/**
 * Removes a slot directory atomically: `rename` to a unique tomb (only one racer wins the rename; a loser sees ENOENT and
 * touches nothing, so a slot a faster waiter just re-took is never deleted), then removes the tomb.
 */
function removeSlot(fs, slot) {
  const tomb = `${slot}.tomb-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  try {
    fs.renameSync(slot, tomb)
  } catch (e) {
    if (e.code === 'ENOENT') return false
    throw e
  }
  fs.rmSync(tomb, { recursive: true, force: true })
  return true
}

export function acquireHostSlot({
  dir, host, max = hMax(), kind, project, pid = process.pid, now = Date.now, isAlive = defaultIsAlive,
  fs = nodeFs, graceMs = ADMISSION.SLOT_OWNERLESS_GRACE_MS,
}) {
  if (!['g2', 'merge-queue'].includes(kind)) throw new TypeError(`acquireHostSlot: kind must be g2|merge-queue, got ${kind}`)
  const slots = dir ?? hSlotsDir(host ?? hostDir())
  fs.mkdirSync(slots, { recursive: true })
  for (let i = 0; i < max; i++) {
    const slot = path.join(slots, `slot-${i}`)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        fs.mkdirSync(slot)
      } catch (e) {
        if (e.code !== 'EEXIST') throw e
        // Re-judge right before deleting so a slot a faster waiter just re-took is never removed.
        if (!isStaleSlot(fs, slot, now(), isAlive, graceMs)) break
        removeSlot(fs, slot)
        continue
      }
      const owner = { pid, kind, project, at: new Date(now()).toISOString() }
      // tmp + rename like merge-queue.sh, so a concurrent reader never sees a half-written owner.json
      fs.writeFileSync(path.join(slot, 'owner.json.tmp'), `${JSON.stringify(owner)}\n`)
      fs.renameSync(path.join(slot, 'owner.json.tmp'), path.join(slot, 'owner.json'))
      const release = () => {
        const cur = readOwner(fs, slot)
        if (cur && (cur.pid !== owner.pid || cur.at !== owner.at)) return false // reclaimed and re-taken by someone else
        removeSlot(fs, slot)
        return true
      }
      return { slot, index: i, release }
    }
  }
  return null
}

/**
 * Wait for a host slot, polling every 5 s (waiting is never a failure). Resolves null when `timeoutMs` elapses.
 * @param {Parameters<typeof acquireHostSlot>[0] & {pollMs?: number, timeoutMs?: number, sleep?: (ms:number)=>Promise<void>}} opts
 */
export async function waitHostSlot({ pollMs = ADMISSION.SLOT_POLL_MS, timeoutMs = Infinity, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), ...opts }) {
  const now = opts.now ?? Date.now
  const started = now()
  for (;;) {
    const handle = acquireHostSlot(opts)
    if (handle) return handle
    if (now() - started >= timeoutMs) return null
    await sleep(pollMs)
  }
}

/**
 * Read-only host-wide count of heavy slots in use (a stale slot counts as free; nothing is reclaimed here).
 * @param {{dir?: string, host?: string, max?: number, now?: () => number, isAlive?: (pid:number)=>boolean, fs?: object, graceMs?: number}} opts
 * @returns {{max: number, held: number, free: number, owners: object[]}}
 */
export function countHostSlots({ dir, host, max = hMax(), now = Date.now, isAlive = defaultIsAlive, fs = nodeFs, graceMs = ADMISSION.SLOT_OWNERLESS_GRACE_MS }) {
  const slots = dir ?? hSlotsDir(host ?? hostDir())
  const owners = []
  for (let i = 0; i < max; i++) {
    const slot = path.join(slots, `slot-${i}`)
    if (!fs.existsSync(slot) || isStaleSlot(fs, slot, now(), isAlive, graceMs)) continue
    owners.push({ index: i, ...(readOwner(fs, slot) ?? { pid: null }) })
  }
  return { max, held: owners.length, free: max - owners.length, owners }
}

// ---------------------------------------------------------------------------------------------------------------
// admission.json: unit tokens (D4) and the reading history (single writer: `next`, under the lease mutex)
// ---------------------------------------------------------------------------------------------------------------

/** sha256 hex of a raw token (the value stored in `state.units[].token_hash` and as the admission.json key). */
export const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex')

const isoNow = (ctx) => new Date(ctx.now ? ctx.now() : Date.now()).toISOString()

function loadAdmission(ctx) {
  const fs = ctx.fs ?? nodeFs
  let raw
  try { raw = fs.readFileSync(ctx.file, 'utf8') } catch (e) {
    if (e.code === 'ENOENT') return { tokens: {}, history: [], l4_since: null }
    throw e
  }
  let doc
  try { doc = JSON.parse(raw) } catch (e) { throw new Error(`admission.json is corrupt (${ctx.file}): ${e.message}`) }
  if (!doc || typeof doc.tokens !== 'object' || doc.tokens === null || !Array.isArray(doc.history)) {
    throw new Error(`admission.json has an unexpected shape (${ctx.file})`)
  }
  return { tokens: doc.tokens, history: doc.history, l4_since: doc.l4_since ?? null }
}

function saveAdmission(ctx, doc) {
  const fs = ctx.fs ?? nodeFs
  fs.mkdirSync(path.dirname(ctx.file), { recursive: true })
  const tmp = `${ctx.file}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`
  fs.writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`, { mode: 0o600 })
  fs.renameSync(tmp, ctx.file)
}

/**
 * Issue the admission token of a unit (only `next` calls this). A previous token of the same unit is dropped.
 * The raw token is returned once and never stored: only its sha256 is.
 * @param {string} unit @param {'B'|'H'} cls
 * @param {{file: string, fs?: object, now?: () => number|string|Date, random?: (n:number)=>Buffer, reservedGib?: number}} ctx
 * @returns {{token: string, token_hash: string, class: 'B'|'H', reserved_gib: number}}
 */
export function issueToken(unit, cls, ctx) {
  if (!unit || typeof unit !== 'string') throw new TypeError('issueToken: unit must be a non-empty string')
  if (cls !== 'B' && cls !== 'H') throw new TypeError(`issueToken: class must be B|H, got ${cls}`)
  const doc = loadAdmission(ctx)
  for (const [h, e] of Object.entries(doc.tokens)) if (e.unit === unit) delete doc.tokens[h]
  const token = (ctx.random ?? randomBytes)(32).toString('hex')
  const token_hash = hashToken(token)
  const reserved_gib = ctx.reservedGib ?? (cls === 'H' ? ADMISSION.C_H_GIB : ADMISSION.C_B_GIB)
  doc.tokens[token_hash] = { unit, class: cls, reserved_gib, at: isoNow(ctx) }
  saveAdmission(ctx, doc)
  return { token, token_hash, class: cls, reserved_gib }
}

/**
 * Verify a raw token for a unit (read-only). A mismatch is the CLI's exit 6; this only reports why.
 * @param {string} unit @param {string} token @param {{file: string, fs?: object}} ctx
 * @returns {{ok: true, entry: object, token_hash: string}|{ok: false, reason: 'missing'|'unknown_token'|'unit_mismatch'}}
 */
export function verifyToken(unit, token, ctx) {
  if (typeof token !== 'string' || token === '') return { ok: false, reason: 'missing' }
  const token_hash = hashToken(token)
  const entry = loadAdmission(ctx).tokens[token_hash]
  if (!entry) return { ok: false, reason: 'unknown_token' }
  if (entry.unit !== unit) return { ok: false, reason: 'unit_mismatch' }
  return { ok: true, entry, token_hash }
}

/**
 * Release every token of a unit (after report / review-record / doubt answer). Idempotent.
 * @param {string} unit @param {{file: string, fs?: object}} ctx
 * @returns {{released: number}}
 */
export function releaseToken(unit, ctx) {
  const doc = loadAdmission(ctx)
  let released = 0
  for (const [h, e] of Object.entries(doc.tokens)) if (e.unit === unit) { delete doc.tokens[h]; released++ }
  if (released > 0) saveAdmission(ctx, doc)
  return { released }
}

/**
 * Record this `next`'s reading: keeps the last 3 readings (for the swap trend and the hysteresis window) and tracks
 * how long L has been 4 (the `paused-infra` trigger, > 10 min). `next` calls it once per call, never `admit`.
 * @param {{L:number, swapouts:number}} signals
 * @param {{file: string, fs?: object, now?: () => number|string|Date}} ctx
 * @returns {{history: object[], l4_since: string|null, l4_sustained_s: number, paused_infra: boolean}}
 */
export function recordReading(signals, ctx) {
  const doc = loadAdmission(ctx)
  const at = isoNow(ctx)
  doc.history = [...doc.history, { L: signals.L, swapouts: signals.swapouts, at }].slice(-ADMISSION.HISTORY_LEN)
  doc.l4_since = signals.L === 4 ? (doc.l4_since ?? at) : null
  saveAdmission(ctx, doc)
  const l4_sustained_s = doc.l4_since ? Math.max(0, (Date.parse(at) - Date.parse(doc.l4_since)) / 1000) : 0
  return { history: doc.history, l4_since: doc.l4_since, l4_sustained_s, paused_infra: l4_sustained_s > ADMISSION.L4_PAUSE_S }
}

/**
 * The stored reading history (oldest first), as {@link decide} expects it. Missing file = no history.
 * @param {{file: string, fs?: object}} ctx
 */
export const readHistory = (ctx) => loadAdmission(ctx).history
