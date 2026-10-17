---
id: LESSON-0357
type: gotcha
domain: testing
tags: [testing-library, playwright, typescript, vitest, typecheck]
context: writing a Testing Library `getByRole` query while mentally carrying over an option from Playwright's locator API
trigger: use this when writing or reviewing a Testing Library `getByRole` call and reaching for an `exact` option as if it were a Playwright locator
source: "factory/memory/_inbox.md agent-inferred note — Mission Control, 2026-10-16: a Portfolio spec test passed an `exact` option to Testing Library's `getByRole`, which Vitest transpiled and ran without a type error, even though the option doesn't exist on that API (spec-tab.test.tsx)"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a test passed `{ exact: true }` to Testing Library's `getByRole(role, { name })` call — an
option that belongs to Playwright's locator API, not Testing Library's, where a plain `name` string is
already matched exactly by default. Vitest transpiled and ran the test anyway (no type error surfaced at
test-run time), silently accepting an option the real type signature doesn't have.

**Lesson:** Vitest's default test execution does not validate TypeScript types — a call with an
API-incorrect option (borrowed from a sibling API with similar shape, like Playwright locators vs. Testing
Library queries) can pass transpilation and run green, masking a type error that only `tsc` would catch.

**Apply next time:** when matching a role query by name, use an anchored regex or a plain string (Testing
Library already matches exactly by default) rather than reaching for an `exact` option. More generally, run
the project's typecheck (`tsc --noEmit` or equivalent) as part of verifying any new/changed test file before
declaring it done — a green Vitest run alone does not prove the test file typechecks.
