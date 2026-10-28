---
description: Definition of done — green quality gates — plus TDD and risk-based test coverage.
applies_when: always
globs: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "e2e/**"]
source: Pandacorp standard — quality
---

# Quality & testing

## Definition of done
- Nothing is "done" until `verify.sh`/CI is green — never by self-assessment. The gate already enforces tests, strict typecheck, lint/format, build, dead code (knip), circular deps (madge), test hygiene, the browser gates (Preview Smoke DR-055 · Visual-Fidelity DR-056 · Responsive DR-074 · Shell-Presence DR-075) and no residual `[NEEDS CLARIFICATION]` (DR-100) — not repeated here; fix the gate's message, don't argue with it.
- **Fail-closed**: a MISSING harness (smoke/visual/responsive) is a RED gate, not a skip — static checks passing while the page is broken is the failure this closes.
- A missing visual baseline on a genuinely-new route = "bless at the FRD gate", not a failure.

## Numeric bars & test ownership
- **Mutation score ≥ 60%** on new business logic (Stryker/mutmut) — at FRD milestone close and toward main, not every gate.
- **Branch coverage ≥ 80%** on new business-logic code (coverage by risk, not blanket %).
- **Max 3 repair attempts** per subtask, then escalate — never loop on a red gate.
- The implementer may NOT edit blessed baselines or the reviewer-authored acceptance suite (DR-080) — the code's author cannot shape the test that judges it.

## Fail-loud read boundaries (DR-078)
- A reader/parser of an internal artifact (markdown table, `status.yaml`, ndjson, config) distinguishes "source is empty" from "couldn't interpret it": it returns a typed result OR throws/returns an explicit error — never a silent `[]`/`null` on an unrecognised shape. The caller renders an error state, never an empty list.
- Test each reader against a REAL production-shaped fixture (including a foreign-language / gitignored variant) AND a malformed one that must fail LOUD. Parser invariants → property-based (fast-check).
- A never-empty collection is typed `NonEmpty` (or carries an explicit empty variant with a reason) so "empty" is deliberate, not a fallthrough.

## TDD & coverage strategy
- Write the acceptance-criteria tests BEFORE implementing (RED → GREEN → refactor); a behavior is verified by a test that fails without the change and passes with it.
- **Fast-lane exception (DR-126):** the build engine's fast-lane builder writes a work order's code and tests together and runs them once (RED-first not required); the AC-citation floor, preserved tests, one behaviour e2e spec per UI feature and the engine's full gate still bound it. Everywhere else, RED-first stands.
- Don't chase 100%: per change, decide explicitly which of unit/integration/e2e it warrants; prioritize auth, payments, core flows, anything with money or data integrity.
- Update tests when behavior changes — stale tests are worse than none.

## Test discipline
- Test observable behavior through the public API, not implementation details — a pure refactor must not require touching the test.
- Component tests query by accessible role/name (`getByRole`); `getByTestId` is a last resort; `container`/`querySelector` is banned. (E2E may use `data-testid`.)
- Every test passes in isolation and in any order; no shared mutable state; reset mocks (`restoreMocks: true`); CI runs randomized order so coupling fails loudly.
- Mock only true external boundaries (network, time, third-party SDKs) — don't mock what you own; prefer faking the network (MSW).
- Fixtures via builders/factories in `src/test/` (defaults + override what the test cares about) — no duplicated literal fixtures.
- Snapshots: only small, stable, human-reviewable output (`toMatchInlineSnapshot`); no whole-component snapshots; never blind `-u`.
- No hard waits: Playwright auto-waiting + web-first assertions (never `waitForTimeout`); RTL puts only assertions inside `waitFor`.
- Placement (`_tests/`, `src/test/`, `e2e/`) → see `project-structure`.

## Test database: native, local, zero residue (DR-140, INFRA-9/10)
- Tests that need a database (unit/integration, `verify.sh`, e2e) use ONLY the project's native Homebrew PostgreSQL on `127.0.0.1:<base+2>` (started by `pnpm db:test:up`, URL in `TEST_DATABASE_URL`). Never Docker, never a cloud DB (Neon dev/prod is for running the app, not for tests). A test URL with a non-loopback host fails loud before connecting.
- Zero residue: per-run/per-worker databases (`<slug>_test_*`) are dropped at teardown, per-test transactions are rolled back, and setup sweeps stale `<slug>_test_*` databases left by crashed runs. Between runs only the empty template remains.
- `pnpm db:test:check-clean` runs in `verify.sh` after the DB-backed suites and FAILS the gate on any leftover test database or non-empty template table. Never delete the check to get green.

## E2E & independent verification
- E2E only on critical flows; select by `data-testid`, not brittle text/CSS; leave NO persistent test data (deterministic teardown or an ephemeral DB).
- **Hydration-safe e2e (web UI).** Every e2e spec that fills or submits a form starts with `gotoHydrated(page, path)` from `e2e/_hydration.ts` — never a bare `page.goto` followed by `fill`. `goto` resolves before React hydrates, so typed input reaches only the DOM and the submit falls back to a native GET (a flaky test, and form data in the URL). The helper waits on the page's FORM (not `main`); a product that needs a stricter signal sets `data-hydrated` on the form or an ancestor from a client effect and the helper honors it first.
- **Keep ONE pre-hydration privacy test per form-bearing product.** With `test.use({ javaScriptEnabled: false })` call `assertPreHydrationSubmitIsInert(page, path, { field })` from `e2e/_hydration.ts`: a native submit before hydration must send nothing and leave the URL unchanged (an unguarded client-handled form leaks what was typed, a name, an email, a message, into the URL and the server log). Guard the form in the product (`method="dialog"` for a client-handled form, or a Server Action that posts) — never delete the test to make it green. The template's `e2e/hydration.spec.ts` proves the helper itself goes RED on an unguarded fixture.
- Generator ≠ verifier: re-run the evidence; never trust a claim of "tests pass".

## Owner-attended live attempts
- A gate only the owner can run (a production release, a live certification canary, a "try it now") is the scarcest, most expensive gate; repeated failed live attempts are themselves a release-gate failure.
- Before asking the owner to consume another: enumerate the COMPLETE matrix of prior failures of that attempt class; red-team the current fix against EACH row (why can't it recur?); and prove the rehearsal exercises the real boundary — a mock speaks the parser's exact dialect by construction, so keep ≥1 non-mocked element in the pre-flight and prove the negative corpus still goes RED.

## Batch integration of finished branches (DR-141, BUILD-4)
- **MUST:** when several independently verified finished branches are waiting, assemble them in one integration worktree/branch from current `main`; record source SHAs, owning changes and green branch evidence. Merge each recorded tip with `git merge --squash <sha>` and commit with its source SHA/change; resolve conflicts before committing. Do not run the full gate between source commits. Squash keeps conflict resolutions through the existing queue's plain rebase.
- Run `bash .pandacorp/merge-queue.sh` **ONCE on the combined branch**, never per source branch. A single finished change still lands alone. Branch verification and per-FRD reviews remain required; unfinished work stays out.
- On red: attribute the failure to its owning change, repair only that defect, commit and re-run the full queue once on the combined result. Further retries require a fresh observed failure within the repair budget. Unknown attribution/conflict/busy main is an immediate DR-099 hand-back; never mask or sweep unrelated reds.
- **Production gates unchanged:** explicit owner order covering the selected batch before production merge/push; `PANDACORP_OWNER_RELEASE_OK=1` only for that landing (DR-138). No approval inferred from grouping work. A later authorized retry after exit 21 or an advanced main keeps the queue’s existing full recheck; record it separately, never per source.
- Preserve source branches and the source-to-integration mapping; squashed sources are not ancestors of main. Do not run the queue again on each source after batch success, or force-delete source branches based on that success.
- **Verification (landing-session checklist, review-only):** source SHA/green evidence and combined commits are present; queue logs show exactly one full gate before repairs, every later pass linked to an observed red/scoped fix or the existing queue’s exit-21/advanced-main safety retry. A per-source full integration-gate loop fails the checklist. Canonical: `build-orchestration.md`, Parallel manual sessions §5; executable rehearsal: factory `test-batch-integration.sh` (not proof of live-session compliance).
