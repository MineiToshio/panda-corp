---
description: Debugging and incident investigation — reproduce first, timeline, evidence-discarded suspects (incl. parallel writers and the harness), confirmed-cause criterion, sibling audit, attribution guards.
applies_when: always
globs: ["**/*"]
source: Pandacorp standard — debugging
---

# Debugging and incident investigation

How to investigate unexpected behavior — a bug, a regression, an unexplained state change. The method is binding, not a style choice: investigation quality must not depend on who is driving.

## Reproduce first, then timeline
- Reproduce or obtain the artifact (log, screenshot, event) BEFORE touching anything; never fix from a verbal description alone.
- Establish the timeline: when did it last work? What changed in between (commits, deploys, upgrades, config edits, parallel sessions)? An uncommitted pile in the tree is timeline evidence of an interrupted prior run, not noise.

## Suspects: enumerated, discarded with evidence
- Read the FULL data path (source → transformations → surface) — the visible symptom is usually downstream of the cause.
- Enumerate suspects explicitly and discard them one by one with direct evidence (read the script, run the command, compare timestamps) — never by "unlikely".
- The suspect list ALWAYS includes: (a) another process/agent/session writing the same state, and (b) the harness/environment itself (a sandbox network block reads as "service down"; a frozen app auto-declines a tool call in words identical to a deliberate user refusal).

## Confirming and closing a cause
- Confirmed cause = it predicts the symptom AND explains the non-failures (why the working cases work). Anything less is a labeled hypothesis.
- Sibling audit before closing: once a cause is confirmed, ask "what else shares this cause?" and check — the same root usually has more than one manifestation.
- Fix minimal → exercise the real affected flow → add a regression test anchored in the bug when nothing existing would have caught it. A bug that passed every gate silently also names a missing independent oracle — fix the oracle too.

## No cause ≠ case closed
- If a genuine audit finds no root cause, do NOT close as "a mystery": close with attribution guards (logging, a pre-delete assertion, a backup, a canary) so a recurrence is attributable and non-destructive, and record what was ruled out.
