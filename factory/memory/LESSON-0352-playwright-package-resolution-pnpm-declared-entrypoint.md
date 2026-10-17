---
id: LESSON-0352
type: gotcha
domain: testing
tags: [playwright, pnpm, module-resolution, package-manager]
context: launching Playwright/Chromium programmatically (not via the `playwright` CLI) inside a pnpm-managed project for ad hoc QA of a prototype
trigger: use this when `require("playwright")` (or an equivalent direct import) fails to resolve inside a pnpm project even though Playwright is installed
source: "factory/memory/_inbox.md agent-inferred note — Mission Control, 2026-10-16: require(\"playwright\") from package.json failed although @playwright/test is installed; require(\"@playwright/test\").chromium launched Chromium 149 successfully"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
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
redundant copy of the browser-automation package or assuming transitive resolution will work.
