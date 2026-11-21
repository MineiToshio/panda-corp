// The shell implementations use this same on-disk mutex protocol (h-slots/.admission.lock).
// Publish an INITIALIZED directory; a live mutex is therefore never empty. Recovery
// unlinks only a dead owner's unique filename, then rmdir (never rename/rm a live lock).
import * as nodeFs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'

const alive = pid => {
  try { process.kill(pid, 0); return true } catch (error) { return error.code !== 'ESRCH' }
}
const disposable = error => ['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)
export function withHostSlotMutex(root, body, { fs = nodeFs, timeoutMs = Number(process.env.PANDACORP_HOST_MUTEX_WAIT_S ?? 1) * 1000 } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0 || timeoutMs > 60000) throw new TypeError('invalid host mutex wait limit')
  fs.mkdirSync(root, { recursive: true })
  const token = randomUUID(), name = `owner-${process.pid}-${token}.json`
  const lock = path.join(root, '.admission.lock'), staging = path.join(root, `.admission.new-${process.pid}-${token}`)
  const started = performance.now()
  let held = false
  const clear = directory => {
    try { fs.unlinkSync(path.join(directory, name)) } catch (error) { if (error.code !== 'ENOENT') throw error }
    try { fs.rmdirSync(directory) } catch (error) { if (!disposable(error)) throw error }
  }
  try {
    fs.mkdirSync(staging)
    fs.writeFileSync(path.join(staging, name), JSON.stringify({ pid: process.pid, token }))
    for (;;) {
      try { fs.renameSync(staging, lock); held = true; break } catch (error) {
        if (!['ENOTEMPTY', 'EEXIST', 'EISDIR'].includes(error.code)) throw error
      }
      // A replacement generation has a different owner filename. A late unlink
      // cannot remove its owner, and rmdir cannot remove its nonempty directory.
      let entries
      try { entries = fs.readdirSync(lock) } catch (error) { if (error.code === 'ENOENT') continue; throw error }
      for (const entry of entries) {
        const match = /^owner-([1-9][0-9]*)-.+\.json$/.exec(entry)
        if (match && !alive(Number(match[1]))) {
          try { fs.unlinkSync(path.join(lock, entry)) } catch (error) { if (error.code !== 'ENOENT') throw error }
        }
      }
      try { fs.rmdirSync(lock) } catch (error) { if (!disposable(error)) throw error }
      if (performance.now() - started >= timeoutMs) throw Object.assign(new Error('host admission mutex busy'), { code: 'EHOSTMUTEXBUSY' })
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)
    }
    return body()
  } finally {
    if (held) clear(lock)
    else clear(staging)
  }
}
