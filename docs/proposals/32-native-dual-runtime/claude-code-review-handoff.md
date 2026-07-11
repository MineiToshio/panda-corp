# Claude Code review handoff — Proposal 32

**Status:** COMPLETED 2026-07-10 — Claude report delivered and reconciled into Proposal 32; this file is retained as the dated review contract, not an active request for another review.
**Purpose:** Give a fresh Claude Code session everything required to independently challenge Proposal 32 before implementation.
**Primary artifact:** [Proposal 32](README.md)
**Completed review:** [Claude Code review report](claude-code-review-report.md)
**Reconciliation:** [Proposal 32 §18](README.md#18-claude-review-disposition-appendix)
**Required outputs:** `docs/proposals/32-native-dual-runtime/claude-code-review-report.md` and `docs/proposals/32-native-dual-runtime/claude-to-codex-return-prompt.md`
**Mode:** Read-only audit except for writing the two required handoff files. Do not implement, refactor, bump versions, modify standards, or change backlog state.

## Copy/paste prompt for Claude Code

```text
You are the independent Claude Code reviewer for Pandacorp Proposal 32.

Work from the factory root:
/Users/Shared/Proyectos/panda-corp

The owner needs an adversarial review before any implementation. The proposal was produced by a Codex principal-agent session after a repository audit, current Codex capability research, and three red-team passes. Your job is not to agree with it. Your job is to try to break it from the perspective of the runtime whose existing behavior must not regress.

FIRST, read completely:

1. AGENTS.md
2. CLAUDE.md
3. factory/constitution.md
4. factory/standards/single-source-of-truth.md
5. factory/standards/agent-portability.md
6. factory/standards/build-orchestration.md
7. plugin/docs/dynamic-workflows.md
8. docs/proposals/25-multi-runtime-portability.md
9. docs/proposals/32-native-dual-runtime/README.md
10. factory/backlog/BL-0030-port-enforcement-hooks-to-codex.md
11. factory/backlog/BL-0031-codex-rules-and-project-config.md
12. factory/backlog/BL-0032-openai-yaml-skill-sidecars.md

Then inspect the live implementation, not only the docs:

- plugin/templates/shared/.claude/engines/pandacorp-build.js
- .claude/engines/pandacorp-backlog.js
- plugin/skills/implement/SKILL.md
- plugin/skills/implement-backlog/SKILL.md
- plugin/hooks/hooks.json
- plugin/scripts/preflight-implement.sh
- plugin/scripts/launch-implement.sh
- plugin/scripts/verify-before-stop.sh
- plugin/scripts/generate-codex-agents.mjs
- plugin/scripts/check-derived-drift.sh
- plugin/.claude-plugin/plugin.json
- plugin/.codex-plugin/plugin.json
- .codex/agents/*.toml
- plugin/docs/routines.md
- mission-control/src/app/api/live/route.ts
- mission-control/src/lib/tasks/tasks.ts
- mission-control/src/lib/plugin-sync/plugin-sync.ts

Important current evidence to re-run rather than trust:

- node plugin/scripts/test-build-engine.mjs
- node plugin/scripts/test-pandacorp-build.mjs
- bash plugin/scripts/test-check-derived-drift.sh
- bash plugin/scripts/test-block-dangerous.sh
- bash plugin/scripts/test-warn-adhoc-write.sh
- bash plugin/scripts/test-detect-gate-config-newer.sh
- bash plugin/scripts/test-backup-and-precious.sh

The Codex session observed on 2026-07-10:

- review-split harness: 3/3 scenarios green;
- main build-engine harness: 54/54 scenarios green;
- derived drift: 10/10;
- dangerous command gate: 54/54;
- write nudge: 13/13;
- gate-config detector: 8/8;
- backup/protected-state: 12/12.

These are not sufficient proof of a real installed Dynamic Workflow, supervisor, plugin cache, overlay, hook payload, or cross-runtime build. Treat that distinction as a central review concern.

OWNER CONSTRAINTS — NEVER NEGOTIATE THESE AWAY:

1. One canonical source per fact.
2. One writer per state transition.
3. No duplicate agents, skills, policy, model mappings, package metadata, routines, or mutable build logic.
4. Generated artifacts are projections, never sources.
5. Claude Code must continue working at least as well as today.
6. Runtime-specific advantages are allowed and encouraged when they do not split truth or weaken governance.
7. The two installed recurring routines remain Claude-owned and must NOT be duplicated in Codex:
   - pandacorp-memory-review (already includes harvest + review)
   - pandacorp-review-launch
8. pandacorp-consistency-sweep is defined but currently not deployed; do not misreport it.
9. No writes to protected state directories through deletion/recreation/reset.
10. No implementation in this review turn.

REVIEW QUESTIONS — answer all with evidence:

A. Does Proposal 32 accurately describe current Claude behavior, including both Dynamic Workflows, the supervisor, hooks, plugin cache/restart, overlay deployment, Mission Control, and routines?

B. Does any proposed source map create a second definition, writer, generator, resolver, cache-as-truth path, or circular generation graph under DR-115?

C. Is the proposed single transition/state service technically compatible with the current Dynamic Workflow? Identify the smallest viable seam. Do not assume module imports or bundling work: verify from official Claude documentation and, if safely possible, a disposable runtime spike. Never experiment on a real project's durable state.

D. Does constitution §14 prohibit moving deterministic orchestration decisions outside the Dynamic Workflow? Recommend KEEP, CLARIFY, or CHANGE and show exact affected claims.

E. Validate the red-team lock finding. Can preflight and launch race? Can one runtime release another's lock? Can an uncertified Codex heartbeat disable Claude's Stop gate? Propose the minimum atomic lease contract and transition path.

F. Evaluate the rollout sequence R0–R11. Find ordering errors, missing prerequisites, migration dead ends, hidden big-bang steps, and rollback gaps.

G. Evaluate the Codex capability assumptions against the proposal's official sources. Mark each capability PROVEN, EXPERIMENTAL, FALLBACK, or UNSUPPORTED for this repository. Do not turn product documentation into proof that Pandacorp's contracts are satisfied.

H. Determine whether Codex V1 should be read/review-only, attended sequential build, isolated worktree build, or another shape. Explain how it preserves DR-060, the serialized writer, quiet-tree gates, independent review, and hardening.

I. Review enforcement. Is one shared policy plus runtime payload/registration adapters viable? Which hard-deny paths cannot rely on hooks alone? What live canaries are required before Codex receives write permission?

J. Review generated artifacts and manifests. Identify every current duplicate source: tier workers, model IDs, manifests, hooks registrations, docs matrices, or anything else. Give a precise canonical source and producer for each output.

K. Review Mission Control migration. Distinguish canonical state, durable evidence, ephemeral telemetry, runtime tasks, and plugin-install status. Challenge any plan that derives truth from event streams.

L. Confirm routine ownership from the actual installed scheduler and canonical routine definitions. Verify that no Codex automation should be generated for the two Claude-owned routines.

M. Cover the second workflow: define what parity or runtime specialization means for implement-backlog, including worktrees, merge serialization, validator gates, and resume.

N. Identify claims in Proposal 32 that are false, too strong, underspecified, or unverifiable. Quote the heading/claim and supply corrected wording.

O. Produce a final GO / MODIFY / NO-GO verdict for each implementation ring and for the proposal overall.

REQUIRED ADVERSARIAL TESTS IN THE REVIEW DESIGN:

- two contenders acquire the build lease simultaneously: exactly one winner;
- non-owner release fails;
- stale reclaim race;
- Codex crash must not suppress Claude Stop verification;
- malformed hook payload fails closed;
- a dangerous command is blocked through every relevant shell path;
- internal skill cannot auto-route around change;
- changing a derived count does not change planning/UI truth;
- changing live events does not change project state;
- changing a model/agent/manifest source without generation makes drift red;
- orphan generated output makes drift red;
- Claude safe point → Codex → Claude;
- Codex safe point → Claude;
- red gate preserves reviewer-authored tests;
- hardening failure cannot set release;
- plugin source/cache/overlay mismatch is detected;
- duplicate scheduler ownership is rejected.

OUTPUT CONTRACT:

Write exactly two handoff files and no other files:

docs/proposals/32-native-dual-runtime/claude-code-review-report.md
docs/proposals/32-native-dual-runtime/claude-to-codex-return-prompt.md

The report must be in English because it is committed technical documentation. The return prompt may be in Spanish, but it must preserve exact file paths and technical identifiers. Talk to the owner in Spanish in chat.

Use this structure:

# Claude Code independent review — Proposal 32

## Executive verdict
- Overall: GO | MODIFY | NO-GO
- One paragraph explaining why.

## Evidence inspected
- Files, runtime/docs sources, commands, and results.
- Distinguish live proof from inference.

## Findings
- Ranked P0 → P3.
- For every finding: claim, evidence with file references, impact, concrete correction, and acceptance test.
- An empty findings list is not acceptable without proving every review question.

## Claim correction table
| Proposal claim | Verdict | Corrected wording | Evidence |

## SSOT/source graph verdict
| Fact | Canonical source | Writer/generator | Outputs/consumers | Drift risk |

## Claude regression analysis
- Dynamic Workflow
- Supervisor/unattended contract
- Hooks and Stop gate
- Plugin cache/restart
- Overlay/project copies
- Mission Control
- Routines

## Codex capability verdict
| Capability | Status | Repository proof required | Safe fallback |

## Atomic lease recommendation
- State model, acquire, heartbeat, stale reclaim, release, Stop-gate delegation, compatibility migration.

## Revised rollout verdict
| Ring | GO/MODIFY/NO-GO | Prerequisites | Evidence to advance | Rollback |

## Required tests
- Exact executable tests and live canaries still needed.

## Backlog reconciliation
- BL-0030, BL-0031, BL-0032 and any new actionable gaps.
- Do not edit their status in this review.

## Owner decisions
- Only decisions that genuinely require the owner.

## Final recommended architecture
- The smallest architecture that satisfies both runtimes without split truth.

The second file, `claude-to-codex-return-prompt.md`, is a NON-CANONICAL transport artifact for the owner to copy back into Codex. It must contain one fenced prompt that tells Codex to:

1. Read the complete Claude review report and Proposal 32 from their exact paths.
2. Treat the report as dated independent evidence, not as a second canonical plan.
3. Reconcile every P0/P1, every claim correction, every ring verdict, and every owner decision.
4. Verify disputed claims against the live repository before accepting or rejecting them.
5. Modify Proposal 32 and the handoff documents as needed, but still perform no implementation.
6. Produce the final revised architecture/plan, a disposition table for every Claude finding, and only the genuine decisions that still require the owner.
7. Preserve one-source/one-writer, Claude non-regression, safe-point-only cross-runtime handoff, and the Claude ownership of the two deployed routines.

The prompt must be self-contained enough that a fresh Codex task can continue by reading the named files. It must not paste or duplicate the full review report; the report path is the source.

RULES FOR THE REVIEW:

- Be adversarial. Do not rubber-stamp Codex's proposal.
- Do not implement fixes.
- Do not modify Proposal 32; write deltas into the review report and the non-canonical return prompt.
- Do not change standards, registry, skills, agents, hooks, manifests, versions, backlog, Mission Control, or product projects.
- Do not commit.
- Do not run destructive commands.
- Do not create or modify a real product project's .pandacorp state.
- Disposable fixtures are allowed outside protected state.
- Inspect installed plugin caches and scheduler state read-only. Do not install/update/enable/trust a plugin, modify user or project Codex/Claude configuration, change hook trust, or create/update/pause/delete an automation during this review. If a live spike requires any such mutation, mark the claim UNKNOWN and specify the future gated spike instead.
- Use official primary documentation for current Claude/Codex capability claims.
- Preserve dated evidence as dated evidence; do not turn it into current policy.
- If a premise cannot be verified, label it UNKNOWN and define the exact spike required.
- The report is evidence for a later Codex revision, not a second canonical plan. The return prompt is transport only.

When finished, tell the owner in Spanish:

1. your overall verdict;
2. the top three risks;
3. the paths of both output files;
4. a copy-paste-ready fenced version of the return prompt in chat;
5. that no implementation was performed.
```

## Completed return path

Claude Code wrote the report and the owner returned it to Codex. The reconciliation instruction below has been fulfilled; Proposal 32 now contains the disposition tables and revised plan.

```text
Read docs/proposals/32-native-dual-runtime/claude-code-review-report.md completely. Reconcile every P0/P1 finding and every claim-correction against Proposal 32. Do not implement. Produce a revised plan or clearly defend any rejected recommendation with repository evidence. Surface only genuine owner decisions.
```
