#!/usr/bin/env node
// DR-143: the stack template's playwright.config.ts splits a run into parallel and serial tiers from a
// project's e2e/parallel-safe.json. Evaluated with a stub @playwright/test, using isolated fixtures.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'stack-a-nextjs', 'e2e', 'playwright.config.ts')
let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${ok ? '' : ` ${detail}`}`)
  if (!ok) failed += 1
}

function load({ safe, mobile, env = {}, globalSetup = false, prodServer = false }) {
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
    mkdirSync(path.join(dir, 'docs/reviews'), { recursive: true })
    writeFileSync(path.join(dir, 'docs/reviews/mobile.md'), '# Reviewed inventory')
    if (mobile !== undefined) writeFileSync(path.join(dir, 'e2e/mobile-specs.json'), JSON.stringify(mobile))
    writeFileSync(path.join(dir, 'e2e', 'visual.spec.ts'), '')
    if (prodServer) writeFileSync(path.join(dir, 'e2e', 'prod-server.mjs'), '')
    if (globalSetup) writeFileSync(path.join(dir, 'e2e', 'globalSetup.ts'), '')
    if (safe !== undefined) writeFileSync(path.join(dir, 'e2e', 'parallel-safe.json'), JSON.stringify(safe))
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
check('diagnostics collect every browser failure', load({ env: { PANDACORP_E2E_CERTIFICATION: '1', PANDACORP_VERIFY_NO_BAIL: '1' } }).config?.maxFailures === 0)

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

console.log(failed ? `RESULT: ${failed} failed` : 'RESULT: all passed')
process.exit(failed ? 1 : 0)
