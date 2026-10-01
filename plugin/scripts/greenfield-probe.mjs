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
// Facts (it decides nothing):
//   lastGreenSha  the top-level `last_green_sha:` of .pandacorp/status.yaml, unquoted ('' when empty/null/~)
//   workOrders    how many docs/frds/*/work-orders/wo-*.md files exist
//   byStatus      their frontmatter `implementation_status:` values, counted
//   missing       how many of them have no frontmatter `implementation_status:` at all
//
// Usage: greenfield-probe.mjs --project <dir>
// Output: ONE sealed JSON line. Exit 0 with ok:true, or exit 2 with ok:false + error (no status.yaml, unreadable).

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

/**
 * Collects the greenfield facts of a project.
 * @param {string} projectDir the project root
 * @returns {{ok: true, probe: 'greenfield', lastGreenSha: string, workOrders: number, byStatus: Record<string, number>, missing: number} | {ok: false, probe: 'greenfield', error: string}}
 */
export function probe(projectDir) {
  const statusPath = path.join(projectDir, '.pandacorp', 'status.yaml')
  if (!existsSync(statusPath)) return { ok: false, probe: 'greenfield', error: `${statusPath} not found` }
  const lastGreenSha = topLevelScalar(readFileSync(statusPath, 'utf8'), 'last_green_sha')
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
  return { ok: true, probe: 'greenfield', lastGreenSha, workOrders, byStatus, missing }
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
  process.stdout.write(`${sealLine(result)}\n`)
  return result.ok ? 0 : 2
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2))
