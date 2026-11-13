// Machine-local performance learning. Local samples are capped; records contain basenames only.
// Sample writes run under the run lease. Host journal writes serialize independently, outside that mutex.
import * as fs from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { ADMISSION, STEPS } from './admission/constants.mjs'
import { readDiskFreeGib } from './admission/disk.mjs'
import { assertValid, atomicWriteJson, atomicWriteText, loadSchema, nowIso, readJson } from './fsx.mjs'
import { readJournal } from './journal.mjs'
import { buildPaths } from './paths.mjs'

export const SAMPLE_LIMIT = 2000
export const WORKER_POINTS_LIMIT = 200
const liveUnit = (u) => ['admitted', 'running'].includes(u.state)
const nonnegativeSeconds = (a, b) => Math.max(0, (Date.parse(b) - Date.parse(a)) / 1000)
const readLines = async (file) => {
  const raw = await fs.readFile(file, 'utf8').catch((e) => { if (e.code === 'ENOENT') return ''; throw e })
  return raw.split('\n').filter(Boolean).map((l) => JSON.parse(l))
}

/** Last five runs, machine-local. A malformed journal is reported, never silently treated as no history. */
export async function startRecommendation(deps = {}) {
  const rows = (await readLines(buildPaths('.', deps).perfJournalFile)).slice(-5)
  if (!rows.length) return { step: ADMISSION.K_START_DEFAULT, allow8: false }
  const allow8 = rows.some((r) => r.sustained_step >= 5 && Array.isArray(r.scale_events) && !r.scale_events.some((e) => e.to < e.from))
  const starts = rows.map((r) => r.recommended_start)
  if (starts.some((n) => !STEPS.includes(n))) throw new Error('performance journal has an invalid recommended_start')
  starts.sort((a, b) => a - b)
  // Lower median for an even number of records; keep the result on the discrete ladder.
  return { step: Math.min(starts[Math.floor((starts.length - 1) / 2)], allow8 ? 8 : 5), allow8 }
}

export async function initializePerformance({ project, runId, step, diskFreeGib }, deps = {}) {
  const p = buildPaths(project, deps)
  const meta = { run_id: runId, start: nowIso(deps), start_step: step, disk_start: diskFreeGib, last: null, ram_min: null, ram_max: null, swap_start: null, swap_peak: null, swap_end: null, step_seconds: {}, step_counts: {}, scale_events: [] }
  await atomicWriteJson(p.perfMetaFile, meta)
  return meta
}

/** Append a reading, preserving whole-run extrema/time totals even when older samples leave the bounded file. */
export async function recordSample({ project, state, reading, signals, diskFreeGib }, deps = {}) {
  const p = buildPaths(project, deps), t = nowIso(deps)
  let meta = await readJson(p.perfMetaFile)
  if (!meta || meta.run_id !== state.run_id) meta = await initializePerformance({ project, runId: state.run_id, step: reading.step, diskFreeGib }, deps)
  const sample = { t, step: reading.step, live_b: state.units.filter(liveUnit).length, live_h: state.jobs.filter((j) => j.h_slot && j.state === 'running').length, L: signals?.L ?? null, swap_used_mb: signals?.swap_used_mb ?? null, A_gib: signals?.A_gib ?? null, disk_free_gib: diskFreeGib, motivo: reading.motivo }
  if (meta.last) meta.step_seconds[meta.last.step] = (meta.step_seconds[meta.last.step] ?? 0) + nonnegativeSeconds(meta.last.t, t)
  meta.step_counts[sample.step] = (meta.step_counts[sample.step] ?? 0) + 1
  if (signals) {
    meta.ram_min = Math.min(meta.ram_min ?? Infinity, signals.A_gib)
    meta.ram_max = Math.max(meta.ram_max ?? -Infinity, signals.A_gib)
    meta.swap_start ??= signals.swap_used_mb
    meta.swap_peak = Math.max(meta.swap_peak ?? 0, signals.swap_used_mb)
    meta.swap_end = signals.swap_used_mb
  }
  if (reading.scale_event) meta.scale_events.push(reading.scale_event)
  meta.last = sample
  const samples = [...await readLines(p.perfSamplesFile), sample].slice(-SAMPLE_LIMIT)
  await atomicWriteText(p.perfSamplesFile, samples.map(JSON.stringify).join('\n') + '\n')
  await atomicWriteJson(p.perfMetaFile, meta)
  return sample
}

const pctl = (values, p) => values.length ? values.toSorted((a, b) => a - b)[Math.max(0, Math.ceil(values.length * p) - 1)] : null
function durations(state, events) {
  const starts = new Map(), totals = new Map(), counts = new Map()
  for (const u of state.units) counts.set(u.kind, (counts.get(u.kind) ?? 0) + 1)
  const kinds = new Map(state.units.map((u) => [u.id, u.kind]))
  for (const e of events) {
    const id = e.data?.unit
    if (e.type === 'unit_dispatched') starts.set(id, e.at)
    if (starts.has(id) && (['report_received', 'review_recorded', 'handback'].includes(e.type)
      || (e.type === 'unit_state' && ['reported', 'committed', 'verified', 'blocked'].includes(e.data.to)))) {
      const kind = kinds.get(id)
      if (kind) { const values = totals.get(kind) ?? []; values.push(nonnegativeSeconds(starts.get(id), e.at)); totals.set(kind, values) }
      starts.delete(id)
    }
  }
  return Object.fromEntries([...counts].map(([kind, count]) => [kind, { count, p50_s: pctl(totals.get(kind) ?? [], .5), p90_s: pctl(totals.get(kind) ?? [], .9) }]))
}

/** Bounded, evenly-spaced history including both endpoints (not just the last points). */
export function workerPoints(samples) {
  const picked = samples.length <= WORKER_POINTS_LIMIT ? samples : Array.from({ length: WORKER_POINTS_LIMIT }, (_, i) => samples[Math.round(i * (samples.length - 1) / (WORKER_POINTS_LIMIT - 1))])
  return picked.map(({ t, step, live_b, live_h }) => ({ t, step, live_b, live_h }))
}

// Born-complete host lock, dead holders reclaimed via an instance-specific non-empty tomb. Never evict a live writer.
async function withHostLock(file, fn) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const lock = `${file}.lock`, nonce = `${process.pid}-${randomBytes(12).toString('hex')}`, fresh = `${lock}.new-${nonce}`
  await fs.mkdir(fresh); await fs.writeFile(path.join(fresh, 'owner'), nonce)
  let held = false
  try {
    for (let i = 0; i < 200; i++) {
      try { await fs.rename(fresh, lock); held = true; break } catch (e) { if (!['EEXIST', 'ENOTEMPTY'].includes(e.code)) throw e }
      const owner = await fs.readFile(path.join(lock, 'owner'), 'utf8').catch(() => null)
      const pid = Number(owner?.split('-')[0])
      let dead = false
      if (pid > 0) { try { process.kill(pid, 0) } catch (e) { dead = e.code === 'ESRCH' } }
      if (dead && /^\d+-[a-f0-9]+$/.test(owner)) {
        const tomb = `${lock}.dead-${owner}`
        await fs.rename(lock, tomb).catch(() => {})
      }
      await new Promise((r) => setTimeout(r, 10))
    }
    if (!held) throw new Error('performance journal lock is busy')
    return await fn()
  } finally {
    if (held) await fs.rm(lock, { recursive: true, force: true })
    else await fs.rm(fresh, { recursive: true, force: true })
  }
}

/** Exactly one record per run (including finish retries); never fail a lifecycle command for telemetry. */
export async function finishPerformance({ project, state, outcome }, deps = {}) {
  try {
    const p = buildPaths(project, deps)
    const meta = await readJson(p.perfMetaFile)
    const warnings = []
    const { events } = await readJournal(p.journalFile).catch((e) => { warnings.push(`unit durations unavailable: ${e.message}`); return { events: [] } })
    const samples = await readLines(p.perfSamplesFile)
    const start = meta?.start ?? events.find((e) => e.type === 'run_started')?.at ?? nowIso(deps)
    const end = nowIso(deps), times = { ...meta?.step_seconds }
    if (meta?.last) times[meta.last.step] = (times[meta.last.step] ?? 0) + nonnegativeSeconds(meta.last.t, end)
    const startStep = meta?.start_step ?? ADMISSION.K_START_DEFAULT
    const sustained = STEPS.filter((s) => (times[s] ?? 0) >= ADMISSION.UP_COOLDOWN_S && (meta?.step_counts?.[s] ?? 0) >= 3)
    const sustainedStep = sustained.at(-1) ?? null
    const scales = meta?.scale_events ?? []
    const down = scales.filter((e) => e.to < e.from)
    const recommended = Math.min(sustainedStep ?? Math.min(startStep, ...samples.map((s) => s.step)), ...down.map((e) => e.to))
    const plugin = await readJson(new URL('../plugin-metadata.json', import.meta.url))
    const record = {
      run_id: state.run_id, project: path.basename(path.resolve(project)), plugin_version: plugin.version, start, end,
      outcome: outcome ?? (state.status_reason === 'engine_failure' ? 'engine_failure' : state.status),
      units_by_kind: durations(state, events), workers_over_time: workerPoints(samples),
      ram_gib: { min: meta?.ram_min ?? null, max: meta?.ram_max ?? null },
      swap_mb: { start: meta?.swap_start ?? null, peak: meta?.swap_peak ?? null, end: meta?.swap_end ?? null },
      scale_events: scales, start_step: startStep, sustained_step: sustainedStep, recommended_start: recommended,
      disk_free_gib: { start: meta?.disk_start ?? null, end: readDiskFreeGib(project, deps) },
    }
    assertValid(await loadSchema('perf-record'), record, { label: 'performance record', code: 'INVALID_STATE' })
    return await withHostLock(p.perfJournalFile, async () => {
      const prior = await readLines(p.perfJournalFile)
      if (prior.some((r) => r.run_id === record.run_id && r.project === record.project && r.start === start)) return { ok: true, appended: false, warnings }
      const handle = await fs.open(p.perfJournalFile, 'a', 0o600)
      try { await handle.writeFile(JSON.stringify(record) + '\n'); await handle.sync() } finally { await handle.close() }
      return { ok: true, appended: true, record, warnings }
    })
  } catch (e) { return { ok: false, error: String(e?.message ?? e) } }
}
