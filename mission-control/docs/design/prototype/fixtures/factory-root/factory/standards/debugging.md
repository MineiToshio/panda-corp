# Debugging and incident investigation

> Domain: Quality/Testing · Severity: **MUST** · Enforcement: manual (NAMED steps: the `bug` skill's repro capture, the backlog item template's Root cause/Done-when sections, the `reviewer`'s regression-test check DR-015; owner spot-check) · Operative form: `rules/debugging.md` (DR-051). Codified 2026-07-15 from the BL-0035 precedent, LESSON-0040 and the 2026-07-13/15 misattribution incidents.

How any agent investigates unexpected behavior — a bug, a regression, an unexplained state change — in the factory or in any project, under any runtime. The factory already codifies WHAT proves a build correct (independent oracles, constitution §24; fail-closed gates, `quality.md`) and how the BUILD ENGINE recovers from a red gate (DR-117's diagnose ladder). This standard codifies the investigative method itself, which until now existed only as precedent and scattered lessons.

## Rule — reproduce first, then timeline (DEBUG-1)

- **Reproduce or obtain the artifact before touching anything.** The symptom is observed first-hand (run it, open it, read the log/screenshot/event). No fix is attempted from a verbal description alone — debugging by hearsay is how the wrong thing gets fixed.
- **Establish the timeline:** when did it last work? What changed in between — commits (`git log`), deploys, upgrades, config edits, parallel sessions? A recurrence check also starts here: an uncommitted pile in the working tree is timeline evidence (an interrupted prior run), not noise.

## Rule — suspects are enumerated and discarded with evidence (DEBUG-2)

- **Read the full data path** (source → transformations → surface), not only the point where the symptom shows: the visible symptom is usually downstream of the cause.
- **Enumerate suspects explicitly and discard them ONE BY ONE with direct evidence** (read the script, run the command, compare timestamps) — never by "unlikely".
- **The suspect list ALWAYS includes: (a) another process/agent/session writing the same state** — concurrent sessions are normal in this factory; DR-093 prevents collisions, it does not eliminate parallel writers — **and (b) the harness/environment itself.** Two real incidents: a sandboxed `curl` to a live LAN service reads as "service down" (2026-07-13), and a frozen app auto-declines a background agent's tool call in words identical to a deliberate owner refusal (2026-07-15). An agent that cannot suspect its own environment converts environment artifacts into false facts.

## Rule — a cause is confirmed only when it predicts, and it never closes alone (DEBUG-3)

- **Confirmed cause = it predicts the symptom AND explains the non-failures** (why the cases that work, work). A cause that cannot do both is still a hypothesis and is labeled as such (CONV-13).
- **Sibling audit before closing:** once a cause is confirmed, ask "what else shares this cause?" and check — the same root usually has more than one manifestation (the worktree-bootstrap root produced four sibling defects, BL-0026..0029).
- **Fix minimal → exercise the real affected flow → regression test** anchored in the bug when nothing existing would have caught it (DR-015). A bug that passed every gate silently is also a missing-oracle finding (constitution §24): fix the oracle, not just the bug.

## Rule — no cause ≠ case closed: attribution guards (DEBUG-4)

- When a genuine audit finds no root cause, the incident does NOT close as "a mystery": it closes with **attribution guards** — logging, a pre-delete assertion, a backup, a canary — such that a recurrence is **attributable and non-destructive**, plus a record of what was ruled out.
- The precedent is BL-0035 (11 versioned files deleted, cause never confirmed): its close shipped the out-of-repo backup layer, the hardened dangerous-command gate and the AGENTS.md protected-paths rule, so the same event today would be attributable and recoverable. That closure criterion — *"attributable rather than mysterious"* — was that one item's Done-when; this rule makes it every unexplained incident's Done-when.

## How it is verified

- **Manual, NAMED steps:** the `bug` skill captures the repro (steps/expected/actual) before filing; a factory `BL-*` item requires its Root cause section and a Done-when that is either a fixed-cause-with-regression-test or a guards-shipped attribution close (`factory/backlog/_item-template.md`, the BL-0035 pattern); the `reviewer` verifies the regression test at the FRD gate (DR-015).
- **Build-engine instance (wired):** DR-117's diagnose-before-revert ladder and the build journal's hypotheses-not-gospel injection are this standard's wired instance inside `/pandacorp:implement`; this document binds the same method outside the engine, where no hook enforces it.

## Why

Investigation quality currently depends on who is driving. BL-0035 shows the full method applied ad hoc — timeline reconstruction, suspect enumeration including a parallel external runtime, an attribution close — while the 2026-07-15 frozen-app incident shows the cost of its absence: a background agent read an environment artifact as a deliberate owner refusal and stopped, because "the environment is a suspect" was written nowhere binding. LESSON-0040 (a mass e2e failure that was a foreign process on a shared port plus an orphaned lock, not a regression) and the 2026-07-14 abandoned-harvest note (a routine trusted a note count where a `git status` timeline check would have caught days of uncommitted work) are the same class. A committed SOP makes the method binding for every agent and every runtime (PORT-4: process discipline never degrades), not a habit of whoever happens to remember it.
