---
id: LESSON-0453
type: gotcha
domain: tooling
tags: [node, esm, ts-loader, extensionless-imports, wrapper-script]
context: running a TypeScript-authored Node script that uses extensionless relative imports (`import "./foo"` resolving to `foo.ts`)
trigger: use this when invoking a `.mjs`/`.ts` Node script directly with plain `node` and it throws `ERR_MODULE_NOT_FOUND` on an extensionless relative import
source: "factory/memory/_inbox.md 2026-10-20 (agent-inferred) — mission-control/scripts/navigation/identities.mjs invoked directly, fails under plain node"
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** `mission-control/scripts/navigation/identities.mjs` fails under plain `node
scripts/navigation/identities.mjs` with `ERR_MODULE_NOT_FOUND`, because it (or a module it imports)
resolves extensionless relative imports expecting the repo's custom ts-loader (`--loader
.../ts-loader.mjs`) to add `.ts` resolution — vanilla Node ESM resolution has no such fallback. The
project already ships a wrapper, `plugin/scripts/navigation-identities.sh`, which `cd`s to the right
directory and runs `node --loader ./scripts/read-model/ts-loader.mjs ./scripts/navigation/identities.mjs`.

**Lesson:** when a script's "real" invocation requires a non-default Node flag (a custom loader, specific
cwd, env vars) to resolve its own imports, that requirement is invisible from the bare script path — an
agent that finds the `.mjs` file and runs it with plain `node` gets a confusing module-resolution error
that looks like a missing-dependency bug, not a missing-flag one.

**Apply next time:** before running any `.mjs`/`.ts` script directly, check for a sibling wrapper script
(same basename, `.sh`, usually under `plugin/scripts/`) that is the project's documented entry point —
prefer it over a bare `node <file>.mjs` invocation, especially for scripts under a `scripts/` tree that use
extensionless imports.
