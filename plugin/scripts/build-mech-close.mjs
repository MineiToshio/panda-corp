// build-mech-close.mjs — proposal 40 §2 (Lever 1): the build's TAIL made deterministic where it judges nothing.
//
//   security-scope  --since <pin> [--write-report] [--findings N]
//                   the security DELTA is conditional: the landed diff since the early audit's pin is scanned with the
//                   product floor's sibling rules (securityDeltaTriggers: routes, server actions, middleware,
//                   next.config, headers, auth, dependencies; dangerouslySetInnerHTML, innerHTML, eval, raw SQL, fs path
//                   joins, redirect/fetch from input, cookies). Triggered → the engine runs the opus delta audit. Not
//                   triggered + --write-report → the early audit's report becomes docs/reviews/security-<local date>.md,
//                   committed. An unreadable range is `triggered` (fail-closed: the audit runs).
//   telemetry-scope [--write-na]
//                   telemetry is conditional on docs/analytics/events.md. No plan → not applicable. A plan whose events
//                   have NO emitter in the code fails loud (`no-emitters`). A plan with no events → not applicable (and
//                   --write-na records its verification section when missing).
//   close           --token T --epoch E [--max-age 900] [--ui-skip <reason> --ui-skip-frds <a,b>] [--visual-qa degraded]
//                   [--smoke-sha <sha>]
//                   the release close, scripted: the fail-closed release asserts (every FRD rollup VERIFIED, a fresh
//                   security report, the telemetry verification when a plan exists, no building change card left to
//                   archive, and with --smoke-sha no product code past the commit the production smoke judged:
//                   `stale-smoke` otherwise), ONE full verify.sh (or a reusable script-sealed report of HEAD), the journal gold, phase
//                   release, then the fenced two-phase lease release. Refuses at the first failed assert; it never
//                   judges a seam (that is the cross-feature review's job, spawned by the engine only when needed).
//   prod-smoke      --path <worktree> [--port N] [--sha <sha>]
//                   `next build && next start` in a detached worktree at HEAD (never the main tree, where visual-qa
//                   runs `next dev` and commits), the template's e2e/prod-smoke.spec.ts visiting every blessed route
//                   plus one sample per dynamic route: red on a CSP violation, a rendered error boundary or an empty
//                   <main> (ppv2 f4ed29a: the production CSP broke every blog post while every `next dev` gate was green).

import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { finalizeRelease, localDay, quiesce, readSecurityReport, setProjectPhase } from '../runtime/build-state.mjs'
import { InputError, JOURNALS, PROJECTION, REPORT_REL, Refusal, acquireLock, dirtyEntries, projectCtx, releaseLock, reportProvenance, sealReportProvenance, unique } from './build-mech-lib.mjs'
import { securityDeltaTriggers } from './product-floor.mjs'
import { runVerify } from './build-mech-verify.mjs'

const STATUS = PROJECTION
const EVENTS = 'docs/analytics/events.md'
const CODE_RE = /\.[cm]?[jt]sx?$/
const NON_PRODUCT_RE = /(^|\/)(docs|e2e|__tests__|_tests|tests?|fixtures?|node_modules|\.pandacorp|\.next)\/|\.(test|spec|stories)\.[cm]?[jt]sx?$/

function emit(o, fields) {
  const file = o.events || path.join(os.homedir(), '.claude', 'dashboard-events.ndjson')
  try { mkdirSync(path.dirname(file), { recursive: true }); appendFileSync(file, `${JSON.stringify({ event: fields.event, at: new Date().toISOString(), project: o.projectName || path.basename(o.project), ...fields })}\n`) } catch (e) { process.stderr.write(`build-mech-close: could not append the ${fields.event} event (${e.message})\n`) }
}
/** Commit exactly `paths` (plus the journals' pending lines) under the main-writer lock; a failure unstages them. */
function commitPaths(ctx, o, paths, message) {
  const lock = acquireLock(ctx, { waitMs: o.lockWaitMs, op: o.op })
  try {
    const all = unique([...paths, ...dirtyEntries(ctx).filter((e) => JOURNALS.includes(e.path)).map((e) => e.path)])
    const add = ctx.g.run(['--literal-pathspecs', 'add', '--', ...all])
    const c = add.ok ? ctx.g.run(['--literal-pathspecs', 'commit', '-q', '-m', message, '--', ...all]) : add
    if (!c.ok) { ctx.g.run(['--literal-pathspecs', 'reset', '-q', '--', ...all]); throw new Refusal('commit-failed', `${message.split('\n')[0]}: the commit failed: ${(c.err || 'no output').split('\n').slice(-2).join(' | ')}`) }
    return ctx.g.must(['rev-parse', 'HEAD']).trim().slice(0, 12)
  } finally { releaseLock(lock) }
}

/**
 * The paths no production build reads: the project's state layer and its root docs/ tree (the same pathspec the
 * security delta excludes). A commit touching only these after the smoke leaves the smoked artifact current.
 */
const SMOKE_INERT_SPEC = ['--', '.', ':(exclude).pandacorp', ':(exclude)docs']
/**
 * Has product code moved past the commit the production smoke judged? Fail-closed: a smoked commit outside HEAD's
 * history, or an unreadable diff, is stale.
 * @returns {null | { reason: string, paths: string[] }} null when the smoke still judges HEAD's product code
 */
export function smokeDrift(ctx, sha) {
  if (ctx.g.run(['merge-base', '--is-ancestor', sha, 'HEAD']).ok !== true) return { reason: `the smoked commit ${sha} is not in HEAD's history`, paths: [] }
  const names = ctx.g.run(['diff', '--relative', '--name-only', '--no-renames', `${sha}..HEAD`, ...SMOKE_INERT_SPEC])
  if (!names.ok) return { reason: `${sha}..HEAD could not be read`, paths: [] }
  const paths = names.out.split('\n').map((p) => p.trim()).filter(Boolean)
  return paths.length ? { reason: `product code moved past the smoked commit ${sha}: ${paths.slice(0, 5).join(', ')}${paths.length > 5 ? ` (+${paths.length - 5})` : ''}`, paths } : null
}

// ── security-scope ─────────────────────────────────────────────────────────────────────────────
/**
 * The landed diff of the project over `since`..`to` (default HEAD), as the floor's input shape: changed paths + added
 * lines per file, plus `readFile(path)` — the file's body at `to` (null when deleted or unreadable), which the
 * module-level security triggers ('use server', an fs import) need beyond the added lines.
 */
export function landedDiff(ctx, since, to = 'HEAD') {
  const spec = ['--', '.', ':(exclude).pandacorp', ':(exclude)docs']
  const names = ctx.g.run(['diff', '--relative', '--name-only', '--no-renames', `${since}..${to}`, ...spec])
  const body = names.ok ? ctx.g.run(['diff', '--relative', '-U0', '--no-color', '--no-renames', `${since}..${to}`, ...spec]) : names
  if (!names.ok || !body.ok) return null
  const addedByFile = new Map()
  let cur = null
  for (const line of body.out.split('\n')) {
    if (line.startsWith('+++ ')) { cur = line === '+++ /dev/null' ? null : line.replace(/^\+\+\+ b\//, ''); if (cur && !addedByFile.has(cur)) addedByFile.set(cur, []); continue }
    if (cur && line.startsWith('+')) addedByFile.get(cur).push(line.slice(1))
  }
  const readFile = (p) => { const r = ctx.g.run(['show', `${to}:./${p}`]); return r.ok ? r.out : null }
  return { files: names.out.split('\n').filter(Boolean).map((p) => ({ path: p })), addedByFile, linesKnown: true, readFile }
}
export function securityScopeOp(o) {
  if (!o.since) throw new InputError('security-scope needs --since <the early audit pin>')
  const ctx = projectCtx(o.project)
  const diff = landedDiff(ctx, o.since)
  if (!diff) return { code: 0, body: { status: 'triggered', triggered: true, hits: [{ trigger: 'unreadable', kind: 'range', detail: `${o.since}..HEAD could not be read: the delta audit runs (fail-closed)` }] } }
  const t = securityDeltaTriggers(diff)
  if (t.triggered || !o.writeReport) return { code: 0, body: { status: t.triggered ? 'triggered' : 'quiet', triggered: t.triggered, hits: t.hits, files: diff.files.length } }
  let early = null
  try { early = readFileSync(path.join(ctx.project, '.pandacorp', 'run', 'security-early', `${o.since}.md`), 'utf8') } catch { early = null }
  if (!early || !early.trim()) throw new Refusal('no-early-report', `no early audit report for ${o.since} under .pandacorp/run/security-early/: the delta audit runs instead (fail-closed)`)
  const rel = `docs/reviews/security-${localDay()}.md`
  mkdirSync(path.join(ctx.project, 'docs', 'reviews'), { recursive: true })
  const findings = Number.isInteger(o.findings) ? o.findings : null
  const text = `# Security audit — ${localDay()}\n\nThe early read-only audit of commit \`${o.since}\` (below) is this build's security review. The delta since that commit (${diff.files.length} changed path(s), outside docs/ and .pandacorp/) touched no attack surface the delta triggers watch (routes, server actions, middleware, next.config, headers, auth, dependencies; dangerouslySetInnerHTML, innerHTML, eval, raw SQL, fs path joins, redirect/fetch built from input, cookies), so no delta audit ran (proposal 40, recorded by the scripted security-scope).${findings !== null ? ` Open Critical/High items from the early audit: ${findings}.` : ''}\n\n## Early audit (${o.since})\n\n${early.trim()}\n`
  writeFileSync(path.join(ctx.project, rel), text)
  const sha = commitPaths(ctx, { ...o, op: 'security-scope' }, [rel], `docs(security): audit report (early audit at ${o.since}; delta not triggered)`)
  if (findings === 0) emit(o, { event: 'Hardening', stage: 'security', status: 'ok' })
  return { code: 0, body: { status: 'written', triggered: false, hits: [], files: diff.files.length, report: rel, sha } }
}

// ── telemetry-scope ────────────────────────────────────────────────────────────────────────────
/** The planned event names of an event plan: the `### N. \`event_name\`` catalog headings, retired ones skipped. */
export function plannedEvents(text) {
  const out = []
  for (const m of String(text).matchAll(/^#{2,4}\s+(?:\d+\.\s*)?`([a-z][a-z0-9_]*)`(.*)$/gm)) if (!/retired/i.test(m[2]) && !out.includes(m[1])) out.push(m[1])
  return out
}
/** Event names that appear as a quoted string literal in tracked product code (tests, docs and e2e excluded). */
function emittedEvents(ctx, names) {
  const files = ctx.g.must(['ls-files', '--', '.']).split('\n').filter((p) => p && CODE_RE.test(p) && !NON_PRODUCT_RE.test(p))
  const found = new Set()
  for (const rel of files) {
    let text = ''
    try { const abs = path.join(ctx.project, rel); if (statSync(abs).size > 2 * 1024 * 1024) continue; text = readFileSync(abs, 'utf8') } catch { continue }
    for (const n of names) if (!found.has(n) && new RegExp(`(['"\`])${n}\\1`).test(text)) found.add(n)
    if (found.size === names.length) break
  }
  return found
}
export function telemetryScopeOp(o) {
  const ctx = projectCtx(o.project)
  const abs = path.join(ctx.project, EVENTS)
  if (!existsSync(abs)) return { code: 0, body: { status: 'absent', applicable: false, reason: `no ${EVENTS}: the project has no event plan, so there is no telemetry to verify` } }
  const text = readFileSync(abs, 'utf8')
  const planned = plannedEvents(text)
  if (!planned.length) {
    const verified = /^## Verification/m.test(text)
    let sha = null
    if (!verified && o.writeNa) {
      appendFileSync(abs, `\n## Verification ${localDay()}\n\nThe event plan lists no events: telemetry is not applicable (recorded by the scripted telemetry-scope, proposal 40).\n`)
      sha = commitPaths(ctx, { ...o, op: 'telemetry-scope' }, [EVENTS], 'docs(analytics): record telemetry verification, no planned events')
      emit(o, { event: 'Hardening', stage: 'telemetry', status: 'ok' })
    }
    return { code: 0, body: { status: 'no-events', applicable: false, verified: verified || Boolean(sha), sha } }
  }
  const emitted = emittedEvents(ctx, planned)
  const missing = planned.filter((n) => !emitted.has(n))
  if (!emitted.size) return { code: 4, body: { status: 'no-emitters', applicable: true, planned, missing, reason: `the event plan lists ${planned.length} event(s) (${planned.slice(0, 6).join(', ')}) and NONE is emitted anywhere in the product code: the instrumentation was never built` } }
  return { code: 0, body: { status: 'applicable', applicable: true, planned, missing } }
}

// ── close ──────────────────────────────────────────────────────────────────────────────────────
const fmStatus = (text) => (/^---\r?\n([\s\S]*?)\r?\n---/.exec(text) || [])[1]?.match(/^implementation_status:\s*['"]?([A-Z_]+)/m)?.[1] || 'UNKNOWN'
function frdRollups(ctx) {
  const dir = path.join(ctx.project, 'docs', 'frds')
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => {
    let text = ''
    try { text = readFileSync(path.join(dir, d.name, 'frd.md'), 'utf8') } catch { text = '' }
    return { frd: d.name, status: fmStatus(text) }
  })
}
function workOrderCounts(ctx) {
  let total = 0
  let verified = 0
  for (const f of frdRollups(ctx)) {
    const dir = path.join(ctx.project, 'docs', 'frds', f.frd, 'work-orders')
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir).filter((n) => /^wo-.*\.md$/i.test(n))) { total++; if (fmStatus(readFileSync(path.join(dir, name), 'utf8')) === 'VERIFIED') verified++ }
  }
  return { total, verified }
}
function buildingChanges(ctx) {
  const dir = path.join(ctx.project, '.pandacorp', 'inbox', 'changes')
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((n) => n.endsWith('.md')).filter((n) => { try { return /^status:\s*building\s*$/m.test(readFileSync(path.join(dir, n), 'utf8')) } catch { return false } })
}
/** The journal's GOLD (DR-047): a WO that reached reopen_count ≥ 2, or an architectural / deadlocked-contract entry. */
function journalGold(ctx) {
  const file = path.join(ctx.project, '.pandacorp', 'build-journal.jsonl')
  if (!existsSync(file)) return []
  const out = []
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    let j = null
    try { j = JSON.parse(line) } catch { continue }
    if (!j || !((Number(j.reopen_count) || 0) >= 2 || ['architectural', 'deadlocked-contract'].includes(j.classification))) continue
    const text = `- (agent-inferred) ${j.wo || j.frd || 'build'}: ${j.classification || `reopened ${j.reopen_count}x`} — ${String(j.why || j.tried || '').replace(/\s+/g, ' ').slice(0, 240)}`
    if (!out.includes(text)) out.push(text)
  }
  return out
}
/** The scripted full verify: a reusable script-sealed report of HEAD, or ONE verify.sh run. */
async function fullVerify(ctx, o, headFull) {
  let rep = null
  try { rep = JSON.parse(readFileSync(path.join(ctx.project, REPORT_REL), 'utf8')) } catch { rep = null }
  const age = rep ? Math.floor((Date.now() - Date.parse(rep.at)) / 1000) : -1
  if (rep && rep.scope === 'full' && rep.green === true && String(rep.sha || '') === headFull && age >= 0 && age <= o.maxAge && reportProvenance(ctx).ok) return { green: true, how: 'reused', failure: '' }
  const v = await runVerify(ctx, { cwd: ctx.project, timeoutMs: o.verifyTimeoutMs || 45 * 60 * 1000, op: 'close' })   // bench FM-7: slotted, timeout re-run
  try { rep = JSON.parse(readFileSync(path.join(ctx.project, REPORT_REL), 'utf8')) } catch { rep = null }
  if (rep) sealReportProvenance(ctx, 'close')
  if (!rep) return { green: false, how: 'ran', failure: `verify.sh (exit ${v.code}) left no readable gate-report.json` }
  if (String(rep.sha || '') !== headFull) return { green: false, how: 'ran', failure: `stale gate-report: its sha is not HEAD ${headFull.slice(0, 12)}` }
  const red = (Array.isArray(rep.subgates) ? rep.subgates : []).find((g) => g && g.exit !== 0)
  const green = v.code === 0 && rep.green === true && rep.scope === 'full'
  return { green, how: 'ran', failure: green ? '' : red ? `${red.name} red` : `verify.sh exited ${v.code} (scope ${rep.scope})` }
}
export async function closeOp(o) {
  if (!o.token || o.epoch === undefined) throw new InputError('close needs --token and --epoch (the fenced lease)')
  const ctx = projectCtx(o.project)
  const dirty = dirtyEntries(ctx).filter((e) => e.path !== STATUS && !JOURNALS.includes(e.path)).map((e) => e.path)
  if (dirty.length) throw new Refusal('dirty', `the tree is not clean (${dirty.join(', ')}): the release is certified only on a committed tree`, { paths: dirty })
  const notVerified = frdRollups(ctx).filter((f) => f.status !== 'VERIFIED').map((f) => `${f.frd} (${f.status})`)
  if (notVerified.length) throw new Refusal('not-verified', `FRD rollup(s) not VERIFIED on disk: ${notVerified.join(', ')}`, { frds: notVerified })
  let report
  try { report = await readSecurityReport(ctx.project) } catch (e) { throw new Refusal('no-security-evidence', `the security report is missing: ${e.message}`) }
  const started = Date.parse(((/^run_started_at:[ \t]*['"]?([^'"\n]+)/m.exec(readFileSync(path.join(ctx.project, STATUS), 'utf8')) || [])[1] || '').trim())
  if (!Number.isFinite(started)) throw new Refusal('no-security-evidence', 'status.yaml carries no readable run_started_at: the security report cannot be proven fresh')
  if (statSync(path.join(ctx.project, report)).mtimeMs <= started) throw new Refusal('stale-security-evidence', `${report} predates this run (run_started_at): a previous run's report is not this build's evidence`)
  const events = path.join(ctx.project, EVENTS)
  if (existsSync(events) && !/^## Verification/m.test(readFileSync(events, 'utf8'))) throw new Refusal('no-telemetry-evidence', `${EVENTS} has no "## Verification" section`)
  const cards = buildingChanges(ctx)
  if (cards.length) throw new Refusal('archive-pending', `change card(s) still building: ${cards.join(', ')} — the archive step runs first (DR-069 §7)`, { cards })
  if (o.smokeSha !== undefined) {
    if (!/^[0-9a-f]{7,40}$/i.test(o.smokeSha)) throw new InputError('--smoke-sha must be a commit id (7 to 40 hex digits)')
    const drift = smokeDrift(ctx, o.smokeSha)
    if (drift) throw new Refusal('stale-smoke', `${drift.reason}: the production smoke must judge the commit that is released (re-smoke HEAD first)`, { smoke: o.smokeSha, paths: drift.paths })
  }
  const headFull = ctx.g.must(['rev-parse', 'HEAD']).trim()
  const v = await fullVerify(ctx, o, headFull)
  if (!v.green) return { code: 4, body: { status: 'red', verify: v.how, failure: v.failure, sha: headFull.slice(0, 12) } }
  const gold = journalGold(ctx)
  if (gold.length) { mkdirSync(path.join(ctx.project, '.pandacorp', 'run'), { recursive: true }); appendFileSync(path.join(ctx.project, '.pandacorp', 'run', 'lessons.md'), `${gold.join('\n')}\n`) }
  if (o.visualQa === 'degraded') { mkdirSync(path.join(ctx.project, '.pandacorp', 'comms'), { recursive: true }); appendFileSync(path.join(ctx.project, '.pandacorp', 'comms', 'progress.md'), `\n- ${new Date().toISOString()}: QA visual degradado (el pase de fidelidad no confirmó resultado): revisa la fidelidad a mano; el verify.sh completo del cierre quedó verde.\n`) }
  await setProjectPhase(ctx.project, o.token, o.epoch, 'release')
  const released = commitPaths(ctx, { ...o, op: 'close' }, [STATUS], 'chore(release): phase release\n\nEvery FRD VERIFIED, hardening evidence present, the full verify.sh green (proposal 40: scripted close).')
  const wos = workOrderCounts(ctx)
  const frds = frdRollups(ctx)
  emit(o, { event: 'Hardening', stage: 'integration', status: 'ok' })
  emit(o, { event: 'BuildComplete', wos: `${wos.verified}/${wos.total}`, frds: `${frds.filter((f) => f.status === 'VERIFIED').length}/${frds.length}`, verdict: 'released' })
  if (o.uiSkip) emit(o, { event: 'UiPassSkipped', pass: 'visual-qa', frd: o.uiSkipFrds || '', reason: o.uiSkip })
  await quiesce(ctx.project, o.token, o.epoch)
  const changed = dirtyEntries(ctx).some((e) => e.path === STATUS)
  const quiesced = changed ? commitPaths(ctx, { ...o, op: 'close' }, [STATUS], 'chore: quiesce Claude build lease') : null
  await finalizeRelease(ctx.project, o.token, o.epoch)
  return { code: 0, body: { status: 'released', verify: v.how, sha: released, quiesced, report, gold: gold.length } }
}

// ── prod-smoke ─────────────────────────────────────────────────────────────────────────────────
/**
 * The verdict of the prod-smoke report the spec wrote (one JSON line per visited route). Fail-closed: no report, an
 * unreadable line, no route visited, or a non-zero runner exit with no red route is red too.
 * @param {string|null} text the report's content
 * @param {number|null} exit the Playwright runner's exit code
 * @returns {{ green: boolean, routes: number, red: Array<{path: string, reasons: string[]}>, failure: string }}
 */
export function readProdSmokeReport(text, exit) {
  if (text === null || text === undefined) return { green: false, routes: 0, red: [], failure: `the production smoke wrote no report (runner exit ${exit})` }
  const rows = []
  for (const line of String(text).split('\n').filter((l) => l.trim())) {
    try { rows.push(JSON.parse(line)) } catch { return { green: false, routes: rows.length, red: [], failure: 'an unreadable line in the production smoke report' } }
  }
  const red = rows.filter((r) => !r || r.green !== true).map((r) => ({ path: String((r && r.path) || '?'), reasons: Array.isArray(r && r.reasons) ? r.reasons.map(String) : ['no verdict'] }))
  if (!rows.length) return { green: false, routes: 0, red, failure: 'the production smoke visited no route' }
  if (red.length) return { green: false, routes: rows.length, red, failure: red.slice(0, 3).map((r) => `${r.path}: ${r.reasons.slice(0, 2).join('; ')}`).join(' | ') }
  if (exit !== 0) return { green: false, routes: rows.length, red, failure: `every route judged green but the runner exited ${exit}` }
  return { green: true, routes: rows.length, red, failure: '' }
}
export function prodSmokeOp(o, { gatePrepare }) {
  if (!o.path) throw new InputError('prod-smoke needs --path <worktree>')
  const ctx = projectCtx(o.project)
  if (!existsSync(path.join(ctx.project, 'e2e', 'prod-smoke.spec.ts'))) throw new Refusal('missing-harness', 'e2e/prod-smoke.spec.ts is missing: the production-build smoke harness is part of the stack template (run /pandacorp:upgrade); a missing harness is red, never a skip')
  const sha = o.sha || ctx.g.must(['rev-parse', 'HEAD']).trim()
  const prep = gatePrepare({ ...o, path: o.path, sha })
  if (prep.code !== 0) return { code: 4, body: { status: 'red', stage: 'prepare', failure: `the smoke worktree could not be prepared: ${prep.body.failure}`, sha: sha.slice(0, 12) } }
  const dir = path.join(path.resolve(o.path), ctx.prefix)
  const reportFile = path.join(dir, '.pandacorp', 'run', 'prod-smoke.ndjson')
  rmSync(reportFile, { force: true })
  mkdirSync(path.dirname(reportFile), { recursive: true })
  const env = { ...process.env, CI: '', PANDACORP_PROD_SMOKE: '1', PANDACORP_PROD_SMOKE_REPORT: reportFile, ...(o.port !== undefined ? { PORT: String(o.port) } : {}) }
  const r = spawnSync('pnpm', ['exec', 'playwright', 'test', 'e2e/prod-smoke.spec.ts', '--project', 'desktop', '--reporter=line'], { cwd: dir, env, encoding: 'utf8', timeout: o.verifyTimeoutMs || 20 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 })
  let text = null
  try { text = readFileSync(reportFile, 'utf8') } catch { text = null }
  const v = readProdSmokeReport(text, r.status)
  const tail = v.green ? '' : `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-4).join(' | ')
  return { code: v.green ? 0 : 4, body: { status: v.green ? 'green' : 'red', green: v.green, routes: v.routes, red: v.red, failure: v.failure, sha: sha.slice(0, 12), head: sha, ...(tail ? { tail: tail.slice(0, 600) } : {}) } }
}
