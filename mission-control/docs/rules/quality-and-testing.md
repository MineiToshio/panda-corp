---
description: Definition of done — green quality gates — plus TDD and risk-based test coverage.
applies_when: always
globs: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "e2e/**"]
source: Pandacorp standard — quality
---

# Quality & testing

## Definition of done (the gate)
Nothing is "done" until **all** of these are green (enforced by `verify.sh` / CI, never by self-assessment):
- **Tests pass** (unit + integration; e2e on critical flows).
- **Type-check passes** strict, with zero errors.
- **Lint & format** report no errors.
- **Build is clean.**

A change with red tests, type errors or lint errors is **not done**, no exceptions.

## TDD per unit of work
- Write the acceptance-criteria tests **before** implementing (RED → GREEN → refactor).
- A behavior is verified by a test that fails without the change and passes with it.

## Risk-based coverage (not blanket %)
- Don't chase 100% coverage. For each change, **explicitly decide** which of unit / integration / e2e it warrants.
- **Prioritize business-critical behavior**: auth, payments, core domain flows, anything with money or data integrity.
- Update the tests when behavior changes — stale tests are worse than none.

## Where tests live (see `project-structure`)
- Unit/component tests go in a **`_tests/`** folder inside the component/feature folder — **never** loose `*.test.ts(x)` beside implementation files.
- Shared test infra (helpers, fixtures, factories, mocks) → `src/test/`. E2E (Playwright) → top-level `e2e/`, split by domain.

## End-to-end hygiene
- E2E only on **critical flows**; select elements by `data-testid`, not brittle text/CSS.
- E2E must **not leave persistent test data** behind — clean up in teardown (prefer deterministic cleanup keys) or use an isolated/ephemeral database.

## Independent verification
- The thing that verifies a change should not be the thing that produced it (generator ≠ verifier). Re-run the evidence; don't trust a claim of "tests pass."
