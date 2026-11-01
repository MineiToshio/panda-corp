# Closing-logic mutation verification

Item 33, lane K. Source baseline: `977b9aa2`. Production behavior is unchanged.

## Reproduction and scope

From `mission-control/`, with Node >=22 and installed project dependencies:

```bash
bash scripts/mutation/run.sh
# Optionally rerun one module by a unique path fragment:
bash scripts/mutation/run.sh proposalSummary
pnpm exec vitest run --config scripts/mutation/vitest.config.ts
```

The launcher installs exact Stryker core/runner 10.1.1, Vitest 4.1.9 and TypeScript
5.9.3 into ignored `.mutation-cache/toolchain`, without changing the pnpm manifest,
lockfile or shared store. Stryker is an Apache-2.0 development tool; no package or
runtime bundle is added to the application. Separate processes run sequentially,
with one worker, and mutate copies of the sources. Reports are under
`reports/mutation/<source-path-with-__-separators>.{json,html}`. Do not enable `ignoreStatic` or remove
surviving/equivalent mutants to improve the score.

`stryker.config.mjs` enumerates the seventeen source files. The vocabulary scope is
only `WORK_ORDER_STACK_STATES`, not the pre-existing phase/color catalogue.
"Touched readers" includes the shared Spec/architecture artifact projections, FRD
reader, Fragua scene loader and open-change counter. The older general work-order
parser (only its export changed) and change-queue parser are outside
this closing-logic scope; their real-shaped boundary fixtures still run.

Stryker 10.1.1 emits zero mutants for the stack constant's `as const satisfies`
declaration (confirmed both with and without the line range). The launcher therefore
uses `scripts/mutation/stack-order.mjs`: seventeen explicit adjacent swaps, removals,
duplicates, reversal, empty and appended-state mutations, tested against copies of
the actual `stackOrder.test.ts`. The unchanged baseline must pass, and only an
assertion failure counts as a killed mutant; import/compile failures fail the run.
The ordering oracle is the approved prototype's `stackbar` in
`docs/design/prototype/prototype.js` and `docs/design/components.md` (reader `fail`
maps to presentation `blocked`). This campaign has a labeled JSON report and raw Vitest evidence, not a Stryker HTML
report. Empty module reports fail the score checker.

The module gate in `scripts/mutation/check-scores.mjs` applies **60% per file**.
The Stryker score is `(Killed + Timeout) / (Killed + Timeout + Survived + NoCoverage)`;
compile/runtime errors and ignored mutants are reported separately. The floor
canary passes at 60% and fails at 50%. No score is corrected for equivalence.

## Evidence and limitations

The broader related regression selection passed 488 tests in 66 files before
narrowing the mutation suite. The final focused suite passed 131 tests in 28 files, selected explicitly in
`scripts/mutation/vitest.config.ts`. TypeScript and the changed-file Biome/ESLint
checks passed. No full verification gate or screenshot baseline update ran.

Live read-only browser evidence used the existing server at `127.0.0.1:1987`:
Portafolio showed five named projects; selecting Misiones in Logros navigated to
`/achievements/missions` with its tab selected. Screenshots and raw mutation reports
are handed off in the lane-K scratch directory. This does not certify the other
lanes' later code or visual changes.

A preliminary combined run was interrupted without a score. An npm-exec attempt
was invalid: npm reused local TypeScript without exposing it to the temporary ESM
runner and resolved Vitest 5 as a peer. Only completed reports from the isolated,
pinned toolchain count below.

## Results

All seventeen modules pass the 60% floor. There are 1,188 generated mutants across
the sixteen Stryker campaigns and the explicit stack campaign. The score checker
compares each report's original source with the current file before accepting it.

| Module | Killed | Timeout | Survived | No coverage | Errors/ignored | Score |
|---|---:|---:|---:|---:|---:|---:|
| src/app/achievements/_utils/viewRules.ts | 115 | 0 | 13 | 2 | 0 | 88.46% |
| src/components/core/Chip/vocabulary.ts | 17 | 0 | 0 | 0 | 0 | 100.00% |
| src/components/modules/DataModelViewer/layout.ts | 59 | 33 | 23 | 5 | 0 | 76.67% |
| src/components/modules/DataModelViewer/useViewport.ts | 238 | 7 | 57 | 1 | 1 | 80.86% |
| src/lib/architecture/read-artifacts.ts | 42 | 0 | 4 | 0 | 0 | 91.30% |
| src/lib/changes/openChanges.ts | 40 | 0 | 4 | 0 | 0 | 90.91% |
| src/lib/fragua/scene-data.ts | 10 | 1 | 5 | 0 | 0 | 68.75% |
| src/lib/navigation/NavigationLink.tsx | 7 | 0 | 0 | 0 | 0 | 100.00% |
| src/lib/navigation/NavigationProvider.tsx | 40 | 0 | 9 | 3 | 0 | 76.92% |
| src/lib/navigation/history.ts | 31 | 0 | 8 | 0 | 0 | 79.49% |
| src/lib/navigation/useUrlState.ts | 31 | 4 | 8 | 2 | 0 | 77.78% |
| src/lib/pitch/proposalSummary.ts | 31 | 0 | 14 | 0 | 0 | 68.89% |
| src/lib/portfolio/displayName.ts | 8 | 0 | 2 | 0 | 0 | 80.00% |
| src/lib/portfolio/overview.ts | 82 | 0 | 31 | 1 | 0 | 71.93% |
| src/lib/spec/read-artifacts.ts | 23 | 0 | 0 | 0 | 0 | 100.00% |
| src/lib/spec/read-frds.ts | 60 | 0 | 20 | 0 | 0 | 75.00% |
| src/lib/work-orders/published.ts | 83 | 0 | 12 | 1 | 0 | 86.46% |

The stack row is the explicit seventeen-mutant campaign; all other rows are Stryker.
Published work orders were measured with the initial broader selection. Later
modules use the focused suite. No test or production change weakened an oracle.
Spec artifacts improved from 69.57% to 100% after two error-aggregation/fallback
tests. Architecture artifacts improved from 56.52% to 91.30% after three tests for
absence, failed bands and precedence of structured models over legacy prose.

Stryker counts timeouts as detected mutants. In particular, layout has 59 assertion
kills and 33 timeouts; its score must not be described as 92 assertion kills. The
viewport's one RuntimeError (mutant 217, line 158) is a Stryker error-serialization
crash, excluded by the standard score, not credited as a kill. Even counting that
error as undetected, the viewport remains above the floor (245/304 = 80.59%).

## Equivalent survivors

These are semantic classifications, not exclusions or adjusted scores. IDs are local
to the named module's report. Other survivors are retained as unclosed test gaps or
unproven equivalence; the full inventory is in the handed-off `survivors.json`.

| Module | Mutant IDs | Equivalence reason |
|---|---|---|
| published.ts | 42, 43 | Empty options or excerpt=true still bypass gray-matter's cache; only the unused excerpt changes, not the data read here. |
| published.ts | 60 | Membership in the string-only STATUSES array already rejects every non-string implementation status. |
| published.ts | 66 | A missing superseded property and false are both falsy; neither result has a reason, so the same order is parsed. |
| read-frds.ts | 21, 22, 47, 48 | Explicit options still bypass caching; excerpt extraction changes neither the data nor content consumed by this reader. |
| displayName.ts | 5 | split with limit 1 always provides its first string; the optional access cannot change the result. |
| displayName.ts | 7 | Matching only the final whitespace before the delimiter leaves earlier whitespace that trim removes. |
| history.ts | 38, 40 | The native History API's unused title argument does not change entry state or URL. |

## Integration handoff

No production source, component inventory, i18n, blessed baseline or reviewer test
was changed. Only test tooling, new tests and their canonical testing documentation
changed. The worktree's evidence does not certify code merged later from other lanes;
rerun affected campaigns when those production sources change. The decision-log and
punch-list entries are supplied to integration rather than written here.


## Changed files

The complete lane diff contains the following files (paths relative to mission-control):

- `.gitignore`
- `README.md`
- `docs/product/architecture.md`
- `docs/testing/mutation-closeout.md`
- `scripts/mutation/check-scores.mjs`
- `scripts/mutation/run-modules.mjs`
- `scripts/mutation/run.sh`
- `scripts/mutation/stack-order.mjs`
- `scripts/mutation/vitest.config.ts`
- `src/app/achievements/_utils/_tests/attributes.test.ts`
- `src/components/core/Chip/_tests/stackOrder.test.ts`
- `src/components/modules/DataModelViewer/_tests/viewport.mutation.test.tsx`
- `src/lib/architecture/_tests/artifact-boundaries.mutation.test.ts`
- `src/lib/navigation/_tests/NavigationLink.test.tsx`
- `src/lib/navigation/_tests/history.mutation.test.tsx`
- `src/lib/pitch/_tests/proposalSummary.test.ts`
- `src/lib/portfolio/_tests/displayName.test.ts`
- `src/lib/spec/_tests/read-frds.mutation.test.ts`
- `src/lib/work-orders/_tests/published.mutation.test.ts`
- `stryker.config.mjs`
- `tsconfig.json`
- `vitest.config.ts`
