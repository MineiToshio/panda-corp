# WO-12-004 — Timeline selector — Review

**Reviewer:** Opus 4.8 (1M) — DR-015 cross-model adversarial review (different family from the sonnet/haiku implementers).
**Traces:** AC-12-003.1 (REQ-12-003), AC-12-007.1 (REQ-12-007).
**Artifact under review:** `app/_observability/selectors/timeline.ts` (`toTimeline`, IF-12-timeline).

---

## Cycle 2 (2026-06-16) — Verdict: REJECTED

B1 (cycle 1) is fixed in `5a71d97` and verified green. But adversarial probing surfaced a **second blocking defect of the same class (B2)** in the code path the B1 fix did not touch.

### Evidence re-run from clean (cycle 2)

| Gate | Command | Result |
|---|---|---|
| Unit + adversarial + acceptance (implementer's) | `vitest run timeline.test.ts timeline.adversarial.test.ts timeline.acceptance.test.ts` | 147/147 PASS |
| Typecheck | `tsc --noEmit` | exit 0, clean |
| Lint (scope) | `biome check timeline.ts timeline.*.test.ts` | clean |
| B1 regression (cycle-1 adversarial) | `timeline.adversarial.test.ts` | PASS — B1 genuinely fixed |
| **Reviewer cycle-2 adversarial** | `vitest run timeline.review2.test.ts` | **10/12 — 2 FAIL (B2 below)** |

The implementer's self-report and B1 fix are accurate for everything they and cycle-1 covered. B2 is a new finding from a scenario neither saw.

### BLOCKING — B2: a no-task WO with one closed + one *open* direct action is reported finished
`app/_observability/selectors/timeline.ts:238-242` (`deriveWoRow`, the `childTaskRows.length === 0` branch) → `materialize` → `computeEndDurationStatus` (`:170-195`).

When a WO has **no task children**, `deriveWoRow` returns `materialize(woAcc)`. `computeEndDurationStatus` decides `running` solely from `woAcc.hasTerminal`. With two direct actions — one closed (`ok`) and one that never closes — `hasTerminal` is `true` (from the first), so the accumulator collapses both actions into a single "finished" verdict and **cannot tell that a second direct action stayed open**.

Reproduction (events under one no-task WO):
```
A 10:00  WO-MD  status=ok      (closed)
B 10:05  WO-MD                 (no status → open, never closes)
```
Actual WO-MD row (verified): `status:"ok"`, `end:"2026-06-16T10:00:00Z"`, `duration:0`. It reports the WO **finished at 10:00** while action B ran at 10:05.

Why blocking — this is exactly the B1 failure mode (a WO marked done while a child runs), just in the branch the B1 fix skipped:
- Violates **AC-12-003.1** — the timeline misrepresents the WO's true child state; the WO-12-007 toggle / `TimelineView` will render it "done".
- Violates **AC-12-007.1** — "time per work order" reports `0` and omits the 10:00→10:05 span of real activity.

Root cause: the B1 fix added per-child running-detection to the *task-children* branch only. The no-task branch keeps deriving the WO verdict from `woAcc`'s collapsed terminal stats, which lose per-action open/closed granularity.

Concrete fix: stop deriving the no-task WO verdict from collapsed `woAcc` stats. Track per-direct-action open/closed state (e.g. a `hasOpenDirectAction` flag on `woAcc`, set when a direct-action event has no terminal status), and in `deriveWoRow` treat the WO as `running` (end/duration null) whenever `hasOpenDirectAction` is true — symmetrically with the task-children branch. Then both branches share one rule: *any* open child (task or direct action) keeps the WO open.

Failing reviewer tests: `app/_observability/selectors/timeline.review2.test.ts` →
"review2 (B2 BLOCKING): no-task WO with one closed + one open direct action must stay running" (status + end/duration assertions).

### Resolved since cycle 1
- **B1 — FIXED** (`5a71d97`): the closed-task + open-direct-action case now keeps the WO running (cycle-1 adversarial test passes; review2 B1-inverse / merge-end / merge-fail cases pass).
- **M1 — now pinned**: `timeline.review2.test.ts` adds duration-clamp / never-negative assertions.

### Scope / security / quality (unchanged, still clean)
- Scope: selector stays at its declared path; no creep.
- Security: pure function, no I/O / env / Claude; no injection surface; the `rate.ts` prototype-pollution class does not apply here.
- Quality: strict typing, no `any`/`@ts-ignore`, anchors genuinely covered.

### Required to pass (cycle 3 — note: 2nd of max 2 rejection cycles)
1. Fix B2 so the no-task WO branch detects an open direct action and reports `running` / `end:null` / `duration:null`. Make `timeline.review2.test.ts` green without weakening it.
2. Keep B1 and all 147 existing tests green.
3. Re-run `vitest run app/_observability/selectors/timeline*.test.ts` + `tsc --noEmit` + `biome check` green before re-submitting. **This is the last rejection cycle allowed (DR-015 cap = 2); a third miss escalates to the owner.**

---

## Cycle 1 (2026-06-16) — Verdict: REJECTED

One **blocking** correctness finding: a work order is reported as finished while a child is still running. A blocking finding = REJECTED.

## Evidence re-run from clean (not trusting the self-report)

| Gate | Command | Result |
|---|---|---|
| Unit tests (implementer's) | `vitest run app/_observability/selectors/timeline.test.ts` | 95/95 PASS |
| Typecheck | `tsc --noEmit` | exit 0, clean |
| Lint (scope) | `biome check timeline.ts timeline.test.ts` | clean, 0 findings |
| Adversarial (reviewer) | `vitest run timeline.adversarial.test.ts` | 14/15 — **1 FAIL** (blocking bug below) |
| Mutation — fail-propagation | drop `acc.anyFail = true` | KILLED (3 tests) — good |
| Mutation — WO running-propagation | `anyRunning = false` | KILLED (3 tests) — good |
| Mutation — duration clamp | drop `Math.max(0, delta)` | **SURVIVED** — clamp untested (minor) |

The implementer's self-report ("95 tests RED→GREEN, green") is accurate **for the cases they wrote**. The 95 tests are not decorative (two mutants killed). But the suite has a hole that hides a real defect.

Out-of-scope pre-existing failures confirmed and excluded: `rate.test.ts` / `rate.adversarial.test.ts` (WO-12-003, different agent — see `.pandacorp/comms/progress.md`). Not attributable to WO-12-004.

## Findings

### BLOCKING — B1: A WO with a closed task + a later/running direct action is reported as finished
`app/_observability/selectors/timeline.ts:222-291` (`deriveWoRow`).

When a WO has at least one task child, `deriveWoRow` takes the `childTaskRows.length > 0` branch and derives the WO's `status` / `end` / `duration` **exclusively from child task rows**. It discards the WO accumulator's direct-action terminal stats (`woAcc.hasTerminal`, `woAcc.maxTerminalMs`, `woAcc.anyFail`) that `accumulateEvent` populated at line 388 for `workOrder`-only events (no `task`).

Reproduction (events under one WO):
```
Start    10:00  WO-MIX  t1
End      10:05  WO-MIX  t1  status=ok
DirectWork 10:10 WO-MIX     (no task, no status → running)
```
Actual WO-MIX row: `status:"ok"`, `end:"10:05"`, `duration:300000` — i.e. **finished at 10:05**, while the `DirectWork` action child is `status:"running"` at 10:10.

Why it's blocking:
- Violates **AC-12-003.1** — the timeline is meant to show WO→task→action with their true parent-child state; a WO marked finished while a child runs is incorrect data the UI (`TimelineView`, WO-12-007 toggle) will render as "done".
- Violates **AC-12-007.1** — "time per work order" omits the 10:05→10:10 span of real activity; the reported WO duration is wrong.

Concrete fix: in `deriveWoRow`, merge the WO accumulator's own direct-action stats with the child-task stats instead of branching exclusively on tasks. The WO is `running` if **any** task child is running **or** `woAcc` saw a non-terminal direct action after its last terminal (i.e. a direct action with no terminal status exists). The WO `end` must be the max terminal `at` across **both** child task ends **and** `woAcc.maxTerminalAt`; and `running` whenever a direct-action child has no terminal close. Add a test for the mixed case (closed task + open direct action, and the inverse: open task + closed direct action).

Failing reviewer test: `app/_observability/selectors/timeline.adversarial.test.ts` →
"adversarial: WO with a closed task AND a later open direct action > chronological invariant…".

### MINOR — M1: the `Math.max(0, delta)` negative-duration clamp is untested
`timeline.ts:173`, `:265`, `:275`. The "duration never negative" guarantee documented in the header survives mutation (removing the clamp leaves all 95 tests green). It is correct defensively, but no test pins it. Add a fixture where a terminal event arrives before the node's earliest event (out-of-order terminal) to lock the invariant. Not blocking.

## Scope / security / quality

- **Scope:** clean. Selector stays at its declared path `app/_observability/selectors/timeline.ts`; no creep into unrelated modules. (The commit also carries `TimelineView.tsx`, the separate frontend-dev UI sub-WO — expected.)
- **Security:** pure function, no I/O, no env, no Claude — matches the platform read-only rule. Note: unlike `rate.ts` (WO-12-003) this selector does not key untrusted strings into a plain object as own-property maps in a way that returns them to consumers, so the prototype-pollution class affecting `rate` does not apply here. No injection surface.
- **Quality:** typing strict, no `any`/`@ts-ignore`, regression anchors (B1'/I2/I3/FREEZE-ON-RED/ISO-offset) genuinely covered. Good.

## Required to pass (max 2 rejection cycles)
1. Fix B1 in `deriveWoRow` so WO status/end/duration account for direct-action children, not just task children. Make the failing adversarial test green without weakening it.
2. (Recommended) Add a test for M1.
3. Re-run `vitest run app/_observability/selectors/timeline*.ts` + `tsc --noEmit` + `biome check` green before re-submitting.
