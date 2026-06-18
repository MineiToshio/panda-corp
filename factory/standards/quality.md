# Quality and testing

## Gates (verified by scripts/CI, never by the agent's self-report)
Validation order before considering something done:
1. **Tests** (unit + integration) green.
2. **Type-check** strict with no errors (`tsc --noEmit` / `mypy --strict`).
3. **Lint + format** with no errors or new warnings (the stack's linter/formatter).
4. **Build** clean where applicable.

These commands live in the project's `.pandacorp/verify.sh` and the factory's `Stop` hook requires them: an agent cannot declare "done" if `verify.sh` fails.

**Gate hardening (DR-019):** `verify.sh` is **fail-closed** (any ambiguous or unparseable output = failure, never "passes by default"), runs in a clean environment, **does not expose to the generating agent the exact names of the tests** it must pass nor the fixtures, and emits **actionable messages** (which rule failed and why — rule-based feedback is the most effective for an agent to self-correct; "LLM-as-judge" is not reliable).

## Adversarial and independent verification (DR-015)
- The **generator and verifier cannot be the same model**: an LLM's errors cluster and its tests inherit its blind spots. The `reviewer` (opus, ideally from a different family than the generator) **re-runs** all the evidence and writes **adversarial and edge-case tests that the implementer didn't see**.
- The tests are anchored in **human sources** —EARS criteria of the FRDs and real bugs from `.pandacorp/comms/progress.md`—, not in the model's imagination.

## Mutation and property-based testing (DR-016)
- **Mutation testing** (Stryker in TS / mutmut in Python) detects decorative tests: if mutating the code doesn't break any test, the test proves nothing. Run **at the close of each FRD milestone** and in CI toward main (not at every Stop gate — it is expensive). Target mutation score ≥60% on new business logic.
- **Property-based** (fast-check / hypothesis) for logic with invariants (parsers, calculations, serialization): generates hundreds of cases a human wouldn't enumerate.

## Testing strategy (by risk, not by blind %)
- **Unit**: business logic, calculations, validation, parsers.
- **Integration**: Server Actions + data layer + rules together; third-party integrations.
- **E2E** (Playwright or equivalent): only the MVP's critical flows (auth, core flow, payments), with `data-testid` selectors (never CSS classes).
- **Do not** test trivial markup or exact copy assertions (use ARIA roles).
- **Branch** coverage over business logic (target ≥80% on new code).

## E2E hygiene
- Tests that create data clean it up in their teardown (deterministic keys). Never leave test data in a shared DB.

## TDD per work order
- Tests of the acceptance criteria first (RED) → minimal implementation (GREEN) → refactor. Max 3 repair attempts per subtask, then escalate.

## Accessibility and performance (CI gates, web)
- **a11y-gate**: **Biome's `a11y` rule group** (enabled by default — Biome is the standard linter) **+ axe-core over the REAL built pages** (not just the design mockups). Covers ~30-40% of WCAG 2.2 AA → automatic gate **+ `reviewer` check** (focus, target-size 2.5.8 and contrast are not detected by the linter). Don't promise full determinism.
- **performance-gate**: see [performance.md](performance.md) (Lighthouse-CI as a lab proxy, block-on-main).

## CI
- GitHub Actions on every PR: type-check + lint + tests (in parallel). E2E on PRs toward main. Protected branches; merge only with CI green.
- Toward main (not on every PR, for cost): **mutation testing** + **agentic OWASP audit** (DR-017) + generation of **changelog and ADRs** (DR-018, living documentation). The CI gates are independent of the agent: the model never marks its own checks.
