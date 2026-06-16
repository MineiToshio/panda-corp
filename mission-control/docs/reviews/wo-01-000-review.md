# Review — WO-01-000 (Test fixtures + `PANDACORP_FACTORY_ROOT` harness)

**FRD:** FRD-01 (Data reading) · **Reviewer model:** Opus 4.8 (different family from the sonnet/haiku implementer, DR-015)
**Date:** 2026-06-16

## Verdict: APPROVED

The fixture tree, the `tests/fixtures/index.ts` harness and the implementer's
`index.test.ts` satisfy all three acceptance criteria. All gates re-run from clean
(not trusted from the self-report) are green for the WO scope, and the adversarial
suite I added confirms the tolerance fixtures are *real* (they make the actual
downstream parsers throw), not decorative.

## Evidence (re-run by the reviewer, not trusted from the report)

- `pnpm biome check` on WO files (`lib/config.*`, `tests/fixtures/`) → exit 0.
- `pnpm tsc --noEmit` (whole project) → exit 0.
- `pnpm vitest run lib/config.test.ts tests/fixtures/` → **73 passed** (55 implementer + 18 reviewer adversarial).
- Real-parser probe: `gray-matter` THROWS on `idea-malformed.md`; the `yaml` lib THROWS on `proj-b/status.yaml`. The "graceful skip" fixtures will actually exercise the catch branch of downstream readers.

### Note on the full-suite red

`pnpm vitest run` (whole repo) shows **1 failing test** in
`app/_design/tokens.test.ts` (`frd-13: ... motion.duration non-number`). This belongs
to **WO-13-001 / FRD-13**, is out of WO-01-000's scope, was modified by a different
review cycle (`docs/reviews/wo-13-001-review.md`), and is unrelated to these fixtures.
It does **not** block WO-01-000 but must be resolved under its own WO before the FRD-13
gate.

## Findings

### Blocking
None.

### Important
- **F1 — `project:` pointer base is ambiguous (fixture design).**
  `factory-full/factory/ideas/idea-in-pipeline.md` carries `project: "../projects/proj-a"`.
  That string does **not** resolve relative to the card's own dir (would be
  `factory/projects/proj-a`, which is absent); the real target is
  `factory-full/projects/proj-a` — i.e. it only resolves if the reader bases it on the
  **factory root**, not the card. The WO spec (line 24) even wrote `"../proj-a"`, a third
  variant. None of this breaks WO-01-000 (no reader exists yet), but the downstream
  **read-ideas / read-portfolio WO must pin the resolution base explicitly** and add a
  test for it, or the in-pipeline→project bridge will silently miss. I encoded this caveat
  as a comment + assertion in `tests/fixtures/index.adversarial.test.ts` so it is not lost.

### Minor
- **F2 — `withFactoryRoot` is not concurrency-safe (acceptable here).** It mutates the
  global `process.env.PANDACORP_FACTORY_ROOT`; two overlapping `Promise.all` invocations
  can capture a stale `prior` and cross-restore. It is documented as a synchronous wrapper
  and tests run serially, so this is informational only. If downstream readers are ever
  tested with parallel `withFactoryRoot`, switch to passing the root explicitly (the
  `resolveFactoryRoot(env, cwd)` signature already supports it) rather than env mutation.

## Lens summary

- **Correctness:** All AC met. Every tolerance case named in the WO exists and is genuinely
  malformed (verified against the real parsers). The five lifecycle statuses are present
  with no typos. `resolveFactoryRoot` handles empty/whitespace/relative/trailing-slash env.
- **Security:** N/A — read-only fixtures, no secrets, no network, no new dependencies
  (uses existing `gray-matter` / `yaml` / `vitest`). DR-001 clean.
- **Quality:** No scope creep — commit `7d089c7` added fixtures only; `lib/config.ts`
  predates this WO (scaffold commit `0d02d0f`). No production code touched (DoD met).
  Harness is small and well-documented.

## Reviewer-added tests
`mission-control/tests/fixtures/index.adversarial.test.ts` (18 tests): real-parser
tolerance (gray-matter/yaml actually throw), status-enum completeness, events mid-stream
malformed line + genuine `project`-key omission, `resolveFactoryRoot` input hardening,
`withFactoryRoot` empty-string-prior restoration + rejected-async restore, and a
git-tracked/determinism check (AC-01-000.1).
