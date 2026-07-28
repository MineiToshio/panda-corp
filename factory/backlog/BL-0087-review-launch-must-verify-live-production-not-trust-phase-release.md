---
id: BL-0087
type: change
area: plugin-skill
title: "review-launch must verify the live production artifact directly instead of trusting status.yaml's phase:release"
status: open
severity: p2
opened: 2026-07-28
closed:
source: "factory/memory/_inbox.md note, panda-corp 2026-07-28 scheduled review-launch sweep, project personal-page-v2; corroborates LESSON-0183 (already harvested by a concurrent orphan-of-harvest sweep, commit cf5c576b) — this item files the actionable-tooling half DR-103 splits off from that lesson"
closes:
links: [LESSON-0183, LESSON-0069, LESSON-0022, BL-0012]
---

## Problem
`personal-page-v2`'s `status.yaml` has read `phase: release` since 2026-07-01, and the portfolio's
review-launch kill-signal tracking (0 contacts AND <100 unique visitors over a 60-day window, DR-043) had
been running against that phase the whole time. A 2026-07-28 scheduled `/pandacorp:review-launch` sweep,
instead of accepting the phase flag, curled the production domain (`toshiominei.com`) directly and found it
still served the **pre-rebuild 2021 site** (Firebase-hosted blog, Disqus, jQuery-era CSS) — `/en/projects`
404s, `/en/blog` renders the old post, not the new MDX rebuild. `.pandacorp/comms/progress.md`'s close-out
only documents the internal integration gate going green; no capture point records `/pandacorp:release`'s
external deploy/DNS-cutover step actually running. Net effect: the 60-day kill-signal window has been
silently measuring traffic to a site the public never saw the rebuild of — a launch metric computed on a
false premise. See `LESSON-0183` (already harvested, agent-inferred, candidate) for the generalized
knowledge-store lesson; this item is the actionable tooling fix DR-103 splits off from it.

## Root cause
`review-launch` (and any other skill that reasons from a project having reached `phase: release`) treats
the phase flag as proof the external action its name implies — a production deploy + DNS cutover — actually
happened. The flag only certifies the internal FRD-loop + DR-085 hardening closed clean (same mechanism
`LESSON-0022`/`BL-0012` already fixed for the INTERNAL hardening step); nothing asserts the DISTINCT
external step ran, and no capture point records its outcome (success, failure, or "never attempted"). The
gap is silent by construction: nothing fails loud when the external deploy never happens.

## Fix plan
1. In `plugin/skills/review-launch/SKILL.md`, before computing/reporting any live metric or kill-signal
   verdict for a project whose `deploy_target` is external, add a live-artifact check: resolve the
   project's production domain/route (from its docs/blueprint or `status.yaml`) and `curl`/fetch it,
   diffing a known-new route or piece of content against what the build actually shipped — not just a
   200 status (a stale site can still 200).
2. If the live check disagrees with `phase: release` (the domain doesn't reflect the shipped build), treat
   it as a fail-loud signal: do not report the kill-signal window as valid data; surface the gap explicitly
   to the owner (the external deploy step appears to have never run or reverted) rather than silently
   reporting metrics computed on the wrong artifact.
3. Consider the symmetric fix at the source: `plugin/skills/release/SKILL.md`'s external-deploy path should
   leave a durable evidence artifact (a decision-log entry or a `status.yaml` field distinct from `phase`)
   confirming the DNS-cutover/deploy step ran and what it verified — so downstream skills have something
   to assert against besides re-curling every time.

## Tests (prove the fix — TDD, RED → GREEN)
Fixture: a project with `phase: release` and `deploy_target: external` but whose live domain (mocked/stubbed
in the test) serves stale content distinguishable from the shipped build. RED = current `review-launch`
reports the kill-signal window as valid data with no live check. GREEN = updated skill fetches the live
artifact, detects the mismatch, and refuses to report the window as valid — surfacing the gap instead.
Control: a project whose live domain DOES match the shipped build → metrics reported normally.

## Done when
`review-launch` no longer computes/reports launch metrics for an externally-deployed project without first
verifying the live production artifact; the RED fixture above passes GREEN; plugin version bumped per DR-034
(MINOR — new verification capability, no breaking change); `factory/standards/build-orchestration.md` or the
skill's own doc notes the new precondition; `LESSON-0183`'s `promotion` field revisited once shipped.

## Out of scope
Auto-triggering a re-deploy/DNS-fix when the mismatch is found (this stays a detect-and-flag fix, not an
auto-remediation — the actual redeploy for `personal-page-v2` itself is that PROJECT's own defect, routed
via its `.pandacorp/inbox/changes/` per DR-103, not this factory-tooling item).
