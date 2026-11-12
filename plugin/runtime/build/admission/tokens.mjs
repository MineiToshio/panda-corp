// admission.json: unit tokens (D4) and the reading history; single writer is `next`, under the lease mutex (split from admission.mjs).
import { createHash, randomBytes } from 'node:crypto'
import * as nodeFs from 'node:fs'
import path from 'node:path'
import { ADMISSION } from './constants.mjs'

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
