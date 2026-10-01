// build-mech-fast.mjs — the fast lane's deterministic ops of pandacorp-build-mech.mjs (proposal 39 §2 C3/C4/C6):
//   plan          the build plan read straight from the blueprints' Build Plan tables and the work-order frontmatter,
//                 so a fast-lane run needs no plan agent (a missing or drifted Build Plan → `no-build-plan`, and the
//                 engine falls back to the plan agent);
//   classify-frd  the deterministic floor of an FRD (classify-change.mjs over its declared artifacts + its frd.md text,
//                 or over a landed range), written to the FRD frontmatter `floor:` — monotone, never lowered;
//   verify        the USABLE check of one built FRD: clean tree (the shared append-only journals excepted: a gate in a
//                 parallel slot appends to them at any time), every work order committed IN_REVIEW, the landed floor (or
//                 the engine's own `--floor` verdict), then `verify.sh` on that clean SHA; green and not floor → ONE
//                 committed build_usable line (it sweeps the journals' pending lines) and only then `usable` + the event.
// Every op returns { code, body } for the CLI's one sealed line; nothing here prints.

import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { InputError, JOURNALS, PROJECTION, Refusal, acquireLock, blobAt, dirtyEntries, findWo, fmGet, frontmatterStatus, inReviewWindow, projectCtx, releaseLock, unique, withdrawLine, woAcIds, woIdOf } from './build-mech-lib.mjs'
import { decideGreenfield, probe as probeGreenfield } from './greenfield-probe.mjs'

const CLASSIFIER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'classify-change.mjs')
const TRACK = JOURNALS[0]
const AC_TEXT_CAP = 2400
const FM_BLOCK_RE = /^---\r?\n([\s\S]*?)\r?\n---/
const isDir = (p) => { try { return statSync(p).isDirectory() } catch { return false } }
const readText = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null)
const noneLike = (x) => !x || /^(none|n\/a|—|-)$/i.test(x)

/** A frontmatter list: inline (`[a, "b"]`), a scalar, or a YAML block (`key:` then `  - a` lines). */
export function fmList(text, key) {
  const fm = (FM_BLOCK_RE.exec(String(text || '')) || [])[1]
  if (fm === undefined) return []
  const m = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(fm)
  if (!m) return []
  const inline = m[1].replace(/\s+#.*$/, '').trim()
  const items = inline
    ? inline.replace(/^\[|\]$/g, '').split(',')
    : fm.slice(m.index + m[0].length).split('\n').slice(1).map((l) => /^\s+-\s+(.*)$/.exec(l)).filter(Boolean).map((x) => x[1])
  return items.map((x) => x.trim().replace(/^['"]|['"]$/g, '')).filter((x) => !noneLike(x))
}
const listCell = (cell) => String(cell || '').replace(/^\[|\]$/g, '').split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')).filter((x) => !noneLike(x))

/** The blueprint's `## Build Plan` table: WO id → { deps, order }, or null when the section or its rows are absent. */
export function parseBuildPlan(text) {
  const heading = /^##(?:\s+\d+\.)?\s+Build Plan[^\n]*$/mi.exec(String(text || ''))
  if (!heading) return null
  const rest = text.slice(heading.index + heading[0].length)
  const end = rest.search(/^##\s/m)
  const rows = new Map()
  for (const line of (end < 0 ? rest : rest.slice(0, end)).split('\n')) {
    if (!/^\|\s*`?WO-[A-Za-z0-9-]+`?\s*\|/i.test(line)) continue
    const cells = line.split('|').slice(1, -1).map((c) => c.trim().replace(/`/g, ''))
    rows.set(cells[0].toUpperCase(), { deps: listCell(cells[1]).map((d) => d.toUpperCase()), order: rows.size })
  }
  return rows.size ? rows : null
}

/** Every FRD folder with work orders: its frd.md, its Build Plan and each work order's frontmatter. */
function readFrds(ctx) {
  const base = path.join(ctx.project, 'docs', 'frds')
  const out = []
  for (const frd of (isDir(base) ? readdirSync(base) : []).sort()) {
    const woDir = path.join(base, frd, 'work-orders')
    if (!isDir(woDir)) continue
    const wos = readdirSync(woDir).filter((n) => /^wo-.*\.md$/i.test(n)).sort().map((n) => {
      const rel = `docs/frds/${frd}/work-orders/${n}`
      const text = readFileSync(path.join(ctx.project, rel), 'utf8')
      return { rel, text, id: String(woIdOf(rel, text)).toUpperCase(), status: frontmatterStatus(text), deps: unique([...fmList(text, 'dependsOn'), ...fmList(text, 'depends_on')].map((d) => d.toUpperCase())) }
    })
    if (!wos.length) continue
    const frdText = readText(path.join(base, frd, 'frd.md')) || ''
    out.push({ frd, frdText, plan: parseBuildPlan(readText(path.join(base, frd, 'blueprint.md'))), wos, fmDeps: [...fmList(frdText, 'dependsOn'), ...fmList(frdText, 'depends_on')] })
  }
  return out
}
const sameDeps = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
/** Why this FRD's Build Plan cannot be trusted as the order (the engine then runs the plan agent), or null. */
function planDrift(f) {
  if (!f.plan) return `${f.frd}: blueprint.md has no Build Plan table`
  for (const w of f.wos) {
    const row = f.plan.get(w.id)
    if (!row) return `${f.frd}: ${w.id} is missing from the Build Plan`
    if (!sameDeps(row.deps, w.deps)) return `${f.frd}: ${w.id} dependency drift (frontmatter [${w.deps}] vs Build Plan [${row.deps}])`
  }
  for (const id of f.plan.keys()) if (!f.wos.some((w) => w.id === id)) return `${f.frd}: the Build Plan names ${id}, which has no work-order file`
  return null
}
/** Stable topological order: `order` breaks ties, a cycle keeps its remaining nodes in tie order (the engine names it). */
function topo(items, depsOf, keyOf) {
  const left = [...items]
  const done = new Set()
  const out = []
  while (left.length) {
    const i = left.findIndex((x) => depsOf(x).every((d) => done.has(d) || !items.some((y) => keyOf(y) === d)))
    const [x] = left.splice(i < 0 ? 0 : i, 1)
    done.add(keyOf(x)); out.push(x)
  }
  return out
}
/** The frd.md lines naming the ACs (and source REQs) a work order owns, verbatim and capped. */
function acTextOf(w, frdText) {
  const ids = unique([...woAcIds(w.text), ...fmList(w.text, 'source_requirements')])
  if (!ids.length) return ''
  const lines = frdText.split('\n').filter((l) => ids.some((id) => new RegExp(`\\b${id.replace(/\./g, '\\.')}(?![0-9])`).test(l)))
  return lines.join('\n').slice(0, AC_TEXT_CAP)
}
function hasFrontend(ctx) {
  try {
    const pkg = JSON.parse(readFileSync(path.join(ctx.project, 'package.json'), 'utf8'))
    return ['next', 'react', 'vue', 'svelte', '@sveltejs/kit', 'astro'].some((d) => (pkg.dependencies && pkg.dependencies[d]) || (pkg.devDependencies && pkg.devDependencies[d]))
  } catch { return false }
}

// ── classify-frd ───────────────────────────────────────────────────────────────────────────────
/** classify-change.mjs's verdict as a floor: any critical floor hit, and any unusable answer fails closed to floor. */
function classifier(ctx, args) {
  const r = spawnSync(process.execPath, [CLASSIFIER, '--repo', ctx.project, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000 })
  let v = null
  try { v = JSON.parse(String(r.stdout || '').trim().split('\n').pop()) } catch { v = null }
  if (!v || !Array.isArray(v.floor_hits)) return { floor: true, hits: [`classifier gave no verdict (exit ${r.status}) — fail-closed`] }
  const hits = v.floor_hits.filter((h) => h.level === 'critical').map((h) => `${h.signal}: ${h.detail}`)
  return { floor: hits.length > 0, hits }
}
const frdMdRel = (frd) => `docs/frds/${frd}/frd.md`
const setFmKey = (text, key, value) => {
  const m = FM_BLOCK_RE.exec(text)
  if (!m) throw new InputError('frd.md has no frontmatter to carry floor:')
  const fm = new RegExp(`^${key}:.*$`, 'm').test(m[1]) ? m[1].replace(new RegExp(`^${key}:.*$`, 'm'), `${key}: ${value}`) : `${m[1]}\n${key}: ${value}`
  return `${text.slice(0, m.index)}---\n${fm}\n---${text.slice(m.index + m[0].length)}`
}
/**
 * The floor of each FRD (plan time: declared artifacts + frd.md text; landed: `range`), monotone over its frontmatter.
 * Writes and commits (one commit, only those frd.md) every `floor:` that changed; never lowers a `floor: true`.
 */
function classifyFrds(ctx, frds, { range = null, lockWaitMs }) {
  const results = frds.map((f) => {
    const rel = frdMdRel(f.frd)
    const before = fmGet(f.frdText, 'floor').toLowerCase()
    let verdict
    if (range) verdict = classifier(ctx, ['--range', range])
    else {
      const files = unique(f.wos.flatMap((w) => fmList(w.text, 'artifacts')))
      verdict = files.length
        ? classifier(ctx, ['--files', files.join(','), ...(existsSync(path.join(ctx.project, rel)) ? ['--text', rel] : [])])
        : { floor: true, hits: ['no declared artifacts — fail-closed'] }
    }
    const floor = before === 'true' || verdict.floor
    return { frd: f.frd, floor, previous: before || null, changed: before !== String(floor), floorHits: verdict.hits }
  })
  const changed = results.filter((x) => x.changed && existsSync(path.join(ctx.project, frdMdRel(x.frd))))
  let committed = null
  if (changed.length) {
    const lock = acquireLock(ctx, { waitMs: lockWaitMs, op: 'classify-frd' })
    try {
      const paths = changed.map((x) => frdMdRel(x.frd))
      const originals = paths.map((p) => readFileSync(path.join(ctx.project, p), 'utf8'))
      paths.forEach((p, i) => writeFileSync(path.join(ctx.project, p), setFmKey(originals[i], 'floor', changed[i].floor)))
      const add = ctx.g.run(['--literal-pathspecs', 'add', '--', ...paths])
      const c = add.ok ? ctx.g.run(['--literal-pathspecs', 'commit', '-q', '-m', `chore(build): floor classification of ${changed.map((x) => `${x.frd}=${x.floor}`).join(', ')}\n\nProposal 39 C3: deterministic (classify-change.mjs), monotone.`, '--', ...paths]) : add
      if (!c.ok) { ctx.g.run(['--literal-pathspecs', 'reset', '-q', '--', ...paths]); paths.forEach((p, i) => writeFileSync(path.join(ctx.project, p), originals[i])); throw new Refusal('commit-failed', `the floor commit failed and frd.md was restored: ${c.err || 'no output'}`) }
      committed = ctx.g.must(['rev-parse', 'HEAD']).trim().slice(0, 12)
    } finally { releaseLock(lock) }
  }
  return { results, committed }
}
export function classifyFrdOp(o) {
  if (!o.frds.length) throw new InputError('classify-frd needs at least one --frd <folder>')
  const ctx = projectCtx(o.project)
  const all = readFrds(ctx)
  const frds = o.frds.map((name) => all.find((f) => f.frd === name) || (() => { throw new InputError(`no FRD folder with work orders named ${name}`) })())
  const { results, committed } = classifyFrds(ctx, frds, { range: o.range || null, lockWaitMs: o.lockWaitMs })
  return { code: 0, body: { status: 'classified', frds: results, committed } }
}

// ── plan ───────────────────────────────────────────────────────────────────────────────────────
export function planOp(o) {
  const ctx = projectCtx(o.project)
  const all = readFrds(ctx)
  const owner = new Map(all.flatMap((f) => f.wos.map((w) => [w.id, f.frd])))
  const resolveFrd = (d) => all.find((f) => f.frd === d || f.frd.toLowerCase().startsWith(`${d.toLowerCase()}-`) || (/^FRD-\d+$/i.test(d) && f.frd.toLowerCase().startsWith(`frd-${d.split('-')[1]}-`)))
  const depsOf = (f) => unique([...f.fmDeps.map((d) => (resolveFrd(d) || { frd: d }).frd), ...f.wos.flatMap((w) => w.deps.map((d) => owner.get(d)).filter(Boolean))]).filter((d) => d !== f.frd)
  const unknown = o.frds.filter((x) => !all.some((f) => f.frd === x))
  if (unknown.length) return { code: 0, body: { status: 'no-build-plan', reason: `requested FRD(s) without work orders: ${unknown.join(', ')}` } }
  const scope = all.filter((f) => (!o.frds.length || o.frds.includes(f.frd)) && f.wos.some((w) => w.status !== 'VERIFIED'))
  for (const f of scope) { const why = planDrift(f); if (why) return { code: 0, body: { status: 'no-build-plan', reason: why } } }
  const pendingFrd = (name) => { const f = all.find((x) => x.frd === name); return Boolean(f && f.wos.some((w) => w.status !== 'VERIFIED')) }
  const unsatisfiedDeps = o.frds.length ? scope.flatMap((f) => depsOf(f).filter((d) => !o.frds.includes(d) && pendingFrd(d)).map((dep) => ({ frd: f.frd, dep }))) : []
  const ordered = topo(scope, depsOf, (f) => f.frd)
  const classified = o.classify && ordered.length ? classifyFrds(ctx, ordered, { lockWaitMs: o.lockWaitMs }) : null
  const floorOf = (f) => (classified ? classified.results.find((x) => x.frd === f.frd) : { floor: fmGet(f.frdText, 'floor').toLowerCase() === 'true', floorHits: [] })
  const frds = ordered.map((f) => {
    const woOrder = topo([...f.wos].sort((a, b) => f.plan.get(a.id).order - f.plan.get(b.id).order), (w) => w.deps, (w) => w.id)
    const fl = floorOf(f)
    return {
      frd: f.frd, deps: depsOf(f), floor: fl.floor, floorHits: fl.floorHits,
      workOrders: woOrder.map((w) => {
        const docStatus = fmGet(w.text, 'status').toUpperCase()
        const pending = w.status !== 'VERIFIED' && w.status !== 'BLOCKED'
        return { id: w.id, status: w.status, ...(docStatus ? { docStatus } : {}), path: w.rel, deps: w.deps, artifacts: fmList(w.text, 'artifacts'),
          difficulty: (fmGet(w.text, 'difficulty') || 'medium').toLowerCase(), reopen_count: Number(fmGet(w.text, 'reopen_count')) || 0,
          foundation: fmGet(w.text, 'foundation').toLowerCase() === 'true', summary: fmGet(w.text, 'title') || fmGet(w.text, 'slug') || w.id, acText: pending ? acTextOf(w, f.frdText) : '' }
      }),
    }
  })
  const web = hasFrontend(ctx)
  return { code: 0, body: { status: 'planned', stack: web ? 'A' : '', hasFrontend: web, unsatisfiedDeps, frds, floorCommit: classified ? classified.committed : null } }
}

// ── verify (the USABLE check) ──────────────────────────────────────────────────────────────────
function emit(o, fields) {
  const file = o.events || path.join(os.homedir(), '.claude', 'dashboard-events.ndjson')
  try { mkdirSync(path.dirname(file), { recursive: true }); appendFileSync(file, `${JSON.stringify({ event: fields.event, at: new Date().toISOString(), project: o.projectName || path.basename(o.project), ...fields })}\n`) } catch (e) { process.stderr.write(`pandacorp-build-mech: could not append the ${fields.event} event (${e.message})\n`) }
}
/** The verdict of the report verify.sh just wrote: green only when the run exited 0, the report is green and it is THIS sha's. */
function readReport(ctx, exit, headFull) {
  let rep = null
  try { rep = JSON.parse(readFileSync(path.join(ctx.project, '.pandacorp', 'run', 'gate-report.json'), 'utf8')) } catch { rep = null }
  if (!rep) return { green: false, scope: '', failure: `verify.sh (exit ${exit}) left no readable gate-report.json` }
  const scope = String(rep.scope ?? '')
  if (String(rep.sha || '') !== headFull) return { green: false, scope, failure: `stale gate-report: its sha ${String(rep.sha || '(none)').slice(0, 12)} is not HEAD ${headFull.slice(0, 12)}` }
  const red = (Array.isArray(rep.subgates) ? rep.subgates : []).find((g) => g && g.exit !== 0)
  const failure = red ? `${red.name}: ${(red.failures || []).slice(0, 2).join(' | ') || `exit ${red.exit}`}` : (exit !== 0 ? `verify.sh exited ${exit}` : '')
  return { green: exit === 0 && rep.green === true, scope, failure }
}
export function verifyOp(o) {
  if (o.frds.length !== 1) throw new InputError('verify needs exactly one --frd <folder>')
  const frd = o.frds[0]
  const ctx = projectCtx(o.project)
  const f = readFrds(ctx).find((x) => x.frd === frd)
  if (!f) throw new InputError(`no FRD folder with work orders named ${frd}`)
  const dirty = dirtyEntries(ctx).filter((e) => e.path !== PROJECTION && !JOURNALS.includes(e.path)).map((e) => e.path)
  if (dirty.length) throw new Refusal('dirty', `the tree is not clean (${dirty.join(', ')}): USABLE is certified only on a clean landed SHA`, { paths: dirty })
  const notIn = o.wos.map((id) => findWo(ctx, id)).filter((w) => frontmatterStatus(blobAt(ctx, 'HEAD', w.rel)) !== 'IN_REVIEW').map((w) => w.id)
  if (notIn.length) throw new Refusal('uncommitted', `${notIn.join(', ')} not committed IN_REVIEW at HEAD — nothing to certify`, { wos: notIn })
  const landed = o.since ? classifyFrds(ctx, [f], { range: `${o.since}..HEAD`, lockWaitMs: o.lockWaitMs }).results[0] : { floor: true, changed: false, floorHits: ['no --since: the landed range is unknown — fail-closed'] }
  // The engine's verdict is fail-closed and in memory (an unreadable plan-time classification): it can only add floor.
  const floor = landed.floor || o.floor === true
  const headFull = ctx.g.must(['rev-parse', 'HEAD']).trim()
  const sha = headFull.slice(0, 12)
  const r = spawnSync('bash', ['.pandacorp/verify.sh'], { cwd: ctx.project, encoding: 'utf8', timeout: o.verifyTimeoutMs || 45 * 60 * 1000, maxBuffer: 256 * 1024 * 1024 })
  const rep = readReport(ctx, r.status, headFull)
  const green = rep.green && rep.scope !== 'partial'
  // USABLE has ONE writer (DR-115): the committed build_usable line. No commit, no USABLE, no event.
  let usableCommit = null
  let usableFailure = ''
  if (green && !floor) {
    const lock = acquireLock(ctx, { waitMs: o.lockWaitMs, op: 'verify' })
    try {
      const trackAbs = path.join(ctx.project, TRACK)
      const existed = existsSync(trackAbs)
      const line = JSON.stringify({ kind: 'build_usable', frd, sha, at: new Date().toISOString() })
      appendFileSync(trackAbs, `${line}\n`)
      const paths = unique([TRACK, ...dirtyEntries(ctx).filter((e) => JOURNALS.includes(e.path)).map((e) => e.path)])
      const add = ctx.g.run(['--literal-pathspecs', 'add', '--', ...paths])
      const c = add.ok ? ctx.g.run(['--literal-pathspecs', 'commit', '-q', '-m', `chore(build): ${frd} usable at ${sha}\n\nProposal 39 C6: committed work orders, verify.sh green on the clean landed SHA, not floor.`, '--', ...paths]) : add
      if (c.ok) usableCommit = ctx.g.must(['rev-parse', 'HEAD']).trim().slice(0, 12)
      else {
        ctx.g.run(['--literal-pathspecs', 'reset', '-q', '--', ...paths])
        withdrawLine(trackAbs, line, existed)
        usableFailure = `the build_usable commit failed, so ${frd} is not USABLE: ${(c.err || 'no output').split('\n').slice(-3).join(' | ')}`
      }
    } finally { releaseLock(lock) }
    if (usableCommit) emit(o, { event: 'build_usable', frd, sha })
  }
  const usable = Boolean(usableCommit)
  const after = dirtyEntries(ctx).filter((e) => e.path !== PROJECTION).map((e) => e.path)
  return { code: 0, body: { status: green ? 'green' : 'red', frd, green, usable, floor, floorChanged: landed.changed, floorHits: landed.floorHits, sha, scope: rep.scope, failure: green ? '' : (rep.failure || `report scope ${rep.scope}`), usableCommit, ...(usableFailure ? { usableFailure } : {}), dirtyAfter: after, exit: r.status } }
}

// ── USABLE across runs (C6) ────────────────────────────────────────────────────────────────────
/**
 * The FRDs still USABLE at HEAD, derived from durable state only (DR-115: nothing is stored for it): the latest
 * build_usable line of each FRD committed in track.jsonl names a sha that is an ancestor of HEAD, every work order is
 * VERIFIED, IN_REVIEW or BLOCKED (one is not VERIFIED), and none was stamped IN_PROGRESS after that sha (a rebuild is
 * not USABLE until its own verify certifies it). The engine seeds its never-auto-discard guard from this list, so a
 * later run (after a defer, a paused-infra halt, an unlanded gate) keeps fix-forward only.
 * Also read by wo-revert.mjs, so a discard requested by ANY lane (the classic lane has no precheck) refuses it.
 * @param {object} ctx the projectCtx of the project
 * @param {{ frd?: string }} [only] restrict the derivation to one FRD folder
 * @returns {Array<{ frd: string, sha: string }>} in FRD folder order
 */
export function durableUsable(ctx, only = {}) {
  const latest = new Map()
  for (const line of String(blobAt(ctx, 'HEAD', TRACK) || '').split('\n')) {
    let j = null
    try { j = JSON.parse(line) } catch { j = null }
    if (j && j.kind === 'build_usable' && typeof j.frd === 'string' && typeof j.sha === 'string' && /^[0-9a-f]{7,40}$/i.test(j.sha)) latest.set(j.frd, j.sha)
  }
  const isAncestor = (a, b) => ctx.g.run(['merge-base', '--is-ancestor', a, b]).ok
  const out = []
  for (const f of readFrds(ctx).filter((x) => !only.frd || x.frd === only.frd)) {
    const sha = latest.get(f.frd)
    if (!sha || !ctx.g.run(['rev-parse', '--verify', '-q', `${sha}^{commit}`]).ok || !isAncestor(sha, 'HEAD')) continue
    const atHead = f.wos.map((w) => ({ rel: w.rel, status: frontmatterStatus(blobAt(ctx, 'HEAD', w.rel)) }))
    if (!atHead.every((w) => ['VERIFIED', 'IN_REVIEW', 'BLOCKED'].includes(w.status)) || atHead.every((w) => w.status === 'VERIFIED')) continue
    if (atHead.some((w) => inReviewWindow(ctx, w.rel).stamps.some((s) => !isAncestor(s, sha)))) continue
    out.push({ frd: f.frd, sha })
  }
  return out
}

// ── greenfield (the precheck's start verdict) ─────────────────────────────────────────────────
/**
 * Is this a freshly architected project, whose verify.sh is red BY CONSTRUCTION? The ONE definition lives in
 * greenfield-probe.mjs (DR-115: the classic baseline reads the same verdict, sealed); the fast lane's precheck asks it
 * with `allowDispatched`, since that precheck has already restored every uncommitted stamp and the engine stops on
 * any owner edit, so a committed dispatch stamp (IN_PROGRESS) carries no work.
 * @param {object} ctx the projectCtx of the project
 * @returns {{ greenfield: boolean, reason: string }}
 */
export function greenfieldOf(ctx) {
  return decideGreenfield(probeGreenfield(ctx.project), { allowDispatched: true })
}

export const FAST_OPS = { plan: planOp, 'classify-frd': classifyFrdOp, verify: verifyOp }
