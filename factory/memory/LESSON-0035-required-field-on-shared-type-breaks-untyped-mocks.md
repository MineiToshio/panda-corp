---
id: LESSON-0035
type: gotcha
domain: typescript-testing
tags: [typescript, testing, mocks, fixtures, vitest, refactoring]
context: adding a new required field to a widely-shared TypeScript type/interface used across many test fixtures
trigger: use this when extending a widely-shared type with a new required field and the codebase has vi.fn()/jest.fn() mocks that return objects of that type without an explicit type annotation
source: "panda-corp Mission Control 2026-07-02 — Lesson type extension, .pandacorp/run/lessons.md"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** adding a new REQUIRED field to a shared type (`Lesson`) broke every literal test fixture
across 26 call sites — expected, `tsc` caught those immediately. But `vi.fn()` mocks returning objects of
that type **without an explicit type annotation** were NOT caught by `tsc`; they instead failed at
runtime when the code destructured the missing field.

**Lesson:** `tsc` only catches a missing-required-field defect where the literal is type-checked in
place. An untyped mock (`vi.fn().mockReturnValue({ ...partial object literal... })` with no generic/type
annotation on the mock) is inferred loosely and silently passes type-check while shipping an
incomplete object — the gap surfaces only as a runtime crash when the consuming code destructures the
new field.

**Apply next time:** when adding a required field to a widely-shared type, `grep` for `vi.fn()`/mock
factories returning that type (not just literal fixtures) and extend them too; consider annotating mock
factories with the return type explicitly (`vi.fn<() => Lesson>()` or equivalent) so future field
additions ARE caught by `tsc` instead of silently degrading to a runtime failure.
