// A project-volume disk floor applies only to newly allocated worktrees. No host-global free-space assumption.
import * as fs from 'node:fs'
import { ADMISSION, GIB } from './constants.mjs'

export function readDiskFreeGib(project, deps = {}) {
  const forced = (deps.env ?? process.env).PANDACORP_DISK_FREE_GIB
  if (forced !== undefined && forced !== '') {
    const n = Number(forced)
    if (!Number.isFinite(n) || n < 0) throw new TypeError('PANDACORP_DISK_FREE_GIB must be a non-negative number')
    return n
  }
  const stat = (deps.fs ?? fs).statfsSync(project)
  const free = Number(stat.bavail) * Number(stat.bsize) / GIB
  if (!Number.isFinite(free) || free < 0) throw new Error('project volume free space is unreadable')
  return free
}

export function diskDecision({ project, freeGib, needsWorktree = true }, deps = {}) {
  const free = freeGib ?? readDiskFreeGib(project, deps)
  const ok = !needsWorktree || free - ADMISSION.WT_NEED_GIB >= ADMISSION.DISK_FLOOR_GIB
  return { ok, disk_free_gib: free, motivo_limite: ok ? null : 'disco' }
}
