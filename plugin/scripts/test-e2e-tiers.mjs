#!/usr/bin/env node
// DR-143: the stack template's playwright.config.ts splits a run into parallel and serial tiers from a
// project's e2e/parallel-safe.json. Evaluated with a stub @playwright/test, like test-build-mech-lanes.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'stack-a-nextjs', 'e2e', 'playwright.config.ts')
let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${ok ? '' : ` ${detail}`}`)
  if (!ok) failed += 1
}

function load({ safe, env = {}, globalSetup = false }) {
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
    writeFileSync(path.join(dir, 'e2e', 'visual.spec.ts'), '')
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
  check('viewport-agnostic gates run on desktop only', project(c, 'mobile').testIgnore.includes('**/e2e/shell.spec.ts'))
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
    && project(c, 'mobile').testIgnore.includes('**/e2e/shell.spec.ts'))
}
check('globalSetup seed is wired in', load({ globalSetup: true }).config?.globalSetup === './e2e/globalSetup.ts')
check('stale spec fails loud', !load({ safe: ['gone.spec.ts'] }).ok)
check('non-array file fails loud', !load({ safe: { a: 1 } }).ok)
check('visual gate cannot be listed', !load({ safe: ['visual.spec.ts'] }).ok)
check('unknown tier fails loud', !load({ env: { PANDACORP_E2E_TIER: 'fast' } }).ok)

console.log(failed ? `RESULT: ${failed} failed` : 'RESULT: all passed')
process.exit(failed ? 1 : 0)
