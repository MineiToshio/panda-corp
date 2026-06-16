# WO-04-002 review — `lib/docs.ts` comms readers (`readActivityLog`, `readDecisions`)

**Reviewer:** opus (different model from the sonnet/haiku implementer — DR-015)
**Date:** 2026-06-16
**Verdict: REJECTED** (1 important finding; 1 blocking-class regression in test coverage)

## Evidence re-run (not trusted from self-report)

| Gate | Command | Result |
|---|---|---|
| WO own tests | `npx vitest run lib/docs.wo04002.test.ts` | 74 passed, 0 failed ✓ (matches self-report) |
| WO own lint | `npx biome check lib/docs.ts lib/docs.wo04002.test.ts` | clean ✓ |
| WO own typecheck | `npx tsc --noEmit` (docs files) | no errors in `lib/docs.ts` ✓ |
| Global `verify.sh` | biome `.` / tsc `.` | fails — **all failures in other WOs** (FRD-04/05 UI components `wo-progress.tsx`, `wo-empty`, `wo-frd-filter`, `work-orders.ts`). Confirms the self-report's BLOCKED note: WO-04-002 is not the cause. |

So the implementer's self-report is accurate. The blocker is genuinely out of scope.

## Findings

### Important — blank/whitespace decision title produces a phantom DecisionPoint (`lib/docs.ts:586`, `:598-607`)
`readDecisions` heading regex is `/^##\s+(OPEN|CLOSED|RESOLVED):\s*(.+)/i`. For a heading
with only trailing whitespace after the colon — `## OPEN:    ` — `(.+)` matches the space,
`headingMatch[2].trim()` becomes `""`, and `flush()` (guard: `currentTitle !== null && currentStatus !== null`)
pushes `{ title: "", resolved: false }`.

Impact: the Summary tab (WO-04-005, REQ-04-004) would render an **empty highlighted decision card**
and the pending count `filter(!resolved).length` is **inflated by one**. The `## OPEN:` case (no
text at all) is correctly rejected because `(.+)` needs ≥1 char — but the trailing-whitespace
variant slips through. Hand-edited Spanish `decisions.md` from the `decide` skill makes a stray
trailing space plausible.

**Concrete fix (production — implementer):** in `flush()`, require a non-empty title:
```ts
if (currentTitle !== null && currentTitle.trim().length > 0 && currentStatus !== null) { ... }
```
Caught by my adversarial test `lib/docs.wo04002.reviewer.test.ts` →
"does not produce a DecisionPoint when the title is only whitespace" (currently RED).

### Blocking (coverage) — DR-015 edge gap proven by adversarial tests
The 74 implementer tests never exercised: CRLF endings, non-dash bullets, recommendation
scoping/bleed, `##OPEN:`/`### OPEN:` heading robustness, lowercase status, symlinked comms files,
or **empty/whitespace titles**. I added `lib/docs.wo04002.reviewer.test.ts` (13 tests). 12 pass —
the code is genuinely robust on most edges (good). The 1 failing test is the bug above. A WO is not
done with a red acceptance-derived test against its own behavior.

### Minor — none. Read-only invariant, traversal-safety (no traversal possible: fixed paths), no
`any`/`@ts-ignore`, no secrets, no scope creep (only `lib/docs.ts` + its tests touched), no new deps.

## What's good (don't lose it)
- Fail-soft on every input (absent file / dir / project / empty string / unreadable) — verified.
- Genuine arrays, finite counts, no vacuous entries — B1'/I2/I3 regressions held under my probes.
- CRLF, non-dash bullets, recommendation scoping, heading-level/glued-hash robustness, case-insensitive
  status, `RESOLVED`, symlink read-only — all PASS under adversarial probing.

## Path to approval (cycle 1 of 2)
1. Add the empty-title guard in `flush()` (`lib/docs.ts`).
2. Re-run `npx vitest run lib/docs.wo04002.test.ts lib/docs.wo04002.reviewer.test.ts` → all green.
3. (Independent) the global `verify.sh` blocker stays owned by WO-04-003 / WO-05-001 / WO-17-001.
