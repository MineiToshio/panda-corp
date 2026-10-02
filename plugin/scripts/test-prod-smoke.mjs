#!/usr/bin/env node
// test-prod-smoke.mjs — proposal 40 §2 (Production-build smoke): the stack template's prod smoke judge, the build
// engine's reading of its report, and the harness contract (the playwright config serves the production artifact under
// PANDACORP_PROD_SMOKE; the spec is skipped everywhere else). The judge is the template's own TypeScript, loaded through
// Node's type stripping, so what is tested here is byte for byte what ships to a project.
// Run: node plugin/scripts/test-prod-smoke.mjs

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readProdSmokeReport } from './build-mech-close.mjs'
import { verifySealedLine } from './drift-seal.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE = path.resolve(__dirname, '../templates/stack-a-nextjs')
const { judgeProdPage, NEXT_DEFAULT_ERROR } = await import(path.join(TEMPLATE, 'e2e/_prod-smoke.ts'))
let pass = 0
let fail = 0
const ok = (cond, msg) => { if (cond) { pass++; console.log(`  ✓ ${msg}`) } else { fail++; console.log(`  ✗ ${msg}`) } }
const page = (over = {}) => ({ path: '/', status: 200, consoleErrors: [], pageErrors: [], cspViolations: [], mainText: 'Real content', errorBoundary: false, ...over })

console.log('prod-smoke-red-on-csp-violation: the ppv2 f4ed29a replay (the production CSP blocked the MDX compile, every post fell to its error boundary)')
{
  // What a production build of personal-page-v2 at f4ed29a^ showed on /en/blog/hello-world: a 200, the CSP EvalError
  // from the MDX bundle compiled in a Client Component, React's error boundary ("Algo salió mal") inside <main>.
  const evalError = "EvalError: Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script in the following Content Security Policy directive: \"script-src 'self' 'nonce-abc'\"."
  const v = judgeProdPage(page({ path: '/en/blog/hello-world', consoleErrors: [evalError], pageErrors: [evalError], cspViolations: ['script-src blocked eval'], mainText: 'Algo salió mal\nReintentar', errorBoundary: true }))
  ok(v.green === false && v.reasons.some((r) => /^CSP violation/.test(r)) && v.reasons.includes('rendered an error boundary'), `red: CSP violation + rendered error boundary (got ${JSON.stringify(v.reasons)})`)
  const onlyHttp = judgeProdPage(page({ path: '/en/blog/hello-world', consoleErrors: [evalError], mainText: 'Algo salió mal', errorBoundary: true }))
  ok(onlyHttp.green === false, 'a 200 response alone never passes a page whose CSP broke it (the red-team objection)')
  ok(judgeProdPage(page({ consoleErrors: ["Refused to execute inline script because it violates the following Content Security Policy directive: \"script-src 'self'\""] })).reasons.some((r) => /^CSP/.test(r)), 'an inline-script CSP refusal in the console is red')
  ok(judgeProdPage(page({ cspViolations: ['script-src blocked inline'] })).green === false, 'a securitypolicyviolation event alone is red')
}
console.log('prod smoke judge: error boundary, empty <main>, HTTP status; a clean page is green')
{
  ok(judgeProdPage(page()).green === true && judgeProdPage(page()).reasons.length === 0, 'a 200 page with content in <main> and a clean console is green')
  ok(judgeProdPage(page({ mainText: '   \n ' })).reasons.includes('empty <main>'), 'an empty <main> is red')
  ok(judgeProdPage(page({ mainText: null })).reasons.includes('no <main> element'), 'a page with no <main> is red')
  ok(judgeProdPage(page({ errorBoundary: true })).reasons.includes('rendered an error boundary'), 'a rendered error boundary is red even with a clean console')
  ok(judgeProdPage(page({ status: 500 })).reasons.includes('HTTP 500') && judgeProdPage(page({ status: 0 })).green === false, 'HTTP ≥ 400 or no response is red')
  ok(judgeProdPage(page({ consoleErrors: ['Failed to load resource: favicon.ico 404'] })).green === true, 'an unrelated console error does not red the production smoke (the dev smoke owns those)')
  ok(NEXT_DEFAULT_ERROR.test('Application error: a client-side exception has occurred (see the browser console for more information).'), 'Next\'s default production error page is recognised as an error boundary')
}
console.log('prod smoke report: the engine reads the spec\'s per-route lines, fail-closed')
{
  const g = readProdSmokeReport('{"path":"/","green":true,"reasons":[]}\n{"path":"/blog/a","green":true,"reasons":[]}\n', 0)
  ok(g.green === true && g.routes === 2, 'every route green and the runner exit 0 → green')
  const r = readProdSmokeReport('{"path":"/","green":true,"reasons":[]}\n{"path":"/blog/a","green":false,"reasons":["CSP violation: EvalError","rendered an error boundary"]}\n', 1)
  ok(r.green === false && r.red.length === 1 && /\/blog\/a: CSP violation/.test(r.failure), `a red route names itself and its reasons (got ${r.failure})`)
  ok(readProdSmokeReport(null, 1).green === false && /no report/.test(readProdSmokeReport(null, 1).failure), 'no report (the build or the server failed) → red')
  ok(readProdSmokeReport('', 0).green === false && /no route/.test(readProdSmokeReport('', 0).failure), 'no route visited → red, never a vacuous green')
  ok(readProdSmokeReport('{"path":"/","green":true,"reasons":[]}\n', 1).green === false, 'green rows but a failing runner → red')
  ok(readProdSmokeReport('not json\n', 0).green === false, 'an unreadable line → red')
}
console.log('prod smoke harness: the production artifact under PANDACORP_PROD_SMOKE, skipped everywhere else')
{
  const cfg = readFileSync(path.join(TEMPLATE, 'e2e/playwright.config.ts'), 'utf8')
  ok(/PROD_SMOKE\s*\?\s*`next build && next start --hostname 127\.0\.0\.1 --port \$\{PORT\}`/.test(cfg), 'the config serves `next build && next start` under PANDACORP_PROD_SMOKE')
  ok(/reuseExistingServer:\s*!PROD_SMOKE &&/.test(cfg), 'the production smoke never reuses an already-running (dev) server')
  ok(/next dev --hostname 127\.0\.0\.1 --port \$\{PORT\}/.test(cfg), 'every other run still serves next dev')
  const spec = readFileSync(path.join(TEMPLATE, 'e2e/prod-smoke.spec.ts'), 'utf8')
  ok(/test\.skip\(!process\.env\.PANDACORP_PROD_SMOKE/.test(spec) && /BLESSED/.test(spec) && /prod-samples\.json/.test(spec) && /securitypolicyviolation/.test(spec), 'the spec skips outside the prod smoke, visits the blessed routes + the dynamic samples, and listens for CSP violation events')
}
console.log('prod-smoke op: a project without the harness is red (fail-closed), never a skip')
{
  const root = mkdtempSync(path.join(os.tmpdir(), 'prod-smoke-'))
  try {
    const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' })
    git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@e.com'); git('config', 'user.name', 'T'); git('config', 'commit.gpgsign', 'false')
    mkdirSync(path.join(root, 'src'), { recursive: true }); writeFileSync(path.join(root, 'src/a.ts'), 'export const a = 1\n')
    git('add', '-A'); git('commit', '-q', '-m', 'init')
    const r = spawnSync(process.execPath, [path.join(__dirname, 'pandacorp-build-mech.mjs'), 'prod-smoke', '--project', root, '--path', path.join(root, '.wt-smoke')], { encoding: 'utf8' })
    const line = (r.stdout || '').trim().split('\n').pop()
    const receipt = JSON.parse(line)
    ok(r.status === 4 && verifySealedLine(line).ok && receipt.status === 'missing-harness', `no e2e/prod-smoke.spec.ts → refused missing-harness, one sealed line (got ${r.status} ${receipt.status})`)
  } finally { rmSync(root, { recursive: true, force: true }) }
}

console.log(`\npassed: ${pass}   failed: ${fail}`)
process.exit(fail ? 1 : 0)
