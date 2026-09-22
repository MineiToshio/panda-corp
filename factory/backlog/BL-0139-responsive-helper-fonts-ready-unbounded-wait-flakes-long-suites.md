---
id: BL-0139
type: bug
area: templates
title: "_responsive-helper.ts's document.fonts.ready await has no timeout, producing a ~30s flake in long verify.sh suites"
status: open
severity: p2
opened: 2026-09-22
closed:
source: "observed live 2026-09-21 in mission-control, /proposals route, verify.sh run; isolated re-run passed 4/4"
closes:
links: [DR-074]
---

## Problem
`_responsive-helper.ts:51` does `await page.evaluate(() => document.fonts.ready)` with no timeout of its
own — it relies entirely on Playwright's outer test/action timeout to eventually bail. Observed live on
2026-09-21 in `mission-control` on the `/proposals` route during a full `verify.sh` run: the step
intermittently stalls for ~30s before the outer timeout fires and fails the test, while the SAME check
run in isolation (route + fixture alone, 4/4 runs) passes cleanly every time. This is a suite-length-
dependent flake — the failure mode this project's own `quality-and-testing.md` rule ("No hard waits...
never `waitForTimeout`") exists to prevent, except this is the inverse defect: not a hard wait added by a
test author, but a genuinely-unbounded browser API wait with nothing capping it, surfacing only under
load (many concurrent/sequential Playwright workers competing for CPU/font-loading I/O during a long
suite).

## Root cause
`document.fonts.ready` is a browser Promise with no inherent timeout; under normal single-test load it
resolves fast enough that the outer Playwright timeout never matters, masking the fact that nothing
BOUNDS this specific await. Under a long `verify.sh` suite's resource contention, font loading can
genuinely take long enough to blow past the outer timeout, and because the await has no timeout of its
own, the failure surfaces as a generic outer-timeout failure with no specific diagnostic pointing at
fonts — costing debugging time on top of the flake itself.

## Fix plan
`_responsive-helper.ts` is a **verbatim template file** (`plugin/templates/...`, DR-074's Responsive Gate
harness) — the fix lands in the PLUGIN template, never hand-patched in an individual project's copy (the
project copy is regenerated from the template; a local patch would be silently overwritten by the next
`/pandacorp:upgrade`). Wrap the `document.fonts.ready` await with its own bounded timeout (~5s, matching
DR-074's existing tap-target/gate timeout conventions) using `Promise.race` against a timer, or
Playwright's own timeout-capable wait primitive if one applies to a page-context evaluate. On timeout,
proceed rather than fail the whole check — a slow-but-eventually-fine font load should degrade to
"checked without waiting for the exact font," not fail the Responsive Gate outright (the gate's actual
purpose, tap-target/overflow checks, does not require fonts to be fully settled to be meaningful).

## Tests (prove the fix — TDD, RED → GREEN)
A fixture that stubs `document.fonts.ready` to resolve after > 5s (simulating the contended-suite delay)
must NOT propagate a 30s-plus stall or an outer-timeout failure — the wrapped await should return (via
its own timeout branch) within ~5s and the Responsive Gate check should still complete. Control: a
fixture with `document.fonts.ready` resolving fast (the normal case) must still wait for the real
resolution (not always short-circuit to the timeout branch) — the wrap must not silently skip a fast,
healthy wait. Re-run the observed real repro (mission-control `/proposals` under a full suite, several
times) to confirm the flake clears; note in the commit if it could not be reproduced deterministically
(timing-dependent flakes sometimes can't be forced) and rely on the fixture tests as the primary proof.

## Done when
The template's `document.fonts.ready` await is bounded (~5s) with a proceed-on-timeout fallback; the
fixture tests above are green; the template's project-copy sync (`/pandacorp:upgrade` conformance)
propagates the fix to existing projects including `mission-control`; plugin version bumped per DR-034
(PATCH — narrows an unbounded wait, no behavior-contract change to the gate's pass/fail semantics);
decision-log entry citing DR-074 and this observed repro.

## Out of scope
Any other unbounded wait `_responsive-helper.ts` or the wider DR-074 harness may have — this item is
scoped to the one observed `document.fonts.ready` call at line 51; a broader audit is a separate item if
warranted.
