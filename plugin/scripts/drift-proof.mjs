#!/usr/bin/env node
// drift-proof.mjs — BL-0178 policy (a*): the deterministic half of the pre-existing-drift decision.
//
// The FRD gate's reviewer may only PROPOSE that a contradicted contract pre-dates the cycle (a `fail`
// traceability entry with `claim: "preexisting"` + `evidence_test`, a probe test it wrote). It never
// decides. The build engine spawns a MECH agent that runs THIS script and hands its single JSON line
// back verbatim; the ENGINE applies the predicate (pandacorp-build.js, classifyDriftClaim). This script
// only gathers facts — it classifies nothing:
//
//   prove   For the gate's pin and for `last_green_sha` AS RECORDED AT THAT PIN (the base the gate's own
//           `verify.sh --since` used), check each probe out in a throwaway detached worktree and run it
//           (twice per sha — a disagreeing pair is flakiness, not evidence). Also reports, from the pin,
//           each reviewed work order's owned ids, and whether the base really precedes the cycle (no
//           reviewed WO is already IN_REVIEW/VERIFIED there — otherwise the differential would compare
//           the cycle with itself). The probe is preserved under .pandacorp/run/gate-evidence/<frd>/drift/
//           and NEVER copied into the main tree's collected tests.
//   record  Writes one `draft` change card per engine-confirmed drift into .pandacorp/inbox/changes/
//           (idempotent on frd::contract), indexes it in the queue README, and appends ONE
//           GateDriftRecorded event. Draft = never drained by the build: the owner decides direction.
//
// Output: exactly one JSON line on stdout, exit 0 — `{ ok: false, error }` on any refusal. Inputs reach
// git and a shell-free child process only after strict validation (fail-closed).

import { spawnSync } from 'node:child_process'
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const FRD_RE = /^frd-[A-Za-z0-9][A-Za-z0-9._-]*$/
const PROBE_RE = /^\.pandacorp\/run\/drift-probes\/[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*\.drift-probe\.tsx?$/
const WO_RE = /^docs\/frds\/[A-Za-z0-9][A-Za-z0-9._-]*\/work-orders\/wo-[A-Za-z0-9._-]+\.md$/
const SHA_RE = /^([0-9a-f]{4,40}|HEAD)$/
const ID_RE = /\b(?:REQ|AC)-\d+-\d+(?:\.\d+)?\b/g
const RUNS_PER_SHA = 2
const RUN_TIMEOUT_MS = Number(process.env.PANDACORP_DRIFT_TIMEOUT_MS || 300000)
const BOOTSTRAP_TIMEOUT_MS = 600000

const emit = (obj) => { process.stdout.write(`${JSON.stringify(obj)}\n`); process.exit(0) }
const refuse = (error) => emit({ ok: false, error })

function parseArgs(argv) {
  const [mode, ...rest] = argv
  const opts = { mode, wo: [], probe: [] }
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i]
    if (!key.startsWith('--')) refuse(`unexpected argument ${JSON.stringify(key)}`)
    const name = key.slice(2)
    const value = rest[i + 1]
    if (value === undefined) refuse(`missing value for ${key}`)
    i++
    if (name === 'wo' || name === 'probe') opts[name].push(value)
    else opts[name] = value
  }
  return opts
}

const git = (cwd, args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }
}

const frontmatter = (text) => {
  const m = String(text || '').match(/^---\n([\s\S]*?)\n---/)
  return m ? m[1] : ''
}
const fmValue = (text, key) => {
  const m = frontmatter(text).match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))
  return m ? m[1].trim() : null
}

// ── prove ─────────────────────────────────────────────────────────────────────────────────────────
function summarizeVitestJson(file, exit, error = '') {
  if (!existsSync(file)) return { parsed: false, exit, total: 0, failed: 0, passed: 0, suiteErrors: 0, error: error || 'no JSON report written' }
  let j
  try { j = JSON.parse(readFileSync(file, 'utf8')) } catch { return { parsed: false, exit, total: 0, failed: 0, passed: 0, suiteErrors: 0, error: 'JSON report unparseable' } }
  const suites = Array.isArray(j.testResults) ? j.testResults : []
  const broken = suites.filter((s) => s && s.status === 'failed' && (!Array.isArray(s.assertionResults) || s.assertionResults.length === 0))
  const all = suites.flatMap((s) => (Array.isArray(s && s.assertionResults) ? s.assertionResults : []))
  const firstFailure = all.find((a) => a && a.status === 'failed')
  const message = broken.length ? String(broken[0].message || '') : (firstFailure && Array.isArray(firstFailure.failureMessages) ? String(firstFailure.failureMessages[0] || '') : '')
  return {
    parsed: true,
    exit,
    total: all.length,
    failed: all.filter((a) => a && a.status === 'failed').length,
    passed: all.filter((a) => a && a.status === 'passed').length,
    suiteErrors: broken.length,
    ...(message ? { message: message.replace(/\u001b\[[0-9;]*m/g, '').slice(0, 300) } : {}),
  }
}

function runner() {
  const custom = process.env.PANDACORP_DRIFT_VITEST
  if (custom && custom.trim()) return custom.trim().split(/\s+/)
  return ['pnpm', 'exec', 'vitest']
}

function runProbe(projectDir, probeAbs, name, tmpRoot, tag) {
  const testName = name.replace(/\.drift-probe\.(tsx?)$/, '.test.$1')
  const rel = path.join('src', '__drift_probe__', testName)
  const dest = path.join(projectDir, rel)
  mkdirSync(path.dirname(dest), { recursive: true })
  copyFileSync(probeAbs, dest)
  const out = path.join(tmpRoot, `${tag}-${testName}.json`)
  rmSync(out, { force: true })
  const [cmd, ...pre] = runner()
  const r = spawnSync(cmd, [...pre, 'run', rel, '--reporter=json', `--outputFile=${out}`], {
    cwd: projectDir, encoding: 'utf8', timeout: RUN_TIMEOUT_MS, env: { ...process.env, CI: '1' }, maxBuffer: 64 * 1024 * 1024,
  })
  const timedOut = r.error && r.error.code === 'ETIMEDOUT'
  return summarizeVitestJson(out, r.status, timedOut ? 'timed out' : (r.error ? String(r.error.message) : ''))
}

function prove(o) {
  if (!o.project || !path.isAbsolute(o.project) && o.project !== '.') refuse('--project must be an absolute path (or .)')
  if (!FRD_RE.test(o.frd || '')) refuse('--frd is malformed')
  if (!SHA_RE.test(o.pin || 'HEAD')) refuse('--pin must be a hex sha or HEAD')
  for (const p of o.probe) if (!PROBE_RE.test(p) || !p.includes(`/drift-probes/${o.frd}/`)) refuse(`probe path ${JSON.stringify(p)} must be .pandacorp/run/drift-probes/${o.frd}/<name>.drift-probe.ts(x)`)
  for (const w of o.wo) if (!WO_RE.test(w)) refuse(`work-order path ${JSON.stringify(w)} is malformed`)
  const project = path.resolve(o.project)
  const source = path.resolve(o.source || project)
  const top = git(project, ['rev-parse', '--show-toplevel'])
  const prefixR = git(project, ['rev-parse', '--show-prefix'])
  if (!top.ok || !prefixR.ok) refuse(`not a git project: ${top.err || prefixR.err}`)
  const prefix = prefixR.out
  const pinR = git(project, ['rev-parse', '--verify', `${o.pin || 'HEAD'}^{commit}`])
  if (!pinR.ok) refuse(`pin ${o.pin} is not a commit`)
  const pin = pinR.out

  const statusAtPin = git(project, ['show', `${pin}:${prefix}.pandacorp/status.yaml`])
  const baseMatch = statusAtPin.ok ? statusAtPin.out.match(/^last_green_sha:\s*["']?([0-9a-f]{7,40})["']?\s*$/m) : null
  let base = null
  let baseValid = false
  let baseReason = ''
  if (!baseMatch) baseReason = 'no last_green_sha recorded in status.yaml at the pin'
  else {
    const b = git(project, ['rev-parse', '--verify', `${baseMatch[1]}^{commit}`])
    if (!b.ok) baseReason = `last_green_sha ${baseMatch[1]} is not a commit`
    else if (b.out === pin) { base = b.out; baseReason = 'last_green_sha equals the pin (nothing to compare)' }
    else if (!git(project, ['merge-base', '--is-ancestor', b.out, pin]).ok) { base = b.out; baseReason = 'last_green_sha is not an ancestor of the pin' }
    else {
      base = b.out
      baseValid = true
      for (const w of o.wo) {
        const atBase = git(project, ['show', `${base}:${prefix}${w}`])
        const st = atBase.ok ? fmValue(atBase.out, 'implementation_status') : null
        if (st === 'IN_REVIEW' || st === 'VERIFIED') { baseValid = false; baseReason = `${w} is already ${st} at last_green_sha — the base contains this cycle's work`; break }
      }
    }
  }

  const owned = {}
  for (const w of o.wo) {
    const atPin = git(project, ['show', `${pin}:${prefix}${w}`])
    if (!atPin.ok) { owned[w] = { error: 'work order not found at the pin' }; continue }
    const sr = fmValue(atPin.out, 'source_requirements')
    const srIds = sr ? (sr.match(ID_RE) || []) : []
    owned[w] = { sourceRequirements: srIds.length ? [...new Set(srIds)] : null, ids: [...new Set(atPin.out.match(ID_RE) || [])] }
  }

  const evidenceDir = path.join(project, '.pandacorp', 'run', 'gate-evidence', o.frd, 'drift')
  const probes = o.probe.map((p) => {
    const abs = path.join(source, p)
    const name = path.basename(p)
    if (!existsSync(abs)) return { path: p, missing: true, head: [], base: [] }
    mkdirSync(evidenceDir, { recursive: true })
    copyFileSync(abs, path.join(evidenceDir, name))
    return { path: p, stored: path.posix.join('.pandacorp/run/gate-evidence', o.frd, 'drift', name), abs, name, head: [], base: [] }
  })

  const live = probes.filter((p) => !p.missing)
  const tmpRoot = path.join(project, '.pandacorp', 'run', 'drift-proof', `${o.frd}-${process.pid}-${Date.now()}`)
  const cleanup = { ok: true, leftover: [] }
  const trees = []
  try {
    if (live.length) {
      mkdirSync(tmpRoot, { recursive: true })
      const plan = [['head', pin]]
      if (baseValid) plan.push(['base', base])
      for (const [tag, sha] of plan) {
        const wt = path.join(tmpRoot, tag)
        const add = git(project, ['worktree', 'add', '--detach', wt, sha])
        if (!add.ok) { for (const p of live) p[tag] = [{ parsed: false, exit: null, total: 0, failed: 0, passed: 0, suiteErrors: 0, error: `worktree add failed: ${add.err}` }]; continue }
        trees.push(wt)
        const projectDir = path.join(wt, prefix)
        const bootstrap = path.join(projectDir, '.pandacorp', 'worktree-bootstrap.sh')
        let envError = ''
        if (existsSync(bootstrap)) {
          const b = spawnSync('bash', [bootstrap], { cwd: projectDir, encoding: 'utf8', timeout: BOOTSTRAP_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 })
          if (b.status !== 0) envError = `worktree-bootstrap.sh failed (${b.status})`
        }
        for (const p of live) {
          for (let i = 0; i < RUNS_PER_SHA; i++) {
            p[tag].push(envError
              ? { parsed: false, exit: null, total: 0, failed: 0, passed: 0, suiteErrors: 0, error: envError }
              : runProbe(projectDir, p.abs, p.name, tmpRoot, `${tag}${i}`))
          }
        }
      }
    }
  } finally {
    for (const wt of trees) {
      const rm = git(project, ['worktree', 'remove', '--force', wt])
      if (!rm.ok) { cleanup.ok = false; cleanup.leftover.push(wt) }
    }
    if (cleanup.ok) rmSync(tmpRoot, { recursive: true, force: true })
  }
  emit({
    ok: true, version: 1, frd: o.frd, pin, base, baseValid, baseReason, owned,
    probes: probes.map(({ abs, name, ...rest }) => rest),
    cleanup,
  })
}

// ── record ────────────────────────────────────────────────────────────────────────────────────────
const slug = (id) => String(id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const yamlScalar = (s) => (/^[A-Za-z0-9._:/ -]*$/.test(s) ? s : JSON.stringify(s))

function cardText(frd, item, date) {
  const type = item.direction === 'code' ? 'bug' : 'change'
  const pin = String(item.pin || '').slice(0, 8)
  const base = String(item.base || '').slice(0, 8)
  const direction = { code: 'el código está mal', spec: 'la especificación quedó vieja', unknown: 'no se sabe' }[item.direction] || 'no se sabe'
  return `---
type: ${type}
class: standard
status: draft
date: ${date}
frd: ${frd}
rebuilds_verified: false
rigor:
rigor_reasons:
depends_on:
supersedes:
implemented_sha:
closing_at:
origin: gate-drift
drift_key: ${yamlScalar(`${frd}::${item.id}`)}
drift_contract: ${yamlScalar(item.id)}
---

# Deriva preexistente en ${frd}: ${item.id} no se cumple

## Qué encontró el gate
El gate de \`${frd}\` (pin \`${pin}\`) encontró que el contrato **${item.id}** (${item.contractClass || 'contrato'}) está contradicho por el código.
La prueba diferencial del motor demostró que la contradicción **ya existía antes de este ciclo**: el test del
reviewer falla en el pin \`${pin}\` y también en el último verde \`${base}\`. Por la política BL-0178 (a) esto no
bloquea ni reabre las work orders del ciclo: el FRD quedó VERIFIED con \`drift: [${item.id}]\` en su frontmatter y
esta card lo deja registrado para que decidas.

> ${String(item.contract || item.id).replace(/\n+/g, ' ')}

## Evidencia
- Test del reviewer (rojo en \`${pin}\` y en \`${base}\`): \`${item.probe}\`. Cópialo tal cual como test
  (renombrado a \`*.test.ts\`, p. ej. bajo \`src/**/_tests/\`) y tienes el test RED listo.
- Dirección que propuso el reviewer: ${direction}.

## Qué decidir
- Si **el código** está mal: pasa esta card a \`ready\` con \`/pandacorp:change\` y el build lo arregla con ese test.
- Si **la especificación** quedó vieja: reconcíliala con \`/pandacorp:sync\` (nunca se rebaja el spec sin decidirlo) y descarta esta card.
`
}

function record(o) {
  if (!o.project || !path.isAbsolute(o.project) && o.project !== '.') refuse('--project must be an absolute path (or .)')
  if (!FRD_RE.test(o.frd || '')) refuse('--frd is malformed')
  let items
  try { items = JSON.parse(o.items || '') } catch { refuse('--items is not valid JSON') }
  if (!Array.isArray(items) || !items.length) refuse('--items must be a non-empty array')
  for (const it of items) {
    if (!it || typeof it.id !== 'string' || !/^(?:REQ|AC)-\d+-\d+(?:\.\d+)?$/.test(it.id)) refuse(`item id ${JSON.stringify(it && it.id)} is not a REQ/AC id`)
    if (typeof it.probe !== 'string' || !it.probe.startsWith(`.pandacorp/run/gate-evidence/${o.frd}/drift/`)) refuse(`item ${it.id} carries no stored probe path`)
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(o.date || '') ? o.date : new Date().toISOString().slice(0, 10)
  const project = path.resolve(o.project)
  const dir = path.join(project, '.pandacorp', 'inbox', 'changes')
  mkdirSync(dir, { recursive: true })
  const readme = path.join(dir, 'README.md')
  const written = []
  const skipped = []
  for (const it of items) {
    const file = `${o.frd}-drift-${slug(it.id)}.md`
    const abs = path.join(dir, file)
    if (existsSync(abs)) { skipped.push(file); continue }
    writeFileSync(abs, cardText(o.frd, it, date))
    written.push(file)
    if (existsSync(readme) && !readFileSync(readme, 'utf8').includes(`\`${file}\``)) {
      appendFileSync(readme, `| \`${file}\` | ${it.direction === 'code' ? 'bug' : 'change'} | standard | draft |\n`)
    }
  }
  const events = o.events || path.join(os.homedir(), '.claude', 'dashboard-events.ndjson')
  try {
    mkdirSync(path.dirname(events), { recursive: true })
    appendFileSync(events, `${JSON.stringify({ event: 'GateDriftRecorded', at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), project: o['project-name'] || path.basename(project), frd: o.frd, drift: items.length, written: written.length, skipped: skipped.length })}\n`)
  } catch { /* the event stream is fire-and-forget telemetry; the cards above are the record */ }
  emit({ ok: true, written, skipped })
}

const opts = parseArgs(process.argv.slice(2))
if (opts.mode === 'prove') prove(opts)
else if (opts.mode === 'record') record(opts)
else refuse('usage: drift-proof.mjs prove|record --project <dir> --frd <frd> …')
