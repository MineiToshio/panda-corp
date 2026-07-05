# Proposal 28 — Sprint I adversarial verification report (Sprint II WS-A)

**Status:** in progress · **Date:** 2026-07-04 · **Executor:** Claude Fable 5 (Sprint II, proposal 27 WS-A)

## Plan

Independently verify Sprint I's four commits (`c5fb93b`, `f203d77`, `bad3329`, `a793738`)
with fresh-context verifier sub-agents acting as an independent oracle — not by re-running
the green tests (self-consistency). Five verifiers, run in parallel:

| Verifier | Scope | Oracle |
|---|---|---|
| V1a | `test-pandacorp-build.mjs` scenarios 1–6: is each locked behavior CORRECT or merely current? | `factory/standards/build-orchestration.md`, DR-060/086/069/072/073, constitution, engine source |
| V1b | Same, scenarios 7–11 + budget brake | same |
| V2 | WS3 prompt recalibration (architect, designer, product-manager, reviewer + BL-0042 preflight): did any never-degrade rule soften? | pre-sprint text at `515c5ff` vs current, PROMPT-4/6 extraction |
| V3 | WS1 guards bypass hunt (block-dangerous, warn-adhoc-write, check-derived-drift, detect-gate-config-newer, backup script) | adversarial input matrices (written to script files, never inlined — A2) |
| V4 | Wrong-tree strays (A1): Sprint I commit coherence, both trees | git history + claimed file sets |

Findings → each confirmed defect fixed here (if small) or filed as `BL-*` with evidence;
verdict table below; decision-log entry in `factory/decision-log.md`.

## Verdicts

**Headline:** Sprint I's landed work is sound — every one of the 11 WS2 characterization
scenarios locks **CORRECT** behavior (not merely current), no test blesses an open known defect,
the WS3 prompt recalibration softened **zero** never-degrade governance lines, and the WS3
"wrong-tree" transplant was **complete** (mirrors in sync, all suites green). But the independent
oracle surfaced **3 confirmed latent engine defects**, **3 confirmed HIGH guard bypasses**, and a
tail of minor issues + coverage gaps. The HIGH guard bypasses are **fixed in this workstream**; the
engine defects **feed WS-B1**; the rest is filed.

### 1. WS2 characterization scenarios — independent-oracle verdict (V1a + V1b)

| # | Scenario | Oracle | Verdict |
|---|---|---|---|
| 1a | args undefined → loud UNBOUNDED warning | BL-0024 §Tests (RED→GREEN demanded) | **CORRECT** |
| 1b | args as JSON string → warning | DR-072 R2 / BL-0024 no-regression | **CORRECT** |
| 1c | proper object → silent | negative control (falsifiable) | **CORRECT** |
| 2a | maxAgents brake stops waves | build-orchestration §6 | **CORRECT** |
| 2b | brake is COST-weighted (opus=3) | DR-073 token-proxy constant | **CORRECT** |
| 3 | DR-086 resume: VERIFIED never rebuilt, IN_REVIEW→gate | build-orchestration state table | **CORRECT** |
| 4a | DR-060 overlapping artifacts serialized | build-orchestration §2 (engine JS, not prompt) | **CORRECT** |
| 4b | DR-060 undeclared-artifacts fail-safe serialize | BL-0004 fix-item 3 | **CORRECT** |
| 5 | fail-safe close never touches `phase` | BL-0012 / §5b | **CORRECT** |
| 6a | DR-069 safe-point cadence at every boundary | audit-20 P0-3 / BL-0021 | **CORRECT** |
| 6b | rethink_pending stops the run | DR-069 / DR-068 | **CORRECT** |

No scenario is "merely current": each asserts the spec's fixed, fail-closed form, and every BL a
scenario touches is already `done`. Independence caveat honored — the verifiers cited only
pre-existing spec sections + closed BLs, never the same-sprint standard text (§10b) that describes
the suite.

### 2. Confirmed latent engine defects (→ feed WS-B1; confirmed by direct code-reading against spec)

| id | Defect | Evidence | Severity |
|---|---|---|---|
| **D1** | `integratedChanges` is **in-session** state (engine :322/:1037): a change integrated in run N whose FRDs verify in N+1 is never archivable from state — and, still `status: ready`, is re-drained next run (duplicate-WO risk / `pending_changes` never falls). Violates DR-069 §7 + PORT-5 "state lives in files". | V1b#1 | P1 |
| **D2** | `waveMax` (engine :967) budgets **1 raw unit/WO** but a WO costs `COST(model)+1` (2 sonnet / 4 opus) + dispatch: an opus-escalated wave overshoots maxAgents ~4× (verifier probe: 13 vs cap 6). Contradicts DR-073 token-proxy + BL-0004 "refuses to spawn beyond the cap". Scenario 2a passes only because it never escalates. | V1a F1 | P1 |
| **D3** | A **BLOCKED** WO read as a satisfied dependency (engine :935 `!globalQueue.has(d)`): a WO whose intra-FRD dep is BLOCKED builds anyway (fail-open). | V1a F3 | P2 |
| **D4** | `notify-end` (engine :1093) is the only spawn site missing `agentSpawned++` — a letter violation of DR-070's honest-counter rule (behaviorally near-inert). | V1a F2 | P3 |
| **D5** | A dead close-out still logs the unconditional "all FRDs verified + hardened" (engine :1076) regardless of `done:false`; the fail-safe catches it but the log already lied. | V1b#2 | P3 |
| **D6** | Stale fail-**OPEN** comment (engine :684-686, "undeclared artifacts → trust the Build Plan") contradicts the fail-**SAFE** code 12 lines below (`artifactsOverlap` returns true → serialize). | V1b#6 | P3 (doc) |

Test-suite coverage gaps to close in WS-B1 (new scenarios): foundation path (all current
scenarios `hasFrontend:false`), cross-FRD artifact overlap (BL-0021's whole point), the DR-069
drain (processChange→enroll), the hardening-FAILURE branch (`close-needs-hardening` — the branch
BL-0012's real incident came through), IN_PROGRESS/BLOCKED on resume, an escalated-opus-wave
overshoot scenario (proves D2), a BLOCKED-dep fail-open scenario (proves D3), and null/array args.

### 3. WS1 guard bypass hunt (V3) — HIGH bypasses FIXED in this workstream

| id | Finding | Grade | Disposition |
|---|---|---|---|
| **F1** | `rm -Rf` (capital `-R`, BSD/macOS-idiomatic) evaded both the protected-path and broad-delete rules (lowercase-`r`-only regex). Executed: `rm -Rf /` allowed. | CONFIRMED-BYPASS (HIGH) | **FIXED** — case-insensitive flag match + regex broad-delete rule; canaries added |
| **F2** | `git clean -fdX` (capital `-X` = ignored-only = *precisely* the gitignored `.pandacorp` layer) evaded the git-clean guard. | CONFIRMED-BYPASS (HIGH) | **FIXED** — `-[a-zA-Z]*[xX]`; canaries added |
| **F12** | `check-derived-drift.sh` **disarmed from any factory subdir** (cwd used literally, no git-toplevel walk-up) — real drift closes the session silently rc=0. Same bug class fixed in block-dangerous this sprint but not propagated. | CONFIRMED coverage-gap (HIGH) | **FIXED** — `git rev-parse --show-toplevel`; subdir canaries added |
| **F11** | `warn-adhoc-write.sh` same cwd-vs-toplevel bug (non-blocking, so lower severity). | COVERAGE-GAP | **FIXED** — toplevel resolution; subdir canaries added |
| **F3** | Redirect-truncation of protected state (`: > _inbox.md`, `cat /dev/null > decisions.md`) — same BL-0035 loss class as a delete. | COVERAGE-GAP | **FIXED** — single-`>` redirect-target check; canaries + `>>`-is-safe control |
| **F6** | `git stash drop`/`clear` unrecoverable. | COVERAGE-GAP | **FIXED** (partial) — stash drop/clear blocked; push/pop allowed |
| **F4/F5/F7/F8/F9** | `mv` relocation, `rsync --delete`, interpreter/shell/var indirection. | COVERAGE-GAP / THEORETICAL | **FILED BL-0043** (fix mv/rsync; document the string-gate boundary for F7-9) |
| **F10** | `plugin/agents/*.md` + manifest edits exempt from the isolation nudge yet red the drift gate. | COVERAGE-GAP | **FILED BL-0044** |
| **F13/F14** | backup misses nested projects + is defeated by worktree basename keying. | COVERAGE-GAP / FAILURE-MODE | **FILED BL-0045** |
| — | `detect-gate-config-newer.sh` | SOLID (within declared scope) | no action |
| — | "manifest versions equal but both stale" | ACCEPTED (deferred to BL-0025) | no action |

### 4. WS3 prompt recalibration (V2) — no governance softened

CLEAN: zero CRITICAL, zero MAJOR, zero unaccounted normative loss across all 19 recalibrated
files. Every PROMPT-4 never-degrade element verified surviving (production human gate "No
exceptions", DR-009 language rule, documentation discipline, fail-closed semantics, all
state-machine tokens). Frontmatter byte-identical (PROMPT-5). All findings MINOR (redundancy
collapse / pointer dedup) and accounted for in DR-114. Two pre-existing (NOT sprint-introduced)
nits noted for WS-B2: `plugin/skills/implement/SKILL.md:70` says "3 lenses" while `reviewer.md`
now enumerates 4; and `architect`/`product-manager` lack the trailing memory-RETRIEVE block that
`designer`/`reviewer` carry (a PROMPT-7 divergence predating the sprint).

### 5. WS3 wrong-tree transplant (V4 + deep-scan child) — complete

CLEAN across all 5 checks: every file DR-114 claims recalibrated shows a real non-empty diff (zero
lost strays), the claimed scope equals the actual file list, no conflict/merge markers or
half-copies, frontmatter untouched, `.codex/*.toml` mirrors regenerate with **zero drift**, and all
three test suites green. No sprint residue leaked into the main checkout. Non-finding noted for the
owner: a pre-existing `git stash` holds unrelated Mission Control product WIP (IdeaPitch /
mode-selector) — not sprint work.

## Method note (why this is an oracle, not a re-run)

The verdicts do NOT come from re-running the green suite (that only proves self-consistency — the
exact trap `factory/constitution.md` §24 names). Five fresh-context sub-agents read each artifact
against its **external** spec (build-orchestration.md, the decision logs, closed BLs, the
constitution) and, for the guards, against **executed** adversarial input matrices written to
script files (never inlined — the A2 discipline). Confirmed engine defects were then
re-derived independently by the author from the code-vs-spec reading before being accepted.

