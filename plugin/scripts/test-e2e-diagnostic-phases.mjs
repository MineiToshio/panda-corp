#!/usr/bin/env node
// Exercise the shipped config with the real Playwright scheduler; no browser fixture, server or port.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = fileURLToPath(new URL('../../', import.meta.url))
const require = createRequire(path.join(repo, 'mission-control/package.json'))
const cli = path.join(path.dirname(require.resolve('playwright/package.json', { paths: [require.resolve('@playwright/test')] })), 'cli.js')
const dir = mkdtempSync(path.join(os.tmpdir(), 'e2e-diagnostic-phases-'))
let passed = 0
try {
  symlinkSync(path.join(repo, 'mission-control/node_modules'), path.join(dir, 'node_modules'), 'dir')
  mkdirSync(path.join(dir, 'e2e'))
  writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}\n')
  writeFileSync(path.join(dir, 'base.config.ts'), readFileSync(path.join(repo, 'plugin/templates/stack-a-nextjs/e2e/playwright.config.ts')))
  writeFileSync(path.join(dir, 'playwright.config.ts'), `import base from './base.config'; export default { ...base, webServer: undefined, reporter: [['json']] };\n`)
  writeFileSync(path.join(dir, 'e2e/parallel-safe.json'), '["parallel.spec.ts"]\n')
  const spec = `import fs from 'node:fs'; import {test,expect} from '@playwright/test';
    test('phase sentinel', async ({}, info) => {
      fs.appendFileSync(process.env.JOURNAL!, JSON.stringify({project:info.project.name,event:'start'})+'\\n');
      try { expect(process.env.FAIL_PHASE === 'parallel' ? info.project.name.includes('parallel') : info.project.name === process.env.FAIL_PHASE).toBe(false); }
      finally { fs.appendFileSync(process.env.JOURNAL!,JSON.stringify({project:info.project.name,event:'end'})+'\\n'); }
    });\n`
  writeFileSync(path.join(dir, 'e2e/parallel.spec.ts'), spec)
  writeFileSync(path.join(dir, 'e2e/serial.spec.ts'), spec)
  function run(noBail, failPhase) {
    const journal = path.join(dir, 'journal.ndjson')
    writeFileSync(journal, '')
    const result = spawnSync(process.execPath, [cli, 'test'], {
      cwd: dir, encoding: 'utf8', timeout: 60_000,
      env: { ...process.env, PANDACORP_E2E_TIER: 'combined', PANDACORP_E2E_CERTIFICATION: '1', PANDACORP_VERIFY_NO_BAIL: noBail ? '1' : '0', FAIL_PHASE: failPhase, JOURNAL: journal },
    })
    assert.equal(result.status, 1, result.stderr || result.stdout)
    const report = JSON.parse(result.stdout)
    if (noBail) assert.equal(report.errors.length, 0, JSON.stringify(report.errors))
    const events = readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
    return { report, events }
  }
  function assertAllPhases(events) {
    const projects = ['desktop-parallel', 'mobile-parallel', 'desktop', 'mobile']
    for (const project of projects) assert.equal(events.filter(e => e.project === project && e.event === 'end').length, 1, JSON.stringify(events))
    const index = (project, event) => events.findIndex(e => e.project === project && e.event === event)
    assert.ok(index('desktop', 'start') > Math.max(index('desktop-parallel', 'end'), index('mobile-parallel', 'end')), 'serial writer overlapped parallel readers')
    assert.ok(index('mobile', 'start') > index('desktop', 'end'), 'serial platform projects overlapped')
  }
  for (const failPhase of ['parallel', 'desktop']) {
    const { report, events } = run(true, failPhase)
    assertAllPhases(events)
    assert.equal(report.config.workers, 1)
    assert.equal(report.stats.skipped, 0)
    assert.ok(report.stats.unexpected > 0)
    console.log(`ok diagnostic ${failPhase} failure: every phase runs in isolation; final exit stays red`)
    passed++
  }
  const { report, events } = run(false, 'parallel')
  assert.ok(!events.some(e => e.project === 'desktop' || e.project === 'mobile'), JSON.stringify(events))
  assert.equal(report.config.maxFailures, 1)
  assert.equal(report.config.workers, 3)
  console.log('ok certification parallel failure: serial phases stop, maxFailures=1')
  passed++
  console.log(`RESULT: ${passed} passed`)
} finally { rmSync(dir, { recursive: true, force: true }) }
