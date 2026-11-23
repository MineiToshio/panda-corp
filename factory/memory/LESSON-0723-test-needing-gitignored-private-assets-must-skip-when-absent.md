---
id: LESSON-0723
type: anti-pattern
domain: ci-testing
tags: [ci, fixtures, gitignored-assets, skipIf]
context: an automated test seeds its fixtures from a gitignored, locally-present-only private asset pack (e.g. real reference photos a CI runner never has)
trigger: "use this when a test's setup reads from a path under a gitignored local asset directory — before assuming CI will have it too"
source: "funko-tracker — .pandacorp/run/lessons.md note (CI `checks` red since 2026-11-06); confirmed live: the current `scripts/fidelity/_tests/e2eFixtureReset.test.ts` wraps its whole describe block in `describe.skipIf(!HAS_PRIVATE_PACK)`, gated on `existsSync('docs/design/prototype/assets/funko-ref/export-examples/cutouts')` — fixed in commit `14b9a0a2`"
provenance: agent-inferred
created: 2026-11-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0521]
---
**Situation:** a test seeded its fixtures from a private, gitignored asset pack that exists on the developer's machine (real product photos) but never on a CI runner. The test ran fine locally for weeks, then CI's `checks` job stayed red for 11 days (2026-11-06 through the fix) because the test unconditionally tried to read a directory that simply doesn't exist in that environment — a false "broken suite" signal that masked real failures behind constant noise.

**Lesson:** a gitignored, machine-local-only asset dependency is invisible to any other environment (CI, a fresh clone, a teammate's machine) by construction — a test built against it needs to KNOW it may not be there, not assume it always will be. "Works on my machine, red everywhere else, forever" is the predictable outcome of skipping that check.

**Apply next time:** any test whose setup reads from a gitignored private-asset directory must probe for that directory/pack's presence up front (`existsSync`) and self-skip the whole suite (`describe.skipIf(!hasPack)` / `it.skipIf`) when absent — never let the absence surface as a generic failure. Treat "private asset pack found" as a precondition, exactly like an environment variable or a service being up, and make the skip visible (a console note, not silence) so a maintainer can tell "correctly skipped" from "silently never ran."
