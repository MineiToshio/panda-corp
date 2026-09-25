#!/usr/bin/env node
// test-gate-inventory.mjs — BL-0189: the FRD contract-inventory cache's I/O script
// (plugin/scripts/gate-inventory.mjs), exercised against a REAL temporary git repository with a NESTED
// project (like Mission Control inside the factory repo).
//
// What must hold: the fingerprint is the normative BODY at the pin (a frontmatter-only rollup/drift stamp
// never invalidates the cache, a body edit always does); `check` returns the cache VERBATIM and never
// judges it; `write` refuses — writes nothing — when the JSON arrived damaged or is not a valid inventory.
//
// Exit 0 green / 1 red. Output ends in `RESULT: N passed, M failed`.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { docBody, fnv1a } from './gate-inventory.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(HERE, 'gate-inventory.mjs')

let passed = 0
let failed = 0
const check = (cond, msg) => { if (cond) { passed++; console.log(`PASS  ${msg}`) } else { failed++; console.log(`FAIL  ${msg}`) } }
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const write = (file, text) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, text) }
const run = (...args) => JSON.parse(execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8' }).trim().split('\n').pop())

const FRD = 'frd-01-demo'
const frdDoc = (status, body) => `---\nid: FRD-01\nimplementation_status: ${status}\n---\n${body}`
const CONTRACTS = ['requirement', 'acceptance-criterion', 'invariant', 'edge-case', 'limit', 'error', 'exclusion']
  .map((c, i) => ({ contract: `${c === 'requirement' ? 'REQ-01-001' : `AC-01-001.${i}`} — ${c} contract`, contractClass: c, status: ['edge-case', 'limit'].includes(c) ? 'pass' : 'not-applicable', tests: ['edge-case', 'limit'].includes(c) ? [`src/lib/_tests/${c}.test.ts`] : [] }))

function mkRepo() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'gate-inventory-'))
  const repo = path.join(root, 'repo')
  const app = path.join(repo, 'app')   // NESTED project
  mkdirSync(app, { recursive: true })
  git(repo, 'init', '-q')
  git(repo, 'config', 'user.email', 't@example.com')
  git(repo, 'config', 'user.name', 't')
  write(path.join(app, '.gitignore'), '.pandacorp/run/\n')
  write(path.join(app, `docs/frds/${FRD}/frd.md`), frdDoc('IN_REVIEW', '# FRD-01\n\nREQ-01-001 The system SHALL demo.\n'))
  write(path.join(app, `docs/frds/${FRD}/blueprint.md`), frdDoc('IN_REVIEW', '# Blueprint\n\nCMP-01-demo.\n'))
  write(path.join(repo, 'factory/noise.md'), 'factory\n')
  git(repo, 'add', '-A'); git(repo, 'commit', '-qm', 'base')
  return { root, repo, app, base: git(repo, 'rev-parse', 'HEAD') }
}

// ── docBody: the frontmatter is excluded, the body is kept byte-for-byte (CRLF normalized) ──
check(docBody('---\na: 1\n---\n# T\nbody\n') === '# T\nbody\n', 'docBody: strips a leading frontmatter block')
check(docBody('# no frontmatter\n') === '# no frontmatter\n', 'docBody: a doc without frontmatter is its own body')
check(docBody('---\na: 1\r\n---\r\n# T\r\n') === '# T\n', 'docBody: CRLF-normalized')

// ── check: absent cache → inventory:null; fingerprints computed at the PIN from git objects ──
{
  const r = mkRepo()
  const c = run('check', '--project', r.app, '--frd', FRD, '--pin', r.base.slice(0, 9))
  check(c.ok === true && c.inventory === null, 'check: an absent cache is reported as inventory:null (the engine calls it a miss, never "empty")')
  check(c.pin === r.base && /^[0-9a-f]{64}$/.test(c.sources.frd) && /^[0-9a-f]{64}$/.test(c.sources.blueprint), 'check: resolves the full pin and fingerprints frd.md + blueprint.md at it (nested prefix)')
  check(c.inventoryPath === `.pandacorp/run/gate-evidence/${FRD}/inventory.json`, 'check: names the project-relative cache path')

  // ── write: a valid inventory, carried intact → written atomically with gatedAt + sources ──
  const json = JSON.stringify(CONTRACTS)
  const w = run('write', '--project', r.app, '--frd', FRD, '--pin', r.base, '--digest', fnv1a(json), '--contracts', json)
  const file = path.join(r.app, c.inventoryPath)
  check(w.ok === true && w.entries === CONTRACTS.length && existsSync(file), 'write: a valid inventory is written')
  const onDisk = JSON.parse(readFileSync(file, 'utf8'))
  check(onDisk.version === 1 && onDisk.frd === FRD && onDisk.gatedAt === r.base && onDisk.sources.frd === c.sources.frd, 'write: records version, frd, gatedAt = the pin, and the pin\'s fingerprints')
  check(JSON.stringify(onDisk.contracts) === json, 'write: the contracts are stored exactly as the engine sent them')
  check(git(r.repo, 'status', '--porcelain') === '', 'write: the cache is gitignored run-state — the tree stays clean')

  // ── a frontmatter-only change (the rollup writer / drift replica) keeps the fingerprint ──
  write(path.join(r.app, `docs/frds/${FRD}/frd.md`), frdDoc('VERIFIED', '# FRD-01\n\nREQ-01-001 The system SHALL demo.\n').replace('---\n#', 'drift: [AC-01-001.1]\n---\n#'))
  git(r.repo, 'add', '-A'); git(r.repo, 'commit', '-qm', 'rollup stamp')
  const c2 = run('check', '--project', r.app, '--frd', FRD, '--pin', 'HEAD')
  check(c2.sources.frd === onDisk.sources.frd && c2.sources.blueprint === onDisk.sources.blueprint, 'check: a frontmatter-only edit (rollup status, drift list) does NOT change the fingerprint')
  check(typeof c2.inventory === 'string' && c2.inventory === readFileSync(file, 'utf8'), 'check: the cache is returned VERBATIM (the engine parses it, fail-loud)')

  // ── a body edit (a normative change drained at a safe point) changes it ──
  write(path.join(r.app, `docs/frds/${FRD}/frd.md`), frdDoc('VERIFIED', '# FRD-01\n\nREQ-01-001 The system SHALL demo twice.\n'))
  git(r.repo, 'add', '-A'); git(r.repo, 'commit', '-qm', 'spec change')
  const c3 = run('check', '--project', r.app, '--frd', FRD, '--pin', 'HEAD')
  check(c3.sources.frd !== onDisk.sources.frd && c3.sources.blueprint === onDisk.sources.blueprint, 'check: a BODY edit of frd.md changes its fingerprint (the engine then misses)')
  const c4 = run('check', '--project', r.app, '--frd', FRD, '--pin', r.base)
  check(c4.sources.frd === onDisk.sources.frd, 'check: fingerprints are read at the PIN, never from the working tree (an older pin still matches)')

  // ── write refuses, and writes nothing, on a damaged or invalid payload ──
  const before = readFileSync(file, 'utf8')
  const bad1 = run('write', '--project', r.app, '--frd', FRD, '--pin', 'HEAD', '--digest', fnv1a(json), '--contracts', json.replace('requirement contract', 'requirement contrakt'))
  check(bad1.ok === false && /did not arrive intact/.test(bad1.error), 'write: a contracts string that does not match its digest (a copy error) is refused')
  const six = JSON.stringify(CONTRACTS.filter((e) => e.contractClass !== 'exclusion').concat([{ ...CONTRACTS[0], contract: 'REQ-01-009 — x' }]))
  const bad2 = run('write', '--project', r.app, '--frd', FRD, '--pin', 'HEAD', '--digest', fnv1a(six), '--contracts', six)
  check(bad2.ok === false && /missing contractClass: exclusion/.test(bad2.error), 'write: an inventory missing one of the 7 classes is refused')
  const withFail = JSON.stringify(CONTRACTS.map((e, i) => (i === 0 ? { ...e, status: 'fail' } : e)))
  const bad3 = run('write', '--project', r.app, '--frd', FRD, '--pin', 'HEAD', '--digest', fnv1a(withFail), '--contracts', withFail)
  check(bad3.ok === false && /status "fail"/.test(bad3.error), 'write: an open `fail` entry can never be cached (only a green verdict is)')
  const notJson = '{not json'
  const bad4 = run('write', '--project', r.app, '--frd', FRD, '--pin', 'HEAD', '--digest', fnv1a(notJson), '--contracts', notJson)
  check(bad4.ok === false && /not valid JSON/.test(bad4.error), 'write: unparseable JSON is refused')
  check(readFileSync(file, 'utf8') === before, 'write: every refusal left the previous cache untouched')

  // ── input validation (the values reach git and the filesystem) ──
  check(run('check', '--project', r.app, '--frd', 'frd-01;rm', '--pin', 'HEAD').ok === false, 'check: a malformed frd is refused')
  check(run('check', '--project', r.app, '--frd', FRD, '--pin', 'HEAD~1;x').ok === false, 'check: a malformed pin is refused')
  check(run('check', '--project', 'relative/dir', '--frd', FRD, '--pin', 'HEAD').ok === false, 'check: a relative project path is refused')
  check(run('check', '--project', r.app, '--frd', 'frd-99-missing', '--pin', 'HEAD').ok === false, 'check: an FRD without frd.md at the pin is refused, never fingerprinted as empty')
  rmSync(r.root, { recursive: true, force: true })
}

// ── a FRD with no blueprint fingerprints it as null (and still caches) ──
{
  const r = mkRepo()
  git(r.repo, 'rm', '-q', `app/docs/frds/${FRD}/blueprint.md`); git(r.repo, 'commit', '-qm', 'no blueprint')
  const c = run('check', '--project', r.app, '--frd', FRD, '--pin', 'HEAD')
  check(c.ok === true && c.sources.blueprint === null && /^[0-9a-f]{64}$/.test(c.sources.frd), 'check: a missing blueprint.md is fingerprinted null, not an error')
  rmSync(r.root, { recursive: true, force: true })
}

console.log(`RESULT: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
