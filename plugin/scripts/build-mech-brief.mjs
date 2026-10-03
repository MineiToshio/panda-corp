// build-mech-brief.mjs — proposal 41 C5 (DR-126): the fast-lane builder's context, gathered once by a script.
//   wo-brief   --wo <id>… [--since <base>]   writes .pandacorp/run/context/brief-<first WO>.md for one builder: per
//              work order, the blueprint sections of the CMP/IF ids it cites, its mock paths, and the ## Status Note of
//              each dependency. A dependency's note is inlined ONLY when that dependency is committed (IN_REVIEW or
//              VERIFIED) in <base> (default HEAD), i.e. its commit is an ancestor of the builder's base, and it is read
//              from <base>, never from the working tree. A dependency not landed there (a sibling lane's chain, or a work
//              order this same builder has yet to build) is named with its work-order path to Read (red-team R9).
// Why: benches FM-3/5/9 spent 0.5-2.4 min per builder orienting before its first write (23.5 min in total); the engine
// is a Workflow script with no filesystem, so the context is gathered here and read in one call. The sealed line carries
// ids and paths only (no free text a relay could decode, bench F-1).

import { mkdirSync, readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { InputError, blobAt, findWo, fmGet, frontmatterStatus, projectCtx, unique } from './build-mech-lib.mjs'
import { fmList, normWoId } from './build-mech-fast.mjs'

const SEAM_ID_RE = /\b(?:CMP|IF)-\d+-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/g
const SECTION_CAP = 4000
const MOCK_CAP = 12
const LANDED = new Set(['IN_REVIEW', 'VERIFIED'])
const HEADING_RE = /^(#{1,6})\s/
const readOr = (p) => { try { return readFileSync(p, 'utf8') } catch { return null } }
const isFile = (p) => { try { return statSync(p).isFile() } catch { return false } }

/**
 * A markdown section: from the heading line containing `id` to the next heading of the same or a higher level; without
 * such a heading, the lines that name it (a table row, a bullet). Capped.
 * @param {string} text markdown
 * @param {string} id a CMP-/IF- id
 * @returns {string} the section, '' when the text never names the id
 */
export function sectionOf(text, id) {
  const lines = String(text || '').split('\n')
  const named = (l) => new RegExp(`\\b${id.replace(/[-]/g, '\\-')}(?![A-Za-z0-9-])`).test(l)
  const at = lines.findIndex((l) => HEADING_RE.test(l) && named(l))
  if (at < 0) return lines.filter(named).join('\n').slice(0, SECTION_CAP)
  const level = HEADING_RE.exec(lines[at])[1].length
  let end = at + 1
  while (end < lines.length && !(HEADING_RE.test(lines[end]) && HEADING_RE.exec(lines[end])[1].length <= level)) end++
  return lines.slice(at, end).join('\n').trim().slice(0, SECTION_CAP)
}
/** The FRD's blueprint text: blueprint.md plus every blueprints/*.md (a large blueprint is split, per the docs map). */
function blueprintText(ctx, frd) {
  const dir = path.join(ctx.project, 'docs', 'frds', frd)
  const split = path.join(dir, 'blueprints')
  const parts = [readOr(path.join(dir, 'blueprint.md')) || '']
  if (existsSync(split)) for (const f of readdirSync(split).filter((n) => n.endsWith('.md')).sort()) parts.push(readOr(path.join(split, f)) || '')
  return parts.join('\n')
}
/** A `## <title>` section's body (up to the next `## `), '' when absent. */
function h2Section(text, title) {
  const m = new RegExp(`^##\\s+${title}[^\\n]*$`, 'im').exec(String(text || ''))
  if (!m) return ''
  const rest = text.slice(m.index + m[0].length)
  const end = rest.search(/^##\s/m)
  return (end < 0 ? rest : rest.slice(0, end)).trim()
}
/** Mock files of a UI work order: the `mocks/` paths its Visual reference names, else the FRD's mocks folder (capped). */
function mocksOf(ctx, frd, text) {
  const ref = h2Section(text, 'Visual reference')
  if (!ref) return []
  const frdDir = `docs/frds/${frd}`
  const named = unique((ref.match(/[A-Za-z0-9_./-]*mocks\/[^\s`'")\]]+/g) || []).map((p) => p.replace(/[.,;:]+$/, '')).map((p) => (p.startsWith('docs/') ? p : `${frdDir}/${p.slice(p.indexOf('mocks/'))}`)))
  const found = named.filter((p) => isFile(path.join(ctx.project, p)))
  if (found.length) return found.slice(0, MOCK_CAP)
  const dir = path.join(ctx.project, frdDir, 'mocks')
  return existsSync(dir) ? readdirSync(dir).filter((n) => isFile(path.join(dir, n))).sort().slice(0, MOCK_CAP).map((n) => `${frdDir}/mocks/${n}`) : []
}
/** One dependency: its Status Note at `base` when it is landed there, else where to Read it. */
function depNote(ctx, base, id) {
  const wo = findWo(ctx, id)
  const atBase = blobAt(ctx, base, wo.rel)
  const status = frontmatterStatus(atBase)
  if (!LANDED.has(status)) return { row: { wo: wo.id, inlined: false, status }, md: `#### ${wo.id}: NOT landed in your base (${status} there). Read its ## Status Note in \`${wo.rel}\` once it is committed; never guess its interfaces.` }
  const note = h2Section(atBase, 'Status Note') || '(its Status Note is empty)'
  return { row: { wo: wo.id, inlined: true, status }, md: `#### ${wo.id} (landed in your base, ${status})\n${note}` }
}

/**
 * The wo-brief op (proposal 41 C5).
 * @param {{ project: string, wos: string[], since?: string }} o parsed CLI options
 * @returns {{ code: number, body: object }} the sealed-line body: the brief file and, per WO, ids only
 */
export function woBriefOp(o) {
  if (!o.wos.length) throw new InputError('wo-brief needs at least one --wo <id>')
  const ctx = projectCtx(o.project)
  const base = o.since || 'HEAD'
  const baseSha = ctx.g.run(['rev-parse', '--verify', '-q', `${base}^{commit}`])
  if (!baseSha.ok) throw new InputError(`--since ${base} is not a commit`)
  const md = []
  const rows = []
  for (const id of o.wos) {
    const wo = findWo(ctx, id)
    const text = readFileSync(path.join(ctx.project, wo.rel), 'utf8')
    const bp = blueprintText(ctx, wo.frd)
    const seams = unique(text.split(/^##\s+Status Note/im)[0].match(SEAM_ID_RE) || [])   // its own note's ids are hand-off, not a citation
    const sections = seams.map((s) => ({ id: s, text: sectionOf(bp, s) }))
    const mocks = mocksOf(ctx, wo.frd, text)
    const deps = unique([...fmList(text, 'dependsOn'), ...fmList(text, 'depends_on')].map(normWoId)).map((d) => depNote(ctx, baseSha.out.trim(), d))
    md.push(`## ${wo.id}${fmGet(text, 'title') ? `: ${fmGet(text, 'title')}` : ''}\nWork-order file: \`${wo.rel}\`\n### Blueprint sections it cites\n${sections.filter((s) => s.text).map((s) => s.text).join('\n\n') || '(none cited)'}${sections.some((s) => !s.text) ? `\n(not found in the blueprint: ${sections.filter((s) => !s.text).map((s) => s.id).join(', ')})` : ''}\n### Mocks\n${mocks.map((m) => `- \`${m}\``).join('\n') || '(none: not a UI work order)'}\n### Its dependencies' Status Notes\n${deps.map((d) => d.md).join('\n\n') || '(no dependencies)'}`)
    rows.push({ wo: wo.id, sections: sections.filter((s) => s.text).map((s) => s.id), missing: sections.filter((s) => !s.text).map((s) => s.id), mocks, deps: deps.map((d) => d.row) })
  }
  const rel = `.pandacorp/run/context/brief-${rows[0].wo}.md`
  mkdirSync(path.dirname(path.join(ctx.project, rel)), { recursive: true })
  writeFileSync(path.join(ctx.project, rel), `# Builder brief (base ${baseSha.out.trim().slice(0, 12)})\nGathered by wo-brief (proposal 41 C5). Read once; open a file only for what is not here.\n\n${md.join('\n\n')}\n`)
  return { code: 0, body: { status: 'written', file: rel, base: baseSha.out.trim().slice(0, 12), wos: rows } }
}

/** The brief op, keyed for pandacorp-build-mech.mjs's OPS table. */
export const BRIEF_OPS = { 'wo-brief': woBriefOp }
