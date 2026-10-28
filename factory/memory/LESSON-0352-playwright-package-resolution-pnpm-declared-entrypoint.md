---
id: LESSON-0352
type: gotcha
domain: testing
tags: [playwright, pnpm, module-resolution, package-manager]
context: launching Playwright/Chromium programmatically (not via the `playwright` CLI) inside a pnpm-managed project for ad hoc QA of a prototype
trigger: use this when `require("playwright")` (or an equivalent direct import) fails to resolve inside a pnpm project even though Playwright is installed
source: "factory/memory/_inbox.md agent-inferred note — Mission Control, 2026-10-16: require(\"playwright\") from package.json failed although @playwright/test is installed; require(\"@playwright/test\").chromium launched Chromium 149 successfully. Corroborated again on mission-control itself (2026-10-23, `.pandacorp/run/lessons.md`): the design skill's `freeze.mjs` fidelity orchestrator could not find Playwright under the project's pnpm-managed `node_modules` at all; set the `PLAYWRIGHT_MODULE` env var explicitly to `node_modules/.pnpm/playwright@<ver>/node_modules/playwright` (the package's real on-disk location inside pnpm's content-addressed store, not the top-level `node_modules/playwright` a flat/npm-style resolution would expect) to unblock it."
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0243]
---

**Situation:** a project declares `@playwright/test` as its dependency (not the bare `playwright` package).
Requiring the bare `playwright` package directly for an ad hoc QA script failed to resolve, because pnpm's
strict, non-flat `node_modules` only makes a package's OWN declared dependencies resolvable, not every
package that happens to be a transitive dependency of one of them. `require("@playwright/test").chromium`
resolved and launched correctly.

**Lesson:** under pnpm, "Playwright is installed" does not mean every Playwright-adjacent package name is
directly resolvable from arbitrary script code — only the package actually declared in `package.json` is
guaranteed reachable; a transitively-available package of the same ecosystem may or may not resolve
depending on pnpm's strict linking.

**Apply next time:** for ad hoc browser automation/QA in a pnpm project, `require`/`import` the package
ACTUALLY DECLARED in that project's `package.json` (e.g. `@playwright/test`'s `chromium`/`firefox`/`webkit`
export), not a same-ecosystem package assumed to be a dependency of it. If a specific entrypoint is needed,
resolve it explicitly (e.g. via an env var pointing at the module) rather than installing a second,
redundant copy of the browser-automation package or assuming transitive resolution will work. **When a
factory tool (e.g. the design skill's `freeze.mjs`) exposes a `PLAYWRIGHT_MODULE`-style override and can't
find Playwright under pnpm**, point it at the package's real pnpm store path —
`node_modules/.pnpm/playwright@<version>/node_modules/playwright` — rather than the flat
`node_modules/playwright` a non-pnpm resolution would expect; `ls node_modules/.pnpm | grep playwright` finds
the exact installed version first. (A related, distinct bug — `PLAYWRIGHT_MODULE` set to a directory being
rejected by one code path while another accepts it — is tracked separately at BL-0243; this lesson is the
pnpm-path-shape workaround, not a substitute for that fix.)
