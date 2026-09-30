#!/usr/bin/env node
// seal-report.mjs — BL-0214: the integrity seal on the digested evidence collector's machine output.
//
// The gate's evidence collector (`evidence:<frd>`, BL-0187) runs `verify.sh --since … --report-all` and hands
// `gate-report.json` to the build engine through a model. A model is not a lossless copy channel (BL-0206): a copy
// that lost a `failures[]` row, or flipped a sub-gate's `exit`, is still valid JSON with a boolean `green`, and the
// opus judge would read it as authoritative. This script seals the report exactly as drift-proof.mjs seals its
// line (drift-seal.mjs: ASCII body, `"sum"` last, `version: 2`), keeps the sealed line on disk, and the engine
// recomputes the seal over the text it received:
//
//   seal   --file <gate-report.json> --frd <frd> --pin <sha> [--out <sealed.json>]
//       Prints ONE sealed line `{ok:true,version:2,kind:"gate-report",frd,pin,report:<the parsed report>,sum}` (the FRD
//       and the pin ride inside the seal, so a stored copy of ANOTHER gate's report can never be mistaken for this one);
//       with --out it also stores that exact line (the engine's recovery channel when the first relay fails its seal).
//   reread --file <sealed.json>
//       Re-prints the stored line after verifying it (instant: nothing is re-run).
//
// A refusal is ONE unsealed `{ok:false,error}` line, exit 0 (the engine treats an unreadable report as "no
// evidence": the gate runs in explore mode, loudly — never a silent pass).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sealLine, verifySealedLine } from './drift-seal.mjs'

export const REPORT_KIND = 'gate-report'

const out = (o) => { process.stdout.write(`${JSON.stringify(o)}\n`); process.exit(0) }
const refuse = (error) => out({ ok: false, error })

const ID_RE = /^[A-Za-z0-9._-]{1,64}$/

/**
 * The sealed line for a gate-report text.
 * @param {string} text the contents of gate-report.json
 * @param {{ frd: string, pin: string }} identity the gate this report was produced for
 * @returns {string} one sealed line
 * @throws {Error} when the text is not a JSON object, or the identity is malformed
 */
export function sealGateReport(text, { frd, pin }) {
  if (!ID_RE.test(String(frd)) || !ID_RE.test(String(pin))) throw new Error('--frd and --pin must be plain identifiers')
  let report
  try { report = JSON.parse(text) } catch { throw new Error('gate-report.json is not valid JSON') }
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('gate-report.json is not a JSON object')
  return sealLine({ ok: true, version: 2, kind: REPORT_KIND, frd, pin, report })
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

function main() {
  const o = parseArgs(process.argv.slice(2))
  if ((o.cmd !== 'seal' && o.cmd !== 'reread') || !o.file) refuse('usage: seal-report.mjs seal --file <gate-report.json> --frd <frd> --pin <sha> [--out <sealed.json>] | reread --file <sealed.json>')
  if (!existsSync(o.file)) refuse(`no file at ${o.file}`)
  if (o.cmd === 'reread') {
    const line = readFileSync(o.file, 'utf8').trim().split('\n').pop()
    const v = verifySealedLine(line)
    if (!v.ok) refuse(`the stored sealed report is corrupt: ${v.reason}`)
    process.stdout.write(`${line}\n`)
    process.exit(0)
  }
  let line
  try { line = sealGateReport(readFileSync(o.file, 'utf8'), { frd: o.frd, pin: o.pin }) } catch (e) { refuse(e.message) }
  if (o.out) {
    mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true })
    const tmp = `${o.out}.tmp-${process.pid}`
    writeFileSync(tmp, `${line}\n`)
    renameSync(tmp, o.out)
  }
  process.stdout.write(`${line}\n`)
  process.exit(0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
