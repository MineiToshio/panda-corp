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

## E2E & independent verification
- E2E only on critical flows; select by `data-testid`, not brittle text/CSS; leave NO persistent test data (deterministic teardown or an ephemeral DB).
- Generator ≠ verifier: re-run the evidence; never trust a claim of "tests pass".
