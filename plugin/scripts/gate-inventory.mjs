#!/usr/bin/env node
// gate-inventory.mjs — BL-0189: the FRD contract-inventory cache ("FRD baseline gated at SHA").
//
// The per-FRD gate's whole-FRD oracle (WHOLE_FRD_ORACLE) re-inventories EVERY normative contract of the
// FRD on every gate, even when the FRD has not changed since its last green gate — the second touch of an
// FRD (the owner's daily /change pattern) pays for the whole inventory again. This script is the cache's
// single MECH-run I/O surface; the build engine never touches a file itself (it has no fs):
//
//   check --project <dir> --frd <frd> --pin <sha|HEAD>
//       Reads .pandacorp/run/gate-evidence/<frd>/inventory.json VERBATIM (or null when absent) and the
//       CURRENT normative fingerprints of docs/frds/<frd>/frd.md and blueprint.md AT <pin> (git objects,
//       never the working tree). It decides nothing: the ENGINE parses the inventory fail-loud (DR-078)
//       and compares the fingerprints itself.
//   write --project <dir> --frd <frd> --pin <sha|HEAD> --digest <fnv1a> --contracts '<json>'
//       Called ONLY by the certifying landing (applyGate) after a GREEN gate. Verifies the JSON arrived
//       intact (the engine's FNV-1a digest of the exact string), re-validates it, fingerprints the FRD at
//       <pin> and writes the cache atomically (tmp + rename). Refuses — never writes — anything malformed.
//
// Fingerprint = sha256 of the file's BODY (everything after the YAML frontmatter, CRLF-normalized). The
// frontmatter is excluded on purpose: the governed rollup writer (sync-rollups) and the drift replica
// rewrite `implementation_status:` / `drift:` there on EVERY landing, which carries no normative content —
// fingerprinting it would make the cache miss after every single gate.
//
// DR-115 honest cache: ONE writer (the certifying landing), re-derived from the adjudicated verdict of every
// green gate, never read by a display surface, fingerprinted against its atomic source (the FRD docs).
//
// Output: ONE JSON line on stdout, exit 0 — `{ok:true,…}` or `{ok:false,error}` (fail-closed).

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const FRD_RE = /^frd-[A-Za-z0-9][A-Za-z0-9._-]*$/
const SHA_RE = /^([0-9a-f]{7,40}|HEAD)$/
export const INVENTORY_VERSION = 1
export const CONTRACT_CLASSES = ['requirement', 'acceptance-criterion', 'invariant', 'edge-case', 'limit', 'error', 'exclusion']
// A cache entry's status: a green verdict carries no open `fail` (enforceWholeFrdTraceability refuses it),
// so only these survive; `drift` is ENGINE-PROVEN pre-existing drift (BL-0178), recorded as such.
export const CACHE_STATUSES = ['pass', 'not-applicable', 'drift']

const out = (o) => { process.stdout.write(`${JSON.stringify(o)}\n`); process.exit(0) }
const refuse = (error) => out({ ok: false, error })

/** FNV-1a 32-bit over UTF-16 code units — byte-identical to the engine's inventoryDigest(). */
export function fnv1a(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0')
}

/** The normative body of a markdown doc: everything after a leading YAML frontmatter block. */
export function docBody(text) {
  const t = String(text).replace(/\r\n/g, '\n')
  if (!t.startsWith('---\n')) return t
  const end = t.indexOf('\n---', 3)
  if (end < 0) return t
  const after = t.indexOf('\n', end + 1)
  return after < 0 ? '' : t.slice(after + 1)
}

/**
 * Validates a contract list (the cache's payload). Returns '' when valid, else the first defect.
 * Mirrors the engine's own read-side validation — a cache is never written that the engine would refuse.
 */
export function contractsError(contracts) {
  if (!Array.isArray(contracts) || contracts.length < CONTRACT_CLASSES.length) return `contracts must be an array of at least ${CONTRACT_CLASSES.length} entries`
  for (const [i, e] of contracts.entries()) {
    if (!e || typeof e !== 'object') return `entry ${i} is not an object`
    if (typeof e.contract !== 'string' || !e.contract.trim()) return `entry ${i} has no contract text`
    if (!CONTRACT_CLASSES.includes(e.contractClass)) return `entry ${i} has an unknown contractClass ${JSON.stringify(e.contractClass)}`
    if (!CACHE_STATUSES.includes(e.status)) return `entry ${i} has status ${JSON.stringify(e.status)} (a cache only holds ${CACHE_STATUSES.join('/')})`
    if (!Array.isArray(e.tests) || e.tests.some((x) => typeof x !== 'string')) return `entry ${i} has no tests array`
    if (['edge-case', 'limit'].includes(e.contractClass) && e.status === 'pass' && e.tests.length === 0) return `entry ${i} is a passing ${e.contractClass} with no boundary test`
  }
  const missing = CONTRACT_CLASSES.filter((c) => !contracts.some((e) => e.contractClass === c))
  return missing.length ? `missing contractClass: ${missing.join(', ')}` : ''
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

function git(cwd, args) {
  try { return { ok: true, out: execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }) } }
  catch (e) { return { ok: false, err: String((e && e.stderr) || (e && e.message) || e).trim() } }
}

// sha256 of each FRD doc's body at <pin>; blueprint is null when the FRD has none at that commit.
function fingerprints(project, prefix, pin, frd) {
  const at = (doc) => git(project, ['show', `${pin}:${prefix}docs/frds/${frd}/${doc}`])
  const f = at('frd.md')
  if (!f.ok) return { error: `docs/frds/${frd}/frd.md is not in the tree at ${pin}` }
  const b = at('blueprint.md')
  const h = (t) => createHash('sha256').update(docBody(t)).digest('hex')
  return { frd: h(f.out), blueprint: b.ok ? h(b.out) : null }
}

function main() {
  const o = parseArgs(process.argv.slice(2))
  if (o.cmd !== 'check' && o.cmd !== 'write') refuse('usage: gate-inventory.mjs check|write --project <dir> --frd <frd> --pin <sha|HEAD> [...]')
  if (!o.project || (!path.isAbsolute(o.project) && o.project !== '.')) refuse('--project must be an absolute path (or .)')
  if (!FRD_RE.test(o.frd || '')) refuse('--frd is malformed')
  if (!SHA_RE.test(o.pin || '')) refuse('--pin must be a hex sha or HEAD')
  const project = path.resolve(o.project)
  const prefixR = git(project, ['rev-parse', '--show-prefix'])
  if (!prefixR.ok) refuse(`not a git project: ${prefixR.err}`)
  const prefix = prefixR.out.trim()
  const pinR = git(project, ['rev-parse', '--verify', `${o.pin}^{commit}`])
  if (!pinR.ok) refuse(`pin ${o.pin} is not a commit`)
  const pin = pinR.out.trim()
  const sources = fingerprints(project, prefix, pin, o.frd)
  if (sources.error) refuse(sources.error)
  const rel = path.posix.join('.pandacorp/run/gate-evidence', o.frd, 'inventory.json')
  const file = path.join(project, rel)

  if (o.cmd === 'check') {
    // VERBATIM — the engine parses it (fail-loud on a malformed file, DR-078); null only when absent.
    out({ ok: true, frd: o.frd, pin, sources, inventoryPath: rel, inventory: existsSync(file) ? readFileSync(file, 'utf8') : null })
  }

  if (typeof o.contracts !== 'string' || !/^[0-9a-f]{8}$/.test(o.digest || '')) refuse('write needs --contracts <json> and --digest <8 hex>')
  if (fnv1a(o.contracts) !== o.digest) refuse(`the contracts JSON did not arrive intact (digest ${fnv1a(o.contracts)} ≠ ${o.digest}) — nothing written`)
  let contracts
  try { contracts = JSON.parse(o.contracts) } catch { refuse('--contracts is not valid JSON — nothing written') }
  const err = contractsError(contracts)
  if (err) refuse(`refusing to cache a malformed inventory: ${err}`)
  const inventory = { version: INVENTORY_VERSION, frd: o.frd, gatedAt: pin, sources, writtenAt: new Date().toISOString(), contracts }
  mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(inventory, null, 2)}\n`)
  renameSync(tmp, file)
  out({ ok: true, path: rel, entries: contracts.length, gatedAt: pin, sources })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
