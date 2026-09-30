#!/usr/bin/env node
// finder-snippets.mjs — BL-0214: a deterministic check of the drift finder's `implemented` citations.
//
// The whole-FRD drift finder (BL-0203) answers "implemented" with `evidence: { file, line, snippet }`, and the
// digested judge is told not to look at those rows again. BL-0205 checks the HEAD the finder SAYS it saw; nothing
// checked the row itself — a finder that named the pin and then read the main checkout still produced a false
// `implemented` (canary F2: 2 false negatives, among them a snippet that only exists on main). This script
// contrasts every cited snippet with `git show <pin>:./<file>` — the committed tree at the gate pin, never a
// working tree — and reports, per row, whether the snippet is there:
//
//   ok           the snippet is at the pin, within ±WINDOW lines of the cited line
//   moved        the snippet is in the file at the pin, but not near the cited line (a stale line number only)
//   missing      the file exists at the pin and does NOT contain the snippet
//   no-file      the cited file is not in the pin's tree (or is not a project-relative path)
//   unverifiable the snippet is empty or too short to prove anything
//
// The ENGINE decides what to do with each status (downgrade to `unknown`, discard a report with 2+ misses); this
// script only reports facts.
//
//   check  --project <abs dir> --pin <sha> --digest <fnv1a> --rows '<json>'
//       rows = [{ i, file, line, snippet }]; the digest (FNV-1a of the exact rows string, as gate-inventory.mjs
//       `write`) proves the rows arrived through the MECH relay intact — a damaged copy is refused, never checked.
//       Prints ONE sealed line (drift-seal.mjs): `{ok:true,version:2,pin,results:[{i,status}],sum}`. The check is
//       read-only and idempotent, so the engine simply runs it again when a relay altered either direction.
//
// A refusal is ONE unsealed `{ok:false,error}` line, exit 0.

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sealLine } from './drift-seal.mjs'

const SHA_RE = /^[0-9a-f]{7,40}$/
export const SNIPPET_WINDOW = 10        // lines either side of the cited line that still count as "at the cited place"
export const SNIPPET_MIN_CHARS = 6      // after whitespace collapsing: `{` or `)` proves nothing
export const MAX_ROWS = 300

const out = (o) => { process.stdout.write(`${JSON.stringify(o)}\n`); process.exit(0) }
const refuse = (error) => out({ ok: false, error })

/** FNV-1a 32-bit over UTF-16 code units — byte-identical to the engine's inventoryDigest() and gate-inventory.mjs. */
export function fnv1a(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0')
}

const squash = (s) => String(s).replace(/\s+/g, ' ').trim()

/**
 * A finder's cited path as a project-relative path, or null when it cannot name a file of the pinned tree.
 * @param {unknown} file
 * @returns {string | null}
 */
export function projectRelative(file) {
  const p = String(file || '').trim().replace(/:\d+(?:-\d+)?$/, '').replace(/^\.\//, '')
  if (!p || path.isAbsolute(p) || p.includes('\0') || p.split('/').includes('..')) return null
  return p
}

/**
 * Where (if anywhere) a cited snippet sits in a file's text.
 * @param {string | null} content the file at the pin, null when it is not in the tree
 * @param {{ file: unknown, line: unknown, snippet: unknown }} row
 * @returns {'ok' | 'moved' | 'missing' | 'no-file' | 'unverifiable'}
 */
export function classifyRow(content, row) {
  const snippet = squash(row.snippet || '')
  if (snippet.length < SNIPPET_MIN_CHARS) return 'unverifiable'
  if (content === null) return 'no-file'
  const lines = content.split('\n')
  const line = Number(row.line)
  if (Number.isInteger(line) && line >= 1) {
    const span = String(row.snippet).split('\n').length
    if (squash(lines.slice(Math.max(0, line - 1 - SNIPPET_WINDOW), line - 1 + SNIPPET_WINDOW + span).join('\n')).includes(snippet)) return 'ok'
  }
  return squash(content).includes(snippet) ? 'moved' : 'missing'
}

function parseArgs(argv) {
  const o = { cmd: argv[0] }
  for (let i = 1; i < argv.length; i += 2) {
    const k = argv[i]
    if (!k || !k.startsWith('--') || i + 1 >= argv.length) refuse(`malformed argument near ${JSON.stringify(k)}`)
    o[k.slice(2)] = argv[i + 1]
  }
  return o
}

const git = (cwd, args) => {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }) } catch { return null }
}

function check(o) {
  if (!SHA_RE.test(o.pin || '')) refuse('--pin must be a hex commit sha')
  if (!/^[0-9a-f]{8}$/.test(o.digest || '') || typeof o.rows !== 'string') refuse('check needs --rows <json> and --digest <8 hex>')
  if (fnv1a(o.rows) !== o.digest) refuse(`the rows did not arrive intact (digest ${fnv1a(o.rows)} is not ${o.digest}): nothing was checked`)
  let rows
  try { rows = JSON.parse(o.rows) } catch { refuse('--rows is not valid JSON') }
  if (!Array.isArray(rows) || !rows.length || rows.length > MAX_ROWS) refuse(`--rows must be a non-empty array of at most ${MAX_ROWS} rows`)
  if (rows.some((r) => !r || !Number.isInteger(r.i))) refuse('every row needs an integer `i`')
  const project = path.resolve(o.project)
  if (git(project, ['rev-parse', '--verify', `${o.pin}^{commit}`]) === null) refuse(`pin ${o.pin} is not a commit of this project`)
  const cache = new Map()
  const at = (file) => {
    if (!cache.has(file)) cache.set(file, git(project, ['show', `${o.pin}:./${file}`]))
    return cache.get(file)
  }
  const results = rows.map((r) => {
    const file = projectRelative(r.file)
    return { i: r.i, status: file === null ? (squash(r.snippet || '').length < SNIPPET_MIN_CHARS ? 'unverifiable' : 'no-file') : classifyRow(at(file), r) }
  })
  process.stdout.write(`${sealLine({ ok: true, version: 2, pin: o.pin, results })}\n`)
  process.exit(0)
}

function main() {
  const o = parseArgs(process.argv.slice(2))
  if (o.cmd !== 'check') refuse('usage: finder-snippets.mjs check --project <abs dir> --pin <sha> --digest <fnv1a> --rows <json>')
  if (!o.project || !path.isAbsolute(o.project)) refuse('--project must be an absolute path')
  check(o)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
