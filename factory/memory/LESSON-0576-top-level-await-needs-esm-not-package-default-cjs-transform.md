---
id: LESSON-0576
type: gotcha
domain: tooling
tags: [node, esm, cjs, esbuild, tsx, top-level-await, package-json]
context: "running a standalone TypeScript ops script that uses top-level `await` via `pnpm exec tsx <file>.ts` (or any esbuild-based TS runner), in a repo whose root package.json has no type: module"
trigger: use this when a `tsx`/esbuild-run TypeScript script using top-level `await` fails with an esbuild CJS-transform error, even though the same script works fine when imported as a module elsewhere
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-30 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-31
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0453]
---

**Situation:** funko-tracker's `scripts/ops/catalogRelease.ts` and `catalogSqlPrepare.ts` use top-level
`await`. The root `package.json` has no `"type": "module"` field, so esbuild (via `tsx`) resolves the
script as CommonJS and transforms it toward a CJS output target, which cannot emit a top-level `await`
(illegal in CJS) — `pnpm exec tsx <file>.ts` failed with an esbuild transform error.

**Lesson:** whether a TS/JS file is treated as ESM or CJS by an esbuild-based runner is NOT decided by
the file's own content — using `await` at the top level is itself a strong ESM-only signal, but the
runner still decides the target from the nearest `package.json`'s `"type"` field (or the file's own
extension). A script that needs top-level await while sitting under a CJS-typed package silently gets
the wrong transform target, and the reported error (a generic esbuild CJS-transform failure) doesn't
obviously point back at the missing `"type": "module"`.

**Apply next time:** a standalone script that needs top-level await needs either its own `.mts`/`.mjs`
extension (forces ESM regardless of `package.json`) or the nearest `package.json` to declare
`"type": "module"` — don't try to fix this by changing runner flags. When isolating the script into a
separate run-contained harness (so it won't force the whole repo to ESM), make a byte-identical temporary
`.mts` copy of the original (verify with `cmp`), run that, then delete the copy — never edit the `"type"`
field of a shared root `package.json` just to unblock one script.
