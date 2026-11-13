// admission.json: unit tokens (D4) and the reading history; single writer is `next`, under the lease mutex (split from admission.mjs).
import { createHash, randomBytes } from 'node:crypto'
import * as nodeFs from 'node:fs'
import path from 'node:path'
import { ADMISSION } from './constants.mjs'
import { advanceLadder, initialLadder } from './ladder.mjs'

/** sha256 hex of a raw token (the value stored in `state.units[].token_hash` and as the admission.json key). */
export const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex')

const isoNow = (ctx) => new Date(ctx.now ? ctx.now() : Date.now()).toISOString()

function loadAdmission(ctx) {
  const fs = ctx.fs ?? nodeFs
  let raw
  try { raw = fs.readFileSync(ctx.file, 'utf8') } catch (e) {
    if (e.code === 'ENOENT') return { tokens: {}, history: [], ladder: null }
    throw e
  }
  let doc
  try { doc = JSON.parse(raw) } catch (e) { throw new Error(`admission.json is corrupt (${ctx.file}): ${e.message}`) }
  if (!doc || typeof doc.tokens !== 'object' || doc.tokens === null || !Array.isArray(doc.history)) {
    throw new Error(`admission.json has an unexpected shape (${ctx.file})`)
  }
  return { ...doc, tokens: doc.tokens, history: doc.history }
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

/** Initialize the run's learned start under its lease, before any next reading. */
export function initializeAdmission(input, ctx) {
  const doc = loadAdmission(ctx)
  doc.ladder = initialLadder({ ...input, at: isoNow(ctx) })
  doc.history = []
  saveAdmission(ctx, doc)
  return doc.ladder
}

/** One reading per next call; safe mode and scaling never kill live work. */
export function recordReading(signals, ctx) {
  const doc = loadAdmission(ctx)
  doc.ladder = advanceLadder(doc.ladder, signals, isoNow(ctx))
  doc.history = doc.ladder.history.slice(-ADMISSION.HISTORY_LEN)
  delete doc.l4_since
  saveAdmission(ctx, doc)
  return { ...doc.ladder, history: doc.history }
}

/** Read-only adaptive state for admit/status; missing file uses the default start. */
export const readAdaptive = (ctx) => loadAdmission(ctx).ladder ?? initialLadder()
export const readHistory = (ctx) => loadAdmission(ctx).history

/** Persist one notification claim per disk-blocked episode, while holding the lease mutex. */
export function recordDiskWait(blocked, ctx) {
  const doc = loadAdmission(ctx)
  const notify = blocked && doc.disk_waiting !== true
  if (Boolean(doc.disk_waiting) !== blocked) {
    doc.disk_waiting = blocked
    saveAdmission(ctx, doc)
  }
  return notify
}
