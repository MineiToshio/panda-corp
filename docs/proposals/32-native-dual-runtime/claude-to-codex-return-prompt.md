# Return prompt — Codex reconciliation of the Claude Code review (Proposal 32)

**Nature:** NON-CANONICAL transport artifact. This file exists only so the owner can copy the prompt below into a fresh Codex conversation. It is not a plan, not a source of truth, and must not be cited as evidence. The canonical inputs are the two files it names.

```text
You are the Codex principal agent reconciling Pandacorp Proposal 32 with its independent Claude Code review.

Work from the factory root:
/Users/Shared/Proyectos/panda-corp

CONTEXT. Proposal 32 (native dual-runtime operation) was produced by a prior Codex session and then independently and adversarially reviewed by Claude Code on 2026-07-10. The review re-ran all seven baseline suites (all green), verified the repository facts, inspected both Dynamic Workflow engines, the hooks, the lock scripts, Mission Control, the installed scheduler (read-only), and the official Codex documentation. Your job now is to reconcile that review into a revised Proposal 32 — not to implement anything.

FIRST, read completely, in this order:

1. docs/proposals/32-native-dual-runtime/README.md            (Proposal 32, the artifact under revision)
2. docs/proposals/32-native-dual-runtime/claude-code-review-report.md   (the Claude Code review)
3. docs/proposals/32-native-dual-runtime/claude-code-review-handoff.md  (the contract the review answered)

TREAT THE REVIEW CORRECTLY. The review report is dated independent evidence (2026-07-10), produced by the runtime whose behavior must not regress. It is NOT a second canonical plan: where you accept a finding, fold the correction into Proposal 32 itself; where you reject one, you must show current repository evidence, not argument. Do not copy the report's text into the proposal as a parallel plan; the report path stays the source for what the reviewer said.

MANDATORY RECONCILIATION WORK:

1. Walk EVERY P0 and P1 finding in the report's "Findings" section (P0-1, P0-2, P1-1, P1-2, P1-3, P1-4, P1-5) and every P2/P3 as well. For each, verify the cited evidence against the live repository yourself (the report cites exact files and lines, e.g. factory/standards/agent-portability.md:73-80, plugin/scripts/verify-before-stop.sh, plugin/scripts/launch-implement.sh:42-48, plugin/scripts/generate-codex-agents.mjs:101-105 and 229-252, plugin/.codex-plugin/plugin.json:6, mission-control/src/lib/achievements/signals.ts, mission-control/src/lib/gamification/gamification.ts:574-584, plugin/templates/shared/.claude/engines/pandacorp-build.js, .claude/engines/pandacorp-backlog.js).

2. Walk EVERY row of the report's "Claim correction table" and apply or contest each corrected wording in Proposal 32.

3. Walk EVERY ring verdict in the report's "Revised rollout verdict" table (R0 through R11 plus Overall). Where the verdict is MODIFY, revise the ring's outputs/gates in Proposal 32 accordingly; pay particular attention to: the mislabeled "Gate R8" under ring R9; the duplicated "Run independent spikes" lines in R8; the new R0 output (owner-gated standards hotfix retracting the stale cross-runtime lock/resume claims in factory/standards/agent-portability.md and AGENTS.md); the re-scoped R5 (Dynamic Workflow script bodies cannot import modules, access the filesystem, or call CLIs directly — the spike is about generated-bundle semantics and subagent-invoked shared CLIs, not about imports); the R6 prompt-fragment-generation mechanism; the portable spend ledger in R4/R7/R11; the lease renewal cadence for attended executors in R2; and the achievements/XP dedup-and-ledger mechanism in R9.

4. Produce a DISPOSITION TABLE covering every finding (P0-1 through P3-2) and every claim-correction row, with exactly one disposition each: ACCEPTED, PARTIALLY ACCEPTED (say which part and why), or REJECTED WITH EVIDENCE (cite current repository files/lines that refute it). Include the table in the revised proposal or as a dated appendix section inside docs/proposals/32-native-dual-runtime/.

5. Modify docs/proposals/32-native-dual-runtime/README.md and docs/proposals/32-native-dual-runtime/claude-code-review-handoff.md as needed to reflect the reconciliation. Do NOT modify the review report itself — it is dated evidence.

6. Perform NO implementation: no changes to standards, constitution, registry, skills, agents, hooks, scripts, manifests, versions, backlog statuses, Mission Control, engines, routines, or any product project. The standards hotfix (P0-2) is proposed as an R0 output for the owner to approve via /pandacorp:learn — describe it in the plan; do not apply it.

7. Produce the FINAL revised architecture and implementation plan, incorporating the review's "Final recommended architecture" where accepted, and list ONLY the decisions that still genuinely require the owner (the report's "Owner decisions" section lists six candidates: the standards hotfix approval, the constitution §14 CLARIFY wording, the Codex V1 shape ratification, the acceptable end state if R5 is NO-GO, the appetite for unattended Codex given the machine-awake constraint, and the hook re-trust burden). Drop any of them you can resolve with repository evidence; elevate only the genuine ones.

INVARIANTS — NEVER NEGOTIATE THESE AWAY:

- One canonical source per fact; one writer per state transition; generated artifacts are projections, never sources.
- Claude Code must continue working at least as well as today; the Dynamic Workflow engines and the supervisor are preserved behind the last-known-good baseline.
- Cross-runtime handoff remains SAFE-POINT-ONLY while no stronger proof exists (the review confirms mid-run takeover corrupts the per-process commit chain and loses in-memory scheduler/brake state).
- Codex remains read/review-only until the atomic lease (R2) and certified enforcement (R3) gates pass.
- The two deployed recurring routines remain Claude-owned and must NOT be duplicated as Codex automations:
  - pandacorp-memory-review (it ALREADY includes harvest + review; there is no separate harvest routine)
  - pandacorp-review-launch
  pandacorp-consistency-sweep is defined in plugin/docs/routines.md but NOT deployed; do not misreport it.
- No writes to protected state paths (.pandacorp/ anywhere, factory/{ideas,memory,profile.md,portfolio.md}) through deletion/recreation/reset.
- Owner-facing chat is in Spanish; committed artifacts are in English (DR-009).

WHEN FINISHED, deliver: the revised Proposal 32, the disposition table, the final architecture/plan, and the short list of genuine owner decisions. Do not implement.
```
