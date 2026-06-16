# Review — WO-15-001 (`lib/plugin-sync` readers)

**Verdict: APPROVED** (cycle 2 — the cycle-1 blocking finding B1 is fixed and verified).
Reviewer: Opus (different model family from the implementer — DR-015).
Date: 2026-06-16.

## Evidence re-run (cycle 2, not trusting the self-report)

| Gate | Result |
|---|---|
| `biome check lib/plugin-sync.ts lib/plugin-sync.test.ts lib/plugin-sync.adversarial.test.ts` | clean (0 errors) |
| `tsc --noEmit` (project-wide) | clean (exit 0) |
| `vitest run lib/plugin-sync.test.ts` | 32/32 green |
| Reviewer adversarial suite round 1 (`lib/plugin-sync.adversarial.test.ts`, 15 tests) | 15/15 green (the cycle-1 FAIL is now fixed) |
| Reviewer adversarial suite round 2 (`lib/plugin-sync.adversarial2.test.ts`, 6 tests) | 6/6 green |
| **WO-15-001 scope total** | **53/53 green** |
| Mutation testing (DR-016) — 4 probes | 3 killed, 1 equivalent mutant (see below) |
| Full suite | 2 failures, both FRD-12 `rate.adversarial.test.ts` (out of scope), plugin-sync fully isolated |

## Cycle-1 finding B1 — RESOLVED

`extractSha` (`lib/plugin-sync.ts:97-106`) now returns `sha.trim()` (commit `d732d74`).
The whitespace/newline no longer leaks into the SHA, so the WO-15-002 verdict
`installedSha !== pluginHeadSha` cannot fire a false "installed plugin is behind" banner
on an identical commit. The implementer also added two SHA-hygiene regression tests to the
primary suite.

Verified by direct re-run and by mutation: reverting the fix (`return sha;`) turns **5 tests
red** across all three suites — the fix is genuinely covered, not decorative.

## Mutation testing (DR-016)

| Mutation | Outcome |
|---|---|
| `extractSha` returns `sha` (drop `.trim()`) | KILLED — 5 tests red |
| Drop empty-string guard (`sha.trim() === ""`) | KILLED — 2 tests red |
| `readPluginDirty` always returns `false` | KILLED — 4 tests red |
| Drop empty-array guard (`entry.length === 0`) | **Equivalent mutant** — `entry[0]` on `[]` is `undefined`, caught by the next object guard → returns `null` anyway. Observable behavior unchanged; the explicit guard is defensive redundancy. Not a coverage gap; the I2 contract (null, no throw) still holds. |

## What is solid (adversarial coverage that correctly passed)

- **SHA hygiene (the cycle-1 fix):** surrounding whitespace, `\r`-only pollution, tab+newline
  wrapping all return the clean 40-char SHA; internal whitespace is edge-trimmed only (not
  globally scrubbed into a different string — guards against a `.replace(/\s/g,"")` over-fix).
- **Malformed JSON shapes** degrade to `null` without throwing: literal-null entry,
  array-with-null-first, boolean/array `gitCommitSha`, root-as-array, missing `plugins` key,
  nested-array entry, empty array, JSON path that is a directory (EISDIR).
- **git probes:** `plugin/` deleted in a later commit still yields a SHA; factoryRoot is a file;
  bare repo (no worktree) degrades to `null`/`false`; 40-char no-newline output.
- **Scope correctness:** `readPluginDirty` is recursive into `plugin/` subdirs and correctly
  scoped — a sibling `plugins.txt` does NOT trigger dirty.
- **Cross-reader consistency:** installed SHA wrapped in whitespace == plugin HEAD SHA ⇒
  `installed === head` (the exact no-false-drift scenario WO-15-002 depends on).
- **Argument-injection hardening:** a `factoryRoot` of `--upload-pack=...` or `; rm -rf ...`
  is inert (arg-array `execFileSync`, no shell, no flag interpretation, no file created).

## Security / Quality lenses

- **Security:** clean. Read-only git verbs only (`git log`, `git status`), arg-array
  `execFileSync` (no shell, injection probe passed), no secrets, no new dependencies
  (blueprint §6 deliberately avoids `simple-git`).
- **Quality:** scope is tight (one new module + tests), no duplication, no `any`/`@ts-ignore`,
  defensive contract well-documented. No scope creep beyond WO-15-001 — `lib/plugin-sync.ts`
  imports nothing from FRD-12 or any other in-flight feature.

## Out-of-scope note (not blocking WO-15-001)

The global `verify.sh` is RED, but only from `app/_observability/selectors/rate.adversarial.test.ts`
(FRD-12 / WO-12-003 — a real prototype-pollution bug in `byAgent`: `constructor`/`toString`
keys are not own-property-counted). That is not WO-15-001's defect. WO-15-001 in isolation is
fully green. The DoD line "`.pandacorp/verify.sh` green" cannot be literally satisfied by this
WO alone until the FRD-12 owner fixes `rate.ts`; flagging for the orchestrator.

## Resolution

Cycle 2 of max 2. Cycle-1 blocking finding fixed and mutation-verified. No new blocking or
important findings. **APPROVED.**
