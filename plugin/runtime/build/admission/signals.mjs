// RAM signals: macOS pressure, swapouts and available memory, plus the process-tree RSS reader (split from admission.mjs).
import { execFileSync } from 'node:child_process'
import * as nodeFs from 'node:fs'
import { ADMISSION, GIB, SignalError, round3 } from './constants.mjs'

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
