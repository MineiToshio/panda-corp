#!/usr/bin/env node
// greenfield-probe.mjs — the deterministic facts behind the build engine's greenfield baseline decision.
//
// Why it exists. A freshly architected project has never been green: `last_green_sha` is empty and every work
// order is still PLANNED/DRAFT, while verify.sh is red BY CONSTRUCTION (knip flags the dependencies the work
// orders will import, vitest finds no test files yet). The engine's judge baseline correctly refuses to "fix"
// such a tree, so the build stopped `baseline red (needs manual fix)` before building anything (bench-medium
// C-1). The engine treats the baseline as not applicable on a greenfield project — but it must decide that from
// the files, never from a model's prose, and a Workflow script has no filesystem. This script reads the facts;
// a MECH agent relays its ONE sealed line (drift-seal.mjs) and the engine verifies the seal and decides.
//
// Facts:
//   lastGreenSha  the top-level `last_green_sha:` of .pandacorp/status.yaml, unquoted ('' when empty/null/~)
//   workOrders    how many docs/frds/*/work-orders/wo-*.md files exist
//   byStatus      their frontmatter `implementation_status:` values, counted
//   missing       how many of them have no frontmatter `implementation_status:` at all
//   adopted       status.yaml says `created_via: adopt` (plugin/skills/adopt/SKILL.md writes it as immutable provenance):
//                 an adopted brownfield project also has an empty last_green_sha and PLANNED work orders, but its
//                 code exists and its verify.sh is NOT red by construction
//   everBuilt     some work order's frontmatter read IN_REVIEW or VERIFIED in ANY commit of the project's git history
//                 (a resume demotion puts it back to PLANNED, the code it committed stays); null when the history
//                 cannot be read
//
// The verdict (DR-115: the ONE greenfield definition — the classic baseline and the fast lane's precheck both call
// decideGreenfield, nothing else re-derives it):
//   greenfield, reason   decideGreenfield(facts) — the classic lane's verdict, sealed with the facts. The fast lane
//                        calls decideGreenfield(facts, { allowDispatched: true }) from its precheck.
//
// Usage: greenfield-probe.mjs --project <dir>
// Output: ONE sealed JSON line. Exit 0 with ok:true, or exit 2 with ok:false + error (no status.yaml, unreadable).

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sealLine } from './drift-seal.mjs'

const EMPTY_SCALAR_RE = /^(?:|""|''|~|null)$/i

/**
 * The unquoted value of a top-level `key:` line of a flat YAML document, '' when absent or empty.
 * @param {string} text the YAML text
 * @param {string} key the top-level key
 * @returns {string}
 */
export function topLevelScalar(text, key) {
  const m = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(text)
  if (!m) return ''
  const raw = m[1].replace(/\s+#.*$/, '').trim()
  if (EMPTY_SCALAR_RE.test(raw)) return ''
  return raw.replace(/^(["'])(.*)\1$/, '$2').trim()
}

/**
 * The `implementation_status` of a work order's frontmatter (the first `---` block only), or null.
 * @param {string} text the work-order markdown
 * @returns {string | null}
 */
export function frontmatterStatus(text) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)
  if (!fm) return null
  const value = topLevelScalar(fm[1], 'implementation_status')
  return value ? value.toUpperCase() : null
}

const BUILT_STATES = new Set(['IN_REVIEW', 'VERIFIED'])
const BUILT_LINE_RE = '^implementation_status:[[:space:]]*["\']?(IN_REVIEW|VERIFIED)'
const WO_PATH_RE = /(^|\/)docs\/frds\/[^/]+\/work-orders\/wo-[^/]*\.md$/

/**
 * Was any work order of the project EVER built (frontmatter IN_REVIEW or VERIFIED in some commit)? The pickaxe
 * (-G) only narrows the commits to read; each candidate file is then judged by its frontmatter, never by a body line.
 * @param {string} projectDir the project root (possibly nested inside its repository)
 * @returns {boolean | null} null when the git history cannot be read
 */
export function everBuiltInHistory(projectDir) {
  const git = (args) => spawnSync('git', ['-C', projectDir, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const top = git(['rev-parse', '--show-prefix'])
  if (top.status !== 0) return null
  if (git(['rev-parse', '--verify', '-q', 'HEAD']).status !== 0) return false   // no commit yet: nothing was ever built
  const log = git(['log', '--format=%H', '-i', '--extended-regexp', '-G', BUILT_LINE_RE, '--', 'docs/frds'])
  if (log.status !== 0) return null
  for (const sha of log.stdout.split('\n').filter(Boolean)) {
    const tree = git(['diff-tree', '--no-commit-id', '-r', '--root', '--name-only', '--relative', sha, '--', 'docs/frds'])
    if (tree.status !== 0) return null
    for (const rel of tree.stdout.split('\n').filter((p) => WO_PATH_RE.test(p))) {
      const blob = git(['show', `${sha}:./${rel}`])
      if (blob.status === 0 && BUILT_STATES.has(frontmatterStatus(blob.stdout))) return true
    }
  }
  return false
}

/**
 * Collects the greenfield facts of a project.
 * @param {string} projectDir the project root
 * @returns {{ok: true, probe: 'greenfield', lastGreenSha: string, workOrders: number, byStatus: Record<string, number>, missing: number, adopted: boolean, everBuilt: boolean | null} | {ok: false, probe: 'greenfield', error: string}}
 */
export function probe(projectDir) {
  const statusPath = path.join(projectDir, '.pandacorp', 'status.yaml')
  if (!existsSync(statusPath)) return { ok: false, probe: 'greenfield', error: `${statusPath} not found` }
  const statusText = readFileSync(statusPath, 'utf8')
  const lastGreenSha = topLevelScalar(statusText, 'last_green_sha')
  const adopted = /^adopt/i.test(topLevelScalar(statusText, 'created_via'))
  const frdsDir = path.join(projectDir, 'docs', 'frds')
  const byStatus = {}
  let workOrders = 0
  let missing = 0
  const frds = existsSync(frdsDir) ? readdirSync(frdsDir).sort() : []
  for (const frd of frds) {
    const woDir = path.join(frdsDir, frd, 'work-orders')
    if (!existsSync(woDir) || !statSync(woDir).isDirectory()) continue
    for (const file of readdirSync(woDir).sort()) {
      if (!/^wo-.*\.md$/.test(file)) continue
      workOrders++
      const status = frontmatterStatus(readFileSync(path.join(woDir, file), 'utf8'))
      if (status) byStatus[status] = (byStatus[status] || 0) + 1
      else missing++
    }
  }
  return { ok: true, probe: 'greenfield', lastGreenSha, workOrders, byStatus, missing, adopted, everBuilt: everBuiltInHistory(projectDir) }
}

const NOT_BUILT = new Set(['PLANNED', 'DRAFT'])
/**
 * THE greenfield definition: a freshly architected project whose verify.sh is red BY CONSTRUCTION (knip flags the
 * dependencies the work orders will import, vitest finds no tests yet). Every fact must be present and say so: no
 * published last_green_sha, not adopted, no work order ever built in git history, at least one work order, each with
 * an implementation_status, all PLANNED or DRAFT. `allowDispatched` (the fast lane only) also accepts IN_PROGRESS — a
 * committed dispatch stamp of a run paused before its first commit-wo, after its precheck restored every uncommitted
 * stamp and found no owner edit; the classic lane keeps IN_PROGRESS for its judge baseline (a builder may have left
 * work in the tree).
 * @param {object} facts a probe() result (or the parsed sealed line)
 * @param {{ allowDispatched?: boolean }} [opts]
 * @returns {{ greenfield: boolean, reason: string }}
 */
export function decideGreenfield(facts, { allowDispatched = false } = {}) {
  const no = (reason) => ({ greenfield: false, reason })
  if (!facts || facts.ok !== true || facts.probe !== 'greenfield') return no('no readable greenfield facts')
  if (facts.lastGreenSha !== '') return no(`last_green_sha is ${JSON.stringify(String(facts.lastGreenSha).slice(0, 40))}: a published (or unreadable) pin is never greenfield`)
  if (facts.adopted !== false) return no(facts.adopted === true ? 'an adopted project (created_via: adopt): its code exists, its verify.sh is not red by construction' : 'the adoption marker was not read')
  if (facts.everBuilt !== false) return no(facts.everBuilt === true ? 'a work order was IN_REVIEW or VERIFIED in the git history: something was built' : 'the git history could not be read')
  if (!Number.isInteger(facts.workOrders) || facts.workOrders < 1) return no('no work order to build')
  if (facts.missing !== 0) return no(`${facts.missing} work order(s) without implementation_status`)
  const byStatus = facts.byStatus && typeof facts.byStatus === 'object' ? facts.byStatus : null
  if (!byStatus) return no('no work-order status counts')
  const allowed = allowDispatched ? new Set([...NOT_BUILT, 'IN_PROGRESS']) : NOT_BUILT
  const statuses = Object.keys(byStatus)
  const counted = statuses.reduce((n, k) => n + (Number.isInteger(byStatus[k]) ? byStatus[k] : Number.NaN), 0)
  if (counted !== facts.workOrders) return no('the work-order status counts do not add up')
  const built = statuses.filter((k) => !allowed.has(k))
  if (built.length) return no(`work order(s) ${built.map((k) => `${byStatus[k]} ${k}`).join(', ')}: not every one is ${allowDispatched ? 'PLANNED/DRAFT or only dispatched' : 'PLANNED/DRAFT'}`)
  return { greenfield: true, reason: `no published last_green_sha, not adopted, nothing ever built and none of the ${facts.workOrders} work order(s) built yet (${allowDispatched ? 'PLANNED/DRAFT, or only dispatched' : 'PLANNED/DRAFT'}): verify.sh is red by construction until they are` }
}

function main(argv) {
  const i = argv.indexOf('--project')
  const projectDir = i >= 0 ? argv[i + 1] : ''
  if (!projectDir) {
    process.stdout.write(`${sealLine({ ok: false, probe: 'greenfield', error: 'usage: greenfield-probe.mjs --project <dir>' })}\n`)
    return 2
  }
  let result
  try {
    result = probe(path.resolve(projectDir))
  } catch (e) {
    result = { ok: false, probe: 'greenfield', error: String((e && e.message) || e) }
  }
  process.stdout.write(`${sealLine(result.ok ? { ...result, ...decideGreenfield(result) } : result)}\n`)
  return result.ok ? 0 : 2
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2))
