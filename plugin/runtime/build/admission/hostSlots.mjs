// Host heavy-tool slots (A1), the same protocol as merge-queue.sh (split from admission.mjs).
import * as nodeFs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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

/**
 * Try once to take a host heavy-tool slot (non-blocking). Protocol: `mkdir <dir>/slot-<i>` in index order, then write
 * owner.json {pid, kind, project, at}; a stale slot is `rm -rf`-reclaimed and retried.
 * @param {{dir?: string, host?: string, max?: number, kind: 'g2'|'merge-queue', project: string, pid?: number,
 *          now?: () => number, isAlive?: (pid:number)=>boolean, fs?: object, graceMs?: number}} opts
 *   `host` is the host directory (slots under `<host>/h-slots/slot-<i>`); `dir` is the slots directory itself; with neither,
 *   `$PANDACORP_HOST_DIR` or `~/.pandacorp/host`.
 * @returns {{slot: string, index: number, release: () => boolean}|null} null when every slot is held.
 */
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
