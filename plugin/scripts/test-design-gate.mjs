#!/usr/bin/env node
// test-design-gate.mjs — the design phase's two quality tools, run as real processes against static fixtures:
//  1. check-design-gate.mjs (Step 9 gate): a READY project (fixtures/design-gate/ready) plus one overlay per failure case
//     (fixtures/design-gate/cases/<name>/, files copied over the ready tree; `_delete` lists paths to remove). Every
//     fixture config except the deliberately invalid ones validates against the toolkit schema (one config shape).
//  2. preflight-round.mjs (run after every design review round): static fixtures for the CSS checks, and a real
//     Chromium for the DOM checks. The browser part is skipped with a message when no Chromium is available
//     (set PLAYWRIGHT_MODULE and CHROME_PATH, the same variables the design scripts read).
// Run: node plugin/scripts/test-design-gate.mjs

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.join(__dirname, 'fixtures/design-gate')
const GATE = path.resolve(__dirname, '../skills/design/scripts/check-design-gate.mjs')
const PREFLIGHT = path.resolve(__dirname, '../skills/design/scripts/preflight-round.mjs')

let pass = 0
let fail = 0
const ok = (cond, msg) => { if (cond) { pass++; console.log(`  ✓ ${msg}`) } else { fail++; console.log(`  ✗ ${msg}`) } }
const tmpDirs = []

function mkProject(caseName) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'design-gate-'))
  tmpDirs.push(dir)
  cpSync(path.join(FIXTURES, 'ready'), dir, { recursive: true })
  const overlay = path.join(FIXTURES, 'cases', caseName || '')
  if (caseName && existsSync(overlay)) {
    const del = path.join(overlay, '_delete')
    cpSync(overlay, dir, { recursive: true, filter: (src) => path.basename(src) !== '_delete' })
    if (existsSync(del)) for (const rel of readFileSync(del, 'utf8').split('\n').filter(Boolean)) rmSync(path.join(dir, rel), { force: true })
  }
  return dir
}

const runGate = (cwd, ...args) => {
  const r = spawnSync(process.execPath, [GATE, ...args], { cwd, encoding: 'utf8' })
  return { status: r.status, out: r.stdout, err: r.stderr }
}

// ---------------------------------------------------------------- 1. the design gate

console.log('design-gate: the ready fixture passes every check and prints READY')
{
  const r = runGate(mkProject())
  ok(r.status === 0 && /^READY$/m.test(r.out), `ready fixture: exit 0 and READY (got ${r.status})`)
  ok(!/^(MISSING|FAIL|WARN)/m.test(r.out), 'ready fixture: no MISSING, FAIL or WARN line')
  ok(/^OK\s+DESIGN\.md exists/m.test(r.out) && /^OK\s+frd-01-home: fdd\.md$/m.test(r.out), 'the existing checks still print as before')
  const j = runGate(mkProject(), '--json')
  const parsed = JSON.parse(j.out)
  ok(parsed.ready === true && parsed.missing === 0 && Array.isArray(parsed.checks) && parsed.checks.every((c) => c.status === 'OK'), '--json: ready true, no missing, every check OK')
}

console.log('design-gate: an empty directory is NOT READY, not a crash')
{
  const empty = mkdtempSync(path.join(os.tmpdir(), 'design-gate-empty-'))
  tmpDirs.push(empty)
  const r = runGate(empty)
  ok(r.status === 1 && /^NOT READY: \d+ missing$/m.test(r.out) && r.err === '', `empty dir: exit 1, "NOT READY: N missing", no stderr (got ${r.status} ${r.err.slice(0, 80)})`)
}

// [case, expected exit, patterns the output must match, patterns it must not match]
const GATE_CASES = [
  ['computed-no-nondefault', 1, [/^FAIL\s+measured styles are state-complete/m, /no component records a non-default state/]],
  ['computed-no-375', 1, [/default state lacks 375/]],
  ['computed-zero-root', 1, [/1 component\(s\) have a 0x0 root and no "note"/]],
  ['computed-zero-root-noted', 0, [/^READY$/m]],
  ['computed-state-widths', 0, [/^READY$/m, /^OK\s+measured styles are state-complete/m]],
  ['computed-note-width-gap', 1, [/Bulk bar \(default state lacks light-375, dark-375\)/]],
  ['computed-config-gap', 1, [/not measured at the required widths\/themes/, /lacks light-768/]],
  ['config-ready', 0, [/^READY$/m, /^OK\s+docs\/design\/freeze\/fidelity\.config\.json matches the toolkit schema/m]],
  ['config-legacy-mocks', 1, [/^FAIL\s+docs\/design\/freeze\/fidelity\.config\.json matches the toolkit schema/m, /unknown key "mocks"/]],
  ['config-invalid-json', 1, [/^FAIL\s+docs\/design\/freeze\/fidelity\.config\.json parses as JSON/m]],
  ['computed-pareto-scope', 0, [/^READY$/m]],
  ['computed-scope-mismatch', 1, [/measured at widths 375\/1280 but the config says 375\/768\/1280/]],
  ['computed-invalid', 1, [/does not parse as JSON/]],
  ['mock-missing-theme', 1, [/^FAIL\s+frd-01-home: mock screenshots cover every id at 375\/1280 x light\/dark/m, /home-1280-dark\.jpg/]],
  ['mock-legacy-names', 0, [/^READY$/m, /^WARN\s+frd-01-home: legacy screenshot names/m, /- home$/m]],
  ['mock-no-naming-match', 1, [/no screenshot follows the <id>-<width>-<theme>\.jpg naming/]],
  ['mock-width-gap', 1, [/sheet-1280-light\.jpg/]],
  ['mock-width-exempt', 0, [/^READY$/m]],
  ['mock-configured-missing', 1, [/4 missing: home-menu-375-light\.jpg/]],
  ['mock-unresolved-use', 1, [/^FAIL\s+frd-01-home: mock <use href="#\.\.\."> all resolve/m, /home\.html: #i-check/]],
  ['mock-demo-marker', 1, [/^FAIL\s+frd-01-home: mock HTML has no demo-only markers/m, /data-demo-only attribute/]],
  ['mock-demo-text', 1, [/"Solo demo" text/]],
  ['mock-demo-class', 1, [/^FAIL\s+frd-01-home: mock HTML has no demo-only markers/m, /demo-\* class/]],
  ['fdd-no-fidelity-refs', 1, [/^FAIL\s+frd-01-home: fdd\.md has "## Fidelity references"/m]],
  ['decisions-no-reconciliation', 1, [/^FAIL\s+design-decisions\.md has "## Functional reconciliation \(DR-064\)"/m]],
  ['components-no-nav-contract', 1, [/no "## AppShell nav contract" section/]],
  ['components-nav-no-destinations', 1, [/no top-level destination has a real/]],
  ['components-no-shell', 0, [/^READY$/m]],
  ['checklist-no-target', 1, [/^FAIL\s+fidelity-checklist\.md states the layered targets/m, /no "## Fidelity target" section/]],
  ['tracker-missing', 1, [/^MISSING\s+freeze\/tracker\.md exists/m]],
  ['tracker-open-stage', 1, [/1 stage\(s\) not done or deferred\(owner\): 2 Prototype \[in-progress\]/]],
  ['tracker-no-timebox', 1, [/time_box is not recorded/, /elapsed is not recorded/]],
  ['tracker-over-box', 1, [/elapsed is over time_box but there is no "shipped with backlog" note/]],
  ['tracker-over-box-noted', 0, [/^READY$/m]],
  ['tracker-template-style', 0, [/^READY$/m]],
  ['preflight-missing', 1, [/^MISSING\s+freeze\/preflight\.json/m]],
  ['preflight-stale', 1, [/^FAIL\s+preflight ran fully and is newer than the prototype/m, /the prototype changed after the preflight ran/]],
  ['preflight-incomplete', 1, [/the browser checks did not run/]],
  ['preflight-failures', 1, [/^FAIL\s+preflight has no failures/m, /\[smallText\]/]],
  ['preflight-warn-unacked', 1, [/unacknowledged: literalLengths, textFades/]],
  ['preflight-warn-acked', 0, [/^READY$/m]],
]

for (const [name, exit, must, mustNot = []] of GATE_CASES) {
  console.log(`design-gate case ${name}`)
  const r = runGate(mkProject(name))
  ok(r.status === exit, `exit ${exit} (got ${r.status})`)
  for (const re of must) ok(re.test(r.out), `output matches ${re}`)
  for (const re of mustNot) ok(!re.test(r.out), `output does not match ${re}`)
  if (exit === 1) ok(/^NOT READY: \d+ missing$/m.test(r.out) && !/^READY$/m.test(r.out), 'a blocked gate never prints READY')
}

console.log('design-gate: every fixture config is a valid toolkit config (one schema for the toolkit, the gate and the preflight)')
{
  const { loadSchema, validate } = await import(path.resolve(__dirname, '../skills/design/scripts/fidelity/config.mjs'))
  const INVALID = new Set(['config-legacy-mocks', 'config-invalid-json'])
  const schema = loadSchema()
  for (const name of readdirSync(path.join(FIXTURES, 'cases'))) {
    const f = path.join(FIXTURES, 'cases', name, 'docs/design/freeze/fidelity.config.json')
    if (!existsSync(f) || INVALID.has(name)) continue
    const errors = validate(schema, JSON.parse(readFileSync(f, 'utf8')))
    ok(errors.length === 0, `${name}: config validates (${errors.join('; ')})`)
  }
}

console.log('design-gate: --json on a failing project lists the failing check with its details')
{
  const parsed = JSON.parse(runGate(mkProject('mock-unresolved-use'), '--json').out)
  const bad = parsed.checks.filter((c) => c.status === 'FAIL')
  ok(parsed.ready === false && parsed.missing === 1 && bad.length === 1 && bad[0].details[0].includes('#i-check'), `ready false, one FAIL with details (got ${JSON.stringify(bad)})`)
}

console.log('design-gate: preflight freshness without a recorded hash falls back to file times')
{
  const stale = mkProject('preflight-no-hash')
  const proto = path.join(stale, 'docs/design/prototype/app.html')
  const report = path.join(stale, 'docs/design/freeze/preflight.json')
  utimesSync(proto, new Date(2026, 9, 16, 12), new Date(2026, 9, 16, 12))
  utimesSync(report, new Date(2026, 9, 16, 10), new Date(2026, 9, 16, 10))
  const old = runGate(stale)
  ok(old.status === 1 && /the prototype changed after the preflight ran/.test(old.out), 'a preflight older than the prototype is stale')
  utimesSync(report, new Date(2026, 9, 16, 14), new Date(2026, 9, 16, 14))
  const fresh = runGate(stale)
  ok(fresh.status === 0 && /^READY$/m.test(fresh.out), `a preflight newer than the prototype is fresh (got ${fresh.status})`)
}

// ---------------------------------------------------------------- 2. preflight-round, static checks

const fixture = (name) => path.join(FIXTURES, 'preflight', `${name}.html`)
function runPreflight(name, ...args) {
  const r = spawnSync(process.execPath, [PREFLIGHT, fixture(name), '--json', ...args], { encoding: 'utf8' })
  let report = null
  try { report = JSON.parse(r.stdout) } catch { /* reported by the assertions below */ }
  return { status: r.status, report, err: r.stderr }
}
const findingsOf = (report, check) => report.findings.filter((f) => f.check === check)

console.log('preflight-round --static: the CSS and token checks need no browser')
{
  const clean = runPreflight('clean', '--static')
  ok(clean.status === 2 && clean.report?.status === 'incomplete' && clean.report.complete === false && clean.report.browser === 'skipped', `a static run of a clean prototype is incomplete (exit 2), never clean (got ${clean.status} ${clean.report?.status})`)
  ok(clean.report.literals.colors === 0, 'poster block literals (/* poster:css:begin */ ... end) and token-block colours are not counted')
  ok(clean.report.checks.smallText.status === 'skipped' && clean.report.checks.literalColors.status === 'ok' && clean.report.checks.tokens.status === 'ok' && clean.report.checks.fonts.status === 'ok', 'browser checks are skipped, static checks pass')
  ok(clean.report.prototypeSha256.length === 64, 'the report records the prototype sha256 (the design gate uses it for freshness)')

  const colors = runPreflight('literal-colors', '--static')
  ok(colors.status === 1 && colors.report.checks.literalColors.status === 'fail' && findingsOf(colors.report, 'literalColors')[0].total === 4, `literal colours outside tokens fail (hex, rgb, hsl counted: ${findingsOf(colors.report, 'literalColors')[0]?.total})`)
  ok(findingsOf(colors.report, 'literalColors')[0].topSelectors[0][0] === '.card', 'the top offender is named')
  const looser = runPreflight('literal-colors', '--static', '--max-colors', '4')
  ok(looser.report.checks.literalColors.status === 'ok', '--max-colors raises the colour threshold')

  const defaults = runPreflight('literal-lengths', '--static')
  ok(defaults.report.checks.literalLengths.status === 'ok' && defaults.report.literals.lengths === 7, `7 literal px lengths are under the default threshold (counted ${defaults.report.literals.lengths}: @media preludes excluded)`)
  const strict = runPreflight('literal-lengths', '--static', '--max-lengths', '3')
  ok(strict.report.checks.literalLengths.status === 'warn' && strict.report.counts.fail === 0 && strict.status === 1, 'literal lengths above the threshold only warn')

  const hover = runPreflight('hover-unguarded', '--static')
  ok(hover.report.checks.unguardedHover.status === 'warn' && findingsOf(hover.report, 'unguardedHover')[0].selectors.join() === '.link:hover', 'only the :hover rule outside @media (hover:hover) is reported')

  const sys = runPreflight('fonts-system', '--static')
  ok(sys.report.checks.fonts.status === 'fail' && /system-ui/.test(findingsOf(sys.report, 'fonts')[0].message), 'a system stack as the first family fails')
  const net = runPreflight('fonts-network', '--static')
  ok(net.report.checks.fonts.status === 'warn' && net.report.counts.fail === 0 && /fonts\.example\.com/.test(findingsOf(net.report, 'fonts')[0].message), 'a font loaded from the network only warns')

  const noDark = runPreflight('tokens-no-dark', '--static')
  ok(noDark.report.checks.tokens.status === 'fail' && /dark token block/.test(findingsOf(noDark.report, 'tokens')[0].message), 'a missing dark token block fails')
  ok(runPreflight('dark-media', '--static').report.checks.tokens.status === 'ok', 'a prefers-color-scheme dark block counts as the dark tokens')
}

console.log('preflight-round reads its thresholds from the shared toolkit config (fidelity.config.json `preflight`)')
{
  const { loadSchema, validate } = await import(path.resolve(__dirname, '../skills/design/scripts/fidelity/config.mjs'))
  const project = mkProject()
  cpSync(fixture('literal-colors'), path.join(project, 'docs/design/prototype/app.html'))
  const cfg = { prototype: 'docs/design/prototype/app.html', widths: [375, 1280], preflight: { maxLiteralColors: 4, minFontPx: 11 } }
  ok(validate(loadSchema(), cfg).length === 0, 'a config with a preflight block validates against the toolkit schema')
  writeFileSync(path.join(project, 'docs/design/freeze/fidelity.config.json'), JSON.stringify(cfg))
  const r = spawnSync(process.execPath, [PREFLIGHT, 'docs/design/prototype/app.html', '--json', '--static'], { cwd: project, encoding: 'utf8' })
  const report = JSON.parse(r.stdout)
  ok(report.checks.literalColors.status === 'ok' && report.thresholds.maxLiteralColors === 4 && report.thresholds.minFontPx === 11, `preflight.maxLiteralColors and minFontPx from the project config apply (got ${JSON.stringify(report.thresholds)})`)
  const cov = findingsOf(report, 'configCoverage')[0]
  ok(report.checks.configCoverage.status === 'warn' && cov.total > 0 && /claimed by no css\.families\/rules\/overrides/.test(cov.message), `CSS rules the config's css map does not claim warn (configCoverage, ${cov?.total} rule(s))`)
  writeFileSync(path.join(project, 'docs/design/freeze/fidelity.config.json'), JSON.stringify({ ...cfg, css: { families: [{ name: 'app', description: 'All rules' }], rules: [{ family: 'app', match: '^' }] } }))
  const claimed = JSON.parse(spawnSync(process.execPath, [PREFLIGHT, 'docs/design/prototype/app.html', '--json', '--static'], { cwd: project, encoding: 'utf8' }).stdout)
  ok(claimed.checks.configCoverage.status === 'ok', 'a css map that claims every rule is clean')
}

console.log('preflight-round: bad usage is refused')
{
  const r = spawnSync(process.execPath, [PREFLIGHT, path.join(os.tmpdir(), 'no-such-prototype.html')], { encoding: 'utf8' })
  ok(r.status === 64 && /usage/.test(r.stderr), `a missing prototype exits 64 with usage (got ${r.status})`)
}

// ---------------------------------------------------------------- 3. preflight-round, real browser

async function browserAvailable() {
  try {
    const mod = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
    const chromium = mod.chromium || mod.default?.chromium
    const exe = process.env.CHROME_PATH || chromium.executablePath()
    return Boolean(exe) && existsSync(exe)
  } catch { return false }
}

if (!(await browserAvailable())) {
  console.log('preflight-round (browser): SKIPPED, no Chromium found (set PLAYWRIGHT_MODULE and CHROME_PATH to run these cases)')
} else {
  console.log('preflight-round (browser): a clean prototype passes every check')
  {
    const r = runPreflight('clean')
    ok(r.status === 0 && r.report?.status === 'clean' && r.report.complete === true, `clean: exit 0, status clean, complete (got ${r.status} ${r.report?.status} ${r.err.slice(0, 120)})`)
    ok(JSON.stringify(r.report.screens) === '["home","about"]' && r.report.widths.join() === '375,1280', 'both [data-screen] sections measured at 375 and 1280')
    ok(r.report.durationMs < 60000, `fast enough (${r.report.durationMs} ms)`)
    ok(Object.values(r.report.checks).every((c) => c.status === 'ok'), 'every check is ok: poster glyphs, the demo badge, the scroller carousel and the empty pulsing dot are all exempt')
  }

  console.log('preflight-round (browser): small text')
  {
    const r = runPreflight('small-text')
    const items = findingsOf(r.report, 'smallText')[0]?.items || []
    ok(r.status === 1 && r.report.checks.smallText.status === 'fail', 'text under 12px fails')
    ok(items.length === 1 && items[0].selector === 'p.tiny' && items[0].sizePx === 10 && items[0].widths.length === 2, `only the product element is reported, at both widths (got ${JSON.stringify(items.map((i) => i.selector))})`)
    const lowered = runPreflight('small-text', '--min-font', '10')
    ok(lowered.report.checks.smallText.status === 'ok', '--min-font moves the floor')
  }

  console.log('preflight-round (browser): demo leaks')
  {
    const r = runPreflight('demo-leak')
    const kinds = new Set((findingsOf(r.report, 'demoLeaks')[0]?.items || []).map((i) => i.kind))
    ok(r.report.checks.demoLeaks.status === 'fail' && kinds.has('element') && kinds.has('text') === false, `a demo strip still visible with demo=off fails as an element (kinds ${[...kinds]})`)
    const text = runPreflight('demo-leak', '--demo-selectors', '.nothing')
    ok(text.report.checks.demoLeaks.status === 'fail' && findingsOf(text.report, 'demoLeaks')[0].items.some((i) => i.kind === 'text' && /Solo demo/.test(i.text)), 'with no selector match, the visible "Solo demo" text is still caught')
    const unmarked = runPreflight('demo-unmarked')
    const dm = findingsOf(unmarked.report, 'demoMarkup')[0]
    ok(unmarked.report.checks.demoLeaks.status === 'ok' && unmarked.report.checks.demoMarkup.status === 'warn' && dm?.total === 1 && dm.items[0].sel === 'div.demo-strip', `demo markup hidden by its class but without data-demo-only warns once, at its outermost element (got ${JSON.stringify(dm?.items)})`)
    ok(runPreflight('clean').report.checks.demoMarkup.status === 'ok', 'the same markup marked data-demo-only is clean')
  }

  console.log('preflight-round (browser): text fades, overflow and fonts')
  {
    const fade = runPreflight('text-fade')
    ok(fade.report.checks.textFades.status === 'warn' && fade.report.counts.fail === 0 && findingsOf(fade.report, 'textFades')[0].keyframes === 'fade', 'an opacity keyframe on an element holding text warns')
    const over = runPreflight('overflow')
    const item = findingsOf(over.report, 'overflow')[0]?.items?.[0]
    ok(over.report.checks.overflow.status === 'fail' && item?.screen === 'about' && item.scrollWidth === 600, `horizontal overflow at 375 fails on the offending screen only (got ${JSON.stringify(item)})`)
    const missing = runPreflight('font-missing-file')
    ok(missing.report.checks.fonts.status === 'fail' && /none loaded/.test(findingsOf(missing.report, 'fonts')[0].message), 'a declared web font that never loads fails')
    const net = runPreflight('fonts-network')
    ok(net.report.counts.fail === 0 && net.report.checks.fonts.status === 'warn', 'a network font warns and the offline run does not turn it into a failure')
  }

  console.log('preflight-round (browser): screens')
  {
    const only = runPreflight('clean', '--screens', 'home')
    ok(only.report.screens.join() === 'home', '--screens limits the routes measured')
    const ghost = runPreflight('clean', '--screens', 'home,ghost')
    ok(ghost.report.checks.screens.status === 'warn' && /ghost/.test(findingsOf(ghost.report, 'screens')[0].message), 'a screen that cannot be routed to is reported, not silently skipped')
  }

  console.log('preflight-round --save feeds the design gate')
  {
    const project = mkProject()
    rmSync(path.join(project, 'docs/design/freeze/preflight.json'))
    const proto = path.join(project, 'docs/design/prototype')
    cpSync(fixture('clean'), path.join(proto, 'app.html'))
    cpSync(path.join(FIXTURES, 'preflight/fonts'), path.join(proto, 'fonts'), { recursive: true })
    const r = spawnSync(process.execPath, [PREFLIGHT, 'docs/design/prototype/app.html', '--save'], { cwd: project, encoding: 'utf8' })
    const saved = path.join(project, 'docs/design/freeze/preflight.json')
    ok(r.status === 0 && existsSync(saved), `--save writes docs/design/freeze/preflight.json (exit ${r.status})`)
    const gate = runGate(project)
    ok(gate.status === 0 && /^READY$/m.test(gate.out), `the gate accepts the saved clean preflight (got ${gate.status}: ${gate.out.split('\n').filter((l) => /^(FAIL|MISSING)/.test(l)).join(' | ')})`)
    writeFileSync(path.join(proto, 'app.html'), `${readFileSync(path.join(proto, 'app.html'), 'utf8')}<!-- edited after the preflight -->\n`)
    ok(/the prototype changed after the preflight ran/.test(runGate(project).out), 'editing the prototype afterwards makes the saved preflight stale')
  }
}

for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true })
console.log(`\npassed: ${pass}   failed: ${fail}`)
process.exit(fail ? 1 : 0)
