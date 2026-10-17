#!/usr/bin/env node
// test-design-fidelity.mjs — the design-freeze fidelity toolset (plugin/skills/design/scripts/fidelity/) against the
// tiny fixture prototype plugin/scripts/fixtures/design-mini/ (2 screens, a demo-only block, a hover rule, a popover
// that closes on scroll, a lazy image, an icon sprite).
//
// The Node-only parts (config validation, the CSS split and its rule-count check, the scope planner, the computed-style
// comparator and the YIQ pixel metric) always run. The browser parts need Chromium: they honour PLAYWRIGHT_MODULE and
// CHROME_PATH and SKIP with a message when no browser can start, so CI without a browser stays green.
//
// Exit 0 green / 1 red. Output ends in `RESULT: N passed, M failed[, K skipped]`.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIDELITY = path.join(HERE, '../skills/design/scripts/fidelity')
const FIXTURE = path.join(HERE, 'fixtures/design-mini')
const { ConfigError, loadConfig, loadSchema, prototypeHash, validate } = await import(path.join(FIDELITY, 'config.mjs'))
const { DEMO_SELECTORS, demoMarkers } = await import(path.join(FIDELITY, 'demo.mjs'))
const { buildSplit } = await import(path.join(FIDELITY, 'split-css.mjs'))
const { multisetDiff } = await import(path.join(FIDELITY, 'cssparse.mjs'))
const { planComponent } = await import(path.join(FIDELITY, 'measure.mjs'))
const { diffStyles, diffPixels } = await import(path.join(FIDELITY, 'diff.mjs'))
const { compareRGBA } = await import(path.join(FIDELITY, 'pixels.mjs'))

let passed = 0
let failed = 0
let skipped = 0
const check = (cond, msg) => { if (cond) { passed++; console.log(`PASS  ${msg}`) } else { failed++; console.log(`FAIL  ${msg}`) } }
const throwsLike = (fn, re) => { try { fn(); return false } catch (e) { return re.test(String(e.message)) } }
const rejectsLike = async (p, re) => { try { await p; return { ok: false, msg: 'resolved' } } catch (e) { return { ok: re.test(String(e.message)), msg: e.message } } }

const tmpRoots = []
function freshProject(edit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-mini-'))
  tmpRoots.push(dir)
  fs.cpSync(FIXTURE, dir, { recursive: true })
  if (edit) edit(dir)
  return dir
}
const rawConfig = () => JSON.parse(fs.readFileSync(path.join(FIXTURE, 'docs/design/freeze/fidelity.config.json'), 'utf8'))

// ── 1. config validation ─────────────────────────────────────────────────────────────────────────────
{
  const cfg = loadConfig({ root: FIXTURE })
  check(cfg.widths.join() === '375,1280' && cfg.themes.join() === 'light,dark' && cfg.workers === 2 && cfg.scope.mode === 'pareto', 'config: the fixture config loads with its widths, themes, workers and the pareto default')
  check(cfg.params.demoOff === 'demo=off' && cfg.params.host === 'host=page' && cfg.touchBelow === 768 && cfg.scope.primaryWidth === 1280 && cfg.scope.touchWidth === 375, 'config: defaults applied (demo=off, host=page, touch below 768, primary/touch widths)')
  const example = JSON.parse(fs.readFileSync(path.join(FIDELITY, 'fidelity.config.example.json'), 'utf8'))
  check(validate(loadSchema(), example).length === 0, 'config: the shipped example validates against config.schema.json')
  const errs = (patch) => { try { loadConfig({ root: FIXTURE, raw: { ...rawConfig(), ...patch } }); return [] } catch (e) { return e instanceof ConfigError ? e.errors : [`not a ConfigError: ${e.message}`] } }
  check(errs({ widths: '375' }).some((e) => e.startsWith('$.widths')), 'config: widths given as a string is rejected at $.widths')
  check(errs({ colour: 'red' }).some((e) => /unknown key "colour"/.test(e)), 'config: an unknown top-level key is rejected')
  check(errs({ prototype: 'docs/nope.html' }).some((e) => /no file at/.test(e)), 'config: a prototype path that does not exist is rejected')
  check(errs({ floating: [{ component: 'Nope', state: 'open', panel: '$', anchor: '$' }] }).some((e) => /unknown component "Nope"/.test(e)), 'config: a floating panel naming an unknown component is rejected')
  check(errs({ states: { 'frd-01-home': [{ id: 'a', title: 'A', route: '#home', actions: [{ click: '#x', wait: 5 }] }] } }).some((e) => /at most 1 key/.test(e)), 'config: an action with two verbs is rejected')
  check(errs({ scope: { mode: 'everything' } }).some((e) => /must be one of pareto, full/.test(e)), 'config: an unknown scope mode is rejected')
  check(cfg.shard.strip === DEMO_SELECTORS.join(', ') && DEMO_SELECTORS.includes('[class^="demo-"]'), 'demo: shard.strip defaults to the one shared demo-selector list (attribute + any demo-* class)')
  check(demoMarkers('<div class="ftr demo-controls">x</div>').length === 1 && demoMarkers('<p>Solo demo</p>')[0] === '"Solo demo" text' && demoMarkers('<div class="nodemo-x">Home</div>').length === 0, 'demo: the gate\'s markers come from the same definition (class token prefix, demo wording)')
  check(cfg.exportPaths.join() === 'icons' && errs({ exportPaths: ['../out'] }).some((e) => /exportPaths\[0\]/.test(e)), 'config: exportPaths defaults to icons when exports is set and must stay inside the prototype folder')
  const noProto = { ...rawConfig() }; delete noProto.prototype
  check(throwsLike(() => loadConfig({ root: FIXTURE, raw: noProto }), /missing required "prototype"/), 'config: a config without prototype is rejected')
}

// ── 2. CSS split: rule-count equality ─────────────────────────────────────────────────────────────
{
  const cfg = loadConfig({ root: FIXTURE })
  const { files, report } = buildSplit(cfg)
  check(report.counts.original > 20 && report.counts.original === report.counts.split && report.counts.missing === 0 && report.counts.extra === 0, `split: the files hold exactly the prototype's rules (${report.counts.original} = ${report.counts.split}, 0 missing, 0 extra)`)
  check(files[0].name === '00-tokens' && files[1].name === '01-demo-only', 'split: configured families come first, numbered in load order')
  check(files.find((f) => f.family === 'demo-only').content.includes('DO NOT BUILD') && files.find((f) => f.family === 'demo-only').content.includes('end PROTOTYPE-ONLY'), 'split: the family note is in the header and the closing comment stays with demo-only')
  check(files.some((f) => f.content.includes('url(../../assets/dot.svg)')), 'split: relative url()s are rebased for reference/css/')
  check(report.heuristic.rules > 0 && files.some((f) => f.family === 'card'), 'split: rules no family claims are filed by the heuristic (selector stem)')
  check(report.idRules.some((r) => r.ids.includes('home-title')), 'split: id-selector rules are reported for the mocks and the catalogue')
  check(throwsLike(() => buildSplit({ ...cfg, css: { ...cfg.css, unmatched: 'fail' } }), /match no family/), 'split: css.unmatched "fail" refuses unclaimed rules')
  const { missing, extra } = multisetDiff(['a', 'a', 'b'], ['a', 'b', 'c'])
  check(missing.length === 1 && missing[0] === 'a' && extra.length === 1 && extra[0] === 'c', 'split: the multiset check sees a dropped duplicate and an extra rule')
}

// ── 2b. token extraction (run by the split stage) ──────────────────────────────────────────────────
{
  const { readTokens, writeTokens } = await import(path.join(FIDELITY, 'tokens.mjs'))
  const cfg = loadConfig({ root: FIXTURE })
  const html = '<style>:root{--sp-2:8px;--z-top:10;--layout-max:1280px}[data-theme="dark"]{--bg:#000}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#111;--fg:#eee}}@media (max-width: 480px){:root{--sp-2:6px}}.pz{--pz-ink:#123}</style>'
  const t = readTokens(html, cfg)
  check(t.themes.light.get('--sp-2') === '8px' && t.themes.light.get('--z-top') === '10' && t.themes.dark.get('--bg') === '#000' && t.themes.dark.get('--fg') === '#eee', 'tokens: :root is the first theme; the [data-theme] block wins over the prefers-color-scheme block, which fills the rest')
  check(t.overrides.length === 2 && t.overrides[0].context === '@media (max-width: 480px)' && t.overrides[0].tokens['--sp-2'] === '6px' && t.overrides[1].selector === '.pz', 'tokens: a breakpoint redefinition and a component scope are listed as overrides with their context')

  const root = freshProject((d) => fs.writeFileSync(path.join(d, 'docs/design/design-tokens.json'), JSON.stringify({ status: 'FROZEN 2026-10-16', fonts: [{ family: 'Inter' }], light: { color: { '--bg': '#fafafa' } } })))
  const pcfg = loadConfig({ root })
  const first = writeTokens(pcfg, { today: '2026-10-16' })
  const tok = JSON.parse(fs.readFileSync(path.join(root, 'docs/design/design-tokens.json'), 'utf8'))
  const hist = JSON.parse(fs.readFileSync(path.join(root, 'docs/design/design-tokens-history.json'), 'utf8'))
  check(tok.light.color['--bg'] === '#ffffff' && tok.dark.color['--accent'] === '#3cc99a' && tok.fonts[0].family === 'Inter' && tok.status === 'FROZEN 2026-10-16', 'tokens: design-tokens.json gets the grouped light/dark sets from the prototype and keeps the curated keys (fonts, status)')
  check(first.changed && hist.proposals.length === 1 && hist.proposals[0].date === '2026-10-16' && /~1 changed/.test(hist.proposals[0].outcome) && /\+7 added/.test(hist.proposals[0].outcome), `tokens: the change is appended to design-tokens-history.json (${hist.proposals[0]?.outcome})`)
  const second = writeTokens(loadConfig({ root }), { today: '2026-10-17' })
  const hist2 = JSON.parse(fs.readFileSync(path.join(root, 'docs/design/design-tokens-history.json'), 'utf8'))
  check(!second.changed && hist2.proposals.length === 1, 'tokens: an unchanged prototype adds no history entry')
  fs.writeFileSync(path.join(root, 'docs/design/design-tokens-history.json'), '{"note": "x"}')
  const ed = loadConfig({ root })
  fs.writeFileSync(ed.paths.prototype, fs.readFileSync(ed.paths.prototype, 'utf8').replace('--accent:#0a7d5a', '--accent:#0a7d5b'))
  check(throwsLike(() => writeTokens(ed), /no "proposals" array/), 'tokens: a history file without its proposals array fails loud instead of being overwritten')
}

// ── 3. scope planner ────────────────────────────────────────────────────────────────────────────
{
  const cfg = loadConfig({ root: FIXTURE })
  const btn = cfg.components.find((c) => c.name === 'Button')
  const ctx = (jobs, sn) => jobs.filter((j) => j.sn === sn).map((j) => `${j.theme}-${j.w}:${j.props}${j.crop ? '+img' : ''}`).sort().join(' ')
  const p = planComponent(cfg, btn)
  check(ctx(p, 'default') === 'dark-1280:color+img dark-375:color+img light-1280:all+img light-375:all+img', 'scope pareto: the default state at both widths, dark colour-only, images light + dark')
  check(ctx(p, 'hover') === 'dark-1280:color light-1280:all+img', 'scope pareto: a forced-hover state is not a layout state: primary width only, no dark image')
  check(ctx(p, 'open') === 'dark-1280:color light-1280:all+img light-375:all+img', 'scope pareto: a click state is a layout state: also at the touch width')
  const full = planComponent({ ...cfg, scope: { ...cfg.scope, mode: 'full' } }, btn)
  check(full.length === 12 && full.every((j) => j.props === 'all' && j.crop), 'scope full (--all-states): every state x width x theme, all properties, an image each')
}

// ── 4. comparators (Node) ───────────────────────────────────────────────────────────────────────
{
  const rec = (o = {}) => ({ root: { color: 'rgb(22, 28, 34)', 'font-size': '13px', padding: '0px 12px', 'border-radius': '4px', width: '97.9062px', size: '97.9x36', ...o }, children: { '.ic': null } })
  const doc = (o, anchor) => ({ components: { Button: { states: { default: { 'light-1280': rec(o) } }, ...(anchor ? { anchor_offset: { default: { 'light-1280': anchor } } } : {}) } } })
  const anchor = (dx) => ({ panel_size: [160, 70.8], anchor_size: [86, 40.4], top_left: { dx, dy: 44.4 }, top_right: { dx: 0, dy: 44.4 } })
  check(diffStyles(doc(), doc()).ok, 'diff styles: identical documents pass')
  const colour = diffStyles(doc(), doc({ color: 'rgb(22, 28, 35)' }))
  check(!colour.ok && colour.failures[0].rule === 'colour', 'diff styles: a one-step colour change fails (colour is exact)')
  check(diffStyles(doc(), doc({ padding: '0px 13px' })).ok && !diffStyles(doc(), doc({ padding: '0px 14px' })).ok, 'diff styles: spacing within 1 px passes, 2 px fails')
  check(diffStyles(doc(), doc({ 'border-radius': '5px' })).ok && !diffStyles(doc(), doc({ 'border-radius': '6px' })).ok, 'diff styles: radius within 1 px passes, 2 px fails')
  check(!diffStyles(doc(), doc({ 'font-size': '13.5px' })).ok && !diffStyles(doc(), doc({ size: '98.9x36' })).ok, 'diff styles: typography and size are exact')
  check(diffStyles(doc({}, anchor(-74)), doc({}, anchor(-74.8))).ok && !diffStyles(doc({}, anchor(-74)), doc({}, anchor(-75.5))).ok, 'diff styles: anchor offsets within 1 px pass, 1.5 px fails')
  check(!diffStyles(doc(), { components: { Button: { states: {} } } }).ok, 'diff styles: a state missing from the candidate fails')

  // synthetic RGBA: a black square on white with a 1-px grey anti-aliased edge
  const W = 40
  const img = (edge, stripe) => {
    const a = new Uint8Array(W * W * 4).fill(255)
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      let v = 255
      if (x >= 10 && x < 30 && y >= 10 && y < 30) v = 0
      else if ((x === 9 || x === 30) && y >= 10 && y < 30) v = edge
      a[i] = a[i + 1] = a[i + 2] = v
      if (stripe && y >= 34 && y < 36) { a[i] = 255; a[i + 1] = 40; a[i + 2] = 40 }
    }
    return a
  }
  check(compareRGBA(img(128), img(200), W, W).diff === 0, 'diff pixels (YIQ): an anti-aliased edge pixel changing is ignored')
  check(compareRGBA(img(128), img(128, true), W, W).diff === 80, 'diff pixels (YIQ): a 2-px colour stripe is counted (80 px)')
  const masked = img(128); for (let y = 34; y < 36; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; masked[i] = 255; masked[i + 1] = 0; masked[i + 2] = 255 }
  const m = compareRGBA(masked, img(128, true), W, W)
  check(m.diff === 0 && m.masked === 80, 'diff pixels (YIQ): magenta reference pixels are masked')
}

// ── 5. browser parts ─────────────────────────────────────────────────────────────────────────────
const { BrowserUnavailable, launch, openHandle, closeHandle, navigate, settle, mediaProbe, fullShot, urlFor } = await import(path.join(FIDELITY, 'lib.mjs'))
let browser = null
try {
  browser = await launch()
} catch (e) {
  if (!(e instanceof BrowserUnavailable)) throw e
  skipped++
  console.log(`SKIP  browser tests: no Chromium available (${e.message.split('\n')[0]}). Set PLAYWRIGHT_MODULE and CHROME_PATH to run them.`)
}

if (browser) {
  try {
    const { freeze } = await import(path.join(FIDELITY, 'freeze.mjs'))
    const measure = await import(path.join(FIDELITY, 'measure.mjs'))
    const screens = await import(path.join(FIDELITY, 'screens.mjs'))
    // a hand-made icons/ folder already there and no exports.json yet: the first and later hashes must agree
    const root = freshProject((d) => { fs.mkdirSync(path.join(d, 'docs/design/prototype/icons')); fs.writeFileSync(path.join(d, 'docs/design/prototype/icons/star.svg'), '<svg>hand-made</svg>\n') })
    const cfg = loadConfig({ root })
    const hash0 = prototypeHash(cfg)
    const lines = []
    const res = await freeze({ cfg, stages: ['split', 'measure', 'shard', 'screens', 'catalog', 'identity'], log: (s) => lines.push(s) })
    check(res.ok && res.results.every((r) => r.status === 'ran'), `freeze all: every stage ran green (${res.results.map((r) => `${r.stage}:${r.status}`).join(' ')})${res.ok ? '' : `\n${lines.join('\n')}`}`)
    const state = JSON.parse(fs.readFileSync(path.join(root, 'docs/design/freeze/state.json'), 'utf8'))
    check(['split', 'measure', 'shard', 'screens', 'catalog', 'identity'].every((s) => state.stages[s].status === 'ok' && state.stages[s].inputHash && Number.isFinite(state.stages[s].durationMs)), 'freeze: state.json records status, input hash and duration per stage')
    const again = await freeze({ cfg: loadConfig({ root }), stages: ['split', 'measure', 'shard', 'screens', 'catalog', 'identity'], log: () => {} })
    check(again.results.every((r) => r.status === 'up-to-date'), 'freeze: a second run skips every up-to-date stage')
    check(prototypeHash(loadConfig({ root })) === hash0, 'freeze: the prototype hash ignores the export outputs from the first run on (an icons/ folder present before exports.json existed)')
    check(fs.existsSync(path.join(root, 'docs/design/design-tokens.json')) && fs.existsSync(path.join(root, 'docs/design/design-tokens-history.json')), 'freeze split: writes design-tokens.json and design-tokens-history.json')

    // the toolkit's real outputs pass the design gate's quality checks (one config, one contract)
    const { spawnSync } = await import('node:child_process')
    const gate = spawnSync(process.execPath, [path.join(HERE, '../skills/design/scripts/check-design-gate.mjs')], { cwd: root, encoding: 'utf8' })
    const gateOk = [['the config validates against the toolkit schema', 'docs/design/freeze/fidelity.config.json matches the toolkit schema'], ['measured styles are state-complete', 'measured styles are state-complete'], ['frd-01-home mocks cover every id x width x theme', 'frd-01-home: mock screenshots cover every id at 375/1280 x light/dark'], ['frd-02-list mocks cover every id x width x theme', 'frd-02-list: mock screenshots cover every id'], ['mocks carry no demo-only markers', 'frd-01-home: mock HTML has no demo-only markers'], ['mock sprite references resolve', 'frd-01-home: mock <use href']]
    for (const [label, line] of gateOk) check(gate.stdout.split('\n').some((l) => /^OK\s/.test(l) && l.includes(line)), `gate on the toolkit's output: ${label}`)

    // measure output shape
    const cs = JSON.parse(fs.readFileSync(path.join(root, 'docs/design/prototype/reference/computed-styles.json'), 'utf8'))
    const b = cs.components.Button
    check(b && b.route === '#home' && b.selector === '#menuBtn' && b.children.join() === '.ic', 'measure: a component records route, selector and children')
    const light = b.states.default['light-1280']
    check(light && Object.keys(light.root).length === 44 && 'translate' in light.root && /^\d+(\.\d)?x\d+(\.\d)?$/.test(light.root.size) && '.ic' in light.children, 'measure: a primary record holds root (43 properties incl. translate + size) and children')
    check(Object.keys(b.states.default['dark-1280'].root).length === 11 && 'color' in b.states.default['dark-1280'].root && !('padding' in b.states.default['dark-1280'].root), 'measure: dark records carry the colour properties only (pareto)')
    check(!b.states.hover['light-375'] && b.states.open['light-375'] && b.states.default['light-375'].root.cursor, 'measure: layout states only at the touch width (pareto)')
    const ao = b.anchor_offset?.open?.['light-1280']
    check(ao && Array.isArray(ao.panel_size) && Number.isFinite(ao.top_left.dx) && Number.isFinite(ao.top_right.dy), 'measure: the floating panel records its anchor offset')
    check(fs.existsSync(path.join(root, 'docs/design/prototype/reference/components/button--default--375-light.png')) && fs.existsSync(path.join(root, 'docs/design/prototype/reference/components/card--default--1280-dark.png')), 'measure: component images at the touch and primary widths, dark for the default state')

    // incremental
    const inc1 = await measure.run({ cfg: loadConfig({ root }), browser })
    check(inc1.measured === 0 && inc1.skipped === 2, 'measure incremental: nothing changed, nothing re-measured')
    const raw = rawConfig()
    raw.components.find((c) => c.name === 'Card').states.focus = { force: [['$', ['focus']]] }
    const inc2 = await measure.run({ cfg: loadConfig({ root, raw }), browser })
    check(inc2.measured === 1 && inc2.skipped === 1, 'measure incremental: a changed component is the only one re-measured')
    const inc3 = await measure.run({ cfg: loadConfig({ root, raw }), browser, all: true })
    check(inc3.measured === 2, 'measure --all: every component re-measured')

    // shard
    const mock = fs.readFileSync(path.join(root, 'docs/frds/frd-01-home/mocks/home.html'), 'utf8')
    check(mock.includes('<symbol id="i-star"') && mock.includes('<use href="#i-star"'), 'shard: the icon sprite is inlined and icon references keep pointing at it')
    check(mock.includes('id="home--home-title"') && mock.includes('for="home--q"') && mock.includes('id="home--q"') && mock.includes('#home--home-title{letter-spacing:.5px}'), 'shard: ids are prefixed per section, references rewritten, id rules repeated for the prefixed ids')
    check(!/Demo controls|Demo note|Review gallery/.test(mock), 'shard: no demo-only content in the mock')
    check(!mock.includes('demo-badge') && !/Solo demo/.test(mock), 'shard: a demo-* element without data-demo-only is stripped by the shared default')
    check(/<link rel="stylesheet" href="\.\.\/\.\.\/\.\.\/design\/prototype\/reference\/css\/00-tokens\.css">/.test(mock) && !/<style>[^<]*\.btn\{/.test(mock), 'shard: the mock links the reference CSS instead of inlining the prototype style')
    check(mock.includes('Popover: go to the list') && mock.includes('Popover (anchored to its trigger in the app)'), 'shard: the open popover of a state is kept below its screen')
    const jpgH = (f) => { const b2 = fs.readFileSync(f); for (let i = 2; i < b2.length;) { const mk = b2[i + 1]; const len = b2.readUInt16BE(i + 2); if (mk >= 0xc0 && mk <= 0xc2) return b2.readUInt16BE(i + 5); i += 2 + len } return -1 }
    const shots = path.join(root, 'docs/frds/frd-01-home/mocks/screenshots')
    check(jpgH(path.join(shots, 'home-menu-375-light.jpg')) === 900 && jpgH(path.join(shots, 'home-375-light.jpg')) > 1400, 'shard: a popover that closes on scroll is captured viewport-only; a full state grows to the page height')
    check(fs.readdirSync(shots).length === 8 && fs.readdirSync(path.join(root, 'docs/frds/frd-02-list/mocks/screenshots')).length === 4, 'shard: every state x width x theme screenshot, per FRD')
    check(fs.readdirSync(path.join(root, 'docs/design/prototype/screenshots')).filter((f) => /^mini--(home|list)--\d+--(light|dark)\.jpg$/.test(f)).length === 8, 'screens: every screen x width x theme')
    const catalog = fs.readFileSync(path.join(root, 'docs/design/prototype/components.html'), 'utf8')
    check(catalog.includes('<symbol id="i-star"') && catalog.includes('data-cat-root="Button|hover|') && catalog.includes('[data-st~="hover"]') && fs.existsSync(path.join(root, 'docs/design/prototype/reference/components-light.png')), 'catalog: live markup per state with the state shim, sprite inlined, sheets captured')
    const star = fs.readFileSync(path.join(root, 'docs/design/prototype/icons/star.svg'), 'utf8')
    check(star.startsWith('<svg') && star.includes('viewBox="0 0 10 10"') && star.includes('fill="currentColor"') && state.stages.catalog.summary.exportWarnings.length === 0, 'catalog: config exports are written as exact SVG files carrying the symbol\'s attributes, no lossy-export warning')
    check(state.stages.identity.summary.identical === 4 && state.stages.identity.summary.total === 4, 'identity: the linked copy renders pixel-identical to the prototype (4/4)')

    // exports: stale files removed, lossy SVGs reported, writes outside exportPaths refused
    const catalogMod = await import(path.join(FIDELITY, 'catalog.mjs'))
    const exportsList = path.join(root, 'docs/design/freeze/exports.json')
    fs.writeFileSync(exportsList, JSON.stringify(['icons/gone.svg', 'icons/star.svg']))
    fs.writeFileSync(path.join(root, 'docs/design/prototype/icons/gone.svg'), '<svg></svg>\n')
    const lossyRaw = { ...rawConfig(), exports: "({ 'icons/star.svg': '<svg xmlns=\"http://www.w3.org/2000/svg\">' + document.querySelector('#i-star').innerHTML + '</svg>' })" }
    const cat = await catalogMod.run({ cfg: loadConfig({ root, raw: lossyRaw }), browser })
    check(cat.staleRemoved.join() === 'icons/gone.svg' && !fs.existsSync(path.join(root, 'docs/design/prototype/icons/gone.svg')) && JSON.parse(fs.readFileSync(exportsList, 'utf8')).join() === 'icons/star.svg', 'catalog: a file a previous run exported that the list no longer returns is removed')
    check(cat.exportWarnings.length === 1 && /icons\/star\.svg \(from #i-star\) lacks viewBox, fill \(CSS: rgb/.test(cat.exportWarnings[0]), `catalog: an export that drops the symbol's viewBox and its CSS fill warns (${cat.exportWarnings[0]})`)
    const outside = await rejectsLike(catalogMod.run({ cfg: loadConfig({ root, raw: { ...rawConfig(), exports: "({ 'logo/x.svg': '<svg/>' })" } }), browser }), /outside exportPaths \[icons\]/)
    check(outside.ok && !fs.existsSync(path.join(root, 'docs/design/prototype/logo/x.svg')), `catalog: an export outside exportPaths is refused before anything is written (${outside.msg.split('\n')[0]})`)

    // identity: a broken cascade fails after one attempt, pointing at css.families
    const identityMod = await import(path.join(FIDELITY, 'identity.mjs'))
    const splitMod = await import(path.join(FIDELITY, 'split-css.mjs'))
    const broken3 = freshProject()
    const bcfg = loadConfig({ root: broken3 })
    await splitMod.run({ cfg: bcfg })
    const last = identityMod.loadOrder(bcfg.paths.css).at(-1)
    fs.appendFileSync(path.join(bcfg.paths.css, last), '\nh1{color:#f00}\n')
    let idErr = null
    try { await identityMod.run({ cfg: bcfg, browser }) } catch (e) { idErr = e }
    check(idErr && /computed styles differ/.test(idErr.message) && /h1#home-title [a-z-]*color: rgb\(22, 28, 34\) \(prototype\) vs rgb\(255, 0, 0\) \(linked\)/.test(idErr.message) && /css\.families/.test(idErr.message) && /Troubleshooting/.test(idErr.message), `identity: a cascade change is reported as computed-style differences with the css.families pointer (${idErr?.message.split('\n')[0]})`)
    check(idErr?.summary?.differing.every((r) => r.attempts === 1), 'identity: a computed-style difference is not retried (1 attempt, not identity.attempts)')

    // touch emulation probe
    const h375 = await openHandle(browser, cfg, { width: 375, theme: 'light' })
    const h1280 = await openHandle(browser, cfg, { width: 1280, theme: 'light' })
    try {
      const after = (h) => h.page.evaluate(() => getComputedStyle(document.querySelector('.probe'), '::after').content)
      await navigate(h375, urlFor(cfg, '#home'))
      await navigate(h1280, urlFor(cfg, '#home'))
      const p = await mediaProbe(h375)
      check(!p.hover && p.coarse && (await after(h375)) === '"touch"' && p.demoOff === true && !p.hostAuto, 'touch probe at 375: hover:none + pointer:coarse match, the touch CSS branch renders, demo off, host-auto off')
      check((await mediaProbe(h1280)).hover && (await after(h1280)) === '"fine"', 'touch probe at 1280: fine pointer with hover')
      await h1280.page.click('#menuBtn')
      await navigate(h1280, urlFor(cfg, '#list'))
      check(!(await h1280.page.evaluate(() => document.querySelector('#menuBtn:hover') !== null)), 'warm context: a click in one unit leaves no :hover in the next (the pointer is parked)')
      await fullShot(h375, path.join(root, 'probe.png'))
      check(!(await mediaProbe(h375)).hover && (await after(h375)) === '"touch"', 'touch probe: the touch branch survives a full-height capture')
      const noHost = loadConfig({ root, raw: { ...rawConfig(), params: { host: '' } } })
      const hh = await openHandle(browser, noHost, { width: 375, theme: 'light' })
      try {
        await navigate(hh, urlFor(noHost, '#home'))
        const r = await rejectsLike(fullShot(hh, path.join(root, 'probe2.png')), /host-auto/)
        check(r.ok, `fail-closed: a capture with the host-auto class on fails (${r.msg.split('\n')[0]})`)
      } finally { await closeHandle(hh) }
    } finally { await closeHandle(h375); await closeHandle(h1280) }

    // missing image: fail closed, nothing written
    const broken = freshProject((d) => {
      const f = path.join(d, 'docs/design/prototype/mini.html')
      fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('assets/photo.svg', 'assets/missing.svg'))
    })
    const r = await rejectsLike(screens.run({ cfg: loadConfig({ root: broken }), browser }), /did not load[\s\S]*assets\/missing\.svg/)
    const outDir = path.join(broken, 'docs/design/prototype/screenshots')
    check(r.ok && (!fs.existsSync(outDir) || fs.readdirSync(outDir).length === 0), `fail-closed: a visible image that did not load fails the run and nothing is written (${r.msg.split('\n')[0]})`)

    // pixel diff through Chromium decoding (PNG and JPEG)
    const page = await browser.newPage({ viewport: { width: 240, height: 160 } })
    const box = async (color) => { await page.setContent(`<body style="margin:0;background:#fff"><div style="margin:20px;width:160px;height:90px;border:2px solid ${color};font:16px sans-serif">Fidelity</div></body>`); return page.screenshot() }
    const a1 = await box('#2a6')
    const a2 = await box('#2a6')
    const c1 = await box('#c33')
    const same = await diffPixels(browser, a1, a2, { sliceHeight: 160 })
    const changed = await diffPixels(browser, a1, c1, { sliceHeight: 160 })
    check(same.ok && same.slices[0].diff === 0, 'diff pixels (Chromium-decoded PNG): two renders of the same page pass')
    check(!changed.ok && changed.slices[0].diff > 500 && changed.failing.length === 1, `diff pixels: a 2-px border colour change fails the slice (${changed.slices[0]?.diff} px, ratio ${changed.slices[0]?.ratio.toFixed(4)})`)
    const aa = await diffPixels(browser, pngEncode(40, 40, aaImage(128)), pngEncode(40, 40, aaImage(200)), { sliceHeight: 40 })
    check(aa.ok && aa.slices[0].diff === 0, 'diff pixels: anti-aliasing noise in a decoded PNG is ignored')
    await page.setContent('<body style="margin:0;background:#fff"><p style="font:20px serif;margin:20px">Fidelity</p></body>')
    const j1 = await page.screenshot({ type: 'jpeg', quality: 85 })
    check((await diffPixels(browser, j1, j1, { sliceHeight: 80 })).ok, 'diff pixels: JPEG references decode and compare in slices')
    const sized = await diffPixels(browser, a1, pngEncode(40, 40, aaImage(128)), {})
    check(!sized.ok && sized.sizeMismatch, 'diff pixels: a size mismatch fails')
    await page.close()
  } finally {
    await browser.close()
  }
}

for (const d of tmpRoots) fs.rmSync(d, { recursive: true, force: true })
console.log(`\nRESULT: ${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`)
process.exit(failed ? 1 : 0)

function aaImage(edge) {
  const W = 40
  const a = new Uint8Array(W * W * 4).fill(255)
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4
    let v = 255
    if (x >= 10 && x < 30 && y >= 10 && y < 30) v = 0
    else if ((x === 9 || x === 30) && y >= 10 && y < 30) v = edge
    a[i] = a[i + 1] = a[i + 2] = v
  }
  return a
}

/** A minimal RGBA PNG encoder (filter 0, zlib), so the AA fixture needs no image file. */
function pngEncode(w, h, rgba) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1)
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
