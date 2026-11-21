# Proposal 44: research evidence

Evidence behind `docs/proposals/44-verification-strategy.md`, gathered 2026-11-21 by read-only research workers. No gate, build, test suite or merge was run to produce it. The files are copies of the research scratchpad; their internal links of the form `../work/<file>` refer to `work/<file>` in this folder, and absolute `/private/tmp/...` paths refer to the original scratchpad location, which is not kept.

## Precedence

`verify-ratio.md`, `verify-sources.md`, `redteam.md`, `verify-memo.md` and `reverify-memo.md` correct the other files. Where they disagree, the correctors win. `synthesis.md` is the first draft of the recommendation and is kept only as the object of the red team; its pooled catch rate, its reviewer count and its time-saving forecast are withdrawn.

## Index

| File | What it is |
|---|---|
| `gatemap.md` | Every check on the path to "done" as read from the code and runtime logs: what it verifies, when it runs, whether it blocks, its class, plus test counts per project. |
| `timing.md` | Where implementation time goes: queue ledgers (part of 2026-11-21 only), archived gate reports, Funko build journals, time to main from Git. |
| `funko-case.md` | Reconstruction of the Funko Tracker "which product lines to follow" incident (2026-11-20/21) and three comparable episodes. |
| `ratio.md` | First census of gate reds versus real product bugs. Partly superseded by `verify-ratio.md`. |
| `history.md` | Chronology of verification changes since June, rejected approaches, current constraints, memory and backlog cross-reference. |
| `ext-practices.md` | Frontier models as of 2026-11-21 and how agent-heavy teams verify code. Corrected by `verify-sources.md`. |
| `ext-evidence.md` | Published studies on agent-written tests, gaming, flakiness, gate cost and alternatives. Corrected by `verify-sources.md`. |
| `synthesis.md` | First draft of the recommendation (superseded). |
| `verify-ratio.md` | Independent audit of the catch ratio: label-masked reread, Funko queue adjudication, random sample of worker test outputs, reviewer findings checked against Git. |
| `verify-sources.md` | Fact-check of 30 external claims (17 confirmed, 11 partly, 1 wrong, 1 not found) plus contradicting studies. |
| `redteam.md` | Eight attacks on the draft, their verdicts, and the corrected recommendation that proposal 44 adopts. |
| `verify-memo.md` | Independent acceptance audit of the first revision of proposal 44 and its Spanish chat summary (4 blockers, 9 should-fix, 2 nits), with direct checks against the real system, including the Funko queue attempts after the research cutoff. Its items were applied in a revision that `reverify-memo.md` then checked. |
| `reverify-memo.md` | Independent re-verification of that revision (6 applied, 9 partly applied, verdict fit with corrections) and the replacement text used to close the partly applied items in the final revision. |
| `work/` | Helper scripts and their text outputs (`*.py`, `*.txt`, `appendix.md`, `history_evidence.md`). |

## Not copied

- JSON intermediates from the scratchpad (`reds.json`, `episodes.json` over 1 MB; the smaller `distinct.json`, `funko.json`, `mc.json`, `ppv2.json`, `codex_eps*.json`, `stop_tally.json`). They hold transcript excerpts, are regenerable with the scripts in `work/`, and several scripts need them to rerun.
