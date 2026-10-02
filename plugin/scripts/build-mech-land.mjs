// build-mech-land.mjs — proposal 40 §2 (Close-out engine fixes): `gate-land`, the scripted landing of what an FRD gate
// wrote in its frozen slot. Before it, a haiku apply agent copied the gate's tests onto main and was trusted to stage
// them (bench F-2's close-out found them untracked and committed them itself), and a gate's new-route bless never left
// the slot at all (the close-out of F-1/F-2 blessed by hand). Here the gate's PASS lands as ONE commit on main, under
// the main-writer lock, naming the gate, its FRD and its pin (the DR-080 provenance: the reviewer authored and blessed
// it; the builder never did):
//   · a NEW reviewer test file                     → copied
//   · a NEW visual baseline (`*-snapshots/*.png`)  → copied (the bless of a route that had no baseline)
//   · e2e/routes.ts, the FRD's fdd.md, a changed test → its recorded diff, 3-way applied onto a main that moved since
//   · a CHANGED or deleted existing baseline       → refused: a blessed baseline that changes is a regression, never a bless
//   · anything else (scratch, product code)        → kept as evidence only
// A path whose copy would overwrite different content refuses the whole landing before anything is written.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { BASELINE_RE, InputError, Refusal, acquireLock, dirtyEntries, projectCtx, releaseLock, unique } from './build-mech-lib.mjs'

/** The engine's REVIEWER_TEST_PATH: the paths a reviewer's adversarial tests live under. */
const REVIEWER_TEST_RE = /(^|\/)(__tests__|_tests|tests?|e2e)\/|\.(test|spec)\.[cm]?[jt]sx?$/
const ROUTES = 'e2e/routes.ts'

/**
 * What one salvaged entry becomes on main.
 * @returns {{ kind: 'test'|'baseline'|'bless'|'bless-provenance'|'refused'|'kept', how?: 'copy'|'patch', why?: string }}
 */
export function landingKind(projRel, status, frd) {
  if (BASELINE_RE.test(projRel)) return status === 'untracked' ? { kind: 'baseline', how: 'copy' } : { kind: 'refused', why: 'changed-baseline' }
  if (status === 'deleted') return { kind: 'kept' }
  if (projRel === ROUTES) return status === 'modified' ? { kind: 'bless', how: 'patch' } : { kind: 'kept' }
  if (projRel === `docs/frds/${frd}/fdd.md`) return status === 'modified' ? { kind: 'bless-provenance', how: 'patch' } : { kind: 'kept' }
  if (REVIEWER_TEST_RE.test(projRel)) return { kind: 'test', how: status === 'untracked' ? 'copy' : 'patch' }
  return { kind: 'kept' }
}

const sameBytes = (a, b) => { try { return readFileSync(a).equals(readFileSync(b)) } catch { return false } }

// The surface manifest grows by appended rows while a gate reviews, so a line diff of a bless flip collides with the
// row another FRD appended right after it. A bless is a fact about one surface id: replay exactly those flips.
const SURFACE_ID = /\bid:\s*["'\x60]([^"'\x60]+)["'\x60]/
const flipsOf = (pinText, gateText) => {
  const blessedAt = (text, b) => new Set(String(text).split('\n').filter((l) => new RegExp(`\\bblessed:\\s*${b}\\b`).test(l)).map((l) => (SURFACE_ID.exec(l) || [])[1]).filter(Boolean))
  const was = blessedAt(pinText, 'false')
  return [...blessedAt(gateText, 'true')].filter((id) => was.has(id))
}
/** The gate's routes.ts differs from the pin ONLY by `blessed: false → true` flips: replay them onto main's text. */
export function replayBlessFlips(pinText, gateText, mainText) {
  const ids = flipsOf(pinText, gateText)
  if (!ids.length) return null
  const flip = (text) => text.split('\n').map((l) => { const id = (SURFACE_ID.exec(l) || [])[1]; return id && ids.includes(id) ? l.replace(/\bblessed:\s*false\b/, 'blessed: true') : l }).join('\n')
  if (flip(pinText) !== gateText) return null   // the gate changed more than the flips: the 3-way diff decides
  const out = flip(mainText)
  return out === mainText ? { text: out, ids, already: true } : { text: out, ids, already: false }
}

/** `gate-land --dir <evidence> --frd <folder> [--pin <sha>]` — see the header. */
export function gateLandOp(o) {
  if (!o.dir || o.frds.length !== 1) throw new InputError('gate-land needs --dir <evidence dir> and exactly one --frd <folder>')
  const frd = o.frds[0]
  const ctx = projectCtx(o.project)
  const dir = path.resolve(o.dir)
  let manifest = null
  try { manifest = JSON.parse(readFileSync(path.join(dir, 'gate-manifest.json'), 'utf8')) } catch { manifest = null }
  if (!manifest || !Array.isArray(manifest.files)) throw new Refusal('no-manifest', `no readable gate-manifest.json in ${dir}: nothing the release recorded can be landed`)
  const pin = String(o.pin || manifest.pin || '').slice(0, 12)
  const top = ctx.top
  const gTop = (args) => ctx.g.run(['-C', top, ...args])
  const plan = []
  const refused = []
  const kept = []
  for (const e of manifest.files) {
    if (!e || typeof e.path !== 'string') continue
    const projRel = ctx.prefix && e.path.startsWith(ctx.prefix) ? e.path.slice(ctx.prefix.length) : e.path
    const k = landingKind(projRel, e.status, frd)
    if (k.kind === 'refused') refused.push({ path: e.path, why: k.why })
    else if (k.kind === 'kept') kept.push(e.path)
    else plan.push({ ...e, projRel, ...k })
  }
  // Every copy is checked before anything is written: a different file already at the path is a conflict.
  const conflicts = plan.filter((x) => x.how === 'copy' && existsSync(path.join(top, x.path)) && !sameBytes(path.join(top, x.path), path.join(dir, x.path))).map((x) => x.path)
  if (conflicts.length) throw new Refusal('conflict', `a different file already sits at ${conflicts.join(', ')} on main: nothing landed (the gate's copies stay in ${dir})`, { paths: conflicts })
  const lock = acquireLock(ctx, { waitMs: o.lockWaitMs, op: 'gate-land' })
  try {
    const dirtyNow = new Set(dirtyEntries(ctx).map((x) => x.path))
    const landed = []
    const unapplied = []
    for (const x of plan) {
      const dest = path.join(top, x.path)
      if (x.how === 'copy') {
        if (!existsSync(dest)) { mkdirSync(path.dirname(dest), { recursive: true }); copyFileSync(path.join(dir, x.path), dest) }
        landed.push(x)
        continue
      }
      if (dirtyNow.has(x.projRel)) { unapplied.push({ path: x.path, why: 'dirty on main (an in-flight build owns it): left for the next landing' }); continue }
      const patch = x.patch ? path.join(dir, x.patch) : null
      if (!patch || !existsSync(patch)) { unapplied.push({ path: x.path, why: 'no recorded diff' }); continue }
      if (gTop(['apply', '--reverse', '--check', patch]).ok) { landed.push(x); continue }   // already on main: idempotent
      if (x.kind === 'bless') {
        const pinText = manifest.pin ? gTop(['show', `${manifest.pin}:${x.path}`]) : { ok: false }
        const r = pinText.ok && existsSync(dest) ? replayBlessFlips(pinText.out, readFileSync(path.join(dir, x.path), 'utf8'), readFileSync(dest, 'utf8')) : null
        if (r) { if (!r.already) writeFileSync(dest, r.text); landed.push(x); continue }
      }
      const a = gTop(['apply', '--3way', '--whitespace=nowarn', patch])
      if (a.ok) { landed.push(x); continue }
      gTop(['--literal-pathspecs', 'reset', '-q', '--', x.path])
      gTop(['--literal-pathspecs', 'checkout', 'HEAD', '--', x.path])
      unapplied.push({ path: x.path, why: `the diff does not apply on main: ${a.err.split('\n').slice(-1)[0] || 'conflict'}` })
    }
    const paths = unique(landed.map((x) => x.path))
    if (paths.length) {
      const add = gTop(['--literal-pathspecs', 'add', '--', ...paths])
      if (!add.ok) throw new Refusal('stage-failed', `could not stage the gate's files: ${add.err}`)
    }
    const staged = paths.length ? gTop(['--literal-pathspecs', 'diff', '--cached', '--name-only', '--', ...paths]).out.split('\n').filter(Boolean) : []
    if (!staged.length) return { code: 0, body: { status: 'nothing', frd, pin, landed: [], refused, unapplied, kept, reason: 'every landable file is already on main' } }
    const blessed = landed.some((x) => ['baseline', 'bless', 'bless-provenance'].includes(x.kind) && staged.includes(x.path))
    const message = `test(${frd}): land the FRD gate's reviewer tests${blessed ? ' and its new-route bless' : ''} (DR-080)\n\nThe FRD gate for ${frd} passed at its pin; what it authored${blessed ? ' and blessed at green' : ''} lands here, committed by the scripted gate-land (proposal 40), never by the builder.\n\nGate-Pin: ${pin || 'unknown'}${blessed ? `\nBlessed-By: frd-gate ${frd} @ ${pin || 'unknown'}` : ''}`
    const c = gTop(['--literal-pathspecs', 'commit', '-q', '-m', message, '--', ...staged])
    if (!c.ok) { gTop(['--literal-pathspecs', 'reset', '-q', '--', ...staged]); throw new Refusal('commit-failed', `the landing commit failed: ${c.err.split('\n').slice(-3).join(' | ') || 'no output'}`) }
    const sha = ctx.g.must(['rev-parse', 'HEAD']).trim().slice(0, 12)
    return { code: 0, body: { status: 'landed', frd, pin, sha, landed: landed.filter((x) => staged.includes(x.path)).map((x) => ({ path: x.path, kind: x.kind })), refused, unapplied, kept } }
  } finally { releaseLock(lock) }
}
