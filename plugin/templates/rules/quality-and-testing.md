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
- **No dead code** (a `knip` pass finds no new unused files/exports/deps) — see `clean-code`.
- **Preview Smoke Gate green (any UI change) — the app actually renders.** A browser smoke (Playwright) loads each affected route and the change is **not done** if a route throws a console error / uncaught exception, returns non-2xx, or renders blank / an error boundary. **Fail-closed: a missing smoke harness is a RED gate, not a skip** — static checks (lint/type/unit) passing while the page is broken is the failure this closes. (DR-055)

A change with red tests, type errors, lint errors **or a route that errors/blank-renders in the browser** is **not done**, no exceptions.

## Fail-loud read boundaries (DR-078)
A reader/parser of an internal artifact (a markdown table, `status.yaml`, an ndjson event stream, a config/portfolio file) MUST distinguish **"the source is empty"** from **"I could not interpret the source"** — returning `[]`/`null` on a shape it doesn't recognise is a silent failure that passes every gate while half the UI renders dark.
- **Parse, don't validate**: the reader returns a typed result OR **throws / returns an explicit error** on an unparseable shape; the caller renders an *error state*, never an empty list.
- **Test each reader against a REAL fixture — the actual shape it meets in production, including a foreign-language / gitignored variant — AND a malformed one.** The malformed fixture must make the reader **fail loud**, not return empty. Parser invariants → property-based (fast-check).
- A collection that is never legitimately empty is typed `NonEmpty` (or carries an explicit empty-variant **with a reason**), so "empty" is a deliberate state, not a fallthrough.

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

## Test discipline
- **Test observable behavior through the public API**, not implementation details (internal state, private methods, CSS classes). A pure refactor must not require touching the test.
- **Component tests query by accessible role/name** (`getByRole`); `getByTestId` is a last-resort fallback and `container`/`querySelector` is banned. (E2E may use `data-testid`.) (Biome covers generic test hygiene via the `test` domain — `noFocusedTests`/`noSkippedTests`; the Testing-Library-specific query/async rules are the optional ESLint escape hatch, the one case we add a minimal ESLint pass.)
- **Every test passes in isolation and in any order**; no shared mutable test state; reset mocks between tests (`restoreMocks: true`). CI runs in randomized order so coupling fails loudly.
- **Mock only true external boundaries** (network, time, third-party SDKs) — don't mock what you own; prefer faking the network (MSW).
- **Fixtures via builders/factories** (sensible defaults + override only what the test cares about) in `src/test/` — no duplicated literal fixtures.
- **Snapshots**: only small, stable, human-reviewable output (`toMatchInlineSnapshot`); no whole-component snapshots; never blind `-u`.
- **No hard waits**: E2E uses Playwright auto-waiting + web-first assertions (`await expect(locator).toBeVisible()`), never `waitForTimeout`; RTL puts only assertions inside `waitFor`.

## End-to-end hygiene
- E2E only on **critical flows**; select elements by `data-testid`, not brittle text/CSS.
- E2E must **not leave persistent test data** behind — clean up in teardown (prefer deterministic cleanup keys) or use an isolated/ephemeral database.

## Independent verification
- The thing that verifies a change should not be the thing that produced it (generator ≠ verifier). Re-run the evidence; don't trust a claim of "tests pass."
