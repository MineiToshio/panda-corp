#!/usr/bin/env node
// DR-143: the stack template's playwright.config.ts splits a run into parallel and serial tiers from a
// project's e2e/parallel-safe.json. Evaluated with a stub @playwright/test, using isolated fixtures.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'stack-a-nextjs', 'e2e', 'playwright.config.ts')
let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${ok ? '' : ` ${detail}`}`)
  if (!ok) failed += 1
}

function load({ safe, isolated, mobile, env = {}, globalSetup = false, prodServer = false }) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'e2e-tiers-'))
  try {
    const stub = path.join(dir, 'node_modules', '@playwright', 'test')
    mkdirSync(stub, { recursive: true })
    mkdirSync(path.join(dir, 'e2e'))
    writeFileSync(path.join(stub, 'package.json'), '{ "name": "@playwright/test", "type": "module", "main": "index.js" }\n')
    writeFileSync(path.join(stub, 'index.js'), 'export const defineConfig = (c) => c\nexport const devices = { "Desktop Chrome": {} }\n')
    writeFileSync(path.join(dir, 'package.json'), '{ "type": "module" }\n')
    writeFileSync(path.join(dir, 'playwright.config.ts'), readFileSync(TEMPLATE, 'utf8'))
    writeFileSync(path.join(dir, 'e2e', 'read.spec.ts'), '')
    writeFileSync(path.join(dir, 'e2e', 'dialog.spec.ts'), '')
    writeFileSync(path.join(dir, 'e2e', 'new-dialog.spec.ts'), '')
    for (const spec of ['nested/read.spec.mts', 'nested/read.spec.cts', 'nested/read.spec.js', 'nested/read.mts']) {
      mkdirSync(path.dirname(path.join(dir, 'e2e', spec)), { recursive: true })
      writeFileSync(path.join(dir, 'e2e', spec), '')
    }
    mkdirSync(path.join(dir, 'docs/reviews'), { recursive: true })
    writeFileSync(path.join(dir, 'docs/reviews/mobile.md'), '# Reviewed inventory')
    if (mobile !== undefined) writeFileSync(path.join(dir, 'e2e/mobile-specs.json'), JSON.stringify(mobile))
    writeFileSync(path.join(dir, 'e2e', 'visual.spec.ts'), '')
    if (prodServer) writeFileSync(path.join(dir, 'e2e', 'prod-server.mjs'), '')
    if (globalSetup) writeFileSync(path.join(dir, 'e2e', 'globalSetup.ts'), '')
    if (safe !== undefined) writeFileSync(path.join(dir, 'e2e', 'parallel-safe.json'), JSON.stringify(safe))
    if (isolated !== undefined) writeFileSync(path.join(dir, 'e2e', 'isolated-specs.json'), JSON.stringify(isolated))
    const code = `const { default: c } = await import(${JSON.stringify(path.join(dir, 'playwright.config.ts'))}); console.log(JSON.stringify(c))`
    const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--input-type=module', '-e', code], { cwd: dir, encoding: 'utf8', env: { PATH: process.env.PATH, ...env } })
    return r.status === 0 ? { ok: true, config: JSON.parse(r.stdout.trim().split('\n').pop()) } : { ok: false, stderr: r.stderr }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
const project = (c, name) => c.projects.find((p) => p.name === name)
const GLOB = '**/e2e/read.spec.ts'

{
  const { config: c } = load({})
  check('no file: one worker, no tier filter', c.workers === 1 && c.testMatch === undefined && project(c, 'desktop').testIgnore.length === 0)
  check('no globalSetup seed: not wired', c.globalSetup === undefined)
  check('viewport-agnostic gates run on desktop only', project(c, 'mobile').testIgnore.includes('**/e2e/shell.spec.ts') && project(c, 'mobile').testMatch === undefined)
}
{
  const { config: c } = load({ safe: ['read.spec.ts'] })
  check('file without a tier: one worker, every spec', c.workers === 1 && c.testMatch === undefined && project(c, 'desktop').testIgnore.length === 0)
}
{
  const { config: c } = load({ safe: ['read.spec.ts'], env: { PANDACORP_E2E_TIER: 'parallel' } })
  check('parallel tier: only listed specs on 3 workers', c.workers === 3 && c.testMatch?.[0] === GLOB)
}
{
  const { config: c } = load({ safe: ['read.spec.ts'], env: { PANDACORP_E2E_TIER: 'parallel', PANDACORP_E2E_WORKERS: '2' } })
  check('PANDACORP_E2E_WORKERS sets the width', c.workers === 2)
}
{
  const { config: c } = load({ safe: ['read.spec.ts'], env: { PANDACORP_E2E_TIER: 'serial' } })
  check('serial tier: complement on one worker, both projects', c.workers === 1 && c.testMatch === undefined
    && project(c, 'desktop').testIgnore.includes(GLOB) && project(c, 'mobile').testIgnore.includes(GLOB)
    && project(c, 'mobile').testIgnore.includes('**/e2e/shell.spec.ts') && project(c, 'mobile').testMatch === undefined)
}
check('globalSetup seed is wired in', load({ globalSetup: true }).config?.globalSetup === './e2e/globalSetup.ts')
check('stale spec fails loud', !load({ safe: ['gone.spec.ts'] }).ok)
check('non-array file fails loud', !load({ safe: { a: 1 } }).ok)
check('visual gate cannot be listed', !load({ safe: ['visual.spec.ts'] }).ok)
{
  const { config: c } = load({ prodServer: true, env: { PANDACORP_E2E_SERVER: 'prod' } })
  check('prod server: the seed serves the run, never reused', c.webServer.command === 'node e2e/prod-server.mjs start 3000' && c.webServer.reuseExistingServer === false)
}
check('seed alone keeps next dev', load({ prodServer: true }).config?.webServer.command.startsWith('next dev'))
check('prod server without the seed fails loud', !load({ env: { PANDACORP_E2E_SERVER: 'prod' } }).ok)
check('unknown tier fails loud', !load({ env: { PANDACORP_E2E_TIER: 'fast' } }).ok)

{
  const { config: c } = load({ safe: ['read.spec.ts'], env: { PANDACORP_E2E_TIER: 'combined', PANDACORP_E2E_CERTIFICATION: '1' } })
  check('one combined run: parallel then serial desktop then serial mobile', c.workers === 3
    && project(c, 'desktop').workers === 1 && project(c, 'mobile').workers === 1
    && project(c, 'desktop').dependencies.includes('desktop-parallel')
    && project(c, 'mobile').dependencies[0] === 'desktop'
    && project(c, 'desktop-parallel').testMatch.includes(GLOB))
  check('without reviewed exclusions safe specs retain mobile coverage', project(c, 'mobile-parallel').testMatch.includes(GLOB))
  check('certification bails at one failure and owns server', c.maxFailures === 1 && c.webServer.reuseExistingServer === false)
}
{
  const {config: c} = load({ safe: ['read.spec.ts'], env: {PANDACORP_E2E_TIER:'combined', PANDACORP_E2E_CERTIFICATION:'1',PANDACORP_VERIFY_NO_BAIL:'1'} })
  check('diagnostics run every browser project despite red predecessors, without overlapping writers', c.maxFailures === 0 && c.workers === 1 && c.projects.every(p => !p.dependencies?.length && !p.teardown))
}

// Exercise the real production launcher against a fake Next executable: no socket or compiler.
{
  const dir = mkdtempSync(path.join(os.tmpdir(), 'prod-server-'))
  try {
    mkdirSync(path.join(dir, 'e2e'), { recursive: true })
    mkdirSync(path.join(dir, 'node_modules/next/dist/bin'), { recursive: true })
    const seed = new URL('../templates/stack-a-nextjs/e2e/prod-server.mjs', import.meta.url)
    writeFileSync(path.join(dir, 'e2e/prod-server.mjs'), readFileSync(seed))
    writeFileSync(path.join(dir, 'e2e/server-env.json'), JSON.stringify({ PANDACORP_FACTORY_ROOT: './e2e/fixtures' }))
    writeFileSync(path.join(dir, 'node_modules/next/dist/bin/next'), `console.log(JSON.stringify({ args:process.argv.slice(2), fixture:process.env.PANDACORP_FACTORY_ROOT, mode:process.env.NODE_ENV })); process.exit(Number(process.env.FIXTURE_NEXT_EXIT || 0))`)
    const run = (args, env = {}) => spawnSync(process.execPath, ['e2e/prod-server.mjs', ...args], { cwd: dir, encoding: 'utf8', env: { PATH: process.env.PATH, ...env } })
    const build = run(['build']); const start = run(['start', '3900'])
    const built = JSON.parse(build.stdout); const started = JSON.parse(start.stdout)
    check('prod build/start resolve identical fixture environment', build.status === 0 && start.status === 0 && built.fixture === path.join(realpathSync(dir), 'e2e/fixtures') && built.fixture === started.fixture && built.mode === 'production' && started.mode === 'production')
    check('prod starts owned loopback origin from existing artifact', started.args.join(' ') === 'start --hostname 127.0.0.1 --port 3900')
    check('prod build failure propagates', run(['build'], { FIXTURE_NEXT_EXIT: '7' }).status === 7)
    check('prod rejects invalid start port', run(['start', '--help']).status !== 0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

{
  const c = load({}).config
  check('RVB B2: upgrade without mobile inventory keeps existing dialog coverage', c && !project(c, 'mobile').testIgnore.includes('**/e2e/dialog.spec.ts') && project(c, 'mobile').testMatch === undefined)
  const reviewed = load({ mobile: { include: ['dialog.spec.ts'], desktopOnly: ['read.spec.ts'], review: 'docs/reviews/mobile.md' } }).config
  check('reviewed exclusions reduce only the classified duplicates', reviewed && project(reviewed, 'mobile').testIgnore.includes(GLOB) && !project(reviewed, 'mobile').testIgnore.includes('**/e2e/dialog.spec.ts'))
  check('new unclassified viewport spec keeps mobile coverage', reviewed && !project(reviewed, 'mobile').testIgnore.includes('**/e2e/new-dialog.spec.ts') && project(reviewed, 'mobile').testMatch === undefined)
  check('unreviewed legacy allowlist fails loudly', !load({ mobile: ['read.spec.ts'] }).ok)
  check('missing review document cannot reduce coverage', !load({ mobile: { include: [], desktopOnly: ['read.spec.ts'], review: 'docs/reviews/missing.md' } }).ok)
  check('review cannot exclude mandatory visual core', !load({ mobile: { include: [], desktopOnly: ['visual.spec.ts'], review: 'docs/reviews/mobile.md' } }).ok)
}

// Both inventory readers accept TypeScript module variants, while retaining path validation.
for (const spec of ['read.spec.ts', 'nested/read.spec.mts', 'nested/read.spec.cts']) {
  const glob = `**/e2e/${spec}`
  const parallel = load({ safe: [spec], env: { PANDACORP_E2E_TIER: 'parallel' } })
  check(`parallel inventory accepts ${spec}`, parallel.ok && parallel.config.testMatch.includes(glob))
  const mobile = load({ mobile: { include: [spec], desktopOnly: [], review: 'docs/reviews/mobile.md' } })
  check(`mobile include accepts ${spec}`, mobile.ok && !project(mobile.config, 'mobile').testIgnore.includes(glob))
  const desktopOnly = load({ mobile: { include: [], desktopOnly: [spec], review: 'docs/reviews/mobile.md' } })
  check(`mobile exclusion accepts ${spec}`, desktopOnly.ok && project(desktopOnly.config, 'mobile').testIgnore.includes(glob))
}
for (const spec of ['nested/read.spec.js', 'nested/read.mts', 'nested/../read.spec.ts', 'missing.spec.mts']) {
  check(`parallel inventory rejects ${spec}`, !load({ safe: [spec] }).ok)
  check(`mobile inventory rejects ${spec}`, !load({ mobile: { include: [spec], desktopOnly: [], review: 'docs/reviews/mobile.md' } }).ok)
}

const slotEnv = { PANDACORP_E2E_SERVER: 'prod', PANDACORP_E2E_TIER: 'combined', PANDACORP_E2E_SLOT_PORTS: '4101,4102,4103' }
const slotLoad = (options = {}) => load({ safe: ['read.spec.ts'], isolated: { 'dialog.spec.ts': 'Own fixture writes' }, prodServer: true, ...options, env: { ...slotEnv, ...options.env } })
{
  const c = slotLoad({ mobile: { include: [], desktopOnly: ['dialog.spec.ts'], review: 'docs/reviews/mobile.md' } }).config
  check('isolated: four parallel predecessors then desktop/mobile serial', c && project(c, 'desktop-isolated')?.testMatch.includes('**/e2e/dialog.spec.ts') && project(c, 'mobile-isolated')?.testMatch.length === 0 && project(c, 'desktop').dependencies.length === 4 && project(c, 'mobile').dependencies.includes('desktop') && project(c, 'desktop').testIgnore.includes('**/e2e/dialog.spec.ts'))
  check('isolated: canonical plus N owned servers with explicit ports', Array.isArray(c?.webServer) && c.webServer.length === 4 && c.webServer.every(s => !s.reuseExistingServer) && c.webServer[2].command === 'node e2e/prod-server.mjs start 4102 --slot 1')
}
for (const ports of ['4101', '4101,4101,4103', '3000,4102,4103', '0,4102,4103', '65536,4102,4103', '4101x,4102,4103']) check(`invalid slot ports fail: ${ports}`, !slotLoad({ env: { PANDACORP_E2E_SLOT_PORTS: ports } }).ok)
{
  const c = slotLoad({ env: { TEST_PARALLEL_INDEX: '1' } }).config
  check('worker reload selects slot 1 only for isolated projects', c && project(c, 'desktop-isolated')?.use.baseURL === 'http://127.0.0.1:4102' && project(c, 'mobile-isolated')?.use.baseURL === 'http://127.0.0.1:4102' && c.use.baseURL === 'http://127.0.0.1:3000' && !project(c, 'desktop-parallel').use.baseURL && !project(c, 'desktop').use.baseURL)
  check('coordinator reload keeps canonical baseURL', project(slotLoad().config, 'desktop-isolated')?.use.baseURL === 'http://127.0.0.1:3000')
  const fallback = slotLoad({ env: { PANDACORP_E2E_SLOT_PORTS: '' } }).config
  check('default slot ports follow canonical port', fallback?.webServer?.[1]?.url === 'http://127.0.0.1:3001')
}
for (const env of [{ PANDACORP_E2E_SERVER: '' }, { PANDACORP_E2E_TIER: '' }, { PANDACORP_E2E_TIER: 'serial' }]) {
  const c = slotLoad({ env: { ...env, PANDACORP_E2E_TIER: env.PANDACORP_E2E_TIER === '' ? undefined : env.PANDACORP_E2E_TIER ?? 'combined' } }).config
  check('dev/since/serial keeps isolated specs in serial selection', c && !Array.isArray(c.webServer) && !project(c, 'desktop-isolated') && !project(c, 'desktop').testIgnore.includes('**/e2e/dialog.spec.ts'))
}
for (const isolated of [{ 'visual.spec.ts': 'Bad' }, { 'read.spec.ts': 'Overlap' }, { 'gone.spec.ts': 'Stale' }, { 'nested/../dialog.spec.ts': 'Unsafe traversal' }, { 'nested/read.spec.js': 'Unsafe extension' }, { 'dialog.spec.ts': '' }, ['dialog.spec.ts']]) check(`invalid isolated inventory ${JSON.stringify(isolated)}`, !slotLoad({ isolated }).ok)
for (const [env, count] of [[{ PANDACORP_VERIFY_NO_BAIL: '1' }, 1], [{ PANDACORP_E2E_WORKERS: '2' }, 2]]) {
  const c = slotLoad({ env: { ...env, PANDACORP_E2E_SLOT_PORTS: '' } }).config
  check(`isolated effective width ${count}`, c?.workers === count && c.webServer?.length === count + 1)
}
check('no isolated file preserves one server and original project set', (() => { const c = load({ safe: ['read.spec.ts'], prodServer: true, env: slotEnv }).config; return c && !Array.isArray(c.webServer) && c.projects.length === 4 })())
{
  const helper = new URL('../../mission-control/e2e/_slot.ts', import.meta.url)
  const cwd = fileURLToPath(new URL('../../mission-control', import.meta.url))
  const run = (env) => spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--input-type=module', '-e', `const m = await import(${JSON.stringify(helper.href)}); console.log(JSON.stringify({root:m.FACTORY_ROOT,fixtures:m.FIXTURES}));`], { cwd, encoding:'utf8', env: { PATH: process.env.PATH, ...env } })
  const slot = run({ PANDACORP_E2E_SLOTS: '3', TEST_PARALLEL_INDEX: '1' })
  const canonical = run({ TEST_PARALLEL_INDEX: '1' })
  check('slot helper agrees with worker baseURL index and canonical fallback', slot.status === 0 && JSON.parse(slot.stdout).root === path.join(cwd, 'test-results/e2e-slots/1/fixtures/factory-root') && canonical.status === 0 && JSON.parse(canonical.stdout).root === path.join(cwd, 'e2e/fixtures/factory-root'))
  check('slot helper rejects out-of-pool index', run({PANDACORP_E2E_SLOTS:'1',TEST_PARALLEL_INDEX:'1'}).status !== 0)
}

// Synthetic repository only: the launcher must copy working input, never a prior run's residue.
{
  const dir = mkdtempSync(path.join(os.tmpdir(), 'prod-slot-'))
  try {
    const runGit = (...args) => { const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' }); if (r.status) throw new Error(r.stderr); return r }
    mkdirSync(path.join(dir, 'e2e/fixtures/factory-root/empty'), { recursive: true })
    mkdirSync(path.join(dir, 'node_modules/next/dist/bin'), { recursive: true })
    writeFileSync(path.join(dir, 'e2e/prod-server.mjs'), readFileSync(new URL('../templates/stack-a-nextjs/e2e/prod-server.mjs', import.meta.url)))
    writeFileSync(path.join(dir, 'node_modules/next/dist/bin/next'), 'console.log(JSON.stringify({args:process.argv.slice(2), root:process.env.PANDACORP_FACTORY_ROOT, events:process.env.PANDACORP_EVENTS_FILE, home:process.env.HOME, fixed:process.env.FIXED}))')
    writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\ntest-results/\ne2e/fixtures/**/ledger.json\n')
    writeFileSync(path.join(dir, 'e2e/fixtures/factory-root/tracked.md'), 'old')
    runGit('init', '-q'); runGit('add', '.')
    writeFileSync(path.join(dir, 'e2e/fixtures/factory-root/tracked.md'), 'working bytes')
    writeFileSync(path.join(dir, 'e2e/fixtures/factory-root/new.md'), 'new')
    writeFileSync(path.join(dir, 'e2e/fixtures/factory-root/ledger.json'), 'ignored')
    const envFile = path.join(dir, 'e2e/server-env.json')
    const env = { PANDACORP_FACTORY_ROOT: './e2e/fixtures/factory-root', PANDACORP_EVENTS_FILE: './e2e/fixtures/factory-root/events.ndjson', HOME: './e2e/fixtures/factory-root/home', FIXED: 'unchanged' }
    writeFileSync(envFile, JSON.stringify(env))
    const run = (...args) => spawnSync(process.execPath, ['e2e/prod-server.mjs', ...args], { cwd: dir, encoding: 'utf8', env: { PATH: process.env.PATH } })
    const slot = path.join(realpathSync(dir), 'test-results/e2e-slots/1')
    mkdirSync(slot, { recursive: true }); writeFileSync(path.join(slot, 'stale'), 'stale')
    const r = run('start', '4102', '--slot', '1')
    const out = r.status === 0 ? JSON.parse(r.stdout) : {}
    check('slot copies tracked working bytes and new files', r.status === 0 && readFileSync(path.join(slot, 'fixtures/factory-root/tracked.md'), 'utf8') === 'working bytes' && existsSync(path.join(slot, 'fixtures/factory-root/new.md')), r.stderr)
    check('slot recreates stale output and skips ignored files/empty dirs', !existsSync(path.join(slot, 'stale')) && !existsSync(path.join(slot, 'fixtures/factory-root/ledger.json')) && !existsSync(path.join(slot, 'fixtures/factory-root/empty')))
    check('slot repoints all fixture keys and preserves other values', out.root === path.join(slot, 'fixtures/factory-root') && out.events === path.join(slot, 'fixtures/factory-root/events.ndjson') && out.home === path.join(slot, 'fixtures/factory-root/home') && out.fixed === 'unchanged')
    check('slot rejects bad index/unknown flag', run('start', '4102', '--slot', '../1').status !== 0 && run('start', '4102', '--slot', '-1').status !== 0 && run('start', '4102', '--other', '1').status !== 0)
    writeFileSync(envFile, JSON.stringify({ ...env, BAD: './e2e/private.json' }))
    check('slot rejects non-fixture e2e environment paths', run('start', '4102', '--slot', '1').status !== 0)
    writeFileSync(envFile, JSON.stringify(env))
    const build = run('build', '--slot', 'bad')
    check('build ignores slot flags and keeps canonical fixtures', build.status === 0 && JSON.parse(build.stdout).root === path.join(realpathSync(dir), 'e2e/fixtures/factory-root'))
    symlinkSync('missing.md', path.join(dir, 'e2e/fixtures/factory-root/link.md'))
    check('slot rejects fixture symlinks', run('start', '4102', '--slot', '1').status !== 0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

console.log(failed ? `RESULT: ${failed} failed` : 'RESULT: all passed')
process.exit(failed ? 1 : 0)
