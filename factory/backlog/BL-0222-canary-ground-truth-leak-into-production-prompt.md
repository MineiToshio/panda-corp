---
id: BL-0222
type: change
area: build-engine
title: "no guard prevents a canary's known-defect ground truth from leaking into the SAME production agent prompt the canary measures, after it already happened once (drift-finder, canary F2)"
status: open
severity: p2
opened: 2026-10-01
source: "mission-control .pandacorp/run/lessons.md 2026-09-26 (agent-inferred) — canary F2 (wf_8bab7752-702); docs/reviews/canary-f2-report.md; BL-0201's own closing note ('its production prompt named the canary's exact answer key — fixed in this same change'); the contamination was fixed ad hoc in commit 38333100 but no structural guard was filed"
closes:
links: [BL-0201, BL-0203, BL-0205]
---

## Problem
Canary F2 measured the whole-FRD drift finder's (BL-0203) recall against a known 5-defect ground truth
(`docs/reviews/canary-e2-report.md` §3.2). The finder's PRODUCTION prompt — `DRIFT_FINDER_DIRECTIVE`,
generated from `plugin/agents/drift-finder.md` by `generate-build-prompt-fragments.mjs` and shipped to
every real build, not just this canary — literally named the canary's 5 ground-truth clues, because the
canary's own setup/fixture material had been copied or referenced close enough to the production prompt
source that the two merged. This contaminated the measurement (the finder could not fail to "find" what
its own prompt told it to look for) AND meant every real build's drift finder was, until the ad hoc fix
(commit `38333100`, same day), running with canary answer-key text baked into its instructions.

The fix applied was a one-off edit to `plugin/agents/drift-finder.md` to strip the leaked text. No
mechanism (lint, test, or authoring convention) exists to prevent the SAME class of leak the next time a
canary's fixture/ground-truth material is drafted alongside a production agent's prompt file — the
`drift-finder` case is simply the first time anyone noticed; any future `plugin/agents/*.md` edited while
drafting a canary for it is equally exposed.

## Root cause
No separation of concerns between "the canary's known-defect answer key" (should live only in
`docs/reviews/canary-*-report.md` / a scoped fixture, never read by the production prompt generator) and
"the production agent's own prompt source" (`plugin/agents/*.md`, generated into every real build via
`generate-build-prompt-fragments.mjs`/`generate-codex-agents.mjs`). Nothing currently checks that a
production prompt file contains no text that also appears, verbatim, in a canary ground-truth list.

## Fix plan
1. A deterministic check (new script, e.g. `plugin/scripts/check-canary-contamination.sh`, or an addition
   to an existing prompt-fragment generation test) that greps every `plugin/agents/*.md` production prompt
   source against the literal ground-truth clue text recorded in `docs/reviews/canary-*-report.md` files
   (or a dedicated `docs/reviews/*-ground-truth.md` sidecar, if the report format doesn't cleanly separate
   it) and fails loud on any verbatim match longer than a short, generic phrase (avoid false positives on
   ordinary shared vocabulary — tune the match granularity, e.g. a whole clue sentence, not a single
   word).
2. Register it in `plugin/scripts/run-engine-tests.sh` so it runs on every suite pass, not only when
   someone remembers to check by hand.
3. Author-side convention (documented in `factory/standards/build-orchestration.md` or
   `plugin/docs/decision-log.md`'s canary-authoring note): when drafting a canary's ground truth,
   NEVER copy/paste from or into the production prompt file being measured; write the ground truth in
   the canary's own report/fixture, independently, even if it duplicates prose.

## Tests (prove the fix — TDD, RED → GREEN)
- A fixture where a production `plugin/agents/*.md` file contains a sentence byte-identical to a
  `docs/reviews/canary-*-report.md` ground-truth clue; the check must fail loud, naming the file and the
  matched text.
- A negative control: ordinary shared engineering vocabulary (not a verbatim clue sentence) must NOT false-
  positive.
- Regression: the actual F2 contamination text (the 5 named clues) run against the now-cleaned
  `drift-finder.md` must pass clean.

## Done when
- [ ] The contamination check exists, is registered in `run-engine-tests.sh`, and both tests above are
  green.
- [ ] The canary-authoring convention is documented in `factory/standards/build-orchestration.md` (or the
  decision log, if the standard is the wrong altitude for it).

## Out of scope
- Re-measuring canary F2 itself (already re-run clean per BL-0201's closing note; this item is only the
  missing structural guard, not a re-measurement).
- A general secrets/PII leak scanner — scope stays canary-ground-truth-into-production-prompt specifically.
