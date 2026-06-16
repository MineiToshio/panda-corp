# WO-01-002 — `readProfile` (presence + parse) — Review

**Reviewer:** Opus 4.8 (DR-015, different model family from the sonnet/haiku implementer)
**Date:** 2026-06-16
**Verdict:** APPROVED

## Evidence re-run from clean (not trusting the self-report)

| Gate | Result |
|---|---|
| `pnpm biome check .` | exit 0 — 2 **warnings** in `lib/profile.test.ts` (noNonNullAssertion, lines 117 & 129); no errors |
| `pnpm tsc --noEmit` | exit 0 — no type errors |
| `pnpm vitest run` (full suite) | 340 tests passed (15 files); `lib/profile.test.ts` 23/23 |
| `bash .pandacorp/verify.sh` | `✅ all gates green` — exit 0 |

Self-report claimed 236 tests; the suite has since grown to 340 (other WOs landed) — re-running was the right call. All green.

## Adversarial tests added (DR-015) — `lib/profile.adversarial.test.ts` (16 tests, all green)

Edge cases the implementer did NOT cover, derived from the contract and the fail-soft EARS criteria:
- Wrong-typed scalars: `name` as number / null / boolean, `goals` as a mapping → all correctly dropped (stay `undefined`, never coerced or fabricated).
- Array contract abuse: `interests` as a single string, `assets` mixing strings+numbers, array with `null` → rejected wholesale; `assets: []` kept as valid empty `string[]`.
- snake_case mapping: bare `projectsPath` in YAML is NOT honored; `projects_path` + `projectsPath` together → snake_case wins; numeric `projects_path` → dropped.
- Fail-soft: directory path (EISDIR) and empty-string path → no throw, typed result.
- `__proto__` mapping in frontmatter → no prototype pollution, `name` still parses.
- CRLF line endings parse; UTF-8 BOM → no throw, `body` stays a string.

## Mutation testing (DR-016) — tests are NOT decorative

Weakened two type guards in `lib/profile.ts` (`interests` array-of-strings check → any array; `name` typeof-string → truthy). 3 tests failed against the mutant; original code restores green. The guards are load-bearing and the suite detects their removal.

## Findings

### Minor (non-blocking)
- **M1 — `lib/profile.test.ts:117,129`**: two `noNonNullAssertion` lint **warnings** (`result.profile.interests!` / `assets!`). They do not fail verify.sh (biome treats them as warnings), but AGENTS.md forbids non-null assertions as a quality standard. Concrete fix: guard with an explicit narrow instead of `!`, e.g.
  ```ts
  const interests = result.profile.interests ?? [];
  for (const item of interests) expect(typeof item).toBe("string");
  ```
  This is the implementer's own test file; consider tightening on the next touch. Not a blocker because the production code (`lib/profile.ts`) is clean and the behavior is verified.

## Lenses
- **Correctness:** Meets AC-01-001.1 (absent → `{ present: false }`) and AC-01-002.1 (present → parsed name/goals/interests/assets/projectsPath/body). Fail-soft on malformed frontmatter and empty file confirmed. Type guards robust under adversarial input and mutation.
- **Security:** Read-only (`fs.readFileSync` only — verified by the mtime invariant test and the FRESH no-create test). No prototype pollution. No injection surface (pure local read). No new dependencies (gray-matter already present).
- **Quality:** Scope confined to `lib/profile.ts` + its test + `docs/api.md`. No duplication; call-time `resolveFactoryRoot()` is the correct isolation pattern. No hardcoded magic. Single minor lint warning in the test file (M1).
