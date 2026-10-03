#!/usr/bin/env node
// test-prod-smoke.mjs — proposal 40 §2 (Production-build smoke): the stack template's prod smoke judge, the build
// engine's reading of its report, and the harness contract (the playwright config serves the production artifact under
// PANDACORP_PROD_SMOKE; the spec is skipped everywhere else). The judge is the template's own TypeScript, loaded through
// Node's type stripping, so what is tested here is byte for byte what ships to a project.
// Run: node plugin/scripts/test-prod-smoke.mjs

import { spawnSync } from 'node:child_process'
import http from 'node:http'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readProdSmokeReport } from './build-mech-close.mjs'
import { verifySealedLine } from './drift-seal.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE = path.resolve(__dirname, '../templates/stack-a-nextjs')
const { judgeProdPage, observeProdPage, NEXT_DEFAULT_ERROR } = await import(path.join(TEMPLATE, 'e2e/_prod-smoke.ts'))
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
  ok(judgeProdPage(page({ hydrated: false })).reasons.includes('never hydrated') && judgeProdPage(page({ hydrated: true })).green === true, 'a page that never hydrated is red; a hydrated clean page is green')
  ok(NEXT_DEFAULT_ERROR.test('Application error: a client-side exception has occurred (see the browser console for more information).'), 'Next\'s default production error page is recognised as an error boundary')
}
// FIX ROUND 1 (review of proposal 40): the smoke read its verdict right after `load`, before hydration and before a
// lazily loaded client chunk ran, so the ppv2 f4ed29a shape (a client component evaluating code under the production
// CSP, falling to its error boundary) passed. A real browser against a strict-CSP fixture: the late violation must red.
console.log('prod-smoke-waits-for-hydration: a CSP violation raised after hydration by a lazy client chunk is red (real browser)')
{
  // Playwright is not a plugin dependency: borrow the factory's own Mission Control install (or PANDACORP_PLAYWRIGHT_DIR).
  const common = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: __dirname, encoding: 'utf8' }).stdout.trim()
  const dirs = [process.env.PANDACORP_PLAYWRIGHT_DIR, path.resolve(__dirname, '../../mission-control'), common && path.resolve(common, '..', 'mission-control')].filter(Boolean)
  let pw = null
  for (const d of dirs) { try { pw = createRequire(path.join(d, 'package.json'))('@playwright/test'); break } catch { pw = null } }
  ok(pw !== null, `@playwright/test resolvable for the real-browser fixture (looked in ${dirs.join(', ')})`)
  if (pw) {
    const CSP = "script-src 'self' 'nonce-pc1'; object-src 'none'"
    const shell = (body) => `<!doctype html><html><head><meta charset="utf-8"></head><body><main>Hello world, the server-rendered post body.</main>${body}</body></html>`
    const pages = {
      // Hydration completes at ~100 ms; a lazily loaded client chunk then evaluates code (MDX compiled in the browser).
      '/late-csp': shell(`<script nonce="pc1">setTimeout(() => { document.documentElement.setAttribute('data-hydrated', ''); setTimeout(() => { const s = document.createElement('script'); s.src = '/chunk-mdx.js'; document.head.append(s) }, 300) }, 100)</script>`),
      // A clean page holding a never-ending SSE stream: the settle must not depend on network idle (DR-071).
      '/clean-sse': shell(`<script nonce="pc1">setTimeout(() => { document.documentElement.setAttribute('data-hydrated', ''); new EventSource('/sse') }, 100)</script>`),
      // A page whose client code never hydrates: fail-closed, never a silent green.
      '/never-hydrates': shell(''),
    }
    const server = http.createServer((req, res) => {
      if (req.url === '/chunk-mdx.js') {
        setTimeout(() => { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end("try { new Function('return 1')() } catch (e) { console.error(String(e)); document.querySelector('main').innerHTML = '<div data-error-boundary>Algo salió mal</div>' }") }, 300)
        return
      }
      if (req.url === '/sse') { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write(': open\n\n'); return }
      const html = pages[req.url]
      res.writeHead(html ? 200 : 404, { 'content-type': 'text/html', 'content-security-policy': CSP })
      res.end(html || 'not found')
    })
    await new Promise((r) => server.listen(0, '127.0.0.1', r))
    const base = `http://127.0.0.1:${server.address().port}`
    const browser = await pw.chromium.launch()
    const visit = async (route) => {
      const ctx = await browser.newContext({ baseURL: base })
      const pg = await ctx.newPage()
      try { const t0 = Date.now(); const o = await observeProdPage(pg, route, { hydrationTimeoutMs: 3000 }); return { o, v: judgeProdPage(o), ms: Date.now() - t0 } } finally { await ctx.close() }
    }
    try {
      const late = await visit('/late-csp')
      ok(late.v.green === false && late.v.reasons.some((r) => /^CSP violation/.test(r)) && late.v.reasons.includes('rendered an error boundary'), `the late CSP violation and its error boundary are seen (got ${JSON.stringify(late.v.reasons)})`)
      const clean = await visit('/clean-sse')
      ok(clean.v.green === true && clean.ms < 10000, `a clean hydrated page with an open SSE stream is green and settles in bounded time (got ${JSON.stringify(clean.v.reasons)} in ${clean.ms} ms)`)
      const never = await visit('/never-hydrates')
      ok(never.v.green === false && never.v.reasons.some((r) => /hydrat/.test(r)), `a page that never hydrates is red (got ${JSON.stringify(never.v.reasons)})`)
    } finally { await browser.close(); server.closeAllConnections(); server.close() }
  }
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
  ok(/observeProdPage\(page, route\)/.test(spec) && !/waitUntil/.test(spec) && !/__pcCsp/.test(spec), 'the spec observes through the shared observeProdPage (hydration + settle), never its own load-time read')
  ok(/test\.skip\(\s*!process\.env\.PANDACORP_PROD_SMOKE/.test(spec) && /BLESSED/.test(spec) && /prod-samples\.json/.test(spec) && /securitypolicyviolation/.test(readFileSync(path.join(TEMPLATE, 'e2e/_prod-smoke.ts'), 'utf8')), 'the spec skips outside the prod smoke, visits the blessed routes + the dynamic samples, and (through its observer) listens for CSP violation events')
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
