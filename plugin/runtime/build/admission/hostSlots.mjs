// Host heavy-tool slots (A1), the same protocol as merge-queue.sh (split from admission.mjs).
import * as nodeFs from 'node:fs'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { withHostSlotMutex } from './hostSlotMutex.mjs'
import { ADMISSION, hMax } from './constants.mjs'

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
    return o && Number.isInteger(o.pid) && o.pid > 0 ? o : null
  } catch { return null }
}

/** A slot is stale when its owner pid fails `kill -0`, or it has no owner.json and its mtime is older than 60 s. */
function isStaleSlot(fs, slot, nowMs, isAlive, graceMs) {
  const owner = readOwner(fs, slot)
  if (owner) return !isAlive(owner.pid)
  try { return nowMs - fs.statSync(slot).mtimeMs > graceMs } catch { return false }
}

/**
 * Removes a slot directory atomically: `rename` to a unique tomb (only one racer wins the rename; a loser sees ENOENT and
 * touches nothing, so a slot a faster waiter just re-took is never deleted), then removes the tomb.
 */
function removeSlot(fs, slot, expected, allowed) {
  const tomb = `${slot}.tomb-${randomUUID()}`
  try {
    const stat = fs.statSync(slot)
    if (stat.ino !== expected.ino || stat.dev !== expected.dev) return false
    fs.renameSync(slot, tomb)
  } catch (e) {
    if (e.code === 'ENOENT') return false
    throw e
  }
  // Re-check AFTER detaching: an ABA replacement must never be recursively deleted.
  const detached = fs.statSync(tomb)
  if (detached.ino !== expected.ino || detached.dev !== expected.dev || !allowed(tomb)) {
    if (!fs.existsSync(slot)) fs.renameSync(tomb, slot)
    return false
  }
  fs.rmSync(tomb, { recursive: true, force: true })
  return true
}

function underAdmission(slots, fs, timeoutMs, busyValue, body) {
  try { return withHostSlotMutex(slots, body, { fs, timeoutMs }) }
  catch (error) {
    if (error.code === 'EHOSTMUTEXBUSY') return busyValue
    throw error
  }
}


/**
 * Try once to take a host heavy-tool slot (non-blocking). Protocol: `mkdir <dir>/slot-<i>` in index order, then write
 * owner.json {pid, kind, project, at, token}; dead-pid or ownerless >60s slots are atomically reclaimed.
 * @param {{dir?: string, host?: string, max?: number, kind: 'g2'|'merge-queue'|'verify', project: string, pid?: number,
 *          now?: () => number, isAlive?: (pid:number)=>boolean, fs?: object, graceMs?: number}} opts
 *   `host` is the host directory (slots under `<host>/h-slots/slot-<i>`); `dir` is the slots directory itself; with neither,
 *   `$PANDACORP_HOST_DIR` or `~/.pandacorp/host`.
 * @returns {{slot: string, index: number, token: string, release: () => boolean}|null} null when every slot is held.
 */

export function acquireHostSlot({
  dir, host, max = hMax(), kind, project, pid = process.pid, now = Date.now, isAlive = defaultIsAlive,
  fs = nodeFs, graceMs = ADMISSION.SLOT_OWNERLESS_GRACE_MS, mutexTimeoutMs,
}) {
  if (!['g2', 'merge-queue', 'verify'].includes(kind)) throw new TypeError(`acquireHostSlot: kind must be g2|merge-queue|verify, got ${kind}`)
  const slots = dir ?? hSlotsDir(host ?? hostDir())
  return underAdmission(slots, fs, mutexTimeoutMs, null, () => {
    for (let i = 0; i < max; i++) {
      const slot = path.join(slots, `slot-${i}`)
      for (let attempt = 0; attempt < 3; attempt++) {
        try { fs.mkdirSync(slot) }
        catch (error) {
          if (error.code !== 'EEXIST') throw error
          let expected
          try { expected = fs.statSync(slot) }
          catch (error) { if (error.code === 'ENOENT') continue; throw error }
          if (!isStaleSlot(fs, slot, now(), isAlive, graceMs)) break
          removeSlot(fs, slot, expected, target => isStaleSlot(fs, target, now(), isAlive, graceMs))
          continue
        }
        const owner = { pid, kind, project, at: new Date(now()).toISOString(), token: randomUUID() }
        fs.writeFileSync(path.join(slot, 'owner.json.tmp'), `${JSON.stringify(owner)}\n`)
        fs.renameSync(path.join(slot, 'owner.json.tmp'), path.join(slot, 'owner.json'))
        const identity = fs.statSync(slot)
        const release = () => underAdmission(slots, fs, mutexTimeoutMs, false, () => {
          const current = readOwner(fs, slot)
          if (!current || current.token !== owner.token) return false
          return removeSlot(fs, slot, identity, target => readOwner(fs, target)?.token === owner.token)
        })
        return { slot, index: i, token: owner.token, release }
      }
    }
    return null
  })
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
